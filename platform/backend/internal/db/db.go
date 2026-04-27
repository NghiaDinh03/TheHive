package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migpg "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

type Config struct {
	DSN             string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	MigrationsPath  string
}

func Open(ctx context.Context, cfg Config, log *zap.Logger) (*sqlx.DB, error) {
	conn, err := sqlx.ConnectContext(ctx, "pgx", cfg.DSN)
	if err != nil {
		return nil, fmt.Errorf("postgres connect: %w", err)
	}
	conn.SetMaxOpenConns(cfg.MaxOpenConns)
	conn.SetMaxIdleConns(cfg.MaxIdleConns)
	conn.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	if err := conn.PingContext(ctx); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("postgres ping: %w", err)
	}
	log.Info("postgres connected", zap.Int("max_open_conns", cfg.MaxOpenConns))
	return conn, nil
}

func Migrate(cfg Config, log *zap.Logger) error {
	conn, err := sqlx.Connect("pgx", cfg.DSN)
	if err != nil {
		return fmt.Errorf("migrate connect: %w", err)
	}
	defer conn.Close()

	driver, err := migpg.WithInstance(conn.DB, &migpg.Config{})
	if err != nil {
		return fmt.Errorf("migrate driver: %w", err)
	}
	m, err := migrate.NewWithDatabaseInstance(cfg.MigrationsPath, "postgres", driver)
	if err != nil {
		return fmt.Errorf("migrate init: %w", err)
	}

	err = m.Up()
	if err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate up: %w", err)
	}
	v, dirty, _ := m.Version()
	log.Info("migrations applied", zap.Uint("schema_version", v), zap.Bool("dirty", dirty))
	return nil
}

func SchemaVersion(ctx context.Context, conn *sqlx.DB) (uint, bool, error) {
	var (
		version uint
		dirty   bool
	)
	row := conn.QueryRowxContext(ctx, "SELECT version, dirty FROM schema_migrations LIMIT 1")
	if err := row.Scan(&version, &dirty); err != nil {
		return 0, false, err
	}
	return version, dirty, nil
}
