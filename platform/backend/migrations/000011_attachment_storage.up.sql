ALTER TABLE attachments
    ADD COLUMN IF NOT EXISTS log_id UUID REFERENCES case_logs(id),
    ADD COLUMN IF NOT EXISTS original_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS sha256 TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS scan_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS scan_engine TEXT NOT NULL DEFAULT 'placeholder',
    ADD COLUMN IF NOT EXISTS scan_result JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS storage_backend TEXT NOT NULL DEFAULT 's3',
    ADD COLUMN IF NOT EXISTS bucket TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS object_key TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS retention_policy TEXT NOT NULL DEFAULT 'case-evidence',
    ADD COLUMN IF NOT EXISTS uploaded_by TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS downloaded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ;

UPDATE attachments
SET original_name = file_name
WHERE original_name = '';

UPDATE attachments
SET object_key = storage_key
WHERE object_key = '';

CREATE INDEX IF NOT EXISTS idx_attachments_case_id ON attachments(case_id);
CREATE INDEX IF NOT EXISTS idx_attachments_observable_id ON attachments(observable_id);
CREATE INDEX IF NOT EXISTS idx_attachments_log_id ON attachments(log_id);
CREATE INDEX IF NOT EXISTS idx_attachments_scan_status ON attachments(scan_status);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON attachments(uploaded_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attachments_bucket_object_key ON attachments(bucket, object_key) WHERE bucket <> '' AND object_key <> '';
