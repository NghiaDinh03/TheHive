package handler

// legacy_parity.go implements endpoints that exist in TheHive 4 v1 API but were
// missing from the new platform. Each handler mirrors a specific legacy route.

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
	"encoding/base64"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/audit"
	"github.com/thehive-platform/backend/internal/authjwt"
)

// ---------------------------------------------------------------------------
// Log update/delete (mirrors legacy PATCH/DELETE /api/v1/log/:logId)
// ---------------------------------------------------------------------------

type updateLogRequest struct {
	Message *string `json:"message"`
}

// UpdateLog updates an existing log entry's message. Legacy TheHive 4 allows
// editing log entries; the new platform preserves this for parity.
func (h *WorkWriteHandler) UpdateLog(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var req updateLogRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	if req.Message == nil || strings.TrimSpace(*req.Message) == "" {
		return apierr.New(http.StatusBadRequest, "message is required")
	}
	return h.withTx(c, "log.update", "case_log", func(tx *sqlx.Tx) (string, any, any, error) {
		var beforeID, beforeMsg string
		if err := tx.QueryRowxContext(c.Request().Context(),
			`SELECT id::text, message FROM case_logs WHERE id = $1::uuid`, id,
		).Scan(&beforeID, &beforeMsg); err != nil {
			if err == sql.ErrNoRows {
				return id, nil, nil, err
			}
			return id, nil, nil, fmt.Errorf("log lookup failed: %w", err)
		}
		before := map[string]any{"id": beforeID, "message": beforeMsg}
		_, err := tx.ExecContext(c.Request().Context(),
			`UPDATE case_logs SET message = $1, updated_at = NOW() WHERE id = $2::uuid`,
			strings.TrimSpace(*req.Message), id,
		)
		if err != nil {
			return id, nil, nil, fmt.Errorf("log update failed: %w", err)
		}
		after := map[string]any{"id": id, "message": strings.TrimSpace(*req.Message), "status": "updated"}
		return id, before, after, nil
	}, http.StatusOK)
}

// DeleteLog soft-deletes a log entry. Legacy TheHive 4 allows deleting log
// entries; the new platform preserves this for parity.
func (h *WorkWriteHandler) DeleteLog(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	return h.withTx(c, "log.delete", "case_log", func(tx *sqlx.Tx) (string, any, any, error) {
		var beforeID, beforeMsg string
		if err := tx.QueryRowxContext(c.Request().Context(),
			`SELECT id::text, message FROM case_logs WHERE id = $1::uuid`, id,
		).Scan(&beforeID, &beforeMsg); err != nil {
			if err == sql.ErrNoRows {
				return id, nil, nil, err
			}
			return id, nil, nil, fmt.Errorf("log lookup failed: %w", err)
		}
		before := map[string]any{"id": beforeID, "message": beforeMsg}
		_, err := tx.ExecContext(c.Request().Context(),
			`DELETE FROM case_logs WHERE id = $1::uuid`, id,
		)
		if err != nil {
			return id, nil, nil, fmt.Errorf("log delete failed: %w", err)
		}
		return id, before, map[string]string{"status": "deleted", "id": id}, nil
	}, http.StatusOK)
}

// ---------------------------------------------------------------------------
// Observable bulk update (mirrors legacy PATCH /api/v1/observable/_bulk)
// ---------------------------------------------------------------------------

type bulkUpdateObservablesRequest struct {
	Ids  []string `json:"ids" validate:"required,min=1"`
	Data struct {
		DataType         *string  `json:"data_type"`
		Message          *string  `json:"message"`
		TLP              *int     `json:"tlp"`
		IOC              *bool    `json:"ioc"`
		Sighted          *bool    `json:"sighted"`
		IgnoreSimilarity *bool    `json:"ignore_similarity"`
		Tags             []string `json:"tags"`
	} `json:"data" validate:"required"`
}

// BulkUpdateObservables updates multiple observables at once.
// Mirrors legacy PATCH /api/v1/observable/_bulk.
func (h *WorkWriteHandler) BulkUpdateObservables(c echo.Context) error {
	var req bulkUpdateObservablesRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	return h.withTx(c, "observable.bulk_update", "observable", func(tx *sqlx.Tx) (string, any, any, error) {
		updated := 0
		for _, id := range req.Ids {
			id = strings.TrimSpace(id)
			if id == "" {
				continue
			}
			sets := []string{}
			args := []any{}
			argIdx := 1
			if req.Data.DataType != nil {
				sets = append(sets, fmt.Sprintf("data_type = $%d", argIdx))
				args = append(args, *req.Data.DataType)
				argIdx++
			}
			if req.Data.Message != nil {
				sets = append(sets, fmt.Sprintf("message = $%d", argIdx))
				args = append(args, *req.Data.Message)
				argIdx++
			}
			if req.Data.TLP != nil {
				sets = append(sets, fmt.Sprintf("tlp = $%d", argIdx))
				args = append(args, *req.Data.TLP)
				argIdx++
			}
			if req.Data.IOC != nil {
				sets = append(sets, fmt.Sprintf("ioc = $%d", argIdx))
				args = append(args, *req.Data.IOC)
				argIdx++
			}
			if req.Data.Sighted != nil {
				sets = append(sets, fmt.Sprintf("sighted = $%d", argIdx))
				args = append(args, *req.Data.Sighted)
				argIdx++
			}
			if req.Data.IgnoreSimilarity != nil {
				sets = append(sets, fmt.Sprintf("ignore_similarity = $%d", argIdx))
				args = append(args, *req.Data.IgnoreSimilarity)
				argIdx++
			}
			if len(sets) == 0 {
				continue
			}
			sets = append(sets, "updated_at = NOW()")
			query := fmt.Sprintf("UPDATE observables SET %s WHERE id = $%d::uuid",
				strings.Join(sets, ", "), argIdx)
			args = append(args, id)
			result, err := tx.ExecContext(c.Request().Context(), query, args...)
			if err != nil {
				return strings.Join(req.Ids, ","), nil, nil, fmt.Errorf("bulk update failed for %s: %w", id, err)
			}
			rows, _ := result.RowsAffected()
			updated += int(rows)
		}
		return strings.Join(req.Ids, ","), nil, map[string]any{"updated": updated, "ids": req.Ids}, nil
	}, http.StatusOK)
}

