CREATE TABLE IF NOT EXISTS cortex_analyzer_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analyzer_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '',
    data_types TEXT[] NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cortex_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observable_id UUID REFERENCES observables(id),
    analyzer_id TEXT NOT NULL DEFAULT 'placeholder',
    status TEXT NOT NULL DEFAULT 'queued',
    request JSONB NOT NULL DEFAULT '{}'::jsonb,
    report JSONB NOT NULL DEFAULT '{}'::jsonb,
    error TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cortex_jobs_observable_id ON cortex_jobs(observable_id);
CREATE INDEX IF NOT EXISTS idx_cortex_jobs_status ON cortex_jobs(status);

INSERT INTO cortex_analyzer_catalog (analyzer_id, name, version, data_types, enabled)
VALUES ('placeholder', 'Placeholder Analyzer', '0.1.0-migration', ARRAY['domain','ip','url','hash','mail','filename'], true)
ON CONFLICT (analyzer_id) DO UPDATE SET name = EXCLUDED.name, version = EXCLUDED.version, data_types = EXCLUDED.data_types, enabled = EXCLUDED.enabled, updated_at = now();
