package workwrite

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

type Task struct {
	ID         string    `db:"id" json:"id"`
	CaseID     string    `db:"case_id" json:"case_id"`
	Title      string    `db:"title" json:"title"`
	Status     string    `db:"status" json:"status"`
	Assignee   string    `db:"assignee" json:"assignee"`
	GroupName  string    `db:"group_name" json:"group_name"`
	OrderIndex int       `db:"order_index" json:"order_index"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time `db:"updated_at" json:"updated_at"`
}

type CreateTask struct {
	CaseID     string
	Title      string
	Assignee   string
	GroupName  string
	OrderIndex int
}

type PatchTask struct {
	Title      *string
	Status     *string
	Assignee   *string
	GroupName  *string
	OrderIndex *int
}

type CaseLog struct {
	ID        string         `db:"id" json:"id"`
	CaseID    string         `db:"case_id" json:"case_id"`
	TaskID    sql.NullString `db:"task_id" json:"-"`
	Message   string         `db:"message" json:"message"`
	CreatedBy string         `db:"created_by" json:"created_by"`
	CreatedAt time.Time      `db:"created_at" json:"created_at"`
}

type CaseLogResponse struct {
	ID        string    `json:"id"`
	CaseID    string    `json:"case_id"`
	TaskID    string    `json:"task_id,omitempty"`
	Message   string    `json:"message"`
	CreatedBy string    `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
}

type Observable struct {
	ID        string         `db:"id" json:"id"`
	CaseID    sql.NullString `db:"case_id" json:"-"`
	DataType  string         `db:"data_type" json:"data_type"`
	Data      string         `db:"data" json:"data"`
	Message   string         `db:"message" json:"message"`
	TLP       int            `db:"tlp" json:"tlp"`
	IOC       bool           `db:"ioc" json:"ioc"`
	Sighted   bool           `db:"sighted" json:"sighted"`
	Tags      pq.StringArray `db:"tags" json:"tags"`
	CreatedBy string         `db:"created_by" json:"created_by"`
	CreatedAt time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt time.Time      `db:"updated_at" json:"updated_at"`
}

