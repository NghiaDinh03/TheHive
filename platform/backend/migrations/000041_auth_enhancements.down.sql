BEGIN;

ALTER TABLE users DROP COLUMN IF EXISTS force_2fa;
ALTER TABLE users DROP COLUMN IF EXISTS session_duration_hours;

UPDATE organisations
SET name = 'admin', updated_at = now()
WHERE name = 'NCS';

COMMIT;
