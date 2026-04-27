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
	ID          string         `db:"id" json:"id"`
	Number      int            `db:"number" json:"number"`
	Title       string         `db:"title" json:"title"`
	Description string         `db:"description" json:"description"`
	Severity    int            `db:"severity" json:"severity"`
	TLP         int            `db:"tlp" json:"tlp"`
	PAP         int            `db:"pap" json:"pap"`
	Status      string         `db:"status" json:"status"`
	Owner       string         `db:"owner" json:"owner"`
	Assignee    string         `db:"assignee" json:"assignee"`
	Tags        pq.StringArray `db:"tags" json:"tags"`
	CreatedAt   time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time      `db:"updated_at" json:"updated_at"`
}

type CreateCase struct {
	Title       string
	Description string
	Severity    int
	TLP         int
	PAP         int
	Owner       string
	Assignee    string
	Tags        []string
}

type PatchCase struct {
	Title       *string
	Description *string
	Severity    *int
	TLP         *int
	PAP         *int
	Assignee    *string
	Tags        []string
	TagsSet     bool
}

func (r *Repository) Create(ctx context.Context, tx *sqlx.Tx, input CreateCase) (Case, error) {
	if strings.TrimSpace(input.Title) == "" {
		return Case{}, fmt.Errorf("title is required")
	}
	input = defaultCreate(input)
	row := Case{}
	err := tx.GetContext(ctx, &row, `
		INSERT INTO cases (number, title, description, severity, tlp, pap, status, owner, assignee, tags)
		VALUES ((SELECT COALESCE(MAX(number), 0) + 1 FROM cases), $1, $2, $3, $4, $5, 'Open', $6, $7, $8)
		RETURNING id::text AS id, number, title, description, severity, tlp, pap, status, owner, assignee, tags, created_at, updated_at`, input.Title, input.Description, input.Severity, input.TLP, input.PAP, input.Owner, input.Assignee, pq.Array(input.Tags))
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
	row := Case{}
	err = tx.GetContext(ctx, &row, `
		UPDATE cases
		SET title = $1, description = $2, severity = $3, tlp = $4, pap = $5, assignee = $6, tags = $7, updated_at = now()
		WHERE id = $8::uuid
		RETURNING id::text AS id, number, title, description, severity, tlp, pap, status, owner, assignee, tags, created_at, updated_at`, current.Title, current.Description, current.Severity, current.TLP, current.PAP, current.Assignee, pq.Array([]string(current.Tags)), id)
	return row, err
}

func (r *Repository) Close(ctx context.Context, tx *sqlx.Tx, id string) (Case, error) {
	return r.setStatus(ctx, tx, id, "Closed")
}

func (r *Repository) Reopen(ctx context.Context, tx *sqlx.Tx, id string) (Case, error) {
	return r.setStatus(ctx, tx, id, "Open")
}

func (r *Repository) Get(ctx context.Context, tx *sqlx.Tx, id string) (Case, error) {
	row := Case{}
	err := tx.GetContext(ctx, &row, `SELECT id::text AS id, number, title, description, severity, tlp, pap, status, owner, assignee, tags, created_at, updated_at FROM cases WHERE id = $1::uuid`, id)
	if err == sql.ErrNoRows {
		return Case{}, err
	}
	return row, err
}

func (r *Repository) setStatus(ctx context.Context, tx *sqlx.Tx, id string, status string) (Case, error) {
	row := Case{}
	err := tx.GetContext(ctx, &row, `
		UPDATE cases SET status = $1, updated_at = now(), end_date = CASE WHEN $1 = 'Closed' THEN now() ELSE NULL END
		WHERE id = $2::uuid
		RETURNING id::text AS id, number, title, description, severity, tlp, pap, status, owner, assignee, tags, created_at, updated_at`, status, id)
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
	return input
}
