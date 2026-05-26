-- Migration 000042: Down migration to clean up Playbook tables and Observable additions

DROP TABLE IF EXISTS playbook_steps CASCADE;
DROP TABLE IF EXISTS playbook_runs CASCADE;

ALTER TABLE observables DROP COLUMN IF EXISTS malicious_score;
ALTER TABLE observables DROP COLUMN IF EXISTS misp_tags;
