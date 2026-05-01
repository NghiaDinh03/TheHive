package notification

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

// TriggerType enumerates the event types that can fire notifications.
// These match TheHive 4 trigger concepts: CaseCreated, AlertCreated, TaskAssigned, etc.
type TriggerType string

const (
	TriggerCaseCreated       TriggerType = "CaseCreated"
	TriggerCaseUpdated       TriggerType = "CaseUpdated"
	TriggerCaseClosed        TriggerType = "CaseClosed"
	TriggerCaseReopened      TriggerType = "CaseReopened"
	TriggerCaseDeleted       TriggerType = "CaseDeleted"
	TriggerAlertCreated      TriggerType = "AlertCreated"
	TriggerAlertUpdated      TriggerType = "AlertUpdated"
	TriggerAlertImported     TriggerType = "AlertImported"
	TriggerAlertMerged       TriggerType = "AlertMerged"
	TriggerTaskCreated       TriggerType = "TaskCreated"
	TriggerTaskAssigned      TriggerType = "TaskAssigned"
	TriggerTaskCompleted     TriggerType = "TaskCompleted"
	TriggerTaskClosed        TriggerType = "TaskClosed"
	TriggerObservableCreated TriggerType = "ObservableCreated"
	TriggerLogCreated        TriggerType = "LogCreated"
	TriggerJobCompleted      TriggerType = "JobCompleted"
)

// TriggerEvent represents a notification-worthy event.
type TriggerEvent struct {
	Type       TriggerType            `json:"type"`
	EntityType string                 `json:"entity_type"` // cases, alerts, tasks, observables, logs
	EntityID   string                 `json:"entity_id"`
	ActorLogin string                 `json:"actor_login"`
	OrgID      string                 `json:"organisation_id,omitempty"`
	Details    map[string]interface{} `json:"details,omitempty"`
}

// Emitter evaluates notification configs against trigger events and enqueues matching notifications.
type Emitter struct {
	db  *sqlx.DB
	log *zap.Logger
}

// NewEmitter creates a new notification trigger emitter.
func NewEmitter(db *sqlx.DB, log *zap.Logger) *Emitter {
	return &Emitter{db: db, log: log}
}

// Emit evaluates all active notification configs against the given trigger event.
// For each matching config, it inserts a row into notification_queue for the dispatch worker.
func (e *Emitter) Emit(ctx context.Context, event TriggerEvent) {
	// Find notification configs that match this trigger type
	type notifConfig struct {
		ID          string `db:"id"`
		Name        string `db:"name"`
		TriggerType string `db:"trigger_type"`
		AdapterType string `db:"adapter_type"`
		MaxRetries  int    `db:"max_retries"`
	}

	configs := []notifConfig{}
	err := e.db.SelectContext(ctx, &configs,
		`SELECT id::text, name, trigger_type, adapter_type, COALESCE(max_retries, 3) as max_retries
		 FROM notification_configs
		 WHERE enabled = true AND trigger_type = $1`,
		string(event.Type))
	if err != nil {
		e.log.Error("notification emitter: failed to query configs",
			zap.String("trigger_type", string(event.Type)),
			zap.Error(err),
		)
		return
	}

	if len(configs) == 0 {
		return
	}

	payload, err := json.Marshal(event)
	if err != nil {
		e.log.Error("notification emitter: failed to marshal event", zap.Error(err))
		return
	}

	for _, cfg := range configs {
		_, err := e.db.ExecContext(ctx,
			`INSERT INTO notification_queue
				(config_id, trigger_type, entity_type, entity_id, payload, status, adapter_type, max_retries)
			 VALUES ($1::uuid, $2, $3, $4, $5, 'pending', $6, $7)`,
			cfg.ID, string(event.Type), event.EntityType, event.EntityID,
			payload, cfg.AdapterType, cfg.MaxRetries)
		if err != nil {
			e.log.Error("notification emitter: failed to enqueue notification",
				zap.String("config_id", cfg.ID),
				zap.String("trigger_type", string(event.Type)),
				zap.Error(err),
			)
			continue
		}
		e.log.Debug("notification emitter: enqueued notification",
			zap.String("config_name", cfg.Name),
			zap.String("trigger_type", string(event.Type)),
			zap.String("entity_type", event.EntityType),
			zap.String("entity_id", event.EntityID),
		)
	}
}

// EmitCaseEvent is a convenience helper for case-related triggers.
func (e *Emitter) EmitCaseEvent(ctx context.Context, triggerType TriggerType, caseID, actorLogin string, details map[string]interface{}) {
	e.Emit(ctx, TriggerEvent{
		Type:       triggerType,
		EntityType: "cases",
		EntityID:   caseID,
		ActorLogin: actorLogin,
		Details:    details,
	})
}

// EmitAlertEvent is a convenience helper for alert-related triggers.
func (e *Emitter) EmitAlertEvent(ctx context.Context, triggerType TriggerType, alertID, actorLogin string, details map[string]interface{}) {
	e.Emit(ctx, TriggerEvent{
		Type:       triggerType,
		EntityType: "alerts",
		EntityID:   alertID,
		ActorLogin: actorLogin,
		Details:    details,
	})
}

// EmitTaskEvent is a convenience helper for task-related triggers.
func (e *Emitter) EmitTaskEvent(ctx context.Context, triggerType TriggerType, taskID, actorLogin string, details map[string]interface{}) {
	e.Emit(ctx, TriggerEvent{
		Type:       triggerType,
		EntityType: "tasks",
		EntityID:   taskID,
		ActorLogin: actorLogin,
		Details:    details,
	})
}

// EmitObservableEvent is a convenience helper for observable-related triggers.
func (e *Emitter) EmitObservableEvent(ctx context.Context, triggerType TriggerType, observableID, actorLogin string, details map[string]interface{}) {
	e.Emit(ctx, TriggerEvent{
		Type:       triggerType,
		EntityType: "observables",
		EntityID:   observableID,
		ActorLogin: actorLogin,
		Details:    details,
	})
}

// EmitLogEvent is a convenience helper for log-related triggers.
func (e *Emitter) EmitLogEvent(ctx context.Context, triggerType TriggerType, logID, actorLogin string, details map[string]interface{}) {
	e.Emit(ctx, TriggerEvent{
		Type:       triggerType,
		EntityType: "logs",
		EntityID:   logID,
		ActorLogin: actorLogin,
		Details:    details,
	})
}

// AllTriggerTypes returns all supported trigger types for UI/config validation.
func AllTriggerTypes() []string {
	return []string{
		string(TriggerCaseCreated),
		string(TriggerCaseUpdated),
		string(TriggerCaseClosed),
		string(TriggerCaseReopened),
		string(TriggerCaseDeleted),
		string(TriggerAlertCreated),
		string(TriggerAlertUpdated),
		string(TriggerAlertImported),
		string(TriggerAlertMerged),
		string(TriggerTaskCreated),
		string(TriggerTaskAssigned),
		string(TriggerTaskCompleted),
		string(TriggerTaskClosed),
		string(TriggerObservableCreated),
		string(TriggerLogCreated),
		string(TriggerJobCompleted),
	}
}

// ValidateTriggerType checks if a trigger type string is valid.
func ValidateTriggerType(t string) error {
	for _, valid := range AllTriggerTypes() {
		if t == valid {
			return nil
		}
	}
	return fmt.Errorf("invalid trigger type: %s", t)
}
