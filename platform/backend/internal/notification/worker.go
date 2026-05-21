package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/smtp"
	"strings"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

// QueueItem represents a notification in the dispatch queue.
type QueueItem struct {
	ID          string          `db:"id" json:"id"`
	ConfigID    string          `db:"config_id" json:"config_id"`
	TriggerType string          `db:"trigger_type" json:"trigger_type"`
	EntityType  string          `db:"entity_type" json:"entity_type"`
	EntityID    string          `db:"entity_id" json:"entity_id"`
	Payload     json.RawMessage `db:"payload" json:"payload"`
	Status      string          `db:"status" json:"status"`
	AdapterType string          `db:"adapter_type" json:"adapter_type"`
	RetryCount  int             `db:"retry_count" json:"retry_count"`
	MaxRetries  int             `db:"max_retries" json:"max_retries"`
	LastError   string          `db:"last_error" json:"last_error"`
	NextRetryAt *time.Time      `db:"next_retry_at" json:"next_retry_at,omitempty"`
	CreatedAt   time.Time       `db:"created_at" json:"created_at"`
	SentAt      *time.Time      `db:"sent_at" json:"sent_at,omitempty"`
	UpdatedAt   time.Time       `db:"updated_at" json:"updated_at"`
}

// DeliveryResult holds the outcome of a single delivery attempt.
type DeliveryResult struct {
	Status       string // "sent" or "failed"
	ResponseCode int
	ResponseBody string
	Error        string
	DurationMs   int
}

// Adapter is the interface for notification delivery backends.
type Adapter interface {
	Type() string
	Deliver(ctx context.Context, item QueueItem) DeliveryResult
}

// Worker is the notification dispatch worker that processes the notification queue.
type Worker struct {
	db           *sqlx.DB
	log          *zap.Logger
	adapters     map[string]Adapter
	pollInterval time.Duration
	batchSize    int
	workerID     string

	mu      sync.Mutex
	running bool
	cancel  context.CancelFunc
}

// WorkerConfig holds configuration for the notification worker.
type WorkerConfig struct {
	PollInterval time.Duration
	BatchSize    int
	WorkerID     string
}

// NewWorker creates a new notification dispatch worker.
func NewWorker(db *sqlx.DB, log *zap.Logger, cfg WorkerConfig) *Worker {
	if cfg.PollInterval == 0 {
		cfg.PollInterval = 10 * time.Second
	}
	if cfg.BatchSize == 0 {
		cfg.BatchSize = 20
	}
	if cfg.WorkerID == "" {
		cfg.WorkerID = fmt.Sprintf("notif-worker-%d", time.Now().UnixNano())
	}
	return &Worker{
		db:           db,
		log:          log,
		adapters:     make(map[string]Adapter),
		pollInterval: cfg.PollInterval,
		batchSize:    cfg.BatchSize,
		workerID:     cfg.WorkerID,
	}
}

// RegisterAdapter registers a delivery adapter (webhook, email, etc.).
func (w *Worker) RegisterAdapter(adapter Adapter) {
	w.adapters[adapter.Type()] = adapter
}

// Start begins the worker loop.
func (w *Worker) Start(ctx context.Context) {
	w.mu.Lock()
	if w.running {
		w.mu.Unlock()
		return
	}
	w.running = true
	workerCtx, cancel := context.WithCancel(ctx)
	w.cancel = cancel
	w.mu.Unlock()

	go w.loop(workerCtx)
	w.log.Info("notification worker started",
		zap.String("worker_id", w.workerID),
		zap.Duration("poll_interval", w.pollInterval),
		zap.Int("batch_size", w.batchSize),
		zap.Int("adapters", len(w.adapters)),
	)
}

// Stop gracefully shuts down the worker.
func (w *Worker) Stop() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if !w.running {
		return
	}
	w.running = false
	if w.cancel != nil {
		w.cancel()
	}
	w.log.Info("notification worker stopped", zap.String("worker_id", w.workerID))
}

// Enqueue adds a notification to the dispatch queue.
func Enqueue(ctx context.Context, db *sqlx.DB, configID, triggerType, entityType, entityID, adapterType string, payload json.RawMessage) error {
	_, err := db.ExecContext(ctx,
		`INSERT INTO notification_queue (config_id, trigger_type, entity_type, entity_id, payload, adapter_type)
		 VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6)`,
		configID, triggerType, entityType, entityID, payload, adapterType)
	return err
}

func (w *Worker) loop(ctx context.Context) {
	ticker := time.NewTicker(w.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.processBatch(ctx)
		}
	}
}

