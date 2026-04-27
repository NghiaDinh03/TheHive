ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

INSERT INTO organisations (name, description)
VALUES ('admin', 'Default administration organisation')
ON CONFLICT (name) DO NOTHING;

INSERT INTO profiles (name, permissions)
VALUES (
    'admin',
    ARRAY[
        'manageOrganisation',
        'manageUser',
        'manageCase',
        'manageAlert',
        'manageObservable',
        'manageTask',
        'manageProcedure',
        'managePage',
        'manageConfig',
        'accessTheHiveFS',
        'manageAction'
    ]
)
ON CONFLICT (name) DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = now();

INSERT INTO users (login, name, organisation_id, profile_id, status, password_hash)
SELECT
    'admin@thehive.local',
    'Administrator',
    o.id,
    p.id,
    'Ok',
    '$2a$10$placeholder-change-on-first-login'
FROM organisations o
CROSS JOIN profiles p
WHERE o.name = 'admin' AND p.name = 'admin'
ON CONFLICT (login) DO NOTHING;
