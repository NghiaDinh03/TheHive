package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/thehive-platform/backend/internal/config"
	"github.com/thehive-platform/backend/internal/db"
	"github.com/thehive-platform/backend/internal/fixturemigrate"
	"github.com/thehive-platform/backend/internal/logger"
	"go.uber.org/zap"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		_, _ = os.Stderr.WriteString("config load error: " + err.Error() + "\n")
		os.Exit(2)
	}

	fixtureDir := os.Getenv("FIXTURE_DIR")
	if fixtureDir == "" {
		fixtureDir = filepath.Clean("../../thehive/test/resources/data")
	}
	mode := strings.ToLower(strings.TrimSpace(os.Getenv("MIGRATION_MODE")))
	if mode == "" {
		mode = "legacy"
	}
	dryRun := strings.EqualFold(os.Getenv("MIGRATION_DRY_RUN"), "true") || os.Getenv("MIGRATION_DRY_RUN") == "1"
	reportPath := strings.TrimSpace(os.Getenv("MIGRATION_REPORT_PATH"))
	source := strings.TrimSpace(os.Getenv("MIGRATION_SOURCE"))
	entities := splitCSV(os.Getenv("MIGRATION_ENTITIES"))

	log, err := logger.New(cfg.LogLevel, cfg.AppEnv)
	if err != nil {
		_, _ = os.Stderr.WriteString("logger init error: " + err.Error() + "\n")
		os.Exit(2)
	}
	defer func() { _ = log.Sync() }()

	ctx := context.Background()
	dbCfg := db.Config{DSN: cfg.PostgresDSN, MaxOpenConns: cfg.PostgresMaxOpenConns, MaxIdleConns: cfg.PostgresMaxIdleConns, ConnMaxLifetime: cfg.PostgresConnMaxLife, MigrationsPath: cfg.PostgresMigrationsPath}
	conn, err := db.Open(ctx, dbCfg, log)
	if err != nil {
		log.Fatal("db open failed", zap.Error(err))
	}
	defer func() { _ = conn.Close() }()

	if mode == "resumable" {
		report, err := fixturemigrate.RunResumable(ctx, conn, fixturemigrate.ResumableOptions{Source: source, FixtureDir: fixtureDir, DryRun: dryRun, Entities: entities})
		if err != nil {
			log.Fatal("resumable fixture migration failed", zap.Error(err), zap.String("fixture_dir", fixtureDir))
		}
		if reportPath != "" {
			if err := fixturemigrate.WriteReport(reportPath, report); err != nil {
				log.Fatal("write migration report failed", zap.Error(err), zap.String("path", reportPath))
			}
		}
		writeJSON(report)
		return
	}

	if mode == "shadow-compare" {
		report, err := fixturemigrate.RunShadowCompare(ctx, conn, fixtureDir)
		if err != nil {
			log.Fatal("shadow compare failed", zap.Error(err), zap.String("fixture_dir", fixtureDir))
		}
		if reportPath != "" {
			if err := fixturemigrate.WriteShadowCompareReport(reportPath, report); err != nil {
				log.Fatal("write shadow compare report failed", zap.Error(err), zap.String("path", reportPath))
			}
		}
		writeJSON(report)
		return
	}

	report, err := fixturemigrate.Run(ctx, conn, fixtureDir)
	if err != nil {
		log.Fatal("fixture migration failed", zap.Error(err), zap.String("fixture_dir", fixtureDir))
	}
	writeJSON(report)
}

func splitCSV(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func writeJSON(value any) {
	encoded, _ := json.MarshalIndent(value, "", "  ")
	_, _ = os.Stdout.Write(encoded)
	_, _ = os.Stdout.WriteString("\n")
}
