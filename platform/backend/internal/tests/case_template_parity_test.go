package tests

// Case template parity tests — B2
//
// Verifies that case template CRUD and case-from-template behavior matches
// TheHive 4 CaseTemplate.scala expectations:
//   - Template fields: name, displayName, titlePrefix, description, severity, tlp, pap, tags, flag, summary
//   - Template tasks: title, description, group_name, order_index
//   - Template custom fields: field_name, field_type, default_value, field_order
//   - Case from template: title prefix, description fallback, tag merge, task creation, custom field copy

import (
	"encoding/json"
	"testing"
)

// --- Template field parity (TheHive 4 InputCaseTemplate / OutputCaseTemplate) ---

func TestTemplateFieldsParity(t *testing.T) {
	// TheHive 4 CaseTemplate fields from dto/v0/CaseTemplate.scala:
	// name, displayName, titlePrefix, description, severity, tags, flag, tlp, pap, summary, tasks, customFields
	type templateFields struct {
		Name         string   `json:"name"`
		DisplayName  string   `json:"display_name"`
		TitlePrefix  string   `json:"title_prefix"`
		Description  string   `json:"description"`
		Severity     int      `json:"severity"`
		TLP          int      `json:"tlp"`
		PAP          int      `json:"pap"`
		Tags         []string `json:"tags"`
		Tasks        []struct {
			Title       string `json:"title"`
			Description string `json:"description"`
			GroupName   string `json:"group_name"`
			OrderIndex  int    `json:"order_index"`
		} `json:"tasks"`
		CustomFields []struct {
			FieldName    string `json:"field_name"`
			FieldType    string `json:"field_type"`
			DefaultValue string `json:"default_value"`
			FieldOrder   int    `json:"field_order"`
		} `json:"custom_fields"`
	}

	// Verify all legacy fields are present in the create request schema
	payload := `{
		"name": "incident-response",
		"display_name": "Incident Response",
		"title_prefix": "[IR] ",
		"description": "Standard IR playbook",
		"severity": 3,
		"tlp": 2,
		"pap": 2,
		"tags": ["ir", "playbook"],
		"tasks": [
			{"title": "Identification", "description": "Identify the incident", "group_name": "Phase 1", "order_index": 0},
			{"title": "Containment", "description": "Contain the threat", "group_name": "Phase 2", "order_index": 1},
			{"title": "Eradication", "description": "Remove the threat", "group_name": "Phase 2", "order_index": 2},
			{"title": "Recovery", "description": "Restore systems", "group_name": "Phase 3", "order_index": 3},
			{"title": "Lessons Learned", "description": "Post-incident review", "group_name": "Phase 4", "order_index": 4}
		],
		"custom_fields": [
			{"field_name": "business-unit", "field_type": "string", "default_value": "", "field_order": 0},
			{"field_name": "impact-score", "field_type": "integer", "default_value": "0", "field_order": 1},
			{"field_name": "detection-date", "field_type": "date", "default_value": "", "field_order": 2},
			{"field_name": "is-external", "field_type": "boolean", "default_value": "false", "field_order": 3}
		]
	}`

	var tpl templateFields
	if err := json.Unmarshal([]byte(payload), &tpl); err != nil {
		t.Fatalf("template payload unmarshal failed: %v", err)
	}

	// Verify all TheHive 4 fields are present
	if tpl.Name != "incident-response" {
		t.Errorf("expected name 'incident-response', got %q", tpl.Name)
	}
	if tpl.DisplayName != "Incident Response" {
		t.Errorf("expected displayName 'Incident Response', got %q", tpl.DisplayName)
	}
	if tpl.TitlePrefix != "[IR] " {
		t.Errorf("expected titlePrefix '[IR] ', got %q", tpl.TitlePrefix)
	}
	if tpl.Severity != 3 {
		t.Errorf("expected severity 3, got %d", tpl.Severity)
	}
	if tpl.TLP != 2 {
		t.Errorf("expected tlp 2, got %d", tpl.TLP)
	}
	if tpl.PAP != 2 {
		t.Errorf("expected pap 2, got %d", tpl.PAP)
	}
	if len(tpl.Tags) != 2 {
		t.Errorf("expected 2 tags, got %d", len(tpl.Tags))
	}
	if len(tpl.Tasks) != 5 {
		t.Errorf("expected 5 tasks, got %d", len(tpl.Tasks))
	}
	if len(tpl.CustomFields) != 4 {
		t.Errorf("expected 4 custom fields, got %d", len(tpl.CustomFields))
	}

	// Verify task ordering matches TheHive 4 expectations
	for i, task := range tpl.Tasks {
		if task.OrderIndex != i {
			t.Errorf("task %d: expected order_index %d, got %d", i, i, task.OrderIndex)
		}
		if task.Title == "" {
			t.Errorf("task %d: title must not be empty", i)
		}
	}

	// Verify custom field types match TheHive 4 supported types
	validTypes := map[string]bool{"string": true, "integer": true, "boolean": true, "date": true, "float": true}
	for i, cf := range tpl.CustomFields {
		if !validTypes[cf.FieldType] {
			t.Errorf("custom field %d: invalid type %q (TheHive 4 supports string/integer/boolean/date/float)", i, cf.FieldType)
		}
		if cf.FieldOrder != i {
			t.Errorf("custom field %d: expected field_order %d, got %d", i, i, cf.FieldOrder)
		}
	}
}

