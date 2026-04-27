-- Phase 1 baseline schema.
-- Keep this migration immutable; all later changes are new migration files.

CREATE TABLE IF NOT EXISTS app_metadata (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_metadata (key, value)
VALUES
    ('app_version',       '0.1.0'),
    ('schema_baseline',   '1'),
    ('search_index_ver',  '0')
ON CONFLICT (key) DO NOTHING;

-- Audit trail for any data-mutating operation. Phase 2+ will start writing rows.
CREATE TABLE IF NOT EXISTS audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id      UUID,
    action        TEXT NOT NULL,
    entity_type   TEXT NOT NULL,
    entity_id     TEXT,
    before_json   JSONB,
    after_json    JSONB,
    request_id    TEXT,
    ip_address    INET,
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity     ON audit_logs (entity_type, entity_id);

-- IOC table for Cortex/MISP integration in later phases.
-- This table is created up-front so that the integration plan and analytics queries can stabilise.
CREATE TABLE IF NOT EXISTS iocs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ioc_type        TEXT NOT NULL,           -- ip, domain, url, hash, email, file
    ioc_value       TEXT NOT NULL,
    source          TEXT NOT NULL,           -- misp, cortex, manual, alert, case
    source_event_id TEXT,
    source_attr_id  TEXT,
    confidence      SMALLINT NOT NULL DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
    severity        SMALLINT NOT NULL DEFAULT 0 CHECK (severity BETWEEN 0 AND 4),
    tags            TEXT[]      NOT NULL DEFAULT '{}',
    tlp             SMALLINT    NOT NULL DEFAULT 2 CHECK (tlp BETWEEN 0 AND 4),
    pap             SMALLINT    NOT NULL DEFAULT 2 CHECK (pap BETWEEN 0 AND 4),
    first_seen      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen       TIMESTAMPTZ NOT NULL DEFAULT now(),
    sightings       BIGINT      NOT NULL DEFAULT 1,
    enrichment      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_iocs_type_value_source
    ON iocs (ioc_type, ioc_value, source);

CREATE INDEX IF NOT EXISTS idx_iocs_value      ON iocs (ioc_value);
CREATE INDEX IF NOT EXISTS idx_iocs_type       ON iocs (ioc_type);
CREATE INDEX IF NOT EXISTS idx_iocs_source     ON iocs (source);
CREATE INDEX IF NOT EXISTS idx_iocs_is_active  ON iocs (is_active);
CREATE INDEX IF NOT EXISTS idx_iocs_tags_gin   ON iocs USING GIN (tags);

-- Outbox pattern table for reliable RabbitMQ publish in later phases.
CREATE TABLE IF NOT EXISTS outbox_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate     TEXT NOT NULL,
    aggregate_id  TEXT NOT NULL,
    event_type    TEXT NOT NULL,
    payload       JSONB NOT NULL,
    routing_key   TEXT NOT NULL,
    exchange      TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','failed')),
    attempts      INT  NOT NULL DEFAULT 0,
    last_error    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON outbox_events (status, created_at);