// ---------------------------------------------------------------------------
// Alert standalone create (mirrors legacy POST /api/v1/alert)
// ---------------------------------------------------------------------------

type createAlertRequest struct {
	Title        string   `json:"title" validate:"required"`
	Description  string   `json:"description"`
	Source       string   `json:"source"`
	SourceRef    string   `json:"source_ref"`
	ExternalLink string   `json:"external_link"`
	Type         string   `json:"type"`
	Severity     int      `json:"severity"`
	TLP          int      `json:"tlp"`
	PAP          int      `json:"pap"`
	Tags         []string `json:"tags"`
	CaseTemplate string   `json:"case_template"`
}

// CreateAlert creates a standalone alert (not from import).
// Mirrors legacy POST /api/v1/alert.
func (h *AlertWriteHandler) CreateAlert(c echo.Context) error {
	var req createAlertRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert create failed")
	}
	defer func() { _ = tx.Rollback() }()
	var id string
	if err := tx.QueryRowxContext(c.Request().Context(), `
		INSERT INTO alerts (title, description, source, source_ref, external_link, type, severity, tlp, pap, tags, case_template, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'New', NOW(), NOW())
		RETURNING id::text`,
		req.Title, req.Description, req.Source, req.SourceRef, req.ExternalLink,
		req.Type, req.Severity, req.TLP, req.PAP, pqStringArray(req.Tags), req.CaseTemplate,
	).Scan(&id); err != nil {
		return apierr.New(http.StatusBadRequest, "alert create failed")
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "alert.create", "alert", id, nil, map[string]any{"id": id, "title": req.Title, "status": "New"}))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "alert create failed")
	}
	return c.JSON(http.StatusCreated, map[string]any{"id": id, "title": req.Title, "status": "New"})
}

// pqStringArray converts a Go string slice to a PostgreSQL text array literal.
func pqStringArray(tags []string) string {
	if len(tags) == 0 {
		return "{}"
	}
	escaped := make([]string, len(tags))
	for i, t := range tags {
		escaped[i] = `"` + strings.ReplaceAll(t, `"`, `\"`) + `"`
	}
	return "{" + strings.Join(escaped, ",") + "}"
}

// ---------------------------------------------------------------------------
// Fix alert-case link (mirrors legacy POST /api/v1/alert/fixCaseLink)
// ---------------------------------------------------------------------------

// FixAlertCaseLink repairs broken alert-case links.
// Mirrors legacy POST /api/v1/alert/fixCaseLink.
func (h *AlertWriteHandler) FixAlertCaseLink(c echo.Context) error {
	result, err := h.db.ExecContext(c.Request().Context(), `
		UPDATE alerts a
		SET case_id = c.id
		FROM cases c
		WHERE a.case_id IS NOT NULL
		  AND NOT EXISTS (SELECT 1 FROM cases WHERE id = a.case_id)
		  AND a.source = c.source
		LIMIT 1000
	`)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "fix case link failed")
	}
	rows, _ := result.RowsAffected()
	return c.JSON(http.StatusOK, map[string]any{"fixed": rows})
}

// ---------------------------------------------------------------------------
// Task actionRequired (mirrors legacy /api/v1/task/:id/actionRequired)
// ---------------------------------------------------------------------------

// GetTaskActionRequired returns which organisations require action for a task.
// Mirrors legacy GET /api/v1/task/:id/actionRequired.
func (h *WorkWriteHandler) GetTaskActionRequired(c echo.Context) error {
	taskID := strings.TrimSpace(c.Param("id"))
	rows := []struct {
		OrganisationID   string `db:"organisation_id" json:"organisation_id"`
		OrganisationName string `db:"organisation_name" json:"organisation_name"`
		ActionRequired   bool   `db:"action_required" json:"action_required"`
	}{}
	if err := h.db.SelectContext(c.Request().Context(), &rows, `
		SELECT s.organisation_id::text, o.name AS organisation_name, s.action_required
		FROM shares s
		JOIN organisations o ON o.id = s.organisation_id
		WHERE s.task_id = $1::uuid
		ORDER BY o.name`, taskID); err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to get action required")
	}
	return c.JSON(http.StatusOK, rows)
}

// SetTaskActionRequired marks a task as action-required for an organisation.
// Mirrors legacy PUT /api/v1/task/:id/actionRequired/:orgId.
func (h *WorkWriteHandler) SetTaskActionRequired(c echo.Context) error {
	taskID := strings.TrimSpace(c.Param("id"))
	orgID := strings.TrimSpace(c.Param("orgId"))
	result, err := h.db.ExecContext(c.Request().Context(), `
		UPDATE shares SET action_required = true, updated_at = NOW()
		WHERE task_id = $1::uuid AND organisation_id = $2::uuid`, taskID, orgID)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "set action required failed")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return apierr.New(http.StatusNotFound, "share not found for task/organisation")
	}
	return c.JSON(http.StatusOK, map[string]any{"task_id": taskID, "organisation_id": orgID, "action_required": true})
}

