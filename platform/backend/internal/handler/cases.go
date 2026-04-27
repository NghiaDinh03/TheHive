package handler

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/audit"
	"github.com/thehive-platform/backend/internal/repository/casewrite"
)

type CaseWriteHandler struct {
	db    *sqlx.DB
	repo  *casewrite.Repository
	audit *audit.Recorder
}

func NewCaseWriteHandler(db *sqlx.DB, auditRecorder *audit.Recorder) *CaseWriteHandler {
	return &CaseWriteHandler{db: db, repo: casewrite.NewRepository(db), audit: auditRecorder}
}

type createCaseRequest struct {
	Title       string   `json:"title" validate:"required,min=1"`
	Description string   `json:"description"`
	Severity    int      `json:"severity"`
	TLP         int      `json:"tlp"`
	PAP         int      `json:"pap"`
	Owner       string   `json:"owner"`
	Assignee    string   `json:"assignee"`
	Tags        []string `json:"tags"`
}

type patchCaseRequest struct {
	Title       *string  `json:"title"`
	Description *string  `json:"description"`
	Severity    *int     `json:"severity"`
	TLP         *int     `json:"tlp"`
	PAP         *int     `json:"pap"`
	Assignee    *string  `json:"assignee"`
	Tags        []string `json:"tags"`
}

func (h *CaseWriteHandler) Create(c echo.Context) error {
	var req createCaseRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if err := c.Validate(&req); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case create failed")
	}
	defer func() { _ = tx.Rollback() }()
	created, err := h.repo.Create(c.Request().Context(), tx, casewrite.CreateCase{Title: req.Title, Description: req.Description, Severity: req.Severity, TLP: req.TLP, PAP: req.PAP, Owner: req.Owner, Assignee: req.Assignee, Tags: req.Tags})
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "case.create", "case", created.ID, nil, created)); err != nil {
			return apierr.New(http.StatusInternalServerError, "case create audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "case create failed")
	}
	return c.JSON(http.StatusCreated, created)
}

func (h *CaseWriteHandler) Patch(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var req patchCaseRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case update failed")
	}
	defer func() { _ = tx.Rollback() }()
	before, err := h.repo.Get(c.Request().Context(), tx, id)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "case not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case update failed")
	}
	updated, err := h.repo.Patch(c.Request().Context(), tx, id, casewrite.PatchCase{Title: req.Title, Description: req.Description, Severity: req.Severity, TLP: req.TLP, PAP: req.PAP, Assignee: req.Assignee, Tags: req.Tags, TagsSet: req.Tags != nil})
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case update failed")
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "case.update", "case", updated.ID, before, updated)); err != nil {
			return apierr.New(http.StatusInternalServerError, "case update audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "case update failed")
	}
	return c.JSON(http.StatusOK, updated)
}

func (h *CaseWriteHandler) Close(c echo.Context) error {
	return h.setStatus(c, "case.close", true)
}

func (h *CaseWriteHandler) Reopen(c echo.Context) error {
	return h.setStatus(c, "case.reopen", false)
}

func (h *CaseWriteHandler) setStatus(c echo.Context, action string, closeCase bool) error {
	id := strings.TrimSpace(c.Param("id"))
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case status update failed")
	}
	defer func() { _ = tx.Rollback() }()
	before, err := h.repo.Get(c.Request().Context(), tx, id)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "case not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case status update failed")
	}
	var updated casewrite.Case
	if closeCase {
		updated, err = h.repo.Close(c.Request().Context(), tx, id)
	} else {
		updated, err = h.repo.Reopen(c.Request().Context(), tx, id)
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case status update failed")
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, action, "case", updated.ID, before, updated)); err != nil {
			return apierr.New(http.StatusInternalServerError, "case status audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "case status update failed")
	}
	return c.JSON(http.StatusOK, updated)
}
