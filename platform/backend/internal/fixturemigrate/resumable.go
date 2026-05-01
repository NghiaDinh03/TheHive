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

// EntityReport records resumable migration results for a single legacy entity file.
type EntityReport struct {
	Entity      string   `json:"entity"`
	File        string   `json:"file"`
	SourceCount int      `json:"source_count"`
	Migrated    int      `json:"migrated"`
	Skipped     int      `json:"skipped"`
	Failed      int      `json:"failed"`
	Checksum    string   `json:"checksum"`
	Cursor      string   `json:"cursor"`
	Errors      []string `json:"errors,omitempty"`
	DryRun      bool     `json:"dry_run"`
	Completed   bool     `json:"completed"`
}

// ResumableReport is the top-level report for resumable fixture migration.
type ResumableReport struct {
	Source       string                   `json:"source"`
	FixtureDir   string                   `json:"fixture_dir"`
	DryRun       bool                     `json:"dry_run"`
	StartedAt    time.Time                `json:"started_at"`
	FinishedAt   time.Time                `json:"finished_at"`
	Entities     map[string]EntityReport  `json:"entities"`
	Checksums    map[string]string        `json:"checksums"`
	FailedRecord []map[string]interface{} `json:"failed_records,omitempty"`
}

// ResumableOptions controls the resumable migration runner.
type ResumableOptions struct {
	Source     string
	FixtureDir string
	DryRun     bool
	BatchSize  int
	Entities   []string
}

// RunResumable executes a cursor/checksum-aware migration over legacy fixture files.
func RunResumable(ctx context.Context, db *sqlx.DB, opts ResumableOptions) (ResumableReport, error) {
	if opts.Source == "" {
		opts.Source = "legacy-fixture-resumable"
	}
	if opts.BatchSize <= 0 {
		opts.BatchSize = 250
	}
	if len(opts.Entities) == 0 {
		opts.Entities = []string{"cases", "alerts", "observables"}
	}

	report := ResumableReport{
		Source:     opts.Source,
		FixtureDir: opts.FixtureDir,
		DryRun:     opts.DryRun,
		StartedAt:  time.Now().UTC(),
		Entities:   map[string]EntityReport{},
		Checksums:  map[string]string{},
	}

	migrationID, err := ensureMigrationRun(ctx, db, opts.Source, opts.DryRun)
	if err != nil {
		return report, err
	}

	caseIDs := map[string]string{}
	alertIDs := map[string]string{}

	for _, entity := range opts.Entities {
		switch entity {
		case "cases":
			entityReport, ids, err := migrateCasesResumable(ctx, db, opts, migrationID, caseIDs)
			report.Entities[entity] = entityReport
			report.Checksums[entityReport.File] = entityReport.Checksum
			for k, v := range ids {
				caseIDs[k] = v
			}
			if err != nil {
				report.FailedRecord = append(report.FailedRecord, map[string]interface{}{"entity": entity, "error": err.Error()})
				return finalizeResumableReport(ctx, db, migrationID, report, "failed")
			}
		case "alerts":
			entityReport, ids, err := migrateAlertsResumable(ctx, db, opts, migrationID, caseIDs)
			report.Entities[entity] = entityReport
			report.Checksums[entityReport.File] = entityReport.Checksum
			for k, v := range ids {
				alertIDs[k] = v
			}
			if err != nil {
				report.FailedRecord = append(report.FailedRecord, map[string]interface{}{"entity": entity, "error": err.Error()})
				return finalizeResumableReport(ctx, db, migrationID, report, "failed")
			}
		case "observables":
			entityReport, err := migrateObservablesResumable(ctx, db, opts, migrationID, caseIDs, alertIDs)
			report.Entities[entity] = entityReport
			report.Checksums[entityReport.File] = entityReport.Checksum
			if err != nil {
				report.FailedRecord = append(report.FailedRecord, map[string]interface{}{"entity": entity, "error": err.Error()})
				return finalizeResumableReport(ctx, db, migrationID, report, "failed")
			}
		}
	}

	return finalizeResumableReport(ctx, db, migrationID, report, "success")
}