func (w *Worker) processBatch(ctx context.Context) {
	items, err := w.claimPending(ctx)
	if err != nil {
		w.log.Error("notification worker: failed to claim items", zap.Error(err))
		return
	}
	if len(items) == 0 {
		return
	}

	w.log.Info("notification worker: processing batch", zap.Int("count", len(items)))

	for _, item := range items {
		w.processItem(ctx, item)
	}
}

func (w *Worker) claimPending(ctx context.Context) ([]QueueItem, error) {
	items := []QueueItem{}
	err := w.db.SelectContext(ctx, &items,
		`UPDATE notification_queue
		 SET status = 'sending', updated_at = now()
		 WHERE id IN (
			SELECT id FROM notification_queue
			WHERE status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= now())
			ORDER BY created_at ASC
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		 )
		 RETURNING id::text, config_id::text, trigger_type, entity_type, entity_id::text, payload, status, adapter_type, retry_count, max_retries, last_error, next_retry_at, created_at, sent_at, updated_at`,
		w.batchSize)
	return items, err
}

func (w *Worker) processItem(ctx context.Context, item QueueItem) {
	log := w.log.With(
		zap.String("queue_id", item.ID),
		zap.String("trigger", item.TriggerType),
		zap.String("adapter", item.AdapterType),
	)

	adapter, ok := w.adapters[item.AdapterType]
	if !ok {
		log.Error("notification worker: no adapter registered", zap.String("adapter_type", item.AdapterType))
		w.markFailed(ctx, item, "no adapter registered for type: "+item.AdapterType)
		return
	}

	start := time.Now()
	result := adapter.Deliver(ctx, item)
	result.DurationMs = int(time.Since(start).Milliseconds())

	w.logDelivery(ctx, item.ID, item.RetryCount+1, result)

	if result.Status == "sent" {
		w.markSent(ctx, item)
		log.Info("notification worker: delivered successfully",
			zap.Int("duration_ms", result.DurationMs),
		)
	} else {
		if item.RetryCount+1 >= item.MaxRetries {
			w.markDead(ctx, item, result.Error)
			log.Warn("notification worker: moved to dead letter",
				zap.Int("retries", item.RetryCount+1),
				zap.String("error", result.Error),
			)
		} else {
			w.markRetry(ctx, item, result.Error)
			log.Warn("notification worker: will retry",
				zap.Int("retry", item.RetryCount+1),
				zap.String("error", result.Error),
			)
		}
	}
}

func (w *Worker) markSent(ctx context.Context, item QueueItem) {
	_, _ = w.db.ExecContext(ctx,
		`UPDATE notification_queue SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = $1::uuid`,
		item.ID)
}

func (w *Worker) markFailed(ctx context.Context, item QueueItem, errMsg string) {
	_, _ = w.db.ExecContext(ctx,
		`UPDATE notification_queue SET status = 'failed', last_error = $1, retry_count = retry_count + 1, updated_at = now() WHERE id = $2::uuid`,
		errMsg, item.ID)
}

func (w *Worker) markDead(ctx context.Context, item QueueItem, errMsg string) {
	_, _ = w.db.ExecContext(ctx,
		`UPDATE notification_queue SET status = 'dead', last_error = $1, retry_count = retry_count + 1, updated_at = now() WHERE id = $2::uuid`,
		errMsg, item.ID)
}

func (w *Worker) markRetry(ctx context.Context, item QueueItem, errMsg string) {
	backoff := time.Duration(30*(1<<item.RetryCount)) * time.Second
	nextRetry := time.Now().Add(backoff)
	_, _ = w.db.ExecContext(ctx,
		`UPDATE notification_queue SET status = 'pending', last_error = $1, retry_count = retry_count + 1, next_retry_at = $2, updated_at = now() WHERE id = $3::uuid`,
		errMsg, nextRetry, item.ID)
}

func (w *Worker) logDelivery(ctx context.Context, queueID string, attempt int, result DeliveryResult) {
	_, _ = w.db.ExecContext(ctx,
		`INSERT INTO notification_delivery_log (queue_id, attempt, status, response_code, response_body, error_message, duration_ms)
		 VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)`,
		queueID, attempt, result.Status, result.ResponseCode, result.ResponseBody, result.Error, result.DurationMs)
}

// --- Webhook Adapter ---

// WebhookAdapter delivers notifications via HTTP POST to a configured URL.
type WebhookAdapter struct {
	httpClient *http.Client
}

// WebhookConfig holds the webhook URL and optional headers from notification_configs.
type WebhookConfig struct {
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers,omitempty"`
	Secret  string            `json:"secret,omitempty"`
}

