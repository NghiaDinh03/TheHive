DROP INDEX IF EXISTS idx_attachments_bucket_object_key;
DROP INDEX IF EXISTS idx_attachments_uploaded_by;
DROP INDEX IF EXISTS idx_attachments_scan_status;
DROP INDEX IF EXISTS idx_attachments_log_id;
DROP INDEX IF EXISTS idx_attachments_observable_id;
DROP INDEX IF EXISTS idx_attachments_case_id;

ALTER TABLE attachments
    DROP COLUMN IF EXISTS scanned_at,
    DROP COLUMN IF EXISTS downloaded_at,
    DROP COLUMN IF EXISTS uploaded_by,
    DROP COLUMN IF EXISTS retention_policy,
    DROP COLUMN IF EXISTS object_key,
    DROP COLUMN IF EXISTS bucket,
    DROP COLUMN IF EXISTS storage_backend,
    DROP COLUMN IF EXISTS scan_result,
    DROP COLUMN IF EXISTS scan_engine,
    DROP COLUMN IF EXISTS scan_status,
    DROP COLUMN IF EXISTS sha256,
    DROP COLUMN IF EXISTS original_name,
    DROP COLUMN IF EXISTS log_id;
