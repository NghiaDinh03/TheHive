package tests

// --- C1: Fake Cortex integration tests ---
// These tests verify the Cortex analyzer workflow using a fake HTTP server,
// matching TheHive 4 Cortex integration behavior: list analyzers, submit job,
// poll status, retrieve report.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// fakeCortexAnalyzer represents a Cortex analyzer definition as returned by
// the real Cortex API GET /api/analyzer endpoint.
type fakeCortexAnalyzer struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Version   string   `json:"version"`
	DataTypes []string `json:"dataTypeList"`
}

// fakeCortexJob represents a Cortex job as returned by POST /api/analyzer/:id/run.
type fakeCortexJob struct {
	ID         string          `json:"id"`
	AnalyzerID string          `json:"analyzerId"`
	Status     string          `json:"status"`
	Report     json.RawMessage `json:"report,omitempty"`
	CreatedAt  int64           `json:"createdAt"`
}

// newFakeCortexServer creates a minimal fake Cortex HTTP server that:
//   - GET  /api/analyzer           → list analyzers
//   - POST /api/analyzer/:id/run   → submit job, returns queued job
//   - GET  /api/job/:id            → return job status (Waiting → Success)
//   - GET  /api/job/:id/report     → return analyzer report
func newFakeCortexServer(t *testing.T) *httptest.Server {
	t.Helper()
	analyzers := []fakeCortexAnalyzer{
		{ID: "FileInfo_2_1", Name: "FileInfo", Version: "2.1", DataTypes: []string{"file", "hash"}},
		{ID: "MaxMind_GeoIP_4_0", Name: "MaxMind_GeoIP", Version: "4.0", DataTypes: []string{"ip"}},
		{ID: "VirusTotal_GetReport_3_1", Name: "VirusTotal_GetReport", Version: "3.1", DataTypes: []string{"hash", "ip", "domain", "url"}},
	}
	jobStore := map[string]*fakeCortexJob{}
	callCount := map[string]int{}

	mux := http.NewServeMux()

	// List analyzers
	mux.HandleFunc("/api/analyzer", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(analyzers)
	})

	// List analyzers for data type
	mux.HandleFunc("/api/analyzer/type/", func(w http.ResponseWriter, r *http.Request) {
		dataType := strings.TrimPrefix(r.URL.Path, "/api/analyzer/type/")
		var result []fakeCortexAnalyzer
		for _, a := range analyzers {
			for _, dt := range a.DataTypes {
				if dt == dataType {
					result = append(result, a)
					break
				}
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(result)
	})

	// Submit job
	mux.HandleFunc("/api/analyzer/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		analyzerID := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/api/analyzer/"), "/run")
		jobID := "job-" + analyzerID + "-001"
		job := &fakeCortexJob{
			ID:         jobID,
			AnalyzerID: analyzerID,
			Status:     "Waiting",
			CreatedAt:  time.Now().UnixMilli(),
		}
		jobStore[jobID] = job
		callCount[jobID] = 0
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(job)
	})

	// Get job status / report
	mux.HandleFunc("/api/job/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		isReport := strings.HasSuffix(path, "/report")
		jobID := strings.TrimPrefix(path, "/api/job/")
		jobID = strings.TrimSuffix(jobID, "/report")

		job, ok := jobStore[jobID]
		if !ok {
			http.Error(w, `{"message":"job not found"}`, http.StatusNotFound)
			return
		}

		// Simulate job progression: first call → InProgress, second+ → Success
		callCount[jobID]++
		if callCount[jobID] >= 2 {
			job.Status = "Success"
			job.Report = json.RawMessage(`{"success":true,"summary":{"taxonomies":[{"level":"info","namespace":"MaxMind","predicate":"Country","value":"US"}]},"full":{"country":"US","city":"Ashburn","asn":"AS14618 Amazon.com, Inc."}}`)
		} else {
			job.Status = "InProgress"
		}

		w.Header().Set("Content-Type", "application/json")
		if isReport {
			if job.Status != "Success" {
				http.Error(w, `{"message":"report not ready"}`, http.StatusNotFound)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":     job.ID,
				"status": job.Status,
				"report": json.RawMessage(job.Report),
			})
			return
		}
		_ = json.NewEncoder(w).Encode(job)
	})

	return httptest.NewServer(mux)
}