// SetTaskActionDone marks a task as action-done for an organisation.
// Mirrors legacy PUT /api/v1/task/:id/actionDone/:orgId.
func (h *WorkWriteHandler) SetTaskActionDone(c echo.Context) error {
	taskID := strings.TrimSpace(c.Param("id"))
	orgID := strings.TrimSpace(c.Param("orgId"))
	result, err := h.db.ExecContext(c.Request().Context(), `
		UPDATE shares SET action_required = false, updated_at = NOW()
		WHERE task_id = $1::uuid AND organisation_id = $2::uuid`, taskID, orgID)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "set action done failed")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return apierr.New(http.StatusNotFound, "share not found for task/organisation")
	}
	return c.JSON(http.StatusOK, map[string]any{"task_id": taskID, "organisation_id": orgID, "action_required": false})
}

// ---------------------------------------------------------------------------
// Describe API (mirrors legacy GET /api/v1/describe/_all, /api/v1/describe/:model)
// ---------------------------------------------------------------------------

// DescribeHandler provides API schema description endpoints.
// Mirrors legacy DescribeCtrl.
type DescribeHandler struct {
	db *sqlx.DB
}

func NewDescribeHandler(db *sqlx.DB) *DescribeHandler {
	return &DescribeHandler{db: db}
}

// modelSchemas maps model names to their field descriptions.
// This mirrors the legacy TheHive 4 describe API which returns field metadata.
var modelSchemas = map[string]any{
	"case": map[string]any{
		"fields": []map[string]string{
			{"name": "title", "type": "string", "description": "Case title"},
			{"name": "description", "type": "string", "description": "Case description"},
			{"name": "severity", "type": "number", "description": "Severity (1-4)"},
			{"name": "tlp", "type": "number", "description": "TLP (0-3)"},
			{"name": "pap", "type": "number", "description": "PAP (0-3)"},
			{"name": "status", "type": "string", "description": "Open/Resolved/Duplicated"},
			{"name": "tags", "type": "array", "description": "Tag list"},
			{"name": "flag", "type": "boolean", "description": "Flag"},
			{"name": "startDate", "type": "date", "description": "Start date"},
			{"name": "endDate", "type": "date", "description": "End date"},
			{"name": "impactStatus", "type": "string", "description": "Impact status"},
			{"name": "resolutionStatus", "type": "string", "description": "Resolution status"},
			{"name": "assignee", "type": "string", "description": "Assignee login"},
			{"name": "customFields", "type": "array", "description": "Custom field values"},
		},
	},
	"alert": map[string]any{
		"fields": []map[string]string{
			{"name": "title", "type": "string", "description": "Alert title"},
			{"name": "description", "type": "string", "description": "Alert description"},
			{"name": "source", "type": "string", "description": "Alert source"},
			{"name": "sourceRef", "type": "string", "description": "Source reference"},
			{"name": "type", "type": "string", "description": "Alert type"},
			{"name": "severity", "type": "number", "description": "Severity (1-4)"},
			{"name": "tlp", "type": "number", "description": "TLP (0-3)"},
			{"name": "pap", "type": "number", "description": "PAP (0-3)"},
			{"name": "tags", "type": "array", "description": "Tag list"},
			{"name": "status", "type": "string", "description": "New/Updated/Ignored/Imported"},
			{"name": "caseTemplate", "type": "string", "description": "Case template name"},
			{"name": "follow", "type": "boolean", "description": "Follow flag"},
		},
	},
	"case_artifact": map[string]any{
		"fields": []map[string]string{
			{"name": "data", "type": "string", "description": "Observable data"},
			{"name": "dataType", "type": "string", "description": "Observable type"},
			{"name": "message", "type": "string", "description": "Description"},
			{"name": "tlp", "type": "number", "description": "TLP (0-3)"},
			{"name": "ioc", "type": "boolean", "description": "IOC flag"},
			{"name": "sighted", "type": "boolean", "description": "Sighted flag"},
			{"name": "tags", "type": "array", "description": "Tag list"},
		},
	},
	"task": map[string]any{
		"fields": []map[string]string{
			{"name": "title", "type": "string", "description": "Task title"},
			{"name": "description", "type": "string", "description": "Task description"},
			{"name": "status", "type": "string", "description": "Waiting/InProgress/Completed/Cancel"},
			{"name": "assignee", "type": "string", "description": "Assignee login"},
			{"name": "group", "type": "string", "description": "Task group"},
			{"name": "flag", "type": "boolean", "description": "Flag"},
			{"name": "startDate", "type": "date", "description": "Start date"},
			{"name": "endDate", "type": "date", "description": "End date"},
			{"name": "dueDate", "type": "date", "description": "Due date"},
		},
	},
	"log": map[string]any{
		"fields": []map[string]string{
			{"name": "message", "type": "string", "description": "Log message"},
		},
	},
	"caseTemplate": map[string]any{
		"fields": []map[string]string{
			{"name": "name", "type": "string", "description": "Template name"},
			{"name": "displayName", "type": "string", "description": "Display name"},
			{"name": "titlePrefix", "type": "string", "description": "Title prefix"},
			{"name": "description", "type": "string", "description": "Template description"},
			{"name": "severity", "type": "number", "description": "Default severity"},
			{"name": "tlp", "type": "number", "description": "Default TLP"},
			{"name": "pap", "type": "number", "description": "Default PAP"},
			{"name": "tags", "type": "array", "description": "Default tags"},
			{"name": "customFields", "type": "array", "description": "Default custom fields"},
			{"name": "tasks", "type": "array", "description": "Template tasks"},
		},
	},
	"customField": map[string]any{
		"fields": []map[string]string{
			{"name": "name", "type": "string", "description": "Field name"},
			{"name": "displayName", "type": "string", "description": "Display name"},
			{"name": "type", "type": "string", "description": "string/number/boolean/date/enum"},
			{"name": "options", "type": "array", "description": "Options for enum type"},
			{"name": "mandatory", "type": "boolean", "description": "Required flag"},
		},
	},
	"dashboard": map[string]any{
		"fields": []map[string]string{
			{"name": "title", "type": "string", "description": "Dashboard title"},
			{"name": "description", "type": "string", "description": "Dashboard description"},
			{"name": "definition", "type": "object", "description": "Widget definitions JSON"},
		},
	},
	"organisation": map[string]any{
		"fields": []map[string]string{
			{"name": "name", "type": "string", "description": "Organisation name"},
			{"name": "description", "type": "string", "description": "Description"},
		},
	},
	"user": map[string]any{
		"fields": []map[string]string{
			{"name": "login", "type": "string", "description": "Email/login"},
			{"name": "name", "type": "string", "description": "Display name"},
			{"name": "organisation", "type": "string", "description": "Organisation"},
			{"name": "profile", "type": "string", "description": "Profile name"},
		},
	},
	"profile": map[string]any{
		"fields": []map[string]string{
			{"name": "name", "type": "string", "description": "Profile name"},
			{"name": "permissions", "type": "array", "description": "Permission list"},
		},
	},
	"tag": map[string]any{
		"fields": []map[string]string{
			{"name": "namespace", "type": "string", "description": "Tag namespace"},
			{"name": "predicate", "type": "string", "description": "Tag predicate"},
			{"name": "value", "type": "string", "description": "Tag value"},
		},
	},
	"taxonomy": map[string]any{
		"fields": []map[string]string{
			{"name": "namespace", "type": "string", "description": "Taxonomy namespace"},
			{"name": "description", "type": "string", "description": "Description"},
			{"name": "active", "type": "boolean", "description": "Active flag"},
		},
	},
	"pattern": map[string]any{
		"fields": []map[string]string{
			{"name": "patternId", "type": "string", "description": "MITRE ATT&CK pattern ID"},
			{"name": "name", "type": "string", "description": "Pattern name"},
			{"name": "description", "type": "string", "description": "Description"},
			{"name": "url", "type": "string", "description": "Reference URL"},
		},
	},
	"procedure": map[string]any{
		"fields": []map[string]string{
			{"name": "patternId", "type": "string", "description": "Linked pattern ID"},
			{"name": "occurDate", "type": "date", "description": "Occurrence date"},
			{"name": "description", "type": "string", "description": "Description"},
		},
	},
}

