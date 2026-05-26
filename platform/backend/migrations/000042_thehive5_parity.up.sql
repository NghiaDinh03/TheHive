-- Migration 000042: Add TheHive 5 parity database schemas (Playbook runs, Playbook steps, Observable enhancements)
-- Author: Antigravity AI Agent
-- Project: NCS Fusion Center

ALTER TABLE observables ADD COLUMN IF NOT EXISTS malicious_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE observables ADD COLUMN IF NOT EXISTS misp_tags JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS playbook_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playbook_runs_case_id ON playbook_runs(case_id);

CREATE TABLE IF NOT EXISTS playbook_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_run_id UUID NOT NULL REFERENCES playbook_runs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    message TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playbook_steps_run_id ON playbook_steps(playbook_run_id);
