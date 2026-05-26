-- Rollback Migration 000043: Remove NCS Fusion AI Settings & Assessment Schema

ALTER TABLE cases DROP COLUMN IF EXISTS ai_assessment;

DROP TABLE IF EXISTS system_settings;
