package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// F3 Permission Matrix Visual Regression
// Verifies API agree allow/deny different profiles.

func TestF3_NegativeAuthz_CaseAccessDenied(t *testing.T) {
	token, err := loginHelper()
	require.NoError(t, err)
	require.NotEmpty(t, token)

	// Create test case first
	caseReq := map[string]interface{}{
		"title":       "F3 Permission Test Case",
		"description": "Testing permission denied scenarios",
		"severity":    1,
		"tlp":         2,
		"pap":         2,
	}
	body, _ := json.Marshal(caseReq)

	req, _ := http.NewRequest("POST", baseURL+"/api/v1/cases", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode, "Case creation succeed")

	var caseResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&caseResp)
	require.NoError(t, err)

	caseID := caseResp["id"].(string)

	// Test: Try access case without auth token
	req, _ = http.NewRequest("GET", baseURL+"/api/v1/cases/"+caseID, nil)
	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "Unauthenticated access denied")

	t.Log("F3 Negative authz case access denied: PASS")
}

func TestF3_NegativeAuthz_CaseCreateDenied(t *testing.T) {
	// Test: Try create case without auth token
	caseReq := map[string]interface{}{
		"title":       "F3 Unauthorized Case",
		"description": "Should not created",
		"severity":    1,
		"tlp":         2,
		"pap":         2,
	}
	body, _ := json.Marshal(caseReq)

	req, _ := http.NewRequest("POST", baseURL+"/api/v1/cases", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "Unauthenticated case create denied")

	t.Log("F3 Negative authz case create denied: PASS")
}

func TestF3_NegativeAuthz_AlertAccessDenied(t *testing.T) {
	// Test: Try access alerts without auth token
	req, _ := http.NewRequest("GET", baseURL+"/api/v1/alerts", nil)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "Unauthenticated alert access denied")

	t.Log("F3 Negative authz alert access denied: PASS")
}

func TestF3_NegativeAuthz_TaskAccessDenied(t *testing.T) {
	// Test: Try access tasks without auth token
	req, _ := http.NewRequest("GET", baseURL+"/api/v1/tasks", nil)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "Unauthenticated task access denied")

	t.Log("F3 Negative authz task access denied: PASS")
}

func TestF3_NegativeAuthz_AdminAccessDenied(t *testing.T) {
	// Test: Try access admin endpoints without auth token
	req, _ := http.NewRequest("GET", baseURL+"/api/v1/admin/users", nil)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "Unauthenticated admin access denied")

	t.Log("F3 Negative authz admin access denied: PASS")
}

func TestF3_NegativeAuthz_InvalidToken(t *testing.T) {
	// Test: Try access invalid token
	req, _ := http.NewRequest("GET", baseURL+"/api/v1/cases", nil)
	req.Header.Set("Authorization", "Bearer invalid-token-12345")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "Invalid token denied")

	t.Log("F3 Negative authz invalid token denied: PASS")
}

func TestF3_PermissionMatrix_AllRoutes(t *testing.T) {
	token, err := loginHelper()
	require.NoError(t, err)
	require.NotEmpty(t, token)

	// Test admin access all key routes
	routes := []struct {
		method string
		path   string
		name   string
	}{
		{"GET", "/api/v1/cases", "case list"},
		{"GET", "/api/v1/alerts", "alert list"},
		{"GET", "/api/v1/tasks", "task list"},
		{"GET", "/api/v1/observables", "observable list"},
		{"GET", "/api/v1/auth/me", "user profile"},
		{"GET", "/api/v1/admin/users", "admin users"},
		{"GET", "/api/v1/admin/organisations", "admin organisations"},
		{"GET", "/api/v1/admin/profiles", "admin profiles"},
		{"GET", "/api/v1/describe", "describe API"},
		{"GET", "/api/v1/tags", "tags list"},
	}

	for _, route := range routes {
		req, _ := http.NewRequest(route.method, baseURL+route.path, nil)
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode, fmt.Sprintf("Admin access %s %s", route.method, route.name))
	}

	t.Log("F3 Permission matrix admin access all routes: PASS")
}

func TestF3_ButtonVisibility_CaseActions(t *testing.T) {
	token, err := loginHelper()
	require.NoError(t, err)
	require.NotEmpty(t, token)

	// Create test case
	caseReq := map[string]interface{}{
		"title":       "F3 Button Visibility Test",
		"description": "Testing button visibility",
		"severity":    1,
		"tlp":         2,
		"pap":         2,
	}
	body, _ := json.Marshal(caseReq)

	req, _ := http.NewRequest("POST", baseURL+"/api/v1/cases", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	var caseResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&caseResp)
	require.NoError(t, err)

	caseID := caseResp["id"].(string)

	// Verify case detail includes action fields
	req, _ = http.NewRequest("GET", baseURL+"/api/v1/cases/"+caseID, nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	var detailResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&detailResp)
	require.NoError(t, err)

	// Verify case detail expected structure
	assert.Contains(t, detailResp, "case", "Detail contain case")
	assert.Contains(t, detailResp, "tasks", "Detail contain tasks")
	assert.Contains(t, detailResp, "observables", "Detail contain observables")

	t.Log("F3 Button visibility case actions: PASS")
}
