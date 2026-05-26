CREATE TABLE IF NOT EXISTS autonomous_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    observable_type VARCHAR(50) NOT NULL,
    threat_score_threshold INT NOT NULL DEFAULT 80,
    webhook_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS autonomous_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES autonomous_rules(id) ON DELETE CASCADE,
    rule_name VARCHAR(100) NOT NULL,
    observable_id UUID NOT NULL,
    observable_type VARCHAR(50) NOT NULL,
    observable_value TEXT NOT NULL,
    threat_score INT NOT NULL,
    action_taken VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    response_payload TEXT,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE task_items ADD COLUMN IF NOT EXISTS playbook_name TEXT NOT NULL DEFAULT '';
ALTER TABLE task_items ADD COLUMN IF NOT EXISTS playbook_webhook TEXT NOT NULL DEFAULT '';