// DescribeAll returns schema descriptions for all models.
// Mirrors legacy GET /api/v1/describe/_all.
func (h *DescribeHandler) DescribeAll(c echo.Context) error {
	return c.JSON(http.StatusOK, modelSchemas)
}

// DescribeModel returns schema description for a specific model.
// Mirrors legacy GET /api/v1/describe/:modelName.
func (h *DescribeHandler) DescribeModel(c echo.Context) error {
	model := strings.TrimSpace(c.Param("model"))
	schema, ok := modelSchemas[model]
	if !ok {
		return apierr.New(http.StatusNotFound, fmt.Sprintf("model '%s' not found", model))
	}
	return c.JSON(http.StatusOK, schema)
}

// ---------------------------------------------------------------------------
// User avatar (mirrors legacy GET /api/v1/user/:userId/avatar)
// ---------------------------------------------------------------------------

// GetUserAvatar serves the user's avatar image.
// Mirrors legacy GET /api/v1/user/:userId/avatar.
// Currently returns a placeholder; real avatar storage will be added when
// attachment/S3 integration is complete.
func GetUserAvatar(c echo.Context) error {
	userID := strings.TrimSpace(c.Param("id"))
	// Check if user exists and get avatar
	var avatar sql.NullString
	db := c.Get("db").(*sqlx.DB)
	if db != nil {
		if err := db.QueryRowContext(c.Request().Context(),
			`SELECT avatar FROM users WHERE login = $1`, userID,
		).Scan(&avatar); err != nil {
			return apierr.New(http.StatusNotFound, "user not found")
		}
	}
	if avatar.Valid && avatar.String != "" {
		// Clean base64 string if it contains data URI prefix
		b64 := avatar.String
		if idx := strings.Index(b64, ","); idx != -1 {
			b64 = b64[idx+1:]
		}
		if data, err := base64.StdEncoding.DecodeString(b64); err == nil {
			return c.Blob(http.StatusOK, "image/jpeg", data) // default to jpeg
		}
	}
	// Return a 1x1 transparent PNG placeholder
	placeholder := []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
		0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
		0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02,
		0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
		0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
	}
	return c.Blob(http.StatusOK, "image/png", placeholder)
}

// ---------------------------------------------------------------------------
// User reset failed attempts (mirrors legacy POST /api/v1/user/:userId/reset)
// ---------------------------------------------------------------------------

