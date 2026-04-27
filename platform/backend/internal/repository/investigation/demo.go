package investigation

import (
	"context"
	"slices"
	"strings"
	"time"
)

type DemoReader struct{}

func NewDemoReader() *DemoReader {
	return &DemoReader{}
}

func (r *DemoReader) ListCases(_ context.Context, _ string, query ListQuery) CaseCollection {
	values := filterSortPageCases(sampleCases(), query)
	all := filterCases(sampleCases(), query.Filters)
	return CaseCollection{Values: values, Total: len(all), Mode: ModeDemo, Range: collectionRange(query, len(all), len(values)), Sort: query.Sort, Filters: query.Filters}
}

func (r *DemoReader) ListAlerts(_ context.Context, _ string, query ListQuery) AlertCollection {
	values := filterSortPageAlerts(sampleAlerts(), query)
	all := filterAlerts(sampleAlerts(), query.Filters)
	return AlertCollection{Values: values, Total: len(all), Mode: ModeDemo, Range: collectionRange(query, len(all), len(values)), Sort: query.Sort, Filters: query.Filters}
}

func (r *DemoReader) ListObservables(_ context.Context, _ string, query ListQuery) ObservableCollection {
	values := filterSortPageObservables(sampleObservables(), query)
	all := filterObservables(sampleObservables(), query.Filters)
	return ObservableCollection{Values: values, Total: len(all), Mode: ModeDemo, Range: collectionRange(query, len(all), len(values)), Sort: query.Sort, Filters: query.Filters}
}

func filterSortPageCases(values []CaseSummary, query ListQuery) []CaseSummary {
	filtered := filterCases(values, query.Filters)
	slices.SortFunc(filtered, func(a, b CaseSummary) int {
		result := 0
		switch query.Sort.Field {
		case "number":
			result = compareInt(a.Number, b.Number)
		case "title":
			result = strings.Compare(a.Title, b.Title)
		case "severity":
			result = compareInt(a.Severity, b.Severity)
		case "tlp":
			result = compareInt(a.TLP, b.TLP)
		case "pap":
			result = compareInt(a.PAP, b.PAP)
		case "status":
			result = strings.Compare(a.Status, b.Status)
		case "owner":
			result = strings.Compare(a.Owner, b.Owner)
		case "assignee":
			result = strings.Compare(a.Assignee, b.Assignee)
		case "created_at":
			result = a.CreatedAt.Compare(b.CreatedAt)
		default:
			result = a.UpdatedAt.Compare(b.UpdatedAt)
		}
		if query.Sort.Order == "DESC" {
			return -result
		}
		return result
	})
	return pageSlice(filtered, query)
}

func filterSortPageAlerts(values []AlertSummary, query ListQuery) []AlertSummary {
	filtered := filterAlerts(values, query.Filters)
	slices.SortFunc(filtered, func(a, b AlertSummary) int {
		result := 0
		switch query.Sort.Field {
		case "title":
			result = strings.Compare(a.Title, b.Title)
		case "type":
			result = strings.Compare(a.Type, b.Type)
		case "source":
			result = strings.Compare(a.Source, b.Source)
		case "source_ref":
			result = strings.Compare(a.SourceRef, b.SourceRef)
		case "severity":
			result = compareInt(a.Severity, b.Severity)
		case "tlp":
			result = compareInt(a.TLP, b.TLP)
		case "status":
			result = strings.Compare(a.Status, b.Status)
		default:
			result = a.CreatedAt.Compare(b.CreatedAt)
		}
		if query.Sort.Order == "DESC" {
			return -result
		}
		return result
	})
	return pageSlice(filtered, query)
}

func filterSortPageObservables(values []ObservableSummary, query ListQuery) []ObservableSummary {
	filtered := filterObservables(values, query.Filters)
	slices.SortFunc(filtered, func(a, b ObservableSummary) int {
		result := 0
		switch query.Sort.Field {
		case "data_type":
			result = strings.Compare(a.DataType, b.DataType)
		case "data":
			result = strings.Compare(a.Data, b.Data)
		case "tlp":
			result = compareInt(a.TLP, b.TLP)
		case "created_by":
			result = strings.Compare(a.CreatedBy, b.CreatedBy)
		default:
			result = a.CreatedAt.Compare(b.CreatedAt)
		}
		if query.Sort.Order == "DESC" {
			return -result
		}
		return result
	})
	return pageSlice(filtered, query)
}

