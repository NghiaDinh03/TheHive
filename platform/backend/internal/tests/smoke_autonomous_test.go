package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAutonomousResponseLifecycle(t *testing.T) {
	loginReq := map[string]string{
		"login":    "ncs_admin@ncsgroup.vn",
		"password": "12345@",
	}
	bodyBytes, _ := json.Marshal(loginReq)
	respLogin, err := http.Post(baseURL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(bodyBytes))
	require.NoError(t, err, "login request should succeed")
	defer respLogin.Body.Close()

	var loginResp struct {
		Token     string `json:"token"`
		CSRFToken string `json:"csrf_token"`
	}
	err = json.NewDecoder(respLogin.Body).Decode(&loginResp)
	require.NoError(t, err, "decode login response should succeed")
	require.NotEmpty(t, loginResp.Token, "token should not be empty")
	require.NotEmpty(t, loginResp.CSRFToken, "csrf_token should not be empty")

	token := loginResp.Token
	csrfToken := loginResp.CSRFToken
	ruleName := fmt.Sprintf("Tự động cô lập IP độc hại test %d", time.Now().UnixNano())
	ruleNameUpdated := ruleName + " updated"

	client := &http.Client{Timeout: 10 * time.Second}

	// 1. Tạo một mock n8n SOAR server để hứng webhook trigger
	var wg sync.WaitGroup
	var receivedPayload map[string]any
	var mu sync.Mutex

	mockSOAR := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
		
		var payload map[string]any
		err := json.NewDecoder(r.Body).Decode(&payload)
		if err == nil {
			receivedPayload = payload
		}
		
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"isolated","ip":"1.2.3.4"}`))
		
		wg.Done()
	}))
	defer mockSOAR.Close()

	// 2. Test Tạo Rule qua REST API
	ruleReq := map[string]any{
		"name":                   ruleName,
		"description":            "Quy tắc chặn IP từ CyberAI",
		"observable_type":        "ip",
		"threat_score_threshold": 80,
		"webhook_url":            strings.Replace(mockSOAR.URL, "127.0.0.1", "host.docker.internal", 1),
		"is_active":              true,
	}
	body, _ := json.Marshal(ruleReq)
	req, _ := http.NewRequest("POST", baseURL+"/api/v1/admin/autonomous/rules", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-CSRF-Token", csrfToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var ruleResp map[string]any
	err = json.NewDecoder(resp.Body).Decode(&ruleResp)
	require.NoError(t, err)
	ruleID := ruleResp["id"].(string)
	assert.NotEmpty(t, ruleID)

	// 3. Test List Rules
	req, _ = http.NewRequest("GET", baseURL+"/api/v1/admin/autonomous/rules", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err = client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	
	var rules []map[string]any
	err = json.NewDecoder(resp.Body).Decode(&rules)
	require.NoError(t, err)
	assert.True(t, len(rules) > 0)

	// 4. Test Update Rule
	ruleReq["name"] = ruleNameUpdated
	body, _ = json.Marshal(ruleReq)
	req, _ = http.NewRequest("PUT", baseURL+"/api/v1/admin/autonomous/rules/"+ruleID, bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-CSRF-Token", csrfToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err = client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// 5. Trigger Webhook bằng cách tạo một Observable mới có malicious_score cao
	// Đầu tiên, lấy ID của một case đang có trong DB để gán observable
	req, _ = http.NewRequest("GET", baseURL+"/api/v1/cases?limit=1", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err = client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var casesResp struct {
		Cases []map[string]any `json:"values"`
	}
	err = json.NewDecoder(resp.Body).Decode(&casesResp)
	require.NoError(t, err)
	
	var caseID string
	if len(casesResp.Cases) > 0 {
		caseID = casesResp.Cases[0]["id"].(string)
	} else {
		caseReq := map[string]interface{}{
			"title":       "NCS SOC: Case test cho Autonomous Response",
			"description": "Case tự động tạo bởi Smoke Test để kiểm tra cơ chế tự động phản ứng SOAR",
			"severity":    2,
			"tlp":         2,
			"pap":         2,
			"tags":        []string{"autonomous-test"},
			"owner":       "ncs_admin@ncsgroup.vn",
		}
		caseBody, _ := json.Marshal(caseReq)
		reqCreateCase, _ := http.NewRequest("POST", baseURL+"/api/v1/cases", bytes.NewBuffer(caseBody))
		reqCreateCase.Header.Set("Authorization", "Bearer "+token)
		reqCreateCase.Header.Set("X-CSRF-Token", csrfToken)
		reqCreateCase.Header.Set("Content-Type", "application/json")
		
		respCreateCase, errCreate := client.Do(reqCreateCase)
		require.NoError(t, errCreate)
		defer respCreateCase.Body.Close()
		require.Equal(t, http.StatusCreated, respCreateCase.StatusCode, "should successfully create a case")
		
		var newCaseResp struct {
			ID string `json:"id"`
		}
		err = json.NewDecoder(respCreateCase.Body).Decode(&newCaseResp)
		require.NoError(t, err)
		caseID = newCaseResp.ID
	}

	// Thực hiện tạo observable và mong đợi mock server SOAR nhận được trigger
	wg.Add(1)
	obsReq := map[string]any{
		"case_id":         caseID,
		"data_type":       "ip",
		"data":            "1.2.3.4",
		"message":         "Phát hiện IP độc hại từ IPS logs",
		"tlp":             3,
		"ioc":             true,
		"sighted":         true,
		"malicious_score": 85, // Vượt ngưỡng 80
	}
	body, _ = json.Marshal(obsReq)
	req, _ = http.NewRequest("POST", baseURL+"/api/v1/observables", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-CSRF-Token", csrfToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err = client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var obsResp map[string]any
	err = json.NewDecoder(resp.Body).Decode(&obsResp)
	require.NoError(t, err)
	obsID := obsResp["id"].(string)
	assert.NotEmpty(t, obsID)

	// Chờ mock server nhận được trigger (timeout 5s)
	c := make(chan struct{})
	go func() {
		wg.Wait()
		close(c)
	}()

	select {
	case <-c:
		// Thành công
	case <-time.After(5 * time.Second):
		t.Fatal("timeout waiting for n8n Webhook trigger")
	}

	// Xác minh payload nhận được
	mu.Lock()
	assert.Equal(t, "threat_hunting_alert", receivedPayload["event"])
	assert.Equal(t, "1.2.3.4", receivedPayload["observable_value"])
	assert.Equal(t, "ip", receivedPayload["observable_type"])
	assert.Equal(t, float64(85), receivedPayload["threat_score"])
	mu.Unlock()

	// 6. Test List Logs qua REST API và kiểm tra trạng thái Success
	// Chờ 500ms để goroutine cập nhật log status trong DB hoàn thành
	time.Sleep(500 * time.Millisecond)

	req, _ = http.NewRequest("GET", baseURL+"/api/v1/admin/autonomous/logs", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err = client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var logs []map[string]any
	err = json.NewDecoder(resp.Body).Decode(&logs)
	require.NoError(t, err)
	assert.True(t, len(logs) > 0, "should record at least one response log")
	
	// Tìm log tương ứng
	var foundLog map[string]any
	for _, l := range logs {
		if l["rule_name"].(string) == ruleNameUpdated {
			foundLog = l
			break
		}
	}
	require.NotNil(t, foundLog)
	assert.Equal(t, "Success", foundLog["status"])
	assert.Contains(t, foundLog["response_payload"].(string), `"status":"isolated"`)

	// 6.5. Test Kích hoạt thủ công SOAR Playbook qua REST API
	wg.Add(1) // chuẩn bị mockSOAR nhận thêm request trigger thủ công
	
	manualReq := map[string]any{
		"rule_id":       ruleID,
		"observable_id": obsID,
		"task_id":       "", // không cần task_id trong test này
	}
	manualBody, _ := json.Marshal(manualReq)
	req, _ = http.NewRequest("POST", baseURL+"/api/v1/autonomous/trigger-manual", bytes.NewBuffer(manualBody))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-CSRF-Token", csrfToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err = client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var manualResp map[string]any
	err = json.NewDecoder(resp.Body).Decode(&manualResp)
	require.NoError(t, err)
	assert.Equal(t, "triggered", manualResp["status"])

	// Chờ mock server nhận được trigger thủ công (timeout 5s)
	cManual := make(chan struct{})
	go func() {
		wg.Wait()
		close(cManual)
	}()

	select {
	case <-cManual:
		// Thành công
	case <-time.After(5 * time.Second):
		t.Fatal("timeout waiting for manual SOAR Playbook trigger")
	}

	mu.Lock()
	assert.Equal(t, "manual_response_trigger", receivedPayload["event"])
	assert.Equal(t, "1.2.3.4", receivedPayload["observable_value"])
	assert.Equal(t, "ip", receivedPayload["observable_type"])
	mu.Unlock()

	// 7. Cleanup: Delete Rule
	req, _ = http.NewRequest("DELETE", baseURL+"/api/v1/admin/autonomous/rules/"+ruleID, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-CSRF-Token", csrfToken)
	resp, err = client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	fmt.Println("Autonomous response test pass successfully!")
}