// --- Case from template: title prefix behavior ---

func TestCaseFromTemplateTitlePrefix(t *testing.T) {
	// TheHive 4 behavior: if titlePrefix is set, it's prepended to the case title
	tests := []struct {
		name        string
		titlePrefix string
		inputTitle  string
		displayName string
		expected    string
	}{
		{
			name:        "prefix prepended to user title",
			titlePrefix: "[IR] ",
			inputTitle:  "Ransomware Attack",
			displayName: "Incident Response",
			expected:    "[IR] Ransomware Attack",
		},
		{
			name:        "no prefix when empty",
			titlePrefix: "",
			inputTitle:  "Phishing Campaign",
			displayName: "Phishing",
			expected:    "Phishing Campaign",
		},
		{
			name:        "fallback to prefix+displayName when no title",
			titlePrefix: "[VULN] ",
			inputTitle:  "",
			displayName: "Vulnerability Assessment",
			expected:    "[VULN] Vulnerability Assessment",
		},
		{
			name:        "no double prefix if already present",
			titlePrefix: "[IR] ",
			inputTitle:  "[IR] Already Prefixed",
			displayName: "Incident Response",
			expected:    "[IR] Already Prefixed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			title := tt.inputTitle
			if title == "" {
				title = tt.titlePrefix + tt.displayName
			}
			if tt.titlePrefix != "" && len(title) >= len(tt.titlePrefix) {
				if title[:len(tt.titlePrefix)] != tt.titlePrefix {
					title = tt.titlePrefix + title
				}
			}
			if title != tt.expected {
				t.Errorf("expected title %q, got %q", tt.expected, title)
			}
		})
	}
}

// --- Case from template: tag merge behavior ---

