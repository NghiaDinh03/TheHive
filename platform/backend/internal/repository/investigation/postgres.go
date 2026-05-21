package investigation

import (
	"context"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
)

type PostgresReader struct {
	db *sqlx.DB
}

func NewPostgresReader(db *sqlx.DB) *PostgresReader {
	return &PostgresReader{db: db}
}

func (r *PostgresReader) ListCases(ctx context.Context, _ string, query ListQuery) CaseCollection {
	values, total, err := r.listCases(ctx, query)
	if err != nil {
		return CaseCollection{Values: []CaseSummary{}, Total: 0, Mode: ModePostgres, Range: collectionRange(query, 0, 0), Sort: query.Sort, Filters: query.Filters}
	}
	return CaseCollection{Values: values, Total: total, Mode: ModePostgres, Range: collectionRange(query, total, len(values)), Sort: query.Sort, Filters: query.Filters}
}

func (r *PostgresReader) ListAlerts(ctx context.Context, _ string, query ListQuery) AlertCollection {
	values, total, err := r.listAlerts(ctx, query)
	if err != nil {
		return AlertCollection{Values: []AlertSummary{}, Total: 0, Mode: ModePostgres, Range: collectionRange(query, 0, 0), Sort: query.Sort, Filters: query.Filters}
	}
	return AlertCollection{Values: values, Total: total, Mode: ModePostgres, Range: collectionRange(query, total, len(values)), Sort: query.Sort, Filters: query.Filters}
}

func (r *PostgresReader) ListObservables(ctx context.Context, _ string, query ListQuery) ObservableCollection {
	values, total, err := r.listObservables(ctx, query)
	if err != nil {
		return ObservableCollection{Values: []ObservableSummary{}, Total: 0, Mode: ModePostgres, Range: collectionRange(query, 0, 0), Sort: query.Sort, Filters: query.Filters}
	}
	return ObservableCollection{Values: values, Total: total, Mode: ModePostgres, Range: collectionRange(query, total, len(values)), Sort: query.Sort, Filters: query.Filters}
}

func (r *PostgresReader) listCases(ctx context.Context, query ListQuery) ([]CaseSummary, int, error) {
	if r.db == nil {
		return nil, 0, fmt.Errorf("postgres source unavailable")
	}
	where, args := buildCaseWhere(query.Filters)
	where, args = mergeDSLWhere(where, args, query.DSL, caseDSLFields())
	orderBy := safeOrderBy(query.Sort, map[string]string{
		"number":            "c.number",
		"title":             "c.title",
		"severity":          "c.severity",
		"tlp":               "c.tlp",
		"pap":               "c.pap",
		"status":            "c.status",
		"owner":             "c.owner",
		"assignee":          "c.assignee",
		"flag":              "c.flag",
		"impact_status":     "c.impact_status",
		"impactStatus":      "c.impact_status",
		"resolution_status": "c.resolution_status",
		"resolutionStatus":  "c.resolution_status",
		"case_template":     "c.case_template",
		"caseTemplate":      "c.case_template",
		"start_date":        "c.start_date",
		"startDate":         "c.start_date",
		"end_date":          "c.end_date",
		"endDate":           "c.end_date",
		"created_at":        "c.created_at",
		"updated_at":        "c.updated_at",
	}, "c.updated_at")
	rows := []CaseSummary{}
	args = append(args, query.Limit, query.Offset)
	err := r.db.SelectContext(ctx, &rows, `
		SELECT c.id::text AS id, c.number, c.title, c.severity, c.tlp, c.pap, c.status, c.owner, c.assignee, c.tags,
			c.flag, c.summary, c.impact_status, c.resolution_status, c.case_template, c.owning_organisation, c.organisation_ids,
			c.start_date, c.end_date,
			COUNT(DISTINCT t.id)::int AS task_count,
			COUNT(DISTINCT o.id)::int AS observable_count,
			COUNT(DISTINCT a.id)::int AS alert_count,
			c.created_at, c.updated_at
		FROM cases c
		LEFT JOIN task_items t ON t.case_id = c.id
		LEFT JOIN observables o ON o.case_id = c.id
		LEFT JOIN alerts a ON a.case_id = c.id
		`+where+`
		GROUP BY c.id
		ORDER BY `+orderBy+`
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)), args...)
	if err != nil {
		return nil, 0, err
	}
	total, err := r.count(ctx, "cases c", where, args[:len(args)-2])
	return rows, total, err
}

func (r *PostgresReader) listAlerts(ctx context.Context, query ListQuery) ([]AlertSummary, int, error) {
	if r.db == nil {
		return nil, 0, fmt.Errorf("postgres source unavailable")
	}
	where, args := buildAlertWhere(query.Filters)
	where, args = mergeDSLWhere(where, args, query.DSL, alertDSLFields())
	orderBy := safeOrderBy(query.Sort, map[string]string{
		"title":           "a.title",
		"type":            "a.type",
		"source":          "a.source",
		"source_ref":      "a.source_ref",
		"sourceRef":       "a.source_ref",
		"severity":        "a.severity",
		"tlp":             "a.tlp",
		"pap":             "a.pap",
		"status":          "a.status",
		"flag":            "a.flag",
		"follow":          "a.follow",
		"organisation_id": "a.organisation_id",
		"organisationId":  "a.organisation_id",
		"case_template":   "a.case_template",
		"caseTemplate":    "a.case_template",
		"last_sync_date":  "a.last_sync_date",
		"lastSyncDate":    "a.last_sync_date",
		"created_at":      "a.created_at",
		"updated_at":      "a.updated_at",
	}, "a.created_at")
	rows := []AlertSummary{}
	args = append(args, query.Limit, query.Offset)
	err := r.db.SelectContext(ctx, &rows, `
		SELECT a.id::text AS id, a.title, a.type, a.source, a.source_ref, a.severity, a.tlp, a.pap, a.status,
			a.read, a.follow, a.flag, a.external_link, a.organisation_id, a.case_template,
			c.number AS case_number,
			COUNT(DISTINCT o.id)::int AS observable_count,
			a.tags, a.last_sync_date, a.created_at
		FROM alerts a
		LEFT JOIN cases c ON c.id = a.case_id
		LEFT JOIN observables o ON o.case_id = c.id
		`+where+`
		GROUP BY a.id, c.number
		ORDER BY `+orderBy+`
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)), args...)
	if err != nil {
		return nil, 0, err
	}
	total, err := r.count(ctx, "alerts a", where, args[:len(args)-2])
	return rows, total, err
}

