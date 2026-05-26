BEGIN;

-- Add ip_address and user_agent to auth_sessions for session fingerprinting
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;

COMMIT;
