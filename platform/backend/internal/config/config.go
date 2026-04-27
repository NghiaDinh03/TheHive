package config

import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v10"
)

type Config struct {
	AppName  string `env:"APP_NAME" envDefault:"thehive-platform-backend"`
	AppEnv   string `env:"APP_ENV" envDefault:"development"`
	HTTPAddr string `env:"HTTP_ADDR" envDefault:":8080"`
	LogLevel string `env:"LOG_LEVEL" envDefault:"info"`

	PostgresDSN            string        `env:"POSTGRES_DSN,required"`
	PostgresMaxOpenConns   int           `env:"POSTGRES_MAX_OPEN_CONNS" envDefault:"25"`
	PostgresMaxIdleConns   int           `env:"POSTGRES_MAX_IDLE_CONNS" envDefault:"5"`
	PostgresConnMaxLife    time.Duration `env:"POSTGRES_CONN_MAX_LIFETIME" envDefault:"30m"`
	PostgresMigrationsPath string        `env:"POSTGRES_MIGRATIONS_PATH" envDefault:"file://migrations"`

	RabbitURL              string        `env:"RABBITMQ_URL,required"`
	RabbitConnectTimeout   time.Duration `env:"RABBITMQ_CONNECT_TIMEOUT" envDefault:"30s"`
	RabbitReconnectBackoff time.Duration `env:"RABBITMQ_RECONNECT_BACKOFF" envDefault:"5s"`

	JWTSecret      string        `env:"JWT_SECRET,required"`
	JWTExpiry      time.Duration `env:"JWT_EXPIRY" envDefault:"1h"`
	CORSAllowed    []string      `env:"CORS_ALLOWED_ORIGINS" envSeparator:"," envDefault:"http://localhost:3000"`
	RequestTimeout time.Duration `env:"REQUEST_TIMEOUT" envDefault:"30s"`

	InvestigationDataSource string        `env:"INVESTIGATION_DATA_SOURCE" envDefault:"postgres"`
	LegacyTheHiveURL        string        `env:"LEGACY_THEHIVE_URL"`
	LegacyTheHiveAPIKey     string        `env:"LEGACY_THEHIVE_API_KEY"`
	LegacyTheHiveTimeout    time.Duration `env:"LEGACY_THEHIVE_TIMEOUT" envDefault:"10s"`

	MailEnabled   bool   `env:"MAIL_ENABLED" envDefault:"false"`
	MailHost      string `env:"MAIL_HOST" envDefault:"mailpit"`
	MailPort      int    `env:"MAIL_PORT" envDefault:"1025"`
	MailUsername  string `env:"MAIL_USERNAME"`
	MailPassword  string `env:"MAIL_PASSWORD"`
	MailFrom      string `env:"MAIL_FROM" envDefault:"thehive@localhost"`
	PublicBaseURL string `env:"PUBLIC_BASE_URL" envDefault:"http://localhost:3000"`

	ShutdownGrace time.Duration `env:"SHUTDOWN_GRACE_PERIOD" envDefault:"15s"`
}

func Load() (Config, error) {
	var c Config
	if err := env.Parse(&c); err != nil {
		return Config{}, fmt.Errorf("load config: %w", err)
	}
	if len(c.JWTSecret) < 32 && c.AppEnv != "development" {
		return Config{}, fmt.Errorf("JWT_SECRET must be >=32 chars in non-development env")
	}
	return c, nil
}
