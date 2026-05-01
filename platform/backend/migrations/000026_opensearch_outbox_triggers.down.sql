-- Reverse OpenSearch outbox triggers and notification trigger compatibility columns

DROP TRIGGER IF EXISTS trg_cases_search_outbox ON cases;
DROP TRIGGER IF EXISTS trg_alerts_search_outbox ON alerts;
DROP TRIGGER IF EXISTS trg_observables_search_outbox ON observables;
DROP TRIGGER IF EXISTS trg_tasks_search_outbox ON task_items;
DROP TRIGGER IF EXISTS trg_logs_search_outbox ON case_logs;

DROP FUNCTION IF EXISTS fn_search_outbox_notify();

DROP INDEX IF EXISTS idx_notification_configs_trigger;
ALTER TABLE notification_configs DROP COLUMN IF EXISTS created_by;
ALTER TABLE notification_configs DROP COLUMN IF EXISTS max_retries;
ALTER TABLE notification_configs DROP COLUMN IF EXISTS adapter_type;
ALTER TABLE notification_configs DROP COLUMN IF EXISTS trigger_type;