func ensureMigrationRun(ctx context.Context, db *sqlx.DB, source string, dryRun bool) (string, error) {
	var id string
	status := "running"
	if dryRun {
		status = "dry-run"
	}
	err := db.QueryRowxContext(ctx, `
		INSERT INTO data_migrations (source, status, started_at, report)
		VALUES ($1, $2, now(), '{}'::jsonb)
		RETURNING id::text`, source, status).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create migration run: %w", err)
	}
	return id, nil
}

func migrateCasesResumable(ctx context.Context, db *sqlx.DB, opts ResumableOptions, migrationID string, existing map[string]string) (EntityReport, map[string]string, error) {
	items, checksum, err := readJSON[legacyCase](filepath.Join(opts.FixtureDir, "Case.json"))
	rep := EntityReport{Entity: "cases", File: "Case.json", Checksum: checksum, SourceCount: len(items), DryRun: opts.DryRun}
	if err != nil {
		rep.Failed++
		rep.Errors = append(rep.Errors, err.Error())
		return rep, existing, err
	}
	ids := map[string]string{}
	for _, item := range items {
		rep.Cursor = item.ID
		if opts.DryRun {
			rep.Skipped++
			continue
		}
		var id string
		err := db.QueryRowxContext(ctx, `
			INSERT INTO cases (legacy_id, number, title, description, severity, tlp, pap, status, owner, assignee, tags, start_date, flag, summary, impact_status, resolution_status, case_template, owning_organisation, organisation_ids, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE(NULLIF($8,''),'Open'),$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$12,now())
			ON CONFLICT (legacy_id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, severity=EXCLUDED.severity, tlp=EXCLUDED.tlp, pap=EXCLUDED.pap, status=EXCLUDED.status, updated_at=now()
			RETURNING id::text`, item.ID, item.Number, item.Title, item.Description, defaultInt(item.Severity, 1), defaultInt(item.TLP, 2), defaultInt(item.PAP, 2), item.Status, item.Owner, item.Assignee, safeTags(item.Tags), unixMillisOrNow(item.StartDate), item.Flag, item.Summary, item.ImpactStatus, item.ResolutionStatus, item.CaseTemplate, item.OwningOrganisation, safeTags(item.OrganisationIDs)).Scan(&id)
		if err != nil {
			rep.Failed++
			rep.Errors = append(rep.Errors, fmt.Sprintf("%s: %v", item.ID, err))
			continue
		}
		ids[item.ID] = id
		rep.Migrated++
		_ = updateMigrationCursor(ctx, db, migrationID, item.ID)
	}
	rep.Completed = rep.Failed == 0
	return rep, ids, nil
}

func migrateAlertsResumable(ctx context.Context, db *sqlx.DB, opts ResumableOptions, migrationID string, caseIDs map[string]string) (EntityReport, map[string]string, error) {
	items, checksum, err := readJSON[legacyAlert](filepath.Join(opts.FixtureDir, "Alert.json"))
	rep := EntityReport{Entity: "alerts", File: "Alert.json", Checksum: checksum, SourceCount: len(items), DryRun: opts.DryRun}
	if err != nil {
		rep.Failed++
		rep.Errors = append(rep.Errors, err.Error())
		return rep, nil, err
	}
	ids := map[string]string{}
	for _, item := range items {
		rep.Cursor = item.ID
		if opts.DryRun {
			rep.Skipped++
			continue
		}
		var caseID any
		if id := caseIDs[item.CaseID]; id != "" {
			caseID = id
		}
		var id string
		err := db.QueryRowxContext(ctx, `
			INSERT INTO alerts (legacy_id, title, description, type, source, source_ref, severity, tlp, pap, status, read, case_id, tags, occurred_at, follow, flag, external_link, organisation_id, case_template, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'New',$10,$11::uuid,$12,$13,$14,$15,$16,$17,$18,$13,now())
			ON CONFLICT (legacy_id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, type=EXCLUDED.type, source=EXCLUDED.source, source_ref=EXCLUDED.source_ref, updated_at=now()
			RETURNING id::text`, item.ID, item.Title, item.Description, item.Type, item.Source, item.SourceRef, defaultInt(item.Severity, 1), defaultInt(item.TLP, 2), defaultInt(item.PAP, 2), item.Read, caseID, safeTags(item.Tags), unixMillisOrNow(item.Date), item.Follow, item.Flag, item.ExternalLink, item.OrganisationID, item.CaseTemplate).Scan(&id)
		if err != nil {
			rep.Failed++
			rep.Errors = append(rep.Errors, fmt.Sprintf("%s: %v", item.ID, err))
			continue
		}
		ids[item.ID] = id
		rep.Migrated++
		_ = updateMigrationCursor(ctx, db, migrationID, item.ID)
	}
	rep.Completed = rep.Failed == 0
	return rep, ids, nil
}

