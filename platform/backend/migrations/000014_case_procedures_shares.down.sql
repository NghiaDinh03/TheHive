-- Rollback Phase 4.1.1.F.3 — case procedures and shares
DROP INDEX IF EXISTS idx_case_shares_organisation;
DROP INDEX IF EXISTS idx_case_shares_case_id;
DROP TABLE IF EXISTS case_shares;
DROP INDEX IF EXISTS idx_case_procedures_pattern_id;
DROP INDEX IF EXISTS idx_case_procedures_case_id;
DROP TABLE IF EXISTS case_procedures;
