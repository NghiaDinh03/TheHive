package casetemplate

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

type Template struct {
	ID          string         `db:"id" json:"id"`
	Name        string         `db:"name" json:"name"`
	DisplayName string         `db:"display_name" json:"display_name"`
	TitlePrefix string         `db:"title_prefix" json:"title_prefix"`
	Description string         `db:"description" json:"description"`
	Severity    int            `db:"severity" json:"severity"`
	TLP         int            `db:"tlp" json:"tlp"`
	PAP         int            `db:"pap" json:"pap"`
	Tags        pq.StringArray `db:"tags" json:"tags"`
	CreatedBy   string         `db:"created_by" json:"created_by"`
	CreatedAt   time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time      `db:"updated_at" json:"updated_at"`
}

type TemplateTask struct {
	ID          string    `db:"id" json:"id"`
	TemplateID  string    `db:"template_id" json:"template_id"`
	Title       string    `db:"title" json:"title"`
	Description string    `db:"description" json:"description"`
	GroupName   string    `db:"group_name" json:"group_name"`
	OrderIndex  int       `db:"order_index" json:"order_index"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

type TemplateCustomField struct {
	ID           string    `db:"id" json:"id"`
	TemplateID   string    `db:"template_id" json:"template_id"`
	FieldName    string    `db:"field_name" json:"field_name"`
	FieldType    string    `db:"field_type" json:"field_type"`
	DefaultValue string    `db:"default_value" json:"default_value"`
	FieldOrder   int       `db:"field_order" json:"field_order"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

type TemplateDetail struct {
	Template     Template              `json:"template"`
	Tasks        []TemplateTask        `json:"tasks"`
	CustomFields []TemplateCustomField `json:"custom_fields"`
}

type CreateTemplate struct {
	Name         string
	DisplayName  string
	TitlePrefix  string
	Description  string
	Severity     int
	TLP          int
	PAP          int
	Tags         []string
	CreatedBy    string
	Tasks        []CreateTemplateTask
	CustomFields []CreateTemplateCustomField
}

type CreateTemplateTask struct {
	Title       string
	Description string
	GroupName   string
	OrderIndex  int
}

type CreateTemplateCustomField struct {
	FieldName    string
	FieldType    string
	DefaultValue string
	FieldOrder   int
}

// PatchTemplate holds optional fields for updating a case template.
type PatchTemplate struct {
	DisplayName *string
	TitlePrefix *string
	Description *string
	Severity    *int
	TLP         *int
	PAP         *int
	Tags        []string
	TagsSet     bool
}

const templateSelectColumns = `id::text AS id, name, display_name, title_prefix, description, severity, tlp, pap, tags, created_by, created_at, updated_at`

func (r *Repository) List(ctx context.Context) ([]Template, error) {
	rows := []Template{}
	err := r.db.SelectContext(ctx, &rows, `SELECT `+templateSelectColumns+` FROM case_templates ORDER BY name ASC`)
	return rows, err
}

func (r *Repository) Get(ctx context.Context, id string) (TemplateDetail, error) {
	tpl := Template{}
	if err := r.db.GetContext(ctx, &tpl, `SELECT `+templateSelectColumns+` FROM case_templates WHERE id = $1::uuid`, id); err == sql.ErrNoRows {
		return TemplateDetail{}, err
	} else if err != nil {
		return TemplateDetail{}, err
	}
	tasks := []TemplateTask{}
	_ = r.db.SelectContext(ctx, &tasks, `SELECT id::text AS id, template_id::text AS template_id, title, description, group_name, order_index, created_at FROM case_template_tasks WHERE template_id = $1::uuid ORDER BY order_index ASC, created_at ASC`, id)
	cfs := []TemplateCustomField{}
	_ = r.db.SelectContext(ctx, &cfs, `SELECT id::text AS id, template_id::text AS template_id, field_name, field_type, default_value, field_order, created_at FROM case_template_custom_fields WHERE template_id = $1::uuid ORDER BY field_order ASC, created_at ASC`, id)
	return TemplateDetail{Template: tpl, Tasks: tasks, CustomFields: cfs}, nil
}

func (r *Repository) GetByName(ctx context.Context, name string) (TemplateDetail, error) {
	tpl := Template{}
	if err := r.db.GetContext(ctx, &tpl, `SELECT `+templateSelectColumns+` FROM case_templates WHERE name = $1`, name); err != nil {
		return TemplateDetail{}, err
	}
	return r.Get(ctx, tpl.ID)
}

func (r *Repository) Create(ctx context.Context, tx *sqlx.Tx, input CreateTemplate) (TemplateDetail, error) {
	if strings.TrimSpace(input.Name) == "" {
		return TemplateDetail{}, fmt.Errorf("name is required")
	}
	if input.Severity == 0 {
		input.Severity = 2
	}
	if input.TLP == 0 {
		input.TLP = 2
	}
	if input.PAP == 0 {
		input.PAP = 2
	}
	tpl := Template{}
	err := tx.GetContext(ctx, &tpl, `
		INSERT INTO case_templates (name, display_name, title_prefix, description, severity, tlp, pap, tags, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING `+templateSelectColumns,
		strings.TrimSpace(input.Name), input.DisplayName, input.TitlePrefix, input.Description,
		input.Severity, input.TLP, input.PAP, pq.Array(input.Tags), input.CreatedBy)
	if err != nil {
		return TemplateDetail{}, err
	}
	tasks := []TemplateTask{}
	for _, t := range input.Tasks {
		gn := t.GroupName
		if gn == "" {
			gn = "default"
		}
		task := TemplateTask{}
		if err := tx.GetContext(ctx, &task, `
			INSERT INTO case_template_tasks (template_id, title, description, group_name, order_index)
			VALUES ($1::uuid, $2, $3, $4, $5)
			RETURNING id::text AS id, template_id::text AS template_id, title, description, group_name, order_index, created_at`,
			tpl.ID, t.Title, t.Description, gn, t.OrderIndex); err != nil {
			return TemplateDetail{}, err
		}
		tasks = append(tasks, task)
	}
	cfs := []TemplateCustomField{}
	for _, cf := range input.CustomFields {
		ft := cf.FieldType
		if ft == "" {
			ft = "string"
		}
		field := TemplateCustomField{}
		if err := tx.GetContext(ctx, &field, `
			INSERT INTO case_template_custom_fields (template_id, field_name, field_type, default_value, field_order)
			VALUES ($1::uuid, $2, $3, $4, $5)
			RETURNING id::text AS id, template_id::text AS template_id, field_name, field_type, default_value, field_order, created_at`,
			tpl.ID, cf.FieldName, ft, cf.DefaultValue, cf.FieldOrder); err != nil {
			return TemplateDetail{}, err
		}
		cfs = append(cfs, field)
	}
	return TemplateDetail{Template: tpl, Tasks: tasks, CustomFields: cfs}, nil
}

// Patch updates mutable fields on a case template. Only non-nil fields are applied.
func (r *Repository) Patch(ctx context.Context, tx *sqlx.Tx, id string, input PatchTemplate) (TemplateDetail, error) {
	setClauses := []string{"updated_at = now()"}
	args := []any{}
	argIdx := 1

	if input.DisplayName != nil {
		setClauses = append(setClauses, fmt.Sprintf("display_name = $%d", argIdx))
		args = append(args, *input.DisplayName)
		argIdx++
	}
	if input.TitlePrefix != nil {
		setClauses = append(setClauses, fmt.Sprintf("title_prefix = $%d", argIdx))
		args = append(args, *input.TitlePrefix)
		argIdx++
	}
	if input.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *input.Description)
		argIdx++
	}
	if input.Severity != nil {
		setClauses = append(setClauses, fmt.Sprintf("severity = $%d", argIdx))
		args = append(args, *input.Severity)
		argIdx++
	}
	if input.TLP != nil {
		setClauses = append(setClauses, fmt.Sprintf("tlp = $%d", argIdx))
		args = append(args, *input.TLP)
		argIdx++
	}
	if input.PAP != nil {
		setClauses = append(setClauses, fmt.Sprintf("pap = $%d", argIdx))
		args = append(args, *input.PAP)
		argIdx++
	}
	if input.TagsSet {
		setClauses = append(setClauses, fmt.Sprintf("tags = $%d", argIdx))
		args = append(args, pq.Array(input.Tags))
		argIdx++
	}

	args = append(args, id)
	query := fmt.Sprintf(`UPDATE case_templates SET %s WHERE id = $%d`, strings.Join(setClauses, ", "), argIdx)
	result, err := tx.ExecContext(ctx, query, args...)
	if err != nil {
		return TemplateDetail{}, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return TemplateDetail{}, sql.ErrNoRows
	}
	return r.Get(ctx, id)
}

func (r *Repository) Delete(ctx context.Context, tx *sqlx.Tx, id string) error {
	result, err := tx.ExecContext(ctx, `DELETE FROM case_templates WHERE id = $1::uuid`, id)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