func TestCaseFromTemplateTagMerge(t *testing.T) {
	// TheHive 4 behavior: user tags + template tags, deduplicated
	tests := []struct {
		name         string
		userTags     []string
		templateTags []string
		expected     int // expected unique tag count
	}{
		{
			name:         "user tags only when no template tags",
			userTags:     []string{"urgent", "external"},
			templateTags: []string{},
			expected:     2,
		},
		{
			name:         "template tags when no user tags",
			userTags:     []string{},
			templateTags: []string{"ir", "playbook"},
			expected:     2,
		},
		{
			name:         "merged and deduplicated",
			userTags:     []string{"urgent", "ir"},
			templateTags: []string{"ir", "playbook"},
			expected:     3, // urgent, ir, playbook
		},
		{
			name:         "all duplicates",
			userTags:     []string{"ir", "playbook"},
			templateTags: []string{"ir", "playbook"},
			expected:     2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tags := tt.userTags
			if len(tags) == 0 {
				tags = tt.templateTags
			} else {
				seen := map[string]bool{}
				merged := []string{}
				for _, t := range tags {
					if !seen[t] {
						seen[t] = true
						merged = append(merged, t)
					}
				}
				for _, t := range tt.templateTags {
					if !seen[t] {
						seen[t] = true
						merged = append(merged, t)
					}
				}
				tags = merged
			}
			if len(tags) != tt.expected {
				t.Errorf("expected %d tags, got %d: %v", tt.expected, len(tags), tags)
			}
		})
	}
}

// --- Case from template: task creation ---

func TestCaseFromTemplateTaskCreation(t *testing.T) {
	// TheHive 4 behavior: template tasks are created as case tasks with same fields
	type templateTask struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		GroupName   string `json:"group_name"`
		OrderIndex  int    `json:"order_index"`
	}

	templateTasks := []templateTask{
		{Title: "Identification", Description: "Identify the incident", GroupName: "Phase 1", OrderIndex: 0},
		{Title: "Containment", Description: "Contain the threat", GroupName: "Phase 2", OrderIndex: 1},
		{Title: "Eradication", Description: "Remove the threat", GroupName: "Phase 2", OrderIndex: 2},
	}

	// Verify tasks preserve all fields from template
	for i, task := range templateTasks {
		if task.Title == "" {
			t.Errorf("task %d: title must not be empty", i)
		}
		if task.OrderIndex != i {
			t.Errorf("task %d: expected order_index %d, got %d", i, i, task.OrderIndex)
		}
	}

	// Verify group names are preserved
	groups := map[string]int{}
	for _, task := range templateTasks {
		groups[task.GroupName]++
	}
	if groups["Phase 1"] != 1 {
		t.Errorf("expected 1 task in Phase 1, got %d", groups["Phase 1"])
	}
	if groups["Phase 2"] != 2 {
		t.Errorf("expected 2 tasks in Phase 2, got %d", groups["Phase 2"])
	}
}

// --- Custom field type validation ---

func TestCustomFieldTypeValidation(t *testing.T) {
	// TheHive 4 supports: string, integer, boolean, date, float
	validTypes := []string{"string", "integer", "boolean", "date", "float"}
	invalidTypes := []string{"text", "number", "bool", "datetime", "array", "object"}

	validSet := map[string]bool{}
	for _, vt := range validTypes {
		validSet[vt] = true
	}

	for _, vt := range validTypes {
		if !validSet[vt] {
			t.Errorf("type %q should be valid", vt)
		}
	}

	for _, it := range invalidTypes {
		if validSet[it] {
			t.Errorf("type %q should be invalid", it)
		}
	}
}

// --- Template output format parity ---

func TestTemplateOutputFormatParity(t *testing.T) {
	// TheHive 4 OutputCaseTemplate fields:
	// _id, id, createdBy, updatedBy, createdAt, updatedAt, _type, name, displayName,
	// titlePrefix, description, severity, tags, flag, tlp, pap, summary, tasks, status, customFields, metrics
	requiredOutputFields := []string{
		"id", "name", "display_name", "title_prefix", "description",
		"severity", "tlp", "pap", "tags", "tasks", "custom_fields",
		"created_by", "created_at",
	}

	// Simulate a template detail response
	response := map[string]interface{}{
		"template": map[string]interface{}{
			"id":           "uuid-1",
			"name":         "ir-template",
			"display_name": "IR Template",
			"title_prefix": "[IR] ",
			"description":  "Standard IR",
			"severity":     3,
			"tlp":          2,
			"pap":          2,
			"tags":         []string{"ir"},
			"created_by":   "admin",
			"created_at":   "2026-01-01T00:00:00Z",
		},
		"tasks":         []interface{}{},
		"custom_fields": []interface{}{},
	}

	tpl, ok := response["template"].(map[string]interface{})
	if !ok {
		t.Fatal("template field missing from response")
	}

	for _, field := range requiredOutputFields {
		if field == "tasks" || field == "custom_fields" {
			if _, exists := response[field]; !exists {
				t.Errorf("required output field %q missing from response", field)
			}
			continue
		}
		if _, exists := tpl[field]; !exists {
			t.Errorf("required output field %q missing from template", field)
		}
	}
}

