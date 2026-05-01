package tests

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/handler"
	"github.com/thehive-platform/backend/internal/storage"
)

func TestAdminListUsers(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT u.login, u.name").WillReturnRows(sqlmock.NewRows([]string{"login", "name", "organisation", "profile", "status", "locked", "must_change_password", "last_login_at", "created_at", "updated_at"}))
	h := handler.NewAdminHandler(sqlx.NewDb(db, "sqlmock"), nil, nil)
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/users", nil)
	rec := httptest.NewRecorder()
	if err := h.ListUsers(e.NewContext(req, rec)); err != nil {
		t.Fatalf("ListUsers failed: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestAdminCreateUserRequiresValidPasswordWhenProvided(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	h := handler.NewAdminHandler(sqlx.NewDb(db, "sqlmock"), nil, nil)
	e := echo.New()
	e.Validator = &testValidator{}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/users", strings.NewReader(`{"login":"a@example.com","name":"A","organisation":"admin","profile":"admin","password":"weak"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	err = h.CreateUser(e.NewContext(req, rec))
	if err == nil {
		t.Fatal("expected validation/policy error")
	}
}

func TestAlertMergeRequiresTarget(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT id::text AS id, title").WithArgs("00000000-0000-0000-0000-000000000001").WillReturnRows(sqlmock.NewRows([]string{"id", "title", "type", "source", "source_ref", "severity", "tlp", "status", "read", "case_id", "tags", "created_at", "updated_at"}).AddRow("00000000-0000-0000-0000-000000000001", "Alert", "external", "src", "ref", 2, 2, "New", false, nil, "{}", testNow(), testNow()))
	mock.ExpectRollback()

	h := handler.NewAlertWriteHandler(sqlx.NewDb(db, "sqlmock"), nil)
	e := echo.New()
	e.Validator = &testValidator{}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/alerts/00000000-0000-0000-0000-000000000001/merge", strings.NewReader(`{}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("00000000-0000-0000-0000-000000000001")

	if err := h.Merge(c); err == nil {
		t.Fatal("expected missing target error")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestCreateTaskValidatesRequiredFields(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	h := handler.NewWorkWriteHandler(sqlx.NewDb(db, "sqlmock"), nil)
	e := echo.New()
	e.Validator = &testValidator{}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/tasks", strings.NewReader(`{"case_id":"","title":""}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	if err := h.CreateTask(e.NewContext(req, rec)); err == nil {
		t.Fatal("expected repository validation error")
	}
}

func TestAnalyzeObservablePlaceholderReturnsAcceptedShape(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT id::text AS id, case_id::text AS case_id, alert_id::text AS alert_id").WithArgs("00000000-0000-0000-0000-000000000002").WillReturnRows(observableRows().AddRow("00000000-0000-0000-0000-000000000002", "00000000-0000-0000-0000-000000000003", nil, nil, nil, "domain", "example.org", "", 2, true, false, "{}", "analyst", testNow(), testNow()))
	mock.ExpectQuery("SELECT id::text AS id, case_id::text AS case_id, alert_id::text AS alert_id").WithArgs("00000000-0000-0000-0000-000000000002").WillReturnRows(observableRows().AddRow("00000000-0000-0000-0000-000000000002", "00000000-0000-0000-0000-000000000003", nil, nil, nil, "domain", "example.org", "", 2, true, false, "{}", "analyst", testNow(), testNow()))
	mock.ExpectQuery("INSERT INTO cortex_jobs").WithArgs("00000000-0000-0000-0000-000000000002", "domain", "example.org", "analyst").WillReturnRows(sqlmock.NewRows([]string{"job_id", "observable_id", "analyzer_id", "status", "message", "created_at"}).AddRow("00000000-0000-0000-0000-000000000099", "00000000-0000-0000-0000-000000000002", "placeholder", "queued", "Cortex analyzer job queued; worker execution lands in Phase 6.1", testNow()))
	mock.ExpectCommit()

	h := handler.NewWorkWriteHandler(sqlx.NewDb(db, "sqlmock"), nil)
	e := echo.New()
	e.Validator = &testValidator{}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/observables/00000000-0000-0000-0000-000000000002/analyze", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("00000000-0000-0000-0000-000000000002")

	if err := h.AnalyzeObservable(c); err != nil {
		t.Fatalf("AnalyzeObservable failed: %v", err)
	}
	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", rec.Code)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestAttachmentUploadInitCreatesMetadataAndPresignedURL(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	mock.ExpectQuery("INSERT INTO attachments").WithArgs("00000000-0000-0000-0000-000000000003", "", "", "evidence.txt", "text/plain", int64(12), "thehive-evidence", sqlmock.AnyArg(), "abc123", "system").WillReturnRows(attachmentRows().AddRow("00000000-0000-0000-0000-000000000004", "00000000-0000-0000-0000-000000000003", "", "", "evidence.txt", "evidence.txt", "text/plain", int64(12), "cases/00000000-0000-0000-0000-000000000003/key.txt", "s3", "thehive-evidence", "cases/00000000-0000-0000-0000-000000000003/key.txt", "abc123", "pending", "placeholder", "case-evidence", "system", testNow(), nil, nil))
	mock.ExpectCommit()

	h := handler.NewAttachmentHandler(sqlx.NewDb(db, "sqlmock"), nil, testStorageClient())
	e := echo.New()
	e.Validator = &testValidator{}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/attachments/upload", strings.NewReader(`{"case_id":"00000000-0000-0000-0000-000000000003","file_name":"evidence.txt","content_type":"text/plain","size_bytes":12,"sha256":"abc123"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	if err := h.InitUpload(e.NewContext(req, rec)); err != nil {
		t.Fatalf("InitUpload failed: %v", err)
	}
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "upload_url") || !strings.Contains(rec.Body.String(), "X-Amz-Signature") {
		t.Fatalf("expected presigned upload url in response, got %s", rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestAttachmentDownloadBlocksUntilScanClean(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT id::text AS id").WithArgs("00000000-0000-0000-0000-000000000004").WillReturnRows(attachmentRows().AddRow("00000000-0000-0000-0000-000000000004", "00000000-0000-0000-0000-000000000003", "", "", "evidence.txt", "evidence.txt", "text/plain", int64(12), "cases/00000000-0000-0000-0000-000000000003/key.txt", "s3", "thehive-evidence", "cases/00000000-0000-0000-0000-000000000003/key.txt", "abc123", "pending", "placeholder", "case-evidence", "system", testNow(), nil, nil))
	mock.ExpectCommit()

	h := handler.NewAttachmentHandler(sqlx.NewDb(db, "sqlmock"), nil, testStorageClient())
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/attachments/00000000-0000-0000-0000-000000000004/download", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("00000000-0000-0000-0000-000000000004")

	if err := h.Download(c); err != nil {
		t.Fatalf("Download failed: %v", err)
	}
	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"blocked":true`) {
		t.Fatalf("expected blocked download response, got %s", rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestAttachmentScanCleanAllowsPresignedDownload(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT id::text AS id").WithArgs("00000000-0000-0000-0000-000000000004").WillReturnRows(attachmentRows().AddRow("00000000-0000-0000-0000-000000000004", "00000000-0000-0000-0000-000000000003", "", "", "evidence.txt", "evidence.txt", "text/plain", int64(12), "cases/00000000-0000-0000-0000-000000000003/key.txt", "s3", "thehive-evidence", "cases/00000000-0000-0000-0000-000000000003/key.txt", "abc123", "clean", "placeholder", "case-evidence", "system", testNow(), testNow(), nil))
	mock.ExpectExec("UPDATE attachments SET downloaded_at").WithArgs("00000000-0000-0000-0000-000000000004").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	h := handler.NewAttachmentHandler(sqlx.NewDb(db, "sqlmock"), nil, testStorageClient())
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/attachments/00000000-0000-0000-0000-000000000004/download", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("00000000-0000-0000-0000-000000000004")

	if err := h.Download(c); err != nil {
		t.Fatalf("Download failed: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"blocked":false`) || !strings.Contains(rec.Body.String(), "download_url") {
		t.Fatalf("expected allowed presigned download response, got %s", rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestAttachmentDownloadPolicyCanAllowUnknownInDev(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT id::text AS id").WithArgs("00000000-0000-0000-0000-000000000004").WillReturnRows(attachmentRows().AddRow("00000000-0000-0000-0000-000000000004", "00000000-0000-0000-0000-000000000003", "", "", "evidence.txt", "evidence.txt", "text/plain", int64(12), "cases/00000000-0000-0000-0000-000000000003/key.txt", "s3", "thehive-evidence", "cases/00000000-0000-0000-0000-000000000003/key.txt", "abc123", "unknown", "placeholder", "case-evidence", "system", testNow(), nil, nil))
	mock.ExpectExec("UPDATE attachments SET downloaded_at").WithArgs("00000000-0000-0000-0000-000000000004").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	h := handler.NewAttachmentHandler(sqlx.NewDb(db, "sqlmock"), nil, testStorageClient(), handler.WithAttachmentDownloadPolicy("allow-unknown"))
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/attachments/00000000-0000-0000-0000-000000000004/download", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("00000000-0000-0000-0000-000000000004")

	if err := h.Download(c); err != nil {
		t.Fatalf("Download failed: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"blocked":false`) {
		t.Fatalf("expected dev policy to allow unknown download, got %s", rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestAttachmentZipDownloadBlocksUntilScanClean(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT id::text AS id").WithArgs("00000000-0000-0000-0000-000000000004").WillReturnRows(attachmentRows().AddRow("00000000-0000-0000-0000-000000000004", "00000000-0000-0000-0000-000000000003", "", "", "evidence.txt", "evidence.txt", "text/plain", int64(12), "cases/00000000-0000-0000-0000-000000000003/key.txt", "s3", "thehive-evidence", "cases/00000000-0000-0000-0000-000000000003/key.txt", "abc123", "pending", "placeholder", "case-evidence", "system", testNow(), nil, nil))
	mock.ExpectCommit()

	h := handler.NewAttachmentHandler(sqlx.NewDb(db, "sqlmock"), nil, testStorageClient())
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/attachments/00000000-0000-0000-0000-000000000004/download.zip", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("00000000-0000-0000-0000-000000000004")

	if err := h.DownloadZip(c); err != nil {
		t.Fatalf("DownloadZip failed: %v", err)
	}
	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"blocked":true`) {
		t.Fatalf("expected blocked zip download response, got %s", rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestAttachmentManualScanCanBeDisabled(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	h := handler.NewAttachmentHandler(sqlx.NewDb(db, "sqlmock"), nil, testStorageClient(), handler.WithAttachmentManualScan(false))
	e := echo.New()
	e.Validator = &testValidator{}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/attachments/00000000-0000-0000-0000-000000000004/scan", strings.NewReader(`{"status":"clean","engine":"manual"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("00000000-0000-0000-0000-000000000004")

	if err := h.MarkScanned(c); err == nil {
		t.Fatal("expected manual scan disabled error")
	}
}

func TestAttachmentMarkScannedRejectsUnsupportedStatus(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	h := handler.NewAttachmentHandler(sqlx.NewDb(db, "sqlmock"), nil, testStorageClient())
	e := echo.New()
	e.Validator = &testValidator{}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/attachments/00000000-0000-0000-0000-000000000004/scan", strings.NewReader(`{"status":"weird","engine":"manual"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("00000000-0000-0000-0000-000000000004")

	if err := h.MarkScanned(c); err == nil {
		t.Fatal("expected unsupported scan status error")
	}
}

func TestAttachmentMarkScannedUpdatesStatus(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT id::text AS id").WithArgs("00000000-0000-0000-0000-000000000004").WillReturnRows(attachmentRows().AddRow("00000000-0000-0000-0000-000000000004", "00000000-0000-0000-0000-000000000003", "", "", "evidence.txt", "evidence.txt", "text/plain", int64(12), "cases/00000000-0000-0000-0000-000000000003/key.txt", "s3", "thehive-evidence", "cases/00000000-0000-0000-0000-000000000003/key.txt", "abc123", "pending", "placeholder", "case-evidence", "system", testNow(), nil, nil))
	mock.ExpectQuery("UPDATE attachments SET scan_status").WithArgs("00000000-0000-0000-0000-000000000004", "clean", "clamav-placeholder").WillReturnRows(attachmentRows().AddRow("00000000-0000-0000-0000-000000000004", "00000000-0000-0000-0000-000000000003", "", "", "evidence.txt", "evidence.txt", "text/plain", int64(12), "cases/00000000-0000-0000-0000-000000000003/key.txt", "s3", "thehive-evidence", "cases/00000000-0000-0000-0000-000000000003/key.txt", "abc123", "clean", "clamav-placeholder", "case-evidence", "system", testNow(), testNow(), nil))
	mock.ExpectCommit()

	h := handler.NewAttachmentHandler(sqlx.NewDb(db, "sqlmock"), nil, testStorageClient())
	e := echo.New()
	e.Validator = &testValidator{}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/attachments/00000000-0000-0000-0000-000000000004/scan", strings.NewReader(`{"status":"clean","engine":"clamav-placeholder"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("00000000-0000-0000-0000-000000000004")

	if err := h.MarkScanned(c); err != nil {
		t.Fatalf("MarkScanned failed: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"scan_status":"clean"`) {
		t.Fatalf("expected clean scan response, got %s", rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

type testValidator struct{}

func (*testValidator) Validate(i any) error { return nil }

func observableRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{"id", "case_id", "alert_id", "source_observable_id", "imported_from_alert_id", "data_type", "data", "message", "tlp", "ioc", "sighted", "tags", "created_by", "created_at", "updated_at"})
}

func attachmentRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{"id", "case_id", "observable_id", "log_id", "file_name", "original_name", "content_type", "size_bytes", "storage_key", "storage_backend", "bucket", "object_key", "sha256", "scan_status", "scan_engine", "retention_policy", "uploaded_by", "created_at", "scanned_at", "downloaded_at"})
}

func testStorageClient() *storage.Client {
	return storage.NewClient(storage.Config{Endpoint: "http://minio:9000", PublicEndpoint: "http://localhost:9000", Region: "us-east-1", AccessKeyID: "minioadmin", SecretAccessKey: "minioadmin", Bucket: "thehive-evidence", UsePathStyle: true})
}
