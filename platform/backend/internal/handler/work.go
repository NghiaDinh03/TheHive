package handler

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/audit"
	"github.com/thehive-platform/backend/internal/notification"
	"github.com/thehive-platform/backend/internal/repository/workwrite"
)

type WorkWriteHandler struct {
	db      *sqlx.DB
	repo    *workwrite.Repository
	audit   *audit.Recorder
	notifEm *notification.Emitter
}

func NewWorkWriteHandler(db *sqlx.DB, auditRecorder *audit.Recorder, opts ...WorkWriteOption) *WorkWriteHandler {
	h := &WorkWriteHandler{db: db, repo: workwrite.NewRepository(db), audit: auditRecorder}
	for _, o := range opts {
		o(h)
	}
	return h
}

// WorkWriteOption configures optional dependencies for WorkWriteHandler.
type WorkWriteOption func(*WorkWriteHandler)

// WithWorkNotifEmitter sets the notification emitter for task/observable/log events.
func WithWorkNotifEmitter(em *notification.Emitter) WorkWriteOption {
	return func(h *WorkWriteHandler) { h.notifEm = em }
}

type createTaskRequest struct {
	CaseID          string     `json:"case_id" validate:"required"`
	Title           string     `json:"title" validate:"required"`
	Description     string     `json:"description"`
	Assignee        string     `json:"assignee"`
	GroupName       string     `json:"group_name"`
	OrderIndex      int        `json:"order_index"`
	Flag            bool       `json:"flag"`
	StartDate       *time.Time `json:"start_date"`
	DueDate         *time.Time `json:"due_date"`
	OrganisationIDs []string   `json:"organisation_ids"`
}

type patchTaskRequest struct {
	Title           *string    `json:"title"`
	Description     *string    `json:"description"`
	Status          *string    `json:"status"`
	Assignee        *string    `json:"assignee"`
	GroupName       *string    `json:"group_name"`
	OrderIndex      *int       `json:"order_index"`
	Flag            *bool      `json:"flag"`
	StartDate       *time.Time `json:"start_date"`
	EndDate         *time.Time `json:"end_date"`
	DueDate         *time.Time `json:"due_date"`
	OrganisationIDs []string   `json:"organisation_ids"`
}

type assignTaskRequest struct {
	Assignee string `json:"assignee" validate:"required"`
}

type reorderTaskItemRequest struct {
	ID         string `json:"id" validate:"required"`
	GroupName  string `json:"group_name"`
	OrderIndex int    `json:"order_index"`
}

type reorderTasksRequest struct {
	CaseID string                   `json:"case_id" validate:"required"`
	Tasks  []reorderTaskItemRequest `json:"tasks" validate:"required"`
}

type bulkCloseTasksRequest struct {
	CaseID  string   `json:"case_id"`
	TaskIDs []string `json:"task_ids"`
}

type bulkAssignTasksRequest struct {
	CaseID   string   `json:"case_id"`
	TaskIDs  []string `json:"task_ids"`
	Assignee string   `json:"assignee" validate:"required"`
}

type appendLogRequest struct {
	Message      string `json:"message" validate:"required"`
	TaskID       string `json:"task_id"`
	AttachmentID string `json:"attachment_id"`
}

type createObservableRequest struct {
	CaseID       string   `json:"case_id"`
	AlertID      string   `json:"alert_id"`
	DataType     string   `json:"data_type" validate:"required"`
	Data         string   `json:"data" validate:"required"`
	Message      string   `json:"message"`
	TLP          int      `json:"tlp"`
	IOC          bool     `json:"ioc"`
	Sighted      bool     `json:"sighted"`
	AttachmentID string   `json:"attachment_id"`
	Tags         []string `json:"tags"`
	CreatedBy    string   `json:"created_by"`
}

type patchObservableRequest struct {
	DataType         *string  `json:"data_type"`
	Data             *string  `json:"data"`
	Message          *string  `json:"message"`
	TLP              *int     `json:"tlp"`
	IOC              *bool    `json:"ioc"`
	Sighted          *bool    `json:"sighted"`
	IgnoreSimilarity *bool    `json:"ignore_similarity"`
	Tags             []string `json:"tags"`
}

