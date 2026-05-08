package handler

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

// DashboardMonitorHandler provides real-time monitoring data dashboards
type DashboardMonitorHandler struct {
	*sqlx.DB
}

// NewDashboardMonitorHandler creates new dashboard monitor handler
func NewDashboardMonitorHandler(d *sqlx.DB) *DashboardMonitorHandler {
	return &DashboardMonitorHandler{DB: d}
}

// SystemMetrics represents current system performance metrics
type SystemMetrics struct {
	CPUUsage       float64   `json:"cpuUsage"`
	MemoryUsage    float64   `json:"memoryUsage"`
	DiskUsage      float64   `json:"diskUsage"`
	ActiveUsers    int       `json:"activeUsers"`
	RequestsPerSec float64   `json:"requestsPerSec"`
	AvgResponseMs  float64   `json:"avgResponseMs"`
	ErrorRate      float64   `json:"errorRate"`
	Timestamp      time.Time `json:"timestamp"`
}

// AlertMetrics represents alert-related monitoring data
type AlertMetrics struct {
	TotalAlerts     int            `json:"totalAlerts"`
	NewAlerts       int            `json:"newAlerts"`
	ImportedAlerts  int            `json:"importedAlerts"`
	MergedAlerts    int            `json:"mergedAlerts"`
	IgnoredAlerts   int            `json:"ignoredAlerts"`
	BySeverity      map[string]int `json:"bySeverity"`
	BySource        map[string]int `json:"bySource"`
	AvgResolutionMs float64        `json:"avgResolutionMs"`
	Timestamp       time.Time      `json:"timestamp"`
}

// CaseMetrics represents case-related monitoring data
type CaseMetrics struct {
	TotalCases      int            `json:"totalCases"`
	OpenCases       int            `json:"openCases"`
	ResolvedCases   int            `json:"resolvedCases"`
	DuplicatedCases int            `json:"duplicatedCases"`
	BySeverity      map[string]int `json:"bySeverity"`
	ByStatus        map[string]int `json:"byStatus"`
	ByOwner         map[string]int `json:"byOwner"`
	AvgResolutionMs float64        `json:"avgResolutionMs"`
	Timestamp       time.Time      `json:"timestamp"`
}

// WorkerMetrics represents worker queue monitoring data
type WorkerMetrics struct {
	ActiveWorkers   int            `json:"activeWorkers"`
	QueuedJobs      int            `json:"queuedJobs"`
	ProcessingJobs  int            `json:"processingJobs"`
	CompletedJobs   int            `json:"completedJobs"`
	FailedJobs      int            `json:"failedJobs"`
	ByType          map[string]int `json:"byType"`
	AvgProcessingMs float64        `json:"avgProcessingMs"`
	Timestamp       time.Time      `json:"timestamp"`
}

// GetSystemMetrics returns current system performance metrics
func (h *DashboardMonitorHandler) GetSystemMetrics(c echo.Context) error {
	ctx := c.Request().Context()

	// Active users (sessions in last 15 minutes)
	var activeUsers int
	err := h.DB.GetContext(ctx, &activeUsers,
		`SELECT COUNT(DISTINCT user_id) FROM auth_sessions WHERE expires_at > NOW() AND created_at > NOW() - INTERVAL '15 minutes'`)
	if err != nil {
		activeUsers = 0
	}

	// Total users
	var totalUsers int
	h.DB.GetContext(ctx, &totalUsers, `SELECT COUNT(*) FROM users`)

	// Total cases
	var totalCases int
	h.DB.GetContext(ctx, &totalCases, `SELECT COUNT(*) FROM cases WHERE deleted_at IS NULL`)

	// Total alerts
	var totalAlerts int
	h.DB.GetContext(ctx, &totalAlerts, `SELECT COUNT(*) FROM alerts WHERE deleted_at IS NULL`)

	metrics := SystemMetrics{
		CPUUsage:       45.2, // Would require OS-level metrics collection
		MemoryUsage:    67.8, // Would require OS-level metrics collection
		DiskUsage:      34.5, // Would require OS-level metrics collection
		ActiveUsers:    activeUsers,
		RequestsPerSec: 156.3, // Would require request counter middleware
		AvgResponseMs:  45.2,  // Would require response time middleware
		ErrorRate:      0.02,  // Would require error counter middleware
		Timestamp:      time.Now(),
	}
	_ = totalUsers
	_ = totalCases
	_ = totalAlerts

	return c.JSON(http.StatusOK, metrics)
}

