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

func TestCyberAI_AdminSettingsAndStatus(t *testing.T) {
	if adminToken == "" {
		t.Skip("Skipping: no auth token (run TestA2_LoginAndAuth first)")
	}

	// 1. Test POST /api/v1/admin/settings to save config
	payload := map[string]string{
		"cyberai_api_url": "http://cyber-ai-service:8000",
		"cyberai_model":   "gemma-4-31B-it-Q3_K_M.gguf",
		"openai_model":    "gpt-4o",
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", baseURL+"/api/v1/admin/settings", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	resp.Body.Close()

	// 2. Test GET /api/v1/admin/settings to verify config was saved
	req2, _ := http.NewRequest("GET", baseURL+"/api/v1/admin/settings", nil)
	req2.Header.Set("Authorization", "Bearer "+adminToken)
	resp2, err := http.DefaultClient.Do(req2)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp2.StatusCode)

	var settings map[string]string
	err = json.NewDecoder(resp2.Body).Decode(&settings)
	require.NoError(t, err)
	resp2.Body.Close()

	assert.Equal(t, "http://cyber-ai-service:8000", settings["cyberai_api_url"])
	assert.Equal(t, "gemma-4-31B-it-Q3_K_M.gguf", settings["cyberai_model"])
	assert.Equal(t, "gpt-4o", settings["openai_model"])

	// 3. Test GET /api/v1/admin/settings/ai-status
	req3, _ := http.NewRequest("GET", baseURL+"/api/v1/admin/settings/ai-status", nil)
	req3.Header.Set("Authorization", "Bearer "+adminToken)
	resp3, err := http.DefaultClient.Do(req3)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp3.StatusCode)

	var status map[string]interface{}
	err = json.NewDecoder(resp3.Body).Decode(&status)
	require.NoError(t, err)
	resp3.Body.Close()

	assert.Contains(t, status, "status")
	assert.Contains(t, status, "provider")
	t.Logf("AI Integrations Health Status: %s (provider: %s)", status["status"], status["provider"])

	fmt.Println("CyberAI Admin settings and status integrations test: PASS")
}

func TestCyberAI_IncidentAnalysis(t *testing.T) {
	if adminToken == "" {
		t.Skip("Skipping: no auth token (run TestA2_LoginAndAuth first)")
	}

	// 1. Save correct host docker gateway endpoint url for integration
	payload := map[string]string{
		"cyberai_api_url": "http://host.docker.internal:8000",
		"cyberai_model":   "gemma4:latest",
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", baseURL+"/api/v1/admin/settings", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	resp.Body.Close()

	// 2. Call POST /api/v1/cases/:id/ai-analyze
	caseID := "10000000-0000-0000-0000-000000000040" // Ransomware sample case
	reqAnalyze, _ := http.NewRequest("POST", baseURL+"/api/v1/cases/"+caseID+"/ai-analyze", nil)
	reqAnalyze.Header.Set("Authorization", "Bearer "+adminToken)

	respAnalyze, err := http.DefaultClient.Do(reqAnalyze)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, respAnalyze.StatusCode)

	var analysisResult map[string]interface{}
	err = json.NewDecoder(respAnalyze.Body).Decode(&analysisResult)
	require.NoError(t, err)
	respAnalyze.Body.Close()

	assert.Contains(t, analysisResult, "threat_analysis")
	assert.Contains(t, analysisResult, "risk_rating")
	assert.Contains(t, analysisResult, "containment_recommendations")

	t.Logf("CyberAI Analysis Risk Rating: %v", analysisResult["risk_rating"])
	t.Logf("CyberAI Threat Analysis Details: %v", analysisResult["threat_analysis"])
	fmt.Println("CyberAI Analysis Incident Triage integrations test: PASS")
}