func (h *WorkWriteHandler) CreateTask(c echo.Context) error {
	var req createTaskRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	return h.withTx(c, "task.create", "task", func(tx *sqlx.Tx) (string, any, any, error) {
		if err := validateAssignableUser(c, tx, req.CaseID, req.Assignee, "manageTask"); err != nil {
			return "", nil, nil, err
		}
		created, err := h.repo.CreateTask(c.Request().Context(), tx, workwrite.CreateTask{
			CaseID: req.CaseID, Title: req.Title, Description: req.Description, Assignee: req.Assignee,
			GroupName: req.GroupName, OrderIndex: req.OrderIndex, Flag: req.Flag,
			StartDate: req.StartDate, DueDate: req.DueDate, OrganisationIDs: req.OrganisationIDs,
		})
		return created.ID, nil, created, err
	}, http.StatusCreated)
}

func (h *WorkWriteHandler) PatchTask(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var req patchTaskRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	return h.withTx(c, "task.update", "task", func(tx *sqlx.Tx) (string, any, any, error) {
		if req.Assignee != nil {
			if err := validateTaskAssignableUser(c, tx, id, *req.Assignee); err != nil {
				return id, nil, nil, err
			}
		}
		before, err := h.repo.GetTask(c.Request().Context(), tx, id)
		if err != nil {
			return id, nil, nil, err
		}
		// Compose the patch struct: pointer fields are passed through as-is, but slice and date fields
		// need explicit "set" booleans because their zero value (`nil` or empty) is ambiguous between
		// "do not modify" and "clear".
		patch := workwrite.PatchTask{
			Title: req.Title, Description: req.Description, Status: req.Status, Assignee: req.Assignee,
			GroupName: req.GroupName, OrderIndex: req.OrderIndex, Flag: req.Flag,
			StartDate: req.StartDate, EndDate: req.EndDate, DueDate: req.DueDate,
			OrganisationIDs: req.OrganisationIDs, OrganisationIDsSet: req.OrganisationIDs != nil,
			StartDateSet: req.StartDate != nil, EndDateSet: req.EndDate != nil, DueDateSet: req.DueDate != nil,
		}
		updated, err := h.repo.PatchTask(c.Request().Context(), tx, id, patch)
		return updated.ID, before, updated, err
	}, http.StatusOK)
}

func (h *WorkWriteHandler) AssignTask(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var req assignTaskRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	return h.withTx(c, "task.assign", "task", func(tx *sqlx.Tx) (string, any, any, error) {
		if err := validateTaskAssignableUser(c, tx, id, req.Assignee); err != nil {
			return id, nil, nil, err
		}
		before, err := h.repo.GetTask(c.Request().Context(), tx, id)
		if err != nil {
			return id, nil, nil, err
		}
		updated, err := h.repo.AssignTask(c.Request().Context(), tx, id, req.Assignee)
		return updated.ID, before, updated, err
	}, http.StatusOK)
}

func (h *WorkWriteHandler) CloseTask(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	return h.withTx(c, "task.close", "task", func(tx *sqlx.Tx) (string, any, any, error) {
		before, err := h.repo.GetTask(c.Request().Context(), tx, id)
		if err != nil {
			return id, nil, nil, err
		}
		updated, err := h.repo.CloseTask(c.Request().Context(), tx, id)
		return updated.ID, before, updated, err
	}, http.StatusOK)
}

func (h *WorkWriteHandler) ReopenTask(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	return h.withTx(c, "task.reopen", "task", func(tx *sqlx.Tx) (string, any, any, error) {
		before, err := h.repo.GetTask(c.Request().Context(), tx, id)
		if err != nil {
			return id, nil, nil, err
		}
		updated, err := h.repo.ReopenTask(c.Request().Context(), tx, id)
		return updated.ID, before, updated, err
	}, http.StatusOK)
}

func (h *WorkWriteHandler) StartTask(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	return h.withTx(c, "task.start", "task", func(tx *sqlx.Tx) (string, any, any, error) {
		before, err := h.repo.GetTask(c.Request().Context(), tx, id)
		if err != nil {
			return id, nil, nil, err
		}
		updated, err := h.repo.StartTask(c.Request().Context(), tx, id)
		return updated.ID, before, updated, err
	}, http.StatusOK)
}

