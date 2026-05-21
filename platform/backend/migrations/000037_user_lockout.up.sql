-- Phase 3: Add locked_until for temporary lockouts and brute-force protection
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
