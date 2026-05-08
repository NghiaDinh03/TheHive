-- E2: Legacy read-only archive links
-- Stores links to legacy TheHive 4 read-only reference for migrated records
CREATE TABLE IF NOT EXISTS archive_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('case', 'alert', 'observable', 'task')),
    entity_id UUID NOT NULL,
    legacy_url TEXT NOT NULL,
    legacy_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by TEXT NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_archive_links_entity ON archive_links(entity_type, entity_id);
CREATE INDEX idx_archive_links_legacy ON archive_links(legacy_id);
