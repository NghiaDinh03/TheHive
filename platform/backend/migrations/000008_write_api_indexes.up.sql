CREATE INDEX IF NOT EXISTS idx_task_items_case_id ON task_items(case_id);
CREATE INDEX IF NOT EXISTS idx_task_items_status ON task_items(status);
CREATE INDEX IF NOT EXISTS idx_case_logs_case_id_created_at ON case_logs(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_logs_task_id ON case_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_alerts_case_id ON alerts(case_id);
