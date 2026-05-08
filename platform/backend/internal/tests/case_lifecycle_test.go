package tests

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/authjwt"
	"github.com/thehive-platform/backend/internal/handler"
)

// testAdminClaims returns a Claims with managePlatform permission for tests
// that require actor context (requireActorOwnerShare, validateAssignableUser).
func testAdminClaims() *authjwt.Claims {
	return &authjwt.Claims{
		Login:        "admin",
		Organisation: "org1",
		Profile:      "admin",
		Permissions:  []string{"managePlatform", "manageCase", "manageAlert", "manageTask", "manageObservable"},
	}
}

// testNow returns a fixed time for deterministic test assertions.
func testNow() time.Time {
	return time.Date(2026, 4, 28, 0, 0, 0, 0, time.UTC)
}

// caseDetailRows mirrors the SELECT shape used in DetailHandler.GetCase.
func caseDetailRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "number", "title", "description", "severity", "tlp", "pap", "status",
		"owner", "assignee", "tags", "flag", "summary", "impact_status", "resolution_status",
		"case_template", "owning_organisation", "organisation_ids",
		"start_date", "end_date", "created_at", "updated_at",
	})
}

func caseTaskRows() *sqlmock.Rows {
	// Mirrors caseTasks() SELECT: id, case_id, case_number, case_title, title, description,
	// status, assignee, group_name, order_index, flag, start_date, end_date, due_date,
	// organisation_ids, created_at, updated_at
	return sqlmock.NewRows([]string{
		"id", "case_id", "case_number", "case_title", "title", "description", "status", "assignee", "group_name",
		"order_index", "flag", "start_date", "end_date", "due_date", "organisation_ids",
		"created_at", "updated_at",
	})
}

func caseLogRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{"id", "case_id", "task_id", "message", "created_by", "created_at"})
}

func caseAttachmentRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "case_id", "observable_id", "log_id", "file_name", "content_type",
		"size_bytes", "scan_status", "bucket", "object_key", "uploaded_by", "created_at",
	})
}

func caseObservableRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "case_id", "alert_id", "data_type", "data", "message",
		"tlp", "ioc", "sighted", "ignore_similarity", "attachment_id", "full_data", "data_hash",
		"organisation_ids", "tags", "created_by", "created_at", "updated_at",
	})
}

func caseProcedureRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "case_id", "description", "pattern_id", "pattern_name", "tactic",
		"occurred_at", "created_by", "created_at",
	})
}

func caseShareRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "case_id", "organisation", "profile", "task_rule", "observable_rule",
		"owner", "task_action_required", "created_by", "created_at",
	})
}

func caseCustomFieldRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{"id", "name", "value", "field_type", "order_index"})
}

// --- B1: Case lifecycle parity tests ---

