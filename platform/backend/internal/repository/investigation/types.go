package investigation

import (
	"context"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/lib/pq"
)

const (
	SourceDemo     = "demo"
	SourceLegacy   = "legacy"
	SourcePostgres = "postgres"

	ModeDemo     = "demo-read-only"
	ModeLegacy   = "legacy-read-only"
	ModePostgres = "postgres-read-only"
)

const defaultLimit = 200

type Reader interface {
	ListCases(ctx context.Context, requestID string, query ListQuery) CaseCollection
	ListAlerts(ctx context.Context, requestID string, query ListQuery) AlertCollection
	ListObservables(ctx context.Context, requestID string, query ListQuery) ObservableCollection
}

type ListQuery struct {
	Offset  int               `json:"-"`
	Limit   int               `json:"-"`
	Range   [2]int            `json:"range"`
	Sort    SortSpec          `json:"sort"`
	Filters map[string]string `json:"filters"`
	DSL     string            `json:"-"`
}

type SortSpec struct {
	Field string `json:"field"`
	Order string `json:"order"`
}

type CaseCollection struct {
	Values  []CaseSummary     `json:"values"`
	Total   int               `json:"total"`
	Mode    string            `json:"mode"`
	Range   [2]int            `json:"range"`
	Sort    SortSpec          `json:"sort"`
	Filters map[string]string `json:"filters"`
}

type AlertCollection struct {
	Values  []AlertSummary    `json:"values"`
	Total   int               `json:"total"`
	Mode    string            `json:"mode"`
	Range   [2]int            `json:"range"`
	Sort    SortSpec          `json:"sort"`
	Filters map[string]string `json:"filters"`
}

type ObservableCollection struct {
	Values  []ObservableSummary `json:"values"`
	Total   int                 `json:"total"`
	Mode    string              `json:"mode"`
	Range   [2]int              `json:"range"`
	Sort    SortSpec            `json:"sort"`
	Filters map[string]string   `json:"filters"`
}

type CaseSummary struct {
	ID                 string         `db:"id" json:"id"`
	Number             int            `db:"number" json:"number"`
	Title              string         `db:"title" json:"title"`
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
	TaskCount          int            `db:"task_count" json:"task_count"`
	ObservableCount    int            `db:"observable_count" json:"observable_count"`
	AlertCount         int            `db:"alert_count" json:"alert_count"`
	CreatedAt          time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt          time.Time      `db:"updated_at" json:"updated_at"`
}

type AlertSummary struct {
	ID              string         `db:"id" json:"id"`
	Title           string         `db:"title" json:"title"`
	Type            string         `db:"type" json:"type"`
	Source          string         `db:"source" json:"source"`
	SourceRef       string         `db:"source_ref" json:"source_ref"`
	Severity        int            `db:"severity" json:"severity"`
	TLP             int            `db:"tlp" json:"tlp"`
	PAP             int            `db:"pap" json:"pap"`
	Status          string         `db:"status" json:"status"`
	Read            bool           `db:"read" json:"read"`
	Follow          bool           `db:"follow" json:"follow"`
	Flag            bool           `db:"flag" json:"flag"`
	ExternalLink    string         `db:"external_link" json:"external_link"`
	OrganisationID  string         `db:"organisation_id" json:"organisation_id"`
	CaseTemplate    string         `db:"case_template" json:"case_template"`
	CaseNumber      *int           `db:"case_number" json:"case_number,omitempty"`
	ObservableCount int            `db:"observable_count" json:"observable_count"`
	Tags            pq.StringArray `db:"tags" json:"tags"`
	LastSyncDate    *time.Time     `db:"last_sync_date" json:"last_sync_date,omitempty"`
	CreatedAt       time.Time      `db:"created_at" json:"created_at"`
}

