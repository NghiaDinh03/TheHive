-- 000023 down: drop MISP/Cortex/notification/dashboard/page tables
DROP TABLE IF EXISTS pages;
DROP TABLE IF EXISTS dashboards;
DROP TABLE IF EXISTS notification_configs;
DROP TABLE IF EXISTS misp_sync_log;
DROP TABLE IF EXISTS misp_servers;

ALTER TABLE cortex_jobs DROP COLUMN IF EXISTS started_at;
ALTER TABLE cortex_jobs DROP COLUMN IF EXISTS completed_at;
ALTER TABLE cortex_jobs DROP COLUMN IF EXISTS worker_id;
ALTER TABLE cortex_jobs DROP COLUMN IF EXISTS retry_count;
ALTER TABLE cortex_jobs DROP COLUMN IF EXISTS max_retries;
