package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
)

type AuditHandler struct {
	db *sqlx.DB
}

func NewAuditHandler(db *sqlx.DB) *AuditHandler {
	return &AuditHandler{db: db}
}

type auditSummary struct {
	ID         string    `db:"id" json:"id"`
	ActorID    string    `db:"actor_id" json:"actor_id"`
	Action     string    `db:"action" json:"action"`
	EntityType string    `db:"entity_type" json:"entity_type"`
	EntityID   string    `db:"entity_id" json:"entity_id"`
	BeforeJSON []byte    `db:"before_json" json:"before_json,omitempty"`
	AfterJSON  []byte    `db:"after_json" json:"after_json,omitempty"`
	IPAddress  string    `db:"ip_address" json:"ip_address,omitempty"`
	UserAgent  string    `db:"user_agent" json:"user_agent,omitempty"`
	RequestID  string    `db:"request_id" json:"request_id,omitempty"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

func (h *AuditHandler) List(c echo.Context) error {
	limit := 100
	if raw := c.QueryParam("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > 500 {
			return apierr.New(http.StatusBadRequest, "limit must be between 1 and 500")
		}
		limit = parsed
	}
	rows := []auditSummary{}
	query := `
		SELECT id::text AS id, actor_id, action, entity_type, entity_id, before_json, after_json,
			COALESCE(ip_address::text, '') AS ip_address, COALESCE(user_agent, '') AS user_agent, COALESCE(request_id, '') AS request_id, created_at
		FROM audit_logs`
	args := []any{}
	if actor := c.QueryParam("actor"); actor != "" {
		query += " WHERE lower(actor_id) = lower($1)"
		args = append(args, actor)
	}
	query += " ORDER BY created_at DESC LIMIT $" + strconv.Itoa(len(args)+1)
	args = append(args, limit)
	if err := h.db.SelectContext(c.Request().Context(), &rows, query, args...); err != nil {
		return apierr.New(http.StatusInternalServerError, "audit list failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"values": rows, "total": len(rows)})
}
