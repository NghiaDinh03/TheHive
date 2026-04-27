package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

func TestAdminListUsers(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT u.login, u.name").WillReturnRows(sqlmock.NewRows([]string{"login", "name", "organisation", "profile", "status", "locked", "must_change_password", "last_login_at", "created_at", "updated_at"}))
	h := NewAdminHandler(sqlx.NewDb(db, "sqlmock"), nil, nil)
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/users", nil)
	rec := httptest.NewRecorder()
	if err := h.ListUsers(e.NewContext(req, rec)); err != nil {
		t.Fatalf("ListUsers failed: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestAdminCreateUserRequiresValidPasswordWhenProvided(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	h := NewAdminHandler(sqlx.NewDb(db, "sqlmock"), nil, nil)
	e := echo.New()
	e.Validator = testValidator{}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/users", strings.NewReader(`{"login":"a@example.com","name":"A","organisation":"admin","profile":"admin","password":"weak"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	err = h.CreateUser(e.NewContext(req, rec))
	if err == nil {
		t.Fatal("expected validation/policy error")
	}
}

type testValidator struct{}

func (testValidator) Validate(i any) error { return nil }