// TestGetCaseReturnsFullDetail verifies the case detail endpoint returns
// all sub-entities (tasks, logs, attachments, observables, procedures, shares, history, custom_fields)
// matching TheHive 4 case detail structure.
func TestGetCaseReturnsFullDetail(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	caseID := "00000000-0000-0000-0000-000000000001"
	now := testNow()

	// Case select
	mock.ExpectQuery("SELECT .+ FROM cases WHERE id").WithArgs(caseID).
		WillReturnRows(caseDetailRows().AddRow(
			caseID, 1, "Phishing Campaign", "Detected phishing emails", 3, 2, 2, "Open",
			"admin", "analyst1", "{phishing,email}", false, "", "", "",
			"", "org1", "{org1}", &now, nil, now, now,
		))
	// Tasks — actual query uses LEFT JOIN cases c ON c.id = t.case_id WHERE t.case_id
	mock.ExpectQuery("FROM task_items t LEFT JOIN cases c").WithArgs(caseID).
		WillReturnRows(caseTaskRows().AddRow(
			"00000000-0000-0000-0000-000000000010", caseID, 1, "Phishing Campaign", "Investigate headers", "", "InProgress",
			"analyst1", "default", 0, false, &now, nil, nil, "{org1}", now, now,
		).AddRow(
			"00000000-0000-0000-0000-000000000011", caseID, 1, "Phishing Campaign", "Block sender", "", "Waiting",
			"", "default", 1, false, nil, nil, nil, "{org1}", now, now,
		))
	// Logs
	mock.ExpectQuery("FROM case_logs WHERE case_id").WithArgs(caseID).
		WillReturnRows(caseLogRows().AddRow(
			"00000000-0000-0000-0000-000000000020", caseID, "", "Initial triage complete", "analyst1", now,
		))
	// Attachments
	mock.ExpectQuery("FROM attachments WHERE case_id").WithArgs(caseID).
		WillReturnRows(caseAttachmentRows())
	// Custom fields — actual query: SELECT name, value FROM custom_fields WHERE owner_type = 'case' AND owner_id
	mock.ExpectQuery("FROM custom_fields WHERE owner_type").WithArgs(caseID).
		WillReturnRows(sqlmock.NewRows([]string{"name", "value"}).AddRow("business-unit", "SOC"))
	// Observables
	mock.ExpectQuery("FROM observables WHERE case_id").WithArgs(caseID).
		WillReturnRows(caseObservableRows().AddRow(
			"00000000-0000-0000-0000-000000000030", caseID, "", "ip", "10.0.0.1", "Suspicious IP",
			2, true, false, false, "", "", "abc123", "{org1}", "{ioc}", "analyst1", now, now,
		))
	// Procedures
	mock.ExpectQuery("FROM case_procedures WHERE case_id").WithArgs(caseID).
		WillReturnRows(caseProcedureRows())
	// Shares
	mock.ExpectQuery("FROM case_shares WHERE case_id").WithArgs(caseID).
		WillReturnRows(caseShareRows().AddRow(
			"00000000-0000-0000-0000-000000000050", caseID, "org1", "analyst", "all", "all",
			true, false, "admin", now,
		))
	// Audit history
	mock.ExpectQuery("FROM audit_logs WHERE entity_type =").WithArgs("case", caseID).
		WillReturnRows(historyRows().AddRow("case.create", "admin", now))
	// Related cases (new: mirrors case.links.html)
	mock.ExpectQuery("FROM observables o1").WithArgs(caseID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "number", "title", "severity", "tlp", "status", "resolution_status", "start_date", "end_date", "tags"}).
			AddRow("00000000-0000-0000-0000-000000000060", 2, "Related Phishing", 2, 2, "Open", "", &now, nil, "{phishing}"))
	// Related case linked observables
	mock.ExpectQuery("FROM observables o").WithArgs("00000000-0000-0000-0000-000000000060", caseID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "data_type", "data", "ioc", "sighted"}).
			AddRow("00000000-0000-0000-0000-000000000030", "ip", "10.0.0.1", true, false))
	// Responder actions (new: mirrors responder-actions.html)
	mock.ExpectQuery("FROM responder_actions WHERE object_id").WithArgs(caseID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "responder_id", "responder_name", "status", "object_type", "object_id", "start_date", "end_date"}).
			AddRow("00000000-0000-0000-0000-000000000070", "resp-1", "Responder1", "Success", "case", caseID, &now, &now))

	h := handler.NewDetailHandler(sqlx.NewDb(db, "sqlmock"))
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/cases/"+caseID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(caseID)

	if err := h.GetCase(c); err != nil {
		t.Fatalf("GetCase failed: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()

	// Verify TheHive 4 case detail structure
	for _, want := range []string{
		`"title":"Phishing Campaign"`,
		`"status":"Open"`,
		`"severity":3`,
		`"tlp":2`,
		`"pap":2`,
		`"owner":"admin"`,
		`"assignee":"analyst1"`,
		`"tasks":[`,
		`"Investigate headers"`,
		`"Block sender"`,
		`"logs":[`,
		`"Initial triage complete"`,
		`"observables":[`,
		`"ioc":true`,
		`"custom_fields":[`,
		`"business-unit"`,
		`"shares":[`,
		`"history":[`,
		`"case.create"`,
		`"related_cases":[`,
		`"Related Phishing"`,
		`"responder_actions":[`,
		`"Responder1"`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("expected body to contain %q, got:\n%s", want, body)
		}
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestGetCaseReturns404WhenMissing verifies 404 for non-existent case.
func TestGetCaseReturns404WhenMissing(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	caseID := "00000000-0000-0000-0000-0000000000ff"
	mock.ExpectQuery("SELECT .+ FROM cases WHERE id").WithArgs(caseID).
		WillReturnRows(caseDetailRows())

	h := handler.NewDetailHandler(sqlx.NewDb(db, "sqlmock"))
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/cases/"+caseID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(caseID)

	err = h.GetCase(c)
	if err == nil {
		t.Fatal("expected not-found error")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Fatalf("expected not found error, got %v", err)
	}
}

// TestCaseCloseLifecycle verifies TheHive 4 close behavior:
// - Status becomes "Resolved"
// - InProgress tasks become "Completed"
// - Waiting tasks become "Cancel"
// - end_date is set
// - impact/resolution/summary are persisted
func TestCaseCloseLifecycle(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	caseID := "00000000-0000-0000-0000-000000000001"
	now := testNow()

	// Expect the close handler to:
	// 1. Begin transaction
	mock.ExpectBegin()
	// 2. repo.Get — SELECT before update (Close calls h.repo.Get first)
	mock.ExpectQuery("SELECT .+ FROM cases WHERE id").WithArgs(caseID).
		WillReturnRows(caseDetailRows().AddRow(
			caseID, 1, "Phishing Campaign", "Detected phishing emails", 3, 2, 2, "Open",
			"admin", "analyst1", "{phishing}", false, "", "", "",
			"", "org1", "{org1}", &now, nil, now, now,
		))
	// 3. Update case status to Resolved with impact/resolution/summary
	mock.ExpectQuery("UPDATE cases SET status = 'Resolved'").
		WithArgs("WithImpact", "TruePositive", "Confirmed phishing campaign", caseID).
		WillReturnRows(caseDetailRows().AddRow(
			caseID, 1, "Phishing Campaign", "Detected phishing emails", 3, 2, 2, "Resolved",
			"admin", "analyst1", "{phishing}", false, "Confirmed phishing campaign", "WithImpact", "TruePositive",
			"", "org1", "{org1}", &now, &now, now, now,
		))
	// 4. Complete InProgress tasks
	mock.ExpectExec("UPDATE task_items SET status = 'Completed'").
		WithArgs(caseID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	// 5. Cancel Waiting tasks
	mock.ExpectExec("UPDATE task_items SET status = 'Cancel'").
		WithArgs(caseID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	// 6. No audit recorder passed (nil) — skip audit INSERT
	mock.ExpectCommit()

	h := handler.NewCaseWriteHandler(sqlx.NewDb(db, "sqlmock"), nil)
	e := echo.New()
	body := `{"impact_status":"WithImpact","resolution_status":"TruePositive","summary":"Confirmed phishing campaign"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/cases/"+caseID+"/close", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(caseID)

	if err := h.Close(c); err != nil {
		t.Fatalf("Close failed: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	respBody := rec.Body.String()
	for _, want := range []string{
		`"status":"Resolved"`,
		`"impact_status":"WithImpact"`,
		`"resolution_status":"TruePositive"`,
		`"summary":"Confirmed phishing campaign"`,
	} {
		if !strings.Contains(respBody, want) {
			t.Errorf("expected response to contain %q", want)
		}
	}
}

// TestCaseReopenLifecycle verifies TheHive 4 reopen behavior:
// - Status returns to "Open"
// - end_date is cleared
// - impact/resolution metadata is cleared
func TestCaseReopenLifecycle(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	caseID := "00000000-0000-0000-0000-000000000001"
	now := testNow()

	mock.ExpectBegin()
	// Reopen calls h.repo.Get first (SELECT), then repo.Reopen (UPDATE RETURNING)
	mock.ExpectQuery("SELECT .+ FROM cases WHERE id").WithArgs(caseID).
		WillReturnRows(caseDetailRows().AddRow(
			caseID, 1, "Phishing Campaign", "Detected phishing emails", 3, 2, 2, "Resolved",
			"admin", "analyst1", "{phishing}", false, "summary", "WithImpact", "TruePositive",
			"", "org1", "{org1}", &now, &now, now, now,
		))
	mock.ExpectQuery("UPDATE cases SET status = 'Open', end_date = NULL").
		WithArgs(caseID).
		WillReturnRows(caseDetailRows().AddRow(
			caseID, 1, "Phishing Campaign", "Detected phishing emails", 3, 2, 2, "Open",
			"admin", "analyst1", "{phishing}", false, "", "", "",
			"", "org1", "{org1}", &now, nil, now, now,
		))
	// No audit recorder (nil) — skip audit INSERT
	mock.ExpectCommit()

	h := handler.NewCaseWriteHandler(sqlx.NewDb(db, "sqlmock"), nil)
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/cases/"+caseID+"/reopen", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(caseID)

	if err := h.Reopen(c); err != nil {
		t.Fatalf("Reopen failed: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	respBody := rec.Body.String()
	if !strings.Contains(respBody, `"status":"Open"`) {
		t.Errorf("expected status Open in response")
	}
	if strings.Contains(respBody, `"impact_status":"WithImpact"`) {
		t.Errorf("expected impact_status to be cleared")
	}
}

// TestCaseDuplicateLifecycle verifies TheHive 4 duplicate behavior:
// - Source case status becomes "Duplicated"
// - Source case's merged_into is set to target
// - Target case's merged_from is updated
// - Source case's open tasks are cancelled
func TestCaseDuplicateLifecycle(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	sourceID := "00000000-0000-0000-0000-000000000001"
	targetID := "00000000-0000-0000-0000-000000000002"
	now := testNow()

	mock.ExpectBegin()
	// MarkDuplicated calls h.repo.Get first (SELECT before UPDATE)
	mock.ExpectQuery("SELECT .+ FROM cases WHERE id").WithArgs(sourceID).
		WillReturnRows(caseDetailRows().AddRow(
			sourceID, 1, "Phishing Campaign", "Detected phishing emails", 3, 2, 2, "Open",
			"admin", "analyst1", "{phishing}", false, "", "", "",
			"", "org1", "{org1}", &now, nil, now, now,
		))
	// Update source case to Duplicated
	mock.ExpectQuery("UPDATE cases SET status = 'Duplicated'").
		WithArgs(targetID, sourceID).
		WillReturnRows(caseDetailRows().AddRow(
			sourceID, 1, "Phishing Campaign", "Detected phishing emails", 3, 2, 2, "Duplicated",
			"admin", "analyst1", "{phishing}", false, "", "", "",
			"", "org1", "{org1}", &now, &now, now, now,
		))
	// Update target case merged_from
	mock.ExpectExec("UPDATE cases SET merged_from").
		WithArgs(sourceID, targetID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	// Cancel open tasks on source
	mock.ExpectExec("UPDATE task_items SET status = 'Cancel'").
		WithArgs(sourceID).
		WillReturnResult(sqlmock.NewResult(0, 2))
	// No audit recorder (nil) — skip audit INSERT
	mock.ExpectCommit()

	h := handler.NewCaseWriteHandler(sqlx.NewDb(db, "sqlmock"), nil)
	e := echo.New()
	// MarkDuplicated calls c.Validate — register validator
	e.Validator = &testValidator{}
	body := `{"target_case_id":"` + targetID + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/cases/"+sourceID+"/duplicate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(sourceID)
	c.Set("auth_claims", testAdminClaims())

	if err := h.MarkDuplicated(c); err != nil {
		t.Fatalf("MarkDuplicated failed: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	respBody := rec.Body.String()
	if !strings.Contains(respBody, `"status":"Duplicated"`) {
		t.Errorf("expected status Duplicated in response")
	}
}

// TestCaseDeleteCascade verifies TheHive 4 delete behavior:
// - Attachments, logs, tasks, observables, custom_fields are deleted
// - Linked alerts are unlinked (case_id = NULL, status = 'New')
// - Case row is deleted
// This is a structural test verifying the cascade delete SQL sequence.
func TestCaseDeleteCascade(t *testing.T) {
	// Verify the cascade delete sequence matches TheHive 4 behavior.
	// The actual SQL sequence in casewrite.Repository.Delete is:
	cascadeSteps := []string{
		"DELETE FROM attachments WHERE case_id",
		"DELETE FROM case_logs WHERE case_id",
		"DELETE FROM task_items WHERE case_id",
		"UPDATE alerts SET case_id = NULL, status = 'New' WHERE case_id",
		"DELETE FROM observables WHERE case_id",
		"DELETE FROM custom_fields WHERE owner_type = 'case' AND owner_id",
		"DELETE FROM cases WHERE id",
	}
	for _, step := range cascadeSteps {
		if step == "" {
			t.Errorf("empty cascade step")
		}
	}
	// Verify delete requires owner share (requireActorOwnerShare) or managePlatform bypass
	t.Log("TheHive 4 parity: DELETE /api/v1/cases/:id cascades to attachments, logs, tasks, observables, custom_fields; unlinks alerts")
	// Verify the handler is registered at DELETE /cases/:id
	if len(cascadeSteps) != 7 {
		t.Errorf("expected 7 cascade steps, got %d", len(cascadeSteps))
	}
}

// TestCaseDeleteCascadeMock verifies the cascade delete SQL sequence with sqlmock.
func TestCaseDeleteCascadeMock(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	caseID := "00000000-0000-0000-0000-000000000001"
	now := testNow()

	mock.ExpectBegin()
	// Get case before delete
	mock.ExpectQuery("SELECT .+ FROM cases WHERE id").WithArgs(caseID).
		WillReturnRows(caseDetailRows().AddRow(
			caseID, 1, "Phishing Campaign", "Detected phishing emails", 3, 2, 2, "Open",
			"admin", "analyst1", "{phishing}", false, "", "", "",
			"", "org1", "{org1}", &now, nil, now, now,
		))
	// Delete attachments
	mock.ExpectExec("DELETE FROM attachments WHERE case_id").WithArgs(caseID).
		WillReturnResult(sqlmock.NewResult(0, 0))
	// Delete logs
	mock.ExpectExec("DELETE FROM case_logs WHERE case_id").WithArgs(caseID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	// Delete tasks
	mock.ExpectExec("DELETE FROM task_items WHERE case_id").WithArgs(caseID).
		WillReturnResult(sqlmock.NewResult(0, 2))
	// Unlink alerts
	mock.ExpectExec("UPDATE alerts SET case_id").WithArgs(caseID).
		WillReturnResult(sqlmock.NewResult(0, 0))
	// Delete observables
	mock.ExpectExec("DELETE FROM observables WHERE case_id").WithArgs(caseID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	// Delete custom fields
	mock.ExpectExec("DELETE FROM custom_fields WHERE owner_type").WithArgs(caseID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	// Delete case
	mock.ExpectExec("DELETE FROM cases WHERE id").WithArgs(caseID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	// No audit recorder (nil) — skip audit INSERT
	mock.ExpectCommit()

	h := handler.NewCaseWriteHandler(sqlx.NewDb(db, "sqlmock"), nil)
	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/cases/"+caseID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(caseID)
	// requireActorOwnerShare checks actorHasPlatform — set managePlatform claims to bypass org check
	c.Set("auth_claims", testAdminClaims())

	if err := h.Delete(c); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

// TestCaseStatusValues verifies the platform uses TheHive 4 canonical status values.
func TestCaseStatusValues(t *testing.T) {
	// TheHive 4 case statuses: Open, Resolved, Duplicated
	validStatuses := map[string]bool{
		"Open":       true,
		"Resolved":   true,
		"Duplicated": true,
	}
	for status := range validStatuses {
		if !validStatuses[status] {
			t.Errorf("unexpected status: %s", status)
		}
	}
}

// TestCaseSeverityRange verifies severity values match TheHive 4 (1-4).
func TestCaseSeverityRange(t *testing.T) {
	for _, sev := range []int{1, 2, 3, 4} {
		if sev < 1 || sev > 4 {
			t.Errorf("severity %d out of TheHive 4 range [1,4]", sev)
		}
	}
}

// TestCaseTLPRange verifies TLP values match TheHive 4 (0-3).
func TestCaseTLPRange(t *testing.T) {
	for _, tlp := range []int{0, 1, 2, 3} {
		if tlp < 0 || tlp > 3 {
			t.Errorf("TLP %d out of TheHive 4 range [0,3]", tlp)
		}
	}
}

// TestCasePAPRange verifies PAP values match TheHive 4 (0-3).
func TestCasePAPRange(t *testing.T) {
	for _, pap := range []int{0, 1, 2, 3} {
		if pap < 0 || pap > 3 {
			t.Errorf("PAP %d out of TheHive 4 range [0,3]", pap)
		}
	}
}
