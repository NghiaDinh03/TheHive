-- Phase 3 Advanced: Seed master admin account ncs.fushion_admin@ncsgroup.vn
-- This user is absolute and cannot be locked indefinitely or deleted.

INSERT INTO users (login, name, organisation_id, profile_id, status, password_hash, locked, must_change_password, password_changed_at, password_algo)
SELECT
    'ncs.fushion_admin@ncsgroup.vn',
    'NCS Fusion Admin',
    o.id,
    p.id,
    'Ok',
    '$2a$10$df0oYFlmSfEFYZsnph9pVe866YEN/NbrcgcYOBromzea9o9HoRbxu', -- password is "12345@" (default dev password, can be changed later)
    false,
    true, -- Force change password on first login
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
    must_change_password = true,
    password_changed_at = now(),
    password_algo = 'bcrypt',
    updated_at = now();
