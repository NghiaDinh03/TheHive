package alertwrite

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
	"github.com/thehive-platform/backend/internal/repository/casewrite"
)

type Repository struct {
	db       *sqlx.DB
	caseRepo *casewrite.Repository
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db, caseRepo: casewrite.NewRepository(db)}
}

type Alert struct {
	ID        string         `db:"id" json:"id"`
	Title     string         `db:"title" json:"title"`
	Type      string         `db:"type" json:"type"`
	Source    string         `db:"source" json:"source"`
	SourceRef string         `db:"source_ref" json:"source_ref"`
	Severity  int            `db:"severity" json:"severity"`
	TLP       int            `db:"tlp" json:"tlp"`
	Status    string         `db:"status" json:"status"`
	Read      bool           `db:"read" json:"read"`
	CaseID    sql.NullString `db:"case_id" json:"-"`
	Tags      pq.StringArray `db:"tags" json:"tags"`
	CreatedAt time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt time.Time      `db:"updated_at" json:"updated_at"`
}

type AlertResponse struct {
	ID        string         `json:"id"`
	Title     string         `json:"title"`
	Type      string         `json:"type"`
	Source    string         `json:"source"`
	SourceRef string         `json:"source_ref"`
	Severity  int            `json:"severity"`
	TLP       int            `json:"tlp"`
	Status    string         `json:"status"`
	Read      bool           `json:"read"`
	CaseID    string         `json:"case_id,omitempty"`
	Tags      pq.StringArray `json:"tags"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
}

type ImportResult struct {
	Alert AlertResponse  `json:"alert"`
	Case  casewrite.Case `json:"case"`
}

type MergeResult struct {
	SourceAlert AlertResponse `json:"source_alert"`
	TargetCase  string        `json:"target_case"`
	Status      string        `json:"status"`
}

func (a Alert) Response() AlertResponse {
	out := AlertResponse{ID: a.ID, Title: a.Title, Type: a.Type, Source: a.Source, SourceRef: a.SourceRef, Severity: a.Severity, TLP: a.TLP, Status: a.Status, Read: a.Read, Tags: a.Tags, CreatedAt: a.CreatedAt, UpdatedAt: a.UpdatedAt}
	if a.CaseID.Valid {
		out.CaseID = a.CaseID.String
	}
	return out
}

func (r *Repository) Import(ctx context.Context, tx *sqlx.Tx, id string, owner string) (ImportResult, error) {
	alert, err := r.Get(ctx, tx, id)
	if err != nil {
		return ImportResult{}, err
	}
	if alert.CaseID.Valid && alert.CaseID.String != "" {
		linked, err := r.caseRepo.Get(ctx, tx, alert.CaseID.String)
		if err != nil {
			return ImportResult{}, err
		}
		return ImportResult{Alert: alert.Response(), Case: linked}, nil
	}
	created, err := r.caseRepo.Create(ctx, tx, casewrite.CreateCase{Title: alert.Title, Description: fmt.Sprintf("Imported from alert %s/%s", alert.Source, alert.SourceRef), Severity: alert.Severity, TLP: alert.TLP, PAP: 2, Owner: owner, Tags: []string(alert.Tags)})
	if err != nil {
		return ImportResult{}, err
	}
	updated, err := r.setCaseAndStatus(ctx, tx, alert.ID, created.ID, "Imported")
	if err != nil {
		return ImportResult{}, err
	}
	return ImportResult{Alert: updated.Response(), Case: created}, nil
}

func (r *Repository) MergeIntoCase(ctx context.Context, tx *sqlx.Tx, sourceAlertID string, caseID string) (MergeResult, error) {
	if strings.TrimSpace(caseID) == "" {
		return MergeResult{}, fmt.Errorf("case_id or target_alert_id is required")
	}
	if _, err := r.caseRepo.Get(ctx, tx, caseID); err != nil {
		return MergeResult{}, err
	}
	updated, err := r.setCaseAndStatus(ctx, tx, sourceAlertID, caseID, "Merged")
	if err != nil {
		return MergeResult{}, err
	}
	return MergeResult{SourceAlert: updated.Response(), TargetCase: caseID, Status: "Merged"}, nil
}

func (r *Repository) MergeIntoAlertCase(ctx context.Context, tx *sqlx.Tx, sourceAlertID string, targetAlertID string) (MergeResult, error) {
	target, err := r.Get(ctx, tx, targetAlertID)
	if err != nil {
		return MergeResult{}, err
	}
	if !target.CaseID.Valid || strings.TrimSpace(target.CaseID.String) == "" {
		return MergeResult{}, fmt.Errorf("target alert has no imported case")
	}
	return r.MergeIntoCase(ctx, tx, sourceAlertID, target.CaseID.String)
}

func (r *Repository) Get(ctx context.Context, tx *sqlx.Tx, id string) (Alert, error) {
	row := Alert{}
	err := tx.GetContext(ctx, &row, `
		SELECT id::text AS id, title, type, source, source_ref, severity, tlp, status, read, case_id::text AS case_id, tags, created_at, updated_at
		FROM alerts WHERE id = $1::uuid`, strings.TrimSpace(id))
	return row, err
}

func (r *Repository) setCaseAndStatus(ctx context.Context, tx *sqlx.Tx, id string, caseID string, status string) (Alert, error) {
	row := Alert{}
	err := tx.GetContext(ctx, &row, `
		UPDATE alerts SET case_id = $1::uuid, status = $2, read = true, updated_at = now()
		WHERE id = $3::uuid
		RETURNING id::text AS id, title, type, source, source_ref, severity, tlp, status, read, case_id::text AS case_id, tags, created_at, updated_at`, caseID, status, strings.TrimSpace(id))
	return row, err
}