func (h *WorkWriteHandler) CancelTask(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	return h.withTx(c, "task.cancel", "task", func(tx *sqlx.Tx) (string, any, any, error) {
		before, err := h.repo.GetTask(c.Request().Context(), tx, id)
		if err != nil {
			return id, nil, nil, err
		}
		updated, err := h.repo.CancelTask(c.Request().Context(), tx, id)
		return updated.ID, before, updated, err
	}, http.StatusOK)
}

func (h *WorkWriteHandler) ReorderTasks(c echo.Context) error {
	var req reorderTasksRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	items := make([]workwrite.ReorderTaskInput, 0, len(req.Tasks))
	for _, item := range req.Tasks {
		items = append(items, workwrite.ReorderTaskInput{ID: item.ID, GroupName: item.GroupName, OrderIndex: item.OrderIndex})
	}
	return h.withTx(c, "task.reorder", "task", func(tx *sqlx.Tx) (string, any, any, error) {
		result, err := h.repo.ReorderTasks(c.Request().Context(), tx, req.CaseID, items)
		return req.CaseID, nil, result, err
	}, http.StatusOK)
}

func (h *WorkWriteHandler) BulkCloseTasks(c echo.Context) error {
	var req bulkCloseTasksRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	return h.withTx(c, "task.bulk_close", "task", func(tx *sqlx.Tx) (string, any, any, error) {
		result, err := h.repo.BulkCloseTasks(c.Request().Context(), tx, workwrite.BulkCloseTasksInput{CaseID: req.CaseID, TaskIDs: req.TaskIDs})
		entityID := req.CaseID
		if entityID == "" && len(req.TaskIDs) > 0 {
			entityID = strings.Join(req.TaskIDs, ",")
		}
		return entityID, nil, result, err
	}, http.StatusOK)
}

func (h *WorkWriteHandler) BulkAssignTasks(c echo.Context) error {
	var req bulkAssignTasksRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	return h.withTx(c, "task.bulk_assign", "task", func(tx *sqlx.Tx) (string, any, any, error) {
		if err := validateBulkTaskAssignableUser(c, tx, req.CaseID, req.TaskIDs, req.Assignee); err != nil {
			return req.CaseID, nil, nil, err
		}
		result, err := h.repo.BulkAssignTasks(c.Request().Context(), tx, workwrite.BulkAssignTasksInput{CaseID: req.CaseID, TaskIDs: req.TaskIDs, Assignee: req.Assignee})
		entityID := req.CaseID
		if entityID == "" && len(req.TaskIDs) > 0 {
			entityID = strings.Join(req.TaskIDs, ",")
		}
		return entityID, nil, result, err
	}, http.StatusOK)
}

func (h *WorkWriteHandler) AppendCaseLog(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	var req appendLogRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	return h.withTx(c, "case.log.append", "case_log", func(tx *sqlx.Tx) (string, any, any, error) {
		created, err := h.repo.AppendCaseLog(c.Request().Context(), tx, caseID, req.TaskID, req.AttachmentID, req.Message, actorLogin(c))
		return created.ID, nil, created, err
	}, http.StatusCreated)
}

// AppendTaskLog appends a log entry scoped to a task (mirrors legacy /api/v1/tasks/:id/logs).
// It resolves the case_id from the task row so the existing AppendCaseLog repo method can be reused.
func (h *WorkWriteHandler) AppendTaskLog(c echo.Context) error {
	taskID := strings.TrimSpace(c.Param("id"))
	var req appendLogRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	// Resolve case_id from task
	var caseID string
	if err := h.db.QueryRowxContext(c.Request().Context(), `SELECT case_id::text FROM tasks WHERE id = $1::uuid LIMIT 1`, taskID).Scan(&caseID); err != nil {
		if err == sql.ErrNoRows {
			return apierr.New(http.StatusNotFound, "task not found")
		}
		return apierr.New(http.StatusInternalServerError, "task log append failed")
	}
	return h.withTx(c, "task.log.append", "case_log", func(tx *sqlx.Tx) (string, any, any, error) {
		created, err := h.repo.AppendCaseLog(c.Request().Context(), tx, caseID, taskID, req.AttachmentID, req.Message, actorLogin(c))
		return created.ID, nil, created, err
	}, http.StatusCreated)
}

