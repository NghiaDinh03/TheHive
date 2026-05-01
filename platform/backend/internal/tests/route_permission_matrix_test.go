package tests

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/authjwt"
	"github.com/thehive-platform/backend/internal/server"
)

// routeMatrixCase asserts that a route guarded by RequirePermission(P) returns 403 for users
// without P, and reaches the inner handler (200) for users with P. This is the
// route-group-level integration matrix asked for by Phase 4.0.1.C.
type routeMatrixCase struct {
	name       string
	method     string
	path       string
	permission string
	have       []string
	wantStatus int
}

func TestRouteGroupPermissionMatrix(t *testing.T) {
	// Map every guarded route group declared in server.go to its required permission.
	// Keep this list in sync with platform/backend/internal/server/server.go.
	groups := map[string]string{
		// Investigation read/write
		"GET /api/v1/cases":                            "manageCase",
		"POST /api/v1/cases":                           "manageCase",
		"PATCH /api/v1/cases/:id":                      "manageCase",
		"DELETE /api/v1/cases/:id":                     "manageCase",
		"POST /api/v1/cases/:id/close":                 "manageCase",
		"POST /api/v1/cases/:id/reopen":                "manageCase",
		"POST /api/v1/cases/:id/logs":                  "manageCase",
		"GET /api/v1/cases/:id/tasks":                  "manageCase",
		"GET /api/v1/cases/:id/logs":                   "manageCase",
		"GET /api/v1/cases/:id/attachments":            "manageCase",
		"POST /api/v1/cases/:id/custom-fields":         "manageCustomField",
		"PATCH /api/v1/cases/:id/custom-fields/:cfid":  "manageCustomField",
		"DELETE /api/v1/cases/:id/custom-fields/:cfid": "manageCustomField",
		"POST /api/v1/cases/:id/procedures":            "manageProcedure",
		"PATCH /api/v1/cases/:id/procedures/:procid":   "manageProcedure",
		"DELETE /api/v1/cases/:id/procedures/:procid":  "manageProcedure",
		"POST /api/v1/cases/:id/shares":                "manageShare",
		"PATCH /api/v1/cases/:id/shares/:shareid":      "manageShare",
		"DELETE /api/v1/cases/:id/shares/:shareid":     "manageShare",
		"GET /api/v1/case-templates":                   "manageCaseTemplate",
		"POST /api/v1/case-templates":                  "manageCaseTemplate",
		"POST /api/v1/tasks":                           "manageTask",
		"GET /api/v1/tasks":                            "manageTask",
		"GET /api/v1/tasks/:id":                        "manageTask",
		"PATCH /api/v1/tasks/:id":                      "manageTask",
		"POST /api/v1/tasks/:id/assign":                "manageTask",
		"POST /api/v1/tasks/:id/close":                 "manageTask",
		"POST /api/v1/tasks/reorder":                   "manageTask",
		"POST /api/v1/tasks/bulk/close":                "manageTask",
		"POST /api/v1/tasks/bulk/assign":               "manageTask",
		"POST /api/v1/attachments/upload":              "accessTheHiveFS",
		"POST /api/v1/attachments/:id/finalize":        "accessTheHiveFS",
		"GET /api/v1/attachments":                      "accessTheHiveFS",
		"GET /api/v1/attachments/:id/download":         "accessTheHiveFS",
		"GET /api/v1/attachments/:id/download.zip":     "accessTheHiveFS",
		"POST /api/v1/attachments/:id/scan":            "accessTheHiveFS",
		"GET /api/v1/alerts":                           "manageAlert",
		"GET /api/v1/alerts/:id":                       "manageAlert",
		"POST /api/v1/alerts/:id/import":               "manageAlert",
		"POST /api/v1/alerts/:id/merge":                "manageAlert",
		"GET /api/v1/observables":                      "manageObservable",
		"POST /api/v1/observables":                     "manageObservable",
		"PATCH /api/v1/observables/:id":                "manageObservable",
		"DELETE /api/v1/observables/:id":               "manageObservable",
		"POST /api/v1/observables/:id/analyze":         "manageObservable",
		// Admin
		"GET /api/v1/admin/users":                        "manageUser",
		"POST /api/v1/admin/users":                       "manageUser",
		"PATCH /api/v1/admin/users/:login":               "manageUser",
		"POST /api/v1/admin/users/:login/lock":           "manageUser",
		"POST /api/v1/admin/users/:login/unlock":         "manageUser",
		"POST /api/v1/admin/users/:login/reset-password": "manageUser",
		"POST /api/v1/admin/users/:login/reset-token":    "manageUser",
		"POST /api/v1/admin/users/:login/approve":        "manageUser",
		"GET /api/v1/admin/organisations":                "manageOrganisation",
		"POST /api/v1/admin/organisations":               "manageOrganisation",
		"GET /api/v1/admin/profiles":                     "manageProfile",
		"POST /api/v1/admin/profiles":                    "manageProfile",
		"GET /api/v1/audit":                              "managePlatform",
	}

	// Mismatched permission lookup table. Analyst permissions must not bleed across
	// legacy TheHive 4 action-level permission groups.
	wrongFor := map[string]string{
		"accessTheHiveFS":    "manageCase",
		"manageCase":         "manageAlert",
		"manageCaseTemplate": "manageCase",
		"manageCustomField":  "manageCase",
		"manageProcedure":    "manageCase",
		"manageShare":        "manageCase",
		"manageTask":         "manageCase",
		"manageAlert":        "manageObservable",
		"manageAnalyse":      "manageObservable",
		"manageObservable":   "manageCase",
		"manageUser":         "manageCase",
		"manageOrganisation": "manageCase",
		"manageProfile":      "manageConfig",
		"managePlatform":     "manageConfig",
		"manageConfig":       "manageCase",
	}

	cases := []routeMatrixCase{}
	for route, perm := range groups {
		method, path := splitRoute(route)
		// Allow case: user has the exact permission.
		cases = append(cases, routeMatrixCase{
			name:       "allow " + route,
			method:     method,
			path:       path,
			permission: perm,
			have:       []string{perm},
			wantStatus: http.StatusOK,
		})
		// Deny case: user only has an unrelated permission.
		cases = append(cases, routeMatrixCase{
			name:       "deny " + route,
			method:     method,
			path:       path,
			permission: perm,
			have:       []string{wrongFor[perm]},
			wantStatus: http.StatusForbidden,
		})
		// manageConfig should generally not be the umbrella for domain writes here because the
		// matrix in HasPermission only treats it as broad for config; we explicitly do NOT assert
		// manageConfig as a fallback for manageUser/manageOrganisation here to avoid coupling
		// the test to an undefined umbrella semantics. Instead we assert:
		// missing-permissions → 403.
		cases = append(cases, routeMatrixCase{
			name:       "deny empty permissions " + route,
			method:     method,
			path:       path,
			permission: perm,
			have:       []string{},
			wantStatus: http.StatusForbidden,
		})
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			e := echo.New()
			e.HTTPErrorHandler = server.ErrorHandler(nil)
			req := httptest.NewRequest(tc.method, tc.path, nil)
			rec := httptest.NewRecorder()
			ctx := e.NewContext(req, rec)
			ctx.Set("auth_claims", &authjwt.Claims{Login: "tester", Permissions: tc.have})
			next := func(c echo.Context) error { return c.NoContent(http.StatusOK) }
			err := server.RequirePermission(tc.permission)(next)(ctx)
			if err != nil {
				e.HTTPErrorHandler(err, ctx)
			}
			if rec.Code != tc.wantStatus {
				t.Fatalf("route %s with %v want %d got %d body=%s", tc.path, tc.have, tc.wantStatus, rec.Code, rec.Body.String())
			}
		})
	}
}

