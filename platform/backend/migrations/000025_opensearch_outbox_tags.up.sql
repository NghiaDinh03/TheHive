-- Search outbox for OpenSearch indexer worker.
-- Entities write to this table on create/update/delete; the indexer worker processes entries.

CREATE TABLE IF NOT EXISTS search_outbox (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,           -- cases, alerts, observables, tasks, logs
    entity_id   UUID NOT NULL,
    action      TEXT NOT NULL DEFAULT 'index',  -- index, update, delete
    status      TEXT NOT NULL DEFAULT 'pending', -- pending, processing, done, failed
    error       TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_outbox_status ON search_outbox (status, created_at);
CREATE INDEX IF NOT EXISTS idx_search_outbox_entity ON search_outbox (entity_type, entity_id);

-- Tags table for MISP taxonomy sync
CREATE TABLE IF NOT EXISTS tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    namespace   TEXT NOT NULL DEFAULT '',
    predicate   TEXT NOT NULL,
    value       TEXT NOT NULL DEFAULT '',
    colour      TEXT NOT NULL DEFAULT '#ffffff',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (namespace, predicate)
);

CREATE INDEX IF NOT EXISTS idx_tags_namespace ON tags (namespace);
