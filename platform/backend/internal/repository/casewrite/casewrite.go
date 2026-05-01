package casewrite

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

type Case struct {
	ID                 string         `db:"id" json:"id"`
	Number             int            `db:"number" json:"number"`
	Title              string         `db:"title" json:"title"`
	Description        string         `db:"description" json:"description"`
	Severity           int            `db:"severity" json:"severity"`
	TLP                int            `db:"tlp" json:"tlp"`
	PAP                int            `db:"pap" json:"pap"`
	Status             string         `db:"status" json:"status"`
	Owner              string         `db:"owner" json:"owner"`
	Assignee           string         `db:"assignee" json:"assignee"`
	Tags               pq.StringArray `db:"tags" json:"tags"`
	Flag               bool           `db:"flag" json:"flag"`
	Summary            string         `db:"summary" json:"summary"`
	ImpactStatus       string         `db:"impact_status" json:"impact_status"`
	ResolutionStatus   string         `db:"resolution_status" json:"resolution_status"`
	CaseTemplate       string         `db:"case_template" json:"case_template"`
	OwningOrganisation string         `db:"owning_organisation" json:"owning_organisation"`
	OrganisationIDs    pq.StringArray `db:"organisation_ids" json:"organisation_ids"`
	StartDate          *time.Time     `db:"start_date" json:"start_date,omitempty"`
	EndDate            *time.Time     `db:"end_date" json:"end_date,omitempty"`
	CreatedAt          time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt          time.Time      `db:"updated_at" json:"updated_at"`
}

const caseSelectColumns = `id::text AS id, number, title, description, severity, tlp, pap, status, owner, assignee, tags, flag, summary, impact_status, resolution_status, case_template, owning_organisation, organisation_ids, start_date, end_date, created_at, updated_at`

type CreateCase struct {
	Title              string
	Description        string
	Severity           int
	TLP                int
	PAP                int
	Owner              string
	Assignee           string
	Tags               []string
	Flag               bool
	Summary            string
	ImpactStatus       string
	ResolutionStatus   string
	CaseTemplate       string
	OwningOrganisation string
	OrganisationIDs    []string
}

type PatchCase struct {
	Title              *string
	Description        *string
	Severity           *int
	TLP                *int
	PAP                *int
	Assignee           *string
	Tags               []string
	TagsSet            bool
	Flag               *bool
	Summary            *string
	ImpactStatus       *string
	ResolutionStatus   *string
	CaseTemplate       *string
	OwningOrganisation *string
	OrganisationIDs    []string
	OrganisationIDsSet bool
}

type CloseCase struct {
	ImpactStatus     string
	ResolutionStatus string
	Summary          string
}

func (r *Repository) Create(ctx context.Context, tx *sqlx.Tx, input CreateCase) (Case, error) {
	if strings.TrimSpace(input.Title) == "" {
		return Case{}, fmt.Errorf("title is required")
	}
	input = defaultCreate(input)
	row := Case{}
	err := tx.GetContext(ctx, &row, `
		INSERT INTO cases (number, title, description, severity, tlp, pap, status, owner, assignee, tags, flag, summary, impact_status, resolution_status, case_template, owning_organisation, organisation_ids)
		VALUES ((SELECT COALESCE(MAX(number), 0) + 1 FROM cases), $1, $2, $3, $4, $5, 'Open', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING `+caseSelectColumns,
		input.Title, input.Description, input.Severity, input.TLP, input.PAP, input.Owner, input.Assignee, pq.Array(input.Tags),
		input.Flag, input.Summary, input.ImpactStatus, input.ResolutionStatus, input.CaseTemplate, input.OwningOrganisation, pq.Array(input.OrganisationIDs))
	return row, err
}

func (r *Repository) Patch(ctx context.Context, tx *sqlx.Tx, id string, input PatchCase) (Case, error) {
	current, err := r.Get(ctx, tx, id)
	if err != nil {
		return Case{}, err
	}
	if input.Title != nil {
		current.Title = strings.TrimSpace(*input.Title)
	}
	if input.Description != nil {
		current.Description = *input.Description
	}
	if input.Severity != nil {
		current.Severity = *input.Severity
	}
	if input.TLP != nil {
		current.TLP = *input.TLP
	}
	if input.PAP != nil {
		current.PAP = *input.PAP
	}
	if input.Assignee != nil {
		current.Assignee = strings.TrimSpace(*input.Assignee)
	}
	if input.TagsSet {
		current.Tags = input.Tags
	}
	if input.Flag != nil {
		current.Flag = *input.Flag
	}
	if input.Summary != nil {
		current.Summary = *input.Summary
	}
	if input.ImpactStatus != nil {
		current.ImpactStatus = strings.TrimSpace(*input.ImpactStatus)
	}
	if input.ResolutionStatus != nil {
		current.ResolutionStatus = strings.TrimSpace(*input.ResolutionStatus)
	}
	if input.CaseTemplate != nil {
		current.CaseTemplate = strings.TrimSpace(*input.CaseTemplate)
	}
	if input.OwningOrganisation != nil {
		current.OwningOrganisation = strings.TrimSpace(*input.OwningOrganisation)
	}
	if input.OrganisationIDsSet {
		current.OrganisationIDs = input.OrganisationIDs
	}
	row := Case{}
	err = tx.GetContext(ctx, &row, `
		UPDATE cases
		SET title = $1, description = $2, severity = $3, tlp = $4, pap = $5, assignee = $6, tags = $7,
			flag = $8, summary = $9, impact_status = $10, resolution_status = $11, case_template = $12,
			owning_organisation = $13, organisation_ids = $14, updated_at = now()
		WHERE id = $15::uuid
		RETURNING `+caseSelectColumns,
		current.Title, current.Description, current.Severity, current.TLP, current.PAP, current.Assignee, pq.Array([]string(current.Tags)),
		current.Flag, current.Summary, current.ImpactStatus, current.ResolutionStatus, current.CaseTemplate,
		current.OwningOrganisation, pq.Array([]string(current.OrganisationIDs)), id)
	return row, err
}

