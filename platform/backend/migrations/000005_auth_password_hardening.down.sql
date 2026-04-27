DROP INDEX IF EXISTS idx_users_must_change_password;
DROP INDEX IF EXISTS idx_users_locked;

ALTER TABLE users
    DROP COLUMN IF EXISTS password_algo,
    DROP COLUMN IF EXISTS password_changed_at,
    DROP COLUMN IF EXISTS must_change_password;
