-- Rollback migration 000030: Remove TOTP 2FA columns from users table

ALTER TABLE users DROP COLUMN IF EXISTS totp_secret;
ALTER TABLE users DROP COLUMN IF EXISTS totp_enabled;
ALTER TABLE users DROP COLUMN IF EXISTS failed_attempts;
