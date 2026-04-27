package main

import (
	"context"
	"errors"
	"os"
	"os/signal"
	"syscall"

	"github.com/thehive-platform/backend/internal/config"
	"github.com/thehive-platform/backend/internal/db"
	"github.com/thehive-platform/backend/internal/logger"
	"github.com/thehive-platform/backend/internal/metrics"
	"github.com/thehive-platform/backend/internal/mq"
	"github.com/thehive-platform/backend/internal/server"
	"github.com/thehive-platform/backend/internal/version"
	"go.uber.org/zap"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		// stderr only — logger not yet built
		_, _ = os.Stderr.WriteString("config load error: " + err.Error() + "\n")
		os.Exit(2)
	}

	log, err := logger.New(cfg.LogLevel, cfg.AppEnv)
	if err != nil {
		_, _ = os.Stderr.WriteString("logger init error: " + err.Error() + "\n")
		os.Exit(2)
	}
	defer func() { _ = log.Sync() }()

	v := version.Get()
	log.Info("starting backend",
		zap.String("version", v.Version),
		zap.String("git_sha", v.GitSHA),
		zap.String("build_time", v.BuildTime),
		zap.String("release_class", v.ReleaseClass),
		zap.String("env", cfg.AppEnv),
	)

	rootCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	dbCfg := db.Config{
		DSN:             cfg.PostgresDSN,
		MaxOpenConns:    cfg.PostgresMaxOpenConns,
		MaxIdleConns:    cfg.PostgresMaxIdleConns,
		ConnMaxLifetime: cfg.PostgresConnMaxLife,
		MigrationsPath:  cfg.PostgresMigrationsPath,
	}

	if err := db.Migrate(dbCfg, log); err != nil {
		log.Fatal("migration failed", zap.Error(err))
	}

	conn, err := db.Open(rootCtx, dbCfg, log)
	if err != nil {
		log.Fatal("db open failed", zap.Error(err))
	}
	defer func() { _ = conn.Close() }()

	mqClient := mq.New(mq.Config{
		URL:            cfg.RabbitURL,
		ConnectTimeout: cfg.RabbitConnectTimeout,
		ReconnectDelay: cfg.RabbitReconnectBackoff,
	}, log)
	if err := mqClient.Connect(rootCtx); err != nil {
		log.Fatal("rabbitmq connect failed", zap.Error(err))
	}
	defer func() { _ = mqClient.Close() }()

	metReg := metrics.New()
	srv := server.New(cfg, log, conn, mqClient, metReg)

	errCh := make(chan error, 1)
	go func() {
		errCh <- srv.Start()
	}()

	select {
	case <-rootCtx.Done():
		log.Info("shutdown signal received")
	case err := <-errCh:
		if err != nil && !errors.Is(err, context.Canceled) {
			log.Error("server exited with error", zap.Error(err))
		}
	}

	shutdownCtx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("shutdown error", zap.Error(err))
	}
	log.Info("backend stopped")
}