// Close resolves the case using TheHive 4 lifecycle: status becomes "Resolved",
// in-progress tasks become "Completed", waiting tasks become "Cancel", and end_date is set.
// impact/resolution/summary are persisted on the case row.
func (r *Repository) Close(ctx context.Context, tx *sqlx.Tx, id string, input CloseCase) (Case, error) {
	row := Case{}
	err := tx.GetContext(ctx, &row, `
		UPDATE cases
		SET status = 'Resolved',
			impact_status = COALESCE(NULLIF($1, ''), impact_status),
			resolution_status = COALESCE(NULLIF($2, ''), resolution_status),
			summary = COALESCE(NULLIF($3, ''), summary),
			end_date = now(),
			updated_at = now()
		WHERE id = $4::uuid
		RETURNING `+caseSelectColumns,
		strings.TrimSpace(input.ImpactStatus), strings.TrimSpace(input.ResolutionStatus), strings.TrimSpace(input.Summary), id)
	if err != nil {
		return Case{}, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE task_items SET status = 'Completed', end_date = now(), updated_at = now() WHERE case_id = $1::uuid AND status = 'InProgress'`, id); err != nil {
		return Case{}, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE task_items SET status = 'Cancel', end_date = now(), updated_at = now() WHERE case_id = $1::uuid AND status = 'Waiting'`, id); err != nil {
		return Case{}, err
	}
	return row, nil
}

// Reopen returns the case to Open, clears resolution metadata, and unsets end_date.
func (r *Repository) Reopen(ctx context.Context, tx *sqlx.Tx, id string) (Case, error) {
	row := Case{}
	err := tx.GetContext(ctx, &row, `
		UPDATE cases
		SET status = 'Open', end_date = NULL, impact_status = '', resolution_status = '', updated_at = now()
		WHERE id = $1::uuid
		RETURNING `+caseSelectColumns, id)
	return row, err
}

// MarkDuplicated transitions a case to TheHive 4 "Duplicated" status linked to a target case.
// The duplicate's tasks are cancelled and the target case's merged_from list is updated.
func (r *Repository) MarkDuplicated(ctx context.Context, tx *sqlx.Tx, sourceID, targetID string) (Case, error) {
	if strings.TrimSpace(targetID) == "" {
		return Case{}, fmt.Errorf("target case id is required")
	}
	row := Case{}
	err := tx.GetContext(ctx, &row, `
		UPDATE cases
		SET status = 'Duplicated', merged_into = $1::uuid, end_date = now(), updated_at = now()
		WHERE id = $2::uuid
		RETURNING `+caseSelectColumns, targetID, sourceID)
	if err != nil {
		return Case{}, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE cases SET merged_from = array_append(coalesce(merged_from, '{}'::uuid[]), $1::uuid), updated_at = now() WHERE id = $2::uuid`, sourceID, targetID); err != nil {
		return Case{}, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE task_items SET status = 'Cancel', end_date = now(), updated_at = now() WHERE case_id = $1::uuid AND status IN ('Waiting','InProgress')`, sourceID); err != nil {
		return Case{}, err
	}
	return row, nil
}

func (r *Repository) Delete(ctx context.Context, tx *sqlx.Tx, id string) (Case, error) {
	before, err := r.Get(ctx, tx, id)
	if err != nil {
		return Case{}, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM attachments WHERE case_id = $1::uuid`, id); err != nil {
		return Case{}, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM case_logs WHERE case_id = $1::uuid`, id); err != nil {
		return Case{}, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM task_items WHERE case_id = $1::uuid`, id); err != nil {
		return Case{}, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE alerts SET case_id = NULL, status = 'New', updated_at = now() WHERE case_id = $1::uuid`, id); err != nil {
		return Case{}, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM observables WHERE case_id = $1::uuid`, id); err != nil {
		return Case{}, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM custom_fields WHERE owner_type = 'case' AND owner_id = $1::uuid`, id); err != nil {
		return Case{}, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM cases WHERE id = $1::uuid`, id); err != nil {
		return Case{}, err
	}
	return before, nil
}

func (r *Repository) Get(ctx context.Context, tx *sqlx.Tx, id string) (Case, error) {
	row := Case{}
	err := tx.GetContext(ctx, &row, `SELECT `+caseSelectColumns+` FROM cases WHERE id = $1::uuid`, id)
	if err == sql.ErrNoRows {
		return Case{}, err
	}
	return row, err
}

func defaultCreate(input CreateCase) CreateCase {
	if input.Severity == 0 {
		input.Severity = 2
	}
	if input.TLP == 0 {
		input.TLP = 2
	}
	if input.PAP == 0 {
		input.PAP = 2
	}
	if input.Tags == nil {
		input.Tags = []string{}
	}
	if input.OrganisationIDs == nil {
		input.OrganisationIDs = []string{}
	}
	return input
}