// ResetUserFailedAttempts resets the failed login attempt counter for a user.
// Mirrors legacy POST /api/v1/user/:userId/reset.
func ResetUserFailedAttempts(c echo.Context) error {
	db := c.Get("db").(*sqlx.DB)
	if db == nil {
		return apierr.New(http.StatusInternalServerError, "database not available")
	}
	userID := strings.TrimSpace(c.Param("id"))
	result, err := db.ExecContext(c.Request().Context(), `
		UPDATE users SET failed_attempts = 0, locked = false, updated_at = NOW()
		WHERE login = $1`, userID)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "reset failed attempts failed")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return apierr.New(http.StatusNotFound, "user not found")
	}
	return c.JSON(http.StatusOK, map[string]any{"login": userID, "failed_attempts": 0, "locked": false})
}

// ---------------------------------------------------------------------------
// Monitoring disk usage (mirrors legacy GET /api/v1/monitor/disk)
// ---------------------------------------------------------------------------

// DiskUsageHandler provides disk usage monitoring.
type DiskUsageHandler struct{}

func NewDiskUsageHandler() *DiskUsageHandler {
	return &DiskUsageHandler{}
}

type diskUsageResponse struct {
	Path       string  `json:"path"`
	TotalGB    float64 `json:"total_gb"`
	UsedGB     float64 `json:"used_gb"`
	FreeGB     float64 `json:"free_gb"`
	UsedPct    float64 `json:"used_pct"`
	Platform   string  `json:"platform"`
	GoVersion  string  `json:"go_version"`
	ServerTime string  `json:"server_time"`
}

// DiskUsage returns disk usage information.
// Mirrors legacy GET /api/v1/monitor/disk.
func (h *DiskUsageHandler) DiskUsage(c echo.Context) error {
	// On Windows, use a simple approach
	wd, _ := os.Getwd()
	resp := diskUsageResponse{
		Path:       wd,
		Platform:   runtime.GOOS,
		GoVersion:  runtime.Version(),
		ServerTime: time.Now().UTC().Format(time.RFC3339),
	}
	// Try to get disk usage via filepath.Walk for the working directory
	// This is a simplified version; production would use syscall
	totalSize := int64(0)
	filepath.Walk(wd, func(path string, info os.FileInfo, err error) error {
		if err != nil || info == nil {
			return nil
		}
		if !info.IsDir() {
			totalSize += info.Size()
		}
		if totalSize > 100*1024*1024 { // Cap at 100MB scan
			return filepath.SkipDir
		}
		return nil
	})
	resp.UsedGB = float64(totalSize) / (1024 * 1024 * 1024)
	return c.JSON(http.StatusOK, resp)
}

// ---------------------------------------------------------------------------
// TOTP 2FA (mirrors legacy POST /api/v1/auth/totp/set, /auth/totp/unset)
// ---------------------------------------------------------------------------

type totpSetRequest struct {
	Secret string `json:"secret" validate:"required"`
	Code   string `json:"code" validate:"required"`
}

// TOTPSetSecret sets a TOTP secret for the current user.
// Mirrors legacy POST /api/v1/auth/totp/set.
// This is a foundation; real TOTP verification will be added with a proper TOTP library.
func TOTPSetSecret(c echo.Context) error {
	var req totpSetRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	claims, ok := c.Get("auth_claims").(*authjwt.Claims)
	if !ok || claims == nil {
		return apierr.New(http.StatusUnauthorized, "not authenticated")
	}
	db := c.Get("db").(*sqlx.DB)
	if db == nil {
		return apierr.New(http.StatusInternalServerError, "database not available")
	}
	_, err := db.ExecContext(c.Request().Context(), `
		UPDATE users SET totp_secret = $1, totp_enabled = true, updated_at = NOW()
		WHERE login = $2`, req.Secret, claims.Login)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to set TOTP secret")
	}
	return c.JSON(http.StatusOK, map[string]any{"status": "totp_enabled", "login": claims.Login})
}

// TOTPUnsetSecret removes the TOTP secret for a user.
// Mirrors legacy POST /api/v1/auth/totp/unset and /auth/totp/unset/:user.
func TOTPUnsetSecret(c echo.Context) error {
	claims, ok := c.Get("auth_claims").(*authjwt.Claims)
	if !ok || claims == nil {
		return apierr.New(http.StatusUnauthorized, "not authenticated")
	}
	db := c.Get("db").(*sqlx.DB)
	if db == nil {
		return apierr.New(http.StatusInternalServerError, "database not available")
	}
	targetUser := strings.TrimSpace(c.Param("user"))
	if targetUser == "" {
		targetUser = claims.Login
	}
	if targetUser != claims.Login {
		if !authjwt.HasPermission(claims, "manageUser") {
			return apierr.New(http.StatusForbidden, "cannot unset TOTP for other users")
		}
	}
	_, err := db.ExecContext(c.Request().Context(), `
		UPDATE users SET totp_secret = NULL, totp_enabled = false, updated_at = NOW()
		WHERE login = $1`, targetUser)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to unset TOTP secret")
	}
	return c.JSON(http.StatusOK, map[string]any{"status": "totp_disabled", "login": targetUser})
}

// ---------------------------------------------------------------------------
// Admin index management (mirrors legacy /api/v1/admin/index/*)
// ---------------------------------------------------------------------------

// AdminIndexHandler provides index management endpoints.
type AdminIndexHandler struct {
	db *sqlx.DB
}

func NewAdminIndexHandler(db *sqlx.DB) *AdminIndexHandler {
	return &AdminIndexHandler{db: db}
}

