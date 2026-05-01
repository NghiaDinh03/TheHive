package audit

import (
	"context"
	"encoding/json"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/authjwt"
)

type Entry struct {
	ActorID    string
	Action     string
	EntityType string
	EntityID   string
	Before     any
	After      any
	IPAddress  string
	UserAgent  string
	RequestID  string
}

type Recorder struct {
	db *sqlx.DB
}

func NewRecorder(db *sqlx.DB) *Recorder {
	return &Recorder{db: db}
}

func FromContext(c echo.Context, action, entityType, entityID string, before any, after any) Entry {
	actor := "anonymous"
	if claims, ok := c.Get("auth_claims").(*authjwt.Claims); ok && claims.Login != "" {
		actor = claims.Login
	}
	requestID := c.Response().Header().Get(echo.HeaderXRequestID)
	if requestID == "" {
		requestID = c.Request().Header.Get(echo.HeaderXRequestID)
	}
	return Entry{
		ActorID:    actor,
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		Before:     before,
		After:      after,
		IPAddress:  c.RealIP(),
		UserAgent:  c.Request().UserAgent(),
		RequestID:  requestID,
	}
}

func (r *Recorder) Record(ctx context.Context, entry Entry) error {
	_, err := r.db.ExecContext(ctx, insertSQL, entry.ActorID, entry.Action, entry.EntityType, entry.EntityID, mustJSON(entry.Before), mustJSON(entry.After), entry.IPAddress, entry.UserAgent, entry.RequestID)
	return err
}

func RecordTx(ctx context.Context, tx *sqlx.Tx, entry Entry) error {
	_, err := tx.ExecContext(ctx, insertSQL, entry.ActorID, entry.Action, entry.EntityType, entry.EntityID, mustJSON(entry.Before), mustJSON(entry.After), entry.IPAddress, entry.UserAgent, entry.RequestID)
	return err
}

const insertSQL = `
	INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, before_json, after_json, ip_address, user_agent, request_id)
	VALUES ((SELECT id FROM users WHERE login = $1 LIMIT 1), $2, $3, $4, $5::jsonb, $6::jsonb, NULLIF($7, '')::inet, $8, $9)`

func mustJSON(value any) []byte {
	if value == nil {
		return nil
	}
	data, err := json.Marshal(value)
	if err != nil {
		return []byte(`{"error":"audit json marshal failed"}`)
	}
	return data
}
