package investigation

import (
	"net/url"
	"reflect"
	"strings"
	"testing"
)

func TestNewReaderSelectsSource(t *testing.T) {
	tests := []struct {
		name   string
		source string
		want   any
	}{
		{name: "demo", source: SourceDemo, want: &DemoReader{}},
		{name: "legacy", source: SourceLegacy, want: &LegacyReader{}},
		{name: "postgres", source: SourcePostgres, want: &PostgresReader{}},
		{name: "empty defaults postgres", source: "", want: &PostgresReader{}},
		{name: "unknown defaults postgres", source: "bad", want: &PostgresReader{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NewReader(nil, FactoryConfig{Source: tt.source})
			if reflect.TypeOf(got) != reflect.TypeOf(tt.want) {
				t.Fatalf("reader type = %T, want %T", got, tt.want)
			}
		})
	}
}

func TestDemoReaderReturnsStableReadOnlyMode(t *testing.T) {
	reader := NewDemoReader()
	query := NewListQuery(url.Values{}, SortSpec{Field: "updated_at", Order: "DESC"})
	cases := reader.ListCases(nil, "req-1", query)
	if cases.Mode != ModeDemo || len(cases.Values) == 0 || cases.Total == 0 {
		t.Fatalf("cases mode=%q len=%d total=%d, want mode %q with sample rows", cases.Mode, len(cases.Values), cases.Total, ModeDemo)
	}
	alerts := reader.ListAlerts(nil, "req-1", query)
	if alerts.Mode != ModeDemo || len(alerts.Values) == 0 || alerts.Total == 0 {
		t.Fatalf("alerts mode=%q len=%d total=%d, want mode %q with sample rows", alerts.Mode, len(alerts.Values), alerts.Total, ModeDemo)
	}
	observables := reader.ListObservables(nil, "req-1", query)
	if observables.Mode != ModeDemo || len(observables.Values) == 0 || observables.Total == 0 {
		t.Fatalf("observables mode=%q len=%d total=%d, want mode %q with sample rows", observables.Mode, len(observables.Values), observables.Total, ModeDemo)
	}
}

func TestListQueryParsesRangeSortAndFilters(t *testing.T) {
	values := url.Values{}
	values.Set("range", "10:19")
	values.Set("sort", "severity:asc")
	values.Set("status", "Open")
	values.Set("filter", "tlp:2,tags:phishing")
	query := NewListQuery(values, SortSpec{Field: "updated_at", Order: "DESC"})
	if query.Offset != 10 || query.Limit != 10 || query.Range != [2]int{10, 19} {
		t.Fatalf("range parsed as offset=%d limit=%d range=%v", query.Offset, query.Limit, query.Range)
	}
	if query.Sort != (SortSpec{Field: "severity", Order: "ASC"}) {
		t.Fatalf("sort parsed as %#v", query.Sort)
	}
	if query.Filters["status"] != "Open" || query.Filters["tlp"] != "2" || query.Filters["tags"] != "phishing" {
		t.Fatalf("filters parsed as %#v", query.Filters)
	}
}

func TestDemoReaderAppliesFiltersAndPagination(t *testing.T) {
	values := url.Values{}
	values.Set("range", "0:0")
	values.Set("severity", "3")
	query := NewListQuery(values, SortSpec{Field: "updated_at", Order: "DESC"})
	result := NewDemoReader().ListCases(nil, "req-1", query)
	if result.Total != 1 || len(result.Values) != 1 {
		t.Fatalf("filtered/paged cases total=%d len=%d", result.Total, len(result.Values))
	}
	if result.Values[0].Severity != 3 {
		t.Fatalf("severity=%d, want 3", result.Values[0].Severity)
	}
}

func TestBuildObservableWhereSupportsIocSightedCreatedByAndDateRange(t *testing.T) {
	filters := map[string]string{
		"ioc":         "true",
		"sighted":     "false",
		"createdBy":   "analyst1",
		"createdFrom": "2026-01-01T00:00:00Z",
		"createdTo":   "2026-01-31T23:59:59Z",
	}
	where, args := buildObservableWhere(filters)
	wantParts := []string{"o.ioc = $1::boolean", "o.sighted = $2::boolean", "o.created_by ILIKE '%' || $3 || '%'", "o.created_at >= $4::timestamptz", "o.created_at <= $5::timestamptz"}
	for _, part := range wantParts {
		if !strings.Contains(where, part) {
			t.Fatalf("where %q missing %q", where, part)
		}
	}
	if len(args) != 5 || args[0] != true || args[1] != false || args[2] != "analyst1" {
		t.Fatalf("args = %#v", args)
	}
}

func TestDemoReaderAppliesObservableBooleanAndCreatedByFilters(t *testing.T) {
	values := url.Values{}
	values.Set("ioc", "true")
	values.Set("sighted", "true")
	values.Set("createdBy", "analyst1")
	query := NewListQuery(values, SortSpec{Field: "created_at", Order: "DESC"})
	result := NewDemoReader().ListObservables(nil, "req-1", query)
	if result.Total != 1 || len(result.Values) != 1 {
		t.Fatalf("filtered observables total=%d len=%d", result.Total, len(result.Values))
	}
	if !result.Values[0].IOC || !result.Values[0].Sighted || result.Values[0].CreatedBy != "analyst1" {
		t.Fatalf("observable filter result = %#v", result.Values[0])
	}
}