func filterCases(values []CaseSummary, filters map[string]string) []CaseSummary {
	out := make([]CaseSummary, 0, len(values))
	for _, value := range values {
		if matchesStringFilter(value.Status, filters["status"]) && matchesIntFilter(value.Severity, filters["severity"]) && matchesIntFilter(value.TLP, filters["tlp"]) && matchesIntFilter(value.PAP, filters["pap"]) && matchesStringFilter(value.Assignee, filters["assignee"]) && matchesStringFilter(value.Owner, filters["owner"]) && matchesTagsFilter(value.Tags, filters["tags"]) && matchesDateRange(value.CreatedAt, filters["createdFrom"], filters["createdTo"]) && matchesDateRange(value.UpdatedAt, filters["updatedFrom"], filters["updatedTo"]) {
			out = append(out, value)
		}
	}
	return out
}

func filterAlerts(values []AlertSummary, filters map[string]string) []AlertSummary {
	out := make([]AlertSummary, 0, len(values))
	for _, value := range values {
		if matchesStringFilter(value.Status, filters["status"]) && matchesIntFilter(value.Severity, filters["severity"]) && matchesIntFilter(value.TLP, filters["tlp"]) && matchesStringFilter(value.Source, filters["source"]) && matchesStringFilter(value.Type, filters["type"]) && matchesTagsFilter(value.Tags, filters["tags"]) && matchesDateRange(value.CreatedAt, filters["createdFrom"], filters["createdTo"]) {
			out = append(out, value)
		}
	}
	return out
}

func filterObservables(values []ObservableSummary, filters map[string]string) []ObservableSummary {
	out := make([]ObservableSummary, 0, len(values))
	for _, value := range values {
		if matchesIntFilter(value.TLP, filters["tlp"]) && matchesBoolFilter(value.IOC, filters["ioc"]) && matchesBoolFilter(value.Sighted, filters["sighted"]) && matchesStringFilter(value.CreatedBy, firstNonEmpty(filters["createdBy"], filters["created_by"])) && matchesStringFilter(value.DataType, firstNonEmpty(filters["dataType"], filters["data_type"])) && matchesTagsFilter(value.Tags, filters["tags"]) && matchesDateRange(value.CreatedAt, filters["createdFrom"], filters["createdTo"]) {
			out = append(out, value)
		}
	}
	return out
}

func pageSlice[T any](values []T, query ListQuery) []T {
	if query.Offset >= len(values) {
		return []T{}
	}
	end := query.Offset + query.Limit
	if end > len(values) {
		end = len(values)
	}
	return values[query.Offset:end]
}

func matchesStringFilter(value, filter string) bool {
	filter = strings.TrimSpace(filter)
	if filter == "" {
		return true
	}
	return strings.EqualFold(value, filter) || strings.Contains(strings.ToLower(value), strings.ToLower(filter))
}

func matchesIntFilter(value int, filter string) bool {
	filter = strings.TrimSpace(filter)
	if filter == "" {
		return true
	}
	return filter == string(rune('0'+value))
}

func matchesBoolFilter(value bool, filter string) bool {
	filter = strings.ToLower(strings.TrimSpace(filter))
	if filter == "" || filter == "any" {
		return true
	}
	switch filter {
	case "true", "1", "yes", "y":
		return value
	case "false", "0", "no", "n":
		return !value
	default:
		return true
	}
}

func matchesDateRange(value time.Time, from, to string) bool {
	if strings.TrimSpace(from) != "" {
		fromTime, err := time.Parse(time.RFC3339, strings.TrimSpace(from))
		if err == nil && value.Before(fromTime) {
			return false
		}
	}
	if strings.TrimSpace(to) != "" {
		toTime, err := time.Parse(time.RFC3339, strings.TrimSpace(to))
		if err == nil && value.After(toTime) {
			return false
		}
	}
	return true
}

