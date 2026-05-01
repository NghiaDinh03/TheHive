package handler

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/attachmentzip"
	"github.com/thehive-platform/backend/internal/audit"
	"github.com/thehive-platform/backend/internal/repository/attachment"
	"github.com/thehive-platform/backend/internal/scanner"
	"github.com/thehive-platform/backend/internal/storage"
)

type AttachmentHandler struct {
	db             *sqlx.DB
	repo           *attachment.Repository
	audit          *audit.Recorder
	storage        *storage.Client
	scanner        scanner.Scanner
	downloadPolicy scanner.DownloadPolicy
	queueOnUpload  bool
	manualScan     bool
	zipPassword    string
}

type AttachmentHandlerOption func(*AttachmentHandler)

func NewAttachmentHandler(db *sqlx.DB, auditRecorder *audit.Recorder, storageClient *storage.Client, options ...AttachmentHandlerOption) *AttachmentHandler {
	h := &AttachmentHandler{db: db, repo: attachment.NewRepository(db), audit: auditRecorder, storage: storageClient, scanner: scanner.NewPlaceholder("placeholder"), downloadPolicy: scanner.DownloadPolicyCleanOnly, queueOnUpload: true, manualScan: true, zipPassword: "malware"}
	for _, option := range options {
		option(h)
	}
	return h
}

func WithAttachmentScanner(scan scanner.Scanner) AttachmentHandlerOption {
	return func(h *AttachmentHandler) {
		if scan != nil {
			h.scanner = scan
		}
	}
}

func WithAttachmentDownloadPolicy(policy scanner.DownloadPolicy) AttachmentHandlerOption {
	return func(h *AttachmentHandler) { h.downloadPolicy = policy }
}

func WithAttachmentQueueOnUpload(enabled bool) AttachmentHandlerOption {
	return func(h *AttachmentHandler) { h.queueOnUpload = enabled }
}

func WithAttachmentManualScan(enabled bool) AttachmentHandlerOption {
	return func(h *AttachmentHandler) { h.manualScan = enabled }
}

func WithAttachmentZipPassword(password string) AttachmentHandlerOption {
	return func(h *AttachmentHandler) {
		if strings.TrimSpace(password) != "" {
			h.zipPassword = password
		}
	}
}

type initUploadRequest struct {
	CaseID       string `json:"case_id"`
	ObservableID string `json:"observable_id"`
	LogID        string `json:"log_id"`
	FileName     string `json:"file_name" validate:"required"`
	ContentType  string `json:"content_type"`
	SizeBytes    int64  `json:"size_bytes"`
	SHA256       string `json:"sha256"`
}

type scanRequest struct {
	Status string `json:"status" validate:"required"`
	Engine string `json:"engine"`
}

func (h *AttachmentHandler) InitUpload(c echo.Context) error {
	var req initUploadRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	ownerType, ownerID := attachmentOwner(req)
	objectKey, err := attachment.AllocateObjectKey(ownerType, ownerID, req.FileName)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "attachment object key allocation failed")
	}
	uploadURL, expiresAt, err := h.storage.PresignUpload(objectKey, req.ContentType)
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "attachment upload init failed")
	}
	defer func() { _ = tx.Rollback() }()
	created, err := h.repo.Create(c.Request().Context(), tx, attachment.CreateInput{CaseID: req.CaseID, ObservableID: req.ObservableID, LogID: req.LogID, FileName: req.FileName, ContentType: req.ContentType, SizeBytes: req.SizeBytes, SHA256: req.SHA256, Bucket: h.storage.Bucket(), ObjectKey: objectKey, UploadedBy: actorLogin(c)})
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	if h.queueOnUpload {
		job := h.scanner.BuildJob(created.ID, created.Bucket, created.ObjectKey)
		if h.audit != nil {
			if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "attachment.scan_queued", "attachment", created.ID, nil, job)); err != nil {
				return apierr.New(http.StatusInternalServerError, "attachment scan queue audit failed")
			}
		}
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "attachment.upload_init", "attachment", created.ID, nil, created)); err != nil {
			return apierr.New(http.StatusInternalServerError, "attachment audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "attachment upload init failed")
	}
	return c.JSON(http.StatusCreated, attachment.UploadInit{Attachment: created, UploadURL: uploadURL, ExpiresAt: expiresAt})
}

