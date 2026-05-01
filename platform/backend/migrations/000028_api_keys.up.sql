-- Migration 000028: API key storage for personal-settings API key tab.
-- Mirrors TheHive 4 user API key feature (one key per user, hashed SHA-256).

CREATE TABLE IF NOT EXISTS api_keys (
    login       TEXT        NOT NULL PRIMARY KEY REFERENCES users(login) ON DELETE CASCADE,
    key_hash    TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_login ON api_keys(login);