func (h *WorkWriteHandler) CreateObservable(c echo.Context) error {
	var req createObservableRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	createdBy := req.CreatedBy
	if strings.TrimSpace(createdBy) == "" {
		createdBy = actorLogin(c)
	}
	return h.withTx(c, "observable.create", "observable", func(tx *sqlx.Tx) (string, any, any, error) {
		created, err := h.repo.CreateObservable(c.Request().Context(), tx, workwrite.CreateObservable{CaseID: req.CaseID, AlertID: req.AlertID, DataType: req.DataType, Data: req.Data, Message: req.Message, TLP: req.TLP, IOC: req.IOC, Sighted: req.Sighted, AttachmentID: req.AttachmentID, Tags: req.Tags, CreatedBy: createdBy})
		return created.ID, nil, created, err
	}, http.StatusCreated)
}

func (h *WorkWriteHandler) PatchObservable(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var req patchObservableRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	return h.withTx(c, "observable.update", "observable", func(tx *sqlx.Tx) (string, any, any, error) {
		before, err := h.repo.GetObservable(c.Request().Context(), tx, id)
		if err != nil {
			return id, nil, nil, err
		}
		updated, err := h.repo.PatchObservable(c.Request().Context(), tx, id, workwrite.PatchObservable{DataType: req.DataType, Data: req.Data, Message: req.Message, TLP: req.TLP, IOC: req.IOC, Sighted: req.Sighted, IgnoreSimilarity: req.IgnoreSimilarity, Tags: req.Tags, TagsSet: req.Tags != nil})
		return updated.ID, before.Response(), updated, err
	}, http.StatusOK)
}

func (h *WorkWriteHandler) DeleteObservable(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	return h.withTx(c, "observable.delete", "observable", func(tx *sqlx.Tx) (string, any, any, error) {
		deleted, err := h.repo.DeleteObservable(c.Request().Context(), tx, id)
		return deleted.ID, deleted, map[string]string{"status": "deleted", "id": deleted.ID}, err
	}, http.StatusOK)
}

func (h *WorkWriteHandler) AnalyzeObservable(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	return h.withTx(c, "observable.analyze.placeholder", "observable", func(tx *sqlx.Tx) (string, any, any, error) {
		before, err := h.repo.GetObservable(c.Request().Context(), tx, id)
		if err != nil {
			return id, nil, nil, err
		}
		result, err := h.repo.AnalyzeObservable(c.Request().Context(), tx, id)
		return id, before.Response(), result, err
	}, http.StatusAccepted)
}

// actionToTrigger maps handler action strings to notification trigger types.
var actionToTrigger = map[string]notification.TriggerType{
	"task.create":       notification.TriggerTaskCreated,
	"task.assign":       notification.TriggerTaskAssigned,
	"task.close":        notification.TriggerTaskClosed,
	"task.cancel":       notification.TriggerTaskClosed,
	"task.start":        notification.TriggerTaskAssigned,
	"task.reopen":       notification.TriggerTaskCreated,
	"observable.create": notification.TriggerObservableCreated,
	"case.log.append":   notification.TriggerLogCreated,
}

func (h *WorkWriteHandler) withTx(c echo.Context, action string, entityType string, fn func(*sqlx.Tx) (string, any, any, error), status int) error {
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, action+" failed")
	}
	defer func() { _ = tx.Rollback() }()
	entityID, before, after, err := fn(tx)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, entityType+" not found")
	}
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, action, entityType, entityID, before, after)); err != nil {
			return apierr.New(http.StatusInternalServerError, action+" audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, action+" failed")
	}
	// Emit notification trigger after successful commit
	if h.notifEm != nil {
		if trigger, ok := actionToTrigger[action]; ok {
			go h.notifEm.Emit(c.Request().Context(), notification.TriggerEvent{
				Type:       trigger,
				EntityType: entityType,
				EntityID:   entityID,
				ActorLogin: actorLogin(c),
			})
		}
	}
	return c.JSON(status, after)
}

func bindAndValidate(c echo.Context, target any) error {
	if err := c.Bind(target); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if c.Echo().Validator != nil {
		if err := c.Validate(target); err != nil {
			return apierr.New(http.StatusBadRequest, err.Error())
		}
	}
	return nil
}
