package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

// NotificationHandler manages notification/webhook configs matching TheHive 4 notifier system.
type NotificationHandler struct {
	db *sqlx.DB
}

func NewNotificationHandler(db *sqlx.DB) *NotificationHandler {
	return &NotificationHandler{db: db}
}

type notificationConfigRow struct {
	ID             string    `db:"id" json:"id"`
	Name           string    `db:"name" json:"name"`
	Trigger        string    `db:"trigger" json:"trigger"`
	Notifier       string    `db:"notifier" json:"notifier"`
	Config         []byte    `db:"config" json:"config"`
	Enabled        bool      `db:"enabled" json:"enabled"`
	OrganisationID *string   `db:"organisation_id" json:"organisation_id,omitempty"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
}

type createNotificationRequest struct {
	Name           string `json:"name" validate:"required,min=1"`
	Trigger        string `json:"trigger" validate:"required"`
	Notifier       string `json:"notifier" validate:"required"`
	Config         []byte `json:"config"`
	Enabled        *bool  `json:"enabled"`
	OrganisationID string `json:"organisation_id"`
}

func (h *NotificationHandler) List(c echo.Context) error {
	rows := []notificationConfigRow{}
	if err := h.db.SelectContext(c.Request().Context(), &rows,
		`SELECT id::text, name, trigger, notifier, config, enabled, organisation_id::text, created_at, updated_at
		 FROM notification_configs ORDER BY name`); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to list notifications"})
	}
	return c.JSON(http.StatusOK, rows)
}

func (h *NotificationHandler) Create(c echo.Context) error {
	var req createNotificationRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	cfg := req.Config
	if cfg == nil {
		cfg = []byte("{}")
	}
	var orgID interface{}
	if req.OrganisationID != "" {
		orgID = req.OrganisationID
	}
	row := notificationConfigRow{}
	err := h.db.GetContext(c.Request().Context(), &row,
		`INSERT INTO notification_configs (name, trigger, notifier, config, enabled, organisation_id)
		 VALUES ($1, $2, $3, $4, $5, $6::uuid)
		 RETURNING id::text, name, trigger, notifier, config, enabled, organisation_id::text, created_at, updated_at`,
		strings.TrimSpace(req.Name), req.Trigger, req.Notifier, cfg, enabled, orgID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "failed to create notification: " + err.Error()})
	}
	return c.JSON(http.StatusCreated, row)
}

func (h *NotificationHandler) Delete(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	result, err := h.db.ExecContext(c.Request().Context(), `DELETE FROM notification_configs WHERE id = $1::uuid`, id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete notification"})
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "notification not found"})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "deleted", "id": id})
}
