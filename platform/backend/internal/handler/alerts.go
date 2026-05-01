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
	"github.com/thehive-platform/backend/internal/notification"
	"github.com/thehive-platform/backend/internal/repository/alertwrite"
)

type AlertWriteHandler struct {
	db      *sqlx.DB
	repo    *alertwrite.Repository
	audit   *audit.Recorder
	notifEm *notification.Emitter
}

func NewAlertWriteHandler(db *sqlx.DB, auditRecorder *audit.Recorder, opts ...AlertWriteOption) *AlertWriteHandler {
	h := &AlertWriteHandler{db: db, repo: alertwrite.NewRepository(db), audit: auditRecorder}
	for _, o := range opts {
		o(h)
	}
	return h
}

// AlertWriteOption configures optional dependencies for AlertWriteHandler.
type AlertWriteOption func(*AlertWriteHandler)

// WithAlertNotifEmitter sets the notification emitter for alert events.
func WithAlertNotifEmitter(em *notification.Emitter) AlertWriteOption {
	return func(h *AlertWriteHandler) { h.notifEm = em }
}

type mergeAlertRequest struct {
	TargetAlertID string `json:"target_alert_id"`
	CaseID        string `json:"case_id"`
}

type updateAlertRequest struct {
	Title        *string  `json:"title"`
	Description  *string  `json:"description"`
	Severity     *int     `json:"severity"`
	TLP          *int     `json:"tlp"`
	PAP          *int     `json:"pap"`
	Tags         []string `json:"tags"`
	Follow       *bool    `json:"follow"`
	Flag         *bool    `json:"flag"`
	CaseTemplate *string  `json:"case_template"`
	ExternalLink *string  `json:"external_link"`
}

type bulkAlertRequest struct {
	AlertIDs []string `json:"alert_ids" validate:"required,min=1"`
	CaseID   string   `json:"case_id"`
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
	if h.notifEm != nil {
		go h.notifEm.EmitAlertEvent(c.Request().Context(), notification.TriggerAlertImported, result.Alert.ID, actorLogin(c), nil)
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
	if h.notifEm != nil {
		go h.notifEm.EmitAlertEvent(c.Request().Context(), notification.TriggerAlertMerged, result.SourceAlert.ID, actorLogin(c), nil)
	}
	return c.JSON(http.StatusOK, result)
}

func (h *AlertWriteHandler) Update(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var req updateAlertRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert update failed")
	}
	defer func() { _ = tx.Rollback() }()
	before, err := h.repo.Get(c.Request().Context(), tx, id)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "alert not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert update failed")
	}
	updated, err := h.repo.Update(c.Request().Context(), tx, id, alertwrite.UpdateAlert{
		Title: req.Title, Description: req.Description, Severity: req.Severity, TLP: req.TLP, PAP: req.PAP,
		Tags: req.Tags, TagsSet: req.Tags != nil, Follow: req.Follow, Flag: req.Flag,
		CaseTemplate: req.CaseTemplate, ExternalLink: req.ExternalLink,
	})
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert update failed")
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "alert.update", "alert", id, before.Response(), updated.Response()))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "alert update failed")
	}
	if h.notifEm != nil {
		go h.notifEm.EmitAlertEvent(c.Request().Context(), notification.TriggerAlertUpdated, id, actorLogin(c), nil)
	}
	return c.JSON(http.StatusOK, updated.Response())
}

func (h *AlertWriteHandler) Delete(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert delete failed")
	}
	defer func() { _ = tx.Rollback() }()
	before, err := h.repo.Get(c.Request().Context(), tx, id)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "alert not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert delete failed")
	}
	if err := h.repo.Delete(c.Request().Context(), tx, id); err != nil {
		return apierr.New(http.StatusInternalServerError, "alert delete failed")
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "alert.delete", "alert", id, before.Response(), map[string]string{"id": id, "status": "deleted"}))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "alert delete failed")
	}
	return c.JSON(http.StatusOK, map[string]string{"id": id, "status": "deleted"})
}

