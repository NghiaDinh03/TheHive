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
	ID             string         `db:"id" json:"id"`
	Title          string         `db:"title" json:"title"`
	Description    string         `db:"description" json:"description"`
	Type           string         `db:"type" json:"type"`
	Source         string         `db:"source" json:"source"`
	SourceRef      string         `db:"source_ref" json:"source_ref"`
	ExternalLink   string         `db:"external_link" json:"external_link"`
	Severity       int            `db:"severity" json:"severity"`
	TLP            int            `db:"tlp" json:"tlp"`
	PAP            int            `db:"pap" json:"pap"`
	Status         string         `db:"status" json:"status"`
	Read           bool           `db:"read" json:"read"`
	Follow         bool           `db:"follow" json:"follow"`
	Flag           bool           `db:"flag" json:"flag"`
	OrganisationID string         `db:"organisation_id" json:"organisation_id"`
	CaseTemplate   string         `db:"case_template" json:"case_template"`
	CaseID         sql.NullString `db:"case_id" json:"-"`
	Tags           pq.StringArray `db:"tags" json:"tags"`
	LastSyncDate   *time.Time     `db:"last_sync_date" json:"last_sync_date,omitempty"`
	CreatedAt      time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time      `db:"updated_at" json:"updated_at"`
}

const alertSelectColumns = `id::text AS id, title, description, type, source, source_ref, external_link, severity, tlp, pap, status, read, follow, flag, organisation_id, case_template, case_id::text AS case_id, tags, last_sync_date, created_at, updated_at`

