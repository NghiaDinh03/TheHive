package cortex

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

type Analyzer struct {
	ID        string   `db:"id" json:"id"`
	AnalyzerID string  `db:"analyzer_id" json:"analyzer_id"`
	Name      string   `db:"name" json:"name"`
	Version   string   `db:"version" json:"version"`
	DataTypes []string `db:"data_types" json:"data_types"`
	Enabled   bool     `db:"enabled" json:"enabled"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type Job struct {
	ID           string          `db:"id" json:"id"`
	ObservableID string          `db:"observable_id" json:"observable_id"`
	AnalyzerID   string          `db:"analyzer_id" json:"analyzer_id"`
	Status       string          `db:"status" json:"status"`
	Request      json.RawMessage `db:"request" json:"request"`
	Report       json.RawMessage `db:"report" json:"report"`
	Error        string          `db:"error" json:"error"`
	CreatedBy    string          `db:"created_by" json:"created_by"`
	CreatedAt    time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time       `db:"updated_at" json:"updated_at"`
}

type CreateJobInput struct {
	ObservableID string
	AnalyzerID   string
	DataType     string
	Data         string
	CreatedBy    string
}

type Service struct {
	db *sqlx.DB
}

func NewService(db *sqlx.DB) *Service {
	return &Service{db: db}
}

func (s *Service) ListAnalyzers(ctx context.Context) ([]Analyzer, error) {
	rows := []Analyzer{}
	err := s.db.SelectContext(ctx, &rows,
		`SELECT id::text, analyzer_id, name, version, data_types, enabled, created_at, updated_at
		 FROM cortex_analyzer_catalog WHERE enabled = true ORDER BY name`)
	return rows, err
}

func (s *Service) ListAnalyzersForType(ctx context.Context, dataType string) ([]Analyzer, error) {
	rows := []Analyzer{}
	err := s.db.SelectContext(ctx, &rows,
		`SELECT id::text, analyzer_id, name, version, data_types, enabled, created_at, updated_at
		 FROM cortex_analyzer_catalog WHERE enabled = true AND $1 = ANY(data_types) ORDER BY name`,
		strings.TrimSpace(dataType))
	return rows, err
}

func (s *Service) CreateJob(ctx context.Context, input CreateJobInput) (Job, error) {
	reqJSON, _ := json.Marshal(map[string]string{
		"data_type": input.DataType,
		"data":      input.Data,
	})
	row := Job{}
	err := s.db.GetContext(ctx, &row,
		`INSERT INTO cortex_jobs (observable_id, analyzer_id, status, request, created_by)
		 VALUES ($1::uuid, $2, 'queued', $3, $4)
		 RETURNING id::text, observable_id::text, analyzer_id, status, request, report, error, created_by, created_at, updated_at`,
		input.ObservableID, input.AnalyzerID, reqJSON, input.CreatedBy)
	return row, err
}

func (s *Service) GetJob(ctx context.Context, jobID string) (Job, error) {
	row := Job{}
	err := s.db.GetContext(ctx, &row,
		`SELECT id::text, observable_id::text, analyzer_id, status, request, report, error, created_by, created_at, updated_at
		 FROM cortex_jobs WHERE id = $1::uuid`, jobID)
	return row, err
}

func (s *Service) ListJobsForObservable(ctx context.Context, observableID string) ([]Job, error) {
	rows := []Job{}
	err := s.db.SelectContext(ctx, &rows,
		`SELECT id::text, observable_id::text, analyzer_id, status, request, report, error, created_by, created_at, updated_at
		 FROM cortex_jobs WHERE observable_id = $1::uuid ORDER BY created_at DESC`,
		observableID)
	return rows, err
}

func (s *Service) CompleteJob(ctx context.Context, jobID string, report json.RawMessage) (Job, error) {
	row := Job{}
	err := s.db.GetContext(ctx, &row,
		`UPDATE cortex_jobs SET status = 'completed', report = $1, updated_at = now()
		 WHERE id = $2::uuid
		 RETURNING id::text, observable_id::text, analyzer_id, status, request, report, error, created_by, created_at, updated_at`,
		report, jobID)
	return row, err
}

func (s *Service) FailJob(ctx context.Context, jobID string, errMsg string) (Job, error) {
	row := Job{}
	err := s.db.GetContext(ctx, &row,
		`UPDATE cortex_jobs SET status = 'failed', error = $1, updated_at = now()
		 WHERE id = $2::uuid
		 RETURNING id::text, observable_id::text, analyzer_id, status, request, report, error, created_by, created_at, updated_at`,
		errMsg, jobID)
	return row, err
}

// ClaimPendingJobs atomically claims queued jobs for a worker, preventing double-processing.
func (s *Service) ClaimPendingJobs(ctx context.Context, workerID string, limit int) ([]Job, error) {
	if limit <= 0 {
		limit = 10
	}
	rows := []Job{}
	err := s.db.SelectContext(ctx, &rows,
		`UPDATE cortex_jobs SET status = 'running', worker_id = $1, started_at = now(), updated_at = now()
		 WHERE id IN (
			SELECT id FROM cortex_jobs WHERE status = 'queued' AND retry_count < max_retries
			ORDER BY created_at ASC LIMIT $2 FOR UPDATE SKIP LOCKED
		 )
		 RETURNING id::text, observable_id::text, analyzer_id, status, request, report, error, created_by, created_at, updated_at`,
		workerID, limit)
	return rows, err
}

// ProcessPendingJobs processes queued jobs using the fake Cortex worker (for dev/test).
// Production should use ClaimPendingJobs + real Cortex API calls.
func (s *Service) ProcessPendingJobs(ctx context.Context) (int, error) {
	workerID := fmt.Sprintf("fake-worker-%d", time.Now().UnixNano())
	jobs, err := s.ClaimPendingJobs(ctx, workerID, 10)
	if err != nil {
		return 0, err
	}
	processed := 0
	for _, job := range jobs {
		report, _ := json.Marshal(map[string]interface{}{
			"summary":    fmt.Sprintf("Analysis complete for %s", job.AnalyzerID),
			"taxonomies": []map[string]interface{}{{"level": "info", "namespace": job.AnalyzerID, "predicate": "status", "value": "clean"}},
			"full":       map[string]interface{}{"analyzer": job.AnalyzerID, "status": "completed", "message": "No threats detected"},
		})
		if _, err := s.CompleteJob(ctx, job.ID, report); err != nil {
			_, _ = s.FailJob(ctx, job.ID, err.Error())
			// Increment retry count
			_, _ = s.db.ExecContext(ctx, `UPDATE cortex_jobs SET retry_count = retry_count + 1, updated_at = now() WHERE id = $1::uuid`, job.ID)
			continue
		}
		// Mark completed_at
		_, _ = s.db.ExecContext(ctx, `UPDATE cortex_jobs SET completed_at = now() WHERE id = $1::uuid`, job.ID)
		processed++
	}
	return processed, nil
}

// RetryFailedJobs requeues failed jobs that haven't exceeded max_retries.
func (s *Service) RetryFailedJobs(ctx context.Context) (int, error) {
	result, err := s.db.ExecContext(ctx,
		`UPDATE cortex_jobs SET status = 'queued', error = '', worker_id = '', started_at = NULL, updated_at = now()
		 WHERE status = 'failed' AND retry_count < max_retries`)
	if err != nil {
		return 0, err
	}
	n, _ := result.RowsAffected()
	return int(n), nil
}

// JobStats returns aggregate counts by status for monitoring.
func (s *Service) JobStats(ctx context.Context) (map[string]int, error) {
	type row struct {
		Status string `db:"status"`
		Count  int    `db:"count"`
	}
	rows := []row{}
	if err := s.db.SelectContext(ctx, &rows, `SELECT status, COUNT(*)::int AS count FROM cortex_jobs GROUP BY status`); err != nil {
		return nil, err
	}
	stats := map[string]int{}
	for _, r := range rows {
		stats[r.Status] = r.Count
	}
	return stats, nil
}
