package autonomous

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

type AutonomousRule struct {
	ID                   string    `db:"id" json:"id"`
	Name                 string    `db:"name" json:"name"`
	Description          string    `db:"description" json:"description"`
	ObservableType       string    `db:"observable_type" json:"observable_type"`
	ThreatScoreThreshold int       `db:"threat_score_threshold" json:"threat_score_threshold"`
	WebhookURL           string    `db:"webhook_url" json:"webhook_url"`
	IsActive             bool      `db:"is_active" json:"is_active"`
	CreatedAt            time.Time `db:"created_at" json:"created_at"`
	UpdatedAt            time.Time `db:"updated_at" json:"updated_at"`
}

type AutonomousLog struct {
	ID              string    `db:"id" json:"id"`
	RuleID          string    `db:"rule_id" json:"rule_id"`
	RuleName        string    `db:"rule_name" json:"rule_name"`
	ObservableID    string    `db:"observable_id" json:"observable_id"`
	ObservableType  string    `db:"observable_type" json:"observable_type"`
	ObservableValue string    `db:"observable_value" json:"observable_value"`
	ThreatScore     int       `db:"threat_score" json:"threat_score"`
	ActionTaken     string    `db:"action_taken" json:"action_taken"`
	Status          string    `db:"status" json:"status"`
	ResponsePayload string    `db:"response_payload" json:"response_payload"`
	TriggeredAt     time.Time `db:"triggered_at" json:"triggered_at"`
}

func (r *Repository) ListRules(ctx context.Context) ([]AutonomousRule, error) {
	rules := []AutonomousRule{}
	err := r.db.SelectContext(ctx, &rules, `
		SELECT id::text AS id, name, COALESCE(description, '') AS description, observable_type, threat_score_threshold, webhook_url, is_active, created_at, updated_at 
		FROM autonomous_rules 
		ORDER BY created_at DESC`)
	return rules, err
}

func (r *Repository) GetRule(ctx context.Context, id string) (AutonomousRule, error) {
	rule := AutonomousRule{}
	err := r.db.GetContext(ctx, &rule, `
		SELECT id::text AS id, name, COALESCE(description, '') AS description, observable_type, threat_score_threshold, webhook_url, is_active, created_at, updated_at 
		FROM autonomous_rules 
		WHERE id = $1::uuid`, strings.TrimSpace(id))
	return rule, err
}

func (r *Repository) CreateRule(ctx context.Context, rule AutonomousRule) (AutonomousRule, error) {
	if strings.TrimSpace(rule.Name) == "" || strings.TrimSpace(rule.ObservableType) == "" || strings.TrimSpace(rule.WebhookURL) == "" {
		return AutonomousRule{}, fmt.Errorf("name, observable_type, and webhook_url are required")
	}
	var created AutonomousRule
	err := r.db.GetContext(ctx, &created, `
		INSERT INTO autonomous_rules (name, description, observable_type, threat_score_threshold, webhook_url, is_active)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id::text AS id, name, COALESCE(description, '') AS description, observable_type, threat_score_threshold, webhook_url, is_active, created_at, updated_at`,
		strings.TrimSpace(rule.Name), strings.TrimSpace(rule.Description), strings.TrimSpace(rule.ObservableType), rule.ThreatScoreThreshold, strings.TrimSpace(rule.WebhookURL), rule.IsActive)
	return created, err
}

func (r *Repository) UpdateRule(ctx context.Context, id string, rule AutonomousRule) (AutonomousRule, error) {
	current, err := r.GetRule(ctx, id)
	if err != nil {
		return AutonomousRule{}, err
	}
	if strings.TrimSpace(rule.Name) != "" {
		current.Name = strings.TrimSpace(rule.Name)
	}
	if rule.Description != "" {
		current.Description = strings.TrimSpace(rule.Description)
	}
	if strings.TrimSpace(rule.ObservableType) != "" {
		current.ObservableType = strings.TrimSpace(rule.ObservableType)
	}
	if rule.ThreatScoreThreshold != 0 {
		current.ThreatScoreThreshold = rule.ThreatScoreThreshold
	}
	if strings.TrimSpace(rule.WebhookURL) != "" {
		current.WebhookURL = strings.TrimSpace(rule.WebhookURL)
	}
	current.IsActive = rule.IsActive

	var updated AutonomousRule
	err = r.db.GetContext(ctx, &updated, `
		UPDATE autonomous_rules 
		SET name = $1, description = $2, observable_type = $3, threat_score_threshold = $4, webhook_url = $5, is_active = $6, updated_at = now()
		WHERE id = $7::uuid
		RETURNING id::text AS id, name, COALESCE(description, '') AS description, observable_type, threat_score_threshold, webhook_url, is_active, created_at, updated_at`,
		current.Name, current.Description, current.ObservableType, current.ThreatScoreThreshold, current.WebhookURL, current.IsActive, strings.TrimSpace(id))
	return updated, err
}

func (r *Repository) DeleteRule(ctx context.Context, id string) (AutonomousRule, error) {
	before, err := r.GetRule(ctx, id)
	if err != nil {
		return AutonomousRule{}, err
	}
	_, err = r.db.ExecContext(ctx, `DELETE FROM autonomous_rules WHERE id = $1::uuid`, strings.TrimSpace(id))
	return before, err
}

func (r *Repository) ListLogs(ctx context.Context) ([]AutonomousLog, error) {
	logs := []AutonomousLog{}
	err := r.db.SelectContext(ctx, &logs, `
		SELECT id::text AS id, rule_id::text AS rule_id, rule_name, observable_id::text AS observable_id, observable_type, observable_value, threat_score, action_taken, status, COALESCE(response_payload, '') AS response_payload, triggered_at 
		FROM autonomous_logs 
		ORDER BY triggered_at DESC`)
	return logs, err
}

func (r *Repository) CreateLog(ctx context.Context, log AutonomousLog) (AutonomousLog, error) {
	var created AutonomousLog
	err := r.db.GetContext(ctx, &created, `
		INSERT INTO autonomous_logs (rule_id, rule_name, observable_id, observable_type, observable_value, threat_score, action_taken, status, response_payload)
		VALUES (NULLIF($1, '')::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9)
		RETURNING id::text AS id, rule_id::text AS rule_id, rule_name, observable_id::text AS observable_id, observable_type, observable_value, threat_score, action_taken, status, COALESCE(response_payload, '') AS response_payload, triggered_at`,
		strings.TrimSpace(log.RuleID), strings.TrimSpace(log.RuleName), strings.TrimSpace(log.ObservableID), strings.TrimSpace(log.ObservableType), strings.TrimSpace(log.ObservableValue), log.ThreatScore, strings.TrimSpace(log.ActionTaken), strings.TrimSpace(log.Status), strings.TrimSpace(log.ResponsePayload))
	return created, err
}

func (r *Repository) UpdateLogStatus(ctx context.Context, id string, status string, responsePayload string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE autonomous_logs 
		SET status = $1, response_payload = $2
		WHERE id = $3::uuid`,
		status, responsePayload, strings.TrimSpace(id))
	return err
}
