package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A2 Core SOC Workflow Smoke Tests
// These tests verify the end-to-end analyst workflow

const (
	baseURL     = "http://localhost:8080"
	frontendURL = "http://localhost:3000"
)

var (
	adminToken       string
	testCaseID       string
	testTaskID       string
	testObservableID string
)

// TestA2_LoginAndAuth verifies login and profile loading
func TestA2_LoginAndAuth(t *testing.T) {
	loginReq := map[string]string{
		"login":    "admin@thehive.local",
		"password": "secret",
	}
	body, _ := json.Marshal(loginReq)

	resp, err := http.Post(baseURL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(body))
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Login should succeed")

	var loginResp struct {
		Token string `json:"token"`
		User  struct {
			Login string `json:"login"`
			Name  string `json:"name"`
		} `json:"user"`
	}
	err = json.NewDecoder(resp.Body).Decode(&loginResp)
	require.NoError(t, err)

	require.NotEmpty(t, loginResp.Token, "Token should be returned")
	adminToken = loginResp.Token

	t.Logf("Login successful for user: %s", loginResp.User.Login)

	req, _ := http.NewRequest("GET", baseURL+"/api/v1/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Profile should load")
	t.Log("Profile loaded successfully")
}

// TestA2_CaseCreate verifies case creation
func TestA2_CaseCreate(t *testing.T) {
	if adminToken == "" {
		t.Skip("Skipping: no auth token")
	}

	caseReq := map[string]interface{}{
		"title":       "A2 Smoke Test Case",
		"description": "Test case created by A2 smoke test",
		"severity":    2,
		"tlp":         2,
		"pap":         2,
		"tags":        []string{"smoke-test", "a2"},
		"owner":       "admin@thehive.local",
	}
	body, _ := json.Marshal(caseReq)

	req, _ := http.NewRequest("POST", baseURL+"/api/v1/cases", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode, "Case should be created")

	var caseResp struct {
		ID     string `json:"id"`
		Number int    `json:"number"`
		Title  string `json:"title"`
		Status string `json:"status"`
	}
	err = json.NewDecoder(resp.Body).Decode(&caseResp)
	require.NoError(t, err)

	testCaseID = caseResp.ID
	require.NotEmpty(t, testCaseID, "Case ID should be returned")
	assert.Equal(t, "Open", caseResp.Status, "New case should be Open")

	t.Logf("Case created: #%d (%s)", caseResp.Number, testCaseID)
}