func matchesTagsFilter(tags []string, filter string) bool {
	filter = strings.TrimSpace(filter)
	if filter == "" {
		return true
	}
	wanted := strings.Split(filter, ",")
	for _, item := range wanted {
		needle := strings.TrimSpace(item)
		if needle == "" {
			continue
		}
		found := false
		for _, tag := range tags {
			if strings.EqualFold(tag, needle) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func compareInt(a, b int) int {
	if a < b {
		return -1
	}
	if a > b {
		return 1
	}
	return 0
}

func sampleCases() []CaseSummary {
	now := time.Now().UTC()
	return []CaseSummary{
		{ID: "case-demo-001", Number: 42, Title: "Phishing campaign targeting finance", Severity: 2, TLP: 2, PAP: 2, Status: "Open", Owner: "admin@thehive.local", Assignee: "analyst1", Tags: []string{"phishing", "finance", "misp:event"}, TaskCount: 4, ObservableCount: 12, AlertCount: 3, CreatedAt: now.Add(-72 * time.Hour), UpdatedAt: now.Add(-2 * time.Hour)},
		{ID: "case-demo-002", Number: 43, Title: "Suspicious PowerShell execution", Severity: 3, TLP: 1, PAP: 2, Status: "Open", Owner: "admin@thehive.local", Assignee: "soc-l2", Tags: []string{"endpoint", "powershell", "cortex:analyze"}, TaskCount: 6, ObservableCount: 8, AlertCount: 1, CreatedAt: now.Add(-48 * time.Hour), UpdatedAt: now.Add(-30 * time.Minute)},
		{ID: "case-demo-003", Number: 39, Title: "Resolved malware callback", Severity: 1, TLP: 2, PAP: 2, Status: "Resolved", Owner: "admin@thehive.local", Assignee: "analyst2", Tags: []string{"malware", "resolved"}, TaskCount: 5, ObservableCount: 17, AlertCount: 2, CreatedAt: now.Add(-168 * time.Hour), UpdatedAt: now.Add(-24 * time.Hour)},
	}
}

func sampleAlerts() []AlertSummary {
	now := time.Now().UTC()
	caseNumber := 42
	return []AlertSummary{
		{ID: "alert-demo-001", Title: "Multiple users reported suspicious invoice email", Type: "external", Source: "MISP", SourceRef: "misp-event-91", Severity: 2, TLP: 2, Status: "New", Read: false, ObservableCount: 9, Tags: []string{"phishing", "tlp:amber"}, CreatedAt: now.Add(-6 * time.Hour)},
		{ID: "alert-demo-002", Title: "EDR detected encoded PowerShell", Type: "internal", Source: "EDR", SourceRef: "edr-8f2a", Severity: 3, TLP: 1, Status: "Imported", Read: true, CaseNumber: &caseNumber, ObservableCount: 4, Tags: []string{"endpoint", "powershell"}, CreatedAt: now.Add(-26 * time.Hour)},
		{ID: "alert-demo-003", Title: "Known C2 domain observed in proxy logs", Type: "external", Source: "Proxy", SourceRef: "proxy-4421", Severity: 2, TLP: 2, Status: "Updated", Read: false, ObservableCount: 3, Tags: []string{"c2", "domain"}, CreatedAt: now.Add(-11 * time.Hour)},
	}
}

func sampleObservables() []ObservableSummary {
	now := time.Now().UTC()
	return []ObservableSummary{
		{ID: "obs-demo-001", DataType: "domain", Data: "login-microsoft.example", Message: "Suspicious lookalike domain from phishing email", TLP: 2, IOC: true, Sighted: true, Tags: []string{"phishing", "domain"}, CaseNumber: 42, CaseTitle: "Phishing campaign targeting finance", CreatedBy: "analyst1", CreatedAt: now.Add(-5 * time.Hour)},
		{ID: "obs-demo-002", DataType: "ip", Data: "203.0.113.44", Message: "Callback destination enriched by Cortex", TLP: 2, IOC: true, Sighted: false, Tags: []string{"c2", "cortex:vt"}, CaseNumber: 39, CaseTitle: "Resolved malware callback", CreatedBy: "analyst2", CreatedAt: now.Add(-72 * time.Hour)},
		{ID: "obs-demo-003", DataType: "hash", Data: "44d88612fea8a8f36de82e1278abb02f", Message: "Attachment hash", TLP: 1, IOC: false, Sighted: false, Tags: []string{"attachment"}, CaseNumber: 43, CaseTitle: "Suspicious PowerShell execution", CreatedBy: "soc-l2", CreatedAt: now.Add(-20 * time.Hour)},
	}
}
