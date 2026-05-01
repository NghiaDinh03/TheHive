package misp

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Config struct {
	BaseURL string
	APIKey  string
	Timeout time.Duration
	VerifyTLS bool
}

type Event struct {
	ID             string      `json:"id"`
	OrgID          string      `json:"org_id"`
	Info           string      `json:"info"`
	Date           string      `json:"date"`
	ThreatLevelID  string      `json:"threat_level_id"`
	Published      bool        `json:"published"`
	Analysis       string      `json:"analysis"`
	AttributeCount string      `json:"attribute_count"`
	Timestamp      string      `json:"timestamp"`
	Attributes     []Attribute `json:"Attribute,omitempty"`
	Tags           []Tag       `json:"Tag,omitempty"`
}

type Attribute struct {
	ID          string `json:"id"`
	EventID     string `json:"event_id"`
	Type        string `json:"type"`
	Category    string `json:"category"`
	Value       string `json:"value"`
	ToIDS       bool   `json:"to_ids"`
	Comment     string `json:"comment"`
	Timestamp   string `json:"timestamp"`
	UUID        string `json:"uuid"`
}

type Tag struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ImportPreview struct {
	EventID      string   `json:"event_id"`
	Title        string   `json:"title"`
	Date         string   `json:"date"`
	ThreatLevel  string   `json:"threat_level"`
	Tags         []string `json:"tags"`
	Observables  int      `json:"observable_count"`
	IOCCount     int      `json:"ioc_count"`
}

type ExportRequest struct {
	CaseID       string   `json:"case_id"`
	EventInfo    string   `json:"event_info"`
	Observables  []ExportObservable `json:"observables"`
}

type ExportObservable struct {
	DataType string `json:"data_type"`
	Data     string `json:"data"`
	IOC      bool   `json:"ioc"`
	Comment  string `json:"comment"`
	Tags     []string `json:"tags"`
}

type ExportResult struct {
	EventID     string `json:"event_id"`
	EventInfo   string `json:"event_info"`
	Exported    int    `json:"exported_count"`
	Skipped     int    `json:"skipped_count"`
}

type Client struct {
	cfg    Config
	client *http.Client
}

func NewClient(cfg Config) *Client {
	if cfg.Timeout == 0 {
		cfg.Timeout = 30 * time.Second
	}
	return &Client{
		cfg:    cfg,
		client: &http.Client{Timeout: cfg.Timeout},
	}
}

func (c *Client) GetEvent(ctx context.Context, eventID string) (*Event, error) {
	url := fmt.Sprintf("%s/events/view/%s", strings.TrimRight(c.cfg.BaseURL, "/"), eventID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", c.cfg.APIKey)
	req.Header.Set("Accept", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("misp request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("misp returned %d: %s", resp.StatusCode, string(body))
	}
	var result struct {
		Event Event `json:"Event"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result.Event, nil
}

func (c *Client) PreviewImport(ctx context.Context, eventID string) (*ImportPreview, error) {
	event, err := c.GetEvent(ctx, eventID)
	if err != nil {
		return nil, err
	}
	tags := make([]string, 0, len(event.Tags))
	for _, t := range event.Tags {
		tags = append(tags, t.Name)
	}
	iocCount := 0
	for _, attr := range event.Attributes {
		if attr.ToIDS {
			iocCount++
		}
	}
	return &ImportPreview{
		EventID:     event.ID,
		Title:       event.Info,
		Date:        event.Date,
		ThreatLevel: event.ThreatLevelID,
		Tags:        tags,
		Observables: len(event.Attributes),
		IOCCount:    iocCount,
	}, nil
}

// ExportToEvent creates a MISP event with attributes from case observables.
func (c *Client) ExportToEvent(ctx context.Context, req ExportRequest) (*ExportResult, error) {
	// Build MISP event payload
	attributes := make([]map[string]interface{}, 0, len(req.Observables))
	skipped := 0
	for _, obs := range req.Observables {
		mispType := mapObservableToMISPType(obs.DataType)
		if mispType == "" {
			skipped++
			continue
		}
		attr := map[string]interface{}{
			"type":     mispType,
			"value":    obs.Data,
			"comment":  obs.Comment,
			"to_ids":   obs.IOC,
			"category": mapDataTypeToCategory(obs.DataType),
		}
		attributes = append(attributes, attr)
	}

	payload := map[string]interface{}{
		"Event": map[string]interface{}{
			"info":       req.EventInfo,
			"Attribute":  attributes,
			"published":  false,
			"analysis":   "0",
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal export payload: %w", err)
	}

	url := fmt.Sprintf("%s/events/add", strings.TrimRight(c.cfg.BaseURL, "/"))
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", c.cfg.APIKey)
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("misp export request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("misp export returned %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Event struct {
			ID string `json:"id"`
		} `json:"Event"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode misp export response: %w", err)
	}

	return &ExportResult{
		EventID:   result.Event.ID,
		EventInfo: req.EventInfo,
		Exported:  len(attributes),
		Skipped:   skipped,
	}, nil
}

func mapObservableToMISPType(dataType string) string {
	mapping := map[string]string{
		"ip":               "ip-src",
		"domain":           "domain",
		"url":              "url",
		"mail":             "email-src",
		"hash":             "sha256",
		"filename":         "filename",
		"fqdn":             "hostname",
		"uri_path":         "uri",
		"user-agent":       "user-agent",
		"registry":         "regkey",
		"autonomous-system": "AS",
	}
	if mapped, ok := mapping[dataType]; ok {
		return mapped
	}
	return ""
}

func mapDataTypeToCategory(dataType string) string {
	switch dataType {
	case "ip", "domain", "fqdn", "url", "uri_path":
		return "Network activity"
	case "hash", "filename":
		return "Payload delivery"
	case "mail":
		return "Payload delivery"
	case "registry":
		return "Persistence mechanism"
	default:
		return "External analysis"
	}
}

func MapMISPTypeToObservable(mispType string) string {
	mapping := map[string]string{
		"ip-src": "ip", "ip-dst": "ip",
		"domain": "domain", "hostname": "domain",
		"url": "url", "link": "url",
		"email-src": "mail", "email-dst": "mail",
		"md5": "hash", "sha1": "hash", "sha256": "hash", "sha512": "hash",
		"filename": "filename",
		"fqdn": "fqdn",
		"uri": "uri_path",
		"user-agent": "user-agent",
		"regkey": "registry",
		"AS": "autonomous-system",
	}
	if mapped, ok := mapping[mispType]; ok {
		return mapped
	}
	return "other"
}
