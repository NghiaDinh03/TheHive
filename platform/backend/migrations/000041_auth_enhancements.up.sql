BEGIN;

-- 1. Move users from 'admin' to 'NCS' if both exist, then remove 'admin'
DO $$
DECLARE
    ncs_id uuid;
    admin_id uuid;
BEGIN
    SELECT id INTO ncs_id FROM organisations WHERE name = 'NCS' LIMIT 1;
    SELECT id INTO admin_id FROM organisations WHERE name = 'admin' LIMIT 1;

    IF ncs_id IS NOT NULL AND admin_id IS NOT NULL THEN
        UPDATE users SET organisation_id = ncs_id, updated_at = now() WHERE organisation_id = admin_id;
        DELETE FROM organisations WHERE id = admin_id;
    ELSIF admin_id IS NOT NULL AND ncs_id IS NULL THEN
        UPDATE organisations SET name = 'NCS', updated_at = now() WHERE id = admin_id;
    END IF;
END $$;

-- 2. Lock the typo user instead of deleting to avoid Foreign Key violations
UPDATE users 
SET status = 'Locked', locked = true, updated_at = now() 
WHERE login = 'ncs.fushion_admin@ncsgroup.vn';

-- 3. Add columns for Session Duration and Force 2FA
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_duration_hours INT NOT NULL DEFAULT 4;
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_2fa BOOLEAN NOT NULL DEFAULT false;

COMMIT;
