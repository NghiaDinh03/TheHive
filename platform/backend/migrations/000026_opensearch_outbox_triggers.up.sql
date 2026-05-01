-- OpenSearch outbox triggers: automatically insert into search_outbox when entities are created/updated/deleted.
-- This ensures the indexer worker picks up all changes without application code needing to write to the outbox.

-- Generic trigger function that inserts into search_outbox
CREATE OR REPLACE FUNCTION fn_search_outbox_notify()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO search_outbox (entity_type, entity_id, action)
        VALUES (TG_ARGV[0], OLD.id, 'delete');
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO search_outbox (entity_type, entity_id, action)
        VALUES (TG_ARGV[0], NEW.id, 'update');
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO search_outbox (entity_type, entity_id, action)
        VALUES (TG_ARGV[0], NEW.id, 'index');
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Cases outbox trigger
CREATE TRIGGER trg_cases_search_outbox
    AFTER INSERT OR UPDATE OR DELETE ON cases
    FOR EACH ROW EXECUTE FUNCTION fn_search_outbox_notify('cases');

-- Alerts outbox trigger
CREATE TRIGGER trg_alerts_search_outbox
    AFTER INSERT OR UPDATE OR DELETE ON alerts
    FOR EACH ROW EXECUTE FUNCTION fn_search_outbox_notify('alerts');

-- Observables outbox trigger
CREATE TRIGGER trg_observables_search_outbox
    AFTER INSERT OR UPDATE OR DELETE ON observables
    FOR EACH ROW EXECUTE FUNCTION fn_search_outbox_notify('observables');

-- Tasks outbox trigger
CREATE TRIGGER trg_tasks_search_outbox
    AFTER INSERT OR UPDATE OR DELETE ON task_items
    FOR EACH ROW EXECUTE FUNCTION fn_search_outbox_notify('tasks');

-- Logs outbox trigger
CREATE TRIGGER trg_logs_search_outbox
    AFTER INSERT OR UPDATE OR DELETE ON case_logs
    FOR EACH ROW EXECUTE FUNCTION fn_search_outbox_notify('logs');

-- Extend existing notification_configs table for trigger-based notification emission.
-- Migration 000023 created legacy-compatible columns named trigger/notifier; these generated
-- columns let newer queue code query trigger_type/adapter_type without losing old data.
ALTER TABLE notification_configs
    ADD COLUMN IF NOT EXISTS trigger_type TEXT GENERATED ALWAYS AS (trigger) STORED;

ALTER TABLE notification_configs
    ADD COLUMN IF NOT EXISTS adapter_type TEXT GENERATED ALWAYS AS (notifier) STORED;

ALTER TABLE notification_configs
    ADD COLUMN IF NOT EXISTS max_retries INT NOT NULL DEFAULT 3;

ALTER TABLE notification_configs
    ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'system';

CREATE INDEX IF NOT EXISTS idx_notification_configs_trigger ON notification_configs (trigger_type, enabled);
