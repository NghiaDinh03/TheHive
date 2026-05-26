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

	JWTSecret         string        `env:"JWT_SECRET,required"`
	JWTPrivateKeyPath string        `env:"JWT_PRIVATE_KEY_PATH"`
	JWTPublicKeyPath  string        `env:"JWT_PUBLIC_KEY_PATH"`
	JWTExpiry         time.Duration `env:"JWT_EXPIRY" envDefault:"1h"`
	CORSAllowed       []string      `env:"CORS_ALLOWED_ORIGINS" envSeparator:"," envDefault:"http://localhost:3000"`
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

	S3Endpoint        string        `env:"S3_ENDPOINT" envDefault:"http://minio:9000"`
	S3PublicEndpoint  string        `env:"S3_PUBLIC_ENDPOINT" envDefault:"http://localhost:9000"`
	S3Region          string        `env:"S3_REGION" envDefault:"us-east-1"`
	S3AccessKeyID     string        `env:"S3_ACCESS_KEY_ID" envDefault:"thehive"`
	S3SecretAccessKey string        `env:"S3_SECRET_ACCESS_KEY" envDefault:"thehive-secret"`
	S3Bucket          string        `env:"S3_BUCKET" envDefault:"thehive-attachments"`
	S3UsePathStyle    bool          `env:"S3_USE_PATH_STYLE" envDefault:"true"`
	S3UploadTTL       time.Duration `env:"S3_UPLOAD_TTL" envDefault:"15m"`
	S3DownloadTTL     time.Duration `env:"S3_DOWNLOAD_TTL" envDefault:"5m"`

	AttachmentScannerEngine   string `env:"ATTACHMENT_SCANNER_ENGINE" envDefault:"placeholder"`
	AttachmentDownloadPolicy  string `env:"ATTACHMENT_DOWNLOAD_POLICY" envDefault:"clean-only"`
	AttachmentQueueOnUpload   bool   `env:"ATTACHMENT_QUEUE_ON_UPLOAD" envDefault:"true"`
	AttachmentManualScanAllow bool   `env:"ATTACHMENT_MANUAL_SCAN_ALLOW" envDefault:"true"`
	AttachmentZipPassword     string `env:"ATTACHMENT_ZIP_PASSWORD" envDefault:"malware"`

	// --- MISP integration ---
	MISPEnabled   bool          `env:"MISP_ENABLED" envDefault:"false"`
	MISPURL       string        `env:"MISP_URL"`
	MISPAPIKey    string        `env:"MISP_API_KEY"`
	MISPTimeout   time.Duration `env:"MISP_TIMEOUT" envDefault:"30s"`
	MISPVerifyTLS bool          `env:"MISP_VERIFY_TLS" envDefault:"true"`

	// --- Cortex integration ---
	CortexEnabled      bool          `env:"CORTEX_ENABLED" envDefault:"false"`
	CortexURL          string        `env:"CORTEX_URL"`
	CortexAPIKey       string        `env:"CORTEX_API_KEY"`
	CortexTimeout      time.Duration `env:"CORTEX_TIMEOUT" envDefault:"30s"`
	CortexPollInterval time.Duration `env:"CORTEX_POLL_INTERVAL" envDefault:"30s"`
	CortexBatchSize    int           `env:"CORTEX_BATCH_SIZE" envDefault:"5"`
	CortexMaxJobWait   time.Duration `env:"CORTEX_MAX_JOB_WAIT" envDefault:"5m"`

	// --- Notification worker ---
	NotificationWorkerEnabled      bool          `env:"NOTIFICATION_WORKER_ENABLED" envDefault:"true"`
	NotificationWorkerPollInterval time.Duration `env:"NOTIFICATION_WORKER_POLL_INTERVAL" envDefault:"10s"`
	NotificationWorkerBatchSize    int           `env:"NOTIFICATION_WORKER_BATCH_SIZE" envDefault:"20"`

	// --- MISP scheduled sync ---
	MISPSyncEnabled  bool          `env:"MISP_SYNC_ENABLED" envDefault:"false"`
	MISPSyncInterval time.Duration `env:"MISP_SYNC_INTERVAL" envDefault:"15m"`

	// --- OpenSearch ---
	OpenSearchEnabled bool   `env:"OPENSEARCH_ENABLED" envDefault:"false"`
	OpenSearchURL     string `env:"OPENSEARCH_URL" envDefault:"http://opensearch:9200"`
	OpenSearchIndex   string `env:"OPENSEARCH_INDEX_PREFIX" envDefault:"thehive"`

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
