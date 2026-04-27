package fixturemigrate

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/jmoiron/sqlx"
)

type Report struct {
	Cases       int               `json:"cases"`
	Alerts      int               `json:"alerts"`
	Observables int               `json:"observables"`
	Checksums   map[string]string `json:"checksums"`
}

type legacyCase struct {
	ID          string   `json:"id"`
	Number      int      `json:"number"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Severity    int      `json:"severity"`
	StartDate   int64    `json:"startDate"`
	TLP         int      `json:"tlp"`
	PAP         int      `json:"pap"`
	Status      string   `json:"status"`
	Tags        []string `json:"tags"`
	Assignee    string   `json:"assignee"`
	Owner       string   `json:"owner"`
}

type legacyAlert struct {
	ID          string   `json:"id"`
	Type        string   `json:"type"`
	Source      string   `json:"source"`
	SourceRef   string   `json:"sourceRef"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Severity    int      `json:"severity"`
	Date        int64    `json:"date"`
	TLP         int      `json:"tlp"`
	Read        bool     `json:"read"`
	Tags        []string `json:"tags"`
	CaseID      string   `json:"caseId"`
}

type legacyObservable struct {
	ID        string   `json:"id"`
	Message   string   `json:"message"`
	TLP       int      `json:"tlp"`
	IOC       bool     `json:"ioc"`
	Sighted   bool     `json:"sighted"`
	DataType  string   `json:"dataType"`
	Data      string   `json:"data"`
	Tags      []string `json:"tags"`
	RelatedID string   `json:"relatedId"`
	CreatedBy string   `json:"createdBy"`
}

func Run(ctx context.Context, db *sqlx.DB, fixtureDir string) (Report, error) {
	report := Report{Checksums: map[string]string{}}
	cases, checksum, err := readJSON[legacyCase](filepath.Join(fixtureDir, "Case.json"))
	if err != nil {
		return report, err
	}
	report.Checksums["Case.json"] = checksum
	alerts, checksum, err := readJSON[legacyAlert](filepath.Join(fixtureDir, "Alert.json"))
	if err != nil {
		return report, err
	}
	report.Checksums["Alert.json"] = checksum
	observables, checksum, err := readJSON[legacyObservable](filepath.Join(fixtureDir, "Observable.json"))
	if err != nil {
		return report, err
	}
	report.Checksums["Observable.json"] = checksum

	tx, err := db.BeginTxx(ctx, nil)
	if err != nil {
		return report, err
	}
	defer func() { _ = tx.Rollback() }()

	migrationID := "legacy-fixture-preview-core-investigation"
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO data_migrations (source, status, checksum, report, started_at)
		VALUES ($1, 'running', $2, '{}'::jsonb, now())`, migrationID, combinedChecksum(report.Checksums)); err != nil {
		return report, err
	}
	caseIDs := map[string]string{}
	for _, item := range cases {
		createdAt := unixMillisOrNow(item.StartDate)
		var id string
		if err := tx.QueryRowxContext(ctx, `
			INSERT INTO cases (legacy_id, number, title, description, severity, tlp, pap, status, owner, assignee, tags, start_date, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE(NULLIF($8, ''), 'Open'), $9, $10, $11, $12, $12, now())
			ON CONFLICT (legacy_id) DO UPDATE SET
				number = EXCLUDED.number, title = EXCLUDED.title, description = EXCLUDED.description,
				severity = EXCLUDED.severity, tlp = EXCLUDED.tlp, pap = EXCLUDED.pap, status = EXCLUDED.status,
				owner = EXCLUDED.owner, assignee = EXCLUDED.assignee, tags = EXCLUDED.tags, start_date = EXCLUDED.start_date, updated_at = now()
			RETURNING id::text`, item.ID, item.Number, item.Title, item.Description, defaultInt(item.Severity, 1), defaultInt(item.TLP, 2), defaultInt(item.PAP, 2), item.Status, item.Owner, item.Assignee, safeTags(item.Tags), createdAt).Scan(&id); err != nil {
			return report, fmt.Errorf("upsert case %s: %w", item.ID, err)
		}
		caseIDs[item.ID] = id
		report.Cases++
	}
	for _, item := range alerts {
		var caseID any
		if id := caseIDs[item.CaseID]; id != "" {
			caseID = id
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO alerts (legacy_id, title, type, source, source_ref, severity, tlp, status, read, case_id, tags, occurred_at, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 'New', $8, $9::uuid, $10, $11, $11, now())
			ON CONFLICT (legacy_id) DO UPDATE SET
				title = EXCLUDED.title, type = EXCLUDED.type, source = EXCLUDED.source, source_ref = EXCLUDED.source_ref,
				severity = EXCLUDED.severity, tlp = EXCLUDED.tlp, read = EXCLUDED.read, case_id = EXCLUDED.case_id,
				tags = EXCLUDED.tags, occurred_at = EXCLUDED.occurred_at, updated_at = now()`, item.ID, item.Title, item.Type, item.Source, item.SourceRef, defaultInt(item.Severity, 1), defaultInt(item.TLP, 2), item.Read, caseID, safeTags(item.Tags), unixMillisOrNow(item.Date)); err != nil {
			return report, fmt.Errorf("upsert alert %s: %w", item.ID, err)
		}
		report.Alerts++
	}
	for _, item := range observables {
		if item.Data == "" {
			item.Data = item.ID
		}
		var caseID any
		if id := caseIDs[item.RelatedID]; id != "" {
			caseID = id
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO observables (legacy_id, case_id, data_type, data, message, tlp, ioc, sighted, tags, created_by, created_at, updated_at)
			VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
			ON CONFLICT (legacy_id) DO UPDATE SET
				case_id = EXCLUDED.case_id, data_type = EXCLUDED.data_type, data = EXCLUDED.data, message = EXCLUDED.message,
				tlp = EXCLUDED.tlp, ioc = EXCLUDED.ioc, sighted = EXCLUDED.sighted, tags = EXCLUDED.tags,
				created_by = EXCLUDED.created_by, updated_at = now()`, item.ID, caseID, item.DataType, item.Data, item.Message, defaultInt(item.TLP, 2), item.IOC, item.Sighted, safeTags(item.Tags), item.CreatedBy); err != nil {
			return report, fmt.Errorf("upsert observable %s: %w", item.ID, err)
		}
		report.Observables++
	}
	reportJSON, err := json.Marshal(report)
	if err != nil {
		return report, err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE data_migrations
		SET status = 'success', report = $1::jsonb, finished_at = now(), updated_at = now()
		WHERE source = $2 AND status = 'running'`, string(reportJSON), migrationID); err != nil {
		return report, err
	}
	if err := tx.Commit(); err != nil {
		return report, err
	}
	return report, nil
}

func readJSON[T any](path string) ([]T, string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, "", err
	}
	sum := sha256.Sum256(data)
	var values []T
	if err := json.Unmarshal(data, &values); err != nil {
		return nil, "", err
	}
	return values, hex.EncodeToString(sum[:]), nil
}

func combinedChecksum(values map[string]string) string {
	h := sha256.New()
	for _, name := range []string{"Case.json", "Alert.json", "Observable.json"} {
		_, _ = h.Write([]byte(values[name]))
	}
	return hex.EncodeToString(h.Sum(nil))
}

func unixMillisOrNow(value int64) time.Time {
	if value <= 0 {
		return time.Now().UTC()
	}
	return time.UnixMilli(value).UTC()
}

func defaultInt(value, fallback int) int {
	if value == 0 {
		return fallback
	}
	return value
}

func safeTags(tags []string) []string {
	if tags == nil {
		return []string{}
	}
	return tags
}
