ALTER TABLE users
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS password_algo TEXT NOT NULL DEFAULT 'bcrypt';

UPDATE users
SET must_change_password = true,
    updated_at = now()
WHERE login = 'admin@thehive.local'
  AND password_hash = '$2a$10$placeholder-change-on-first-login';

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

CREATE INDEX IF NOT EXISTS idx_users_locked ON users(locked);
CREATE INDEX IF NOT EXISTS idx_users_must_change_password ON users(must_change_password);
