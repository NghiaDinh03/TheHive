package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"

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
	report, err := fixturemigrate.Run(ctx, conn, fixtureDir)
	if err != nil {
		log.Fatal("fixture migration failed", zap.Error(err), zap.String("fixture_dir", fixtureDir))
	}
	encoded, _ := json.MarshalIndent(report, "", "  ")
	_, _ = os.Stdout.Write(encoded)
	_, _ = os.Stdout.WriteString("\n")
}
