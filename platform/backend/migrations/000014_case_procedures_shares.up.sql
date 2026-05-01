-- Phase 4.1.1.F.3 — Case procedures and shares foundation
-- Reference: TheHive 4 fixtures `thehive/test/resources/data/Procedure.json`, `CaseProcedure.json`,
-- `ProcedurePattern.json` and `Share.json`. We expose minimal columns to render detail tabs and
-- migrate fixture data; richer MITRE pattern linkage and share-profile semantics come later.

CREATE TABLE IF NOT EXISTS case_procedures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    description TEXT NOT NULL DEFAULT '',
    pattern_id TEXT NOT NULL DEFAULT '',
    pattern_name TEXT NOT NULL DEFAULT '',
    tactic TEXT NOT NULL DEFAULT '',
    occurred_at TIMESTAMPTZ,
    created_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_procedures_case_id ON case_procedures(case_id);
CREATE INDEX IF NOT EXISTS idx_case_procedures_pattern_id ON case_procedures(pattern_id);

CREATE TABLE IF NOT EXISTS case_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    organisation TEXT NOT NULL,
    profile TEXT NOT NULL DEFAULT 'read-only',
    task_rule TEXT NOT NULL DEFAULT 'manual',
    observable_rule TEXT NOT NULL DEFAULT 'manual',
    created_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(case_id, organisation)
);

CREATE INDEX IF NOT EXISTS idx_case_shares_case_id ON case_shares(case_id);
CREATE INDEX IF NOT EXISTS idx_case_shares_organisation ON case_shares(organisation);