// TestFakeCortexListAnalyzers verifies that the fake Cortex server returns
// the expected analyzer list matching TheHive 4 Cortex integration format.
func TestFakeCortexListAnalyzers(t *testing.T) {
	srv := newFakeCortexServer(t)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/analyzer")
	if err != nil {
		t.Fatalf("GET /api/analyzer: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var analyzers []fakeCortexAnalyzer
	if err := json.NewDecoder(resp.Body).Decode(&analyzers); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(analyzers) != 3 {
		t.Fatalf("expected 3 analyzers, got %d", len(analyzers))
	}
	// Verify MaxMind analyzer supports ip data type
	var found bool
	for _, a := range analyzers {
		if a.Name == "MaxMind_GeoIP" {
			for _, dt := range a.DataTypes {
				if dt == "ip" {
					found = true
				}
			}
		}
	}
	if !found {
		t.Error("expected MaxMind_GeoIP to support ip data type")
	}
}

// TestFakeCortexAnalyzerForType verifies filtering analyzers by data type.
func TestFakeCortexAnalyzerForType(t *testing.T) {
	srv := newFakeCortexServer(t)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/analyzer/type/ip")
	if err != nil {
		t.Fatalf("GET /api/analyzer/type/ip: %v", err)
	}
	defer resp.Body.Close()

	var analyzers []fakeCortexAnalyzer
	if err := json.NewDecoder(resp.Body).Decode(&analyzers); err != nil {
		t.Fatalf("decode: %v", err)
	}
	// MaxMind and VirusTotal support ip
	if len(analyzers) < 2 {
		t.Fatalf("expected >=2 ip analyzers, got %d", len(analyzers))
	}
}

// TestFakeCortexJobLifecycle verifies the full analyzer job lifecycle:
// submit → poll InProgress → poll Success → retrieve report.
// This matches TheHive 4 Cortex worker behavior.
func TestFakeCortexJobLifecycle(t *testing.T) {
	srv := newFakeCortexServer(t)
	defer srv.Close()

	// Submit job
	body := strings.NewReader(`{"data":"8.8.8.8","dataType":"ip","tlp":2}`)
	resp, err := http.Post(srv.URL+"/api/analyzer/MaxMind_GeoIP_4_0/run", "application/json", body)
	if err != nil {
		t.Fatalf("POST /api/analyzer/MaxMind_GeoIP_4_0/run: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}

	var job fakeCortexJob
	if err := json.NewDecoder(resp.Body).Decode(&job); err != nil {
		t.Fatalf("decode job: %v", err)
	}
	if job.ID == "" {
		t.Fatal("expected job ID")
	}
	if job.Status != "Waiting" {
		t.Fatalf("expected Waiting, got %s", job.Status)
	}

	// First poll → InProgress
	resp2, err := http.Get(srv.URL + "/api/job/" + job.ID)
	if err != nil {
		t.Fatalf("GET /api/job/%s: %v", job.ID, err)
	}
	defer resp2.Body.Close()
	var job2 fakeCortexJob
	_ = json.NewDecoder(resp2.Body).Decode(&job2)
	if job2.Status != "InProgress" {
		t.Fatalf("expected InProgress, got %s", job2.Status)
	}

	// Second poll → Success
	resp3, err := http.Get(srv.URL + "/api/job/" + job.ID)
	if err != nil {
		t.Fatalf("GET /api/job/%s (2nd): %v", job.ID, err)
	}
	defer resp3.Body.Close()
	var job3 fakeCortexJob
	_ = json.NewDecoder(resp3.Body).Decode(&job3)
	if job3.Status != "Success" {
		t.Fatalf("expected Success, got %s", job3.Status)
	}

	// Retrieve report
	resp4, err := http.Get(srv.URL + "/api/job/" + job.ID + "/report")
	if err != nil {
		t.Fatalf("GET /api/job/%s/report: %v", job.ID, err)
	}
	defer resp4.Body.Close()
	if resp4.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for report, got %d", resp4.StatusCode)
	}
	var report map[string]any
	if err := json.NewDecoder(resp4.Body).Decode(&report); err != nil {
		t.Fatalf("decode report: %v", err)
	}
	if report["status"] != "Success" {
		t.Errorf("expected report status Success, got %v", report["status"])
	}
	if report["report"] == nil {
		t.Error("expected report.report to be non-nil")
	}
}

// TestFakeCortexReportNotReadyBeforeSuccess verifies that requesting a report
// before the job completes returns 404, matching TheHive 4 Cortex behavior.
func TestFakeCortexReportNotReadyBeforeSuccess(t *testing.T) {
	srv := newFakeCortexServer(t)
	defer srv.Close()

	// Submit job
	body := strings.NewReader(`{"data":"evil.com","dataType":"domain","tlp":2}`)
	resp, err := http.Post(srv.URL+"/api/analyzer/VirusTotal_GetReport_3_1/run", "application/json", body)
	if err != nil {
		t.Fatalf("POST: %v", err)
	}
	defer resp.Body.Close()
	var job fakeCortexJob
	_ = json.NewDecoder(resp.Body).Decode(&job)

	// Try report before polling status (job still Waiting)
	resp2, err := http.Get(srv.URL + "/api/job/" + job.ID + "/report")
	if err != nil {
		t.Fatalf("GET report: %v", err)
	}
	defer resp2.Body.Close()
	if resp2.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 for report before success, got %d", resp2.StatusCode)
	}
}
