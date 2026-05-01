ALTER TABLE custom_fields
    ADD COLUMN IF NOT EXISTS field_type TEXT NOT NULL DEFAULT 'string',
    ADD COLUMN IF NOT EXISTS field_order INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS string_value TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS boolean_value BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS integer_value BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS float_value DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS date_value TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_custom_fields_owner ON custom_fields(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_field_type ON custom_fields(field_type);
CREATE INDEX IF NOT EXISTS idx_custom_fields_field_order ON custom_fields(field_order);

CREATE TABLE IF NOT EXISTS case_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT '',
    title_prefix TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    severity INTEGER NOT NULL DEFAULT 2,
    tlp INTEGER NOT NULL DEFAULT 2,
    pap INTEGER NOT NULL DEFAULT 2,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS case_template_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES case_templates(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    group_name TEXT NOT NULL DEFAULT 'default',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_template_tasks_template ON case_template_tasks(template_id);

CREATE TABLE IF NOT EXISTS case_template_custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES case_templates(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_type TEXT NOT NULL DEFAULT 'string',
    default_value TEXT NOT NULL DEFAULT '',
    field_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_template_cf_template ON case_template_custom_fields(template_id);
