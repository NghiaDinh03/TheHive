package handler

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/audit"
	"github.com/thehive-platform/backend/internal/repository/workwrite"
)

type WorkWriteHandler struct {
	db    *sqlx.DB
	repo  *workwrite.Repository
	audit *audit.Recorder
}

func NewWorkWriteHandler(db *sqlx.DB, auditRecorder *audit.Recorder) *WorkWriteHandler {
	return &WorkWriteHandler{db: db, repo: workwrite.NewRepository(db), audit: auditRecorder}
}

type createTaskRequest struct {
	CaseID     string `json:"case_id" validate:"required"`
	Title      string `json:"title" validate:"required"`
	Assignee   string `json:"assignee"`
	GroupName  string `json:"group_name"`
	OrderIndex int    `json:"order_index"`
}

type patchTaskRequest struct {
	Title      *string `json:"title"`
	Status     *string `json:"status"`
	Assignee   *string `json:"assignee"`
	GroupName  *string `json:"group_name"`
	OrderIndex *int    `json:"order_index"`
}

type assignTaskRequest struct {
	Assignee string `json:"assignee" validate:"required"`
}

type appendLogRequest struct {
	Message string `json:"message" validate:"required"`
	TaskID  string `json:"task_id"`
}

type createObservableRequest struct {
	CaseID    string   `json:"case_id" validate:"required"`
	DataType  string   `json:"data_type" validate:"required"`
	Data      string   `json:"data" validate:"required"`
	Message   string   `json:"message"`
	TLP       int      `json:"tlp"`
	IOC       bool     `json:"ioc"`
	Sighted   bool     `json:"sighted"`
	Tags      []string `json:"tags"`
	CreatedBy string   `json:"created_by"`
}

type patchObservableRequest struct {
	DataType *string  `json:"data_type"`
	Data     *string  `json:"data"`
	Message  *string  `json:"message"`
	TLP      *int     `json:"tlp"`
	IOC      *bool    `json:"ioc"`
	Sighted  *bool    `json:"sighted"`
	Tags     []string `json:"tags"`
}

func (h *WorkWriteHandler) CreateTask(c echo.Context) error {
	var req createTaskRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	return h.withTx(c, "task.create", "task", func(tx *sqlx.Tx) (string, any, any, error) {
		created, err := h.repo.CreateTask(c.Request().Context(), tx, workwrite.CreateTask{CaseID: req.CaseID, Title: req.Title, Assignee: req.Assignee, GroupName: req.GroupName, OrderIndex: req.OrderIndex})
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
		before, err := h.repo.GetTask(c.Request().Context(), tx, id)
		if err != nil {
			return id, nil, nil, err
		}
		updated, err := h.repo.PatchTask(c.Request().Context(), tx, id, workwrite.PatchTask{Title: req.Title, Status: req.Status, Assignee: req.Assignee, GroupName: req.GroupName, OrderIndex: req.OrderIndex})
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

func (h *WorkWriteHandler) AppendCaseLog(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	var req appendLogRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	return h.withTx(c, "case.log.append", "case_log", func(tx *sqlx.Tx) (string, any, any, error) {
		created, err := h.repo.AppendCaseLog(c.Request().Context(), tx, caseID, req.TaskID, req.Message, actorLogin(c))
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
		created, err := h.repo.CreateObservable(c.Request().Context(), tx, workwrite.CreateObservable{CaseID: req.CaseID, DataType: req.DataType, Data: req.Data, Message: req.Message, TLP: req.TLP, IOC: req.IOC, Sighted: req.Sighted, Tags: req.Tags, CreatedBy: createdBy})
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
		updated, err := h.repo.PatchObservable(c.Request().Context(), tx, id, workwrite.PatchObservable{DataType: req.DataType, Data: req.Data, Message: req.Message, TLP: req.TLP, IOC: req.IOC, Sighted: req.Sighted, Tags: req.Tags, TagsSet: req.Tags != nil})
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
