package handler

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/audit"
	"github.com/thehive-platform/backend/internal/authjwt"
	"github.com/thehive-platform/backend/internal/repository/alertwrite"
)

type AlertWriteHandler struct {
	db    *sqlx.DB
	repo  *alertwrite.Repository
	audit *audit.Recorder
}

func NewAlertWriteHandler(db *sqlx.DB, auditRecorder *audit.Recorder) *AlertWriteHandler {
	return &AlertWriteHandler{db: db, repo: alertwrite.NewRepository(db), audit: auditRecorder}
}

type mergeAlertRequest struct {
	TargetAlertID string `json:"target_alert_id"`
	CaseID        string `json:"case_id"`
}

func (h *AlertWriteHandler) Import(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert import failed")
	}
	defer func() { _ = tx.Rollback() }()
	before, err := h.repo.Get(c.Request().Context(), tx, id)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "alert not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert import failed")
	}
	result, err := h.repo.Import(c.Request().Context(), tx, id, actorLogin(c))
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert import failed")
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "alert.import", "alert", result.Alert.ID, before.Response(), result)); err != nil {
			return apierr.New(http.StatusInternalServerError, "alert import audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "alert import failed")
	}
	return c.JSON(http.StatusOK, result)
}

func (h *AlertWriteHandler) Merge(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var req mergeAlertRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert merge failed")
	}
	defer func() { _ = tx.Rollback() }()
	before, err := h.repo.Get(c.Request().Context(), tx, id)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "alert not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert merge failed")
	}
	var result alertwrite.MergeResult
	if strings.TrimSpace(req.CaseID) != "" {
		result, err = h.repo.MergeIntoCase(c.Request().Context(), tx, id, req.CaseID)
	} else {
		result, err = h.repo.MergeIntoAlertCase(c.Request().Context(), tx, id, req.TargetAlertID)
	}
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "target not found")
	}
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "alert.merge", "alert", result.SourceAlert.ID, before.Response(), result)); err != nil {
			return apierr.New(http.StatusInternalServerError, "alert merge audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "alert merge failed")
	}
	return c.JSON(http.StatusOK, result)
}

func actorLogin(c echo.Context) string {
	if claims, ok := c.Get("auth_claims").(*authjwt.Claims); ok && claims.Login != "" {
		return claims.Login
	}
	return "system"
}