func (h *AttachmentHandler) Download(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "attachment download failed")
	}
	defer func() { _ = tx.Rollback() }()
	item, err := h.repo.Get(c.Request().Context(), tx, id)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "attachment not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "attachment download failed")
	}
	allowed, reason := scanner.CanDownload(item.ScanStatus, h.downloadPolicy)
	if !allowed {
		blocked := attachment.DownloadLink{Attachment: item, Blocked: true, Reason: reason}
		if h.audit != nil {
			_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "attachment.download_blocked", "attachment", item.ID, nil, blocked))
		}
		_ = tx.Commit()
		return c.JSON(http.StatusAccepted, blocked)
	}
	downloadURL, expiresAt, err := h.storage.PresignDownload(item.ObjectKey)
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	if err := h.repo.MarkDownloaded(c.Request().Context(), tx, item.ID); err != nil {
		return apierr.New(http.StatusInternalServerError, "attachment download audit failed")
	}
	link := attachment.DownloadLink{Attachment: item, DownloadURL: downloadURL, ExpiresAt: expiresAt, Blocked: false}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "attachment.download", "attachment", item.ID, nil, link)); err != nil {
			return apierr.New(http.StatusInternalServerError, "attachment audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "attachment download failed")
	}
	return c.JSON(http.StatusOK, link)
}

func (h *AttachmentHandler) DownloadZip(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "attachment zip download failed")
	}
	defer func() { _ = tx.Rollback() }()
	item, err := h.repo.Get(c.Request().Context(), tx, id)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "attachment not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "attachment zip download failed")
	}
	allowed, reason := scanner.CanDownload(item.ScanStatus, h.downloadPolicy)
	if !allowed {
		blocked := attachment.ZipDownload{Attachment: item, Blocked: true, Reason: reason}
		if h.audit != nil {
			_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "attachment.zip_download_blocked", "attachment", item.ID, nil, blocked))
		}
		_ = tx.Commit()
		return c.JSON(http.StatusAccepted, blocked)
	}
	bytes, err := h.storage.FetchObject(item.ObjectKey)
	if err != nil {
		return apierr.New(http.StatusBadGateway, "attachment object fetch failed")
	}
	zipResult, err := attachmentzip.Build(item.FileName, h.zipPassword, bytes)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "attachment zip build failed")
	}
	if err := h.repo.MarkDownloaded(c.Request().Context(), tx, item.ID); err != nil {
		return apierr.New(http.StatusInternalServerError, "attachment zip download audit failed")
	}
	if h.audit != nil {
		after := attachment.ZipDownload{Attachment: item, FileName: zipResult.FileName, ContentType: zipResult.ContentType, SizeBytes: zipResult.SizeBytes, Blocked: false}
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "attachment.zip_download", "attachment", item.ID, nil, after)); err != nil {
			return apierr.New(http.StatusInternalServerError, "attachment audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "attachment zip download failed")
	}
	return c.Blob(http.StatusOK, zipResult.ContentType, zipResult.Bytes)
}

func (h *AttachmentHandler) MarkScanned(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var req scanRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	if !h.manualScan {
		return apierr.New(http.StatusForbidden, "manual attachment scan is disabled")
	}
	result, err := h.scanner.NormalizeManualResult(req.Status, req.Engine)
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	return h.withTx(c, "attachment.scan", func(tx *sqlx.Tx) (string, any, any, error) {
		before, err := h.repo.Get(c.Request().Context(), tx, id)
		if err != nil {
			return id, nil, nil, err
		}
		updated, err := h.repo.MarkScanned(c.Request().Context(), tx, id, result.Status, result.Engine)
		return updated.ID, before, updated, err
	})
}

