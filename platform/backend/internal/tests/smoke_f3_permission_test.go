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

func TestF3_NegativeAuthz_AnalystAndClientAccessDenied(t *testing.T) {
	adminToken, err := loginHelper()
	require.NoError(t, err)
	require.NotEmpty(t, adminToken)

	// 1. Tạo user analyst-f3@thehive.local (profile: analyst, org: NCS)
	analystReq := map[string]interface{}{
		"login":                "analyst-f3@thehive.local",
		"name":                 "Analyst F3",
		"organisation":         "NCS",
		"profile":              "analyst",
		"password":             "Password123@",
		"must_change_password": false,
	}
	body, _ := json.Marshal(analystReq)

	req, _ := http.NewRequest("POST", baseURL+"/api/v1/admin/users", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	assert.Contains(t, []int{http.StatusCreated, http.StatusConflict}, resp.StatusCode, "Analyst user creation check")

	// 2. Tạo user client-f3@thehive.local (profile: client, org: NCS)
	clientReq := map[string]interface{}{
		"login":                "client-f3@thehive.local",
		"name":                 "Client F3",
		"organisation":         "NCS",
		"profile":              "client",
		"password":             "Password123@",
		"must_change_password": false,
	}
	body, _ = json.Marshal(clientReq)

	req, _ = http.NewRequest("POST", baseURL+"/api/v1/admin/users", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	assert.Contains(t, []int{http.StatusCreated, http.StatusConflict}, resp.StatusCode, "Client user creation check")

	// 3. Đăng nhập analyst-f3@thehive.local
	analystLogin := map[string]string{
		"login":    "analyst-f3@thehive.local",
		"password": "Password123@",
	}
	body, _ = json.Marshal(analystLogin)
	resp, err = http.Post(baseURL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(body))
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode, "Analyst login should succeed")

	var analystResp struct {
		Token string `json:"token"`
	}
	err = json.NewDecoder(resp.Body).Decode(&analystResp)
	require.NoError(t, err)
	analystToken := analystResp.Token
	require.NotEmpty(t, analystToken)

	// 4. Đăng nhập client-f3@thehive.local
	clientLogin := map[string]string{
		"login":    "client-f3@thehive.local",
		"password": "Password123@",
	}
	body, _ = json.Marshal(clientLogin)
	resp, err = http.Post(baseURL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(body))
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode, "Client login should succeed")

	var clientResp struct {
		Token string `json:"token"`
	}
	err = json.NewDecoder(resp.Body).Decode(&clientResp)
	require.NoError(t, err)
	clientToken := clientResp.Token
	require.NotEmpty(t, clientToken)

	// 5. Kiểm thử Analyst gọi API Admin (ví dụ GET /api/v1/admin/users) -> 403 Forbidden
	req, _ = http.NewRequest("GET", baseURL+"/api/v1/admin/users", nil)
	req.Header.Set("Authorization", "Bearer "+analystToken)
	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusForbidden, resp.StatusCode, "Analyst calling admin API should be Forbidden")

	// 6. Kiểm thử Client gọi API Admin (GET /api/v1/admin/users) -> 403 Forbidden
	req, _ = http.NewRequest("GET", baseURL+"/api/v1/admin/users", nil)
	req.Header.Set("Authorization", "Bearer "+clientToken)
	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusForbidden, resp.StatusCode, "Client calling admin API should be Forbidden")

	// 7. Client gọi API Alert list -> 403 Forbidden vì client profile không có manageAlert
	req, _ = http.NewRequest("GET", baseURL+"/api/v1/alerts", nil)
	req.Header.Set("Authorization", "Bearer "+clientToken)
	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusForbidden, resp.StatusCode, "Client calling alert list should be Forbidden")

	t.Log("F3 Analyst and Client Negative Authz tests: PASS")
}

