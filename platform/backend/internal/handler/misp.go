package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/lib/pq"
	"github.com/thehive-platform/backend/internal/audit"
	"github.com/thehive-platform/backend/internal/misp"
)

// MISPHandler handles MISP integration endpoints matching TheHive 4 connector behavior.
type MISPHandler struct {
	db    *sqlx.DB
	audit *audit.Recorder
}

func NewMISPHandler(db *sqlx.DB, auditRecorder *audit.Recorder) *MISPHandler {
	return &MISPHandler{db: db, audit: auditRecorder}
}

// --- MISP Server CRUD ---

type mispServerRow struct {
	ID            string     `db:"id" json:"id"`
	Name          string     `db:"name" json:"name"`
	URL           string     `db:"url" json:"url"`
	APIKey        string     `db:"api_key" json:"-"` // never expose key in list
	VerifyTLS     bool       `db:"verify_tls" json:"verify_tls"`
	Enabled       bool       `db:"enabled" json:"enabled"`
	Purpose       string     `db:"purpose" json:"purpose"`
	CaseTemplate  string     `db:"case_template" json:"case_template"`
	Tags          pq.StringArray `db:"tags" json:"tags"`
	LastSyncAt    *time.Time `db:"last_sync_at" json:"last_sync_at,omitempty"`
	LastSyncError string     `db:"last_sync_error" json:"last_sync_error"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time  `db:"updated_at" json:"updated_at"`
}

type createMISPServerRequest struct {
	Name         string   `json:"name" validate:"required,min=1"`
	URL          string   `json:"url" validate:"required"`
	APIKey       string   `json:"api_key"`
	VerifyTLS    *bool    `json:"verify_tls"`
	Enabled      *bool    `json:"enabled"`
	Purpose      string   `json:"purpose"`
	CaseTemplate string   `json:"case_template"`
	Tags         []string `json:"tags"`
}

func (h *MISPHandler) ListServers(c echo.Context) error {
	rows := []mispServerRow{}
	if err := h.db.SelectContext(c.Request().Context(), &rows,
		`SELECT id::text, name, url, api_key, verify_tls, enabled, purpose, case_template, tags, last_sync_at, last_sync_error, created_at, updated_at
		 FROM misp_servers ORDER BY name`); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to list MISP servers"})
	}
	return c.JSON(http.StatusOK, rows)
}

func (h *MISPHandler) CreateServer(c echo.Context) error {
	var req createMISPServerRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	verifyTLS := true
	if req.VerifyTLS != nil {
		verifyTLS = *req.VerifyTLS
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	purpose := "ImportAndExport"
	if req.Purpose != "" {
		purpose = req.Purpose
	}
	tags := req.Tags
	if tags == nil {
		tags = []string{}
	}
	row := mispServerRow{}
	err := h.db.GetContext(c.Request().Context(), &row,
		`INSERT INTO misp_servers (name, url, api_key, verify_tls, enabled, purpose, case_template, tags)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id::text, name, url, api_key, verify_tls, enabled, purpose, case_template, tags, last_sync_at, last_sync_error, created_at, updated_at`,
		strings.TrimSpace(req.Name), strings.TrimSpace(req.URL), req.APIKey, verifyTLS, enabled, purpose, req.CaseTemplate, pq.Array(tags))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "failed to create MISP server: " + err.Error()})
	}
	return c.JSON(http.StatusCreated, row)
}

func (h *MISPHandler) DeleteServer(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	result, err := h.db.ExecContext(c.Request().Context(), `DELETE FROM misp_servers WHERE id = $1::uuid`, id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete MISP server"})
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "MISP server not found"})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "deleted", "id": id})
}

// --- MISP Import Preview ---

type mispImportPreviewRequest struct {
	ServerID string `json:"server_id" validate:"required"`
	EventID  string `json:"event_id" validate:"required"`
}

func (h *MISPHandler) ImportPreview(c echo.Context) error {
	var req mispImportPreviewRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	// Load server config
	srv := mispServerRow{}
	if err := h.db.GetContext(c.Request().Context(), &srv,
		`SELECT id::text, name, url, api_key, verify_tls, enabled, purpose, case_template, tags, last_sync_at, last_sync_error, created_at, updated_at
		 FROM misp_servers WHERE id = $1::uuid`, req.ServerID); err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "MISP server not found"})
	}
	if !srv.Enabled {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "MISP server is disabled"})
	}
	client := misp.NewClient(misp.Config{
		BaseURL:   srv.URL,
		APIKey:    srv.APIKey,
		VerifyTLS: srv.VerifyTLS,
	})
	preview, err := client.PreviewImport(c.Request().Context(), req.EventID)
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "MISP preview failed: " + err.Error()})
	}
	return c.JSON(http.StatusOK, preview)
}

// --- MISP Import (creates alert draft) ---

type mispImportRequest struct {
	ServerID     string `json:"server_id" validate:"required"`
	EventID      string `json:"event_id" validate:"required"`
	CaseTemplate string `json:"case_template"`
}

func (h *MISPHandler) ImportEvent(c echo.Context) error {
	var req mispImportRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	// Load server config
	srv := mispServerRow{}
	if err := h.db.GetContext(c.Request().Context(), &srv,
		`SELECT id::text, name, url, api_key, verify_tls, enabled, purpose, case_template, tags, last_sync_at, last_sync_error, created_at, updated_at
		 FROM misp_servers WHERE id = $1::uuid`, req.ServerID); err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "MISP server not found"})
	}
	if !srv.Enabled {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "MISP server is disabled"})
	}
	if srv.Purpose == "ExportOnly" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "MISP server is export-only"})
	}
	client := misp.NewClient(misp.Config{
		BaseURL:   srv.URL,
		APIKey:    srv.APIKey,
		VerifyTLS: srv.VerifyTLS,
	})
	event, err := client.GetEvent(c.Request().Context(), req.EventID)
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "MISP event fetch failed: " + err.Error()})
	}

	// Determine case template
	caseTemplate := req.CaseTemplate
	if caseTemplate == "" {
		caseTemplate = srv.CaseTemplate
	}

	// Build tags from event + server config
	tags := make([]string, 0, len(event.Tags)+len(srv.Tags))
	for _, t := range event.Tags {
		tags = append(tags, t.Name)
	}
	tags = append(tags, []string(srv.Tags)...)
	tags = mispDedup(tags)

	// Map threat level to severity (TheHive 4 mapping)
	severity := mapThreatLevelToSeverity(event.ThreatLevelID)

	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "import failed"})
	}
	defer func() { _ = tx.Rollback() }()

	// Check dedup: same source+sourceRef+type+org should not create duplicate alert
	var existingCount int
	_ = tx.GetContext(c.Request().Context(), &existingCount,
		`SELECT COUNT(*) FROM alerts WHERE source = $1 AND source_ref = $2 AND type = 'misp'`,
		srv.Name, req.EventID)
	if existingCount > 0 {
		return c.JSON(http.StatusConflict, map[string]string{"error": "alert already exists for this MISP event"})
	}

	// Create alert draft
	type alertRow struct {
		ID string `db:"id"`
	}
	alert := alertRow{}
	err = tx.GetContext(c.Request().Context(), &alert,
		`INSERT INTO alerts (title, description, severity, tlp, pap, type, source, source_ref, status, tags, case_template, external_link)
		 VALUES ($1, $2, $3, 2, 2, 'misp', $4, $5, 'New', $6, $7, $8)
		 RETURNING id::text`,
		event.Info, "Imported from MISP event "+event.ID, severity,
		srv.Name, req.EventID, pq.Array(tags), caseTemplate,
		srv.URL+"/events/view/"+event.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "alert creation failed: " + err.Error()})
	}

	// Create observables from MISP attributes
	iocCount := 0
	for _, attr := range event.Attributes {
		obsType := misp.MapMISPTypeToObservable(attr.Type)
		ioc := attr.ToIDS
		if ioc {
			iocCount++
		}
		_, err := tx.ExecContext(c.Request().Context(),
			`INSERT INTO observables (case_id, data_type, data, message, tlp, ioc, sighted, tags)
			 VALUES (NULL, $1, $2, $3, 2, $4, false, $5)`,
			obsType, attr.Value, attr.Comment, ioc, pq.Array(tags))
		if err != nil {
			continue // skip individual observable failures
		}
	}

	// Log sync
	_, _ = tx.ExecContext(c.Request().Context(),
		`INSERT INTO misp_sync_log (server_id, direction, misp_event_id, alert_id, observable_count, ioc_count, status, created_by)
		 VALUES ($1::uuid, 'import', $2, $3::uuid, $4, $5, 'completed', $6)`,
		req.ServerID, req.EventID, alert.ID, len(event.Attributes), iocCount, actorLogin(c))

	// Update server last sync
	_, _ = tx.ExecContext(c.Request().Context(),
		`UPDATE misp_servers SET last_sync_at = now(), last_sync_error = '' WHERE id = $1::uuid`, req.ServerID)

	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "misp.import", "alert", alert.ID, nil, map[string]interface{}{
			"event_id": req.EventID, "server": srv.Name, "observables": len(event.Attributes), "ioc": iocCount,
		}))
	}

	if err := tx.Commit(); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "import commit failed"})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"alert_id":         alert.ID,
		"event_id":         event.ID,
		"observable_count": len(event.Attributes),
		"ioc_count":        iocCount,
		"tags":             tags,
	})
}

// --- MISP Export IOC from case ---

type mispExportRequest struct {
	ServerID  string `json:"server_id" validate:"required"`
	CaseID    string `json:"case_id" validate:"required"`
	EventInfo string `json:"event_info"`
	IOCOnly   bool   `json:"ioc_only"`
}

func (h *MISPHandler) ExportCase(c echo.Context) error {
	var req mispExportRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	// Load server
	srv := mispServerRow{}
	if err := h.db.GetContext(c.Request().Context(), &srv,
		`SELECT id::text, name, url, api_key, verify_tls, enabled, purpose, case_template, tags, last_sync_at, last_sync_error, created_at, updated_at
		 FROM misp_servers WHERE id = $1::uuid`, req.ServerID); err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "MISP server not found"})
	}
	if !srv.Enabled {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "MISP server is disabled"})
	}
	if srv.Purpose == "ImportOnly" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "MISP server is import-only"})
	}

	// Load case
	type caseRow struct {
		ID    string `db:"id"`
		Title string `db:"title"`
	}
	cs := caseRow{}
	if err := h.db.GetContext(c.Request().Context(), &cs,
		`SELECT id::text, title FROM cases WHERE id = $1::uuid`, req.CaseID); err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "case not found"})
	}

	// Load observables
	type obsRow struct {
		DataType string         `db:"data_type"`
		Data     string         `db:"data"`
		IOC      bool           `db:"ioc"`
		Message  string         `db:"message"`
		Tags     pq.StringArray `db:"tags"`
	}
	query := `SELECT data_type, data, ioc, message, tags FROM observables WHERE case_id = $1::uuid`
	if req.IOCOnly {
		query += ` AND ioc = true`
	}
	query += ` ORDER BY created_at`
	observables := []obsRow{}
	if err := h.db.SelectContext(c.Request().Context(), &observables, query, req.CaseID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to load observables"})
	}

	// Build export payload
	eventInfo := req.EventInfo
	if eventInfo == "" {
		eventInfo = cs.Title
	}
	exportObs := make([]misp.ExportObservable, 0, len(observables))
	for _, o := range observables {
		exportObs = append(exportObs, misp.ExportObservable{
			DataType: o.DataType,
			Data:     o.Data,
			IOC:      o.IOC,
			Comment:  o.Message,
			Tags:     []string(o.Tags),
		})
	}

	// Call MISP export (create event with attributes)
	client := misp.NewClient(misp.Config{
		BaseURL:   srv.URL,
		APIKey:    srv.APIKey,
		VerifyTLS: srv.VerifyTLS,
	})
	result, err := client.ExportToEvent(c.Request().Context(), misp.ExportRequest{
		CaseID:      req.CaseID,
		EventInfo:   eventInfo,
		Observables: exportObs,
	})
	if err != nil {
		// Log failure
		_, _ = h.db.ExecContext(c.Request().Context(),
			`INSERT INTO misp_sync_log (server_id, direction, case_id, observable_count, status, error, created_by)
			 VALUES ($1::uuid, 'export', $2::uuid, $3, 'failed', $4, $5)`,
			req.ServerID, req.CaseID, len(exportObs), err.Error(), actorLogin(c))
		_, _ = h.db.ExecContext(c.Request().Context(),
			`UPDATE misp_servers SET last_sync_at = now(), last_sync_error = $1 WHERE id = $2::uuid`, err.Error(), req.ServerID)
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "MISP export failed: " + err.Error()})
	}

	// Log success
	_, _ = h.db.ExecContext(c.Request().Context(),
		`INSERT INTO misp_sync_log (server_id, direction, misp_event_id, case_id, observable_count, ioc_count, status, created_by)
		 VALUES ($1::uuid, 'export', $2, $3::uuid, $4, $5, 'completed', $6)`,
		req.ServerID, result.EventID, req.CaseID, result.Exported, result.Exported, actorLogin(c))
	_, _ = h.db.ExecContext(c.Request().Context(),
		`UPDATE misp_servers SET last_sync_at = now(), last_sync_error = '' WHERE id = $1::uuid`, req.ServerID)

	if h.audit != nil {
		tx2, _ := h.db.BeginTxx(c.Request().Context(), nil)
		if tx2 != nil {
			_ = audit.RecordTx(c.Request().Context(), tx2, audit.FromContext(c, "misp.export", "case", req.CaseID, nil, result))
			_ = tx2.Commit()
		}
	}

	return c.JSON(http.StatusOK, result)
}

// --- MISP Sync Log ---

func (h *MISPHandler) ListSyncLog(c echo.Context) error {
	serverID := strings.TrimSpace(c.QueryParam("server_id"))
	direction := strings.TrimSpace(c.QueryParam("direction"))

	query := `SELECT id::text, server_id::text, direction, misp_event_id, alert_id::text, case_id::text,
	           observable_count, ioc_count, skipped_count, status, error, created_by, created_at
	           FROM misp_sync_log WHERE 1=1`
	args := []interface{}{}
	argIdx := 1
	if serverID != "" {
		query += ` AND server_id = $` + itoa(argIdx) + `::uuid`
		args = append(args, serverID)
		argIdx++
	}
	if direction != "" {
		query += ` AND direction = $` + itoa(argIdx)
		args = append(args, direction)
		argIdx++
	}
	query += ` ORDER BY created_at DESC LIMIT 100`

	type syncLogRow struct {
		ID              string     `db:"id" json:"id"`
		ServerID        string     `db:"server_id" json:"server_id"`
		Direction       string     `db:"direction" json:"direction"`
		MISPEventID     string     `db:"misp_event_id" json:"misp_event_id"`
		AlertID         *string    `db:"alert_id" json:"alert_id,omitempty"`
		CaseID          *string    `db:"case_id" json:"case_id,omitempty"`
		ObservableCount int        `db:"observable_count" json:"observable_count"`
		IOCCount        int        `db:"ioc_count" json:"ioc_count"`
		SkippedCount    int        `db:"skipped_count" json:"skipped_count"`
		Status          string     `db:"status" json:"status"`
		Error           string     `db:"error" json:"error"`
		CreatedBy       string     `db:"created_by" json:"created_by"`
		CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	}
	rows := []syncLogRow{}
	if err := h.db.SelectContext(c.Request().Context(), &rows, query, args...); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to list sync log"})
	}
	return c.JSON(http.StatusOK, rows)
}

// --- helpers ---

func mispDedup(ss []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(ss))
	for _, s := range ss {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}

func mapThreatLevelToSeverity(threatLevel string) int {
	// TheHive 4 mapping: 1=High→3, 2=Medium→2, 3=Low→1, 4=Undefined→1
	switch threatLevel {
	case "1":
		return 3
	case "2":
		return 2
	default:
		return 1
	}
}