type ObservableResponse struct {
	ID        string         `json:"id"`
	CaseID    string         `json:"case_id,omitempty"`
	DataType  string         `json:"data_type"`
	Data      string         `json:"data"`
	Message   string         `json:"message"`
	TLP       int            `json:"tlp"`
	IOC       bool           `json:"ioc"`
	Sighted   bool           `json:"sighted"`
	Tags      pq.StringArray `json:"tags"`
	CreatedBy string         `json:"created_by"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
}

type CreateObservable struct {
	CaseID    string
	DataType  string
	Data      string
	Message   string
	TLP       int
	IOC       bool
	Sighted   bool
	Tags      []string
	CreatedBy string
}

type PatchObservable struct {
	DataType *string
	Data     *string
	Message  *string
	TLP      *int
	IOC      *bool
	Sighted  *bool
	Tags     []string
	TagsSet  bool
}

type AnalyzeResult struct {
	ObservableID string    `json:"observable_id"`
	Status       string    `json:"status"`
	Message      string    `json:"message"`
	CreatedAt    time.Time `json:"created_at"`
}

func (l CaseLog) Response() CaseLogResponse {
	out := CaseLogResponse{ID: l.ID, CaseID: l.CaseID, Message: l.Message, CreatedBy: l.CreatedBy, CreatedAt: l.CreatedAt}
	if l.TaskID.Valid {
		out.TaskID = l.TaskID.String
	}
	return out
}

func (o Observable) Response() ObservableResponse {
	out := ObservableResponse{ID: o.ID, DataType: o.DataType, Data: o.Data, Message: o.Message, TLP: o.TLP, IOC: o.IOC, Sighted: o.Sighted, Tags: o.Tags, CreatedBy: o.CreatedBy, CreatedAt: o.CreatedAt, UpdatedAt: o.UpdatedAt}
	if o.CaseID.Valid {
		out.CaseID = o.CaseID.String
	}
	return out
}

func (r *Repository) CreateTask(ctx context.Context, tx *sqlx.Tx, input CreateTask) (Task, error) {
	if strings.TrimSpace(input.CaseID) == "" || strings.TrimSpace(input.Title) == "" {
		return Task{}, fmt.Errorf("case_id and title are required")
	}
	if strings.TrimSpace(input.GroupName) == "" {
		input.GroupName = "default"
	}
	row := Task{}
	err := tx.GetContext(ctx, &row, `
		INSERT INTO task_items (case_id, title, status, assignee, group_name, order_index)
		VALUES ($1::uuid, $2, 'Waiting', $3, $4, $5)
		RETURNING id::text AS id, case_id::text AS case_id, title, status, assignee, group_name, order_index, created_at, updated_at`, strings.TrimSpace(input.CaseID), strings.TrimSpace(input.Title), strings.TrimSpace(input.Assignee), strings.TrimSpace(input.GroupName), input.OrderIndex)
	return row, err
}

func (r *Repository) GetTask(ctx context.Context, tx *sqlx.Tx, id string) (Task, error) {
	row := Task{}
	err := tx.GetContext(ctx, &row, `SELECT id::text AS id, case_id::text AS case_id, title, status, assignee, group_name, order_index, created_at, updated_at FROM task_items WHERE id = $1::uuid`, strings.TrimSpace(id))
	return row, err
}

func (r *Repository) PatchTask(ctx context.Context, tx *sqlx.Tx, id string, input PatchTask) (Task, error) {
	current, err := r.GetTask(ctx, tx, id)
	if err != nil {
		return Task{}, err
	}
	if input.Title != nil {
		current.Title = strings.TrimSpace(*input.Title)
	}
	if input.Status != nil {
		current.Status = strings.TrimSpace(*input.Status)
	}
	if input.Assignee != nil {
		current.Assignee = strings.TrimSpace(*input.Assignee)
	}
	if input.GroupName != nil {
		current.GroupName = strings.TrimSpace(*input.GroupName)
	}
	if current.GroupName == "" {
		current.GroupName = "default"
	}
	if input.OrderIndex != nil {
		current.OrderIndex = *input.OrderIndex
	}
	row := Task{}
	err = tx.GetContext(ctx, &row, `
		UPDATE task_items SET title = $1, status = $2, assignee = $3, group_name = $4, order_index = $5, updated_at = now()
		WHERE id = $6::uuid
		RETURNING id::text AS id, case_id::text AS case_id, title, status, assignee, group_name, order_index, created_at, updated_at`, current.Title, current.Status, current.Assignee, current.GroupName, current.OrderIndex, strings.TrimSpace(id))
	return row, err
}

func (r *Repository) AssignTask(ctx context.Context, tx *sqlx.Tx, id string, assignee string) (Task, error) {
	return r.PatchTask(ctx, tx, id, PatchTask{Assignee: &assignee})
}

func (r *Repository) CloseTask(ctx context.Context, tx *sqlx.Tx, id string) (Task, error) {
	status := "Completed"
	return r.PatchTask(ctx, tx, id, PatchTask{Status: &status})
}

func (r *Repository) AppendCaseLog(ctx context.Context, tx *sqlx.Tx, caseID string, taskID string, message string, createdBy string) (CaseLogResponse, error) {
	if strings.TrimSpace(caseID) == "" || strings.TrimSpace(message) == "" {
		return CaseLogResponse{}, fmt.Errorf("case_id and message are required")
	}
	row := CaseLog{}
	var err error
	if strings.TrimSpace(taskID) == "" {
		err = tx.GetContext(ctx, &row, `
			INSERT INTO case_logs (case_id, message, created_by)
			VALUES ($1::uuid, $2, $3)
			RETURNING id::text AS id, case_id::text AS case_id, task_id::text AS task_id, message, created_by, created_at`, strings.TrimSpace(caseID), message, strings.TrimSpace(createdBy))
	} else {
		err = tx.GetContext(ctx, &row, `
			INSERT INTO case_logs (case_id, task_id, message, created_by)
			VALUES ($1::uuid, $2::uuid, $3, $4)
			RETURNING id::text AS id, case_id::text AS case_id, task_id::text AS task_id, message, created_by, created_at`, strings.TrimSpace(caseID), strings.TrimSpace(taskID), message, strings.TrimSpace(createdBy))
	}
	return row.Response(), err
}

func (r *Repository) CreateObservable(ctx context.Context, tx *sqlx.Tx, input CreateObservable) (ObservableResponse, error) {
	if strings.TrimSpace(input.CaseID) == "" || strings.TrimSpace(input.DataType) == "" || strings.TrimSpace(input.Data) == "" {
		return ObservableResponse{}, fmt.Errorf("case_id, data_type and data are required")
	}
	if input.TLP == 0 {
		input.TLP = 2
	}
	row := Observable{}
	err := tx.GetContext(ctx, &row, `
		INSERT INTO observables (case_id, data_type, data, message, tlp, ioc, sighted, tags, created_by)
		VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id::text AS id, case_id::text AS case_id, data_type, data, message, tlp, ioc, sighted, tags, created_by, created_at, updated_at`, strings.TrimSpace(input.CaseID), strings.TrimSpace(input.DataType), strings.TrimSpace(input.Data), input.Message, input.TLP, input.IOC, input.Sighted, pq.Array(input.Tags), strings.TrimSpace(input.CreatedBy))
	return row.Response(), err
}

func (r *Repository) GetObservable(ctx context.Context, tx *sqlx.Tx, id string) (Observable, error) {
	row := Observable{}
	err := tx.GetContext(ctx, &row, `SELECT id::text AS id, case_id::text AS case_id, data_type, data, message, tlp, ioc, sighted, tags, created_by, created_at, updated_at FROM observables WHERE id = $1::uuid`, strings.TrimSpace(id))
	return row, err
}

func (r *Repository) PatchObservable(ctx context.Context, tx *sqlx.Tx, id string, input PatchObservable) (ObservableResponse, error) {
	current, err := r.GetObservable(ctx, tx, id)
	if err != nil {
		return ObservableResponse{}, err
	}
	if input.DataType != nil {
		current.DataType = strings.TrimSpace(*input.DataType)
	}
	if input.Data != nil {
		current.Data = strings.TrimSpace(*input.Data)
	}
	if input.Message != nil {
		current.Message = *input.Message
	}
	if input.TLP != nil {
		current.TLP = *input.TLP
	}
	if input.IOC != nil {
		current.IOC = *input.IOC
	}
	if input.Sighted != nil {
		current.Sighted = *input.Sighted
	}
	if input.TagsSet {
		current.Tags = input.Tags
	}
	row := Observable{}
	err = tx.GetContext(ctx, &row, `
		UPDATE observables SET data_type = $1, data = $2, message = $3, tlp = $4, ioc = $5, sighted = $6, tags = $7, updated_at = now()
		WHERE id = $8::uuid
		RETURNING id::text AS id, case_id::text AS case_id, data_type, data, message, tlp, ioc, sighted, tags, created_by, created_at, updated_at`, current.DataType, current.Data, current.Message, current.TLP, current.IOC, current.Sighted, pq.Array([]string(current.Tags)), strings.TrimSpace(id))
	return row.Response(), err
}

func (r *Repository) DeleteObservable(ctx context.Context, tx *sqlx.Tx, id string) (ObservableResponse, error) {
	before, err := r.GetObservable(ctx, tx, id)
	if err != nil {
		return ObservableResponse{}, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM observables WHERE id = $1::uuid`, strings.TrimSpace(id)); err != nil {
		return ObservableResponse{}, err
	}
	return before.Response(), nil
}

func (r *Repository) AnalyzeObservable(ctx context.Context, tx *sqlx.Tx, id string) (AnalyzeResult, error) {
	if _, err := r.GetObservable(ctx, tx, id); err != nil {
		return AnalyzeResult{}, err
	}
	return AnalyzeResult{ObservableID: strings.TrimSpace(id), Status: "queued-placeholder", Message: "Cortex analyzer queue placeholder; production worker lands in Phase 6.0", CreatedAt: time.Now().UTC()}, nil
}
