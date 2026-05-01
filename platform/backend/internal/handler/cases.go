package handler

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/audit"
	"github.com/thehive-platform/backend/internal/notification"
	"github.com/thehive-platform/backend/internal/repository/casewrite"
)

type CaseWriteHandler struct {
	db      *sqlx.DB
	repo    *casewrite.Repository
	audit   *audit.Recorder
	notifEm *notification.Emitter
}

func NewCaseWriteHandler(db *sqlx.DB, auditRecorder *audit.Recorder, opts ...CaseWriteOption) *CaseWriteHandler {
	h := &CaseWriteHandler{db: db, repo: casewrite.NewRepository(db), audit: auditRecorder}
	for _, o := range opts {
		o(h)
	}
	return h
}

// CaseWriteOption configures optional dependencies for CaseWriteHandler.
type CaseWriteOption func(*CaseWriteHandler)

// WithCaseNotifEmitter sets the notification emitter for case events.
func WithCaseNotifEmitter(em *notification.Emitter) CaseWriteOption {
	return func(h *CaseWriteHandler) { h.notifEm = em }
}

type createCaseRequest struct {
	Title              string   `json:"title" validate:"required,min=1"`
	Description        string   `json:"description"`
	Severity           int      `json:"severity"`
	TLP                int      `json:"tlp"`
	PAP                int      `json:"pap"`
	Owner              string   `json:"owner"`
	Assignee           string   `json:"assignee"`
	Tags               []string `json:"tags"`
	Flag               bool     `json:"flag"`
	Summary            string   `json:"summary"`
	ImpactStatus       string   `json:"impact_status"`
	ResolutionStatus   string   `json:"resolution_status"`
	CaseTemplate       string   `json:"case_template"`
	OwningOrganisation string   `json:"owning_organisation"`
	OrganisationIDs    []string `json:"organisation_ids"`
}

type patchCaseRequest struct {
	Title              *string  `json:"title"`
	Description        *string  `json:"description"`
	Severity           *int     `json:"severity"`
	TLP                *int     `json:"tlp"`
	PAP                *int     `json:"pap"`
	Assignee           *string  `json:"assignee"`
	Tags               []string `json:"tags"`
	Flag               *bool    `json:"flag"`
	Summary            *string  `json:"summary"`
	ImpactStatus       *string  `json:"impact_status"`
	ResolutionStatus   *string  `json:"resolution_status"`
	CaseTemplate       *string  `json:"case_template"`
	OwningOrganisation *string  `json:"owning_organisation"`
	OrganisationIDs    []string `json:"organisation_ids"`
}

type closeCaseRequest struct {
	ImpactStatus     string `json:"impact_status"`
	ResolutionStatus string `json:"resolution_status"`
	Summary          string `json:"summary"`
}

