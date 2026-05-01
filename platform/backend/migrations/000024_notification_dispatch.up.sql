-- Notification dispatch queue and delivery log.
-- Supports webhook and email adapters with retry/dead-letter policy.

CREATE TABLE IF NOT EXISTS notification_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id       UUID NOT NULL,
    trigger_type    TEXT NOT NULL,       -- e.g. 'case.create', 'alert.create', 'task.assign'
    entity_type     TEXT NOT NULL,       -- 'case', 'alert', 'task', 'observable'
    entity_id       UUID NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending, sending, sent, failed, dead
    adapter_type    TEXT NOT NULL DEFAULT 'webhook',   -- webhook, email
    retry_count     INT NOT NULL DEFAULT 0,
    max_retries     INT NOT NULL DEFAULT 3,
    last_error      TEXT NOT NULL DEFAULT '',
    next_retry_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue (status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_config ON notification_queue (config_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_entity ON notification_queue (entity_type, entity_id);

-- Delivery log for audit/metrics
CREATE TABLE IF NOT EXISTS notification_delivery_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id        UUID NOT NULL REFERENCES notification_queue(id) ON DELETE CASCADE,
    attempt         INT NOT NULL DEFAULT 1,
    status          TEXT NOT NULL,       -- sent, failed
    response_code   INT,
    response_body   TEXT NOT NULL DEFAULT '',
    error_message   TEXT NOT NULL DEFAULT '',
    duration_ms     INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_queue ON notification_delivery_log (queue_id);
