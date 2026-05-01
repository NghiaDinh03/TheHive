-- 000023: MISP integration tables + Cortex worker enhancements
-- TheHive 4 parity: MISP connector config, import/export audit, Cortex worker state

-- MISP server connections (multi-server support like TheHive 4)
CREATE TABLE IF NOT EXISTS misp_servers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    url         TEXT NOT NULL,
    api_key     TEXT NOT NULL DEFAULT '',
    verify_tls  BOOLEAN NOT NULL DEFAULT true,
    enabled     BOOLEAN NOT NULL DEFAULT true,
    -- TheHive 4 fields
    purpose     TEXT NOT NULL DEFAULT 'ImportAndExport', -- ImportOnly, ExportOnly, ImportAndExport
    case_template TEXT NOT NULL DEFAULT '',
    tags        TEXT[] NOT NULL DEFAULT '{}',
    -- sync tracking
    last_sync_at    TIMESTAMPTZ,
    last_sync_error TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MISP import/export audit log
CREATE TABLE IF NOT EXISTS misp_sync_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id       UUID NOT NULL REFERENCES misp_servers(id) ON DELETE CASCADE,
    direction       TEXT NOT NULL CHECK (direction IN ('import', 'export')),
    misp_event_id   TEXT NOT NULL DEFAULT '',
    alert_id        UUID,
    case_id         UUID,
    observable_count INT NOT NULL DEFAULT 0,
    ioc_count       INT NOT NULL DEFAULT 0,
    skipped_count   INT NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    error           TEXT NOT NULL DEFAULT '',
    created_by      TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_misp_sync_log_server ON misp_sync_log(server_id);
CREATE INDEX IF NOT EXISTS idx_misp_sync_log_direction ON misp_sync_log(direction);
CREATE INDEX IF NOT EXISTS idx_misp_sync_log_created ON misp_sync_log(created_at DESC);

-- Cortex worker state tracking (upgrade from simple process-pending to real worker)
ALTER TABLE cortex_jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE cortex_jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE cortex_jobs ADD COLUMN IF NOT EXISTS worker_id TEXT NOT NULL DEFAULT '';
ALTER TABLE cortex_jobs ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE cortex_jobs ADD COLUMN IF NOT EXISTS max_retries INT NOT NULL DEFAULT 3;

CREATE INDEX IF NOT EXISTS idx_cortex_jobs_status_created ON cortex_jobs(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_cortex_jobs_observable ON cortex_jobs(observable_id);

-- Notification/webhook foundation (TheHive 4 notifiers)
CREATE TABLE IF NOT EXISTS notification_configs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    trigger     TEXT NOT NULL, -- 'AnyEvent', 'CaseCreated', 'AlertCreated', 'TaskAssigned', etc.
    notifier    TEXT NOT NULL, -- 'webhook', 'email', 'mattermost', 'slack'
    config      JSONB NOT NULL DEFAULT '{}',
    enabled     BOOLEAN NOT NULL DEFAULT true,
    organisation_id UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dashboard entity (TheHive 4 dashboards are first-class entities)
CREATE TABLE IF NOT EXISTS dashboards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    definition      JSONB NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'Private', -- Private, Shared
    created_by      TEXT NOT NULL DEFAULT '',
    organisation_id UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboards_org ON dashboards(organisation_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_status ON dashboards(status);

-- Page entity (TheHive 4 knowledge base pages)
CREATE TABLE IF NOT EXISTS pages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    content         TEXT NOT NULL DEFAULT '',
    category        TEXT NOT NULL DEFAULT 'general',
    slug            TEXT NOT NULL DEFAULT '',
    order_index     INT NOT NULL DEFAULT 0,
    organisation_id UUID,
    created_by      TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pages_org ON pages(organisation_id);
CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
