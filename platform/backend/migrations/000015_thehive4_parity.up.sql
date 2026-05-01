-- TheHive 4 parity migration: cases, tasks, alerts, observables, shares.
-- Phase C.1, T.1, A.1, O.1, S.1 of the parity matrix.
-- Idempotent: every column/index uses IF NOT EXISTS so re-running on partial environments stays safe.

-- ----- Phase C.1: Case schema parity -----
ALTER TABLE cases
    ADD COLUMN IF NOT EXISTS flag BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS impact_status TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS resolution_status TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS case_template TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS owning_organisation TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS organisation_ids TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES cases(id),
    ADD COLUMN IF NOT EXISTS merged_from UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_cases_flag ON cases(flag);
CREATE INDEX IF NOT EXISTS idx_cases_severity ON cases(severity);
CREATE INDEX IF NOT EXISTS idx_cases_tlp ON cases(tlp);
CREATE INDEX IF NOT EXISTS idx_cases_pap ON cases(pap);
CREATE INDEX IF NOT EXISTS idx_cases_assignee ON cases(assignee);
CREATE INDEX IF NOT EXISTS idx_cases_owning_organisation ON cases(owning_organisation);
CREATE INDEX IF NOT EXISTS idx_cases_organisation_ids ON cases USING GIN(organisation_ids);
CREATE INDEX IF NOT EXISTS idx_cases_impact_status ON cases(impact_status);
CREATE INDEX IF NOT EXISTS idx_cases_resolution_status ON cases(resolution_status);
CREATE INDEX IF NOT EXISTS idx_cases_case_template ON cases(case_template);
CREATE INDEX IF NOT EXISTS idx_cases_start_date ON cases(start_date);
CREATE INDEX IF NOT EXISTS idx_cases_end_date ON cases(end_date);
CREATE INDEX IF NOT EXISTS idx_cases_title_lower ON cases(lower(title));

-- ----- Phase T.1: Task schema parity -----
ALTER TABLE task_items
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS flag BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS organisation_ids TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_task_items_flag ON task_items(flag);
CREATE INDEX IF NOT EXISTS idx_task_items_assignee ON task_items(assignee);
CREATE INDEX IF NOT EXISTS idx_task_items_status ON task_items(status);
CREATE INDEX IF NOT EXISTS idx_task_items_due_date ON task_items(due_date);
CREATE INDEX IF NOT EXISTS idx_task_items_organisation_ids ON task_items USING GIN(organisation_ids);

-- ----- Phase A.1: Alert schema parity -----
ALTER TABLE alerts
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS external_link TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS last_sync_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pap INTEGER NOT NULL DEFAULT 2,
    ADD COLUMN IF NOT EXISTS follow BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS flag BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS organisation_id TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS case_template TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_alerts_pap ON alerts(pap);
CREATE INDEX IF NOT EXISTS idx_alerts_follow ON alerts(follow);
CREATE INDEX IF NOT EXISTS idx_alerts_flag ON alerts(flag);
CREATE INDEX IF NOT EXISTS idx_alerts_organisation_id ON alerts(organisation_id);
CREATE INDEX IF NOT EXISTS idx_alerts_case_template ON alerts(case_template);
CREATE INDEX IF NOT EXISTS idx_alerts_last_sync_date ON alerts(last_sync_date);
CREATE INDEX IF NOT EXISTS idx_alerts_updated_at ON alerts(updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_dedup_org ON alerts(type, source, source_ref, organisation_id) WHERE source_ref <> '';

-- ----- Phase O.1: Observable schema parity -----
ALTER TABLE observables
    ADD COLUMN IF NOT EXISTS ignore_similarity BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS attachment_id UUID REFERENCES attachments(id),
    ADD COLUMN IF NOT EXISTS full_data TEXT,
    ADD COLUMN IF NOT EXISTS data_hash TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS organisation_ids TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_observables_ignore_similarity ON observables(ignore_similarity);
CREATE INDEX IF NOT EXISTS idx_observables_attachment_id ON observables(attachment_id);
CREATE INDEX IF NOT EXISTS idx_observables_data_hash ON observables(data_hash);
CREATE INDEX IF NOT EXISTS idx_observables_organisation_ids ON observables USING GIN(organisation_ids);
CREATE INDEX IF NOT EXISTS idx_observables_ioc ON observables(ioc);
CREATE INDEX IF NOT EXISTS idx_observables_sighted ON observables(sighted);
CREATE INDEX IF NOT EXISTS idx_observables_tlp ON observables(tlp);

-- ----- Phase S.1: Share semantics parity -----
-- The case_shares table from migration 000014 already has organisation/profile/task_rule/observable_rule.
-- We only add the legacy boolean flags here so we keep backward compatibility with the existing read API.
ALTER TABLE case_shares
    ADD COLUMN IF NOT EXISTS owner BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS task_action_required BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_case_shares_owner ON case_shares(owner);
CREATE INDEX IF NOT EXISTS idx_case_shares_task_action_required ON case_shares(task_action_required);

-- Promote the first share of each case to owner if no owner exists yet, so legacy data without explicit owner stays sane.
UPDATE case_shares cs
SET owner = true
WHERE cs.id = (
    SELECT s.id FROM case_shares s
    WHERE s.case_id = cs.case_id
    ORDER BY s.created_at ASC, s.id ASC
    LIMIT 1
)
AND NOT EXISTS (
    SELECT 1 FROM case_shares ss WHERE ss.case_id = cs.case_id AND ss.owner = true
);
