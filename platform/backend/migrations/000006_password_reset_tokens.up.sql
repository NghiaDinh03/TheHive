CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    login TEXT NOT NULL REFERENCES users(login) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    requested_by TEXT NOT NULL DEFAULT 'self-service',
    delivery TEXT NOT NULL DEFAULT 'email-placeholder',
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_login ON password_reset_tokens(lower(login));
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_active ON password_reset_tokens(token_hash, expires_at) WHERE used_at IS NULL;
