package handler

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/lib/pq"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/audit"
	"github.com/thehive-platform/backend/internal/repository/casetemplate"
	"github.com/thehive-platform/backend/internal/repository/casewrite"
	"github.com/thehive-platform/backend/internal/repository/workwrite"
)

type TemplateHandler struct {
	db       *sqlx.DB
	repo     *casetemplate.Repository
	caseRepo *casewrite.Repository
	workRepo *workwrite.Repository
	audit    *audit.Recorder
}

func NewTemplateHandler(db *sqlx.DB, auditRecorder *audit.Recorder) *TemplateHandler {
	return &TemplateHandler{
		db:       db,
		repo:     casetemplate.NewRepository(db),
		caseRepo: casewrite.NewRepository(db),
		workRepo: workwrite.NewRepository(db),
		audit:    auditRecorder,
	}
}

type createTemplateRequest struct {
	Name         string                      `json:"name" validate:"required"`
	DisplayName  string                      `json:"display_name"`
	TitlePrefix  string                      `json:"title_prefix"`
	Description  string                      `json:"description"`
	Severity     int                         `json:"severity"`
	TLP          int                         `json:"tlp"`
	PAP          int                         `json:"pap"`
	Tags         []string                    `json:"tags"`
	Tasks        []createTemplateTaskRequest `json:"tasks"`
	CustomFields []createTemplateCFRequest   `json:"custom_fields"`
}

type createTemplateTaskRequest struct {
	Title       string `json:"title" validate:"required"`
	Description string `json:"description"`
	GroupName   string `json:"group_name"`
	OrderIndex  int    `json:"order_index"`
}

type createTemplateCFRequest struct {
	FieldName    string `json:"field_name" validate:"required"`
	FieldType    string `json:"field_type"`
	DefaultValue string `json:"default_value"`
	FieldOrder   int    `json:"field_order"`
}

func (h *TemplateHandler) List(c echo.Context) error {
	templates, err := h.repo.List(c.Request().Context())
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "template list failed")
	}
	return c.JSON(http.StatusOK, map[string]any{"values": templates, "total": len(templates)})
}

func (h *TemplateHandler) Get(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	detail, err := h.repo.Get(c.Request().Context(), id)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "template not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "template detail failed")
	}
	return c.JSON(http.StatusOK, detail)
}

func (h *TemplateHandler) Create(c echo.Context) error {
	var req createTemplateRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "template create failed")
	}
	defer func() { _ = tx.Rollback() }()

	tasks := []casetemplate.CreateTemplateTask{}
	for _, t := range req.Tasks {
		tasks = append(tasks, casetemplate.CreateTemplateTask{
			Title: t.Title, Description: t.Description, GroupName: t.GroupName, OrderIndex: t.OrderIndex,
		})
	}
	cfs := []casetemplate.CreateTemplateCustomField{}
	for _, cf := range req.CustomFields {
		cfs = append(cfs, casetemplate.CreateTemplateCustomField{
			FieldName: cf.FieldName, FieldType: cf.FieldType, DefaultValue: cf.DefaultValue, FieldOrder: cf.FieldOrder,
		})
	}

	detail, err := h.repo.Create(c.Request().Context(), tx, casetemplate.CreateTemplate{
		Name: req.Name, DisplayName: req.DisplayName, TitlePrefix: req.TitlePrefix,
		Description: req.Description, Severity: req.Severity, TLP: req.TLP, PAP: req.PAP,
		Tags: req.Tags, CreatedBy: actorLogin(c), Tasks: tasks, CustomFields: cfs,
	})
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "template.create", "case_template", detail.Template.ID, nil, detail))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "template create failed")
	}
	return c.JSON(http.StatusCreated, detail)
}

type patchTemplateRequest struct {
	DisplayName *string  `json:"display_name"`
	TitlePrefix *string  `json:"title_prefix"`
	Description *string  `json:"description"`
	Severity    *int     `json:"severity"`
	TLP         *int     `json:"tlp"`
	PAP         *int     `json:"pap"`
	Tags        []string `json:"tags"`
}

