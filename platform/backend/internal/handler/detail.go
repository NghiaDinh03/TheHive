package handler

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/lib/pq"
	"github.com/thehive-platform/backend/internal/apierr"
)

type DetailHandler struct {
	db *sqlx.DB
}

func NewDetailHandler(db *sqlx.DB) *DetailHandler { return &DetailHandler{db: db} }

type detailRelatedCase struct {
	ID                string             `db:"id" json:"id"`
	Number            int                `db:"number" json:"number"`
	Title             string             `db:"title" json:"title"`
	Severity          int                `db:"severity" json:"severity"`
	TLP               int                `db:"tlp" json:"tlp"`
	Status            string             `db:"status" json:"status"`
	ResolutionStatus  string             `db:"resolution_status" json:"resolution_status,omitempty"`
	StartDate         *time.Time         `db:"start_date" json:"start_date,omitempty"`
	EndDate           *time.Time         `db:"end_date" json:"end_date,omitempty"`
	Tags              pq.StringArray     `db:"tags" json:"tags"`
	MergedFrom        pq.StringArray     `db:"merged_from" json:"merged_from,omitempty"`
	LinksCount        int                `json:"links_count"`
	LinkedObservables []detailObservable `json:"linked_observables"`
}

type detailResponderAction struct {
	ID            string     `db:"id" json:"id"`
	ResponderID   string     `db:"responder_id" json:"responder_id"`
	ResponderName string     `db:"responder_name" json:"responder_name"`
	Status        string     `db:"status" json:"status"`
	ObjectType    string     `db:"object_type" json:"object_type"`
	ObjectID      string     `db:"object_id" json:"object_id"`
	StartDate     *time.Time `db:"start_date" json:"start_date,omitempty"`
	EndDate       *time.Time `db:"end_date" json:"end_date,omitempty"`
}

type detailAlertCustomField struct {
	Name      string `db:"name" json:"name"`
	Value     string `db:"value" json:"value"`
	FieldType string `db:"field_type" json:"field_type,omitempty"`
}

type detailCaseAlert struct {
	ID        string         `db:"id" json:"id"`
	Title     string         `db:"title" json:"title"`
	Type      string         `db:"type" json:"type"`
	Source    string         `db:"source" json:"source"`
	SourceRef string         `db:"source_ref" json:"source_ref"`
	Severity  int            `db:"severity" json:"severity"`
	Status    string         `db:"status" json:"status"`
	Tags      pq.StringArray `db:"tags" json:"tags"`
	CreatedAt time.Time      `db:"created_at" json:"created_at"`
}

type CaseDetail struct {
	Case             detailCase              `json:"case"`
	Tasks            []detailTask            `json:"tasks"`
	Logs             []detailLog             `json:"logs"`
	Attachments      []detailAttach          `json:"attachments"`
	Custom           []detailCustom          `json:"custom_fields"`
	Observables      []detailObservable      `json:"observables"`
	Procedures       []detailProcedure       `json:"procedures"`
	Shares           []detailShare           `json:"shares"`
	History          []detailHistory         `json:"history"`
	RelatedCases     []detailRelatedCase     `json:"related_cases"`
	ResponderActions []detailResponderAction `json:"responder_actions"`
	Alerts           []detailCaseAlert       `json:"alerts"`
}

type detailCase struct {
	ID                 string         `db:"id" json:"id"`
	Number             int            `db:"number" json:"number"`
	Title              string         `db:"title" json:"title"`
	Description        string         `db:"description" json:"description"`
	Severity           int            `db:"severity" json:"severity"`
	TLP                int            `db:"tlp" json:"tlp"`
	PAP                int            `db:"pap" json:"pap"`
	Status             string         `db:"status" json:"status"`
	Owner              string         `db:"owner" json:"owner"`
	Assignee           string         `db:"assignee" json:"assignee"`
	Tags               pq.StringArray `db:"tags" json:"tags"`
	Flag               bool           `db:"flag" json:"flag"`
	Summary            string         `db:"summary" json:"summary"`
	ImpactStatus       string         `db:"impact_status" json:"impact_status"`
	ResolutionStatus   string         `db:"resolution_status" json:"resolution_status"`
	CaseTemplate       string         `db:"case_template" json:"case_template"`
	OwningOrganisation string         `db:"owning_organisation" json:"owning_organisation"`
	OrganisationIDs    pq.StringArray `db:"organisation_ids" json:"organisation_ids"`
	StartDate          *time.Time     `db:"start_date" json:"start_date,omitempty"`
	EndDate            *time.Time     `db:"end_date" json:"end_date,omitempty"`
	CreatedAt          time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt          time.Time      `db:"updated_at" json:"updated_at"`
}

type detailTask struct {
	ID              string         `db:"id" json:"id"`
	CaseID          string         `db:"case_id" json:"case_id"`
	CaseNumber      int            `db:"case_number" json:"case_number,omitempty"`
	CaseTitle       string         `db:"case_title" json:"case_title,omitempty"`
	Title           string         `db:"title" json:"title"`
	Description     string         `db:"description" json:"description"`
	Status          string         `db:"status" json:"status"`
	Assignee        string         `db:"assignee" json:"assignee"`
	GroupName       string         `db:"group_name" json:"group_name"`
	OrderIndex      int            `db:"order_index" json:"order_index"`
	Flag            bool           `db:"flag" json:"flag"`
	StartDate       *time.Time     `db:"start_date" json:"start_date,omitempty"`
	EndDate         *time.Time     `db:"end_date" json:"end_date,omitempty"`
	DueDate         *time.Time     `db:"due_date" json:"due_date,omitempty"`
	OrganisationIDs pq.StringArray `db:"organisation_ids" json:"organisation_ids"`
	CreatedAt       time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time      `db:"updated_at" json:"updated_at"`
}

