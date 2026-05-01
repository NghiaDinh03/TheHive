package misp

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"time"
)

// FakeServer is a test MISP server for CI/integration tests.
// It simulates MISP API endpoints for import preview, import, export, and taxonomy sync.
type FakeServer struct {
	mu     sync.Mutex
	server *httptest.Server

	// In-memory data
	events     map[string]*Event
	taxonomies []Taxonomy
	exportLog  []ExportLogEntry
}

// ExportLogEntry records an export operation.
type ExportLogEntry struct {
	CaseID    string    `json:"case_id"`
	EventID   string    `json:"event_id"`
	Exported  int       `json:"exported_count"`
	Timestamp time.Time `json:"timestamp"`
}

// NewFakeServer creates and starts a fake MISP test server.
func NewFakeServer() *FakeServer {
	fs := &FakeServer{
		events:     make(map[string]*Event),
		taxonomies: defaultTaxonomies(),
		exportLog:  []ExportLogEntry{},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/events/view/", fs.handleGetEvent)
	mux.HandleFunc("/events/add", fs.handleAddEvent)
	mux.HandleFunc("/events/index", fs.handleListEvents)
	mux.HandleFunc("/taxonomies", fs.handleListTaxonomies)
	mux.HandleFunc("/taxonomies/enable/", fs.handleEnableTaxonomy)
	mux.HandleFunc("/tags/search/", fs.handleSearchTags)

	fs.server = httptest.NewServer(mux)

	// Seed default test events
	fs.seedTestData()

	return fs
}

// URL returns the base URL of the fake server.
func (fs *FakeServer) URL() string {
	return fs.server.URL
}

// Close shuts down the fake server.
func (fs *FakeServer) Close() {
	fs.server.Close()
}

// GetExportLog returns the export log for assertions.
func (fs *FakeServer) GetExportLog() []ExportLogEntry {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	log := make([]ExportLogEntry, len(fs.exportLog))
	copy(log, fs.exportLog)
	return log
}

// GetEvent returns an event by ID for assertions.
func (fs *FakeServer) GetEvent(id string) *Event {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	return fs.events[id]
}

// AddEvent adds a test event to the fake server.
func (fs *FakeServer) AddEvent(event *Event) {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	fs.events[event.ID] = event
}

// --- HTTP Handlers ---

func (fs *FakeServer) handleGetEvent(w http.ResponseWriter, r *http.Request) {
	if !fs.checkAuth(r, w) {
		return
	}

	// Extract event ID from URL: /events/view/{id}
	parts := strings.Split(strings.TrimRight(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		http.Error(w, `{"error": "event ID required"}`, http.StatusBadRequest)
		return
	}
	eventID := parts[len(parts)-1]

	fs.mu.Lock()
	event, ok := fs.events[eventID]
	fs.mu.Unlock()

	if !ok {
		http.Error(w, `{"error": "event not found"}`, http.StatusNotFound)
		return
	}

	resp := map[string]interface{}{
		"Event": event,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (fs *FakeServer) handleAddEvent(w http.ResponseWriter, r *http.Request) {
	if !fs.checkAuth(r, w) {
		return
	}
	if r.Method != "POST" {
		http.Error(w, `{"error": "method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var body struct {
		Event struct {
			Info       string      `json:"info"`
			Date       string      `json:"date"`
			Attributes []Attribute `json:"Attribute"`
			Tags       []Tag       `json:"Tag"`
		} `json:"Event"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error": "invalid JSON"}`, http.StatusBadRequest)
		return
	}

	fs.mu.Lock()
	newID := strconv.Itoa(len(fs.events) + 100)
	event := &Event{
		ID:             newID,
		Info:           body.Event.Info,
		Date:           body.Event.Date,
		ThreatLevelID:  "2",
		Published:      false,
		Analysis:       "0",
		AttributeCount: strconv.Itoa(len(body.Event.Attributes)),
		Timestamp:      strconv.FormatInt(time.Now().Unix(), 10),
		Attributes:     body.Event.Attributes,
		Tags:           body.Event.Tags,
	}
	fs.events[newID] = event

	// Record export
	fs.exportLog = append(fs.exportLog, ExportLogEntry{
		EventID:   newID,
		Exported:  len(body.Event.Attributes),
		Timestamp: time.Now(),
	})
	fs.mu.Unlock()

	resp := map[string]interface{}{
		"Event": event,
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

func (fs *FakeServer) handleListEvents(w http.ResponseWriter, r *http.Request) {
	if !fs.checkAuth(r, w) {
		return
	}

	fs.mu.Lock()
	events := make([]*Event, 0, len(fs.events))
	for _, e := range fs.events {
		events = append(events, e)
	}
	fs.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}

func (fs *FakeServer) handleListTaxonomies(w http.ResponseWriter, r *http.Request) {
	if !fs.checkAuth(r, w) {
		return
	}

	fs.mu.Lock()
	taxonomies := make([]Taxonomy, len(fs.taxonomies))
	copy(taxonomies, fs.taxonomies)
	fs.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(taxonomies)
}

func (fs *FakeServer) handleEnableTaxonomy(w http.ResponseWriter, r *http.Request) {
	if !fs.checkAuth(r, w) {
		return
	}
	if r.Method != "POST" {
		http.Error(w, `{"error": "method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	parts := strings.Split(strings.TrimRight(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		http.Error(w, `{"error": "taxonomy ID required"}`, http.StatusBadRequest)
		return
	}
	taxID := parts[len(parts)-1]

	fs.mu.Lock()
	found := false
	for i, t := range fs.taxonomies {
		if t.ID == taxID {
			fs.taxonomies[i].Enabled = true
			found = true
			break
		}
	}
	fs.mu.Unlock()

	if !found {
		http.Error(w, `{"error": "taxonomy not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"message": "taxonomy %s enabled"}`, taxID)
}

func (fs *FakeServer) handleSearchTags(w http.ResponseWriter, r *http.Request) {
	if !fs.checkAuth(r, w) {
		return
	}

	// Return some fake tags matching the search
	tags := []Tag{
		{ID: "1", Name: "tlp:white"},
		{ID: "2", Name: "tlp:green"},
		{ID: "3", Name: "tlp:amber"},
		{ID: "4", Name: "tlp:red"},
		{ID: "5", Name: "type:malware"},
		{ID: "6", Name: "type:phishing"},
		{ID: "7", Name: "misp-galaxy:threat-actor=\"APT28\""},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tags)
}

// checkAuth validates the Authorization header.
func (fs *FakeServer) checkAuth(r *http.Request, w http.ResponseWriter) bool {
	authKey := r.Header.Get("Authorization")
	if authKey == "" {
		http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
		return false
	}
	return true
}

// seedTestData populates the fake server with test events.
func (fs *FakeServer) seedTestData() {
	fs.events["1"] = &Event{
		ID:             "1",
		OrgID:          "1",
		Info:           "Phishing campaign targeting finance department",
		Date:           "2026-04-20",
		ThreatLevelID:  "2",
		Published:      true,
		Analysis:       "2",
		AttributeCount: "3",
		Timestamp:      "1745107200",
		Attributes: []Attribute{
			{ID: "101", EventID: "1", Type: "ip-dst", Category: "Network activity", Value: "192.168.1.100", ToIDS: true, Comment: "C2 server", UUID: "attr-uuid-101"},
			{ID: "102", EventID: "1", Type: "domain", Category: "Network activity", Value: "evil-phishing.example.com", ToIDS: true, Comment: "Phishing domain", UUID: "attr-uuid-102"},
			{ID: "103", EventID: "1", Type: "email-src", Category: "Payload delivery", Value: "attacker@evil.example.com", ToIDS: false, Comment: "Sender email", UUID: "attr-uuid-103"},
		},
		Tags: []Tag{
			{ID: "1", Name: "tlp:amber"},
			{ID: "6", Name: "type:phishing"},
		},
	}

	fs.events["2"] = &Event{
		ID:             "2",
		OrgID:          "1",
		Info:           "Ransomware IOCs from incident response",
		Date:           "2026-04-22",
		ThreatLevelID:  "1",
		Published:      true,
		Analysis:       "2",
		AttributeCount: "4",
		Timestamp:      "1745280000",
		Attributes: []Attribute{
			{ID: "201", EventID: "2", Type: "md5", Category: "Payload delivery", Value: "d41d8cd98f00b204e9800998ecf8427e", ToIDS: true, Comment: "Ransomware hash", UUID: "attr-uuid-201"},
			{ID: "202", EventID: "2", Type: "sha256", Category: "Payload delivery", Value: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", ToIDS: true, Comment: "Ransomware hash SHA256", UUID: "attr-uuid-202"},
			{ID: "203", EventID: "2", Type: "ip-dst", Category: "Network activity", Value: "10.0.0.50", ToIDS: true, Comment: "C2 callback", UUID: "attr-uuid-203"},
			{ID: "204", EventID: "2", Type: "url", Category: "Network activity", Value: "https://ransom-payment.example.com/pay", ToIDS: false, Comment: "Payment URL", UUID: "attr-uuid-204"},
		},
		Tags: []Tag{
			{ID: "1", Name: "tlp:red"},
			{ID: "5", Name: "type:malware"},
		},
	}

	fs.events["3"] = &Event{
		ID:             "3",
		OrgID:          "1",
		Info:           "Suspicious DNS queries from internal host",
		Date:           "2026-04-25",
		ThreatLevelID:  "3",
		Published:      false,
		Analysis:       "1",
		AttributeCount: "2",
		Timestamp:      "1745539200",
		Attributes: []Attribute{
			{ID: "301", EventID: "3", Type: "domain", Category: "Network activity", Value: "suspicious-dns.example.com", ToIDS: true, Comment: "Suspicious domain", UUID: "attr-uuid-301"},
			{ID: "302", EventID: "3", Type: "hostname", Category: "Network activity", Value: "workstation-42.internal", ToIDS: false, Comment: "Source host", UUID: "attr-uuid-302"},
		},
		Tags: []Tag{
			{ID: "2", Name: "tlp:green"},
		},
	}
}

// defaultTaxonomies returns the default set of MISP taxonomies for the fake server.
func defaultTaxonomies() []Taxonomy {
	return []Taxonomy{
		{ID: "1", Namespace: "tlp", Enabled: true, Version: 4},
		{ID: "2", Namespace: "pap", Enabled: true, Version: 1},
		{ID: "3", Namespace: "admiralty-scale", Enabled: false, Version: 2},
		{ID: "4", Namespace: "malware_classification", Enabled: false, Version: 3},
		{ID: "5", Namespace: "osint", Enabled: false, Version: 1},
		{ID: "6", Namespace: "circl", Enabled: false, Version: 2},
	}
}
