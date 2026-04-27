DROP INDEX IF EXISTS idx_password_reset_tokens_purpose;

ALTER TABLE password_reset_tokens
    DROP COLUMN IF EXISTS invited_profile,
    DROP COLUMN IF EXISTS invited_organisation,
    DROP COLUMN IF EXISTS invited_name,
    DROP COLUMN IF EXISTS purpose;

DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs;
DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs;
DROP FUNCTION IF EXISTS prevent_audit_logs_mutation();

DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_entity;
DROP INDEX IF EXISTS idx_audit_logs_actor_id;
DROP INDEX IF EXISTS idx_audit_logs_created_at;
DROP TABLE IF EXISTS audit_logs;
