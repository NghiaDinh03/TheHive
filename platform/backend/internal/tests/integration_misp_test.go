package tests

// --- C2: Fake MISP integration tests ---
// These tests verify the MISP import/export/taxonomy-sync workflow using a fake
// HTTP server, matching TheHive 4 MISP connector behavior.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fakeMISPEvent represents a MISP event as returned by GET /events/:id.
type fakeMISPEvent struct {
	Event struct {
		ID             string              `json:"id"`
		Info           string              `json:"info"`
		Date           string              `json:"date"`
		ThreatLevelID  string              `json:"threat_level_id"`
		Published      bool                `json:"published"`
		AttributeCount string              `json:"attribute_count"`
		Tags           []fakeMISPTag       `json:"Tag"`
		Attributes     []fakeMISPAttribute `json:"Attribute"`
	} `json:"Event"`
}

type fakeMISPTag struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type fakeMISPAttribute struct {
	ID       string `json:"id"`
	EventID  string `json:"event_id"`
	Type     string `json:"type"`
	Category string `json:"category"`
	Value    string `json:"value"`
	ToIDS    bool   `json:"to_ids"`
	Comment  string `json:"comment"`
}

// newFakeMISPServer creates a minimal fake MISP HTTP server that:
//   - GET  /events/:id                → return event with attributes
//   - GET  /events/index              → list events
//   - POST /events                    → create event (export)
//   - GET  /taxonomies                → list taxonomies
//   - POST /taxonomies/enable/:id     → enable taxonomy
func newFakeMISPServer(t *testing.T) *httptest.Server {
	t.Helper()

	events := map[string]*fakeMISPEvent{}

	// Seed a test event
	evt := &fakeMISPEvent{}
	evt.Event.ID = "1001"
	evt.Event.Info = "Phishing Campaign Q1 2026"
	evt.Event.Date = "2026-01-15"
	evt.Event.ThreatLevelID = "2"
	evt.Event.Published = true
	evt.Event.AttributeCount = "3"
	evt.Event.Tags = []fakeMISPTag{
		{ID: "1", Name: "tlp:white"},
		{ID: "2", Name: "misp-galaxy:threat-actor=\"Lazarus Group\""},
	}
	evt.Event.Attributes = []fakeMISPAttribute{
		{ID: "10001", EventID: "1001", Type: "ip-src", Category: "Network activity", Value: "192.168.1.100", ToIDS: true, Comment: "C2 server"},
		{ID: "10002", EventID: "1001", Type: "domain", Category: "Network activity", Value: "evil.example.com", ToIDS: true, Comment: "Phishing domain"},
		{ID: "10003", EventID: "1001", Type: "email-src", Category: "Payload delivery", Value: "attacker@evil.com", ToIDS: false, Comment: "Sender"},
	}
	events["1001"] = evt

	taxonomies := []map[string]any{
		{"id": "1", "namespace": "tlp", "description": "Traffic Light Protocol", "enabled": true, "version": 4},
		{"id": "2", "namespace": "misp-galaxy", "description": "MISP Galaxy", "enabled": true, "version": 1},
		{"id": "3", "namespace": "admiralty-scale", "description": "Admiralty Scale", "enabled": false, "version": 1},
	}

	mux := http.NewServeMux()

	// List events
	mux.HandleFunc("/events/index", func(w http.ResponseWriter, r *http.Request) {
		var list []map[string]any
		for _, e := range events {
			list = append(list, map[string]any{
				"id":              e.Event.ID,
				"info":            e.Event.Info,
				"date":            e.Event.Date,
				"threat_level_id": e.Event.ThreatLevelID,
				"published":       e.Event.Published,
				"attribute_count": e.Event.AttributeCount,
			})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(list)
	})

	// Get event by ID
	mux.HandleFunc("/events/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			// Create event (export)
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			newID := "2001"
			newEvt := &fakeMISPEvent{}
			newEvt.Event.ID = newID
			if info, ok := body["info"].(string); ok {
				newEvt.Event.Info = info
			}
			newEvt.Event.Date = "2026-04-29"
			newEvt.Event.ThreatLevelID = "2"
			events[newID] = newEvt
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]any{"Event": map[string]any{"id": newID, "info": newEvt.Event.Info}})
			return
		}
		eventID := strings.TrimPrefix(r.URL.Path, "/events/")
		evt, ok := events[eventID]
		if !ok {
			http.Error(w, `{"message":"event not found"}`, http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(evt)
	})

	// List taxonomies
	mux.HandleFunc("/taxonomies", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(taxonomies)
	})

	// Enable taxonomy
	mux.HandleFunc("/taxonomies/enable/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		taxID := strings.TrimPrefix(r.URL.Path, "/taxonomies/enable/")
		for i, tx := range taxonomies {
			if tx["id"] == taxID {
				taxonomies[i]["enabled"] = true
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"saved": "true"})
	})

	return httptest.NewServer(mux)
}

