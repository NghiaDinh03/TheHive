-- Phase O.1: Observable ignore_similarity, attachment_id, full_data
-- Phase S.1: Share owner boolean, action_required
-- Phase L.1: Log date field

ALTER TABLE observables ADD COLUMN IF NOT EXISTS ignore_similarity BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE observables ADD COLUMN IF NOT EXISTS attachment_id UUID REFERENCES attachments(id);
ALTER TABLE observables ADD COLUMN IF NOT EXISTS full_data TEXT DEFAULT '';
ALTER TABLE observables ADD COLUMN IF NOT EXISTS organisation_ids UUID[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_observables_ignore_similarity ON observables(ignore_similarity) WHERE ignore_similarity = true;
CREATE INDEX IF NOT EXISTS idx_observables_attachment_id ON observables(attachment_id) WHERE attachment_id IS NOT NULL;

ALTER TABLE case_shares ADD COLUMN IF NOT EXISTS owner BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE case_shares ADD COLUMN IF NOT EXISTS action_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE case_logs ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ;
ALTER TABLE case_logs ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES task_items(id);
ALTER TABLE case_logs ADD COLUMN IF NOT EXISTS attachment_id UUID REFERENCES attachments(id);
ALTER TABLE case_logs ADD COLUMN IF NOT EXISTS organisation_id UUID;
UPDATE case_logs SET date = created_at WHERE date IS NULL;
CREATE INDEX IF NOT EXISTS idx_case_logs_task ON case_logs(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_case_logs_date ON case_logs(date);

-- Observable type registry
CREATE TABLE IF NOT EXISTS observable_types (
    name TEXT PRIMARY KEY,
    is_attachment BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO observable_types (name, is_attachment) VALUES
    ('ip', false), ('domain', false), ('url', false), ('mail', false),
    ('hash', false), ('filename', false), ('fqdn', false), ('uri_path', false),
    ('user-agent', false), ('regexp', false), ('other', false), ('file', true),
    ('registry', false), ('autonomous-system', false), ('hostname', false)
ON CONFLICT DO NOTHING;

-- Alert custom fields (Phase A.1)
CREATE TABLE IF NOT EXISTS alert_custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    field_type TEXT NOT NULL DEFAULT 'string',
    field_order INT NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(alert_id, name)
);