// NewWebhookAdapter creates a new webhook adapter.
func NewWebhookAdapter() *WebhookAdapter {
	return &WebhookAdapter{
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func (a *WebhookAdapter) Type() string { return "webhook" }

func (a *WebhookAdapter) Deliver(ctx context.Context, item QueueItem) DeliveryResult {
	var cfg WebhookConfig
	if err := json.Unmarshal(item.Payload, &cfg); err != nil {
		return DeliveryResult{Status: "failed", Error: fmt.Sprintf("invalid webhook config: %v", err)}
	}
	if cfg.URL == "" {
		return DeliveryResult{Status: "failed", Error: "webhook URL is empty"}
	}

	notifPayload, _ := json.Marshal(map[string]interface{}{
		"trigger":     item.TriggerType,
		"entity_type": item.EntityType,
		"entity_id":   item.EntityID,
		"config_id":   item.ConfigID,
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
		"data":        json.RawMessage(item.Payload),
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.URL, bytes.NewReader(notifPayload))
	if err != nil {
		return DeliveryResult{Status: "failed", Error: fmt.Sprintf("create request: %v", err)}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "TheHive-Platform-Notification/1.0")
	for k, v := range cfg.Headers {
		req.Header.Set(k, v)
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return DeliveryResult{Status: "failed", Error: fmt.Sprintf("http request: %v", err)}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return DeliveryResult{
			Status:       "sent",
			ResponseCode: resp.StatusCode,
			ResponseBody: string(body),
		}
	}
	return DeliveryResult{
		Status:       "failed",
		ResponseCode: resp.StatusCode,
		ResponseBody: string(body),
		Error:        fmt.Sprintf("webhook returned status %d", resp.StatusCode),
	}
}

// --- Email Adapter ---

// EmailAdapter delivers notifications via SMTP email.
type EmailAdapter struct {
	db *sqlx.DB
}

// EmailConfig holds the email destination from notification_configs.
type EmailConfig struct {
	To      []string `json:"to"`
	Subject string   `json:"subject,omitempty"`
}

// SmtpConfig holds the SMTP server connection settings from ui_settings.
type SmtpConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"user"`
	Password string `json:"pass"`
	From     string `json:"from"`
	Enabled  bool   `json:"enabled"`
}

// NewEmailAdapter creates a new email adapter.
func NewEmailAdapter(db *sqlx.DB) *EmailAdapter {
	return &EmailAdapter{db: db}
}

func (a *EmailAdapter) Type() string { return "email" }

func (a *EmailAdapter) Deliver(ctx context.Context, item QueueItem) DeliveryResult {
	var cfg EmailConfig
	if err := json.Unmarshal(item.Payload, &cfg); err != nil {
		return DeliveryResult{Status: "failed", Error: fmt.Sprintf("invalid email config: %v", err)}
	}
	if len(cfg.To) == 0 {
		return DeliveryResult{Status: "failed", Error: "no email recipients"}
	}

	subject := cfg.Subject
	if subject == "" {
		subject = fmt.Sprintf("[TheHive] %s - %s %s", item.TriggerType, item.EntityType, item.EntityID)
	}

	body := fmt.Sprintf("TheHive Platform Notification\n\nTrigger: %s\nEntity: %s %s\nTime: %s\n\nPayload:\n%s",
		item.TriggerType, item.EntityType, item.EntityID,
		time.Now().UTC().Format(time.RFC3339),
		string(item.Payload),
	)

	var smtpCfg SmtpConfig
	var val []byte
	err := a.db.GetContext(ctx, &val, "SELECT value FROM ui_settings WHERE key = 'smtp_config'")
	if err == nil && len(val) > 0 {
		_ = json.Unmarshal(val, &smtpCfg)
	}
	
	if !smtpCfg.Enabled || smtpCfg.Host == "" {
		return DeliveryResult{Status: "failed", Error: "SMTP configuration is disabled or missing"}
	}

	addr := fmt.Sprintf("%s:%d", smtpCfg.Host, smtpCfg.Port)
	msg := strings.Join([]string{
		"From: " + smtpCfg.From,
		"To: " + strings.Join(cfg.To, ", "),
		"Subject: " + subject,
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")

	var auth smtp.Auth
	if smtpCfg.Username != "" {
		auth = smtp.PlainAuth("", smtpCfg.Username, smtpCfg.Password, smtpCfg.Host)
	}

	err = smtp.SendMail(addr, auth, smtpCfg.From, cfg.To, []byte(msg))
	if err != nil {
		return DeliveryResult{Status: "failed", Error: fmt.Sprintf("smtp send: %v", err)}
	}

	return DeliveryResult{
		Status:       "sent",
		ResponseBody: fmt.Sprintf("sent to %d recipients", len(cfg.To)),
	}
}
