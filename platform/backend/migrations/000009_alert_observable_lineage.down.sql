DROP INDEX IF EXISTS idx_task_items_case_group_order;
DROP INDEX IF EXISTS idx_observables_case_type_data_active;
DROP INDEX IF EXISTS idx_observables_imported_from_alert_id;
DROP INDEX IF EXISTS idx_observables_source_observable_id;
DROP INDEX IF EXISTS idx_observables_alert_id;

ALTER TABLE observables
    DROP COLUMN IF EXISTS lineage,
    DROP COLUMN IF EXISTS imported_from_alert_id,
    DROP COLUMN IF EXISTS source_observable_id,
    DROP COLUMN IF EXISTS alert_id;
