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

// F2 API Response Field-by-Field Comparison
// Verifies new API responses match expected field structure legacy TheHive 4.

func TestF2_CaseResponseFields(t *testing.T) {
	token, err := loginHelper()
	require.NoError(t, err, "Login succeed")
	require.NotEmpty(t, token, "Token returned")

	// Create test case
	caseReq := map[string]interface{}{
		"title":       "NCS SOC: Phân tích so sánh tệp đính kèm chứa mã độc phishing",
		"description": "Rà soát tính nhất quán và cấu trúc phản hồi API trường dữ liệu của tệp đính kèm nguy hiểm",
		"severity":    2,
		"tlp":         2,
		"pap":         2,
		"tags":        []string{"phishing", "api-comparison"},
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

	// Verify required fields exist (matching new API snake_case response)
	requiredFields := []string{"id", "title", "description", "severity", "tlp", "pap", "status", "tags", "created_at"}
	for _, field := range requiredFields {
		assert.Contains(t, caseResp, field, fmt.Sprintf("Case response contain field: %s", field))
	}

	// Verify field types
	assert.IsType(t, "", caseResp["id"], "id string")
	assert.IsType(t, "", caseResp["title"], "title string")
	assert.IsType(t, "", caseResp["description"], "description string")
	assert.IsType(t, float64(0), caseResp["severity"], "severity number")
	assert.IsType(t, float64(0), caseResp["tlp"], "tlp number")
	assert.IsType(t, float64(0), caseResp["pap"], "pap number")
	assert.IsType(t, "", caseResp["status"], "status string")
	assert.IsType(t, []interface{}{}, caseResp["tags"], "tags array")

	t.Log("F2 Case response fields: PASS")
}

func TestF2_AlertResponseFields(t *testing.T) {
	token, err := loginHelper()
	require.NoError(t, err)
	require.NotEmpty(t, token)

	req, _ := http.NewRequest("GET", baseURL+"/api/v1/alerts", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Alert list succeed")

	var alertResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&alertResp)
	require.NoError(t, err)

	// Verify response structure
	assert.Contains(t, alertResp, "values", "Alert list contain values array")
	assert.Contains(t, alertResp, "total", "Alert list contain total count")

	t.Log("F2 Alert response fields: PASS")
}

func TestF2_ObservableResponseFields(t *testing.T) {
	token, err := loginHelper()
	require.NoError(t, err)
	require.NotEmpty(t, token)

	req, _ := http.NewRequest("GET", baseURL+"/api/v1/observables", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Observable list succeed")

	var obsResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&obsResp)
	require.NoError(t, err)

	// Verify response structure
	assert.Contains(t, obsResp, "values", "Observable list contain values array")
	assert.Contains(t, obsResp, "total", "Observable list contain total count")

	t.Log("F2 Observable response fields: PASS")
}

func TestF2_TaskResponseFields(t *testing.T) {
	token, err := loginHelper()
	require.NoError(t, err)
	require.NotEmpty(t, token)

	req, _ := http.NewRequest("GET", baseURL+"/api/v1/tasks", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Task list succeed")

	var taskResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&taskResp)
	require.NoError(t, err)

	// Verify response structure
	assert.Contains(t, taskResp, "values", "Task list contain values array")
	assert.Contains(t, taskResp, "total", "Task list contain total count")

	t.Log("F2 Task response fields: PASS")
}

func TestF2_UserResponseFields(t *testing.T) {
	token, err := loginHelper()
	require.NoError(t, err)
	require.NotEmpty(t, token)

	req, _ := http.NewRequest("GET", baseURL+"/api/v1/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "User profile succeed")

	var userResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&userResp)
	require.NoError(t, err)

	// Verify required fields (matching legacy TheHive 4 user response)
	requiredFields := []string{"login", "name", "organisation"}
	for _, field := range requiredFields {
		assert.Contains(t, userResp, field, fmt.Sprintf("User response contain field: %s", field))
	}

	t.Log("F2 User response fields: PASS")
}

func TestF2_DescribeAPIFields(t *testing.T) {
	token, err := loginHelper()
	require.NoError(t, err)
	require.NotEmpty(t, token)

	req, _ := http.NewRequest("GET", baseURL+"/api/v1/describe/case", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Describe API succeed")

	var descResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&descResp)
	require.NoError(t, err)

	// Verify describe response structure
	assert.Contains(t, descResp, "fields", "Describe response contain fields array")

	t.Log("F2 Describe API fields: PASS")
}
