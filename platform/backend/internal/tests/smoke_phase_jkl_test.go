package tests

import (
	"context"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/authjwt"
	"github.com/thehive-platform/backend/internal/handler"
	"github.com/thehive-platform/backend/internal/server"
)

// TestRequirePermissionRBACWriteHardening tests Phase K: blocking write methods (POST, PUT, PATCH, DELETE)
// from users with read-only or client profiles at the middleware level.
func TestRequirePermissionRBACWriteHardening(t *testing.T) {
	cases := []struct {
		name       string
		method     string
		profile    string
		perm       string
		wantStatus int
	}{
		{
			name:       "POST write by read-only profile is forbidden",
			method:     http.MethodPost,
			profile:    "read-only",
			perm:       "manageCase",
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "PATCH write by client profile is forbidden",
			method:     http.MethodPatch,
			profile:    "client-soc",
			perm:       "manageCase",
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "DELETE write by read-only is forbidden",
			method:     http.MethodDelete,
			profile:    "postgres-read-only",
			perm:       "manageCase",
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "GET read by read-only is allowed if has permission",
			method:     http.MethodGet,
			profile:    "read-only",
			perm:       "manageCase",
			wantStatus: http.StatusNoContent,
		},
		{
			name:       "POST write by analyst profile is allowed if has permission",
			method:     http.MethodPost,
			profile:    "analyst",
			perm:       "manageCase",
			wantStatus: http.StatusNoContent,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := echo.New()
			e.HTTPErrorHandler = server.ErrorHandler(nil)
			req := httptest.NewRequest(tc.method, "/", nil)
			rec := httptest.NewRecorder()
			ctx := e.NewContext(req, rec)
			
			// Setup JWT claims with specific profile and mock permission matching the required permission
			ctx.Set("auth_claims", &authjwt.Claims{
				Login:       "tester",
				Profile:     tc.profile,
				Permissions: []string{tc.perm},
			})

			next := func(c echo.Context) error { return c.NoContent(http.StatusNoContent) }
			err := server.RequirePermission(tc.perm)(next)(ctx)
			if err != nil {
				e.HTTPErrorHandler(err, ctx)
			}
			
			if rec.Code != tc.wantStatus {
				t.Fatalf("expected status %d, got %d", tc.wantStatus, rec.Code)
			}
		})
	}
}

// TestRegexParserLogic tests Phase J: dynamic regex matching engine in Go backend.
func TestRegexParserLogic(t *testing.T) {
	// 1. Test standard compiled regex caching
	pattern := `\b(?:\d{1,3}\.){3}\d{1,3}\b`
	re, err := regexp.Compile(pattern)
	if err != nil {
		t.Fatalf("failed to compile test pattern: %v", err)
	}

	testLogText := "SIEM Alert: Ransomware detected from src_ip=192.168.1.100 target_port=445"
	matches := re.FindAllString(testLogText, -1)
	if len(matches) == 0 {
		t.Fatalf("expected to match IP address in log text")
	}
	if matches[0] != "192.168.1.100" {
		t.Fatalf("expected to extract 192.168.1.100, got %s", matches[0])
	}

	// 2. Test Dynamic Parser database insertion flow using SQL Mock
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("an error '%s' was not expected when opening a stub database connection", err)
	}
	defer db.Close()
	sqlxDB := sqlx.NewDb(db, "sqlmock")

	caseID := "e0000000-0000-0000-0000-000000000001"

	// Mocking regex rules fetch
	rows := sqlmock.NewRows([]string{"name", "regex_pattern", "target_field"}).
		AddRow("Extract IPv4 Address", `\b(?:\d{1,3}\.){3}\d{1,3}\b`, "src_ip")
	
	mock.ExpectQuery("SELECT name, regex_pattern, target_field FROM custom_properties_regex").
		WillReturnRows(rows)

	// Mock checking custom field existence: returns false
	mock.ExpectQuery("SELECT EXISTS").
		WithArgs(caseID, "src_ip").
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	// Mock inserting new custom field
	mock.ExpectExec("INSERT INTO custom_fields").
		WithArgs(caseID, "src_ip", "192.168.1.100").
		WillReturnResult(sqlmock.NewResult(1, 1))

	// Run parser under test
	handler.ParseTextAndExtractCustomProperties(context.Background(), sqlxDB, caseID, testLogText)

	// Make sure all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("there were unfulfilled expectations: %s", err)
	}
}