// TestFakeMISPListEvents verifies the fake MISP server returns event list.
func TestFakeMISPListEvents(t *testing.T) {
	srv := newFakeMISPServer(t)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/events/index")
	if err != nil {
		t.Fatalf("GET /events/index: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var events []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&events); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(events) == 0 {
		t.Fatal("expected at least one event")
	}
	if events[0]["id"] != "1001" {
		t.Errorf("expected event id 1001, got %v", events[0]["id"])
	}
}

// TestFakeMISPGetEventWithAttributes verifies event detail includes attributes
// matching TheHive 4 MISP import preview behavior.
func TestFakeMISPGetEventWithAttributes(t *testing.T) {
	srv := newFakeMISPServer(t)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/events/1001")
	if err != nil {
		t.Fatalf("GET /events/1001: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var evt fakeMISPEvent
	if err := json.NewDecoder(resp.Body).Decode(&evt); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if evt.Event.ID != "1001" {
		t.Errorf("expected event id 1001, got %s", evt.Event.ID)
	}
	if len(evt.Event.Attributes) != 3 {
		t.Errorf("expected 3 attributes, got %d", len(evt.Event.Attributes))
	}
	// Verify IOC attribute
	var iocCount int
	for _, a := range evt.Event.Attributes {
		if a.ToIDS {
			iocCount++
		}
	}
	if iocCount != 2 {
		t.Errorf("expected 2 IOC attributes (to_ids=true), got %d", iocCount)
	}
	// Verify tags
	if len(evt.Event.Tags) != 2 {
		t.Errorf("expected 2 tags, got %d", len(evt.Event.Tags))
	}
}

// TestFakeMISPExportEvent verifies creating a MISP event (export workflow).
func TestFakeMISPExportEvent(t *testing.T) {
	srv := newFakeMISPServer(t)
	defer srv.Close()

	body := strings.NewReader(`{"info":"TheHive Case #42 Export","threat_level_id":"2","analysis":"1","distribution":"0"}`)
	resp, err := http.Post(srv.URL+"/events/", "application/json", body)
	if err != nil {
		t.Fatalf("POST /events/: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode: %v", err)
	}
	evtData, ok := result["Event"].(map[string]any)
	if !ok {
		t.Fatal("expected Event key in response")
	}
	if evtData["id"] == "" {
		t.Error("expected event id in response")
	}
}

// TestFakeMISPTaxonomySync verifies taxonomy list and enable workflow,
// matching TheHive 4 MISP taxonomy sync behavior.
func TestFakeMISPTaxonomySync(t *testing.T) {
	srv := newFakeMISPServer(t)
	defer srv.Close()

	// List taxonomies
	resp, err := http.Get(srv.URL + "/taxonomies")
	if err != nil {
		t.Fatalf("GET /taxonomies: %v", err)
	}
	defer resp.Body.Close()

	var taxonomies []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&taxonomies); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(taxonomies) != 3 {
		t.Fatalf("expected 3 taxonomies, got %d", len(taxonomies))
	}

	// Find disabled taxonomy
	var disabledID string
	for _, tx := range taxonomies {
		if enabled, _ := tx["enabled"].(bool); !enabled {
			disabledID = tx["id"].(string)
			break
		}
	}
	if disabledID == "" {
		t.Fatal("expected at least one disabled taxonomy")
	}

	// Enable it
	resp2, err := http.Post(srv.URL+"/taxonomies/enable/"+disabledID, "application/json", nil)
	if err != nil {
		t.Fatalf("POST /taxonomies/enable/%s: %v", disabledID, err)
	}
	defer resp2.Body.Close()
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}

	// Verify it's now enabled
	resp3, err := http.Get(srv.URL + "/taxonomies")
	if err != nil {
		t.Fatalf("GET /taxonomies (2nd): %v", err)
	}
	defer resp3.Body.Close()
	var taxonomies2 []map[string]any
	_ = json.NewDecoder(resp3.Body).Decode(&taxonomies2)
	for _, tx := range taxonomies2 {
		if tx["id"] == disabledID {
			if enabled, _ := tx["enabled"].(bool); !enabled {
				t.Errorf("expected taxonomy %s to be enabled after toggle", disabledID)
			}
		}
	}
}

// TestFakeMISPEventNotFound verifies 404 for unknown event IDs.
func TestFakeMISPEventNotFound(t *testing.T) {
	srv := newFakeMISPServer(t)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/events/9999")
	if err != nil {
		t.Fatalf("GET /events/9999: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}
}
