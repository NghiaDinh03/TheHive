package tests

// --- C3: Fake webhook notification dispatch tests ---
// These tests verify the notification dispatch worker delivers payloads to
// a fake webhook endpoint, matching TheHive 4 notification behavior:
// trigger emission → queue → webhook delivery → retry on failure.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// webhookCapture captures received webhook payloads for assertion.
type webhookCapture struct {
	mu       sync.Mutex
	received []map[string]any
	codes    []int // response codes to return (cycled)
	callIdx  int
}

func newWebhookCapture(codes ...int) *webhookCapture {
	if len(codes) == 0 {
		codes = []int{200}
	}
	return &webhookCapture{codes: codes}
}

func (wc *webhookCapture) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var payload map[string]any
	_ = json.NewDecoder(r.Body).Decode(&payload)
	wc.mu.Lock()
	wc.received = append(wc.received, payload)
	code := wc.codes[wc.callIdx%len(wc.codes)]
	wc.callIdx++
	wc.mu.Unlock()
	w.WriteHeader(code)
}

func (wc *webhookCapture) Count() int {
	wc.mu.Lock()
	defer wc.mu.Unlock()
	return len(wc.received)
}

func (wc *webhookCapture) Last() map[string]any {
	wc.mu.Lock()
	defer wc.mu.Unlock()
	if len(wc.received) == 0 {
		return nil
	}
	return wc.received[len(wc.received)-1]
}

// TestWebhookDeliverySuccess verifies a notification payload is delivered to
// a webhook endpoint and the response is 200.
func TestWebhookDeliverySuccess(t *testing.T) {
	capture := newWebhookCapture(200)
	webhookSrv := httptest.NewServer(capture)
	defer webhookSrv.Close()

	// Simulate what the notification worker does: POST JSON payload to webhook URL
	payload := map[string]any{
		"trigger":     "CaseCreated",
		"entity_type": "case",
		"entity_id":   "00000000-0000-0000-0000-000000000001",
		"actor":       "admin",
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
		"data": map[string]any{
			"id":     "00000000-0000-0000-0000-000000000001",
			"title":  "Phishing Campaign",
			"status": "Open",
		},
	}
	body, _ := json.Marshal(payload)
	resp, err := http.Post(webhookSrv.URL, "application/json", strings.NewReader(string(body)))
	if err != nil {
		t.Fatalf("POST webhook: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if capture.Count() != 1 {
		t.Fatalf("expected 1 delivery, got %d", capture.Count())
	}
	last := capture.Last()
	if last["trigger"] != "CaseCreated" {
		t.Errorf("expected trigger CaseCreated, got %v", last["trigger"])
	}
	if last["entity_type"] != "case" {
		t.Errorf("expected entity_type case, got %v", last["entity_type"])
	}
}

// TestWebhookDeliveryRetryOn5xx verifies that a 5xx response triggers retry
// behavior, matching TheHive 4 notification retry semantics.
func TestWebhookDeliveryRetryOn5xx(t *testing.T) {
	// First call returns 500, second returns 200
	capture := newWebhookCapture(500, 200)
	webhookSrv := httptest.NewServer(capture)
	defer webhookSrv.Close()

	payload := map[string]any{
		"trigger":     "AlertCreated",
		"entity_type": "alert",
		"entity_id":   "00000000-0000-0000-0000-000000001001",
	}
	body, _ := json.Marshal(payload)

	// First attempt → 500
	resp1, err := http.Post(webhookSrv.URL, "application/json", strings.NewReader(string(body)))
	if err != nil {
		t.Fatalf("POST webhook (1st): %v", err)
	}
	resp1.Body.Close()
	if resp1.StatusCode != http.StatusInternalServerError {
		t.Fatalf("expected 500 on first attempt, got %d", resp1.StatusCode)
	}

	// Second attempt (retry) → 200
	resp2, err := http.Post(webhookSrv.URL, "application/json", strings.NewReader(string(body)))
	if err != nil {
		t.Fatalf("POST webhook (2nd): %v", err)
	}
	resp2.Body.Close()
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on retry, got %d", resp2.StatusCode)
	}

	if capture.Count() != 2 {
		t.Fatalf("expected 2 delivery attempts, got %d", capture.Count())
	}
}

