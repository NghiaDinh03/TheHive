package server

import (
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/handler"
	"github.com/thehive-platform/backend/internal/scanner"
	"github.com/thehive-platform/backend/internal/storage"
)

// registerAttachmentRoutes keeps evidence storage routes in one module so the
// next refactor can move upload/finalize/scan/download policy behind a service.
func (s *Server) registerAttachmentRoutes(api *echo.Group, authRequired echo.MiddlewareFunc) {
	auditRecorder := s.newAuditRecorder()
	storageClient := storage.NewClient(storage.Config{
		Endpoint:        s.cfg.S3Endpoint,
		PublicEndpoint:  s.cfg.S3PublicEndpoint,
		Region:          s.cfg.S3Region,
		AccessKeyID:     s.cfg.S3AccessKeyID,
		SecretAccessKey: s.cfg.S3SecretAccessKey,
		Bucket:          s.cfg.S3Bucket,
		UsePathStyle:    s.cfg.S3UsePathStyle,
		UploadTTL:       s.cfg.S3UploadTTL,
		DownloadTTL:     s.cfg.S3DownloadTTL,
	})
	attachments := handler.NewAttachmentHandler(s.db, auditRecorder, storageClient,
		handler.WithAttachmentScanner(scanner.NewPlaceholder(s.cfg.AttachmentScannerEngine)),
		handler.WithAttachmentDownloadPolicy(scanner.NormalizePolicy(s.cfg.AttachmentDownloadPolicy)),
		handler.WithAttachmentQueueOnUpload(s.cfg.AttachmentQueueOnUpload),
		handler.WithAttachmentManualScan(s.cfg.AttachmentManualScanAllow),
		handler.WithAttachmentZipPassword(s.cfg.AttachmentZipPassword),
	)
	detail := handler.NewDetailHandler(s.db)

	api.POST("/attachments/upload", attachments.InitUpload, authRequired, RequirePermission("accessTheHiveFS"))
	api.POST("/attachments/:id/finalize", attachments.Finalize, authRequired, RequirePermission("accessTheHiveFS"))
	api.GET("/attachments", detail.ListAttachments, authRequired, RequirePermission("accessTheHiveFS"))
	api.GET("/attachments/:id/download", attachments.Download, authRequired, RequirePermission("accessTheHiveFS"))
	api.GET("/attachments/:id/download.zip", attachments.DownloadZip, authRequired, RequirePermission("accessTheHiveFS"))
	api.POST("/attachments/:id/scan", attachments.MarkScanned, authRequired, RequirePermission("accessTheHiveFS"))
}
