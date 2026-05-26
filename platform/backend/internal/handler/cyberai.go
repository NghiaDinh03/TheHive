package handler

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/authjwt"
)

type CyberAIHandler struct {
	db *sqlx.DB
}

func NewCyberAIHandler(db *sqlx.DB) *CyberAIHandler {
	return &CyberAIHandler{db: db}
}

type AIAnalyzeResponse struct {
	ThreatAnalysis             string   `json:"threat_analysis"`
	RiskRating                 string   `json:"risk_rating"`
	ContainmentRecommendations []string `json:"containment_recommendations"`
}

type chatRequest struct {
	Message      string `json:"message"`
	SessionID    string `json:"session_id"`
	Model        string `json:"model"`
	PreferCloud  bool   `json:"prefer_cloud"`
	Organisation string `json:"organisation"`
}

type chatResponse struct {
	Response  string `json:"response"`
	Model     string `json:"model"`
	SessionID string `json:"session_id"`
}

func (h *CyberAIHandler) Analyze(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	claims, _ := c.Get("auth_claims").(*authjwt.Claims)
	orgID := ""
	if claims != nil {
		orgID = claims.Organisation
	}

	// 1. Lấy thông tin case chi tiết
	var caseTitle, caseDesc string
	err := h.db.QueryRowContext(c.Request().Context(), "SELECT title, description FROM cases WHERE id = $1::uuid", caseID).Scan(&caseTitle, &caseDesc)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "Case not found")
	} else if err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to fetch case info: "+err.Error())
	}
	caseTitle = SanitizePromptInjection(caseTitle)
	caseDesc = SanitizePromptInjection(caseDesc)

	// 2. Lấy thông tin observables liên quan
	type dbObservable struct {
		DataType string `db:"data_type"`
		Data     string `db:"data"`
		Message  string `db:"message"`
	}
	var obs []dbObservable
	err = h.db.SelectContext(c.Request().Context(), &obs, "SELECT data_type, data, message FROM observables WHERE case_id = $1::uuid", caseID)
	if err != nil {
		obs = []dbObservable{}
	}
	for i := range obs {
		obs[i].Data = SanitizePromptInjection(obs[i].Data)
		obs[i].Message = SanitizePromptInjection(obs[i].Message)
	}

	// 3. Lấy thông tin tasks liên quan
	type dbTask struct {
		Title       string `db:"title"`
		Description string `db:"description"`
		Status      string `db:"status"`
	}
	var tasks []dbTask
	err = h.db.SelectContext(c.Request().Context(), &tasks, "SELECT title, description, status FROM task_items WHERE case_id = $1::uuid", caseID)
	if err != nil {
		tasks = []dbTask{}
	}
	for i := range tasks {
		tasks[i].Title = SanitizePromptInjection(tasks[i].Title)
		tasks[i].Description = SanitizePromptInjection(tasks[i].Description)
	}

	// 4. Lấy cấu hình AI từ database
	apiURL := "http://cyber-ai-service:8000"
	modelName := "gemma"
	
	var dbURL, dbModel string
	_ = h.db.QueryRowContext(c.Request().Context(), "SELECT value FROM system_settings WHERE key = 'cyberai_api_url'").Scan(&dbURL)
	_ = h.db.QueryRowContext(c.Request().Context(), "SELECT value FROM system_settings WHERE key = 'cyberai_model'").Scan(&dbModel)

	if dbURL != "" {
		apiURL = dbURL
	}
	if dbModel != "" {
		modelName = dbModel
	}

	// 5. Chuẩn bị prompt chi tiết
	var promptBuilder strings.Builder
	promptBuilder.WriteString(fmt.Sprintf("Case Title: %s\n", caseTitle))
	promptBuilder.WriteString(fmt.Sprintf("Description: %s\n\n", caseDesc))

	if len(obs) > 0 {
		promptBuilder.WriteString("Observables (IOCs):\n")
		for _, o := range obs {
			promptBuilder.WriteString(fmt.Sprintf("- Type: %s, Data: %s, Details: %s\n", o.DataType, o.Data, o.Message))
		}
		promptBuilder.WriteString("\n")
	}

	if len(tasks) > 0 {
		promptBuilder.WriteString("Tasks checklist:\n")
		for _, t := range tasks {
			promptBuilder.WriteString(fmt.Sprintf("- Task: %s, Status: %s, Description: %s\n", t.Title, t.Status, t.Description))
		}
		promptBuilder.WriteString("\n")
	}

	promptBuilder.WriteString("Based on the incident metrics above, perform a cybersecurity threat assessment and return a structured JSON response. You MUST return ONLY a valid JSON object matching this schema exactly:\n")
	promptBuilder.WriteString("{\n  \"threat_analysis\": \"Detailed threat explanation...\",\n  \"risk_rating\": \"Critical/High/Medium/Low\",\n  \"containment_recommendations\": [\"action 1\", \"action 2\"]\n}\n")
	promptBuilder.WriteString("Do not include any explanation, markdown, code blocks, or preamble. Return only the raw JSON.")

	// 6. Gửi request tới CyberAI FastAPI
	client := &http.Client{Timeout: 120 * time.Second}
	
	// Gọi endpoint /api/v1/chat của FastAPI
	targetURL := fmt.Sprintf("%s/api/v1/chat", strings.TrimSuffix(apiURL, "/"))
	reqBody, _ := json.Marshal(chatRequest{
		Message:      promptBuilder.String(),
		SessionID:    caseID,
		Model:        modelName,
		PreferCloud:  false,
		Organisation: orgID,
	})

	req, err := http.NewRequestWithContext(c.Request().Context(), "POST", targetURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to create request: "+err.Error())
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		// Thử gọi /api/chat dự phòng
		targetURL = fmt.Sprintf("%s/api/chat", strings.TrimSuffix(apiURL, "/"))
		req, _ = http.NewRequestWithContext(c.Request().Context(), "POST", targetURL, bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")
		resp, err = client.Do(req)
		if err != nil {
			return apierr.New(http.StatusBadGateway, "CyberAI Service is unreachable: "+err.Error())
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return apierr.New(resp.StatusCode, "CyberAI Service error: "+string(bodyBytes))
	}

	var chatResp chatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return apierr.New(http.StatusBadGateway, "Failed to decode CyberAI response: "+err.Error())
	}

	// 7. Parse response raw string sang JSON Object
	rawResponse := chatResp.Response
	
	// Làm sạch code block nếu AI cố trả về ```json ... ```
	rawResponse = strings.TrimSpace(rawResponse)
	if strings.HasPrefix(rawResponse, "```json") {
		rawResponse = strings.TrimPrefix(rawResponse, "```json")
		rawResponse = strings.TrimSuffix(rawResponse, "```")
	} else if strings.HasPrefix(rawResponse, "```") {
		rawResponse = strings.TrimPrefix(rawResponse, "```")
		rawResponse = strings.TrimSuffix(rawResponse, "```")
	}
	rawResponse = strings.TrimSpace(rawResponse)

	var analysisObj AIAnalyzeResponse
	if err := json.Unmarshal([]byte(rawResponse), &analysisObj); err != nil {
		// Fallback nếu không parse được JSON
		analysisObj = AIAnalyzeResponse{
			ThreatAnalysis:             rawResponse,
			RiskRating:                 "High",
			ContainmentRecommendations: []string{"Isolate affected hosts", "Review network connection logs"},
		}
	}

	// 8. Lưu vào database
	updatedJSON, err := json.Marshal(analysisObj)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to serialize analysis results: "+err.Error())
	}

	_, err = h.db.ExecContext(c.Request().Context(), "UPDATE cases SET ai_assessment = $1::jsonb, updated_at = now() WHERE id = $2::uuid", updatedJSON, caseID)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to save AI assessment: "+err.Error())
	}

	return c.JSON(http.StatusOK, analysisObj)
}

