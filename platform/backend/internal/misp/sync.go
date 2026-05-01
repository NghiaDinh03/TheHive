package misp

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

// Taxonomy represents a MISP taxonomy for tag organization.
type Taxonomy struct {
	ID          string `json:"id"`
	Namespace   string `json:"namespace"`
	Description string `json:"description"`
	Version     int    `json:"version"`
	Enabled     bool   `json:"enabled"`
}

// TaxonomyTag represents a tag within a MISP taxonomy.
type TaxonomyTag struct {
	Tag       string `json:"tag"`
	Expanded  string `json:"expanded"`
	Colour    string `json:"colour"`
	Numerical string `json:"numerical_value"`
}

// SyncResult holds the outcome of a sync operation.
type SyncResult struct {
	EventsProcessed int       `json:"events_processed"`
	AlertsCreated   int       `json:"alerts_created"`
	AlertsUpdated   int       `json:"alerts_updated"`
	Errors          []string  `json:"errors,omitempty"`
	SyncedAt        time.Time `json:"synced_at"`
}

// SyncWorker is a background worker that periodically syncs MISP events into TheHive alerts.
type SyncWorker struct {
	client       *Client
	db           *sqlx.DB
	log          *zap.Logger
	syncInterval time.Duration
	workerID     string

	mu      sync.Mutex
	running bool
	cancel  context.CancelFunc

	// Track last sync time to avoid re-importing old events
	lastSyncTimestamp string
}

// SyncWorkerConfig holds configuration for the MISP sync worker.
type SyncWorkerConfig struct {
	SyncInterval time.Duration
	WorkerID     string
}

// NewSyncWorker creates a new MISP sync worker.
func NewSyncWorker(client *Client, db *sqlx.DB, log *zap.Logger, cfg SyncWorkerConfig) *SyncWorker {
	if cfg.SyncInterval == 0 {
		cfg.SyncInterval = 15 * time.Minute
	}
	if cfg.WorkerID == "" {
		cfg.WorkerID = fmt.Sprintf("misp-sync-%d", time.Now().UnixNano())
	}
	return &SyncWorker{
		client:       client,
		db:           db,
		log:          log,
		syncInterval: cfg.SyncInterval,
		workerID:     cfg.WorkerID,
	}
}

// Start begins the sync worker loop.
func (w *SyncWorker) Start(ctx context.Context) {
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
	w.log.Info("misp sync worker started",
		zap.String("worker_id", w.workerID),
		zap.Duration("sync_interval", w.syncInterval),
	)
}

// Stop gracefully shuts down the sync worker.
func (w *SyncWorker) Stop() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if !w.running {
		return
	}
	w.running = false
	if w.cancel != nil {
		w.cancel()
	}
	w.log.Info("misp sync worker stopped", zap.String("worker_id", w.workerID))
}

func (w *SyncWorker) loop(ctx context.Context) {
	// Run immediately on start, then on interval
	w.runSync(ctx)

	ticker := time.NewTicker(w.syncInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.runSync(ctx)
		}
	}
}

func (w *SyncWorker) runSync(ctx context.Context) {
	w.log.Info("misp sync: starting sync cycle")

	// 1. Sync taxonomies/tags
	if err := w.syncTaxonomies(ctx); err != nil {
		w.log.Error("misp sync: taxonomy sync failed", zap.Error(err))
	}

	// 2. Sync recent events as alerts
	result, err := w.syncEvents(ctx)
	if err != nil {
		w.log.Error("misp sync: event sync failed", zap.Error(err))
		w.logSyncResult(ctx, "failed", err.Error())
		return
	}

	w.log.Info("misp sync: cycle complete",
		zap.Int("events_processed", result.EventsProcessed),
		zap.Int("alerts_created", result.AlertsCreated),
		zap.Int("alerts_updated", result.AlertsUpdated),
		zap.Int("errors", len(result.Errors)),
	)
	w.logSyncResult(ctx, "success", "")
}

