package opensearch

import (
	"bytes"
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

// Config holds OpenSearch connection configuration.
type Config struct {
	URL         string
	IndexPrefix string
}

// Client is the OpenSearch HTTP client.
type Client struct {
	cfg        Config
	httpClient *http.Client
}

// NewClient creates a new OpenSearch client.
func NewClient(cfg Config) *Client {
	if cfg.IndexPrefix == "" {
		cfg.IndexPrefix = "thehive"
	}
	return &Client{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// IndexName returns the full index name for an entity type.
func (c *Client) IndexName(entityType string) string {
	return fmt.Sprintf("%s-%s", c.cfg.IndexPrefix, entityType)
}

// --- Index Mappings ---

// IndexMappings defines the OpenSearch index mappings for each entity type.
var IndexMappings = map[string]string{
	"cases": `{
		"mappings": {
			"properties": {
				"number":      {"type": "integer"},
				"title":       {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
				"description": {"type": "text"},
				"severity":    {"type": "integer"},
				"tlp":         {"type": "integer"},
				"pap":         {"type": "integer"},
				"status":      {"type": "keyword"},
				"owner":       {"type": "keyword"},
				"assignee":    {"type": "keyword"},
				"tags":        {"type": "keyword"},
				"flag":        {"type": "boolean"},
				"summary":     {"type": "text"},
				"impact_status":     {"type": "keyword"},
				"resolution_status": {"type": "keyword"},
				"owning_organisation": {"type": "keyword"},
				"organisation_ids":    {"type": "keyword"},
				"start_date":  {"type": "date"},
				"end_date":    {"type": "date"},
				"created_at":  {"type": "date"},
				"updated_at":  {"type": "date"}
			}
		}
	}`,
	"alerts": `{
		"mappings": {
			"properties": {
				"title":       {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
				"description": {"type": "text"},
				"type":        {"type": "keyword"},
				"source":      {"type": "keyword"},
				"source_ref":  {"type": "keyword"},
				"severity":    {"type": "integer"},
				"tlp":         {"type": "integer"},
				"pap":         {"type": "integer"},
				"status":      {"type": "keyword"},
				"read":        {"type": "boolean"},
				"follow":      {"type": "boolean"},
				"flag":        {"type": "boolean"},
				"tags":        {"type": "keyword"},
				"organisation_id": {"type": "keyword"},
				"case_id":     {"type": "keyword"},
				"created_at":  {"type": "date"},
				"updated_at":  {"type": "date"}
			}
		}
	}`,
	"observables": `{
		"mappings": {
			"properties": {
				"data_type":   {"type": "keyword"},
				"data":        {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
				"message":     {"type": "text"},
				"tlp":         {"type": "integer"},
				"ioc":         {"type": "boolean"},
				"sighted":     {"type": "boolean"},
				"ignore_similarity": {"type": "boolean"},
				"data_hash":   {"type": "keyword"},
				"tags":        {"type": "keyword"},
				"case_id":     {"type": "keyword"},
				"alert_id":    {"type": "keyword"},
				"created_by":  {"type": "keyword"},
				"created_at":  {"type": "date"},
				"updated_at":  {"type": "date"}
			}
		}
	}`,
	"tasks": `{
		"mappings": {
			"properties": {
				"title":       {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
				"description": {"type": "text"},
				"status":      {"type": "keyword"},
				"assignee":    {"type": "keyword"},
				"group_name":  {"type": "keyword"},
				"order_index": {"type": "integer"},
				"flag":        {"type": "boolean"},
				"case_id":     {"type": "keyword"},
				"due_date":    {"type": "date"},
				"start_date":  {"type": "date"},
				"end_date":    {"type": "date"},
				"created_at":  {"type": "date"},
				"updated_at":  {"type": "date"}
			}
		}
	}`,
	"logs": `{
		"mappings": {
			"properties": {
				"message":     {"type": "text"},
				"case_id":     {"type": "keyword"},
				"task_id":     {"type": "keyword"},
				"created_by":  {"type": "keyword"},
				"created_at":  {"type": "date"}
			}
		}
	}`,
}

// EnsureIndexes creates indexes with mappings if they don't exist.
func (c *Client) EnsureIndexes(ctx context.Context) error {
	for entityType, mapping := range IndexMappings {
		indexName := c.IndexName(entityType)
		// Check if index exists
		req, _ := http.NewRequestWithContext(ctx, "HEAD", fmt.Sprintf("%s/%s", c.cfg.URL, indexName), nil)
		resp, err := c.httpClient.Do(req)
		if err != nil {
			return fmt.Errorf("check index %s: %w", indexName, err)
		}
		resp.Body.Close()

		if resp.StatusCode == 200 {
			continue // Index exists
		}

		// Create index
		req, _ = http.NewRequestWithContext(ctx, "PUT", fmt.Sprintf("%s/%s", c.cfg.URL, indexName), strings.NewReader(mapping))
		req.Header.Set("Content-Type", "application/json")
		resp, err = c.httpClient.Do(req)
		if err != nil {
			return fmt.Errorf("create index %s: %w", indexName, err)
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode != 200 && resp.StatusCode != 201 {
			return fmt.Errorf("create index %s: status %d: %s", indexName, resp.StatusCode, string(body))
		}
	}
	return nil
}

// IndexDocument indexes a single document.
func (c *Client) IndexDocument(ctx context.Context, entityType, docID string, doc interface{}) error {
	body, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("marshal document: %w", err)
	}

	url := fmt.Sprintf("%s/%s/_doc/%s", c.cfg.URL, c.IndexName(entityType), docID)
	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("index document: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("index document: status %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// DeleteDocument removes a document from the index.
func (c *Client) DeleteDocument(ctx context.Context, entityType, docID string) error {
	url := fmt.Sprintf("%s/%s/_doc/%s", c.cfg.URL, c.IndexName(entityType), docID)
	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("delete document: %w", err)
	}
	resp.Body.Close()
	return nil
}

// SearchResult holds the result of a search query.
type SearchResult struct {
	Total int                      `json:"total"`
	Hits  []map[string]interface{} `json:"hits"`
}

// Search performs a multi-index search across all entity types.
func (c *Client) Search(ctx context.Context, query string, entityTypes []string, from, size int) (*SearchResult, error) {
	if len(entityTypes) == 0 {
		entityTypes = []string{"cases", "alerts", "observables", "tasks", "logs"}
	}
	if size == 0 {
		size = 20
	}

	indexes := make([]string, 0, len(entityTypes))
	for _, et := range entityTypes {
		indexes = append(indexes, c.IndexName(et))
	}

	searchBody := map[string]interface{}{
		"track_total_hits": true,
		"query": map[string]interface{}{
			"multi_match": map[string]interface{}{
				"query":  query,
				"fields": []string{"title^3", "description^2", "data^2", "message", "summary", "source", "source_ref", "assignee", "owner"},
				"type":   "best_fields",
			},
		},
		"from": from,
		"size": size,
		"sort": []map[string]interface{}{
			{"_score": map[string]string{"order": "desc"}},
			{"updated_at": map[string]string{"order": "desc", "unmapped_type": "date"}},
		},
	}

	body, _ := json.Marshal(searchBody)
	url := fmt.Sprintf("%s/%s/_search", c.cfg.URL, strings.Join(indexes, ","))
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("opensearch search: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("opensearch search: status %d: %s", resp.StatusCode, string(respBody))
	}

	var osResp struct {
		Hits struct {
			Total struct {
				Value int `json:"value"`
			} `json:"total"`
			Hits []struct {
				Index  string                 `json:"_index"`
				ID     string                 `json:"_id"`
				Score  float64                `json:"_score"`
				Source map[string]interface{} `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&osResp); err != nil {
		return nil, fmt.Errorf("decode search response: %w", err)
	}

	hits := make([]map[string]interface{}, 0, len(osResp.Hits.Hits))
	for _, h := range osResp.Hits.Hits {
		hit := h.Source
		hit["_id"] = h.ID
		hit["_index"] = h.Index
		hit["_score"] = h.Score
		// Extract entity type from index name
		hit["_entity_type"] = strings.TrimPrefix(h.Index, c.cfg.IndexPrefix+"-")
		hits = append(hits, hit)
	}

	return &SearchResult{
		Total: osResp.Hits.Total.Value,
		Hits:  hits,
	}, nil
}

// Aggregate performs an aggregation query for dashboard widgets.
func (c *Client) Aggregate(ctx context.Context, entityType, field string, size int) (map[string]int, error) {
	if size == 0 {
		size = 20
	}

	aggBody := map[string]interface{}{
		"size": 0,
		"aggs": map[string]interface{}{
			"group_by": map[string]interface{}{
				"terms": map[string]interface{}{
					"field": field,
					"size":  size,
				},
			},
		},
	}

	body, _ := json.Marshal(aggBody)
	url := fmt.Sprintf("%s/%s/_search", c.cfg.URL, c.IndexName(entityType))
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("opensearch aggregate: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("opensearch aggregate: status %d: %s", resp.StatusCode, string(respBody))
	}

	var osResp struct {
		Aggregations struct {
			GroupBy struct {
				Buckets []struct {
					Key      string `json:"key"`
					DocCount int    `json:"doc_count"`
				} `json:"buckets"`
			} `json:"group_by"`
		} `json:"aggregations"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&osResp); err != nil {
		return nil, fmt.Errorf("decode aggregate response: %w", err)
	}

	result := make(map[string]int)
	for _, b := range osResp.Aggregations.GroupBy.Buckets {
		result[b.Key] = b.DocCount
	}
	return result, nil
}

// CountDocuments returns the document count for an index.
func (c *Client) CountDocuments(ctx context.Context, entityType string) (int, error) {
	url := fmt.Sprintf("%s/%s/_count", c.cfg.URL, c.IndexName(entityType))
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return 0, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("opensearch count: %w", err)
	}
	defer resp.Body.Close()

	var countResp struct {
		Count int `json:"count"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&countResp); err != nil {
		return 0, err
	}
	return countResp.Count, nil
}

// DateHistogramBucket represents a single bucket in a date histogram aggregation.
type DateHistogramBucket struct {
	KeyAsString string `json:"key_as_string"`
	Key         int64  `json:"key"`
	DocCount    int    `json:"doc_count"`
}

// DateHistogram performs a date histogram aggregation for time-series dashboard widgets.
func (c *Client) DateHistogram(ctx context.Context, entityType, dateField, interval string, size int) ([]DateHistogramBucket, error) {
	if size == 0 {
		size = 30
	}

	calendarInterval := "day"
	switch interval {
	case "hour", "day", "week", "month", "quarter", "year":
		calendarInterval = interval
	}

	aggBody := map[string]interface{}{
		"size": 0,
		"aggs": map[string]interface{}{
			"date_hist": map[string]interface{}{
				"date_histogram": map[string]interface{}{
					"field":             dateField,
					"calendar_interval": calendarInterval,
					"format":            "yyyy-MM-dd",
					"min_doc_count":     0,
				},
			},
		},
	}

	body, _ := json.Marshal(aggBody)
	url := fmt.Sprintf("%s/%s/_search", c.cfg.URL, c.IndexName(entityType))
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("opensearch date_histogram: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("opensearch date_histogram: status %d: %s", resp.StatusCode, string(respBody))
	}

	var osResp struct {
		Aggregations struct {
			DateHist struct {
				Buckets []DateHistogramBucket `json:"buckets"`
			} `json:"date_hist"`
		} `json:"aggregations"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&osResp); err != nil {
		return nil, fmt.Errorf("decode date_histogram response: %w", err)
	}

	// Limit to requested size (most recent buckets)
	buckets := osResp.Aggregations.DateHist.Buckets
	if len(buckets) > size {
		buckets = buckets[len(buckets)-size:]
	}
	return buckets, nil
}

// TopDocuments returns the top N documents sorted by a field (descending).
func (c *Client) TopDocuments(ctx context.Context, entityType, sortField string, size int) ([]map[string]interface{}, error) {
	if size == 0 {
		size = 10
	}

	searchBody := map[string]interface{}{
		"size": size,
		"sort": []map[string]interface{}{
			{sortField: map[string]string{"order": "desc", "unmapped_type": "date"}},
		},
	}

	body, _ := json.Marshal(searchBody)
	url := fmt.Sprintf("%s/%s/_search", c.cfg.URL, c.IndexName(entityType))
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("opensearch top documents: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("opensearch top documents: status %d: %s", resp.StatusCode, string(respBody))
	}

	var osResp struct {
		Hits struct {
			Hits []struct {
				ID     string                 `json:"_id"`
				Source map[string]interface{} `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&osResp); err != nil {
		return nil, fmt.Errorf("decode top documents response: %w", err)
	}

	docs := make([]map[string]interface{}, 0, len(osResp.Hits.Hits))
	for _, h := range osResp.Hits.Hits {
		doc := h.Source
		doc["_id"] = h.ID
		docs = append(docs, doc)
	}
	return docs, nil
}

// --- Indexer Worker ---

// IndexerWorker reads from PostgreSQL and indexes documents into OpenSearch.
type IndexerWorker struct {
	osClient     *Client
	db           *sqlx.DB
	log          *zap.Logger
	pollInterval time.Duration

	mu      sync.Mutex
	running bool
	cancel  context.CancelFunc
}

// IndexerConfig holds configuration for the indexer worker.
type IndexerConfig struct {
	PollInterval time.Duration
}

// NewIndexerWorker creates a new OpenSearch indexer worker.
func NewIndexerWorker(osClient *Client, db *sqlx.DB, log *zap.Logger, cfg IndexerConfig) *IndexerWorker {
	if cfg.PollInterval == 0 {
		cfg.PollInterval = 30 * time.Second
	}
	return &IndexerWorker{
		osClient:     osClient,
		db:           db,
		log:          log,
		pollInterval: cfg.PollInterval,
	}
}

// Start begins the indexer worker loop.
func (w *IndexerWorker) Start(ctx context.Context) {
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
	w.log.Info("opensearch indexer worker started", zap.Duration("poll_interval", w.pollInterval))
}

// Stop gracefully shuts down the indexer worker.
func (w *IndexerWorker) Stop() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if !w.running {
		return
	}
	w.running = false
	if w.cancel != nil {
		w.cancel()
	}
	w.log.Info("opensearch indexer worker stopped")
}

func (w *IndexerWorker) loop(ctx context.Context) {
	ticker := time.NewTicker(w.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.processOutbox(ctx)
		}
	}
}

func (w *IndexerWorker) processOutbox(ctx context.Context) {
	// Process pending outbox entries
	type outboxEntry struct {
		ID         string `db:"id"`
		EntityType string `db:"entity_type"`
		EntityID   string `db:"entity_id"`
		Action     string `db:"action"`
	}

	entries := []outboxEntry{}
	err := w.db.SelectContext(ctx, &entries,
		`UPDATE search_outbox SET status = 'processing', updated_at = now()
		 WHERE id IN (
			SELECT id FROM search_outbox WHERE status = 'pending'
			ORDER BY created_at ASC LIMIT 100
			FOR UPDATE SKIP LOCKED
		 )
		 RETURNING id::text, entity_type, entity_id::text, action`)
	if err != nil {
		w.log.Error("opensearch indexer: failed to claim outbox entries", zap.Error(err))
		return
	}
	if len(entries) == 0 {
		return
	}

	w.log.Info("opensearch indexer: processing outbox", zap.Int("count", len(entries)))

	for _, entry := range entries {
		var indexErr error
		switch entry.Action {
		case "index", "update":
			indexErr = w.indexEntity(ctx, entry.EntityType, entry.EntityID)
		case "delete":
			indexErr = w.osClient.DeleteDocument(ctx, entry.EntityType, entry.EntityID)
		}

		if indexErr != nil {
			w.log.Error("opensearch indexer: failed to process entry",
				zap.String("entity_type", entry.EntityType),
				zap.String("entity_id", entry.EntityID),
				zap.Error(indexErr),
			)
			_, _ = w.db.ExecContext(ctx,
				`UPDATE search_outbox SET status = 'failed', error = $1, updated_at = now() WHERE id = $2::uuid`,
				indexErr.Error(), entry.ID)
		} else {
			_, _ = w.db.ExecContext(ctx,
				`UPDATE search_outbox SET status = 'done', updated_at = now() WHERE id = $1::uuid`,
				entry.ID)
		}
	}
}

func (w *IndexerWorker) indexEntity(ctx context.Context, entityType, entityID string) error {
	var doc map[string]interface{}
	var err error

	switch entityType {
	case "cases":
		doc, err = w.fetchCase(ctx, entityID)
	case "alerts":
		doc, err = w.fetchAlert(ctx, entityID)
	case "observables":
		doc, err = w.fetchObservable(ctx, entityID)
	case "tasks":
		doc, err = w.fetchTask(ctx, entityID)
	case "logs":
		doc, err = w.fetchLog(ctx, entityID)
	default:
		return fmt.Errorf("unknown entity type: %s", entityType)
	}

	if err != nil {
		return fmt.Errorf("fetch %s %s: %w", entityType, entityID, err)
	}
	if doc == nil {
		return nil
	}

	return w.osClient.IndexDocument(ctx, entityType, entityID, doc)
}

func (w *IndexerWorker) fetchCase(ctx context.Context, id string) (map[string]interface{}, error) {
	row := map[string]interface{}{}
	err := w.db.QueryRowxContext(ctx,
		`SELECT number, title, description, severity, tlp, pap, status, owner, assignee, tags, flag, summary,
		        impact_status, resolution_status, owning_organisation, organisation_ids, start_date, end_date, created_at, updated_at
		 FROM cases WHERE id = $1::uuid`, id).MapScan(row)
	if err != nil {
		return nil, err
	}
	return row, nil
}

func (w *IndexerWorker) fetchAlert(ctx context.Context, id string) (map[string]interface{}, error) {
	row := map[string]interface{}{}
	err := w.db.QueryRowxContext(ctx,
		`SELECT title, description, type, source, source_ref, severity, tlp, pap, status, read, follow, flag,
		        tags, organisation_id, case_id, created_at, updated_at
		 FROM alerts WHERE id = $1::uuid`, id).MapScan(row)
	if err != nil {
		return nil, err
	}
	return row, nil
}

func (w *IndexerWorker) fetchObservable(ctx context.Context, id string) (map[string]interface{}, error) {
	row := map[string]interface{}{}
	err := w.db.QueryRowxContext(ctx,
		`SELECT data_type, data, message, tlp, ioc, sighted, ignore_similarity, data_hash, tags,
		        case_id, alert_id, created_by, created_at, updated_at
		 FROM observables WHERE id = $1::uuid`, id).MapScan(row)
	if err != nil {
		return nil, err
	}
	return row, nil
}

func (w *IndexerWorker) fetchTask(ctx context.Context, id string) (map[string]interface{}, error) {
	row := map[string]interface{}{}
	err := w.db.QueryRowxContext(ctx,
		`SELECT title, description, status, assignee, group_name, order_index, flag,
		        case_id, due_date, start_date, end_date, created_at, updated_at
		 FROM task_items WHERE id = $1::uuid`, id).MapScan(row)
	if err != nil {
		return nil, err
	}
	return row, nil
}

func (w *IndexerWorker) fetchLog(ctx context.Context, id string) (map[string]interface{}, error) {
	row := map[string]interface{}{}
	err := w.db.QueryRowxContext(ctx,
		`SELECT message, case_id, task_id, created_by, created_at
		 FROM case_logs WHERE id = $1::uuid`, id).MapScan(row)
	if err != nil {
		return nil, err
	}
	return row, nil
}

// RebuildIndex drops and recreates an index, then re-indexes all documents from PostgreSQL.
func (w *IndexerWorker) RebuildIndex(ctx context.Context, entityType string) (int, error) {
	// Delete existing index
	_ = w.osClient.DeleteDocument(ctx, entityType, "") // ignore error

	// Recreate index
	if err := w.osClient.EnsureIndexes(ctx); err != nil {
		return 0, fmt.Errorf("ensure indexes: %w", err)
	}

	// Re-index all documents
	var query string
	switch entityType {
	case "cases":
		query = `SELECT id::text FROM cases ORDER BY created_at`
	case "alerts":
		query = `SELECT id::text FROM alerts ORDER BY created_at`
	case "observables":
		query = `SELECT id::text FROM observables ORDER BY created_at`
	case "tasks":
		query = `SELECT id::text FROM task_items ORDER BY created_at`
	case "logs":
		query = `SELECT id::text FROM case_logs ORDER BY created_at`
	default:
		return 0, fmt.Errorf("unknown entity type: %s", entityType)
	}

	ids := []string{}
	if err := w.db.SelectContext(ctx, &ids, query); err != nil {
		return 0, fmt.Errorf("fetch ids: %w", err)
	}

	indexed := 0
	for _, id := range ids {
		if err := w.indexEntity(ctx, entityType, id); err != nil {
			w.log.Warn("rebuild index: failed to index",
				zap.String("entity_type", entityType),
				zap.String("id", id),
				zap.Error(err),
			)
			continue
		}
		indexed++
	}
	return indexed, nil
}