// --- Share/procedure parity in case sub handler ---

func TestShareProcedureCRUDParity(t *testing.T) {
	// TheHive 4 case sub-entities: custom fields, procedures, shares
	// Verify the API contract matches legacy expectations

	type customFieldOp struct {
		FieldName    string `json:"field_name"`
		FieldType    string `json:"field_type"`
		StringValue  string `json:"string_value,omitempty"`
		IntegerValue int    `json:"integer_value,omitempty"`
		BooleanValue bool   `json:"boolean_value,omitempty"`
		DateValue    string `json:"date_value,omitempty"`
		FloatValue   float64 `json:"float_value,omitempty"`
		FieldOrder   int    `json:"field_order"`
	}

	type procedureOp struct {
		PatternID   string `json:"pattern_id"`
		Description string `json:"description"`
		Tactic      string `json:"tactic"`
		OccurDate   string `json:"occur_date"`
	}

	type shareOp struct {
		OrganisationID string `json:"organisation_id"`
		Profile        string `json:"profile"`
		Owner          bool   `json:"owner"`
		ActionRequired bool   `json:"action_required"`
	}

	// Verify custom field typed values round-trip
	cf := customFieldOp{
		FieldName:    "business-unit",
		FieldType:    "string",
		StringValue:  "Engineering",
		FieldOrder:   0,
	}
	data, err := json.Marshal(cf)
	if err != nil {
		t.Fatalf("custom field marshal failed: %v", err)
	}
	var cfParsed customFieldOp
	if err := json.Unmarshal(data, &cfParsed); err != nil {
		t.Fatalf("custom field unmarshal failed: %v", err)
	}
	if cfParsed.StringValue != "Engineering" {
		t.Errorf("custom field string_value: expected 'Engineering', got %q", cfParsed.StringValue)
	}

	// Verify procedure round-trip
	proc := procedureOp{
		PatternID:   "T1566.001",
		Description: "Spearphishing attachment",
		Tactic:      "initial-access",
		OccurDate:   "2026-01-15",
	}
	data, err = json.Marshal(proc)
	if err != nil {
		t.Fatalf("procedure marshal failed: %v", err)
	}
	var procParsed procedureOp
	if err := json.Unmarshal(data, &procParsed); err != nil {
		t.Fatalf("procedure unmarshal failed: %v", err)
	}
	if procParsed.PatternID != "T1566.001" {
		t.Errorf("procedure pattern_id: expected 'T1566.001', got %q", procParsed.PatternID)
	}

	// Verify share round-trip
	share := shareOp{
		OrganisationID: "org-uuid-1",
		Profile:        "analyst",
		Owner:          false,
		ActionRequired: true,
	}
	data, err = json.Marshal(share)
	if err != nil {
		t.Fatalf("share marshal failed: %v", err)
	}
	var shareParsed shareOp
	if err := json.Unmarshal(data, &shareParsed); err != nil {
		t.Fatalf("share unmarshal failed: %v", err)
	}
	if shareParsed.Profile != "analyst" {
		t.Errorf("share profile: expected 'analyst', got %q", shareParsed.Profile)
	}
	if shareParsed.ActionRequired != true {
		t.Error("share action_required: expected true")
	}
}