type duplicateCaseRequest struct {
	TargetCaseID string `json:"target_case_id" validate:"required"`
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
	if err := validateAssignableUser(c, tx, "", req.Assignee, "manageCase"); err != nil {
		return err
	}
	created, err := h.repo.Create(c.Request().Context(), tx, casewrite.CreateCase{
		Title: req.Title, Description: req.Description, Severity: req.Severity, TLP: req.TLP, PAP: req.PAP,
		Owner: req.Owner, Assignee: req.Assignee, Tags: req.Tags,
		Flag: req.Flag, Summary: req.Summary, ImpactStatus: req.ImpactStatus, ResolutionStatus: req.ResolutionStatus,
		CaseTemplate: req.CaseTemplate, OwningOrganisation: req.OwningOrganisation, OrganisationIDs: req.OrganisationIDs,
	})
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
	if h.notifEm != nil {
		go h.notifEm.EmitCaseEvent(c.Request().Context(), notification.TriggerCaseCreated, created.ID, actorLogin(c), nil)
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
	if req.Assignee != nil {
		if err := validateAssignableUser(c, tx, id, *req.Assignee, "manageCase"); err != nil {
			return err
		}
	}
	updated, err := h.repo.Patch(c.Request().Context(), tx, id, casewrite.PatchCase{
		Title: req.Title, Description: req.Description, Severity: req.Severity, TLP: req.TLP, PAP: req.PAP,
		Assignee: req.Assignee, Tags: req.Tags, TagsSet: req.Tags != nil,
		Flag: req.Flag, Summary: req.Summary, ImpactStatus: req.ImpactStatus, ResolutionStatus: req.ResolutionStatus,
		CaseTemplate: req.CaseTemplate, OwningOrganisation: req.OwningOrganisation,
		OrganisationIDs: req.OrganisationIDs, OrganisationIDsSet: req.OrganisationIDs != nil,
	})
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
	if h.notifEm != nil {
		go h.notifEm.EmitCaseEvent(c.Request().Context(), notification.TriggerCaseUpdated, updated.ID, actorLogin(c), nil)
	}
	return c.JSON(http.StatusOK, updated)
}

func (h *CaseWriteHandler) Delete(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case delete failed")
	}
	defer func() { _ = tx.Rollback() }()
	if err := requireActorOwnerShare(c, tx, id); err != nil {
		return err
	}
	deleted, err := h.repo.Delete(c.Request().Context(), tx, id)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "case not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case delete failed")
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "case.delete", "case", deleted.ID, deleted, map[string]string{"status": "deleted", "id": deleted.ID})); err != nil {
			return apierr.New(http.StatusInternalServerError, "case delete audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "case delete failed")
	}
	if h.notifEm != nil {
		go h.notifEm.EmitCaseEvent(c.Request().Context(), notification.TriggerCaseDeleted, deleted.ID, actorLogin(c), nil)
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "deleted", "id": deleted.ID})
}

// Close moves the case to TheHive 4 "Resolved" state, persists impact/resolution/summary,
// and cancels/finishes pending tasks per legacy CaseSrv.update behaviour.
func (h *CaseWriteHandler) Close(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var req closeCaseRequest
	// Body is optional: legacy clients sometimes POST with no payload.
	_ = c.Bind(&req)
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case close failed")
	}
	defer func() { _ = tx.Rollback() }()
	before, err := h.repo.Get(c.Request().Context(), tx, id)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "case not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case close failed")
	}
	updated, err := h.repo.Close(c.Request().Context(), tx, id, casewrite.CloseCase{
		ImpactStatus: req.ImpactStatus, ResolutionStatus: req.ResolutionStatus, Summary: req.Summary,
	})
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case close failed")
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "case.close", "case", updated.ID, before, updated)); err != nil {
			return apierr.New(http.StatusInternalServerError, "case close audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "case close failed")
	}
	if h.notifEm != nil {
		go h.notifEm.EmitCaseEvent(c.Request().Context(), notification.TriggerCaseClosed, updated.ID, actorLogin(c), nil)
	}
	return c.JSON(http.StatusOK, updated)
}

func (h *CaseWriteHandler) Reopen(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case reopen failed")
	}
	defer func() { _ = tx.Rollback() }()
	before, err := h.repo.Get(c.Request().Context(), tx, id)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "case not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case reopen failed")
	}
	updated, err := h.repo.Reopen(c.Request().Context(), tx, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case reopen failed")
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "case.reopen", "case", updated.ID, before, updated)); err != nil {
			return apierr.New(http.StatusInternalServerError, "case reopen audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "case reopen failed")
	}
	if h.notifEm != nil {
		go h.notifEm.EmitCaseEvent(c.Request().Context(), notification.TriggerCaseReopened, updated.ID, actorLogin(c), nil)
	}
	return c.JSON(http.StatusOK, updated)
}

// MarkDuplicated marks the case as Duplicated of a target case (TheHive 4 "Duplicated" status).
func (h *CaseWriteHandler) MarkDuplicated(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var req duplicateCaseRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if err := c.Validate(&req); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case duplicate failed")
	}
	defer func() { _ = tx.Rollback() }()
	before, err := h.repo.Get(c.Request().Context(), tx, id)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "case not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case duplicate failed")
	}
	updated, err := h.repo.MarkDuplicated(c.Request().Context(), tx, id, req.TargetCaseID)
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "case.duplicate", "case", updated.ID, before, updated)); err != nil {
			return apierr.New(http.StatusInternalServerError, "case duplicate audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "case duplicate failed")
	}
	return c.JSON(http.StatusOK, updated)
}