// TestA2_CaseOpen verifies case can be opened
func TestA2_CaseOpen(t *testing.T) {
	if testCaseID == "" {
		t.Skip("Skipping: no test case")
	}

	req, _ := http.NewRequest("GET", baseURL+"/api/v1/cases/"+testCaseID, nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Case should be accessible")

	var caseDetail struct {
		Case struct {
			ID          string `json:"id"`
			Title       string `json:"title"`
			Description string `json:"description"`
			Status      string `json:"status"`
		} `json:"case"`
	}
	err = json.NewDecoder(resp.Body).Decode(&caseDetail)
	require.NoError(t, err)

	assert.Equal(t, testCaseID, caseDetail.Case.ID, "Case ID should match")
	t.Logf("Case opened: %s", caseDetail.Case.Title)
}

// TestA2_TaskLifecycle verifies task creation and lifecycle
func TestA2_TaskLifecycle(t *testing.T) {
	if testCaseID == "" {
		t.Skip("Skipping: no test case")
	}

	taskReq := map[string]interface{}{
		"case_id":     testCaseID,
		"title":       "A2 Smoke Test Task",
		"description": "Test task",
		"group_name":  "smoke",
	}
	body, _ := json.Marshal(taskReq)

	req, _ := http.NewRequest("POST", baseURL+"/api/v1/tasks", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode, "Task should be created")

	var taskResp struct {
		ID     string `json:"id"`
		Title  string `json:"title"`
		Status string `json:"status"`
	}
	err = json.NewDecoder(resp.Body).Decode(&taskResp)
	require.NoError(t, err)

	testTaskID = taskResp.ID
	require.NotEmpty(t, testTaskID)
	assert.Equal(t, "Waiting", taskResp.Status, "New task should be Waiting")
	t.Logf("Task created: %s (%s)", taskResp.Title, testTaskID)

	req, _ = http.NewRequest("POST", baseURL+"/api/v1/tasks/"+testTaskID+"/start", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Task should start")
	t.Log("Task started")

	req, _ = http.NewRequest("POST", baseURL+"/api/v1/tasks/"+testTaskID+"/close", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Task should close")
	t.Log("Task closed")
}

// TestA2_ObservableToggles verifies observable creation and toggles
func TestA2_ObservableToggles(t *testing.T) {
	if testCaseID == "" {
		t.Skip("Skipping: no test case")
	}

	obsReq := map[string]interface{}{
		"case_id":   testCaseID,
		"data_type": "ip",
		"data":      "192.168.1.1",
		"message":   "Test observable",
		"tlp":       2,
		"ioc":       false,
		"sighted":   false,
		"tags":      []string{"smoke-test"},
	}
	body, _ := json.Marshal(obsReq)

	req, _ := http.NewRequest("POST", baseURL+"/api/v1/observables", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode, "Observable should be created")

	var obsResp struct {
		ID      string `json:"id"`
		Data    string `json:"data"`
		IOC     bool   `json:"ioc"`
		Sighted bool   `json:"sighted"`
	}
	err = json.NewDecoder(resp.Body).Decode(&obsResp)
	require.NoError(t, err)

	testObservableID = obsResp.ID
	require.NotEmpty(t, testObservableID)
	t.Logf("Observable created: %s", obsResp.Data)

	patchReq := map[string]bool{"ioc": true}
	body, _ = json.Marshal(patchReq)

	req, _ = http.NewRequest("PATCH", baseURL+"/api/v1/observables/"+testObservableID, bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "IOC should toggle")
	t.Log("IOC toggled")

	patchReq = map[string]bool{"sighted": true}
	body, _ = json.Marshal(patchReq)

	req, _ = http.NewRequest("PATCH", baseURL+"/api/v1/observables/"+testObservableID, bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Sighted should toggle")
	t.Log("Sighted toggled")
}

// TestA2_CaseCloseReopen verifies case close and reopen
func TestA2_CaseCloseReopen(t *testing.T) {
	if testCaseID == "" {
		t.Skip("Skipping: no test case")
	}

	closeReq := map[string]string{
		"impact_status":     "NoImpact",
		"resolution_status": "TruePositive",
		"summary":           "A2 smoke test closure",
	}
	body, _ := json.Marshal(closeReq)

	req, _ := http.NewRequest("POST", baseURL+"/api/v1/cases/"+testCaseID+"/close", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Case should close")
	t.Log("Case closed")

	req, _ = http.NewRequest("POST", baseURL+"/api/v1/cases/"+testCaseID+"/reopen", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Case should reopen")
	t.Log("Case reopened")
}

// TestA2_HealthEndpoints verifies health endpoints
func TestA2_HealthEndpoints(t *testing.T) {
	resp, err := http.Get(baseURL + "/readyz")
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode, "Backend should be ready")
	t.Log("Backend /readyz OK")

	resp, err = http.Get(frontendURL)
	require.NoError(t, err)
	defer resp.Body.Close()
	// Frontend may redirect (307) or return OK
	assert.True(t, resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusTemporaryRedirect || resp.StatusCode == http.StatusMovedPermanently,
		"Frontend should be accessible, got status: %d", resp.StatusCode)
	t.Log("Frontend accessible")
}

// TestMain handles setup and teardown
func TestMain(m *testing.M) {
	fmt.Println("=== A2 Core SOC Workflow Smoke Tests ===")
	fmt.Println("Testing against:", baseURL)
	fmt.Println()

	time.Sleep(100 * time.Millisecond)

	code := m.Run()

	fmt.Println()
	fmt.Println("=== Smoke Test Summary ===")
	if testCaseID != "" {
		fmt.Printf("Test case created: %s\n", testCaseID)
	}
	if testTaskID != "" {
		fmt.Printf("Test task created: %s\n", testTaskID)
	}
	if testObservableID != "" {
		fmt.Printf("Test observable created: %s\n", testObservableID)
	}

	os.Exit(code)
}
