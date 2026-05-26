package handler

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
)

type SOARHandler struct {
	db *sqlx.DB
}

func NewSOARHandler(db *sqlx.DB) *SOARHandler {
	return &SOARHandler{db: db}
}

type PlaybookStatusRequest struct {
	PlaybookName   string `json:"playbook_name"`
	StepName       string `json:"step_name"`
	StepStatus     string `json:"step_status"`      // "pending", "running", "completed", "failed"
	StepMessage    string `json:"step_message"`     // optional detail msg
	StepPosition   int    `json:"step_position"`    // order index for steps
	PlaybookStatus string `json:"playbook_status"` // optional overall status: "running", "completed", "failed"
}

type PlaybookStepResponse struct {
	ID            string    `db:"id" json:"id"`
	PlaybookRunID string    `db:"playbook_run_id" json:"playbook_run_id"`
	Name          string    `db:"name" json:"name"`
	Status        string    `db:"status" json:"status"`
	Message       string    `db:"message" json:"message"`
	Position      int       `db:"position" json:"position"`
	UpdatedAt     time.Time `db:"updated_at" json:"updated_at"`
}

type PlaybookRunResponse struct {
	ID        string                 `db:"id" json:"id"`
	CaseID    string                 `db:"case_id" json:"case_id"`
	Name      string                 `db:"name" json:"name"`
	Status    string                 `db:"status" json:"status"`
	Steps     []PlaybookStepResponse `json:"steps"`
	CreatedAt time.Time              `db:"created_at" json:"created_at"`
	UpdatedAt time.Time              `db:"updated_at" json:"updated_at"`
}

func (h *SOARHandler) UpdatePlaybookStatus(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	if caseID == "" {
		return apierr.New(http.StatusBadRequest, "Case ID is required")
	}

	req := new(PlaybookStatusRequest)
	if err := c.Bind(req); err != nil {
		return apierr.New(http.StatusBadRequest, "Invalid JSON payload")
	}

	if strings.TrimSpace(req.PlaybookName) == "" || strings.TrimSpace(req.StepName) == "" || strings.TrimSpace(req.StepStatus) == "" {
		return apierr.New(http.StatusBadRequest, "playbook_name, step_name and step_status are required")
	}

	ctx := c.Request().Context()

	// 1. Verify case existence
	var count int
	err := h.db.GetContext(ctx, &count, "SELECT COUNT(*) FROM cases WHERE id = $1::uuid", caseID)
	if err != nil || count == 0 {
		return apierr.New(http.StatusNotFound, "Case not found")
	}

	// 2. Start Transaction to ensure consistency
	tx, err := h.db.BeginTxx(ctx, nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to start database transaction")
	}
	defer func() { _ = tx.Rollback() }()

	// 3. Find or Create Playbook Run
	var run struct {
		ID     string `db:"id"`
		Status string `db:"status"`
	}
	err = tx.GetContext(ctx, &run, 
		"SELECT id::text AS id, status FROM playbook_runs WHERE case_id = $1::uuid AND name = $2 LIMIT 1", 
		caseID, req.PlaybookName)

	if err == sql.ErrNoRows {
		// Create new run
		overallStatus := "running"
		if req.PlaybookStatus != "" {
			overallStatus = req.PlaybookStatus
		}
		err = tx.GetContext(ctx, &run, `
			INSERT INTO playbook_runs (case_id, name, status)
			VALUES ($1::uuid, $2, $3)
			RETURNING id::text AS id, status`, caseID, req.PlaybookName, overallStatus)
		if err != nil {
			return apierr.New(http.StatusInternalServerError, "Failed to create playbook run")
		}
	} else if err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to query playbook run")
	} else if req.PlaybookStatus != "" && run.Status != req.PlaybookStatus {
		// Update existing overall status
		_, err = tx.ExecContext(ctx, 
			"UPDATE playbook_runs SET status = $1, updated_at = now() WHERE id = $2::uuid", 
			req.PlaybookStatus, run.ID)
		if err != nil {
			return apierr.New(http.StatusInternalServerError, "Failed to update playbook status")
		}
	}

	// 4. Find or Create/Update Playbook Step
	var stepID string
	err = tx.GetContext(ctx, &stepID, 
		"SELECT id::text FROM playbook_steps WHERE playbook_run_id = $1::uuid AND name = $2 LIMIT 1", 
		run.ID, req.StepName)

	if err == sql.ErrNoRows {
		// Insert step
		_, err = tx.ExecContext(ctx, `
			INSERT INTO playbook_steps (playbook_run_id, name, status, message, position)
			VALUES ($1::uuid, $2, $3, $4, $5)`, run.ID, req.StepName, req.StepStatus, req.StepMessage, req.StepPosition)
		if err != nil {
			return apierr.New(http.StatusInternalServerError, "Failed to create playbook step")
		}
	} else if err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to query playbook step")
	} else {
		// Update step
		_, err = tx.ExecContext(ctx, `
			UPDATE playbook_steps
			SET status = $1, message = $2, position = $3, updated_at = now()
			WHERE id = $4::uuid`, req.StepStatus, req.StepMessage, req.StepPosition, stepID)
		if err != nil {
			return apierr.New(http.StatusInternalServerError, "Failed to update playbook step")
		}
	}

	// Commit Transaction
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to commit database transaction")
	}

	return c.JSON(http.StatusOK, map[string]any{
		"success":          true,
		"playbook_run_id":  run.ID,
		"playbook_name":    req.PlaybookName,
		"step_name":        req.StepName,
		"step_status":      req.StepStatus,
	})
}

func (h *SOARHandler) GetCasePlaybooks(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	if caseID == "" {
		return apierr.New(http.StatusBadRequest, "Case ID is required")
	}

	ctx := c.Request().Context()

	// 1. Fetch all playbook runs for the case
	var runs []PlaybookRunResponse
	err := h.db.SelectContext(ctx, &runs, `
		SELECT id::text AS id, case_id::text AS case_id, name, status, created_at, updated_at
		FROM playbook_runs
		WHERE case_id = $1::uuid
		ORDER BY created_at DESC`, caseID)

	if err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to query playbook runs")
	}

	// 2. Fetch steps for each run
	for i := range runs {
		var steps []PlaybookStepResponse
		err = h.db.SelectContext(ctx, &steps, `
			SELECT id::text AS id, playbook_run_id::text AS playbook_run_id, name, status, message, position, updated_at
			FROM playbook_steps
			WHERE playbook_run_id = $1::uuid
			ORDER BY position ASC, updated_at ASC`, runs[i].ID)

		if err != nil {
			return apierr.New(http.StatusInternalServerError, "Failed to query playbook steps")
		}
		if steps == nil {
			runs[i].Steps = []PlaybookStepResponse{}
		} else {
			runs[i].Steps = steps
		}
	}

	if runs == nil {
		runs = []PlaybookRunResponse{}
	}

	return c.JSON(http.StatusOK, runs)
}
