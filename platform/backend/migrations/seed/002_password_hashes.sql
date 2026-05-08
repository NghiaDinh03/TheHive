-- =============================================================================
-- Password Hashes for Seed Users
-- Purpose: Set bcrypt password hashes so seed users can log in.
-- Default password for all seed users: "12345@"
-- Usage: psql -h localhost -U thehive -d thehive -f seed/002_password_hashes.sql
-- Note: This seed is idempotent — uses UPDATE to set hashes.
-- =============================================================================

BEGIN;

-- bcrypt hash for "12345@" with cost 10 (generated via Go bcrypt.GenerateFromPassword)
UPDATE users SET
  password_hash = '$2a$10$JIxik0.d1jEmIoDAUWTKUeR4kSul1ka.q6ef7Q4HA9U8ULDjBmeoa',
  password_algo = 'bcrypt',
  must_change_password = false,
  status = 'Ok',
  updated_at = now()
WHERE login IN (
  'admin@thehive.local',
  'alice.cert@thehive.local',
  'bob.cert@thehive.local',
  'carol.mssp@thehive.local',
  'dave.finance@thehive.local'
);

-- Also ensure the primary admin account from login hint exists
INSERT INTO organisations (name, description, created_at, updated_at) VALUES
  ('NCSGroup', 'NCS Group — primary operator', now(), now())
ON CONFLICT (name) DO NOTHING;

-- Ensure admin profile exists (use name conflict, not id conflict)
INSERT INTO profiles (id, name, permissions, created_at, updated_at) VALUES
  ('b0000000-0000-0000-0000-000000000004', 'admin',
    ARRAY['managePlatform','manageCase','manageAlert','manageObservable','manageTask','manageUser','manageOrganisation','manageProfile','manageTag','manageCustomField','manageTemplate','managePage','manageDashboard','manageNotification','manageTaxonomy','managePattern','manageConfig','manageAction'],
    now(), now())
ON CONFLICT (name) DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = now();

INSERT INTO users (login, name, organisation_id, profile_id, status, password_hash, password_algo, must_change_password, created_at, updated_at)
SELECT 'nghia.dinh@ncsgroup.vn', 'Nghia Dinh',
  (SELECT id FROM organisations WHERE name = 'NCSGroup' LIMIT 1),
  (SELECT id FROM profiles WHERE name = 'admin' LIMIT 1),
  'Ok',
  '$2a$10$JIxik0.d1jEmIoDAUWTKUeR4kSul1ka.q6ef7Q4HA9U8ULDjBmeoa',
  'bcrypt',
  false,
  now(), now()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE login = 'nghia.dinh@ncsgroup.vn');

COMMIT;
