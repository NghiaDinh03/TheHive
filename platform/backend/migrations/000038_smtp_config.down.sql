-- Rollback Phase 4: Remove smtp_config from ui_settings
DELETE FROM ui_settings WHERE key = 'smtp_config';