func (r *PostgresReader) listObservables(ctx context.Context, query ListQuery) ([]ObservableSummary, int, error) {
	if r.db == nil {
		return nil, 0, fmt.Errorf("postgres source unavailable")
	}
	where, args := buildObservableWhere(query.Filters)
	where, args = mergeDSLWhere(where, args, query.DSL, observableDSLFields())
	orderBy := safeOrderBy(query.Sort, map[string]string{
		"data_type":  "o.data_type",
		"dataType":   "o.data_type",
		"data":       "o.data",
		"tlp":        "o.tlp",
		"created_by": "o.created_by",
		"created_at": "o.created_at",
	}, "o.created_at")
	rows := []ObservableSummary{}
	args = append(args, query.Limit, query.Offset)
	err := r.db.SelectContext(ctx, &rows, `
		SELECT o.id::text AS id, o.data_type, o.data, o.message, o.tlp, o.ioc, o.sighted,
			o.ignore_similarity, COALESCE(o.attachment_id::text, '') AS attachment_id, o.tags,
			COALESCE(o.case_id::text, '') AS case_id,
			COALESCE(c.number, 0) AS case_number,
			COALESCE(c.title, '') AS case_title,
			o.created_by, o.created_at
		FROM observables o
		LEFT JOIN cases c ON c.id = o.case_id
		`+where+`
		ORDER BY `+orderBy+`
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)), args...)

	if err != nil {
		return nil, 0, err
	}
	total, err := r.count(ctx, "observables o", where, args[:len(args)-2])
	return rows, total, err
}

func mergeDSLWhere(where string, args []any, rawDSL string, fields fieldMap) (string, []any) {
	expr, err := ParseTheHiveDSL(rawDSL, fields)
	if err != nil || expr.SQL == "" {
		return where, args
	}
	shifted := shiftPlaceholders(expr.SQL, len(args))
	if strings.TrimSpace(where) == "" {
		where = "WHERE " + shifted
	} else {
		where += " AND (" + shifted + ")"
	}
	args = append(args, expr.Args...)
	return where, args
}

func caseDSLFields() fieldMap {
	return fieldMap{
		"title": "c.title", "status": "c.status", "severity": "c.severity", "tlp": "c.tlp", "pap": "c.pap",
		"owner": "c.owner", "assignee": "c.assignee", "number": "c.number",
		"flag": "c.flag", "summary": "c.summary",
		"impactStatus": "c.impact_status", "resolutionStatus": "c.resolution_status",
		"caseTemplate": "c.case_template", "owningOrganisation": "c.owning_organisation",
		"createdAt": "c.created_at", "updatedAt": "c.updated_at",
		"startDate": "c.start_date", "endDate": "c.end_date",
	}
}

func alertDSLFields() fieldMap {
	return fieldMap{
		"title": "a.title", "status": "a.status", "severity": "a.severity", "tlp": "a.tlp", "pap": "a.pap",
		"source": "a.source", "type": "a.type", "sourceRef": "a.source_ref",
		"read": "a.read", "follow": "a.follow", "flag": "a.flag",
		"organisationId": "a.organisation_id", "caseTemplate": "a.case_template",
		"externalLink": "a.external_link", "lastSyncDate": "a.last_sync_date",
		"createdAt": "a.created_at", "updatedAt": "a.updated_at",
	}
}

func observableDSLFields() fieldMap {
	return fieldMap{
		"data": "o.data", "dataType": "o.data_type", "tlp": "o.tlp",
		"ioc": "o.ioc", "sighted": "o.sighted", "ignoreSimilarity": "o.ignore_similarity",
		"createdBy": "o.created_by", "createdAt": "o.created_at", "updatedAt": "o.updated_at",
	}
}

func (r *PostgresReader) count(ctx context.Context, from, where string, args []any) (int, error) {
	var total int
	err := r.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM "+from+" "+where, args...)
	return total, err
}

func buildCaseWhere(filters map[string]string) (string, []any) {
	parts := []string{}
	args := []any{}
	addUUIDFilter(&parts, &args, "c.id", filters["id"])
	addStringFilter(&parts, &args, "c.status", filters["status"])
	addIntFilter(&parts, &args, "c.severity", filters["severity"])
	addIntFilter(&parts, &args, "c.tlp", filters["tlp"])
	addIntFilter(&parts, &args, "c.pap", filters["pap"])
	addStringFilter(&parts, &args, "c.assignee", filters["assignee"])
	addStringFilter(&parts, &args, "c.owner", filters["owner"])
	addBoolFilter(&parts, &args, "c.flag", filters["flag"])
	addStringFilter(&parts, &args, "c.impact_status", firstNonEmpty(filters["impactStatus"], filters["impact_status"]))
	addStringFilter(&parts, &args, "c.resolution_status", firstNonEmpty(filters["resolutionStatus"], filters["resolution_status"]))
	addStringFilter(&parts, &args, "c.case_template", firstNonEmpty(filters["caseTemplate"], filters["case_template"]))
	addStringFilter(&parts, &args, "c.owning_organisation", firstNonEmpty(filters["owningOrganisation"], filters["owning_organisation"]))
	addTagsFilter(&parts, &args, "c.tags", filters["tags"])
	addTagsFilter(&parts, &args, "c.organisation_ids", firstNonEmpty(filters["organisationIds"], filters["organisation_ids"]))
	addDateRangeFilter(&parts, &args, "c.created_at", filters["createdFrom"], filters["createdTo"])
	addDateRangeFilter(&parts, &args, "c.updated_at", filters["updatedFrom"], filters["updatedTo"])
	addDateRangeFilter(&parts, &args, "c.start_date", filters["startFrom"], filters["startTo"])
	addDateRangeFilter(&parts, &args, "c.end_date", filters["endFrom"], filters["endTo"])

	if orgName, ok := filters["user_organisation_name"]; ok && orgName != "" {
		args = append(args, orgName)
		parts = append(parts, fmt.Sprintf("$%d::text = ANY(c.organisation_ids)", len(args)))
	}

	return joinWhere(parts), args
}

func buildAlertWhere(filters map[string]string) (string, []any) {
	parts := []string{}
	args := []any{}
	addUUIDFilter(&parts, &args, "a.id", filters["id"])
	addStringFilter(&parts, &args, "a.status", filters["status"])
	addIntFilter(&parts, &args, "a.severity", filters["severity"])
	addIntFilter(&parts, &args, "a.tlp", filters["tlp"])
	addIntFilter(&parts, &args, "a.pap", filters["pap"])
	addStringFilter(&parts, &args, "a.source", filters["source"])
	addStringFilter(&parts, &args, "a.type", filters["type"])
	addBoolFilter(&parts, &args, "a.read", filters["read"])
	addBoolFilter(&parts, &args, "a.follow", filters["follow"])
	addBoolFilter(&parts, &args, "a.flag", filters["flag"])
	addStringFilter(&parts, &args, "a.organisation_id", firstNonEmpty(filters["organisationId"], filters["organisation_id"]))
	addStringFilter(&parts, &args, "a.case_template", firstNonEmpty(filters["caseTemplate"], filters["case_template"]))
	addTagsFilter(&parts, &args, "a.tags", filters["tags"])
	addDateRangeFilter(&parts, &args, "a.created_at", filters["createdFrom"], filters["createdTo"])
	addDateRangeFilter(&parts, &args, "a.updated_at", filters["updatedFrom"], filters["updatedTo"])
	addDateRangeFilter(&parts, &args, "a.last_sync_date", filters["lastSyncFrom"], filters["lastSyncTo"])

	if orgName, ok := filters["user_organisation_name"]; ok && orgName != "" {
		args = append(args, orgName)
		parts = append(parts, fmt.Sprintf("a.organisation_id = $%d::text", len(args)))
	}

	return joinWhere(parts), args
}

func buildObservableWhere(filters map[string]string) (string, []any) {
	parts := []string{}
	args := []any{}
	addUUIDFilter(&parts, &args, "o.id", filters["id"])
	addIntFilter(&parts, &args, "o.tlp", filters["tlp"])
	addBoolFilter(&parts, &args, "o.ioc", filters["ioc"])
	addBoolFilter(&parts, &args, "o.sighted", filters["sighted"])
	addBoolFilter(&parts, &args, "o.ignore_similarity", firstNonEmpty(filters["ignoreSimilarity"], filters["ignore_similarity"]))
	addStringFilter(&parts, &args, "o.created_by", firstNonEmpty(filters["createdBy"], filters["created_by"]))
	addStringFilter(&parts, &args, "o.data_type", firstNonEmpty(filters["dataType"], filters["data_type"]))
	addTagsFilter(&parts, &args, "o.tags", filters["tags"])
	addDateRangeFilter(&parts, &args, "o.created_at", filters["createdFrom"], filters["createdTo"])
	addDateRangeFilter(&parts, &args, "o.updated_at", filters["updatedFrom"], filters["updatedTo"])

	if orgName, ok := filters["user_organisation_name"]; ok && orgName != "" {
		args = append(args, orgName)
		parts = append(parts, fmt.Sprintf("$%d::text = ANY(o.organisation_ids)", len(args)))
	}

	return joinWhere(parts), args
}

func addUUIDFilter(parts *[]string, args *[]any, column, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		return
	}
	*args = append(*args, value)
	*parts = append(*parts, fmt.Sprintf("%s = $%d::uuid", column, len(*args)))
}

func addStringFilter(parts *[]string, args *[]any, column, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		return
	}
	*args = append(*args, value)
	*parts = append(*parts, fmt.Sprintf("%s ILIKE '%%' || $%d || '%%'", column, len(*args)))
}

func addIntFilter(parts *[]string, args *[]any, column, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		return
	}
	*args = append(*args, value)
	*parts = append(*parts, fmt.Sprintf("%s = $%d::int", column, len(*args)))
}

func addBoolFilter(parts *[]string, args *[]any, column, value string) {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" || value == "any" {
		return
	}
	var parsed bool
	switch value {
	case "true", "1", "yes", "y":
		parsed = true
	case "false", "0", "no", "n":
		parsed = false
	default:
		return
	}
	*args = append(*args, parsed)
	*parts = append(*parts, fmt.Sprintf("%s = $%d::boolean", column, len(*args)))
}

func addDateRangeFilter(parts *[]string, args *[]any, column, from, to string) {
	from = strings.TrimSpace(from)
	to = strings.TrimSpace(to)
	if from != "" {
		*args = append(*args, from)
		*parts = append(*parts, fmt.Sprintf("%s >= $%d::timestamptz", column, len(*args)))
	}
	if to != "" {
		*args = append(*args, to)
		*parts = append(*parts, fmt.Sprintf("%s <= $%d::timestamptz", column, len(*args)))
	}
}

func addTagsFilter(parts *[]string, args *[]any, column, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		return
	}
	items := []string{}
	for _, item := range strings.Split(value, ",") {
		if tag := strings.TrimSpace(item); tag != "" {
			items = append(items, tag)
		}
	}
	if len(items) == 0 {
		return
	}
	*args = append(*args, items)
	*parts = append(*parts, fmt.Sprintf("%s @> $%d::text[]", column, len(*args)))
}

func joinWhere(parts []string) string {
	if len(parts) == 0 {
		return ""
	}
	return "WHERE " + strings.Join(parts, " AND ")
}

func safeOrderBy(sort SortSpec, allowed map[string]string, fallback string) string {
	column, ok := allowed[sort.Field]
	if !ok {
		column = fallback
	}
	order := "DESC"
	if sort.Order == "ASC" {
		order = "ASC"
	}
	return column + " " + order
}