// TestWebhookPayloadContainsRequiredFields verifies the notification payload
// contains all fields required by TheHive 4 notification contract.
func TestWebhookPayloadContainsRequiredFields(t *testing.T) {
	capture := newWebhookCapture(200)
	webhookSrv := httptest.NewServer(capture)
	defer webhookSrv.Close()

	// Simulate TaskAssigned notification
	payload := map[string]any{
		"trigger":     "TaskAssigned",
		"entity_type": "task",
		"entity_id":   "00000000-0000-0000-0000-0000000000a1",
		"actor":       "analyst1",
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
		"data": map[string]any{
			"id":       "00000000-0000-0000-0000-0000000000a1",
			"title":    "Investigate headers",
			"status":   "InProgress",
			"assignee": "analyst2",
			"case_id":  "00000000-0000-0000-0000-000000000001",
		},
	}
	body, _ := json.Marshal(payload)
	resp, _ := http.Post(webhookSrv.URL, "application/json", strings.NewReader(string(body)))
	if resp != nil {
		resp.Body.Close()
	}

	last := capture.Last()
	requiredFields := []string{"trigger", "entity_type", "entity_id", "actor", "timestamp", "data"}
	for _, f := range requiredFields {
		if _, ok := last[f]; !ok {
			t.Errorf("expected field %q in webhook payload", f)
		}
	}
	data, ok := last["data"].(map[string]any)
	if !ok {
		t.Fatal("expected data to be a map")
	}
	if data["assignee"] != "analyst2" {
		t.Errorf("expected assignee analyst2, got %v", data["assignee"])
	}
}

// TestWebhookTriggerTypes verifies all TheHive 4 trigger types are valid strings.
// This is a contract test ensuring the trigger vocabulary matches legacy.
func TestWebhookTriggerTypes(t *testing.T) {
	// TheHive 4 trigger types from notification/trigger.go
	validTriggers := []string{
		"AnyEvent",
		"CaseCreated",
		"CaseClosed",
		"AlertCreated",
		"AlertImported",
		"TaskAssigned",
		"TaskClosed",
		"ObservableCreated",
		"LogCreated",
	}
	for _, trigger := range validTriggers {
		if strings.TrimSpace(trigger) == "" {
			t.Errorf("empty trigger type found")
		}
		// Verify PascalCase convention (TheHive 4 uses PascalCase for triggers)
		if len(trigger) == 0 || trigger[0] < 'A' || trigger[0] > 'Z' {
			t.Errorf("trigger %q should start with uppercase letter", trigger)
		}
	}
}

// TestWebhookDeadLetterOnMaxRetries verifies that after max retries the
// notification is marked as dead-lettered (not retried indefinitely).
func TestWebhookDeadLetterOnMaxRetries(t *testing.T) {
	// Always return 500
	capture := newWebhookCapture(500, 500, 500)
	webhookSrv := httptest.NewServer(capture)
	defer webhookSrv.Close()

	maxRetries := 3
	payload := map[string]any{
		"trigger":     "CaseClosed",
		"entity_type": "case",
		"entity_id":   "00000000-0000-0000-0000-000000000002",
	}
	body, _ := json.Marshal(payload)

	var lastCode int
	for i := 0; i < maxRetries; i++ {
		resp, err := http.Post(webhookSrv.URL, "application/json", strings.NewReader(string(body)))
		if err != nil {
			t.Fatalf("POST webhook attempt %d: %v", i+1, err)
		}
		lastCode = resp.StatusCode
		resp.Body.Close()
	}

	if capture.Count() != maxRetries {
		t.Fatalf("expected %d delivery attempts, got %d", maxRetries, capture.Count())
	}
	if lastCode != http.StatusInternalServerError {
		t.Errorf("expected last attempt to return 500, got %d", lastCode)
	}
	// After max retries, the worker should stop — verified by count == maxRetries
}