type detailLog struct {
	ID        string    `db:"id" json:"id"`
	CaseID    string    `db:"case_id" json:"case_id"`
	TaskID    string    `db:"task_id" json:"task_id,omitempty"`
	Message   string    `db:"message" json:"message"`
	CreatedBy string    `db:"created_by" json:"created_by"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type detailObservable struct {
	ID               string         `db:"id" json:"id"`
	CaseID           string         `db:"case_id" json:"case_id,omitempty"`
	AlertID          string         `db:"alert_id" json:"alert_id,omitempty"`
	DataType         string         `db:"data_type" json:"data_type"`
	Data             string         `db:"data" json:"data"`
	Message          string         `db:"message" json:"message"`
	TLP              int            `db:"tlp" json:"tlp"`
	IOC              bool           `db:"ioc" json:"ioc"`
	Sighted          bool           `db:"sighted" json:"sighted"`
	IgnoreSimilarity bool           `db:"ignore_similarity" json:"ignore_similarity"`
	AttachmentID     string         `db:"attachment_id" json:"attachment_id,omitempty"`
	FullData         string         `db:"full_data" json:"full_data,omitempty"`
	DataHash         string         `db:"data_hash" json:"data_hash,omitempty"`
	OrganisationIDs  pq.StringArray `db:"organisation_ids" json:"organisation_ids"`
	Tags             pq.StringArray `db:"tags" json:"tags"`
	CreatedBy        string         `db:"created_by" json:"created_by"`
	CreatedAt        time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time      `db:"updated_at" json:"updated_at"`
}

type detailSimilarAlert struct {
	ID                string  `db:"id" json:"id"`
	Title             string  `db:"title" json:"title"`
	Source            string  `db:"source" json:"source"`
	SourceRef         string  `db:"source_ref" json:"source_ref"`
	Score             float64 `db:"score" json:"score"`
	Reason            string  `db:"reason" json:"reason"`
	ObservableOverlap int     `db:"observable_overlap" json:"observable_overlap"`
	IOCOverlap        int     `db:"ioc_overlap" json:"ioc_overlap"`
	TagOverlap        int     `db:"tag_overlap" json:"tag_overlap"`
	Status            string  `db:"status" json:"status"`
}

type detailAlert struct {
	ID             string                   `db:"id" json:"id"`
	Title          string                   `db:"title" json:"title"`
	Description    string                   `db:"description" json:"description"`
	Type           string                   `db:"type" json:"type"`
	Source         string                   `db:"source" json:"source"`
	SourceRef      string                   `db:"source_ref" json:"source_ref"`
	Severity       int                      `db:"severity" json:"severity"`
	TLP            int                      `db:"tlp" json:"tlp"`
	PAP            int                      `db:"pap" json:"pap"`
	Status         string                   `db:"status" json:"status"`
	Read           bool                     `db:"read" json:"read"`
	Follow         bool                     `db:"follow" json:"follow"`
	Flag           bool                     `db:"flag" json:"flag"`
	ExternalLink   string                   `db:"external_link" json:"external_link"`
	OrganisationID string                   `db:"organisation_id" json:"organisation_id"`
	CaseTemplate   string                   `db:"case_template" json:"case_template"`
	CaseID         string                   `db:"case_id" json:"case_id,omitempty"`
	CaseNumber     int                      `db:"case_number" json:"case_number,omitempty"`
	CaseTitle      string                   `db:"case_title" json:"case_title,omitempty"`
	Tags           pq.StringArray           `db:"tags" json:"tags"`
	OccurredAt     *time.Time               `db:"occurred_at" json:"occurred_at,omitempty"`
	LastSyncDate   *time.Time               `db:"last_sync_date" json:"last_sync_date,omitempty"`
	CreatedAt      time.Time                `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time                `db:"updated_at" json:"updated_at"`
	Observables    []detailObservable       `json:"observables" db:"-"`
	Similar        []detailSimilarAlert     `json:"similar_alerts" db:"-"`
	History        []detailHistory          `json:"history" db:"-"`
	CustomFields   []detailAlertCustomField `json:"custom_fields" db:"-"`
}

type TaskDetail struct {
	Task        detailTask      `json:"task"`
	Logs        []detailLog     `json:"logs"`
	Attachments []detailAttach  `json:"attachments"`
	History     []detailHistory `json:"history"`
}

type detailAttach struct {
	ID           string    `db:"id" json:"id"`
	CaseID       string    `db:"case_id" json:"case_id,omitempty"`
	ObservableID string    `db:"observable_id" json:"observable_id,omitempty"`
	LogID        string    `db:"log_id" json:"log_id,omitempty"`
	FileName     string    `db:"file_name" json:"file_name"`
	ContentType  string    `db:"content_type" json:"content_type"`
	SizeBytes    int64     `db:"size_bytes" json:"size_bytes"`
	ScanStatus   string    `db:"scan_status" json:"scan_status"`
	Bucket       string    `db:"bucket" json:"bucket"`
	ObjectKey    string    `db:"object_key" json:"object_key"`
	UploadedBy   string    `db:"uploaded_by" json:"uploaded_by"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

type detailCustom struct {
	Name  string `db:"name" json:"name"`
	Value string `db:"value" json:"value"`
}

type detailStub struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}

type detailProcedure struct {
	ID          string     `db:"id" json:"id"`
	CaseID      string     `db:"case_id" json:"case_id"`
	Description string     `db:"description" json:"description"`
	PatternID   string     `db:"pattern_id" json:"pattern_id"`
	PatternName string     `db:"pattern_name" json:"pattern_name"`
	Tactic      string     `db:"tactic" json:"tactic"`
	OccurredAt  *time.Time `db:"occurred_at" json:"occurred_at,omitempty"`
	CreatedBy   string     `db:"created_by" json:"created_by"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
}