func (h *TemplateHandler) Patch(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var req patchTemplateRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "template patch failed")
	}
	defer func() { _ = tx.Rollback() }()

	detail, err := h.repo.Patch(c.Request().Context(), tx, id, casetemplate.PatchTemplate{
		DisplayName: req.DisplayName,
		TitlePrefix: req.TitlePrefix,
		Description: req.Description,
		Severity:    req.Severity,
		TLP:         req.TLP,
		PAP:         req.PAP,
		Tags:        req.Tags,
		TagsSet:     req.Tags != nil,
	})
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "template not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "template patch failed")
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "template.update", "case_template", id, nil, detail))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "template patch failed")
	}
	return c.JSON(http.StatusOK, detail)
}

func (h *TemplateHandler) Delete(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "template delete failed")
	}
	defer func() { _ = tx.Rollback() }()
	if err := h.repo.Delete(c.Request().Context(), tx, id); err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "template not found")
	} else if err != nil {
		return apierr.New(http.StatusInternalServerError, "template delete failed")
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "template.delete", "case_template", id, map[string]string{"id": id}, nil))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "template delete failed")
	}
	return c.JSON(http.StatusOK, map[string]string{"id": id, "status": "deleted"})
}

type createCaseFromTemplateRequest struct {
	TemplateName string   `json:"template_name" validate:"required"`
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	Assignee     string   `json:"assignee"`
	Tags         []string `json:"tags"`
}

func (h *TemplateHandler) CreateCaseFromTemplate(c echo.Context) error {
	var req createCaseFromTemplateRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case from template failed")
	}
	defer func() { _ = tx.Rollback() }()

	tplDetail, err := h.repo.GetByName(c.Request().Context(), req.TemplateName)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "template not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case from template failed")
	}

	tpl := tplDetail.Template
	title := req.Title
	if title == "" {
		title = tpl.TitlePrefix + tpl.DisplayName
	}
	if tpl.TitlePrefix != "" && !strings.HasPrefix(title, tpl.TitlePrefix) {
		title = tpl.TitlePrefix + title
	}

	desc := req.Description
	if desc == "" {
		desc = tpl.Description
	}
	tags := req.Tags
	if len(tags) == 0 {
		tags = tpl.Tags
	} else {
		seen := map[string]bool{}
		merged := []string{}
		for _, t := range tags {
			if !seen[t] {
				seen[t] = true
				merged = append(merged, t)
			}
		}
		for _, t := range tpl.Tags {
			if !seen[t] {
				seen[t] = true
				merged = append(merged, t)
			}
		}
		tags = merged
	}

	created, err := h.caseRepo.Create(c.Request().Context(), tx, casewrite.CreateCase{
		Title: title, Description: desc, Severity: tpl.Severity, TLP: tpl.TLP, PAP: tpl.PAP,
		Owner: actorLogin(c), Assignee: req.Assignee, Tags: tags,
		CaseTemplate: tpl.Name,
	})
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}

	for _, task := range tplDetail.Tasks {
		gn := task.GroupName
		if gn == "" {
			gn = "default"
		}
		if _, err := h.workRepo.CreateTask(c.Request().Context(), tx, workwrite.CreateTask{
			CaseID: created.ID, Title: task.Title, Description: task.Description,
			GroupName: gn, OrderIndex: task.OrderIndex,
		}); err != nil {
			return apierr.New(http.StatusInternalServerError, "case from template: task create failed")
		}
	}

	for _, cf := range tplDetail.CustomFields {
		_, err := tx.ExecContext(c.Request().Context(), `
			INSERT INTO custom_fields (owner_type, owner_id, name, value, field_type, field_order, string_value)
			VALUES ('case', $1::uuid, $2, to_jsonb($3::text), $4, $5, $3)
			ON CONFLICT (owner_type, owner_id, name) DO NOTHING`,
			created.ID, cf.FieldName, cf.DefaultValue, cf.FieldType, cf.FieldOrder)
		if err != nil {
			return apierr.New(http.StatusInternalServerError, "case from template: custom field create failed")
		}
	}

	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "case.create_from_template", "case", created.ID, nil, map[string]any{
			"case": created, "template": tpl.Name,
		}))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "case from template failed")
	}
	return c.JSON(http.StatusCreated, created)
}

// Ensure pq is used to avoid import cycle issues.
var _ = pq.Array
