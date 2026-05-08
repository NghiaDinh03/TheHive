-- Feature flags for org/team/user rollout
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT false,
    scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'organisation', 'user')),
    scope_id TEXT, -- organisation_id or user login when scope != global
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feature_flags_name ON feature_flags(name);
CREATE INDEX idx_feature_flags_scope ON feature_flags(scope, scope_id);
