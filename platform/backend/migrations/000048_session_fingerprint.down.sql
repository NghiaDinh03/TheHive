BEGIN;

-- Remove ip_address and user_agent from auth_sessions
ALTER TABLE auth_sessions DROP COLUMN IF EXISTS ip_address;
ALTER TABLE auth_sessions DROP COLUMN IF EXISTS user_agent;

COMMIT;