type detailShare struct {
	ID                 string    `db:"id" json:"id"`
	CaseID             string    `db:"case_id" json:"case_id"`
	Organisation       string    `db:"organisation" json:"organisation"`
	Profile            string    `db:"profile" json:"profile"`
	TaskRule           string    `db:"task_rule" json:"task_rule"`
	ObservableRule     string    `db:"observable_rule" json:"observable_rule"`
	Owner              bool      `db:"owner" json:"owner"`
	TaskActionRequired bool      `db:"task_action_required" json:"task_action_required"`
	CreatedBy          string    `db:"created_by" json:"created_by"`
	CreatedAt          time.Time `db:"created_at" json:"created_at"`
}

type detailHistory struct {
	Action    string    `db:"action" json:"action"`
	ActorID   string    `db:"actor_id" json:"actor_id"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

func (h *DetailHandler) GetCase(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	item := detailCase{}
	if err := h.db.GetContext(c.Request().Context(), &item, `SELECT id::text AS id, number, title, description, severity, tlp, pap, status, owner, assignee, tags, flag, summary, impact_status, resolution_status, case_template, owning_organisation, organisation_ids, start_date, end_date, created_at, updated_at FROM cases WHERE id = $1::uuid`, id); err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "case not found")
	} else if err != nil {
		return apierr.New(http.StatusInternalServerError, "case detail failed")
	}
	tasks, err := h.caseTasks(c, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case tasks failed")
	}
	logs, err := h.caseLogs(c, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case logs failed")
	}
	attachments, err := h.caseAttachments(c, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case attachments failed")
	}
	custom, err := h.caseCustomFields(c, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case custom fields failed")
	}
	observables, err := h.caseObservables(c, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case observables failed")
	}
	procedures, err := h.caseProcedures(c, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case procedures failed")
	}
	shares, err := h.caseShares(c, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case shares failed")
	}
	history, err := h.entityHistory(c, "case", id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case history failed")
	}
	relatedCases, err := h.relatedCases(c, id)
	if err != nil {
		relatedCases = []detailRelatedCase{}
	}
	responderActions, err := h.caseResponderActions(c, id)
	if err != nil {
		responderActions = []detailResponderAction{}
	}
	caseAlerts, err := h.caseAlerts(c, id)
	if err != nil {
		caseAlerts = []detailCaseAlert{}
	}
	return c.JSON(http.StatusOK, CaseDetail{Case: item, Tasks: tasks, Logs: logs, Attachments: attachments, Custom: custom, Observables: observables, Procedures: procedures, Shares: shares, History: history, RelatedCases: relatedCases, ResponderActions: responderActions, Alerts: caseAlerts})
}

func (h *DetailHandler) GetAlert(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	item := detailAlert{}
	if err := h.db.GetContext(c.Request().Context(), &item, `SELECT a.id::text AS id, a.title, a.description, a.type, a.source, a.source_ref, a.severity, a.tlp, a.pap, a.status, a.read, a.follow, a.flag, a.external_link, a.organisation_id, a.case_template, COALESCE(a.case_id::text, '') AS case_id, COALESCE(c.number, 0) AS case_number, COALESCE(c.title, '') AS case_title, a.tags, a.occurred_at, a.last_sync_date, a.created_at, a.updated_at FROM alerts a LEFT JOIN cases c ON c.id = a.case_id WHERE a.id = $1::uuid`, id); err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "alert not found")
	} else if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert detail failed")
	}
	observables, err := h.alertObservables(c, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert observables failed")
	}
	similar, err := h.similarAlerts(c, item)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "similar alerts failed")
	}
	history, err := h.entityHistory(c, "alert", id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "alert history failed")
	}
	alertCustomFields, err := h.alertCustomFields(c, id)
	if err != nil {
		alertCustomFields = []detailAlertCustomField{}
	}
	item.Observables = observables
	item.Similar = similar
	item.History = history
	item.CustomFields = alertCustomFields
	return c.JSON(http.StatusOK, item)
}

func (h *DetailHandler) ListCaseTasks(c echo.Context) error {
	values, err := h.caseTasks(c, strings.TrimSpace(c.Param("id")))
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case tasks failed")
	}
	return c.JSON(http.StatusOK, map[string]any{"values": values, "total": len(values)})
}

func (h *DetailHandler) ListCaseLogs(c echo.Context) error {
	values, err := h.caseLogs(c, strings.TrimSpace(c.Param("id")))
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case logs failed")
	}
	return c.JSON(http.StatusOK, map[string]any{"values": values, "total": len(values)})
}

func (h *DetailHandler) ListCaseAttachments(c echo.Context) error {
	values, err := h.caseAttachments(c, strings.TrimSpace(c.Param("id")))
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case attachments failed")
	}
	return c.JSON(http.StatusOK, map[string]any{"values": values, "total": len(values)})
}

// ListCaseObservables returns observables for a specific case.
// Mirrors legacy /api/v1/case/:id/artifacts endpoint from TheHive 4.
func (h *DetailHandler) ListCaseObservables(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	rows := []detailObservable{}
	if err := h.db.SelectContext(c.Request().Context(), &rows,
		`SELECT id::text AS id, case_id::text AS case_id, COALESCE(alert_id::text,'') AS alert_id,
		 data_type, data, message, tlp, ioc, sighted, ignore_similarity,
		 COALESCE(attachment_id::text,'') AS attachment_id, COALESCE(full_data,'') AS full_data,
		 COALESCE(data_hash,'') AS data_hash, organisation_ids, tags, created_by, created_at, updated_at
		 FROM observables WHERE case_id = $1::uuid ORDER BY created_at ASC`, caseID); err != nil {
		return apierr.New(http.StatusInternalServerError, "case observables failed")
	}
	return c.JSON(http.StatusOK, map[string]any{"values": rows, "total": len(rows)})
}

func (h *DetailHandler) GetTask(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	row := detailTask{}
	if err := h.db.GetContext(c.Request().Context(), &row, `SELECT t.id::text AS id, t.case_id::text AS case_id, COALESCE(c.number, 0) AS case_number, COALESCE(c.title, '') AS case_title, t.title, t.description, t.status, t.assignee, t.group_name, t.order_index, t.flag, t.start_date, t.end_date, t.due_date, t.organisation_ids, t.created_at, t.updated_at FROM task_items t LEFT JOIN cases c ON c.id = t.case_id WHERE t.id = $1::uuid`, id); err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "task not found")
	} else if err != nil {
		return apierr.New(http.StatusInternalServerError, "task detail failed")
	}
	logs, err := h.taskLogs(c, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "task logs failed")
	}
	attachments, err := h.taskAttachments(c, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "task attachments failed")
	}
	history, err := h.entityHistory(c, "task", id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "task history failed")
	}
	return c.JSON(http.StatusOK, TaskDetail{Task: row, Logs: logs, Attachments: attachments, History: history})
}

func (h *DetailHandler) ListAllTasks(c echo.Context) error {
	status := strings.TrimSpace(c.QueryParam("status"))
	assignee := strings.TrimSpace(c.QueryParam("assignee"))
	parts := []string{}
	args := []any{}
	if status != "" {
		args = append(args, status)
		parts = append(parts, fmt.Sprintf("t.status = $%d", len(args)))
	}
	if assignee != "" {
		args = append(args, assignee)
		parts = append(parts, fmt.Sprintf("t.assignee = $%d", len(args)))
	}
	where := ""
	if len(parts) > 0 {
		where = "WHERE " + strings.Join(parts, " AND ")
	}
	rows := []detailTask{}
	if err := h.db.SelectContext(c.Request().Context(), &rows, `SELECT t.id::text AS id, t.case_id::text AS case_id, COALESCE(c.number, 0) AS case_number, COALESCE(c.title, '') AS case_title, t.title, t.description, t.status, t.assignee, t.group_name, t.order_index, t.flag, t.start_date, t.end_date, t.due_date, t.organisation_ids, t.created_at, t.updated_at FROM task_items t LEFT JOIN cases c ON c.id = t.case_id `+where+` ORDER BY t.flag DESC, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT 500`, args...); err != nil {
		return apierr.New(http.StatusInternalServerError, "tasks list failed")
	}
	return c.JSON(http.StatusOK, map[string]any{"values": rows, "total": len(rows)})
}

func (h *DetailHandler) ListAttachments(c echo.Context) error {
	caseID := strings.TrimSpace(c.QueryParam("case_id"))
	observableID := strings.TrimSpace(c.QueryParam("observable_id"))
	logID := strings.TrimSpace(c.QueryParam("log_id"))
	parts := []string{}
	args := []any{}
	if caseID != "" {
		args = append(args, caseID)
		parts = append(parts, fmt.Sprintf("case_id = $%d::uuid", len(args)))
	}
	if observableID != "" {
		args = append(args, observableID)
		parts = append(parts, fmt.Sprintf("observable_id = $%d::uuid", len(args)))
	}
	if logID != "" {
		args = append(args, logID)
		parts = append(parts, fmt.Sprintf("log_id = $%d::uuid", len(args)))
	}
	where := ""
	if len(parts) > 0 {
		where = "WHERE " + strings.Join(parts, " AND ")
	}
	rows := []detailAttach{}
	if err := h.db.SelectContext(c.Request().Context(), &rows, attachmentSelectSQL+" "+where+" ORDER BY created_at DESC LIMIT 200", args...); err != nil {
		return apierr.New(http.StatusInternalServerError, "attachments failed")
	}
	return c.JSON(http.StatusOK, map[string]any{"values": rows, "total": len(rows)})
}

func (h *DetailHandler) caseTasks(c echo.Context, caseID string) ([]detailTask, error) {
	rows := []detailTask{}
	err := h.db.SelectContext(c.Request().Context(), &rows, `SELECT t.id::text AS id, t.case_id::text AS case_id, COALESCE(c.number, 0) AS case_number, COALESCE(c.title, '') AS case_title, t.title, t.description, t.status, t.assignee, t.group_name, t.order_index, t.flag, t.start_date, t.end_date, t.due_date, t.organisation_ids, t.created_at, t.updated_at FROM task_items t LEFT JOIN cases c ON c.id = t.case_id WHERE t.case_id = $1::uuid ORDER BY t.group_name ASC, t.order_index ASC, t.created_at ASC`, caseID)
	return rows, err
}

func (h *DetailHandler) caseLogs(c echo.Context, caseID string) ([]detailLog, error) {
	rows := []detailLog{}
	err := h.db.SelectContext(c.Request().Context(), &rows, `SELECT id::text AS id, case_id::text AS case_id, COALESCE(task_id::text, '') AS task_id, message, created_by, created_at FROM case_logs WHERE case_id = $1::uuid ORDER BY created_at DESC LIMIT 200`, caseID)
	return rows, err
}

const attachmentSelectSQL = `SELECT id::text AS id, COALESCE(case_id::text, '') AS case_id, COALESCE(observable_id::text, '') AS observable_id, COALESCE(log_id::text, '') AS log_id, file_name, content_type, size_bytes, scan_status, bucket, object_key, uploaded_by, created_at FROM attachments`

func (h *DetailHandler) caseAttachments(c echo.Context, caseID string) ([]detailAttach, error) {
	rows := []detailAttach{}
	err := h.db.SelectContext(c.Request().Context(), &rows, attachmentSelectSQL+` WHERE case_id = $1::uuid ORDER BY created_at DESC LIMIT 200`, caseID)
	return rows, err
}

func (h *DetailHandler) caseCustomFields(c echo.Context, caseID string) ([]detailCustom, error) {
	rows := []detailCustom{}
	err := h.db.SelectContext(c.Request().Context(), &rows, `SELECT name, value::text AS value FROM custom_fields WHERE owner_type = 'case' AND owner_id = $1::uuid ORDER BY name ASC`, caseID)
	return rows, err
}

func (h *DetailHandler) caseObservables(c echo.Context, caseID string) ([]detailObservable, error) {
	rows := []detailObservable{}
	err := h.db.SelectContext(c.Request().Context(), &rows, observableSelectSQL+` WHERE case_id = $1::uuid ORDER BY created_at DESC LIMIT 200`, caseID)
	return rows, err
}

func (h *DetailHandler) alertObservables(c echo.Context, alertID string) ([]detailObservable, error) {
	rows := []detailObservable{}
	err := h.db.SelectContext(c.Request().Context(), &rows, observableSelectSQL+` WHERE alert_id = $1::uuid ORDER BY created_at DESC LIMIT 200`, alertID)
	return rows, err
}

const observableSelectSQL = `SELECT id::text AS id, COALESCE(case_id::text, '') AS case_id, COALESCE(alert_id::text, '') AS alert_id, data_type, data, message, tlp, ioc, sighted, ignore_similarity, COALESCE(attachment_id::text, '') AS attachment_id, COALESCE(full_data, '') AS full_data, data_hash, organisation_ids, tags, created_by, created_at, updated_at FROM observables`

func (h *DetailHandler) taskLogs(c echo.Context, taskID string) ([]detailLog, error) {
	rows := []detailLog{}
	err := h.db.SelectContext(c.Request().Context(), &rows, `SELECT id::text AS id, case_id::text AS case_id, COALESCE(task_id::text, '') AS task_id, message, created_by, created_at FROM case_logs WHERE task_id = $1::uuid ORDER BY created_at DESC LIMIT 200`, taskID)
	return rows, err
}

func (h *DetailHandler) taskAttachments(c echo.Context, taskID string) ([]detailAttach, error) {
	rows := []detailAttach{}
	err := h.db.SelectContext(c.Request().Context(), &rows, attachmentSelectSQL+` WHERE log_id IN (SELECT id FROM case_logs WHERE task_id = $1::uuid) ORDER BY created_at DESC LIMIT 200`, taskID)
	return rows, err
}

func (h *DetailHandler) similarAlerts(c echo.Context, alert detailAlert) ([]detailSimilarAlert, error) {
	rows := []detailSimilarAlert{}
	err := h.db.SelectContext(c.Request().Context(), &rows, `
		WITH current_observables AS (
			SELECT lower(data_type) AS data_type, lower(data) AS data, ioc
			FROM observables
			WHERE alert_id = $1::uuid
		), candidate_scores AS (
			SELECT a.id, a.title, a.source, a.source_ref, a.type, a.tags, a.status, a.updated_at,
				COUNT(co.*) FILTER (WHERE co.data_type IS NOT NULL) AS observable_overlap,
				COUNT(co.*) FILTER (WHERE co.data_type IS NOT NULL AND co.ioc AND o.ioc) AS ioc_overlap,
				COALESCE((SELECT COUNT(*) FROM unnest(a.tags) tag WHERE tag = ANY($5)), 0) AS tag_overlap
			FROM alerts a
			LEFT JOIN observables o ON o.alert_id = a.id
			LEFT JOIN current_observables co ON co.data_type = lower(o.data_type) AND co.data = lower(o.data)
			WHERE a.id <> $1::uuid
			GROUP BY a.id, a.title, a.source, a.source_ref, a.type, a.tags, a.status, a.updated_at
		)
		SELECT id::text AS id, title, source, source_ref,
			LEAST(1.0,
				CASE
					WHEN source = $2 AND source_ref = $3 AND type = $4 THEN 0.55
					WHEN source = $2 AND source_ref = $3 THEN 0.45
					WHEN source = $2 AND type = $4 THEN 0.30
					ELSE 0.0
				END
				+ CASE WHEN observable_overlap > 0 THEN 0.25 ELSE 0.0 END
				+ CASE WHEN ioc_overlap > 0 THEN 0.15 ELSE 0.0 END
				+ CASE WHEN tag_overlap > 0 THEN 0.10 ELSE 0.0 END
			) AS score,
			trim(both '+' from concat_ws('+',
				CASE WHEN source = $2 AND source_ref = $3 AND type = $4 THEN 'same-source-ref-type' END,
				CASE WHEN source = $2 AND source_ref = $3 AND type <> $4 THEN 'same-source-ref' END,
				CASE WHEN source = $2 AND source_ref <> $3 AND type = $4 THEN 'same-source-type' END,
				CASE WHEN observable_overlap > 0 THEN 'observable-overlap' END,
				CASE WHEN ioc_overlap > 0 THEN 'ioc-overlap' END,
				CASE WHEN tag_overlap > 0 THEN 'tag-overlap' END
			)) AS reason,
			observable_overlap, ioc_overlap, tag_overlap, status
		FROM candidate_scores
		WHERE source = $2 OR source_ref = $3 OR type = $4 OR observable_overlap > 0 OR ioc_overlap > 0 OR tag_overlap > 0
		ORDER BY score DESC, updated_at DESC
		LIMIT 10`, alert.ID, alert.Source, alert.SourceRef, alert.Type, alert.Tags)
	return rows, err
}

func (h *DetailHandler) entityHistory(c echo.Context, entityType string, entityID string) ([]detailHistory, error) {
	rows := []detailHistory{}
	err := h.db.SelectContext(c.Request().Context(), &rows, `SELECT action, COALESCE(actor_id::text, '') AS actor_id, created_at FROM audit_logs WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT 100`, entityType, entityID)
	return rows, err
}

func (h *DetailHandler) caseProcedures(c echo.Context, caseID string) ([]detailProcedure, error) {
	rows := []detailProcedure{}
	err := h.db.SelectContext(c.Request().Context(), &rows, `SELECT id::text AS id, case_id::text AS case_id, description, pattern_id, pattern_name, tactic, occurred_at, created_by, created_at FROM case_procedures WHERE case_id = $1::uuid ORDER BY occurred_at DESC NULLS LAST, created_at DESC LIMIT 200`, caseID)
	return rows, err
}

func (h *DetailHandler) caseShares(c echo.Context, caseID string) ([]detailShare, error) {
	rows := []detailShare{}
	err := h.db.SelectContext(c.Request().Context(), &rows, `SELECT id::text AS id, case_id::text AS case_id, organisation, profile, task_rule, observable_rule, owner, task_action_required, created_by, created_at FROM case_shares WHERE case_id = $1::uuid ORDER BY owner DESC, organisation ASC LIMIT 200`, caseID)
	return rows, err
}

// ListCaseProcedures and ListCaseShares are exposed as standalone endpoints in case the case
// detail tab wants to refresh independently without re-fetching the full case payload.
func (h *DetailHandler) ListCaseProcedures(c echo.Context) error {
	values, err := h.caseProcedures(c, strings.TrimSpace(c.Param("id")))
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case procedures failed")
	}
	return c.JSON(http.StatusOK, map[string]any{"values": values, "total": len(values)})
}

func (h *DetailHandler) ListCaseShares(c echo.Context) error {
	values, err := h.caseShares(c, strings.TrimSpace(c.Param("id")))
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "case shares failed")
	}
	return c.JSON(http.StatusOK, map[string]any{"values": values, "total": len(values)})
}

// Timeline combines logs + audit events for a case into a single ordered stream.
// TheHive 4 parity: case timeline merges analyst notes (logs) with system audit events.
type timelineEntry struct {
	ID      string    `json:"id"`
	Type    string    `json:"type"` // "log" or "audit"
	Date    time.Time `json:"date"`
	Message string    `json:"message"`
	Author  string    `json:"author"`
	TaskID  *string   `json:"task_id,omitempty"`
	Action  string    `json:"action,omitempty"`
}

func (h *DetailHandler) CaseTimeline(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	entries := []timelineEntry{}

	// Fetch logs
	type logRow struct {
		ID        string    `db:"id"`
		Message   string    `db:"message"`
		Author    string    `db:"author"`
		TaskID    *string   `db:"task_id"`
		CreatedAt time.Time `db:"created_at"`
	}
	logs := []logRow{}
	_ = h.db.SelectContext(c.Request().Context(), &logs,
		`SELECT id::text, message, author, task_id::text, COALESCE(date, created_at) AS created_at
		 FROM case_logs WHERE case_id = $1::uuid ORDER BY created_at DESC`, caseID)
	for _, l := range logs {
		entries = append(entries, timelineEntry{
			ID: l.ID, Type: "log", Date: l.CreatedAt, Message: l.Message, Author: l.Author, TaskID: l.TaskID,
		})
	}

	// Fetch audit events
	type auditRow struct {
		ID        string    `db:"id"`
		Action    string    `db:"action"`
		Actor     string    `db:"actor"`
		CreatedAt time.Time `db:"created_at"`
	}
	audits := []auditRow{}
	_ = h.db.SelectContext(c.Request().Context(), &audits,
		`SELECT id::text, action, actor, created_at
		 FROM audit_events WHERE entity_type = 'case' AND entity_id = $1 ORDER BY created_at DESC LIMIT 200`, caseID)
	for _, a := range audits {
		entries = append(entries, timelineEntry{
			ID: a.ID, Type: "audit", Date: a.CreatedAt, Message: a.Action, Author: a.Actor, Action: a.Action,
		})
	}

	// Sort by date descending (most recent first)
	for i := 0; i < len(entries); i++ {
		for j := i + 1; j < len(entries); j++ {
			if entries[j].Date.After(entries[i].Date) {
				entries[i], entries[j] = entries[j], entries[i]
			}
		}
	}

	return c.JSON(http.StatusOK, map[string]any{"entries": entries, "total": len(entries)})
}

// GetObservable returns a single observable by ID with its analyzer jobs.
// Mirrors legacy ObservableCtrl.get / observable detail view.
func (h *DetailHandler) GetObservable(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		return apierr.New(http.StatusBadRequest, "missing id")
	}
	rows := []detailObservable{}
	if err := h.db.SelectContext(c.Request().Context(), &rows, observableSelectSQL+` WHERE id = $1::uuid LIMIT 1`, id); err != nil || len(rows) == 0 {
		return apierr.New(http.StatusNotFound, "observable not found")
	}
	obs := rows[0]

	// Fetch analyzer jobs for this observable (Cortex integration)
	type jobRow struct {
		ID         string     `db:"id" json:"id"`
		AnalyzerID string     `db:"analyzer_id" json:"analyzer_id"`
		Status     string     `db:"status" json:"status"`
		Report     string     `db:"report" json:"report,omitempty"`
		StartedAt  *time.Time `db:"started_at" json:"started_at,omitempty"`
		FinishedAt *time.Time `db:"finished_at" json:"finished_at,omitempty"`
		CreatedAt  time.Time  `db:"created_at" json:"created_at"`
	}
	jobs := []jobRow{}
	_ = h.db.SelectContext(c.Request().Context(), &jobs,
		`SELECT id::text AS id, analyzer_id, status, COALESCE(report::text, '') AS report, started_at, finished_at, created_at
		 FROM cortex_jobs WHERE observable_id = $1::uuid ORDER BY created_at DESC LIMIT 50`, id)

	return c.JSON(http.StatusOK, map[string]any{
		"observable": obs,
		"jobs":       jobs,
	})
}

// SimilarObservables returns observables in other cases that share the same data/data_type.
// Mirrors legacy observable detail "Links" panel (observables/details/summary.html).
func (h *DetailHandler) SimilarObservables(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		return apierr.New(http.StatusBadRequest, "missing id")
	}
	// Get the source observable
	srcRows := []detailObservable{}
	if err := h.db.SelectContext(c.Request().Context(), &srcRows, observableSelectSQL+` WHERE id = $1::uuid LIMIT 1`, id); err != nil || len(srcRows) == 0 {
		return apierr.New(http.StatusNotFound, "observable not found")
	}
	src := srcRows[0]
	if src.IgnoreSimilarity {
		return c.JSON(http.StatusOK, map[string]any{"values": []any{}, "total": 0})
	}

	type similarObs struct {
		ID               string         `db:"id" json:"id"`
		DataType         string         `db:"data_type" json:"data_type"`
		Data             string         `db:"data" json:"data"`
		Message          string         `db:"message" json:"message"`
		TLP              int            `db:"tlp" json:"tlp"`
		IOC              bool           `db:"ioc" json:"ioc"`
		Sighted          bool           `db:"sighted" json:"sighted"`
		IgnoreSimilarity bool           `db:"ignore_similarity" json:"ignore_similarity"`
		Tags             pq.StringArray `db:"tags" json:"tags"`
		CaseID           string         `db:"case_id" json:"case_id"`
		CaseNumber       int            `db:"case_number" json:"case_number"`
		CaseTitle        string         `db:"case_title" json:"case_title"`
		StartDate        *time.Time     `db:"start_date" json:"start_date,omitempty"`
		CreatedAt        time.Time      `db:"created_at" json:"created_at"`
	}
	rows := []similarObs{}
	err := h.db.SelectContext(c.Request().Context(), &rows, `
		SELECT o.id::text AS id, o.data_type, o.data, o.message, o.tlp, o.ioc, o.sighted,
			o.ignore_similarity, o.tags, o.case_id::text AS case_id,
			c.number AS case_number, c.title AS case_title, c.start_date, o.created_at
		FROM observables o
		JOIN cases c ON c.id = o.case_id
		WHERE o.data_type = $1 AND lower(o.data) = lower($2)
			AND o.id <> $3::uuid
			AND o.ignore_similarity = false
		ORDER BY o.created_at DESC
		LIMIT 50`, src.DataType, src.Data, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "similar observables query failed")
	}
	return c.JSON(http.StatusOK, map[string]any{"values": rows, "total": len(rows)})
}

// ListTaskLogs returns logs scoped to a specific task.
func (h *DetailHandler) ListTaskLogs(c echo.Context) error {
	taskID := strings.TrimSpace(c.Param("id"))
	rows, err := h.taskLogs(c, taskID)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "task logs failed")
	}
	return c.JSON(http.StatusOK, map[string]any{"values": rows, "total": len(rows)})
}

// relatedCases returns cases linked by shared observables (mirrors legacy case.links.html).
func (h *DetailHandler) relatedCases(c echo.Context, caseID string) ([]detailRelatedCase, error) {
	rows := []detailRelatedCase{}
	err := h.db.SelectContext(c.Request().Context(), &rows,
		`SELECT DISTINCT c.id::text AS id, c.number, c.title, c.severity, c.tlp, c.status,
			COALESCE(c.resolution_status, '') AS resolution_status, c.start_date, c.end_date, c.tags,
			ARRAY(SELECT unnest(c.merged_from)::text) AS merged_from
		 FROM observables o1
		 JOIN observables o2 ON o1.data = o2.data AND o1.data_type = o2.data_type AND o1.case_id != o2.case_id
		 JOIN cases c ON c.id = o2.case_id
		 WHERE o1.case_id = $1::uuid
		 ORDER BY c.updated_at DESC
		 LIMIT 50`, caseID)
	if err != nil {
		return nil, err
	}
	for i := range rows {
		obs := []detailObservable{}
		_ = h.db.SelectContext(c.Request().Context(), &obs,
			`SELECT o.id::text, o.data_type, o.data, o.ioc, o.sighted
			 FROM observables o
			 WHERE o.case_id = $1::uuid AND o.data IN (
				SELECT o2.data FROM observables o2 WHERE o2.case_id = $2::uuid AND o2.data_type = o.data_type
			 ) LIMIT 10`, rows[i].ID, caseID)
		rows[i].LinkedObservables = obs
		rows[i].LinksCount = len(obs)
	}
	return rows, nil
}

// caseResponderActions returns Cortex responder actions for a case.
func (h *DetailHandler) caseResponderActions(c echo.Context, caseID string) ([]detailResponderAction, error) {
	rows := []detailResponderAction{}
	err := h.db.SelectContext(c.Request().Context(), &rows,
		`SELECT id::text, COALESCE(responder_id, '') AS responder_id, COALESCE(responder_name, '') AS responder_name,
			COALESCE(status, 'Unknown') AS status, COALESCE(object_type, '') AS object_type,
			COALESCE(object_id, '') AS object_id, start_date, end_date
		 FROM responder_actions WHERE object_id = $1::text ORDER BY created_at DESC LIMIT 50`, caseID)
	if err != nil {
		return nil, err
	}

	return rows, nil
}

// alertCustomFields returns custom fields for an alert.
func (h *DetailHandler) alertCustomFields(c echo.Context, alertID string) ([]detailAlertCustomField, error) {
	rows := []detailAlertCustomField{}
	err := h.db.SelectContext(c.Request().Context(), &rows,
		`SELECT cf.name, COALESCE(acf.value, '') AS value, COALESCE(cf.type, '') AS field_type
		 FROM alert_custom_fields acf
		 JOIN custom_fields cf ON cf.id = acf.custom_field_id
		 WHERE acf.alert_id = $1::uuid
		 ORDER BY cf.name`, alertID)
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// caseAlerts returns alerts linked to a case (mirrors legacy case.alerts.html).
func (h *DetailHandler) caseAlerts(c echo.Context, caseID string) ([]detailCaseAlert, error) {
	rows := []detailCaseAlert{}
	err := h.db.SelectContext(c.Request().Context(), &rows,
		`SELECT a.id::text AS id, a.title, a.type, a.source, a.source_ref, a.severity, a.status, a.tags, a.created_at
		 FROM alerts a WHERE a.case_id = $1::uuid ORDER BY a.created_at DESC`, caseID)
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// CaseStats returns aggregated case statistics for the dashboard.
// Mirrors legacy TheHive 4 case stats API.
func (h *DetailHandler) CaseStats(c echo.Context) error {
	stats := struct {
		TotalCases    int            `db:"total_cases" json:"total_cases"`
		OpenCases     int            `db:"open_cases" json:"open_cases"`
		ResolvedCases int            `db:"resolved_cases" json:"resolved_cases"`
		DupCases      int            `db:"dup_cases" json:"dup_cases"`
		BySeverity    map[string]int `json:"by_severity"`
		ByStatus      map[string]int `json:"by_status"`
		ByOwner       map[string]int `json:"by_owner"`
	}{BySeverity: map[string]int{}, ByStatus: map[string]int{}, ByOwner: map[string]int{}}

	// Total/open/resolved/duplicated counts
	err := h.db.GetContext(c.Request().Context(), &stats,
		`SELECT
			COUNT(*) AS total_cases,
			COUNT(*) FILTER (WHERE status = 'Open') AS open_cases,
			COUNT(*) FILTER (WHERE status = 'Resolved') AS resolved_cases,
			COUNT(*) FILTER (WHERE status = 'Duplicated') AS dup_cases
		 FROM cases`)
	if err != nil {
		return c.JSON(500, map[string]string{"error": "failed to get case stats"})
	}

	// By severity
	sevRows := []struct {
		Key   string `db:"key"`
		Count int    `db:"count"`
	}{}
	_ = h.db.SelectContext(c.Request().Context(), &sevRows,
		`SELECT severity::text AS key, COUNT(*) AS count FROM cases GROUP BY severity ORDER BY severity`)
	for _, r := range sevRows {
		stats.BySeverity[r.Key] = r.Count
	}

	// By status
	statusRows := []struct {
		Key   string `db:"key"`
		Count int    `db:"count"`
	}{}
	_ = h.db.SelectContext(c.Request().Context(), &statusRows,
		`SELECT status AS key, COUNT(*) AS count FROM cases GROUP BY status ORDER BY status`)
	for _, r := range statusRows {
		stats.ByStatus[r.Key] = r.Count
	}

	// By owner (top 10)
	ownerRows := []struct {
		Key   string `db:"key"`
		Count int    `db:"count"`
	}{}
	_ = h.db.SelectContext(c.Request().Context(), &ownerRows,
		`SELECT owner AS key, COUNT(*) AS count FROM cases GROUP BY owner ORDER BY count DESC LIMIT 10`)
	for _, r := range ownerRows {
		stats.ByOwner[r.Key] = r.Count
	}

	return c.JSON(200, stats)
}

// AlertStats returns aggregated alert statistics for the dashboard.
func (h *DetailHandler) AlertStats(c echo.Context) error {
	stats := struct {
		TotalAlerts int            `db:"total_alerts" json:"total_alerts"`
		NewAlerts   int            `db:"new_alerts" json:"new_alerts"`
		Imported    int            `db:"imported" json:"imported"`
		Merged      int            `db:"merged" json:"merged"`
		Ignored     int            `db:"ignored" json:"ignored"`
		BySeverity  map[string]int `json:"by_severity"`
		ByType      map[string]int `json:"by_type"`
		BySource    map[string]int `json:"by_source"`
	}{BySeverity: map[string]int{}, ByType: map[string]int{}, BySource: map[string]int{}}

	err := h.db.GetContext(c.Request().Context(), &stats,
		`SELECT
			COUNT(*) AS total_alerts,
			COUNT(*) FILTER (WHERE status = 'New') AS new_alerts,
			COUNT(*) FILTER (WHERE status = 'Imported') AS imported,
			COUNT(*) FILTER (WHERE status = 'Merged') AS merged,
			COUNT(*) FILTER (WHERE status = 'Ignored') AS ignored
		 FROM alerts`)
	if err != nil {
		return c.JSON(500, map[string]string{"error": "failed to get alert stats"})
	}

	sevRows := []struct {
		Key   string `db:"key"`
		Count int    `db:"count"`
	}{}
	_ = h.db.SelectContext(c.Request().Context(), &sevRows,
		`SELECT severity::text AS key, COUNT(*) AS count FROM alerts GROUP BY severity ORDER BY severity`)
	for _, r := range sevRows {
		stats.BySeverity[r.Key] = r.Count
	}

	typeRows := []struct {
		Key   string `db:"key"`
		Count int    `db:"count"`
	}{}
	_ = h.db.SelectContext(c.Request().Context(), &typeRows,
		`SELECT type AS key, COUNT(*) AS count FROM alerts GROUP BY type ORDER BY count DESC LIMIT 10`)
	for _, r := range typeRows {
		stats.ByType[r.Key] = r.Count
	}

	sourceRows := []struct {
		Key   string `db:"key"`
		Count int    `db:"count"`
	}{}
	_ = h.db.SelectContext(c.Request().Context(), &sourceRows,
		`SELECT source AS key, COUNT(*) AS count FROM alerts GROUP BY source ORDER BY count DESC LIMIT 10`)
	for _, r := range sourceRows {
		stats.BySource[r.Key] = r.Count
	}

	return c.JSON(200, stats)
}