func (h *CyberAIHandler) Chat(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	claims, _ := c.Get("auth_claims").(*authjwt.Claims)
	orgID := ""
	if claims != nil {
		orgID = claims.Organisation
	}
	var reqBody struct {
		Message string `json:"message"`
	}
	if err := c.Bind(&reqBody); err != nil {
		return apierr.New(http.StatusBadRequest, "Invalid request body")
	}
	if reqBody.Message == "" {
		return apierr.New(http.StatusBadRequest, "Message is required")
	}
	reqBody.Message = SanitizePromptInjection(reqBody.Message)

	// 1. Lấy cấu hình AI từ database
	apiURL := "http://cyber-ai-service:8000"
	modelName := "gemma"
	
	var dbURL, dbModel string
	_ = h.db.QueryRowContext(c.Request().Context(), "SELECT value FROM system_settings WHERE key = 'cyberai_api_url'").Scan(&dbURL)
	_ = h.db.QueryRowContext(c.Request().Context(), "SELECT value FROM system_settings WHERE key = 'cyberai_model'").Scan(&dbModel)

	if dbURL != "" {
		apiURL = dbURL
	}
	if dbModel != "" {
		modelName = dbModel
	}

	// 2. Gửi request tới CyberAI FastAPI
	client := &http.Client{Timeout: 120 * time.Second}
	
	targetURL := fmt.Sprintf("%s/api/v1/chat", strings.TrimSuffix(apiURL, "/"))
	reqBodyBytes, _ := json.Marshal(chatRequest{
		Message:      reqBody.Message,
		SessionID:    caseID,
		Model:        modelName,
		PreferCloud:  false,
		Organisation: orgID,
	})

	req, err := http.NewRequestWithContext(c.Request().Context(), "POST", targetURL, bytes.NewBuffer(reqBodyBytes))
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to create request: "+err.Error())
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		// Fallback sang endpoint /api/chat
		targetURL = fmt.Sprintf("%s/api/chat", strings.TrimSuffix(apiURL, "/"))
		req, _ = http.NewRequestWithContext(c.Request().Context(), "POST", targetURL, bytes.NewBuffer(reqBodyBytes))
		req.Header.Set("Content-Type", "application/json")
		resp, err = client.Do(req)
		if err != nil {
			return apierr.New(http.StatusBadGateway, "CyberAI Service is unreachable: "+err.Error())
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return apierr.New(resp.StatusCode, "CyberAI Service error: "+string(bodyBytes))
	}

	var chatResp chatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return apierr.New(http.StatusBadGateway, "Failed to decode CyberAI response: "+err.Error())
	}

	return c.JSON(http.StatusOK, chatResp)
}

