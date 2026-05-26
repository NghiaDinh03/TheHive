package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/repository/autonomous"
	"github.com/thehive-platform/backend/internal/repository/workwrite"
	"go.uber.org/zap"
)

type AutonomousHandler struct {
	db   *sqlx.DB
	repo *autonomous.Repository
}

func NewAutonomousHandler(db *sqlx.DB) *AutonomousHandler {
	return &AutonomousHandler{
		db:   db,
		repo: autonomous.NewRepository(db),
	}
}

type ruleRequest struct {
	Name                 string `json:"name" validate:"required"`
	Description          string `json:"description"`
	ObservableType       string `json:"observable_type" validate:"required"`
	ThreatScoreThreshold int    `json:"threat_score_threshold" validate:"required"`
	WebhookURL           string `json:"webhook_url" validate:"required"`
	IsActive             bool   `json:"is_active"`
}

func (h *AutonomousHandler) ListRules(c echo.Context) error {
	rules, err := h.repo.ListRules(c.Request().Context())
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to list rules")
	}
	return c.JSON(http.StatusOK, rules)
}

func (h *AutonomousHandler) GetRule(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	rule, err := h.repo.GetRule(c.Request().Context(), id)
	if err != nil {
		return apierr.New(http.StatusNotFound, "rule not found")
	}
	return c.JSON(http.StatusOK, rule)
}

func (h *AutonomousHandler) CreateRule(c echo.Context) error {
	var req ruleRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.ObservableType) == "" || strings.TrimSpace(req.WebhookURL) == "" {
		return apierr.New(http.StatusBadRequest, "name, observable_type, and webhook_url are required")
	}
	rule, err := h.repo.CreateRule(c.Request().Context(), autonomous.AutonomousRule{
		Name:                 req.Name,
		Description:          req.Description,
		ObservableType:       req.ObservableType,
		ThreatScoreThreshold: req.ThreatScoreThreshold,
		WebhookURL:           req.WebhookURL,
		IsActive:             req.IsActive,
	})
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusCreated, rule)
}

func (h *AutonomousHandler) UpdateRule(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var req ruleRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	rule, err := h.repo.UpdateRule(c.Request().Context(), id, autonomous.AutonomousRule{
		Name:                 req.Name,
		Description:          req.Description,
		ObservableType:       req.ObservableType,
		ThreatScoreThreshold: req.ThreatScoreThreshold,
		WebhookURL:           req.WebhookURL,
		IsActive:             req.IsActive,
	})
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusOK, rule)
}

func (h *AutonomousHandler) DeleteRule(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	deleted, err := h.repo.DeleteRule(c.Request().Context(), id)
	if err != nil {
		return apierr.New(http.StatusNotFound, "rule not found")
	}
	return c.JSON(http.StatusOK, deleted)
}

func (h *AutonomousHandler) ListLogs(c echo.Context) error {
	logs, err := h.repo.ListLogs(c.Request().Context())
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to list logs")
	}
	return c.JSON(http.StatusOK, logs)
}

func (h *AutonomousHandler) ListActiveRules(c echo.Context) error {
	rules, err := h.repo.ListRules(c.Request().Context())
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to list active rules")
	}
	activeRules := []autonomous.AutonomousRule{}
	for _, r := range rules {
		if r.IsActive {
			activeRules = append(activeRules, r)
		}
	}
	return c.JSON(http.StatusOK, activeRules)
}

func TriggerResponse(ctx context.Context, db *sqlx.DB, obs workwrite.ObservableResponse) {
	repo := autonomous.NewRepository(db)
	rules, err := repo.ListRules(ctx)
	if err != nil {
		zap.L().Error("failed to list autonomous rules for trigger", zap.Error(err))
		return
	}

	for _, rule := range rules {
		if !rule.IsActive {
			continue
		}
		if strings.ToLower(rule.ObservableType) == strings.ToLower(obs.DataType) && obs.MaliciousScore >= rule.ThreatScoreThreshold {
			zap.L().Info("triggering autonomous rule", zap.String("rule_name", rule.Name), zap.String("obs_id", obs.ID))
			
			logItem := autonomous.AutonomousLog{
				RuleID:          rule.ID,
				RuleName:        rule.Name,
				ObservableID:    obs.ID,
				ObservableType:  obs.DataType,
				ObservableValue: obs.Data,
				ThreatScore:     obs.MaliciousScore,
				ActionTaken:     "Trigger n8n Webhook",
				Status:          "Pending",
			}
			createdLog, err := repo.CreateLog(ctx, logItem)
			if err != nil {
				zap.L().Error("failed to create autonomous log", zap.Error(err))
				continue
			}

			go func(logID string, webhookURL string, ruleName string) {
				payload := map[string]any{
					"event":            "threat_hunting_alert",
					"rule_id":          rule.ID,
					"rule_name":        ruleName,
					"observable_id":    obs.ID,
					"observable_type":  obs.DataType,
					"observable_value": obs.Data,
					"threat_score":     obs.MaliciousScore,
					"timestamp":        time.Now().UTC().Format(time.RFC3339),
				}
				bodyBytes, _ := json.Marshal(payload)
				
				client := &http.Client{Timeout: 15 * time.Second}
				req, err := http.NewRequestWithContext(context.Background(), "POST", webhookURL, bytes.NewBuffer(bodyBytes))
				if err != nil {
					_ = repo.UpdateLogStatus(context.Background(), logID, "Failed", "Request creation error: "+err.Error())
					return
				}
				req.Header.Set("Content-Type", "application/json")

				resp, err := client.Do(req)
				if err != nil {
					_ = repo.UpdateLogStatus(context.Background(), logID, "Failed", "Network error: "+err.Error())
					return
				}
				defer resp.Body.Close()

				var buf bytes.Buffer
				_, _ = buf.ReadFrom(resp.Body)
				respStr := buf.String()

				status := "Success"
				if resp.StatusCode < 200 || resp.StatusCode >= 300 {
					status = "Failed"
				}
				
				_ = repo.UpdateLogStatus(context.Background(), logID, status, fmt.Sprintf("HTTP %d: %s", resp.StatusCode, respStr))
			}(createdLog.ID, rule.WebhookURL, rule.Name)
		}
	}
}