func (h *AlertWriteHandler) ToggleFollow(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert follow toggle failed")
	}
	defer func() { _ = tx.Rollback() }()
	before, err := h.repo.Get(c.Request().Context(), tx, id)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "alert not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert follow toggle failed")
	}
	newFollow := !before.Follow
	updated, err := h.repo.Update(c.Request().Context(), tx, id, alertwrite.UpdateAlert{Follow: &newFollow})
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert follow toggle failed")
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "alert.follow", "alert", id, before.Response(), updated.Response()))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "alert follow toggle failed")
	}
	return c.JSON(http.StatusOK, updated.Response())
}

func (h *AlertWriteHandler) ToggleRead(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert read toggle failed")
	}
	defer func() { _ = tx.Rollback() }()
	before, err := h.repo.Get(c.Request().Context(), tx, id)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "alert not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert read toggle failed")
	}
	newRead := !before.Read
	updated, err := h.repo.SetRead(c.Request().Context(), tx, id, newRead)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert read toggle failed")
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "alert read toggle failed")
	}
	return c.JSON(http.StatusOK, updated.Response())
}

func (h *AlertWriteHandler) BulkImport(c echo.Context) error {
	var req bulkAlertRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	type importItem struct {
		AlertID string `json:"alert_id"`
		Status  string `json:"status"`
		CaseID  string `json:"case_id,omitempty"`
		Error   string `json:"error,omitempty"`
	}
	results := make([]importItem, 0, len(req.AlertIDs))
	for _, alertID := range req.AlertIDs {
		tx, err := h.db.BeginTxx(c.Request().Context(), nil)
		if err != nil {
			results = append(results, importItem{AlertID: alertID, Status: "error", Error: "tx failed"})
			continue
		}
		result, err := h.repo.Import(c.Request().Context(), tx, strings.TrimSpace(alertID), actorLogin(c))
		if err != nil {
			_ = tx.Rollback()
			results = append(results, importItem{AlertID: alertID, Status: "error", Error: err.Error()})
			continue
		}
		if h.audit != nil {
			_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "alert.bulk_import", "alert", result.Alert.ID, nil, result))
		}
		if err := tx.Commit(); err != nil {
			results = append(results, importItem{AlertID: alertID, Status: "error", Error: "commit failed"})
			continue
		}
		results = append(results, importItem{AlertID: alertID, Status: "imported", CaseID: result.Case.ID})
	}
	return c.JSON(http.StatusOK, map[string]any{"results": results, "total": len(results)})
}

func (h *AlertWriteHandler) BulkMerge(c echo.Context) error {
	var req bulkAlertRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	if strings.TrimSpace(req.CaseID) == "" {
		return apierr.New(http.StatusBadRequest, "case_id is required for bulk merge")
	}
	type mergeItem struct {
		AlertID string `json:"alert_id"`
		Status  string `json:"status"`
		Error   string `json:"error,omitempty"`
	}
	results := make([]mergeItem, 0, len(req.AlertIDs))
	for _, alertID := range req.AlertIDs {
		tx, err := h.db.BeginTxx(c.Request().Context(), nil)
		if err != nil {
			results = append(results, mergeItem{AlertID: alertID, Status: "error", Error: "tx failed"})
			continue
		}
		_, err = h.repo.MergeIntoCase(c.Request().Context(), tx, strings.TrimSpace(alertID), req.CaseID)
		if err != nil {
			_ = tx.Rollback()
			results = append(results, mergeItem{AlertID: alertID, Status: "error", Error: err.Error()})
			continue
		}
		if h.audit != nil {
			_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "alert.bulk_merge", "alert", alertID, nil, map[string]string{"case_id": req.CaseID}))
		}
		if err := tx.Commit(); err != nil {
			results = append(results, mergeItem{AlertID: alertID, Status: "error", Error: "commit failed"})
			continue
		}
		results = append(results, mergeItem{AlertID: alertID, Status: "merged"})
	}
	return c.JSON(http.StatusOK, map[string]any{"results": results, "total": len(results)})
}

func actorLogin(c echo.Context) string {
	if claims, ok := c.Get("auth_claims").(*authjwt.Claims); ok && claims.Login != "" {
		return claims.Login
	}
	return "system"
}
