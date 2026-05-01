package cortex

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// CortexClient is a real HTTP client for the Cortex analysis engine.
// It replaces the fake/dev ProcessPendingJobs path with actual Cortex API calls.
type CortexClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// CortexClientConfig holds configuration for the Cortex HTTP client.
type CortexClientConfig struct {
	BaseURL string
	APIKey  string
	Timeout time.Duration
}

// NewCortexClient creates a new Cortex HTTP client.
func NewCortexClient(cfg CortexClientConfig) *CortexClient {
	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	return &CortexClient{
		baseURL: cfg.BaseURL,
		apiKey:  cfg.APIKey,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

// CortexAnalyzerInfo represents an analyzer from the Cortex API.
type CortexAnalyzerInfo struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Version     string   `json:"version"`
	Description string   `json:"description"`
	DataTypeList []string `json:"dataTypeList"`
}

// CortexJobRequest is the request body for creating a Cortex job.
type CortexJobRequest struct {
	Data     string `json:"data"`
	DataType string `json:"dataType"`
	TLP      int    `json:"tlp"`
	PAP      int    `json:"pap"`
	Message  string `json:"message,omitempty"`
}

// CortexJobResponse is the response from the Cortex API for a job.
type CortexJobResponse struct {
	ID         string          `json:"id"`
	AnalyzerID string          `json:"analyzerId"`
	Status     string          `json:"status"`
	Report     json.RawMessage `json:"report,omitempty"`
	CreatedAt  string          `json:"createdAt"`
	StartDate  string          `json:"startDate,omitempty"`
	EndDate    string          `json:"endDate,omitempty"`
}

// ListAnalyzers fetches the list of available analyzers from Cortex.
func (c *CortexClient) ListAnalyzers(ctx context.Context) ([]CortexAnalyzerInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/analyzer", nil)
	if err != nil {
		return nil, fmt.Errorf("cortex list analyzers: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cortex list analyzers: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("cortex list analyzers: status %d: %s", resp.StatusCode, string(body))
	}

	var analyzers []CortexAnalyzerInfo
	if err := json.NewDecoder(resp.Body).Decode(&analyzers); err != nil {
		return nil, fmt.Errorf("cortex list analyzers decode: %w", err)
	}
	return analyzers, nil
}

// RunAnalyzer submits an analysis job to a specific Cortex analyzer.
func (c *CortexClient) RunAnalyzer(ctx context.Context, analyzerID string, jobReq CortexJobRequest) (*CortexJobResponse, error) {
	body, err := json.Marshal(jobReq)
	if err != nil {
		return nil, fmt.Errorf("cortex run analyzer marshal: %w", err)
	}

	url := fmt.Sprintf("%s/api/analyzer/%s/run", c.baseURL, analyzerID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("cortex run analyzer: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cortex run analyzer: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("cortex run analyzer: status %d: %s", resp.StatusCode, string(respBody))
	}

	var jobResp CortexJobResponse
	if err := json.NewDecoder(resp.Body).Decode(&jobResp); err != nil {
		return nil, fmt.Errorf("cortex run analyzer decode: %w", err)
	}
	return &jobResp, nil
}

// GetJobReport fetches the report for a completed Cortex job.
func (c *CortexClient) GetJobReport(ctx context.Context, jobID string) (*CortexJobResponse, error) {
	url := fmt.Sprintf("%s/api/job/%s/report", c.baseURL, jobID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("cortex get report: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cortex get report: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("cortex get report: status %d: %s", resp.StatusCode, string(respBody))
	}

	var jobResp CortexJobResponse
	if err := json.NewDecoder(resp.Body).Decode(&jobResp); err != nil {
		return nil, fmt.Errorf("cortex get report decode: %w", err)
	}
	return &jobResp, nil
}

// WaitForJob polls the Cortex API until the job completes or times out.
func (c *CortexClient) WaitForJob(ctx context.Context, jobID string, pollInterval time.Duration, maxWait time.Duration) (*CortexJobResponse, error) {
	if pollInterval == 0 {
		pollInterval = 3 * time.Second
	}
	if maxWait == 0 {
		maxWait = 5 * time.Minute
	}

	deadline := time.Now().Add(maxWait)
	for {
		if time.Now().After(deadline) {
			return nil, fmt.Errorf("cortex wait for job %s: timeout after %v", jobID, maxWait)
		}

		url := fmt.Sprintf("%s/api/job/%s", c.baseURL, jobID)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, fmt.Errorf("cortex wait for job: %w", err)
		}
		c.setHeaders(req)

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("cortex wait for job: %w", err)
		}

		var jobResp CortexJobResponse
		if err := json.NewDecoder(resp.Body).Decode(&jobResp); err != nil {
			resp.Body.Close()
			return nil, fmt.Errorf("cortex wait for job decode: %w", err)
		}
		resp.Body.Close()

		switch jobResp.Status {
		case "Success":
			return c.GetJobReport(ctx, jobID)
		case "Failure":
			return &jobResp, fmt.Errorf("cortex job %s failed", jobID)
		case "InProgress", "Waiting":
			// Continue polling
		default:
			return &jobResp, fmt.Errorf("cortex job %s unexpected status: %s", jobID, jobResp.Status)
		}

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(pollInterval):
		}
	}
}

func (c *CortexClient) setHeaders(req *http.Request) {
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	req.Header.Set("Accept", "application/json")
}
