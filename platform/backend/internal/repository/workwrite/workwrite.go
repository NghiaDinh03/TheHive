package workwrite

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
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
	ID              string         `db:"id" json:"id"`
	CaseID          string         `db:"case_id" json:"case_id"`
	Title           string         `db:"title" json:"title"`
	Description     string         `db:"description" json:"description"`
	Status          string         `db:"status" json:"status"`
	Assignee        string         `db:"assignee" json:"assignee"`
	GroupName       string         `db:"group_name" json:"group_name"`
	OrderIndex      int            `db:"order_index" json:"order_index"`
	Flag            bool           `db:"flag" json:"flag"`
	StartDate       *time.Time     `db:"start_date" json:"start_date,omitempty"`
	EndDate         *time.Time     `db:"end_date" json:"end_date,omitempty"`
	DueDate         *time.Time     `db:"due_date" json:"due_date,omitempty"`
	OrganisationIDs pq.StringArray `db:"organisation_ids" json:"organisation_ids"`
	CreatedAt       time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time      `db:"updated_at" json:"updated_at"`
}

const taskSelectColumns = `id::text AS id, case_id::text AS case_id, title, description, status, assignee, group_name, order_index, flag, start_date, end_date, due_date, organisation_ids, created_at, updated_at`

type CreateTask struct {
	CaseID          string
	Title           string
	Description     string
	Assignee        string
	GroupName       string
	OrderIndex      int
	Flag            bool
	DueDate         *time.Time
	StartDate       *time.Time
	OrganisationIDs []string
}

type PatchTask struct {
	Title              *string
	Description        *string
	Status             *string
	Assignee           *string
	GroupName          *string
	OrderIndex         *int
	Flag               *bool
	StartDate          *time.Time
	EndDate            *time.Time
	DueDate            *time.Time
	OrganisationIDs    []string
	OrganisationIDsSet bool
	StartDateSet       bool
	EndDateSet         bool
	DueDateSet         bool
}

type BulkTaskResult struct {
	Updated []Task `json:"updated"`
	Total   int    `json:"total"`
}

type ReorderTaskInput struct {
	ID         string `json:"id"`
	GroupName  string `json:"group_name"`
	OrderIndex int    `json:"order_index"`
}

type BulkCloseTasksInput struct {
	CaseID  string
	TaskIDs []string
}

type BulkAssignTasksInput struct {
	CaseID   string
	TaskIDs  []string
	Assignee string
}

func filterNonEmptyIDs(ids []string) []string {
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if strings.TrimSpace(id) != "" {
			out = append(out, strings.TrimSpace(id))
		}
	}
	return out
}

type CaseLog struct {
	ID           string         `db:"id" json:"id"`
	CaseID       string         `db:"case_id" json:"case_id"`
	TaskID       sql.NullString `db:"task_id" json:"-"`
	AttachmentID sql.NullString `db:"attachment_id" json:"-"`
	Message      string         `db:"message" json:"message"`
	CreatedBy    string         `db:"created_by" json:"created_by"`
	CreatedAt    time.Time      `db:"created_at" json:"created_at"`
}

type CaseLogResponse struct {
	ID           string    `json:"id"`
	CaseID       string    `json:"case_id"`
	TaskID       string    `json:"task_id,omitempty"`
	AttachmentID string    `json:"attachment_id,omitempty"`
	Message      string    `json:"message"`
	CreatedBy    string    `json:"created_by"`
	CreatedAt    time.Time `json:"created_at"`
}

func (l CaseLog) Response() CaseLogResponse {
	return CaseLogResponse{
		ID:           l.ID,
		CaseID:       l.CaseID,
		TaskID:       l.TaskID.String,
		AttachmentID: l.AttachmentID.String,
		Message:      l.Message,
		CreatedBy:    l.CreatedBy,
		CreatedAt:    l.CreatedAt,
	}
}