// syncTaxonomies fetches MISP taxonomies and syncs tags to the local database.
func (w *SyncWorker) syncTaxonomies(ctx context.Context) error {
	taxonomies, err := w.client.ListTaxonomies(ctx)
	if err != nil {
		return fmt.Errorf("list taxonomies: %w", err)
	}

	for _, tax := range taxonomies {
		if !tax.Enabled {
			continue
		}
		tags, err := w.client.GetTaxonomyTags(ctx, tax.ID)
		if err != nil {
			w.log.Warn("misp sync: failed to get taxonomy tags",
				zap.String("taxonomy", tax.Namespace),
				zap.Error(err),
			)
			continue
		}

		for _, tag := range tags {
			_, err := w.db.ExecContext(ctx,
				`INSERT INTO tags (namespace, predicate, value, colour)
				 VALUES ($1, $2, $3, $4)
				 ON CONFLICT (namespace, predicate) DO UPDATE SET value = $3, colour = $4, updated_at = now()`,
				tax.Namespace, tag.Tag, tag.Expanded, tag.Colour)
			if err != nil {
				w.log.Warn("misp sync: failed to upsert tag",
					zap.String("tag", tag.Tag),
					zap.Error(err),
				)
			}
		}
	}
	return nil
}

// syncEvents fetches recent MISP events and creates/updates TheHive alerts.
func (w *SyncWorker) syncEvents(ctx context.Context) (*SyncResult, error) {
	// Get events modified since last sync
	events, err := w.client.SearchEvents(ctx, w.lastSyncTimestamp)
	if err != nil {
		return nil, fmt.Errorf("search events: %w", err)
	}

	result := &SyncResult{SyncedAt: time.Now()}
	for _, event := range events {
		result.EventsProcessed++

		// Check if alert already exists for this MISP event (sync-loop prevention)
		var existingID string
		err := w.db.GetContext(ctx, &existingID,
			`SELECT id::text FROM alerts WHERE source = 'misp' AND source_ref = $1 LIMIT 1`,
			event.ID)

		if err == nil && existingID != "" {
			// Alert exists — update if event timestamp is newer
			if err := w.updateExistingAlert(ctx, existingID, &event); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("update alert for event %s: %v", event.ID, err))
			} else {
				result.AlertsUpdated++
			}
		} else {
			// Create new alert from MISP event
			if err := w.createAlertFromEvent(ctx, &event); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("create alert for event %s: %v", event.ID, err))
			} else {
				result.AlertsCreated++
			}
		}
	}

	// Update last sync timestamp
	w.lastSyncTimestamp = time.Now().UTC().Format("2006-01-02")
	return result, nil
}

func (w *SyncWorker) createAlertFromEvent(ctx context.Context, event *Event) error {
	tags := make([]string, 0, len(event.Tags))
	for _, t := range event.Tags {
		tags = append(tags, t.Name)
	}

	severity := mapThreatLevel(event.ThreatLevelID)
	tlp := 2 // default TLP:AMBER

	_, err := w.db.ExecContext(ctx,
		`INSERT INTO alerts (title, description, type, source, source_ref, severity, tlp, pap, status, tags)
		 VALUES ($1, $2, 'misp', 'misp', $3, $4, $5, 2, 'New', $6)`,
		fmt.Sprintf("[MISP] %s", event.Info),
		fmt.Sprintf("Imported from MISP event %s (date: %s, analysis: %s)", event.ID, event.Date, event.Analysis),
		event.ID, severity, tlp, tags)
	if err != nil {
		return err
	}

	// Import observables from MISP attributes
	for _, attr := range event.Attributes {
		obsType := MapMISPTypeToObservable(attr.Type)
		_, err := w.db.ExecContext(ctx,
			`INSERT INTO observables (alert_id, data_type, data, message, tlp, ioc, created_by)
			 SELECT a.id, $1, $2, $3, $4, $5, 'misp-sync'
			 FROM alerts a WHERE a.source = 'misp' AND a.source_ref = $6
			 LIMIT 1`,
			obsType, attr.Value, attr.Comment, tlp, attr.ToIDS, event.ID)
		if err != nil {
			w.log.Warn("misp sync: failed to create observable",
				zap.String("event_id", event.ID),
				zap.String("attr_type", attr.Type),
				zap.Error(err),
			)
		}
	}
	return nil
}

