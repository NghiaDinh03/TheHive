package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// F5 Performance Baseline Comparison
// Benchmarks key API endpoints compares response times.

func TestF5_PerformanceBaseline_Login(t *testing.T) {
	loginReq := map[string]string{
		"login":    "admin@thehive.local",
		"password": "12345@",
	}
	body, _ := json.Marshal(loginReq)

	// Warm up
	req, _ := http.NewRequest("POST", baseURL+"/api/v1/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()

	// Benchmark
	iterations := 10
	totalDuration := time.Duration(0)

	for i := 0; i < iterations; i++ {
		start := time.Now()
		req, _ := http.NewRequest("POST", baseURL+"/api/v1/auth/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		resp.Body.Close()
		totalDuration += time.Since(start)
	}

	avgDuration := totalDuration / time.Duration(iterations)
	t.Logf("Login average response time: %v (over %d iterations)", avgDuration, iterations)

	// Assert reasonable performance (under 500ms average)
	assert.Less(t, avgDuration.Milliseconds(), int64(500), "Login respond within 500ms")

	t.Log("F5 Performance baseline login: PASS")
}

func TestF5_PerformanceBaseline_CaseList(t *testing.T) {
	token, err := loginHelper()
	require.NoError(t, err)
	require.NotEmpty(t, token)

	// Warm up
	req, _ := http.NewRequest("GET", baseURL+"/api/v1/cases", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()

	// Benchmark
	iterations := 10
	totalDuration := time.Duration(0)

	for i := 0; i < iterations; i++ {
		start := time.Now()
		req, _ := http.NewRequest("GET", baseURL+"/api/v1/cases", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		resp.Body.Close()
		totalDuration += time.Since(start)
	}

	avgDuration := totalDuration / time.Duration(iterations)
	t.Logf("Case list average response time: %v (over %d iterations)", avgDuration, iterations)

	// Assert reasonable performance (under 500ms average)
	assert.Less(t, avgDuration.Milliseconds(), int64(500), "Case list respond within 500ms")

	t.Log("F5 Performance baseline case list: PASS")
}

func TestF5_PerformanceBaseline_AlertList(t *testing.T) {
	token, err := loginHelper()
	require.NoError(t, err)
	require.NotEmpty(t, token)

	// Warm up
	req, _ := http.NewRequest("GET", baseURL+"/api/v1/alerts", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()

	// Benchmark
	iterations := 10
	totalDuration := time.Duration(0)

	for i := 0; i < iterations; i++ {
		start := time.Now()
		req, _ := http.NewRequest("GET", baseURL+"/api/v1/alerts", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		resp.Body.Close()
		totalDuration += time.Since(start)
	}

	avgDuration := totalDuration / time.Duration(iterations)
	t.Logf("Alert list average response time: %v (over %d iterations)", avgDuration, iterations)

	// Assert reasonable performance (under 500ms average)
	assert.Less(t, avgDuration.Milliseconds(), int64(500), "Alert list respond within 500ms")

	t.Log("F5 Performance baseline alert list: PASS")
}

func TestF5_PerformanceBaseline_TaskList(t *testing.T) {
	token, err := loginHelper()
	require.NoError(t, err)
	require.NotEmpty(t, token)

	// Warm up
	req, _ := http.NewRequest("GET", baseURL+"/api/v1/tasks", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()

	// Benchmark
	iterations := 10
	totalDuration := time.Duration(0)

	for i := 0; i < iterations; i++ {
		start := time.Now()
		req, _ := http.NewRequest("GET", baseURL+"/api/v1/tasks", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		resp.Body.Close()
		totalDuration += time.Since(start)
	}

	avgDuration := totalDuration / time.Duration(iterations)
	t.Logf("Task list average response time: %v (over %d iterations)", avgDuration, iterations)

	// Assert reasonable performance (under 500ms average)
	assert.Less(t, avgDuration.Milliseconds(), int64(500), "Task list respond within 500ms")

	t.Log("F5 Performance baseline task list: PASS")
}

func TestF5_PerformanceBaseline_CaseCreate(t *testing.T) {
	token, err := loginHelper()
	require.NoError(t, err)
	require.NotEmpty(t, token)

	// Benchmark
	iterations := 5
	totalDuration := time.Duration(0)

	for i := 0; i < iterations; i++ {
		caseReq := map[string]interface{}{
			"title":       fmt.Sprintf("F5 Performance Test Case %d", i),
			"description": "Performance benchmark test",
			"severity":    1,
			"tlp":         2,
			"pap":         2,
		}
		body, _ := json.Marshal(caseReq)

		start := time.Now()
		req, _ := http.NewRequest("POST", baseURL+"/api/v1/cases", bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		resp.Body.Close()
		totalDuration += time.Since(start)
	}

	avgDuration := totalDuration / time.Duration(iterations)
	t.Logf("Case create average response time: %v (over %d iterations)", avgDuration, iterations)

	// Assert reasonable performance (under 1000ms average)
	assert.Less(t, avgDuration.Milliseconds(), int64(1000), "Case create respond within 1000ms")

	t.Log("F5 Performance baseline case create: PASS")
}

func TestF5_PerformanceBaseline_ConcurrentRequests(t *testing.T) {
	token, err := loginHelper()
	require.NoError(t, err)
	require.NotEmpty(t, token)

	// Test concurrent request handling
	concurrency := 10
	done := make(chan bool, concurrency)
	errors := make(chan error, concurrency)

	start := time.Now()

	for i := 0; i < concurrency; i++ {
		go func() {
			req, _ := http.NewRequest("GET", baseURL+"/api/v1/cases", nil)
			req.Header.Set("Authorization", "Bearer "+token)
			resp, err := http.DefaultClient.Do(req)
			if resp != nil {
				resp.Body.Close()
			}
			if err != nil {
				errors <- err
			}
			done <- true
		}()
	}

	// Wait all requests complete
	for i := 0; i < concurrency; i++ {
		<-done
	}

	totalDuration := time.Since(start)

	close(errors)
	errorCount := len(errors)

	t.Logf("Concurrent requests (%d) completed in: %v, errors: %d", concurrency, totalDuration, errorCount)

	// Assert no errors
	assert.Equal(t, 0, errorCount, "Concurrent requests not errors")

	// Assert reasonable total time (under 5 seconds 10 concurrent requests)
	assert.Less(t, totalDuration.Milliseconds(), int64(5000), "Concurrent requests complete within 5 seconds")

	t.Log("F5 Performance baseline concurrent requests: PASS")
}