type AlertResponse struct {
	ID             string         `json:"id"`
	Title          string         `json:"title"`
	Description    string         `json:"description"`
	Type           string         `json:"type"`
	Source         string         `json:"source"`
	SourceRef      string         `json:"source_ref"`
	ExternalLink   string         `json:"external_link"`
	Severity       int            `json:"severity"`
	TLP            int            `json:"tlp"`
	PAP            int            `json:"pap"`
	Status         string         `json:"status"`
	Read           bool           `json:"read"`
	Follow         bool           `json:"follow"`
	Flag           bool           `json:"flag"`
	OrganisationID string         `json:"organisation_id"`
	CaseTemplate   string         `json:"case_template"`
	CaseID         string         `json:"case_id,omitempty"`
	Tags           pq.StringArray `json:"tags"`
	LastSyncDate   *time.Time     `json:"last_sync_date,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

type ObservableCopy struct {
	SourceObservableID string `json:"source_observable_id"`
	ObservableID       string `json:"observable_id"`
	Action             string `json:"action"`
	DataType           string `json:"data_type"`
	Data               string `json:"data"`
	AttachmentID       string `json:"attachment_id,omitempty"`
}

type SimilarAlert struct {
	ID                string  `db:"id" json:"id"`
	Title             string  `db:"title" json:"title"`
	Source            string  `db:"source" json:"source"`
	SourceRef         string  `db:"source_ref" json:"source_ref"`
	Score             float64 `db:"score" json:"score"`
	Reason            string  `db:"reason" json:"reason"`
	ObservableOverlap int     `db:"observable_overlap" json:"observable_overlap"`
	IOCOverlap        int     `db:"ioc_overlap" json:"ioc_overlap"`
	TagOverlap        int     `db:"tag_overlap" json:"tag_overlap"`
}

type MergeConflictReport struct {
	Policy                   string         `json:"policy"`
	CopiedCount              int            `json:"copied_count"`
	DeduplicatedCount        int            `json:"deduplicated_count"`
	ConflictingObservableIDs []string       `json:"conflicting_observable_ids"`
	SimilarAlerts            []SimilarAlert `json:"similar_alerts"`
	Notes                    []string       `json:"notes"`
}

type ImportResult struct {
	Alert       AlertResponse       `json:"alert"`
	Case        casewrite.Case      `json:"case"`
	Observables []ObservableCopy    `json:"observables"`
	Report      MergeConflictReport `json:"report"`
}

type MergeResult struct {
	SourceAlert AlertResponse       `json:"source_alert"`
	TargetCase  string              `json:"target_case"`
	Status      string              `json:"status"`
	Observables []ObservableCopy    `json:"observables"`
	Report      MergeConflictReport `json:"report"`
}

func (a Alert) Response() AlertResponse {
	out := AlertResponse{
		ID: a.ID, Title: a.Title, Description: a.Description, Type: a.Type, Source: a.Source,
		SourceRef: a.SourceRef, ExternalLink: a.ExternalLink, Severity: a.Severity, TLP: a.TLP, PAP: a.PAP,
		Status: a.Status, Read: a.Read, Follow: a.Follow, Flag: a.Flag,
		OrganisationID: a.OrganisationID, CaseTemplate: a.CaseTemplate, Tags: a.Tags,
		LastSyncDate: a.LastSyncDate, CreatedAt: a.CreatedAt, UpdatedAt: a.UpdatedAt,
	}
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

	pap := alert.PAP
	if pap == 0 {
		pap = 2
	}

	var created casewrite.Case
	if strings.TrimSpace(alert.CaseTemplate) != "" {
		created, err = r.createCaseFromTemplate(ctx, tx, alert, owner, pap)
	} else {
		created, err = r.caseRepo.Create(ctx, tx, casewrite.CreateCase{
			Title:       alert.Title,
			Description: fmt.Sprintf("Imported from alert %s/%s", alert.Source, alert.SourceRef),
			Severity:    alert.Severity, TLP: alert.TLP, PAP: pap,
			Owner: owner, Tags: []string(alert.Tags),
		})
	}
	if err != nil {
		return ImportResult{}, err
	}

	copied, err := r.copyAlertObservables(ctx, tx, alert.ID, created.ID)
	if err != nil {
		return ImportResult{}, err
	}
	_ = r.copyAlertCustomFieldsToCase(ctx, tx, alert.ID, created.ID)
	similar, err := r.findSimilarAlerts(ctx, tx, alert)
	if err != nil {
		return ImportResult{}, err
	}
	updated, err := r.setCaseAndStatus(ctx, tx, alert.ID, created.ID, "Imported")
	if err != nil {
		return ImportResult{}, err
	}
	return ImportResult{Alert: updated.Response(), Case: created, Observables: copied, Report: buildConflictReport(copied, similar)}, nil
}

func (r *Repository) createCaseFromTemplate(ctx context.Context, tx *sqlx.Tx, alert Alert, owner string, pap int) (casewrite.Case, error) {
	tplName := strings.TrimSpace(alert.CaseTemplate)
	var tplID string
	err := tx.GetContext(ctx, &tplID, `SELECT id::text FROM case_templates WHERE name = $1 OR display_name = $1 LIMIT 1`, tplName)
	if err == sql.ErrNoRows {
		return r.caseRepo.Create(ctx, tx, casewrite.CreateCase{
			Title:       alert.Title,
			Description: fmt.Sprintf("Imported from alert %s/%s (template '%s' not found)", alert.Source, alert.SourceRef, tplName),
			Severity:    alert.Severity, TLP: alert.TLP, PAP: pap,
			Owner: owner, Tags: []string(alert.Tags),
		})
	}
	if err != nil {
		return casewrite.Case{}, err
	}
	created, err := r.caseRepo.Create(ctx, tx, casewrite.CreateCase{
		Title:       alert.Title,
		Description: fmt.Sprintf("Imported from alert %s/%s using template '%s'", alert.Source, alert.SourceRef, tplName),
		Severity:    alert.Severity, TLP: alert.TLP, PAP: pap,
		Owner: owner, Tags: []string(alert.Tags),
	})
	if err != nil {
		return casewrite.Case{}, err
	}
	_, _ = tx.ExecContext(ctx, `UPDATE cases SET case_template = $1 WHERE id = $2::uuid`, tplName, created.ID)
	_, _ = tx.ExecContext(ctx, `
		INSERT INTO tasks (case_id, title, description, group_name, order_index, status, created_by)
		SELECT $1::uuid, title, description, group_name, order_index, 'Waiting', $2
		FROM case_template_tasks WHERE template_id = $3::uuid
		ORDER BY order_index`, created.ID, owner, tplID)
	_, _ = tx.ExecContext(ctx, `
		INSERT INTO custom_fields (case_id, name, value, field_type, field_order, created_by)
		SELECT $1::uuid, name, default_value, field_type, field_order, $2
		FROM case_template_custom_fields WHERE template_id = $3::uuid
		ORDER BY field_order`, created.ID, owner, tplID)
	return created, nil
}

func (r *Repository) MergeIntoCase(ctx context.Context, tx *sqlx.Tx, sourceAlertID string, caseID string) (MergeResult, error) {
	if strings.TrimSpace(caseID) == "" {
		return MergeResult{}, fmt.Errorf("case_id or target_alert_id is required")
	}
	if _, err := r.caseRepo.Get(ctx, tx, caseID); err != nil {
		return MergeResult{}, err
	}
	source, err := r.Get(ctx, tx, sourceAlertID)
	if err != nil {
		return MergeResult{}, err
	}
	copied, err := r.copyAlertObservables(ctx, tx, sourceAlertID, caseID)
	if err != nil {
		return MergeResult{}, err
	}
	similar, err := r.findSimilarAlerts(ctx, tx, source)
	if err != nil {
		return MergeResult{}, err
	}
	updated, err := r.setCaseAndStatus(ctx, tx, sourceAlertID, caseID, "Merged")
	if err != nil {
		return MergeResult{}, err
	}
	return MergeResult{SourceAlert: updated.Response(), TargetCase: caseID, Status: "Merged", Observables: copied, Report: buildConflictReport(copied, similar)}, nil
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

type UpdateAlert struct {
	Title        *string
	Description  *string
	Severity     *int
	TLP          *int
	PAP          *int
	Tags         []string
	TagsSet      bool
	Follow       *bool
	Flag         *bool
	CaseTemplate *string
	ExternalLink *string
}

func (r *Repository) Get(ctx context.Context, tx *sqlx.Tx, id string) (Alert, error) {
	row := Alert{}
	err := tx.GetContext(ctx, &row, `SELECT `+alertSelectColumns+` FROM alerts WHERE id = $1::uuid AND deleted_at IS NULL`, strings.TrimSpace(id))
	return row, err
}

func (r *Repository) Update(ctx context.Context, tx *sqlx.Tx, id string, input UpdateAlert) (Alert, error) {
	current, err := r.Get(ctx, tx, id)
	if err != nil {
		return Alert{}, err
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
	if input.TagsSet {
		current.Tags = input.Tags
	}
	if input.Follow != nil {
		current.Follow = *input.Follow
	}
	if input.Flag != nil {
		current.Flag = *input.Flag
	}
	if input.CaseTemplate != nil {
		current.CaseTemplate = strings.TrimSpace(*input.CaseTemplate)
	}
	if input.ExternalLink != nil {
		current.ExternalLink = strings.TrimSpace(*input.ExternalLink)
	}
	row := Alert{}
	err = tx.GetContext(ctx, &row, `
		UPDATE alerts SET title = $1, description = $2, severity = $3, tlp = $4, pap = $5,
			tags = $6, follow = $7, flag = $8, case_template = $9, external_link = $10, updated_at = now()
		WHERE id = $11::uuid
		RETURNING `+alertSelectColumns,
		current.Title, current.Description, current.Severity, current.TLP, current.PAP,
		pq.Array([]string(current.Tags)), current.Follow, current.Flag, current.CaseTemplate, current.ExternalLink, id)
	return row, err
}

func (r *Repository) Delete(ctx context.Context, tx *sqlx.Tx, id string) error {
	_, err := tx.ExecContext(ctx, `UPDATE alerts SET deleted_at = now(), updated_at = now() WHERE id = $1::uuid`, strings.TrimSpace(id))
	return err
}

func (r *Repository) SetRead(ctx context.Context, tx *sqlx.Tx, id string, read bool) (Alert, error) {
	row := Alert{}
	err := tx.GetContext(ctx, &row, `
		UPDATE alerts SET read = $1, updated_at = now()
		WHERE id = $2::uuid
		RETURNING `+alertSelectColumns, read, strings.TrimSpace(id))
	return row, err
}

func (r *Repository) setCaseAndStatus(ctx context.Context, tx *sqlx.Tx, id string, caseID string, status string) (Alert, error) {
	row := Alert{}
	err := tx.GetContext(ctx, &row, `
		UPDATE alerts SET case_id = $1::uuid, status = $2, read = true, updated_at = now()
		WHERE id = $3::uuid
		RETURNING `+alertSelectColumns, caseID, status, strings.TrimSpace(id))
	return row, err
}

func (r *Repository) copyAlertCustomFieldsToCase(ctx context.Context, tx *sqlx.Tx, alertID string, caseID string) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO custom_fields (owner_type, owner_id, name, value, field_type, field_order, string_value, boolean_value, integer_value, float_value, date_value)
		SELECT 'case', $2::uuid, acf.name, to_jsonb(acf.value), acf.field_type, acf.field_order,
			COALESCE(acf.string_value, acf.value), acf.boolean_value, acf.integer_value, acf.float_value, acf.date_value
		FROM alert_custom_fields acf WHERE acf.alert_id = $1::uuid
		ON CONFLICT (owner_type, owner_id, name) DO NOTHING`,
		strings.TrimSpace(alertID), strings.TrimSpace(caseID))
	return err
}

