package attachment

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

type Attachment struct {
	ID              string     `db:"id" json:"id"`
	CaseID          string     `db:"case_id" json:"case_id,omitempty"`
	ObservableID    string     `db:"observable_id" json:"observable_id,omitempty"`
	LogID           string     `db:"log_id" json:"log_id,omitempty"`
	FileName        string     `db:"file_name" json:"file_name"`
	OriginalName    string     `db:"original_name" json:"original_name"`
	ContentType     string     `db:"content_type" json:"content_type"`
	SizeBytes       int64      `db:"size_bytes" json:"size_bytes"`
	StorageKey      string     `db:"storage_key" json:"storage_key"`
	StorageBackend  string     `db:"storage_backend" json:"storage_backend"`
	Bucket          string     `db:"bucket" json:"bucket"`
	ObjectKey       string     `db:"object_key" json:"object_key"`
	SHA256          string     `db:"sha256" json:"sha256"`
	ScanStatus      string     `db:"scan_status" json:"scan_status"`
	ScanEngine      string     `db:"scan_engine" json:"scan_engine"`
	RetentionPolicy string     `db:"retention_policy" json:"retention_policy"`
	UploadedBy      string     `db:"uploaded_by" json:"uploaded_by"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	ScannedAt       *time.Time `db:"scanned_at" json:"scanned_at,omitempty"`
	DownloadedAt    *time.Time `db:"downloaded_at" json:"downloaded_at,omitempty"`
}

type CreateInput struct {
	CaseID       string
	ObservableID string
	LogID        string
	FileName     string
	ContentType  string
	SizeBytes    int64
	SHA256       string
	Bucket       string
	ObjectKey    string
	UploadedBy   string
}

type UploadInit struct {
	Attachment Attachment `json:"attachment"`
	UploadURL  string     `json:"upload_url"`
	ExpiresAt  time.Time  `json:"expires_at"`
}

type DownloadLink struct {
	Attachment  Attachment `json:"attachment"`
	DownloadURL string     `json:"download_url,omitempty"`
	ExpiresAt   time.Time  `json:"expires_at,omitempty"`
	Blocked     bool       `json:"blocked"`
	Reason      string     `json:"reason,omitempty"`
}

type ZipDownload struct {
	Attachment  Attachment `json:"attachment"`
	FileName    string     `json:"file_name"`
	ContentType string     `json:"content_type"`
	SizeBytes   int64      `json:"size_bytes"`
	Blocked     bool       `json:"blocked"`
	Reason      string     `json:"reason,omitempty"`
}

func AllocateObjectKey(ownerType string, ownerID string, fileName string) (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	ext := filepath.Ext(fileName)
	cleanOwner := strings.TrimSpace(ownerID)
	if cleanOwner == "" {
		cleanOwner = "global"
	}
	return fmt.Sprintf("%s/%s/%s%s", strings.TrimSpace(ownerType), cleanOwner, hex.EncodeToString(buf), ext), nil
}

func (r *Repository) Create(ctx context.Context, tx *sqlx.Tx, input CreateInput) (Attachment, error) {
	if strings.TrimSpace(input.FileName) == "" || strings.TrimSpace(input.Bucket) == "" || strings.TrimSpace(input.ObjectKey) == "" {
		return Attachment{}, fmt.Errorf("file_name, bucket and object_key are required")
	}
	if strings.TrimSpace(input.ContentType) == "" {
		input.ContentType = "application/octet-stream"
	}
	row := Attachment{}
	query := `INSERT INTO attachments (case_id, observable_id, log_id, file_name, original_name, content_type, size_bytes, storage_key, storage_backend, bucket, object_key, sha256, scan_status, scan_engine, retention_policy, uploaded_by)
		VALUES (NULLIF($1, '')::uuid, NULLIF($2, '')::uuid, NULLIF($3, '')::uuid, $4, $4, $5, $6, $8, 's3', $7, $8, $9, 'pending', 'placeholder', 'case-evidence', $10)
		RETURNING id::text AS id, COALESCE(case_id::text, '') AS case_id, COALESCE(observable_id::text, '') AS observable_id, COALESCE(log_id::text, '') AS log_id, file_name, original_name, content_type, size_bytes, storage_key, storage_backend, bucket, object_key, sha256, scan_status, scan_engine, retention_policy, uploaded_by, created_at, scanned_at, downloaded_at`
	err := tx.GetContext(ctx, &row, query, strings.TrimSpace(input.CaseID), strings.TrimSpace(input.ObservableID), strings.TrimSpace(input.LogID), strings.TrimSpace(input.FileName), strings.TrimSpace(input.ContentType), input.SizeBytes, strings.TrimSpace(input.Bucket), strings.TrimSpace(input.ObjectKey), strings.TrimSpace(input.SHA256), strings.TrimSpace(input.UploadedBy))
	return row, err
}

func (r *Repository) Get(ctx context.Context, tx *sqlx.Tx, id string) (Attachment, error) {
	row := Attachment{}
	err := tx.GetContext(ctx, &row, `SELECT id::text AS id, COALESCE(case_id::text, '') AS case_id, COALESCE(observable_id::text, '') AS observable_id, COALESCE(log_id::text, '') AS log_id, file_name, original_name, content_type, size_bytes, storage_key, storage_backend, bucket, object_key, sha256, scan_status, scan_engine, retention_policy, uploaded_by, created_at, scanned_at, downloaded_at FROM attachments WHERE id = $1::uuid`, strings.TrimSpace(id))
	return row, err
}

func (r *Repository) MarkScanned(ctx context.Context, tx *sqlx.Tx, id string, status string, engine string) (Attachment, error) {
	row := Attachment{}
	err := tx.GetContext(ctx, &row, `UPDATE attachments SET scan_status = $2, scan_engine = $3, scanned_at = now() WHERE id = $1::uuid RETURNING id::text AS id, COALESCE(case_id::text, '') AS case_id, COALESCE(observable_id::text, '') AS observable_id, COALESCE(log_id::text, '') AS log_id, file_name, original_name, content_type, size_bytes, storage_key, storage_backend, bucket, object_key, sha256, scan_status, scan_engine, retention_policy, uploaded_by, created_at, scanned_at, downloaded_at`, strings.TrimSpace(id), strings.TrimSpace(status), strings.TrimSpace(engine))
	return row, err
}

func (r *Repository) MarkDownloaded(ctx context.Context, tx *sqlx.Tx, id string) error {
	_, err := tx.ExecContext(ctx, `UPDATE attachments SET downloaded_at = now() WHERE id = $1::uuid`, strings.TrimSpace(id))
	return err
}

// Finalize updates an attachment row with server-side observed bytes/hash after the client uploads to MinIO/S3.
// This is the parity hook for TheHive 4 `AttachmentSrv.create` which always hashed the binary server-side.
func (r *Repository) Finalize(ctx context.Context, tx *sqlx.Tx, id string, sizeBytes int64, sha256Hex string) (Attachment, error) {
	row := Attachment{}
	err := tx.GetContext(ctx, &row, `UPDATE attachments SET size_bytes = $2, sha256 = $3 WHERE id = $1::uuid RETURNING id::text AS id, COALESCE(case_id::text, '') AS case_id, COALESCE(observable_id::text, '') AS observable_id, COALESCE(log_id::text, '') AS log_id, file_name, original_name, content_type, size_bytes, storage_key, storage_backend, bucket, object_key, sha256, scan_status, scan_engine, retention_policy, uploaded_by, created_at, scanned_at, downloaded_at`, strings.TrimSpace(id), sizeBytes, strings.TrimSpace(sha256Hex))
	return row, err
}
