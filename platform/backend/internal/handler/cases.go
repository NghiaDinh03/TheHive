package handler

import (
	"context"
	"database/sql"
	"net/http"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/audit"
	"github.com/thehive-platform/backend/internal/misp"
	"github.com/thehive-platform/backend/internal/notification"
	"github.com/thehive-platform/backend/internal/repository/casewrite"
	"go.uber.org/zap"
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
	// Kích hoạt tự động phân tích log thô trích xuất custom properties
	go ParseTextAndExtractCustomProperties(context.Background(), h.db, created.ID, created.Description)
	// Kích hoạt tự động đồng bộ IOC sang MISP trong nền nếu là Incident
	go misp.AutoSyncCaseIOCsToMISP(context.Background(), h.db, zap.L(), created.ID)

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
	// Kích hoạt tự động phân tích log thô trích xuất custom properties
	go ParseTextAndExtractCustomProperties(context.Background(), h.db, updated.ID, updated.Description)
	// Kích hoạt tự động đồng bộ IOC sang MISP trong nền nếu có thay đổi hoặc là Incident
	go misp.AutoSyncCaseIOCsToMISP(context.Background(), h.db, zap.L(), updated.ID)

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
		return apierr.New(http.StatusBadRequest, err.Error())
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

type mergeCaseRequest struct {
	TargetCaseID string `json:"target_case_id" validate:"required"`
}

// Merge merges this case into the target case. Tasks, observables, logs, and
// attachments are moved to the target case. This case is marked as Duplicated.
// Mirrors legacy CaseMergeModalCtrl.
func (h *CaseWriteHandler) Merge(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var req mergeCaseRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if err := c.Validate(&req); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	if req.TargetCaseID == id {
		return apierr.New(http.StatusBadRequest, "cannot merge case into itself")
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case merge failed")
	}
	defer func() { _ = tx.Rollback() }()

	// Verify both cases exist
	before, err := h.repo.Get(c.Request().Context(), tx, id)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "source case not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case merge failed")
	}
	target, err := h.repo.Get(c.Request().Context(), tx, req.TargetCaseID)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "target case not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case merge failed")
	}

	// Move tasks to target case
	_, err = tx.ExecContext(c.Request().Context(),
		`UPDATE task_items SET case_id = $1::uuid WHERE case_id = $2::uuid`, req.TargetCaseID, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to move tasks")
	}

	// Move observables to target case
	_, err = tx.ExecContext(c.Request().Context(),
		`UPDATE observables SET case_id = $1::uuid WHERE case_id = $2::uuid`, req.TargetCaseID, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to move observables")
	}

	// Move case logs to target case
	_, err = tx.ExecContext(c.Request().Context(),
		`UPDATE case_logs SET case_id = $1::uuid WHERE case_id = $2::uuid`, req.TargetCaseID, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to move logs")
	}

	// Move attachments to target case
	_, err = tx.ExecContext(c.Request().Context(),
		`UPDATE attachments SET case_id = $1::uuid WHERE case_id = $2::uuid`, req.TargetCaseID, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to move attachments")
	}

	// Move custom fields to target case
	_, err = tx.ExecContext(c.Request().Context(),
		`UPDATE case_custom_fields SET case_id = $1::uuid WHERE case_id = $2::uuid`, req.TargetCaseID, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to move custom fields")
	}

	// Move procedures to target case
	_, err = tx.ExecContext(c.Request().Context(),
		`UPDATE case_procedures SET case_id = $1::uuid WHERE case_id = $2::uuid`, req.TargetCaseID, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to move procedures")
	}

	// Mark source case as Duplicated pointing to target
	updated, err := h.repo.MarkDuplicated(c.Request().Context(), tx, id, req.TargetCaseID)
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}

	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "case.merge", "case", updated.ID, before, map[string]any{"target_case_id": req.TargetCaseID, "target_case_number": target.Number})); err != nil {
			return apierr.New(http.StatusInternalServerError, "case merge audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "case merge failed")
	}
	return c.JSON(http.StatusOK, map[string]any{
		"case":        updated,
		"target_case": req.TargetCaseID,
		"status":      "merged",
	})
}

// SyncMISP kích hoạt đồng bộ hóa IOC của Case sang máy chủ MISP thủ công từ UI
func (h *CaseWriteHandler) SyncMISP(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))

	var exists bool
	err := h.db.GetContext(c.Request().Context(), &exists, `SELECT EXISTS(SELECT 1 FROM cases WHERE id = $1::uuid)`, caseID)
	if err != nil || !exists {
		return apierr.New(http.StatusNotFound, "Không tìm thấy Case tương ứng")
	}

	// Trigger cưỡng bức đồng bộ trong background
	go misp.AutoSyncCaseIOCsToMISP(context.Background(), h.db, zap.L(), caseID)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"case_id": caseID,
		"status":  "triggered",
		"message": "Đã kích hoạt đồng bộ hóa IOC sang máy chủ MISP trong nền.",
	})
}