type Observable struct {
	ID                  string         `db:"id" json:"id"`
	CaseID              sql.NullString `db:"case_id" json:"-"`
	AlertID             sql.NullString `db:"alert_id" json:"-"`
	SourceObservableID  sql.NullString `db:"source_observable_id" json:"-"`
	ImportedFromAlertID sql.NullString `db:"imported_from_alert_id" json:"-"`
	DataType            string         `db:"data_type" json:"data_type"`
	Data                string         `db:"data" json:"data"`
	Message             string         `db:"message" json:"message"`
	TLP                 int            `db:"tlp" json:"tlp"`
	IOC                 bool           `db:"ioc" json:"ioc"`
	Sighted             bool           `db:"sighted" json:"sighted"`
	IgnoreSimilarity    bool           `db:"ignore_similarity" json:"ignore_similarity"`
	AttachmentID        sql.NullString `db:"attachment_id" json:"-"`
	FullData            sql.NullString `db:"full_data" json:"-"`
	DataHash            string         `db:"data_hash" json:"data_hash"`
	Tags                pq.StringArray `db:"tags" json:"tags"`
	CreatedBy           string         `db:"created_by" json:"created_by"`
	CreatedAt           time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt           time.Time      `db:"updated_at" json:"updated_at"`
}

type ObservableResponse struct {
	ID                  string         `json:"id"`
	CaseID              string         `json:"case_id,omitempty"`
	AlertID             string         `json:"alert_id,omitempty"`
	SourceObservableID  string         `json:"source_observable_id,omitempty"`
	ImportedFromAlertID string         `json:"imported_from_alert_id,omitempty"`
	DataType            string         `json:"data_type"`
	Data                string         `json:"data"`
	Message             string         `json:"message"`
	TLP                 int            `json:"tlp"`
	IOC                 bool           `json:"ioc"`
	Sighted             bool           `json:"sighted"`
	IgnoreSimilarity    bool           `json:"ignore_similarity"`
	AttachmentID        string         `json:"attachment_id,omitempty"`
	FullData            string         `json:"full_data,omitempty"`
	DataHash            string         `json:"data_hash,omitempty"`
	Tags                pq.StringArray `json:"tags"`
	CreatedBy           string         `json:"created_by"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
}

type CreateObservable struct {
	CaseID       string
	AlertID      string
	DataType     string
	Data         string
	Message      string
	TLP          int
	IOC          bool
	Sighted      bool
	AttachmentID string
	Tags         []string
	CreatedBy    string
}

type PatchObservable struct {
	DataType         *string
	Data             *string
	Message          *string
	TLP              *int
	IOC              *bool
	Sighted          *bool
	IgnoreSimilarity *bool
	Tags             []string
	TagsSet          bool
}

type AnalyzeResult struct {
	JobID        string    `db:"job_id" json:"job_id"`
	ObservableID string    `db:"observable_id" json:"observable_id"`
	AnalyzerID   string    `db:"analyzer_id" json:"analyzer_id"`
	Status       string    `db:"status" json:"status"`
	Message      string    `db:"message" json:"message"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

func (o Observable) Response() ObservableResponse {
	out := ObservableResponse{ID: o.ID, DataType: o.DataType, Data: o.Data, Message: o.Message, TLP: o.TLP, IOC: o.IOC, Sighted: o.Sighted, IgnoreSimilarity: o.IgnoreSimilarity, Tags: o.Tags, CreatedBy: o.CreatedBy, CreatedAt: o.CreatedAt, UpdatedAt: o.UpdatedAt}
	if o.CaseID.Valid {
		out.CaseID = o.CaseID.String
	}
	if o.AlertID.Valid {
		out.AlertID = o.AlertID.String
	}
	if o.SourceObservableID.Valid {
		out.SourceObservableID = o.SourceObservableID.String
	}
	if o.ImportedFromAlertID.Valid {
		out.ImportedFromAlertID = o.ImportedFromAlertID.String
	}
	if o.AttachmentID.Valid {
		out.AttachmentID = o.AttachmentID.String
	}
	if o.FullData.Valid {
		out.FullData = o.FullData.String
	}
	out.DataHash = o.DataHash
	return out
}

const observableHashToIndexThreshold = 1024

func hashObservableData(data string) (indexedData string, fullData string, dataHash string) {
	data = strings.TrimSpace(data)
	if data == "" {
		return "", "", ""
	}
	sum := sha256.Sum256([]byte(data))
	dataHash = "sha256:" + hex.EncodeToString(sum[:])
	if len(data) > observableHashToIndexThreshold {
		return dataHash, data, dataHash
	}
	return data, "", dataHash
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
		INSERT INTO task_items (case_id, title, description, status, assignee, group_name, order_index, flag, start_date, due_date, organisation_ids)
		VALUES ($1::uuid, $2, $3, 'Waiting', $4, $5, $6, $7, $8, $9, $10)
		RETURNING `+taskSelectColumns,
		strings.TrimSpace(input.CaseID), strings.TrimSpace(input.Title), input.Description,
		strings.TrimSpace(input.Assignee), strings.TrimSpace(input.GroupName), input.OrderIndex,
		input.Flag, input.StartDate, input.DueDate, pq.Array(input.OrganisationIDs))
	return row, err
}

func (r *Repository) GetTask(ctx context.Context, tx *sqlx.Tx, id string) (Task, error) {
	row := Task{}
	err := tx.GetContext(ctx, &row, `SELECT `+taskSelectColumns+` FROM task_items WHERE id = $1::uuid`, strings.TrimSpace(id))
	return row, err
}

// validTaskStatuses follows TheHive 4 Task lifecycle: Waiting, InProgress, Completed, Cancel.
var validTaskStatuses = map[string]bool{"Waiting": true, "InProgress": true, "Completed": true, "Cancel": true}

func (r *Repository) PatchTask(ctx context.Context, tx *sqlx.Tx, id string, input PatchTask) (Task, error) {
	current, err := r.GetTask(ctx, tx, id)
	if err != nil {
		return Task{}, err
	}
	if input.Title != nil {
		current.Title = strings.TrimSpace(*input.Title)
	}
	if input.Description != nil {
		current.Description = *input.Description
	}
	if input.Status != nil {
		next := strings.TrimSpace(*input.Status)
		if next != "" && !validTaskStatuses[next] {
			return Task{}, fmt.Errorf("invalid task status %q (allowed: Waiting, InProgress, Completed, Cancel)", next)
		}
		current.Status = next
		// Mirror legacy behaviour: completing/cancelling fills end_date if missing.
		if (next == "Completed" || next == "Cancel") && current.EndDate == nil {
			now := time.Now().UTC()
			current.EndDate = &now
		}
		// InProgress sets a start date when first transitioning.
		if next == "InProgress" && current.StartDate == nil {
			now := time.Now().UTC()
			current.StartDate = &now
		}
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
	if input.Flag != nil {
		current.Flag = *input.Flag
	}
	if input.StartDateSet {
		current.StartDate = input.StartDate
	}
	if input.EndDateSet {
		current.EndDate = input.EndDate
	}
	if input.DueDateSet {
		current.DueDate = input.DueDate
	}
	if input.OrganisationIDsSet {
		current.OrganisationIDs = input.OrganisationIDs
	}
	row := Task{}
	err = tx.GetContext(ctx, &row, `
		UPDATE task_items
		SET title = $1, description = $2, status = $3, assignee = $4, group_name = $5, order_index = $6,
			flag = $7, start_date = $8, end_date = $9, due_date = $10, organisation_ids = $11, updated_at = now()
		WHERE id = $12::uuid
		RETURNING `+taskSelectColumns,
		current.Title, current.Description, current.Status, current.Assignee, current.GroupName, current.OrderIndex,
		current.Flag, current.StartDate, current.EndDate, current.DueDate, pq.Array([]string(current.OrganisationIDs)), strings.TrimSpace(id))
	return row, err
}

func (r *Repository) AssignTask(ctx context.Context, tx *sqlx.Tx, id string, assignee string) (Task, error) {
	return r.PatchTask(ctx, tx, id, PatchTask{Assignee: &assignee})
}

func (r *Repository) ReorderTasks(ctx context.Context, tx *sqlx.Tx, caseID string, items []ReorderTaskInput) (BulkTaskResult, error) {
	if strings.TrimSpace(caseID) == "" {
		return BulkTaskResult{}, fmt.Errorf("case_id is required")
	}
	updated := make([]Task, 0, len(items))
	for _, item := range items {
		id := strings.TrimSpace(item.ID)
		if id == "" {
			continue
		}
		groupName := strings.TrimSpace(item.GroupName)
		if groupName == "" {
			groupName = "default"
		}
		row := Task{}
		if err := tx.GetContext(ctx, &row, `
			UPDATE task_items
			SET group_name = $1, order_index = $2, updated_at = now()
			WHERE id = $3::uuid AND case_id = $4::uuid
			RETURNING `+taskSelectColumns, groupName, item.OrderIndex, id, strings.TrimSpace(caseID)); err != nil {
			return BulkTaskResult{}, err
		}
		updated = append(updated, row)
	}
	return BulkTaskResult{Updated: updated, Total: len(updated)}, nil
}

func (r *Repository) BulkCloseTasks(ctx context.Context, tx *sqlx.Tx, input BulkCloseTasksInput) (BulkTaskResult, error) {
	if strings.TrimSpace(input.CaseID) == "" && len(filterNonEmptyIDs(input.TaskIDs)) == 0 {
		return BulkTaskResult{}, fmt.Errorf("case_id or task_ids is required")
	}
	args := []any{}
	where := ""
	ids := filterNonEmptyIDs(input.TaskIDs)
	if len(ids) > 0 {
		args = append(args, pq.Array(ids))
		where = "id = ANY($1::uuid[])"
	} else {
		args = append(args, strings.TrimSpace(input.CaseID))
		where = "case_id = $1::uuid"
	}
	rows := []Task{}
	err := tx.SelectContext(ctx, &rows, `
		UPDATE task_items
		SET status = CASE WHEN status = 'InProgress' THEN 'Completed' WHEN status = 'Waiting' THEN 'Cancel' ELSE status END,
			end_date = CASE WHEN status IN ('Waiting', 'InProgress') AND end_date IS NULL THEN now() ELSE end_date END,
			updated_at = now()
		WHERE `+where+` AND status IN ('Waiting', 'InProgress')
		RETURNING `+taskSelectColumns, args...)
	if err != nil {
		return BulkTaskResult{}, err
	}
	return BulkTaskResult{Updated: rows, Total: len(rows)}, nil
}

func (r *Repository) BulkAssignTasks(ctx context.Context, tx *sqlx.Tx, input BulkAssignTasksInput) (BulkTaskResult, error) {
	assignee := strings.TrimSpace(input.Assignee)
	if assignee == "" {
		return BulkTaskResult{}, fmt.Errorf("assignee is required")
	}
	if strings.TrimSpace(input.CaseID) == "" && len(filterNonEmptyIDs(input.TaskIDs)) == 0 {
		return BulkTaskResult{}, fmt.Errorf("case_id or task_ids is required")
	}
	args := []any{assignee}
	where := ""
	ids := filterNonEmptyIDs(input.TaskIDs)
	if len(ids) > 0 {
		args = append(args, pq.Array(ids))
		where = "id = ANY($2::uuid[])"
	} else {
		args = append(args, strings.TrimSpace(input.CaseID))
		where = "case_id = $2::uuid"
	}
	rows := []Task{}
	err := tx.SelectContext(ctx, &rows, `
		UPDATE task_items
		SET assignee = $1, updated_at = now()
		WHERE `+where+`
		RETURNING `+taskSelectColumns, args...)
	if err != nil {
		return BulkTaskResult{}, err
	}
	return BulkTaskResult{Updated: rows, Total: len(rows)}, nil
}

func (r *Repository) CloseTask(ctx context.Context, tx *sqlx.Tx, id string) (Task, error) {
	status := "Completed"
	return r.PatchTask(ctx, tx, id, PatchTask{Status: &status})
}

func (r *Repository) ReopenTask(ctx context.Context, tx *sqlx.Tx, id string) (Task, error) {
	status := "Waiting"
	return r.PatchTask(ctx, tx, id, PatchTask{Status: &status})
}

func (r *Repository) StartTask(ctx context.Context, tx *sqlx.Tx, id string) (Task, error) {
	status := "InProgress"
	return r.PatchTask(ctx, tx, id, PatchTask{Status: &status})
}

func (r *Repository) CancelTask(ctx context.Context, tx *sqlx.Tx, id string) (Task, error) {
	status := "Cancel"
	return r.PatchTask(ctx, tx, id, PatchTask{Status: &status})
}

func (r *Repository) AppendCaseLog(ctx context.Context, tx *sqlx.Tx, caseID string, taskID string, attachmentID string, message string, createdBy string) (CaseLogResponse, error) {
	if strings.TrimSpace(caseID) == "" || strings.TrimSpace(message) == "" {
		return CaseLogResponse{}, fmt.Errorf("case_id and message are required")
	}
	row := CaseLog{}
	err := tx.GetContext(ctx, &row, `
		INSERT INTO case_logs (case_id, task_id, attachment_id, message, created_by)
		VALUES ($1::uuid, NULLIF($2, '')::uuid, NULLIF($3, '')::uuid, $4, $5)
		RETURNING id::text AS id, case_id::text AS case_id, task_id::text AS task_id, attachment_id::text AS attachment_id, message, created_by, created_at`,
		strings.TrimSpace(caseID), strings.TrimSpace(taskID), strings.TrimSpace(attachmentID), message, strings.TrimSpace(createdBy))
	return row.Response(), err
}

func (r *Repository) CreateObservable(ctx context.Context, tx *sqlx.Tx, input CreateObservable) (ObservableResponse, error) {
	if strings.TrimSpace(input.DataType) == "" || strings.TrimSpace(input.Data) == "" {
		return ObservableResponse{}, fmt.Errorf("data_type and data are required")
	}
	if strings.TrimSpace(input.CaseID) == "" && strings.TrimSpace(input.AlertID) == "" {
		return ObservableResponse{}, fmt.Errorf("case_id or alert_id is required")
	}
	if input.TLP == 0 {
		input.TLP = 2
	}
	indexedData, fullData, dataHash := hashObservableData(input.Data)
	row := Observable{}
	if strings.TrimSpace(input.CaseID) != "" {
		err := tx.GetContext(ctx, &row, `
			INSERT INTO observables (case_id, data_type, data, full_data, data_hash, message, tlp, ioc, sighted, attachment_id, tags, created_by)
			VALUES ($1::uuid, $2, $3, NULLIF($4, ''), $5, $6, $7, $8, $9, NULLIF($10, '')::uuid, $11, $12)
			ON CONFLICT (case_id, lower(data_type), lower(data)) WHERE case_id IS NOT NULL DO UPDATE SET
				full_data = EXCLUDED.full_data,
				data_hash = EXCLUDED.data_hash,
				message = EXCLUDED.message,
				tlp = EXCLUDED.tlp,
				ioc = EXCLUDED.ioc,
				sighted = EXCLUDED.sighted,
				attachment_id = COALESCE(EXCLUDED.attachment_id, observables.attachment_id),
				tags = EXCLUDED.tags,
				updated_at = now()
			RETURNING id::text AS id, case_id::text AS case_id, alert_id::text AS alert_id, source_observable_id::text AS source_observable_id, imported_from_alert_id::text AS imported_from_alert_id, attachment_id::text AS attachment_id, COALESCE(full_data, '') AS full_data, data_hash, data_type, data, message, tlp, ioc, sighted, ignore_similarity, tags, created_by, created_at, updated_at`, strings.TrimSpace(input.CaseID), strings.TrimSpace(input.DataType), indexedData, fullData, dataHash, input.Message, input.TLP, input.IOC, input.Sighted, strings.TrimSpace(input.AttachmentID), pq.Array(input.Tags), strings.TrimSpace(input.CreatedBy))
		return row.Response(), err
	}
	err := tx.GetContext(ctx, &row, `
		INSERT INTO observables (alert_id, data_type, data, full_data, data_hash, message, tlp, ioc, sighted, attachment_id, tags, created_by, lineage)
		VALUES ($1::uuid, $2, $3, NULLIF($4, ''), $5, $6, $7, $8, $9, NULLIF($10, '')::uuid, $11, $12, jsonb_build_object('source', 'alert_observable', 'alert_id', $1::text))
		RETURNING id::text AS id, case_id::text AS case_id, alert_id::text AS alert_id, source_observable_id::text AS source_observable_id, imported_from_alert_id::text AS imported_from_alert_id, attachment_id::text AS attachment_id, COALESCE(full_data, '') AS full_data, data_hash, data_type, data, message, tlp, ioc, sighted, ignore_similarity, tags, created_by, created_at, updated_at`, strings.TrimSpace(input.AlertID), strings.TrimSpace(input.DataType), indexedData, fullData, dataHash, input.Message, input.TLP, input.IOC, input.Sighted, strings.TrimSpace(input.AttachmentID), pq.Array(input.Tags), strings.TrimSpace(input.CreatedBy))
	return row.Response(), err
}

func (r *Repository) GetObservable(ctx context.Context, tx *sqlx.Tx, id string) (Observable, error) {
	row := Observable{}
	err := tx.GetContext(ctx, &row, `SELECT id::text AS id, case_id::text AS case_id, alert_id::text AS alert_id, source_observable_id::text AS source_observable_id, imported_from_alert_id::text AS imported_from_alert_id, attachment_id::text AS attachment_id, COALESCE(full_data, '') AS full_data, data_hash, data_type, data, message, tlp, ioc, sighted, ignore_similarity, tags, created_by, created_at, updated_at FROM observables WHERE id = $1::uuid`, strings.TrimSpace(id))
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
		current.Data, current.FullData.String, current.DataHash = hashObservableData(*input.Data)
		current.FullData.Valid = current.FullData.String != ""
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
	if input.IgnoreSimilarity != nil {
		current.IgnoreSimilarity = *input.IgnoreSimilarity
	}
	if input.TagsSet {
		current.Tags = input.Tags
	}
	row := Observable{}
	err = tx.GetContext(ctx, &row, `
		UPDATE observables SET data_type = $1, data = $2, full_data = NULLIF($3, ''), data_hash = $4, message = $5, tlp = $6, ioc = $7, sighted = $8, ignore_similarity = $9, tags = $10, updated_at = now()
		WHERE id = $11::uuid
		RETURNING id::text AS id, case_id::text AS case_id, alert_id::text AS alert_id, source_observable_id::text AS source_observable_id, imported_from_alert_id::text AS imported_from_alert_id, attachment_id::text AS attachment_id, COALESCE(full_data, '') AS full_data, data_hash, data_type, data, message, tlp, ioc, sighted, ignore_similarity, tags, created_by, created_at, updated_at`, current.DataType, current.Data, current.FullData.String, current.DataHash, current.Message, current.TLP, current.IOC, current.Sighted, current.IgnoreSimilarity, pq.Array([]string(current.Tags)), strings.TrimSpace(id))
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
	observable, err := r.GetObservable(ctx, tx, id)
	if err != nil {
		return AnalyzeResult{}, err
	}
	row := AnalyzeResult{}
	err = tx.GetContext(ctx, &row, `
		INSERT INTO cortex_jobs (observable_id, analyzer_id, status, request, created_by)
		VALUES ($1::uuid, 'placeholder', 'queued', jsonb_build_object('data_type', $2, 'data', $3), $4)
		RETURNING id::text AS job_id, observable_id::text AS observable_id, analyzer_id, status, 'Cortex analyzer job queued; worker execution lands in Phase 6.1' AS message, created_at`, strings.TrimSpace(id), observable.DataType, observable.Data, observable.CreatedBy)
	return row, err
}
