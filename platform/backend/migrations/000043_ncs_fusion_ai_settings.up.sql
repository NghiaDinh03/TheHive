-- Migration 000043: Add NCS Fusion AI Settings & Assessment Schema
-- Author: NCS Fusion Center Core Team

-- Add ai_assessment JSONB column to cases table to hold structured JSON LLM analysis
ALTER TABLE cases ADD COLUMN IF NOT EXISTS ai_assessment JSONB;

-- Create system_settings table to store dynamic API and Integration credentials
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial default settings for Local CyberAI Gemma
INSERT INTO system_settings (key, value) VALUES
('cyberai_api_url', 'http://cyber-ai-service:11434'),
('cyberai_model', 'gemma')
ON CONFLICT (key) DO NOTHING;
