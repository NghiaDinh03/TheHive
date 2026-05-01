ALTER TABLE observables
    ADD COLUMN IF NOT EXISTS alert_id UUID REFERENCES alerts(id),
    ADD COLUMN IF NOT EXISTS source_observable_id UUID REFERENCES observables(id),
    ADD COLUMN IF NOT EXISTS imported_from_alert_id UUID REFERENCES alerts(id),
    ADD COLUMN IF NOT EXISTS lineage JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_observables_alert_id ON observables(alert_id);
CREATE INDEX IF NOT EXISTS idx_observables_source_observable_id ON observables(source_observable_id);
CREATE INDEX IF NOT EXISTS idx_observables_imported_from_alert_id ON observables(imported_from_alert_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_observables_case_type_data_active ON observables(case_id, lower(data_type), lower(data)) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_items_case_group_order ON task_items(case_id, group_name, order_index);
