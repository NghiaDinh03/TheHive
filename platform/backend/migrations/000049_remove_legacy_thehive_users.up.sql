BEGIN;

-- Update cases owners from legacy users to ncs_admin@ncsgroup.vn
UPDATE cases SET owner = 'ncs_admin@ncsgroup.vn' WHERE owner IN ('admin@thehive.local', 'ncs.fushion_admin@ncsgroup.vn');

-- Update tasks assignees from legacy users to ncs_admin@ncsgroup.vn
UPDATE task_items SET assignee = 'ncs_admin@ncsgroup.vn' WHERE assignee IN ('admin@thehive.local', 'ncs.fushion_admin@ncsgroup.vn');

-- Update audit logs actors from legacy users to ncs_admin@ncsgroup.vn
UPDATE audit_logs 
SET actor_id = (SELECT id FROM users WHERE login = 'ncs_admin@ncsgroup.vn' LIMIT 1) 
WHERE actor_id IN (SELECT id FROM users WHERE login IN ('admin@thehive.local', 'ncs.fushion_admin@ncsgroup.vn'));

-- Delete reset tokens and sessions
DELETE FROM password_reset_tokens WHERE login IN ('admin@thehive.local', 'ncs.fushion_admin@ncsgroup.vn');
DELETE FROM auth_sessions WHERE login IN ('admin@thehive.local', 'ncs.fushion_admin@ncsgroup.vn');

-- Safely delete legacy users
DELETE FROM users WHERE login IN ('admin@thehive.local', 'ncs.fushion_admin@ncsgroup.vn');

COMMIT;
