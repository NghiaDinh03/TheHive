-- Phase 4: Seed SMTP configuration in ui_settings
INSERT INTO ui_settings (key, value)
VALUES ('smtp_config', '{"host": "", "port": 587, "user": "", "pass": "", "from": "", "enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
