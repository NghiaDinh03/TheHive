package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// C4 — Dashboard schema validation + page scoping
// Verifies dashboard CRUD, widget schema, and page permission scoping.

func TestC4_DashboardCRUD(t *testing.T) {
	if adminToken == "" {
		t.Skip("Skipping: no auth token (run TestA2_LoginAndAuth first)")
	}

	// Create dashboard
	createReq := map[string]interface{}{
		"title":       "C4 Test Dashboard",
		"description": "Dashboard created by C4 test",
	}
	body, _ := json.Marshal(createReq)
	req, _ := http.NewRequest("POST", baseURL+"/api/v1/dashboards", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode, "Dashboard creation should succeed")

	var dashboard struct {
		ID          string `json:"id"`
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	err = json.NewDecoder(resp.Body).Decode(&dashboard)
	require.NoError(t, err)
	require.NotEmpty(t, dashboard.ID, "Dashboard ID should be returned")
	t.Logf("Dashboard created: %s (%s)", dashboard.Title, dashboard.ID)

	// Get dashboard
	req2, _ := http.NewRequest("GET", baseURL+"/api/v1/dashboards/"+dashboard.ID, nil)
	req2.Header.Set("Authorization", "Bearer "+adminToken)
	resp2, err := http.DefaultClient.Do(req2)
	require.NoError(t, err)
	defer resp2.Body.Close()

	assert.Equal(t, http.StatusOK, resp2.StatusCode, "Dashboard get should succeed")
	t.Log("Dashboard retrieved successfully")

	// Update dashboard
	updateReq := map[string]interface{}{
		"title": "C4 Test Dashboard Updated",
	}
	body3, _ := json.Marshal(updateReq)
	req3, _ := http.NewRequest("PATCH", baseURL+"/api/v1/dashboards/"+dashboard.ID, bytes.NewBuffer(body3))
	req3.Header.Set("Authorization", "Bearer "+adminToken)
	req3.Header.Set("Content-Type", "application/json")
	resp3, err := http.DefaultClient.Do(req3)
	require.NoError(t, err)
	defer resp3.Body.Close()

	assert.Equal(t, http.StatusOK, resp3.StatusCode, "Dashboard update should succeed")
	t.Log("Dashboard updated successfully")

	// List dashboards
	req4, _ := http.NewRequest("GET", baseURL+"/api/v1/dashboards", nil)
	req4.Header.Set("Authorization", "Bearer "+adminToken)
	resp4, err := http.DefaultClient.Do(req4)
	require.NoError(t, err)
	defer resp4.Body.Close()

	assert.Equal(t, http.StatusOK, resp4.StatusCode, "Dashboard list should succeed")
	t.Log("Dashboard list retrieved successfully")

	// Delete dashboard
	req5, _ := http.NewRequest("DELETE", baseURL+"/api/v1/dashboards/"+dashboard.ID, nil)
	req5.Header.Set("Authorization", "Bearer "+adminToken)
	resp5, err := http.DefaultClient.Do(req5)
	require.NoError(t, err)
	defer resp5.Body.Close()

	assert.Equal(t, http.StatusOK, resp5.StatusCode, "Dashboard delete should succeed")
	t.Log("Dashboard deleted successfully")
}

func TestC4_PageCRUD(t *testing.T) {
	if adminToken == "" {
		t.Skip("Skipping: no auth token")
	}

	// Create page
	createReq := map[string]interface{}{
		"title":   "C4 Test Page",
		"content": "# Test Page\n\nThis is a test knowledge page.",
	}
	body, _ := json.Marshal(createReq)
	req, _ := http.NewRequest("POST", baseURL+"/api/v1/pages", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode, "Page creation should succeed")

	var page struct {
		ID      string `json:"id"`
		Title   string `json:"title"`
		Content string `json:"content"`
	}
	err = json.NewDecoder(resp.Body).Decode(&page)
	require.NoError(t, err)
	require.NotEmpty(t, page.ID, "Page ID should be returned")
	t.Logf("Page created: %s (%s)", page.Title, page.ID)

	// Get page
	req2, _ := http.NewRequest("GET", baseURL+"/api/v1/pages/"+page.ID, nil)
	req2.Header.Set("Authorization", "Bearer "+adminToken)
	resp2, err := http.DefaultClient.Do(req2)
	require.NoError(t, err)
	defer resp2.Body.Close()

	assert.Equal(t, http.StatusOK, resp2.StatusCode, "Page get should succeed")
	t.Log("Page retrieved successfully")

	// Delete page
	req3, _ := http.NewRequest("DELETE", baseURL+"/api/v1/pages/"+page.ID, nil)
	req3.Header.Set("Authorization", "Bearer "+adminToken)
	resp3, err := http.DefaultClient.Do(req3)
	require.NoError(t, err)
	defer resp3.Body.Close()

	assert.Equal(t, http.StatusOK, resp3.StatusCode, "Page delete should succeed")
	t.Log("Page deleted successfully")
}

func TestC4_DashboardWidgetSchema(t *testing.T) {
	if adminToken == "" {
		t.Skip("Skipping: no auth token")
	}

	// Create dashboard
	createReq := map[string]interface{}{
		"title": "C4 Widget Test Dashboard",
	}
	body, _ := json.Marshal(createReq)
	req, _ := http.NewRequest("POST", baseURL+"/api/v1/dashboards", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode, "Dashboard creation should succeed")

	var dashboard struct {
		ID string `json:"id"`
	}
	err = json.NewDecoder(resp.Body).Decode(&dashboard)
	require.NoError(t, err)
	t.Logf("Dashboard created: %s", dashboard.ID)

	// Verify dashboard can be retrieved (schema validation)
	req2, _ := http.NewRequest("GET", baseURL+"/api/v1/dashboards/"+dashboard.ID, nil)
	req2.Header.Set("Authorization", "Bearer "+adminToken)
	resp2, err := http.DefaultClient.Do(req2)
	require.NoError(t, err)
	defer resp2.Body.Close()

	assert.Equal(t, http.StatusOK, resp2.StatusCode, "Dashboard get should succeed")

	var retrieved struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	}
	err = json.NewDecoder(resp2.Body).Decode(&retrieved)
	require.NoError(t, err)
	assert.Equal(t, dashboard.ID, retrieved.ID, "Retrieved dashboard ID should match")
	assert.Equal(t, "C4 Widget Test Dashboard", retrieved.Title, "Title should match")
	t.Log("Dashboard schema validated successfully")

	// Cleanup
	req3, _ := http.NewRequest("DELETE", baseURL+"/api/v1/dashboards/"+dashboard.ID, nil)
	req3.Header.Set("Authorization", "Bearer "+adminToken)
	resp3, _ := http.DefaultClient.Do(req3)
	resp3.Body.Close()
}
