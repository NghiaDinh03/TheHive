package investigation

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type LegacyClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

type LegacyReader struct {
	client *LegacyClient
}

func NewLegacyClient(baseURL, apiKey string, timeout time.Duration) *LegacyClient {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		return nil
	}
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	return &LegacyClient{baseURL: baseURL, apiKey: strings.TrimSpace(apiKey), httpClient: &http.Client{Timeout: timeout}}
}

func NewLegacyReader(client *LegacyClient) *LegacyReader {
	return &LegacyReader{client: client}
}

func (r *LegacyReader) ListCases(ctx context.Context, requestID string, query ListQuery) CaseCollection {
	if r.client == nil {
		return NewDemoReader().ListCases(ctx, requestID, query)
	}
	values, err := r.client.listCases(ctx, requestID, query)
	if err != nil {
		return NewDemoReader().ListCases(ctx, requestID, query)
	}
	all := filterCases(values, query.Filters)
	paged := filterSortPageCases(values, query)
	return CaseCollection{Values: paged, Total: len(all), Mode: ModeLegacy, Range: collectionRange(query, len(all), len(paged)), Sort: query.Sort, Filters: query.Filters}
}

func (r *LegacyReader) ListAlerts(ctx context.Context, requestID string, query ListQuery) AlertCollection {
	if r.client == nil {
		return NewDemoReader().ListAlerts(ctx, requestID, query)
	}
	values, err := r.client.listAlerts(ctx, requestID, query)
	if err != nil {
		return NewDemoReader().ListAlerts(ctx, requestID, query)
	}
	all := filterAlerts(values, query.Filters)
	paged := filterSortPageAlerts(values, query)
	return AlertCollection{Values: paged, Total: len(all), Mode: ModeLegacy, Range: collectionRange(query, len(all), len(paged)), Sort: query.Sort, Filters: query.Filters}
}

func (r *LegacyReader) ListObservables(ctx context.Context, requestID string, query ListQuery) ObservableCollection {
	if r.client == nil {
		return NewDemoReader().ListObservables(ctx, requestID, query)
	}
	values, err := r.client.listObservables(ctx, requestID, query)
	if err != nil {
		return NewDemoReader().ListObservables(ctx, requestID, query)
	}
	all := filterObservables(values, query.Filters)
	paged := filterSortPageObservables(values, query)
	return ObservableCollection{Values: paged, Total: len(all), Mode: ModeLegacy, Range: collectionRange(query, len(all), len(paged)), Sort: query.Sort, Filters: query.Filters}
}

func (c *LegacyClient) listCases(ctx context.Context, requestID string, query ListQuery) ([]CaseSummary, error) {
	var raw []map[string]any
	if err := c.getJSON(ctx, "/api/case", requestID, query, &raw); err != nil {
		return nil, err
	}
	items := make([]CaseSummary, 0, len(raw))
	for _, item := range raw {
		items = append(items, CaseSummary{ID: stringValue(item, "_id", "id"), Number: intValue(item, "caseId", "number"), Title: stringValue(item, "title"), Severity: intValue(item, "severity"), TLP: intValue(item, "tlp"), PAP: intValue(item, "pap"), Status: stringValue(item, "status"), Owner: stringValue(item, "owner"), Assignee: stringValue(item, "assignee"), Tags: stringSliceValue(item, "tags"), TaskCount: intValue(item, "tasks", "taskCount"), ObservableCount: intValue(item, "observables", "observableCount"), AlertCount: intValue(item, "alerts", "alertCount"), CreatedAt: timeValue(item, "createdAt", "created_at"), UpdatedAt: timeValue(item, "updatedAt", "updated_at")})
	}
	return items, nil
}

func (c *LegacyClient) listAlerts(ctx context.Context, requestID string, query ListQuery) ([]AlertSummary, error) {
	var raw []map[string]any
	if err := c.getJSON(ctx, "/api/alert", requestID, query, &raw); err != nil {
		return nil, err
	}
	items := make([]AlertSummary, 0, len(raw))
	for _, item := range raw {
		items = append(items, AlertSummary{ID: stringValue(item, "_id", "id"), Title: stringValue(item, "title"), Type: stringValue(item, "type"), Source: stringValue(item, "source"), SourceRef: stringValue(item, "sourceRef", "source_ref"), Severity: intValue(item, "severity"), TLP: intValue(item, "tlp"), Status: stringValue(item, "status"), Read: boolValue(item, "read"), CaseNumber: intPtrValue(item, "caseId", "caseNumber"), ObservableCount: intValue(item, "observables", "observableCount"), Tags: stringSliceValue(item, "tags"), CreatedAt: timeValue(item, "createdAt", "created_at")})
	}
	return items, nil
}

