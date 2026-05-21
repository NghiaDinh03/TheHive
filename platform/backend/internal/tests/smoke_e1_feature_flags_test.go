package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// E1 — Feature flags by org/team/user
// Verifies feature flag CRUD and scope-based enable/disable.

func TestE1_FeatureFlagCRUD(t *testing.T) {
	if adminToken == "" {
		t.Skip("Skipping: no auth token (run TestA2_LoginAndAuth first)")
	}

	// Create feature flag
	createReq := map[string]interface{}{
		"name":        "new-dashboard-ui",
		"description": "Enable new dashboard UI for pilot org",
		"enabled":     false,
		"scope":       "global",
	}
	body, _ := json.Marshal(createReq)
	req, _ := http.NewRequest("POST", baseURL+"/api/v1/admin/feature-flags", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode, "Feature flag creation should succeed")

	var flag struct {
		Name    string `json:"name"`
		Enabled bool   `json:"enabled"`
		Scope   string `json:"scope"`
	}
	err = json.NewDecoder(resp.Body).Decode(&flag)
	require.NoError(t, err)
	assert.Equal(t, "new-dashboard-ui", flag.Name)
	assert.Equal(t, false, flag.Enabled)
	assert.Equal(t, "global", flag.Scope)
	t.Logf("Feature flag created: %s (enabled=%v)", flag.Name, flag.Enabled)

	// Get feature flag
	req2, _ := http.NewRequest("GET", baseURL+"/api/v1/admin/feature-flags/new-dashboard-ui", nil)
	req2.Header.Set("Authorization", "Bearer "+adminToken)
	resp2, err := http.DefaultClient.Do(req2)
	require.NoError(t, err)
	defer resp2.Body.Close()

	assert.Equal(t, http.StatusOK, resp2.StatusCode, "Feature flag get should succeed")
	t.Log("Feature flag retrieved successfully")

	// Enable feature flag
	enableReq := map[string]interface{}{
		"enabled": true,
	}
	body3, _ := json.Marshal(enableReq)
	req3, _ := http.NewRequest("PATCH", baseURL+"/api/v1/admin/feature-flags/new-dashboard-ui", bytes.NewBuffer(body3))
	req3.Header.Set("Authorization", "Bearer "+adminToken)
	req3.Header.Set("Content-Type", "application/json")
	resp3, err := http.DefaultClient.Do(req3)
	require.NoError(t, err)
	defer resp3.Body.Close()

	assert.Equal(t, http.StatusOK, resp3.StatusCode, "Feature flag enable should succeed")
	t.Log("Feature flag enabled successfully")

	// List feature flags
	req4, _ := http.NewRequest("GET", baseURL+"/api/v1/admin/feature-flags", nil)
	req4.Header.Set("Authorization", "Bearer "+adminToken)
	resp4, err := http.DefaultClient.Do(req4)
	require.NoError(t, err)
	defer resp4.Body.Close()

	assert.Equal(t, http.StatusOK, resp4.StatusCode, "Feature flag list should succeed")
	t.Log("Feature flags listed successfully")

	// Delete feature flag
	req5, _ := http.NewRequest("DELETE", baseURL+"/api/v1/admin/feature-flags/new-dashboard-ui", nil)
	req5.Header.Set("Authorization", "Bearer "+adminToken)
	resp5, err := http.DefaultClient.Do(req5)
	require.NoError(t, err)
	defer resp5.Body.Close()

	assert.Equal(t, http.StatusOK, resp5.StatusCode, "Feature flag delete should succeed")
	t.Log("Feature flag deleted successfully")
}

func TestE1_FeatureFlagOrgScope(t *testing.T) {
	if adminToken == "" {
		t.Skip("Skipping: no auth token")
	}

	// Create org-scoped feature flag
	createReq := map[string]interface{}{
		"name":        "org-pilot-feature",
		"description": "Feature enabled for pilot org only",
		"enabled":     true,
		"scope":       "organisation",
		"scope_id":    "admin",
	}
	body, _ := json.Marshal(createReq)
	req, _ := http.NewRequest("POST", baseURL+"/api/v1/admin/feature-flags", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode, "Org-scoped feature flag creation should succeed")
	t.Log("Org-scoped feature flag created successfully")

	// Cleanup
	req2, _ := http.NewRequest("DELETE", baseURL+"/api/v1/admin/feature-flags/org-pilot-feature", nil)
	req2.Header.Set("Authorization", "Bearer "+adminToken)
	resp2, _ := http.DefaultClient.Do(req2)
	resp2.Body.Close()
}
