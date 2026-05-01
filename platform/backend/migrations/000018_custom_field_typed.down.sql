DROP TABLE IF EXISTS case_template_custom_fields;
DROP TABLE IF EXISTS case_template_tasks;
DROP TABLE IF EXISTS case_templates;

DROP INDEX IF EXISTS idx_custom_fields_field_order;
DROP INDEX IF EXISTS idx_custom_fields_field_type;
DROP INDEX IF EXISTS idx_custom_fields_owner;

ALTER TABLE custom_fields
    DROP COLUMN IF EXISTS date_value,
    DROP COLUMN IF EXISTS float_value,
    DROP COLUMN IF EXISTS integer_value,
    DROP COLUMN IF EXISTS boolean_value,
    DROP COLUMN IF EXISTS string_value,
    DROP COLUMN IF EXISTS field_order,
    DROP COLUMN IF EXISTS field_type;