func (c *LegacyClient) listObservables(ctx context.Context, requestID string, query ListQuery) ([]ObservableSummary, error) {
	var raw []map[string]any
	if err := c.getJSON(ctx, "/api/case/artifact", requestID, query, &raw); err != nil {
		return nil, err
	}
	items := make([]ObservableSummary, 0, len(raw))
	for _, item := range raw {
		items = append(items, ObservableSummary{ID: stringValue(item, "_id", "id"), DataType: stringValue(item, "dataType", "data_type"), Data: stringValue(item, "data"), Message: stringValue(item, "message"), TLP: intValue(item, "tlp"), IOC: boolValue(item, "ioc"), Sighted: boolValue(item, "sighted"), Tags: stringSliceValue(item, "tags"), CaseNumber: intValue(item, "caseId", "caseNumber"), CaseTitle: stringValue(item, "caseTitle"), CreatedBy: stringValue(item, "createdBy", "created_by"), CreatedAt: timeValue(item, "createdAt", "created_at")})
	}
	return items, nil
}

func (c *LegacyClient) getJSON(ctx context.Context, path, requestID string, query ListQuery, target any) error {
	u, err := url.JoinPath(c.baseURL, path)
	if err != nil {
		return err
	}
	parsed, err := url.Parse(u)
	if err != nil {
		return err
	}
	params := parsed.Query()
	params.Set("range", fmt.Sprintf("%d:%d", query.Range[0], query.Range[1]))
	params.Set("sort", query.Sort.Field+":"+query.Sort.Order)
	for key, value := range query.Filters {
		params.Set(key, value)
	}
	parsed.RawQuery = params.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	if requestID != "" {
		req.Header.Set("X-Request-ID", requestID)
	}
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	res, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("legacy api returned %d", res.StatusCode)
	}
	return json.NewDecoder(res.Body).Decode(target)
}

func stringValue(m map[string]any, keys ...string) string {
	for _, key := range keys {
		if v, ok := m[key]; ok && v != nil {
			return strings.TrimSpace(fmt.Sprint(v))
		}
	}
	return ""
}

func intValue(m map[string]any, keys ...string) int {
	if v := intPtrValue(m, keys...); v != nil {
		return *v
	}
	return 0
}

func intPtrValue(m map[string]any, keys ...string) *int {
	for _, key := range keys {
		if v, ok := m[key]; ok && v != nil {
			switch t := v.(type) {
			case float64:
				i := int(t)
				return &i
			case int:
				return &t
			case string:
				if i, err := strconv.Atoi(t); err == nil {
					return &i
				}
			case []any:
				i := len(t)
				return &i
			}
		}
	}
	return nil
}

func boolValue(m map[string]any, keys ...string) bool {
	for _, key := range keys {
		if v, ok := m[key]; ok && v != nil {
			switch t := v.(type) {
			case bool:
				return t
			case string:
				return strings.EqualFold(t, "true")
			}
		}
	}
	return false
}

func stringSliceValue(m map[string]any, keys ...string) []string {
	for _, key := range keys {
		if v, ok := m[key]; ok && v != nil {
			switch t := v.(type) {
			case []string:
				return t
			case []any:
				out := make([]string, 0, len(t))
				for _, item := range t {
					out = append(out, fmt.Sprint(item))
				}
				return out
			case string:
				if t == "" {
					return nil
				}
				return strings.Split(t, ",")
			}
		}
	}
	return nil
}

func timeValue(m map[string]any, keys ...string) time.Time {
	for _, key := range keys {
		if v, ok := m[key]; ok && v != nil {
			switch t := v.(type) {
			case float64:
				return time.UnixMilli(int64(t)).UTC()
			case string:
				if parsed, err := time.Parse(time.RFC3339, t); err == nil {
					return parsed.UTC()
				}
			}
		}
	}
	return time.Time{}
}