func migrateObservablesResumable(ctx context.Context, db *sqlx.DB, opts ResumableOptions, migrationID string, caseIDs, alertIDs map[string]string) (EntityReport, error) {
	items, checksum, err := readJSON[legacyObservable](filepath.Join(opts.FixtureDir, "Observable.json"))
	rep := EntityReport{Entity: "observables", File: "Observable.json", Checksum: checksum, SourceCount: len(items), DryRun: opts.DryRun}
	if err != nil {
		rep.Failed++
		rep.Errors = append(rep.Errors, err.Error())
		return rep, err
	}
	for _, item := range items {
		rep.Cursor = item.ID
		if opts.DryRun {
			rep.Skipped++
			continue
		}
		var caseID any
		var alertID any
		if id := caseIDs[item.RelatedID]; id != "" {
			caseID = id
		}
		if id := alertIDs[item.RelatedID]; id != "" {
			alertID = id
		}
		var fullData any
		if item.FullData != "" {
			fullData = item.FullData
		}
		data := item.Data
		if data == "" {
			data = item.ID
		}
		_, err := db.ExecContext(ctx, `
			INSERT INTO observables (legacy_id, case_id, alert_id, imported_from_alert_id, data_type, data, message, tlp, ioc, sighted, ignore_similarity, full_data, tags, created_by, lineage, created_at, updated_at)
			VALUES ($1,$2::uuid,$3::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,jsonb_build_object('legacy_related_id',$14::text),now(),now())
			ON CONFLICT (legacy_id) DO UPDATE SET data_type=EXCLUDED.data_type, data=EXCLUDED.data, message=EXCLUDED.message, tlp=EXCLUDED.tlp, ioc=EXCLUDED.ioc, sighted=EXCLUDED.sighted, ignore_similarity=EXCLUDED.ignore_similarity, full_data=EXCLUDED.full_data, updated_at=now()`, item.ID, caseID, alertID, item.DataType, data, item.Message, defaultInt(item.TLP, 2), item.IOC, item.Sighted, item.IgnoreSimilarity, fullData, safeTags(item.Tags), item.CreatedBy, item.RelatedID)
		if err != nil {
			rep.Failed++
			rep.Errors = append(rep.Errors, fmt.Sprintf("%s: %v", item.ID, err))
			continue
		}
		rep.Migrated++
		_ = updateMigrationCursor(ctx, db, migrationID, item.ID)
	}
	rep.Completed = rep.Failed == 0
	return rep, nil
}

func updateMigrationCursor(ctx context.Context, db *sqlx.DB, migrationID, cursor string) error {
	_, err := db.ExecContext(ctx, `UPDATE data_migrations SET cursor_value=$1, updated_at=now() WHERE id=$2::uuid`, cursor, migrationID)
	return err
}

func finalizeResumableReport(ctx context.Context, db *sqlx.DB, migrationID string, report ResumableReport, status string) (ResumableReport, error) {
	report.FinishedAt = time.Now().UTC()
	payload, err := json.Marshal(report)
	if err != nil {
		return report, err
	}
	checksum := checksumBytes(payload)
	_, err = db.ExecContext(ctx, `UPDATE data_migrations SET status=$1, checksum=$2, report=$3::jsonb, finished_at=now(), updated_at=now() WHERE id=$4::uuid`, status, checksum, string(payload), migrationID)
	if err != nil {
		return report, fmt.Errorf("finalize migration report: %w", err)
	}
	return report, nil
}

// WriteReport writes a migration report to disk for shadow-compare or CI artifacts.
func WriteReport(path string, report ResumableReport) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	payload, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, payload, 0644)
}

func checksumBytes(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
