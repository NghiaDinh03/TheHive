BEGIN;

-- =============================================================================
-- RBAC Setup: Organisations, Profiles, Users
-- =============================================================================

-- 1. Create PVO organisation
INSERT INTO organisations (name, description, created_at, updated_at) VALUES
  ('PVO', 'PVO Corporation — client organisation', now(), now())
ON CONFLICT (name) DO NOTHING;

-- 2. Create profile: org-admin
INSERT INTO profiles (name, permissions, created_at, updated_at) VALUES
  ('org-admin', ARRAY[
    'manageCase','manageAlert','manageObservable','manageTask',
    'manageUser','manageTag','manageCustomField','manageTemplate',
    'managePage','manageDashboard','manageNotification','manageTaxonomy',
    'managePattern','manageAction'
  ], now(), now())
ON CONFLICT (name) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  updated_at = now();

-- 3. Create profile: client
INSERT INTO profiles (name, permissions, created_at, updated_at) VALUES
  ('client', ARRAY[
    'manageCase','manageTask'
  ], now(), now())
ON CONFLICT (name) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  updated_at = now();

-- 4. Clear sessions for admin@thehive.local before renaming
DELETE FROM auth_sessions WHERE login = 'admin@thehive.local';

-- 5. Replace admin@thehive.local → ncs_admin@ncsgroup.vn (super admin)
UPDATE users SET
  login = 'ncs_admin@ncsgroup.vn',
  name = 'NCS Administrator',
  organisation_id = (SELECT id FROM organisations WHERE name = 'NCSGroup' LIMIT 1),
  profile_id = (SELECT id FROM profiles WHERE name = 'admin' LIMIT 1),
  status = 'Ok',
  locked = false,
  must_change_password = false,
  password_hash = '$2a$10$JIxik0.d1jEmIoDAUWTKUeR4kSul1ka.q6ef7Q4HA9U8ULDjBmeoa',
  password_algo = 'bcrypt',
  updated_at = now()
WHERE login = 'admin@thehive.local';

-- 6. Reassign nghia.dinh to org-admin profile under NCSGroup
UPDATE users SET
  organisation_id = (SELECT id FROM organisations WHERE name = 'NCSGroup' LIMIT 1),
  profile_id = (SELECT id FROM profiles WHERE name = 'org-admin' LIMIT 1),
  updated_at = now()
WHERE login = 'nghia.dinh@ncsgroup.vn';

-- 7. Create user dat.tran@pvo.com.vn (PVO org, org-admin profile)
INSERT INTO users (login, name, organisation_id, profile_id, status, password_hash, password_algo, must_change_password, locked, created_at, updated_at)
SELECT
  'dat.tran@pvo.com.vn',
  'Dat Tran',
  (SELECT id FROM organisations WHERE name = 'PVO' LIMIT 1),
  (SELECT id FROM profiles WHERE name = 'org-admin' LIMIT 1),
  'Ok',
  '$2a$10$JIxik0.d1jEmIoDAUWTKUeR4kSul1ka.q6ef7Q4HA9U8ULDjBmeoa',
  'bcrypt',
  false,
  false,
  now(), now()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE login = 'dat.tran@pvo.com.vn');

-- 8. Clear sessions for QA users then remove them
DELETE FROM auth_sessions WHERE login IN ('qa2@thehive.local', 'qa3@thehive.local');
DELETE FROM users WHERE login IN ('qa2@thehive.local', 'qa3@thehive.local');

-- 9. Clean up test organisations (keep only NCSGroup, PVO, admin)
DELETE FROM organisations WHERE name IN ('test-org-1', 'test-org-2', 'Finance', 'IT Operations', 'NCS SOC');

COMMIT;