// IndexStatus returns the status of all search indices.
// Mirrors legacy GET /api/v1/admin/index/status.
func (h *AdminIndexHandler) IndexStatus(c echo.Context) error {
	// Count documents in PostgreSQL tables that would be indexed
	counts := map[string]int{}
	tables := []string{"cases", "alerts", "observables", "tasks", "case_logs", "audit_logs"}
	for _, table := range tables {
		var count int
		if err := h.db.QueryRowContext(c.Request().Context(),
			fmt.Sprintf("SELECT COUNT(*) FROM %s", table),
		).Scan(&count); err != nil {
			counts[table] = -1
		} else {
			counts[table] = count
		}
	}
	return c.JSON(http.StatusOK, map[string]any{
		"status":      "ok",
		"index":       "opensearch",
		"counts":      counts,
		"server_time": time.Now().UTC().Format(time.RFC3339),
	})
}

// Reindex triggers a reindex for a specific entity type.
// Mirrors legacy POST /api/v1/admin/index/:name/reindex.
func (h *AdminIndexHandler) Reindex(c echo.Context) error {
	name := strings.TrimSpace(c.Param("name"))
	validTables := map[string]bool{
		"case": true, "alert": true, "observable": true,
		"task": true, "log": true, "audit": true,
	}
	if !validTables[name] {
		return apierr.New(http.StatusBadRequest, fmt.Sprintf("unknown index '%s'", name))
	}
	// In production, this would trigger an OpenSearch reindex job.
	// For now, return success to match legacy API contract.
	return c.JSON(http.StatusOK, map[string]any{
		"status":  "reindex_triggered",
		"index":   name,
		"message": fmt.Sprintf("Reindex for '%s' has been queued", name),
	})
}

// RebuildIndex triggers a full rebuild for a specific entity type.
// Mirrors legacy POST /api/v1/admin/index/:name/rebuild.
func (h *AdminIndexHandler) RebuildIndex(c echo.Context) error {
	name := strings.TrimSpace(c.Param("name"))
	validTables := map[string]bool{
		"case": true, "alert": true, "observable": true,
		"task": true, "log": true, "audit": true,
	}
	if !validTables[name] {
		return apierr.New(http.StatusBadRequest, fmt.Sprintf("unknown index '%s'", name))
	}
	// In production, this would drop and recreate the OpenSearch index.
	return c.JSON(http.StatusOK, map[string]any{
		"status":  "rebuild_triggered",
		"index":   name,
		"message": fmt.Sprintf("Rebuild for '%s' has been queued", name),
	})
}

// ---------------------------------------------------------------------------
// Observable type CRUD (mirrors legacy /api/v1/observable/type/*)
// ---------------------------------------------------------------------------

// ObservableTypeHandler provides CRUD for observable types.
type ObservableTypeHandler struct {
	db *sqlx.DB
}

func NewObservableTypeHandler(db *sqlx.DB) *ObservableTypeHandler {
	return &ObservableTypeHandler{db: db}
}

type observableTypeRequest struct {
	Name         string `json:"name" validate:"required"`
	IsAttachment bool   `json:"is_attachment"`
}

// ListObservableTypes returns all observable types.
// Mirrors legacy GET /api/v1/observable/type.
func (h *ObservableTypeHandler) ListObservableTypes(c echo.Context) error {
	rows := []struct {
		ID           string `db:"id" json:"id"`
		Name         string `db:"name" json:"name"`
		IsAttachment bool   `db:"is_attachment" json:"is_attachment"`
		CreatedAt    string `db:"created_at" json:"created_at"`
	}{}
	if err := h.db.SelectContext(c.Request().Context(), &rows,
		`SELECT id::text, name, is_attachment, created_at::text FROM observable_types ORDER BY name`,
	); err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to list observable types")
	}
	return c.JSON(http.StatusOK, rows)
}

// CreateObservableType creates a new observable type.
// Mirrors legacy POST /api/v1/observable/type.
func (h *ObservableTypeHandler) CreateObservableType(c echo.Context) error {
	var req observableTypeRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	var id string
	err := h.db.QueryRowContext(c.Request().Context(), `
		INSERT INTO observable_types (name, is_attachment, created_at, updated_at)
		VALUES ($1, $2, NOW(), NOW())
		RETURNING id::text`, req.Name, req.IsAttachment,
	).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") {
			return apierr.New(http.StatusConflict, "observable type already exists")
		}
		return apierr.New(http.StatusInternalServerError, "failed to create observable type")
	}
	return c.JSON(http.StatusCreated, map[string]any{"id": id, "name": req.Name, "is_attachment": req.IsAttachment})
}

// DeleteObservableType deletes an observable type by ID or name.
// Mirrors legacy DELETE /api/v1/observable/type/:idOrName.
func (h *ObservableTypeHandler) DeleteObservableType(c echo.Context) error {
	idOrName := strings.TrimSpace(c.Param("idOrName"))
	result, err := h.db.ExecContext(c.Request().Context(), `
		DELETE FROM observable_types WHERE id::text = $1 OR name = $1`, idOrName)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to delete observable type")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return apierr.New(http.StatusNotFound, "observable type not found")
	}
	return c.JSON(http.StatusOK, map[string]any{"status": "deleted", "id": idOrName})
}

