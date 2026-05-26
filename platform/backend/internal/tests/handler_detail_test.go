package tests

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/handler"
)

// alertDetailRows mirrors the SELECT shape used in DetailHandler.GetAlert.
func alertDetailRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "title", "description", "type", "source", "source_ref", "severity", "tlp", "pap", "status", "read", "follow", "flag",
		"external_link", "organisation_id", "case_template", "case_id", "case_number", "case_title", "tags", "occurred_at", "last_sync_date", "created_at", "updated_at",
	})
}

// alertObservableRows mirrors observableSelectSQL used in DetailHandler.alertObservables.
func alertObservableRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "case_id", "alert_id", "data_type", "data", "message",
		"tlp", "ioc", "sighted", "ignore_similarity", "attachment_id", "full_data", "data_hash", "organisation_ids", "tags", "created_by", "created_at", "updated_at",
	})
}

// taskDetailRows mirrors the SELECT shape used in DetailHandler.GetTask.
func taskDetailRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "case_id", "case_number", "case_title", "title", "description", "status",
		"assignee", "group_name", "order_index", "flag", "start_date", "end_date", "due_date", "organisation_ids", "created_at", "updated_at",
	})
}

func taskLogRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{"id", "case_id", "task_id", "message", "created_by", "created_at"})
}

func taskAttachmentRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "case_id", "observable_id", "log_id", "file_name", "content_type",
		"size_bytes", "scan_status", "bucket", "object_key", "uploaded_by", "created_at",
	})
}

func historyRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{"action", "actor_id", "created_at"})
}

func TestGetAlertReturnsObservablesSimilarAndHistory(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	alertID := "00000000-0000-0000-0000-0000000000aa"
	now := testNow()

	// Alert select
	mock.ExpectQuery("SELECT a.id::text AS id, a.title").WithArgs(alertID).
		WillReturnRows(alertDetailRows().AddRow(
			alertID, "Suspicious login", "", "external", "siem", "ref-1", 2, 2, 2, "New", false, false, false,
			"", "", "", "", 0, "", "{phishing}", nil, nil, now, now,
		))
	// Alert observables
	mock.ExpectQuery("FROM observables WHERE alert_id").WithArgs(alertID).
		WillReturnRows(alertObservableRows().AddRow(
			"00000000-0000-0000-0000-0000000000bb", "", alertID, "ip", "10.0.0.1", "",
			2, true, false, false, "", "", "", "{}", "{}", "analyst", now, now,
		))
	// Similar alerts
	mock.ExpectQuery("FROM alerts a").
		WillReturnRows(sqlmock.NewRows([]string{"id", "title", "source", "source_ref", "score", "reason", "observable_overlap", "ioc_overlap", "tag_overlap", "status"}))
	// Audit history
	mock.ExpectQuery("FROM audit_logs a LEFT JOIN users u").WithArgs("alert", alertID).
		WillReturnRows(historyRows().AddRow("alert.merge", "admin", now))

	h := handler.NewDetailHandler(sqlx.NewDb(db, "sqlmock"))
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/alerts/"+alertID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(alertID)

	if err := h.GetAlert(c); err != nil {
		t.Fatalf("GetAlert failed: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	body := rec.Body.String()
	for _, want := range []string{`"title":"Suspicious login"`, `"observables":[`, `"similar_alerts":[`, `"history":[`, `"alert.merge"`} {
		if !strings.Contains(body, want) {
			t.Fatalf("expected body to contain %s, got %s", want, body)
		}
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestGetAlertReturns404WhenMissing(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	alertID := "00000000-0000-0000-0000-0000000000ff"
	mock.ExpectQuery("SELECT a.id::text AS id, a.title").WithArgs(alertID).
		WillReturnRows(alertDetailRows())

	h := handler.NewDetailHandler(sqlx.NewDb(db, "sqlmock"))
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/alerts/"+alertID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(alertID)

	err = h.GetAlert(c)
	if err == nil {
		t.Fatal("expected not-found error")
	}
	if !strings.Contains(err.Error(), "alert not found") {
		t.Fatalf("expected alert not found error, got %v", err)
	}
}

func TestGetTaskReturnsLogsAttachmentsAndHistory(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	taskID := "00000000-0000-0000-0000-0000000000cc"
	caseID := "00000000-0000-0000-0000-0000000000cd"
	logID := "00000000-0000-0000-0000-0000000000ce"
	now := testNow()

	mock.ExpectQuery("FROM task_items t LEFT JOIN cases c ON c.id = t.case_id WHERE t.id").WithArgs(taskID).
		WillReturnRows(taskDetailRows().AddRow(
			taskID, caseID, 42, "Hunt", "Investigate phishing", "", "InProgress",
			"analyst", "default", 0, false, nil, nil, nil, "{}", now, now,
		))
	mock.ExpectQuery("FROM case_logs WHERE task_id").WithArgs(taskID).
		WillReturnRows(taskLogRows().AddRow(logID, caseID, taskID, "Triaged", "analyst", now))
	mock.ExpectQuery("WHERE log_id IN \\(SELECT id FROM case_logs WHERE task_id").WithArgs(taskID).
		WillReturnRows(taskAttachmentRows().AddRow(
			"00000000-0000-0000-0000-0000000000aa", caseID, "", logID, "evidence.txt", "text/plain",
			int64(12), "clean", "thehive-evidence", "case/1/file.txt", "analyst", now,
		))
	mock.ExpectQuery("FROM audit_logs a LEFT JOIN users u").WithArgs("task", taskID).
		WillReturnRows(historyRows().AddRow("task.assign", "admin", now))

	h := handler.NewDetailHandler(sqlx.NewDb(db, "sqlmock"))
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/tasks/"+taskID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(taskID)

	if err := h.GetTask(c); err != nil {
		t.Fatalf("GetTask failed: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	body := rec.Body.String()
	for _, want := range []string{
		`"title":"Investigate phishing"`,
		`"case_number":42`,
		`"logs":[`,
		`"attachments":[`,
		`"history":[`,
		`"task.assign"`,
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("expected body to contain %s, got %s", want, body)
		}
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestGetTaskReturns404WhenMissing(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	taskID := "00000000-0000-0000-0000-0000000000ee"
	mock.ExpectQuery("FROM task_items t LEFT JOIN cases c ON c.id = t.case_id WHERE t.id").WithArgs(taskID).
		WillReturnRows(taskDetailRows())

	h := handler.NewDetailHandler(sqlx.NewDb(db, "sqlmock"))
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/tasks/"+taskID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(taskID)

	err = h.GetTask(c)
	if err == nil {
		t.Fatal("expected not-found error")
	}
	if !strings.Contains(err.Error(), "task not found") {
		t.Fatalf("expected task not found error, got %v", err)
	}
}
