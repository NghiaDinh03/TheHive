package fixturemigrate

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/jmoiron/sqlx"
)

// ShadowCompareReport summarizes source fixture versus target database parity.
type ShadowCompareReport struct {
	FixtureDir string                       `json:"fixture_dir"`
	ComparedAt time.Time                    `json:"compared_at"`
	Entities   map[string]ShadowEntityCheck `json:"entities"`
	Critical   []string                     `json:"critical,omitempty"`
	Warnings   []string                     `json:"warnings,omitempty"`
	Passed     bool                         `json:"passed"`
}

// ShadowEntityCheck records parity for one entity type.
type ShadowEntityCheck struct {
	Entity         string `json:"entity"`
	SourceFile     string `json:"source_file"`
	SourceCount    int    `json:"source_count"`
	TargetCount    int    `json:"target_count"`
	SourceChecksum string `json:"source_checksum"`
	TargetChecksum string `json:"target_checksum"`
	Matched        bool   `json:"matched"`
}

// RunShadowCompare compares legacy fixture files with migrated target rows.
func RunShadowCompare(ctx context.Context, db *sqlx.DB, fixtureDir string) (ShadowCompareReport, error) {
	report := ShadowCompareReport{
		FixtureDir: fixtureDir,
		ComparedAt: time.Now().UTC(),
		Entities:   map[string]ShadowEntityCheck{},
		Passed:     true,
	}

	cases, caseChecksum, err := readJSON[legacyCase](filepath.Join(fixtureDir, "Case.json"))
	if err != nil {
		return report, err
	}
	alerts, alertChecksum, err := readJSON[legacyAlert](filepath.Join(fixtureDir, "Alert.json"))
	if err != nil {
		return report, err
	}
	observables, observableChecksum, err := readJSON[legacyObservable](filepath.Join(fixtureDir, "Observable.json"))
	if err != nil {
		return report, err
	}

	checks := []struct {
		entity   string
		file     string
		sourceN  int
		sourceCS string
		table    string
	}{
		{entity: "cases", file: "Case.json", sourceN: len(cases), sourceCS: caseChecksum, table: "cases"},
		{entity: "alerts", file: "Alert.json", sourceN: len(alerts), sourceCS: alertChecksum, table: "alerts"},
		{entity: "observables", file: "Observable.json", sourceN: len(observables), sourceCS: observableChecksum, table: "observables"},
	}

	for _, check := range checks {
		targetCount, targetChecksum, err := targetLegacyChecksum(ctx, db, check.table)
		if err != nil {
			report.Passed = false
			report.Critical = append(report.Critical, fmt.Sprintf("%s target query failed: %v", check.entity, err))
			continue
		}
		matched := check.sourceN == targetCount
		if !matched {
			report.Passed = false
			report.Critical = append(report.Critical, fmt.Sprintf("%s count mismatch source=%d target=%d", check.entity, check.sourceN, targetCount))
		}
		report.Entities[check.entity] = ShadowEntityCheck{
			Entity:         check.entity,
			SourceFile:     check.file,
			SourceCount:    check.sourceN,
			TargetCount:    targetCount,
			SourceChecksum: check.sourceCS,
			TargetChecksum: targetChecksum,
			Matched:        matched,
		}
	}

	return report, nil
}

// WriteShadowCompareReport writes a shadow compare report to disk for CI or release evidence.
func WriteShadowCompareReport(path string, report ShadowCompareReport) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	payload, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, payload, 0644)
}

func targetLegacyChecksum(ctx context.Context, db *sqlx.DB, table string) (int, string, error) {
	query := fmt.Sprintf(`SELECT COALESCE(jsonb_agg(legacy_id ORDER BY legacy_id), '[]'::jsonb) FROM %s WHERE legacy_id IS NOT NULL`, table)
	var raw []byte
	if err := db.QueryRowxContext(ctx, query).Scan(&raw); err != nil {
		return 0, "", err
	}
	var ids []string
	if err := json.Unmarshal(raw, &ids); err != nil {
		return 0, "", err
	}
	payload, _ := json.Marshal(ids)
	return len(ids), checksumBytes(payload), nil
}
