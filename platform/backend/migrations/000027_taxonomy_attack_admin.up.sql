-- 000027_taxonomy_attack_admin
-- Adds admin-managed taxonomies (with predicates and entries), a
-- MITRE ATT&CK pattern catalogue, and a custom field definition catalog
-- mirroring TheHive 4 admin partials at
-- frontend/app/views/partials/admin/taxonomy/*, admin/attack/* and
-- admin/custom-fields.html.

CREATE TABLE IF NOT EXISTS custom_field_definitions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reference     text NOT NULL UNIQUE,
    name          text NOT NULL,
    description   text NOT NULL DEFAULT '',
    field_type    text NOT NULL DEFAULT 'string',
    mandatory     boolean NOT NULL DEFAULT false,
    options       text[] NOT NULL DEFAULT '{}',
    created_by    text NOT NULL DEFAULT 'system',
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS taxonomies (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    namespace     text NOT NULL UNIQUE,
    description   text NOT NULL DEFAULT '',
    version       integer NOT NULL DEFAULT 1,
    enabled       boolean NOT NULL DEFAULT true,
    source        text NOT NULL DEFAULT 'manual',
    created_by    text NOT NULL DEFAULT 'system',
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS taxonomy_predicates (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    taxonomy_id   uuid NOT NULL REFERENCES taxonomies(id) ON DELETE CASCADE,
    value         text NOT NULL,
    expanded      text NOT NULL DEFAULT '',
    description   text NOT NULL DEFAULT '',
    UNIQUE (taxonomy_id, value)
);

CREATE TABLE IF NOT EXISTS taxonomy_entries (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    predicate_id  uuid NOT NULL REFERENCES taxonomy_predicates(id) ON DELETE CASCADE,
    value         text NOT NULL,
    expanded      text NOT NULL DEFAULT '',
    colour        text NOT NULL DEFAULT '',
    description   text NOT NULL DEFAULT '',
    UNIQUE (predicate_id, value)
);

CREATE TABLE IF NOT EXISTS attack_patterns (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id    text NOT NULL UNIQUE,
    name          text NOT NULL,
    description   text NOT NULL DEFAULT '',
    tactic        text NOT NULL DEFAULT '',
    kill_chain    text NOT NULL DEFAULT '',
    reference_url text NOT NULL DEFAULT '',
    revoked       boolean NOT NULL DEFAULT false,
    deprecated    boolean NOT NULL DEFAULT false,
    source        text NOT NULL DEFAULT 'manual',
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attack_patterns_tactic ON attack_patterns(tactic);
CREATE INDEX IF NOT EXISTS idx_taxonomy_predicates_tax ON taxonomy_predicates(taxonomy_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_entries_pred ON taxonomy_entries(predicate_id);
