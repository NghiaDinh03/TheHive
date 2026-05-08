-- Migration 000030: Add TOTP 2FA columns to users table
-- Mirrors legacy TheHive 4 TOTP support (auth/totp/set, auth/totp/unset)

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;