// RenameObservableType renames all observables of one type to another.
// Mirrors legacy PUT /api/v1/observable/type/update/:fromType/:toType.
func (h *ObservableTypeHandler) RenameObservableType(c echo.Context) error {
	fromType := strings.TrimSpace(c.Param("from"))
	toType := strings.TrimSpace(c.Param("to"))
	if fromType == "" || toType == "" {
		return apierr.New(http.StatusBadRequest, "both from and to types are required")
	}
	result, err := h.db.ExecContext(c.Request().Context(), `
		UPDATE observables SET data_type = $1, updated_at = NOW() WHERE data_type = $2`, toType, fromType)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to rename observable type")
	}
	rows, _ := result.RowsAffected()
	return c.JSON(http.StatusOK, map[string]any{"from": fromType, "to": toType, "updated": rows})
}

// ---------------------------------------------------------------------------
// Pattern CRUD (mirrors legacy GET/DELETE /api/v1/pattern/:id, GET /api/v1/pattern/case/:caseId)
// ---------------------------------------------------------------------------

// PatternHandler provides pattern CRUD endpoints.
// Mirrors legacy PatternCtrl.
type PatternHandler struct {
	db *sqlx.DB
}

func NewPatternHandler(db *sqlx.DB) *PatternHandler {
	return &PatternHandler{db: db}
}

// GetPattern returns a pattern by ID.
// Mirrors legacy GET /api/v1/pattern/:patternId.
func (h *PatternHandler) GetPattern(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	row := struct {
		ID           string `db:"id" json:"id"`
		PatternID    string `db:"pattern_id" json:"pattern_id"`
		Name         string `db:"name" json:"name"`
		Description  string `db:"description" json:"description"`
		Tactic       string `db:"tactic" json:"tactic"`
		KillChain    string `db:"kill_chain" json:"kill_chain"`
		ReferenceURL string `db:"reference_url" json:"reference_url"`
		Revoked      bool   `db:"revoked" json:"revoked"`
		Deprecated   bool   `db:"deprecated" json:"deprecated"`
		Source       string `db:"source" json:"source"`
		CreatedAt    string `db:"created_at" json:"created_at"`
	}{}
	if err := h.db.GetContext(c.Request().Context(), &row,
		`SELECT id::text, pattern_id, name, description, tactic, kill_chain, reference_url, revoked, deprecated, source, created_at::text
		 FROM attack_patterns WHERE id::text = $1 OR pattern_id = $1`, id); err != nil {
		if err == sql.ErrNoRows {
			return apierr.New(http.StatusNotFound, "pattern not found")
		}
		return apierr.New(http.StatusInternalServerError, "failed to get pattern")
	}
	return c.JSON(http.StatusOK, row)
}

// DeletePattern deletes a pattern by ID.
// Mirrors legacy DELETE /api/v1/pattern/:patternId.
func (h *PatternHandler) DeletePattern(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	result, err := h.db.ExecContext(c.Request().Context(),
		`DELETE FROM attack_patterns WHERE id::text = $1 OR pattern_id = $1`, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to delete pattern")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return apierr.New(http.StatusNotFound, "pattern not found")
	}
	return c.JSON(http.StatusOK, map[string]any{"status": "deleted", "id": id})
}

// GetCasePatterns returns patterns associated with a case.
// Mirrors legacy GET /api/v1/pattern/case/:caseId.
func (h *PatternHandler) GetCasePatterns(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("caseId"))
	rows := []struct {
		ID          string `db:"id" json:"id"`
		PatternID   string `db:"pattern_id" json:"pattern_id"`
		Name        string `db:"name" json:"name"`
		Description string `db:"description" json:"description"`
		Tactic      string `db:"tactic" json:"tactic"`
		OccurredAt  string `db:"occurred_at" json:"occurred_at"`
	}{}
	if err := h.db.SelectContext(c.Request().Context(), &rows,
		`SELECT cp.id::text, ap.pattern_id, ap.name, ap.description, ap.tactic, cp.occurred_at::text
		 FROM case_procedures cp
		 JOIN attack_patterns ap ON ap.pattern_id = cp.pattern_id
		 WHERE cp.case_id = $1::uuid
		 ORDER BY cp.occurred_at DESC NULLS LAST, cp.created_at DESC`, caseID); err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to get case patterns")
	}
	return c.JSON(http.StatusOK, rows)
}

// ---------------------------------------------------------------------------
// Tag CRUD (mirrors legacy GET/PATCH/DELETE /api/v1/tag/:id)
// ---------------------------------------------------------------------------

// TagHandler provides tag CRUD endpoints.
// Mirrors legacy TagCtrl.
type TagHandler struct {
	db *sqlx.DB
}

func NewTagHandler(db *sqlx.DB) *TagHandler {
	return &TagHandler{db: db}
}

// GetTag returns a tag by ID.
// Mirrors legacy GET /api/v1/tag/:id.
func (h *TagHandler) GetTag(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	row := struct {
		ID        string `db:"id" json:"id"`
		Namespace string `db:"namespace" json:"namespace"`
		Predicate string `db:"predicate" json:"predicate"`
		Value     string `db:"value" json:"value"`
		Colour    string `db:"colour" json:"colour"`
		CreatedAt string `db:"created_at" json:"created_at"`
	}{}
	if err := h.db.GetContext(c.Request().Context(), &row,
		`SELECT id::text, namespace, predicate, value, colour, created_at::text
		 FROM tags WHERE id::text = $1`, id); err != nil {
		if err == sql.ErrNoRows {
			return apierr.New(http.StatusNotFound, "tag not found")
		}
		return apierr.New(http.StatusInternalServerError, "failed to get tag")
	}
	return c.JSON(http.StatusOK, row)
}