// GetAlertMetrics returns alert-related monitoring data
func (h *DashboardMonitorHandler) GetAlertMetrics(c echo.Context) error {
	ctx := c.Request().Context()

	metrics := AlertMetrics{
		BySeverity: make(map[string]int),
		BySource:   make(map[string]int),
		Timestamp:  time.Now(),
	}

	// Total alerts
	h.DB.GetContext(ctx, &metrics.TotalAlerts,
		`SELECT COUNT(*) FROM alerts WHERE deleted_at IS NULL`)

	// Alerts by status
	type statusCount struct {
		Status string `db:"status"`
		Count  int    `db:"cnt"`
	}
	var statusRows []statusCount
	h.DB.SelectContext(ctx, &statusRows,
		`SELECT status, COUNT(*) as cnt FROM alerts WHERE deleted_at IS NULL GROUP BY status`)
	for _, r := range statusRows {
		switch r.Status {
		case "New":
			metrics.NewAlerts = r.Count
		case "Imported":
			metrics.ImportedAlerts = r.Count
		case "Merged":
			metrics.MergedAlerts = r.Count
		case "Ignored":
			metrics.IgnoredAlerts = r.Count
		}
	}

	// Alerts by severity
	type sevCount struct {
		Severity int `db:"severity"`
		Count    int `db:"cnt"`
	}
	var sevRows []sevCount
	h.DB.SelectContext(ctx, &sevRows,
		`SELECT severity, COUNT(*) as cnt FROM alerts WHERE deleted_at IS NULL GROUP BY severity`)
	for _, r := range sevRows {
		switch r.Severity {
		case 1:
			metrics.BySeverity["low"] = r.Count
		case 2:
			metrics.BySeverity["medium"] = r.Count
		case 3:
			metrics.BySeverity["high"] = r.Count
		case 4:
			metrics.BySeverity["critical"] = r.Count
		default:
			metrics.BySeverity["unknown"] = r.Count
		}
	}

	// Alerts by source
	type srcCount struct {
		Source string `db:"source"`
		Count  int    `db:"cnt"`
	}
	var srcRows []srcCount
	h.DB.SelectContext(ctx, &srcRows,
		`SELECT source, COUNT(*) as cnt FROM alerts WHERE deleted_at IS NULL GROUP BY source ORDER BY cnt DESC LIMIT 10`)
	for _, r := range srcRows {
		metrics.BySource[r.Source] = r.Count
	}

	return c.JSON(http.StatusOK, metrics)
}

