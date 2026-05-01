-- Reconcile the documented self-host administrator account for existing dev/staging databases.
-- This is intentionally a new migration because 000005 may already be applied on persisted Docker volumes.
INSERT INTO users (login, name, organisation_id, profile_id, status, password_hash, locked, must_change_password, password_changed_at, password_algo)
SELECT
    'nghia.dinh@ncsgroup.vn',
    'Nghia Dinh',
    o.id,
    p.id,
    'Ok',
    '$2a$10$df0oYFlmSfEFYZsnph9pVe866YEN/NbrcgcYOBromzea9o9HoRbxu',
    false,
    false,
    now(),
    'bcrypt'
FROM organisations o
CROSS JOIN profiles p
WHERE o.name = 'admin' AND p.name = 'admin'
ON CONFLICT (login) DO UPDATE SET
    name = EXCLUDED.name,
    organisation_id = EXCLUDED.organisation_id,
    profile_id = EXCLUDED.profile_id,
    status = 'Ok',
    password_hash = EXCLUDED.password_hash,
    locked = false,
    must_change_password = false,
    password_changed_at = now(),
    password_algo = 'bcrypt',
    updated_at = now();