type ObservableSummary struct {
	ID               string         `db:"id" json:"id"`
	DataType         string         `db:"data_type" json:"data_type"`
	Data             string         `db:"data" json:"data"`
	Message          string         `db:"message" json:"message"`
	TLP              int            `db:"tlp" json:"tlp"`
	IOC              bool           `db:"ioc" json:"ioc"`
	Sighted          bool           `db:"sighted" json:"sighted"`
	IgnoreSimilarity bool           `db:"ignore_similarity" json:"ignore_similarity"`
	AttachmentID     string         `db:"attachment_id" json:"attachment_id,omitempty"`
	Tags             pq.StringArray `db:"tags" json:"tags"`
	CaseID           string         `db:"case_id" json:"case_id,omitempty"`
	CaseNumber       int            `db:"case_number" json:"case_number"`
	CaseTitle        string         `db:"case_title" json:"case_title"`
	CreatedBy        string         `db:"created_by" json:"created_by"`
	CreatedAt        time.Time      `db:"created_at" json:"created_at"`
}

func NewListQuery(values url.Values, defaultSort SortSpec) ListQuery {
	q := ListQuery{Offset: 0, Limit: defaultLimit, Sort: normaliseSort(defaultSort), Filters: map[string]string{}}
	if rawRange := strings.TrimSpace(values.Get("range")); rawRange != "" {
		parts := strings.Split(rawRange, ":")
		if len(parts) != 2 {
			parts = strings.Split(rawRange, ",")
		}
		if len(parts) == 2 {
			if start, err := strconv.Atoi(strings.TrimSpace(parts[0])); err == nil && start >= 0 {
				if end, err := strconv.Atoi(strings.TrimSpace(parts[1])); err == nil && end >= start {
					q.Offset = start
					q.Limit = end - start + 1
				}
			}
		}
	}
	if q.Limit <= 0 || q.Limit > defaultLimit {
		q.Limit = defaultLimit
	}
	if rawSort := strings.TrimSpace(values.Get("sort")); rawSort != "" {
		parts := strings.Split(rawSort, ":")
		if len(parts) != 2 {
			parts = strings.Split(rawSort, ",")
		}
		if len(parts) >= 1 && strings.TrimSpace(parts[0]) != "" {
			q.Sort.Field = strings.TrimSpace(parts[0])
		}
		if len(parts) >= 2 {
			q.Sort.Order = strings.TrimSpace(parts[1])
		}
	}
	q.Sort = normaliseSort(q.Sort)
	for key, vals := range values {
		if key == "range" || key == "sort" || key == "filter" {
			continue
		}
		if len(vals) > 0 && strings.TrimSpace(vals[0]) != "" {
			q.Filters[key] = strings.TrimSpace(vals[0])
		}
	}
	if rawFilter := strings.TrimSpace(values.Get("filter")); rawFilter != "" {
		for _, part := range strings.Split(rawFilter, ",") {
			kv := strings.SplitN(part, ":", 2)
			if len(kv) == 2 && strings.TrimSpace(kv[0]) != "" && strings.TrimSpace(kv[1]) != "" {
				q.Filters[strings.TrimSpace(kv[0])] = strings.TrimSpace(kv[1])
			}
		}
	}
	q.DSL = strings.TrimSpace(values.Get("dsl"))
	q.Range = [2]int{q.Offset, q.Offset + q.Limit - 1}
	return q
}

func normaliseSort(sort SortSpec) SortSpec {
	if strings.TrimSpace(sort.Field) == "" {
		sort.Field = "updated_at"
	}
	sort.Field = strings.TrimSpace(sort.Field)
	sort.Order = strings.ToUpper(strings.TrimSpace(sort.Order))
	if sort.Order != "ASC" {
		sort.Order = "DESC"
	}
	return sort
}

func collectionRange(query ListQuery, total, valueCount int) [2]int {
	if total == 0 || valueCount == 0 {
		return [2]int{query.Offset, query.Offset}
	}
	return [2]int{query.Offset, query.Offset + valueCount - 1}
}