func (r *Repository) copyAlertObservables(ctx context.Context, tx *sqlx.Tx, alertID string, caseID string) ([]ObservableCopy, error) {
	rows, err := tx.QueryxContext(ctx, `
		WITH source AS (
			SELECT id, data_type, data, message, tlp, ioc, sighted, attachment_id, tags, created_by
			FROM observables
			WHERE alert_id = $1::uuid OR (case_id IS NULL AND imported_from_alert_id = $1::uuid)
		), inserted AS (
			INSERT INTO observables (case_id, data_type, data, message, tlp, ioc, sighted, attachment_id, tags, created_by, source_observable_id, imported_from_alert_id, lineage)
			SELECT $2::uuid, data_type, data, message, tlp, ioc, sighted, attachment_id, tags, created_by, id, $1::uuid,
				jsonb_build_object('source', 'alert_import', 'alert_id', $1::text, 'source_observable_id', id::text)
			FROM source
			ON CONFLICT (case_id, lower(data_type), lower(data)) WHERE case_id IS NOT NULL DO UPDATE SET
				message = CASE WHEN observables.message = '' THEN EXCLUDED.message ELSE observables.message END,
				tlp = LEAST(observables.tlp, EXCLUDED.tlp),
				ioc = observables.ioc OR EXCLUDED.ioc,
				sighted = observables.sighted OR EXCLUDED.sighted,
				attachment_id = COALESCE(observables.attachment_id, EXCLUDED.attachment_id),
				tags = ARRAY(SELECT DISTINCT tag FROM unnest(observables.tags || EXCLUDED.tags) AS tag ORDER BY tag),
				imported_from_alert_id = EXCLUDED.imported_from_alert_id,
				lineage = observables.lineage || EXCLUDED.lineage,
				updated_at = now()
			RETURNING source_observable_id::text, id::text, data_type, data, COALESCE(attachment_id::text, '') AS attachment_id, (xmax = 0) AS inserted
		)
		SELECT source_observable_id, id, data_type, data, attachment_id, inserted FROM inserted`, strings.TrimSpace(alertID), strings.TrimSpace(caseID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	copies := []ObservableCopy{}
	for rows.Next() {
		var item ObservableCopy
		var inserted bool
		if err := rows.Scan(&item.SourceObservableID, &item.ObservableID, &item.DataType, &item.Data, &item.AttachmentID, &inserted); err != nil {
			return nil, err
		}
		item.Action = "deduplicated"
		if inserted {
			item.Action = "copied"
		}
		copies = append(copies, item)
	}
	return copies, rows.Err()
}

func (r *Repository) findSimilarAlerts(ctx context.Context, tx *sqlx.Tx, alert Alert) ([]SimilarAlert, error) {
	rows := []SimilarAlert{}
	err := tx.SelectContext(ctx, &rows, `
		WITH current_observables AS (
			SELECT lower(data_type) AS data_type, lower(data) AS data, ioc
			FROM observables
			WHERE alert_id = $1::uuid
		), candidate_scores AS (
			SELECT a.id, a.title, a.source, a.source_ref, a.type, a.tags, a.updated_at,
				COUNT(co.*) FILTER (WHERE co.data_type IS NOT NULL) AS observable_overlap,
				COUNT(co.*) FILTER (WHERE co.data_type IS NOT NULL AND co.ioc AND o.ioc) AS ioc_overlap,
				COALESCE((SELECT COUNT(*) FROM unnest(a.tags) tag WHERE tag = ANY($5)), 0) AS tag_overlap
			FROM alerts a
			LEFT JOIN observables o ON o.alert_id = a.id
			LEFT JOIN current_observables co ON co.data_type = lower(o.data_type) AND co.data = lower(o.data)
			WHERE a.id <> $1::uuid
			  AND a.status IN ('New', 'Updated', 'Imported', 'Merged')
			GROUP BY a.id, a.title, a.source, a.source_ref, a.type, a.tags, a.updated_at
		)
		SELECT id::text AS id, title, source, source_ref,
			LEAST(1.0,
				CASE
					WHEN source = $2 AND source_ref = $3 AND type = $4 THEN 0.55
					WHEN source = $2 AND source_ref = $3 THEN 0.45
					WHEN source = $2 AND type = $4 THEN 0.30
					ELSE 0.0
				END
				+ CASE WHEN observable_overlap > 0 THEN 0.25 ELSE 0.0 END
				+ CASE WHEN ioc_overlap > 0 THEN 0.15 ELSE 0.0 END
				+ CASE WHEN tag_overlap > 0 THEN 0.10 ELSE 0.0 END
			) AS score,
			trim(both '+' from concat_ws('+',
				CASE WHEN source = $2 AND source_ref = $3 AND type = $4 THEN 'same-source-ref-type' END,
				CASE WHEN source = $2 AND source_ref = $3 AND type <> $4 THEN 'same-source-ref' END,
				CASE WHEN source = $2 AND source_ref <> $3 AND type = $4 THEN 'same-source-type' END,
				CASE WHEN observable_overlap > 0 THEN 'observable-overlap' END,
				CASE WHEN ioc_overlap > 0 THEN 'ioc-overlap' END,
				CASE WHEN tag_overlap > 0 THEN 'tag-overlap' END
			)) AS reason,
			observable_overlap, ioc_overlap, tag_overlap
		FROM candidate_scores
		WHERE source = $2 OR source_ref = $3 OR type = $4 OR observable_overlap > 0 OR ioc_overlap > 0 OR tag_overlap > 0
		ORDER BY score DESC, updated_at DESC
		LIMIT 10`, alert.ID, alert.Source, alert.SourceRef, alert.Type, pq.Array([]string(alert.Tags)))
	return rows, err
}

func buildConflictReport(copies []ObservableCopy, similar []SimilarAlert) MergeConflictReport {
	report := MergeConflictReport{Policy: "dedup-by-case-data-type-data", SimilarAlerts: similar, Notes: []string{"Existing case observables win for free-text message unless empty; TLP keeps the most restrictive value; IOC/sighted flags are OR-merged; attachment_id is preserved/copied when available; tags are unioned deterministically.", "Similar alerts are scored by source/source_ref/type plus observable overlap, IOC overlap, and tag overlap."}}
	for _, item := range copies {
		switch item.Action {
		case "copied":
			report.CopiedCount++
		case "deduplicated":
			report.DeduplicatedCount++
			report.ConflictingObservableIDs = append(report.ConflictingObservableIDs, item.ObservableID)
		}
	}
	return report
}
