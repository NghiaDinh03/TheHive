package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

func TestAlertMergeRequiresTarget(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT id::text AS id, title").WithArgs("00000000-0000-0000-0000-000000000001").WillReturnRows(sqlmock.NewRows([]string{"id", "title", "type", "source", "source_ref", "severity", "tlp", "status", "read", "case_id", "tags", "created_at", "updated_at"}).AddRow("00000000-0000-0000-0000-000000000001", "Alert", "external", "src", "ref", 2, 2, "New", false, nil, "{}", testNow(), testNow()))
	mock.ExpectRollback()

	h := NewAlertWriteHandler(sqlx.NewDb(db, "sqlmock"), nil)
	e := echo.New()
	e.Validator = testValidator{}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/alerts/00000000-0000-0000-0000-000000000001/merge", strings.NewReader(`{}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("00000000-0000-0000-0000-000000000001")

	if err := h.Merge(c); err == nil {
		t.Fatal("expected missing target error")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestCreateTaskValidatesRequiredFields(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	h := NewWorkWriteHandler(sqlx.NewDb(db, "sqlmock"), nil)
	e := echo.New()
	e.Validator = testValidator{}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/tasks", strings.NewReader(`{"case_id":"","title":""}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	if err := h.CreateTask(e.NewContext(req, rec)); err == nil {
		t.Fatal("expected repository validation error")
	}
}

func TestAnalyzeObservablePlaceholderReturnsAcceptedShape(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT id::text AS id, case_id::text AS case_id, data_type").WithArgs("00000000-0000-0000-0000-000000000002").WillReturnRows(sqlmock.NewRows([]string{"id", "case_id", "data_type", "data", "message", "tlp", "ioc", "sighted", "tags", "created_by", "created_at", "updated_at"}).AddRow("00000000-0000-0000-0000-000000000002", "00000000-0000-0000-0000-000000000003", "domain", "example.org", "", 2, true, false, "{}", "analyst", testNow(), testNow()))
	mock.ExpectQuery("SELECT id::text AS id, case_id::text AS case_id, data_type").WithArgs("00000000-0000-0000-0000-000000000002").WillReturnRows(sqlmock.NewRows([]string{"id", "case_id", "data_type", "data", "message", "tlp", "ioc", "sighted", "tags", "created_by", "created_at", "updated_at"}).AddRow("00000000-0000-0000-0000-000000000002", "00000000-0000-0000-0000-000000000003", "domain", "example.org", "", 2, true, false, "{}", "analyst", testNow(), testNow()))
	mock.ExpectCommit()

	h := NewWorkWriteHandler(sqlx.NewDb(db, "sqlmock"), nil)
	e := echo.New()
	e.Validator = testValidator{}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/observables/00000000-0000-0000-0000-000000000002/analyze", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("00000000-0000-0000-0000-000000000002")

	if err := h.AnalyzeObservable(c); err != nil {
		t.Fatalf("AnalyzeObservable failed: %v", err)
	}
	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", rec.Code)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func testNow() time.Time {
	return time.Date(2026, 4, 26, 19, 0, 0, 0, time.UTC)
}