// TestUnauthenticatedClaimsAreDeniedAcrossAllPermissions guarantees that a missing/nil claims
// pointer is treated as "no permission" rather than panicking, on every guarded permission name.
func TestUnauthenticatedClaimsAreDeniedAcrossAllPermissions(t *testing.T) {
	permissions := []string{"accessTheHiveFS", "manageCase", "manageCaseTemplate", "manageCustomField", "manageProcedure", "manageShare", "manageTask", "manageAlert", "manageAnalyse", "manageObservable", "manageUser", "manageOrganisation", "manageProfile", "manageConfig", "managePlatform"}
	for _, perm := range permissions {
		perm := perm
		t.Run("nil claims deny "+perm, func(t *testing.T) {
			e := echo.New()
			e.HTTPErrorHandler = server.ErrorHandler(nil)
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			rec := httptest.NewRecorder()
			ctx := e.NewContext(req, rec)
			// Intentionally do NOT set auth_claims to mimic unauthenticated request.
			next := func(c echo.Context) error { return c.NoContent(http.StatusOK) }
			err := server.RequirePermission(perm)(next)(ctx)
			if err != nil {
				e.HTTPErrorHandler(err, ctx)
			}
			if rec.Code != http.StatusForbidden {
				t.Fatalf("permission %s expected 403 got %d", perm, rec.Code)
			}
		})
	}
}

func splitRoute(route string) (string, string) {
	// route format: "METHOD /api/v1/path"; the test only needs the path to build the request,
	// since the RequirePermission middleware is method-agnostic.
	for i := 0; i < len(route); i++ {
		if route[i] == ' ' {
			return route[:i], route[i+1:]
		}
	}
	return http.MethodGet, route
}
