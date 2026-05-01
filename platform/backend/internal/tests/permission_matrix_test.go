package tests

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/authjwt"
	"github.com/thehive-platform/backend/internal/server"
)

func init() {
	echo.New().HTTPErrorHandler = func(err error, c echo.Context) { _ = c.NoContent(http.StatusInternalServerError) }
}

func TestRequirePermissionMatrix(t *testing.T) {
	cases := []struct {
		name       string
		have       []string
		required   string
		wantStatus int
	}{
		{name: "manage case allowed", have: []string{"manageCase"}, required: "manageCase", wantStatus: http.StatusNoContent},
		{name: "manage alert denied for case", have: []string{"manageAlert"}, required: "manageCase", wantStatus: http.StatusForbidden},
		{name: "manage config is not domain umbrella", have: []string{"manageConfig"}, required: "manageCase", wantStatus: http.StatusForbidden},
		{name: "manage platform admin fallback", have: []string{"managePlatform"}, required: "manageCase", wantStatus: http.StatusNoContent},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := echo.New()
			e.HTTPErrorHandler = server.ErrorHandler(nil)
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			rec := httptest.NewRecorder()
			ctx := e.NewContext(req, rec)
			ctx.Set("auth_claims", &authjwt.Claims{Login: "tester", Permissions: tc.have})
			next := func(c echo.Context) error { return c.NoContent(http.StatusNoContent) }
			err := server.RequirePermission(tc.required)(next)(ctx)
			if err != nil {
				e.HTTPErrorHandler(err, ctx)
			}
			if rec.Code != tc.wantStatus {
				t.Fatalf("expected %d got %d", tc.wantStatus, rec.Code)
			}
		})
	}
}
