UPDATE users SET password_hash = '', locked = false, last_login_at = NULL WHERE login = 'admin@thehive.local';
ALTER TABLE users DROP COLUMN IF EXISTS last_login_at;
ALTER TABLE users DROP COLUMN IF EXISTS locked;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