func (w *SyncWorker) updateExistingAlert(ctx context.Context, alertID string, event *Event) error {
	tags := make([]string, 0, len(event.Tags))
	for _, t := range event.Tags {
		tags = append(tags, t.Name)
	}

	_, err := w.db.ExecContext(ctx,
		`UPDATE alerts SET
			title = $1,
			description = $2,
			severity = $3,
			tags = $4,
			status = CASE WHEN status = 'Imported' THEN status ELSE 'Updated' END,
			last_sync_date = now(),
			updated_at = now()
		 WHERE id = $5::uuid`,
		fmt.Sprintf("[MISP] %s", event.Info),
		fmt.Sprintf("Updated from MISP event %s (date: %s)", event.ID, event.Date),
		mapThreatLevel(event.ThreatLevelID),
		tags,
		alertID)
	return err
}

func (w *SyncWorker) logSyncResult(ctx context.Context, status, errMsg string) {
	_, _ = w.db.ExecContext(ctx,
		`INSERT INTO misp_sync_log (server_id, direction, status, event_count, error_message)
		 VALUES ((SELECT id FROM misp_servers LIMIT 1), 'import', $1, 0, $2)`,
		status, errMsg)
}

func mapThreatLevel(level string) int {
	switch level {
	case "1":
		return 4 // High → Critical
	case "2":
		return 3 // Medium → High
	case "3":
		return 2 // Low → Medium
	case "4":
		return 1 // Undefined → Low
	default:
		return 2
	}
}

// --- Client methods for taxonomy and event search ---

// ListTaxonomies fetches the list of taxonomies from MISP.
func (c *Client) ListTaxonomies(ctx context.Context) ([]Taxonomy, error) {
	url := fmt.Sprintf("%s/taxonomies", strings.TrimRight(c.cfg.BaseURL, "/"))
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", c.cfg.APIKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("misp list taxonomies: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("misp list taxonomies: status %d: %s", resp.StatusCode, string(body))
	}

	var taxonomies []Taxonomy
	if err := json.NewDecoder(resp.Body).Decode(&taxonomies); err != nil {
		return nil, fmt.Errorf("decode taxonomies: %w", err)
	}
	return taxonomies, nil
}

// GetTaxonomyTags fetches tags for a specific taxonomy.
func (c *Client) GetTaxonomyTags(ctx context.Context, taxonomyID string) ([]TaxonomyTag, error) {
	url := fmt.Sprintf("%s/taxonomies/view/%s", strings.TrimRight(c.cfg.BaseURL, "/"), taxonomyID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", c.cfg.APIKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("misp get taxonomy tags: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("misp get taxonomy tags: status %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Entries []struct {
			Tag TaxonomyTag `json:"tag"`
		} `json:"entries"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode taxonomy tags: %w", err)
	}

	tags := make([]TaxonomyTag, 0, len(result.Entries))
	for _, e := range result.Entries {
		tags = append(tags, e.Tag)
	}
	return tags, nil
}

// SearchEvents searches for MISP events modified since a given date.
func (c *Client) SearchEvents(ctx context.Context, since string) ([]Event, error) {
	searchBody := map[string]interface{}{
		"returnFormat": "json",
		"limit":        100,
	}
	if since != "" {
		searchBody["timestamp"] = since
	}

	body, err := json.Marshal(searchBody)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/events/restSearch", strings.TrimRight(c.cfg.BaseURL, "/"))
	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", c.cfg.APIKey)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("misp search events: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("misp search events: status %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Response []struct {
			Event Event `json:"Event"`
		} `json:"response"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode search events: %w", err)
	}

	events := make([]Event, 0, len(result.Response))
	for _, r := range result.Response {
		events = append(events, r.Event)
	}
	return events, nil
}