func (h *AttachmentHandler) withTx(c echo.Context, action string, fn func(*sqlx.Tx) (string, any, any, error)) error {
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, action+" failed")
	}
	defer func() { _ = tx.Rollback() }()
	entityID, before, after, err := fn(tx)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "attachment not found")
	}
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, action, "attachment", entityID, before, after)); err != nil {
			return apierr.New(http.StatusInternalServerError, action+" audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, action+" failed")
	}
	return c.JSON(http.StatusOK, after)
}

type finalizeRequest struct {
	DeclaredSizeBytes int64  `json:"declared_size_bytes"`
	DeclaredSHA256    string `json:"declared_sha256"`
}

type finalizeResponse struct {
	Attachment       attachment.Attachment `json:"attachment"`
	ComputedSHA256   string                `json:"computed_sha256"`
	ComputedSize     int64                 `json:"computed_size_bytes"`
	HashMatched      bool                  `json:"hash_matched"`
	SizeMatched      bool                  `json:"size_matched"`
	HashSource       string                `json:"hash_source"`
	VerificationNote string                `json:"verification_note,omitempty"`
}

// Finalize fetches the freshly-uploaded object from S3/MinIO, computes SHA-256 + size server-side,
// updates the attachment row, and reports any mismatch with client-declared values.
// Parity reference: TheHive 4 `AttachmentSrv.create` always hashed binary server-side instead of trusting client.
func (h *AttachmentHandler) Finalize(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var req finalizeRequest
	// Body is optional; ignore decode errors, fall back to declared values from initial upload row.
	_ = c.Bind(&req)

	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "attachment finalize failed")
	}
	defer func() { _ = tx.Rollback() }()

	item, err := h.repo.Get(c.Request().Context(), tx, id)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "attachment not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "attachment finalize failed")
	}

	bytes, err := h.storage.FetchObject(item.ObjectKey)
	if err != nil {
		return apierr.New(http.StatusBadGateway, "attachment object fetch failed")
	}
	sum := sha256.Sum256(bytes)
	computedSHA := hex.EncodeToString(sum[:])
	computedSize := int64(len(bytes))

	declaredSize := req.DeclaredSizeBytes
	if declaredSize == 0 {
		declaredSize = item.SizeBytes
	}
	declaredSHA := strings.TrimSpace(req.DeclaredSHA256)
	if declaredSHA == "" {
		declaredSHA = item.SHA256
	}

	hashMatched := declaredSHA == "" || strings.EqualFold(declaredSHA, computedSHA)
	sizeMatched := declaredSize == 0 || declaredSize == computedSize
	note := ""
	if !hashMatched {
		note = "client-declared sha256 did not match server-side computed sha256"
	}
	if !sizeMatched {
		if note != "" {
			note += "; "
		}
		note += "client-declared size did not match server-side observed size"
	}

	updated, err := h.repo.Finalize(c.Request().Context(), tx, item.ID, computedSize, computedSHA)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "attachment finalize failed")
	}

	resp := finalizeResponse{
		Attachment:       updated,
		ComputedSHA256:   computedSHA,
		ComputedSize:     computedSize,
		HashMatched:      hashMatched,
		SizeMatched:      sizeMatched,
		HashSource:       "server-side",
		VerificationNote: note,
	}

	if h.audit != nil {
		auditAction := "attachment.finalize"
		if !hashMatched || !sizeMatched {
			auditAction = "attachment.finalize_mismatch"
		}
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, auditAction, "attachment", item.ID, item, resp)); err != nil {
			return apierr.New(http.StatusInternalServerError, "attachment audit failed")
		}
	}

	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "attachment finalize failed")
	}
	return c.JSON(http.StatusOK, resp)
}

func attachmentOwner(req initUploadRequest) (string, string) {
	if strings.TrimSpace(req.CaseID) != "" {
		return "cases", req.CaseID
	}
	if strings.TrimSpace(req.ObservableID) != "" {
		return "observables", req.ObservableID
	}
	if strings.TrimSpace(req.LogID) != "" {
		return "logs", req.LogID
	}
	return "attachments", "global"
}
