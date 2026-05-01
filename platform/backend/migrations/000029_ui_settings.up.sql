CREATE TABLE IF NOT EXISTS ui_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ui_settings (key, value)
VALUES ('hideEmptyCaseButton', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