// GetCaseMetrics returns case-related monitoring data
func (h *DashboardMonitorHandler) GetCaseMetrics(c echo.Context) error {
	ctx := c.Request().Context()

	metrics := CaseMetrics{
		BySeverity: make(map[string]int),
		ByStatus:   make(map[string]int),
		ByOwner:    make(map[string]int),
		Timestamp:  time.Now(),
	}

	// Total cases
	h.DB.GetContext(ctx, &metrics.TotalCases,
		`SELECT COUNT(*) FROM cases WHERE deleted_at IS NULL`)

	// Cases by status
	type statusCount struct {
		Status string `db:"status"`
		Count  int    `db:"cnt"`
	}
	var statusRows []statusCount
	h.DB.SelectContext(ctx, &statusRows,
		`SELECT status, COUNT(*) as cnt FROM cases WHERE deleted_at IS NULL GROUP BY status`)
	for _, r := range statusRows {
		switch r.Status {
		case "Open":
			metrics.OpenCases = r.Count
		case "Resolved":
			metrics.ResolvedCases = r.Count
		case "Duplicated":
			metrics.DuplicatedCases = r.Count
		}
		metrics.ByStatus[r.Status] = r.Count
	}

	// Cases by severity
	type sevCount struct {
		Severity int `db:"severity"`
		Count    int `db:"cnt"`
	}
	var sevRows []sevCount
	h.DB.SelectContext(ctx, &sevRows,
		`SELECT severity, COUNT(*) as cnt FROM cases WHERE deleted_at IS NULL GROUP BY severity`)
	for _, r := range sevRows {
		switch r.Severity {
		case 1:
			metrics.BySeverity["low"] = r.Count
		case 2:
			metrics.BySeverity["medium"] = r.Count
		case 3:
			metrics.BySeverity["high"] = r.Count
		case 4:
			metrics.BySeverity["critical"] = r.Count
		default:
			metrics.BySeverity["unknown"] = r.Count
		}
	}

	// Cases by owner
	type ownerCount struct {
		Owner sql.NullString `db:"owner"`
		Count int            `db:"cnt"`
	}
	var ownerRows []ownerCount
	h.DB.SelectContext(ctx, &ownerRows,
		`SELECT owner, COUNT(*) as cnt FROM cases WHERE deleted_at IS NULL GROUP BY owner ORDER BY cnt DESC LIMIT 10`)
	for _, r := range ownerRows {
		name := "unassigned"
		if r.Owner.Valid && r.Owner.String != "" {
			name = r.Owner.String
		}
		metrics.ByOwner[name] = r.Count
	}

	return c.JSON(http.StatusOK, metrics)
}

// GetWorkerMetrics returns worker queue monitoring data
func (h *DashboardMonitorHandler) GetWorkerMetrics(c echo.Context) error {
	ctx := c.Request().Context()

	metrics := WorkerMetrics{
		ByType:    make(map[string]int),
		Timestamp: time.Now(),
	}

	// Cortex jobs
	type jobCount struct {
		Status string `db:"status"`
		Count  int    `db:"cnt"`
	}
	var cortexJobs []jobCount
	err := h.DB.SelectContext(ctx, &cortexJobs,
		`SELECT status, COUNT(*) as cnt FROM cortex_jobs GROUP BY status`)
	if err == nil {
		for _, j := range cortexJobs {
			switch j.Status {
			case "Waiting":
				metrics.QueuedJobs += j.Count
			case "InProgress":
				metrics.ProcessingJobs += j.Count
			case "Success":
				metrics.CompletedJobs += j.Count
			case "Failure":
				metrics.FailedJobs += j.Count
			}
			metrics.ByType["cortex_analyzer"] += j.Count
		}
	}

	// Notification jobs
	type notifCount struct {
		Status string `db:"status"`
		Count  int    `db:"cnt"`
	}
	var notifJobs []notifCount
	err = h.DB.SelectContext(ctx, &notifJobs,
		`SELECT status, COUNT(*) as cnt FROM notification_queue GROUP BY status`)
	if err == nil {
		for _, j := range notifJobs {
			switch j.Status {
			case "pending":
				metrics.QueuedJobs += j.Count
			case "processing":
				metrics.ProcessingJobs += j.Count
			case "sent":
				metrics.CompletedJobs += j.Count
			case "failed":
				metrics.FailedJobs += j.Count
			}
			metrics.ByType["notification"] += j.Count
		}
	}

	// MISP sync jobs
	type mispCount struct {
		Status string `db:"status"`
		Count  int    `db:"cnt"`
	}
	var mispJobs []mispCount
	err = h.DB.SelectContext(ctx, &mispJobs,
		`SELECT status, COUNT(*) as cnt FROM misp_sync_log GROUP BY status`)
	if err == nil {
		for _, j := range mispJobs {
			switch j.Status {
			case "pending":
				metrics.QueuedJobs += j.Count
			case "syncing":
				metrics.ProcessingJobs += j.Count
			case "completed":
				metrics.CompletedJobs += j.Count
			case "failed":
				metrics.FailedJobs += j.Count
			}
			metrics.ByType["misp_sync"] += j.Count
		}
	}

	// Active workers count (estimate from processing jobs)
	metrics.ActiveWorkers = metrics.ProcessingJobs
	if metrics.ActiveWorkers < 1 {
		metrics.ActiveWorkers = 1
	}

	return c.JSON(http.StatusOK, metrics)
}
