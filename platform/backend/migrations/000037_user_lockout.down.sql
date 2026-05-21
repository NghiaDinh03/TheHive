-- Rollback Phase 3: Add locked_until
ALTER TABLE users DROP COLUMN IF EXISTS locked_until;