func (h *CyberAIHandler) GetSettings(c echo.Context) error {
	rows, err := h.db.QueryxContext(c.Request().Context(), "SELECT key, value FROM system_settings")
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to query system settings: "+err.Error())
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err == nil {
			settings[key] = value
		}
	}

	return c.JSON(http.StatusOK, settings)
}

func (h *CyberAIHandler) SaveSettings(c echo.Context) error {
	var input map[string]string
	if err := c.Bind(&input); err != nil {
		return apierr.New(http.StatusBadRequest, "Invalid request body")
	}

	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to start transaction: "+err.Error())
	}
	defer func() { _ = tx.Rollback() }()

	for k, v := range input {
		_, err = tx.ExecContext(c.Request().Context(), `
			INSERT INTO system_settings (key, value, updated_at)
			VALUES ($1, $2, now())
			ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`, k, v)
		if err != nil {
			return apierr.New(http.StatusInternalServerError, "Failed to save setting "+k+": "+err.Error())
		}
	}

	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to commit settings transaction: "+err.Error())
	}

	return c.JSON(http.StatusOK, echo.Map{"status": "success", "message": "Settings saved successfully"})
}

func (h *CyberAIHandler) CheckStatus(c echo.Context) error {
	apiURL := "http://cyber-ai-service:8000"
	_ = h.db.QueryRowContext(c.Request().Context(), "SELECT value FROM system_settings WHERE key = 'cyberai_api_url'").Scan(&apiURL)

	client := &http.Client{Timeout: 5 * time.Second}
	
	// Thử endpoint /health
	targetURL := fmt.Sprintf("%s/health", strings.TrimSuffix(apiURL, "/"))
	req, _ := http.NewRequestWithContext(c.Request().Context(), "GET", targetURL, nil)
	resp, err := client.Do(req)
	
	if err == nil {
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			return c.JSON(http.StatusOK, echo.Map{"status": "online", "provider": "cyberai"})
		}
	}

	// Thử root endpoint làm dự phòng
	targetURL = fmt.Sprintf("%s/", strings.TrimSuffix(apiURL, "/"))
	req, _ = http.NewRequestWithContext(c.Request().Context(), "GET", targetURL, nil)
	resp, err = client.Do(req)
	if err == nil {
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			return c.JSON(http.StatusOK, echo.Map{"status": "online", "provider": "cyberai"})
		}
	}

	return c.JSON(http.StatusOK, echo.Map{"status": "offline", "provider": "cyberai", "error": "Service is unreachable"})
}

// SanitizePromptInjection filters out potential indirect prompt injection vectors
// commonly found in raw logs or attacker-controlled fields.
func SanitizePromptInjection(input string) string {
	dangerousPatterns := []string{
		"ignore previous instructions",
		"ignore all previous",
		"system:",
		"developer mode",
		"ignore system prompt",
		"new instruction",
		"forget what you were told",
		"you must now",
		"override system",
		"as a developer",
		"bypass safety",
	}

	sanitized := input
	for _, pattern := range dangerousPatterns {
		lowerInput := strings.ToLower(sanitized)
		idx := strings.Index(lowerInput, pattern)
		for idx != -1 {
			origText := sanitized[idx : idx+len(pattern)]
			sanitized = strings.ReplaceAll(sanitized, origText, "[SECURE_BLOCK]")
			
			lowerInput = strings.ToLower(sanitized)
			idx = strings.Index(lowerInput, pattern)
		}
	}
	return sanitized
}