type triggerManualRequest struct {
	RuleID       string `json:"rule_id" validate:"required"`
	ObservableID string `json:"observable_id" validate:"required"`
	TaskID       string `json:"task_id"`
}

func (h *AutonomousHandler) TriggerManual(c echo.Context) error {
	var req triggerManualRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if strings.TrimSpace(req.RuleID) == "" || strings.TrimSpace(req.ObservableID) == "" {
		return apierr.New(http.StatusBadRequest, "rule_id and observable_id are required")
	}

	ctx := c.Request().Context()

	// 1. Lấy thông tin Rule
	rule, err := h.repo.GetRule(ctx, req.RuleID)
	if err != nil {
		return apierr.New(http.StatusNotFound, "rule not found")
	}

	// 2. Lấy thông tin Observable
	var obs struct {
		ID             string `db:"id"`
		DataType       string `db:"data_type"`
		Data           string `db:"data"`
		MaliciousScore int    `db:"malicious_score"`
	}
	err = h.db.GetContext(ctx, &obs, "SELECT id, data_type, data, malicious_score FROM observables WHERE id = $1", req.ObservableID)
	if err != nil {
		return apierr.New(http.StatusNotFound, "observable not found")
	}

	// 3. Lấy thông tin Task (nếu có)
	var task struct {
		ID    string `db:"id"`
		Title string `db:"title"`
	}
	if req.TaskID != "" {
		_ = h.db.GetContext(ctx, &task, "SELECT id, title FROM tasks WHERE id = $1", req.TaskID)
	}

	actionTaken := "Kích hoạt thủ công"
	if task.Title != "" {
		actionTaken = fmt.Sprintf("Kích hoạt thủ công từ Task: %s", task.Title)
	}

	// 4. Tạo record log trạng thái Pending
	logItem := autonomous.AutonomousLog{
		RuleID:          rule.ID,
		RuleName:        rule.Name,
		ObservableID:    obs.ID,
		ObservableType:  obs.DataType,
		ObservableValue: obs.Data,
		ThreatScore:     obs.MaliciousScore,
		ActionTaken:     actionTaken,
		Status:          "Pending",
	}
	createdLog, err := h.repo.CreateLog(ctx, logItem)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to create response log")
	}

	// 5. Gọi Webhook n8n bất đồng bộ
	go func(logID string, webhookURL string, ruleName string, userName string) {
		payload := map[string]any{
			"event":            "manual_response_trigger",
			"rule_id":          rule.ID,
			"rule_name":        ruleName,
			"observable_id":    obs.ID,
			"observable_type":  obs.DataType,
			"observable_value": obs.Data,
			"threat_score":     obs.MaliciousScore,
			"task_id":          task.ID,
			"task_title":       task.Title,
			"triggered_by":     userName,
			"timestamp":        time.Now().UTC().Format(time.RFC3339),
		}
		bodyBytes, _ := json.Marshal(payload)
		
		client := &http.Client{Timeout: 15 * time.Second}
		reqHttp, err := http.NewRequestWithContext(context.Background(), "POST", webhookURL, bytes.NewBuffer(bodyBytes))
		if err != nil {
			_ = h.repo.UpdateLogStatus(context.Background(), logID, "Failed", "Request creation error: "+err.Error())
			return
		}
		reqHttp.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(reqHttp)
		if err != nil {
			_ = h.repo.UpdateLogStatus(context.Background(), logID, "Failed", "Network error: "+err.Error())
			return
		}
		defer resp.Body.Close()

		var buf bytes.Buffer
		_, _ = buf.ReadFrom(resp.Body)
		respStr := buf.String()

		status := "Success"
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			status = "Failed"
		}
		
		_ = h.repo.UpdateLogStatus(context.Background(), logID, status, fmt.Sprintf("HTTP %d: %s", resp.StatusCode, respStr))
	}(createdLog.ID, rule.WebhookURL, rule.Name, actorLogin(c))

	return c.JSON(http.StatusOK, map[string]any{
		"status": "triggered",
		"log_id": createdLog.ID,
	})
}