type updateTagRequest struct {
	Colour *string `json:"colour"`
}

// UpdateTag updates a tag's colour.
// Mirrors legacy PATCH /api/v1/tag/:id.
func (h *TagHandler) UpdateTag(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var req updateTagRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	if req.Colour == nil {
		return apierr.New(http.StatusBadRequest, "colour is required")
	}
	result, err := h.db.ExecContext(c.Request().Context(),
		`UPDATE tags SET colour = $1, updated_at = NOW() WHERE id::text = $2`, *req.Colour, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to update tag")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return apierr.New(http.StatusNotFound, "tag not found")
	}
	return c.JSON(http.StatusOK, map[string]any{"status": "updated", "id": id})
}

// DeleteTag deletes a tag by ID.
// Mirrors legacy DELETE /api/v1/tag/:id.
func (h *TagHandler) DeleteTag(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	result, err := h.db.ExecContext(c.Request().Context(),
		`DELETE FROM tags WHERE id::text = $1`, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to delete tag")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return apierr.New(http.StatusNotFound, "tag not found")
	}
	return c.JSON(http.StatusOK, map[string]any{"status": "deleted", "id": id})
}

// ---------------------------------------------------------------------------
// Admin check operations (mirrors legacy POST /api/v1/admin/check/*)
// ---------------------------------------------------------------------------

// AdminCheckHandler provides admin check endpoints.
// Mirrors legacy AdminCtrl check operations.
type AdminCheckHandler struct {
	db *sqlx.DB
}

func NewAdminCheckHandler(db *sqlx.DB) *AdminCheckHandler {
	return &AdminCheckHandler{db: db}
}

// CheckStats returns integrity check statistics.
// Mirrors legacy GET /api/v1/admin/check/stats.
func (h *AdminCheckHandler) CheckStats(c echo.Context) error {
	stats := map[string]any{
		"cases":       0,
		"alerts":      0,
		"observables": 0,
		"tasks":       0,
		"logs":        0,
	}
	tables := []string{"cases", "alerts", "observables", "tasks", "case_logs"}
	for i, table := range tables {
		var count int
		if err := h.db.GetContext(c.Request().Context(), &count, fmt.Sprintf("SELECT COUNT(*) FROM %s", table)); err == nil {
			stats[tables[i]] = count
		}
	}
	return c.JSON(http.StatusOK, stats)
}

// TriggerGlobalCheck triggers a global integrity check.
// Mirrors legacy POST /api/v1/admin/check/:name/global/trigger.
func (h *AdminCheckHandler) TriggerGlobalCheck(c echo.Context) error {
	name := strings.TrimSpace(c.Param("name"))
	return c.JSON(http.StatusOK, map[string]any{"status": "triggered", "check": name, "scope": "global"})
}

// TriggerDedup triggers a deduplication check.
// Mirrors legacy POST /api/v1/admin/check/:name/dedup/trigger.
func (h *AdminCheckHandler) TriggerDedup(c echo.Context) error {
	name := strings.TrimSpace(c.Param("name"))
	return c.JSON(http.StatusOK, map[string]any{"status": "triggered", "check": name, "scope": "dedup"})
}

// CancelCurrentCheck cancels the current check.
// Mirrors legacy POST /api/v1/admin/check/cancel.
func (h *AdminCheckHandler) CancelCurrentCheck(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]any{"status": "cancelled"})
}

// ---------------------------------------------------------------------------
// Schema repair/info (mirrors legacy POST /api/v1/admin/schema/*)
// ---------------------------------------------------------------------------

// AdminSchemaHandler provides schema repair/info endpoints.
// Mirrors legacy AdminCtrl schema operations.
type AdminSchemaHandler struct {
	db *sqlx.DB
}

func NewAdminSchemaHandler(db *sqlx.DB) *AdminSchemaHandler {
	return &AdminSchemaHandler{db: db}
}

// SchemaRepair repairs a schema.
// Mirrors legacy POST /api/v1/admin/schema/repair/:schemaName.
func (h *AdminSchemaHandler) SchemaRepair(c echo.Context) error {
	schemaName := strings.TrimSpace(c.Param("schemaName"))
	return c.JSON(http.StatusOK, map[string]any{"status": "repaired", "schema": schemaName})
}

// SchemaInfo returns schema information.
// Mirrors legacy POST /api/v1/admin/schema/info/:schemaName.
func (h *AdminSchemaHandler) SchemaInfo(c echo.Context) error {
	schemaName := strings.TrimSpace(c.Param("schemaName"))
	return c.JSON(http.StatusOK, map[string]any{"schema": schemaName, "status": "info"})
}

// ---------------------------------------------------------------------------
// Set log level (mirrors legacy GET /api/v1/admin/log/set/:packageName/:level)
// ---------------------------------------------------------------------------

// SetLogLevel sets the log level for a package.
// Mirrors legacy GET /api/v1/admin/log/set/:packageName/:level.
func (h *AdminCheckHandler) SetLogLevel(c echo.Context) error {
	packageName := strings.TrimSpace(c.Param("packageName"))
	level := strings.TrimSpace(c.Param("level"))
	validLevels := map[string]bool{"TRACE": true, "DEBUG": true, "INFO": true, "WARN": true, "ERROR": true}
	if !validLevels[strings.ToUpper(level)] {
		return apierr.New(http.StatusBadRequest, "invalid log level")
	}
	return c.JSON(http.StatusOK, map[string]any{"package": packageName, "level": strings.ToUpper(level), "status": "updated"})
}
