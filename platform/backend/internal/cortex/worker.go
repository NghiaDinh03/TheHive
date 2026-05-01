package cortex

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Worker is a background worker that claims queued Cortex jobs from the database,
// submits them to a real Cortex server via CortexClient, waits for results,
// and persists the report or error back to the database.
//
// This replaces the fake/dev ProcessPendingJobs path with production-ready behavior.
type Worker struct {
	svc          *Service
	client       *CortexClient
	log          *zap.Logger
	workerID     string
	pollInterval time.Duration
	batchSize    int
	maxJobWait   time.Duration

	mu      sync.Mutex
	running bool
	cancel  context.CancelFunc
}

// WorkerConfig holds configuration for the Cortex worker.
type WorkerConfig struct {
	PollInterval time.Duration
	BatchSize    int
	MaxJobWait   time.Duration
	WorkerID     string
}

// NewWorker creates a new Cortex worker.
func NewWorker(svc *Service, client *CortexClient, log *zap.Logger, cfg WorkerConfig) *Worker {
	if cfg.PollInterval == 0 {
		cfg.PollInterval = 30 * time.Second
	}
	if cfg.BatchSize == 0 {
		cfg.BatchSize = 5
	}
	if cfg.MaxJobWait == 0 {
		cfg.MaxJobWait = 5 * time.Minute
	}
	if cfg.WorkerID == "" {
		cfg.WorkerID = fmt.Sprintf("cortex-worker-%d", time.Now().UnixNano())
	}
	return &Worker{
		svc:          svc,
		client:       client,
		log:          log,
		workerID:     cfg.WorkerID,
		pollInterval: cfg.PollInterval,
		batchSize:    cfg.BatchSize,
		maxJobWait:   cfg.MaxJobWait,
	}
}

// Start begins the worker loop in a goroutine. It claims queued jobs, submits them
// to Cortex, and persists results. Call Stop() to shut down gracefully.
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
	w.log.Info("cortex worker started",
		zap.String("worker_id", w.workerID),
		zap.Duration("poll_interval", w.pollInterval),
		zap.Int("batch_size", w.batchSize),
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
	w.log.Info("cortex worker stopped", zap.String("worker_id", w.workerID))
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
	jobs, err := w.svc.ClaimPendingJobs(ctx, w.workerID, w.batchSize)
	if err != nil {
		w.log.Error("cortex worker: failed to claim jobs", zap.Error(err))
		return
	}
	if len(jobs) == 0 {
		return
	}

	w.log.Info("cortex worker: claimed jobs",
		zap.Int("count", len(jobs)),
		zap.String("worker_id", w.workerID),
	)

	for _, job := range jobs {
		w.processJob(ctx, job)
	}
}

func (w *Worker) processJob(ctx context.Context, job Job) {
	log := w.log.With(
		zap.String("job_id", job.ID),
		zap.String("analyzer_id", job.AnalyzerID),
		zap.String("observable_id", job.ObservableID),
	)

	// Parse the request payload to get data_type and data
	var reqPayload struct {
		DataType string `json:"data_type"`
		Data     string `json:"data"`
		TLP      int    `json:"tlp"`
		PAP      int    `json:"pap"`
	}
	if err := json.Unmarshal(job.Request, &reqPayload); err != nil {
		log.Error("cortex worker: failed to parse job request", zap.Error(err))
		w.failJob(ctx, job.ID, fmt.Sprintf("invalid request payload: %v", err))
		return
	}

	// Submit to real Cortex
	log.Info("cortex worker: submitting job to Cortex")
	cortexJob, err := w.client.RunAnalyzer(ctx, job.AnalyzerID, CortexJobRequest{
		Data:     reqPayload.Data,
		DataType: reqPayload.DataType,
		TLP:      reqPayload.TLP,
		PAP:      reqPayload.PAP,
	})
	if err != nil {
		log.Error("cortex worker: failed to submit job", zap.Error(err))
		w.failJob(ctx, job.ID, fmt.Sprintf("cortex submit failed: %v", err))
		return
	}

	// Wait for Cortex to complete the job
	log.Info("cortex worker: waiting for Cortex job",
		zap.String("cortex_job_id", cortexJob.ID),
	)
	result, err := w.client.WaitForJob(ctx, cortexJob.ID, 3*time.Second, w.maxJobWait)
	if err != nil {
		log.Error("cortex worker: job failed or timed out", zap.Error(err))
		w.failJob(ctx, job.ID, fmt.Sprintf("cortex execution failed: %v", err))
		return
	}

	// Persist the report
	report := result.Report
	if report == nil {
		report = json.RawMessage(`{"status":"completed","message":"no report returned"}`)
	}

	if _, err := w.svc.CompleteJob(ctx, job.ID, report); err != nil {
		log.Error("cortex worker: failed to persist report", zap.Error(err))
		w.failJob(ctx, job.ID, fmt.Sprintf("persist report failed: %v", err))
		return
	}

	// Mark completed_at
	_, _ = w.svc.db.ExecContext(ctx,
		`UPDATE cortex_jobs SET completed_at = now() WHERE id = $1::uuid`, job.ID)

	log.Info("cortex worker: job completed successfully",
		zap.String("cortex_job_id", cortexJob.ID),
	)
}

func (w *Worker) failJob(ctx context.Context, jobID string, errMsg string) {
	if _, err := w.svc.FailJob(ctx, jobID, errMsg); err != nil {
		w.log.Error("cortex worker: failed to mark job as failed",
			zap.String("job_id", jobID),
			zap.Error(err),
		)
	}
	// Increment retry count
	_, _ = w.svc.db.ExecContext(ctx,
		`UPDATE cortex_jobs SET retry_count = retry_count + 1, updated_at = now() WHERE id = $1::uuid`, jobID)
}
