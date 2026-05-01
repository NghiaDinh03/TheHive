package scanner

import (
	"fmt"
	"strings"
	"time"
)

type DownloadPolicy string

const (
	DownloadPolicyCleanOnly    DownloadPolicy = "clean-only"
	DownloadPolicyAllowUnknown DownloadPolicy = "allow-unknown"
)

type Job struct {
	AttachmentID string    `json:"attachment_id"`
	Bucket       string    `json:"bucket"`
	ObjectKey    string    `json:"object_key"`
	QueuedAt     time.Time `json:"queued_at"`
}

type Result struct {
	Status    string    `json:"status"`
	Engine    string    `json:"engine"`
	Signature string    `json:"signature,omitempty"`
	Message   string    `json:"message,omitempty"`
	ScannedAt time.Time `json:"scanned_at"`
}

type Scanner interface {
	Name() string
	NormalizeManualResult(status string, engine string) (Result, error)
	BuildJob(attachmentID string, bucket string, objectKey string) Job
}

type Placeholder struct {
	Engine string
}

func NewPlaceholder(engine string) Placeholder {
	if strings.TrimSpace(engine) == "" {
		engine = "placeholder"
	}
	return Placeholder{Engine: strings.TrimSpace(engine)}
}

func (p Placeholder) Name() string { return p.Engine }

func (p Placeholder) BuildJob(attachmentID string, bucket string, objectKey string) Job {
	return Job{AttachmentID: strings.TrimSpace(attachmentID), Bucket: strings.TrimSpace(bucket), ObjectKey: strings.TrimSpace(objectKey), QueuedAt: time.Now().UTC()}
}

func (p Placeholder) NormalizeManualResult(status string, engine string) (Result, error) {
	normalized, err := NormalizeStatus(status)
	if err != nil {
		return Result{}, err
	}
	if strings.TrimSpace(engine) == "" {
		engine = p.Engine
	}
	return Result{Status: normalized, Engine: strings.TrimSpace(engine), ScannedAt: time.Now().UTC()}, nil
}

func NormalizePolicy(value string) DownloadPolicy {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case string(DownloadPolicyAllowUnknown), "allow_unknown", "allow-unclean-dev":
		return DownloadPolicyAllowUnknown
	default:
		return DownloadPolicyCleanOnly
	}
}

func NormalizeStatus(status string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "queued":
		return "queued", nil
	case "pending":
		return "pending", nil
	case "clean":
		return "clean", nil
	case "malicious", "infected":
		return "malicious", nil
	case "failed", "error":
		return "failed", nil
	case "unknown":
		return "unknown", nil
	default:
		return "", fmt.Errorf("unsupported scan status %q", status)
	}
}

func CanDownload(scanStatus string, policy DownloadPolicy) (bool, string) {
	normalized := strings.ToLower(strings.TrimSpace(scanStatus))
	if normalized == "clean" {
		return true, ""
	}
	if policy == DownloadPolicyAllowUnknown && (normalized == "unknown" || normalized == "pending" || normalized == "queued") {
		return true, "download allowed by attachment policy despite non-clean scan status"
	}
	return false, "download blocked until malware scan status is clean"
}
