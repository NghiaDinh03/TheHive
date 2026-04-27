package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/mq"
	"github.com/thehive-platform/backend/internal/version"
)

type HealthHandler struct {
	DB *sqlx.DB
	MQ *mq.Client
}

func NewHealthHandler(db *sqlx.DB, mqc *mq.Client) *HealthHandler {
	return &HealthHandler{DB: db, MQ: mqc}
}

func (h *HealthHandler) Live(c echo.Context) error {
	return c.JSON(http.StatusOK, echo.Map{"status": "ok"})
}

func (h *HealthHandler) Ready(c echo.Context) error {
	checks := echo.Map{}
	allOK := true

	ctx, cancel := context.WithTimeout(c.Request().Context(), 2*time.Second)
	defer cancel()
	if err := h.DB.PingContext(ctx); err != nil {
		checks["postgres"] = echo.Map{"status": "down", "error": err.Error()}
		allOK = false
	} else {
		checks["postgres"] = echo.Map{"status": "ok"}
	}

	if err := h.MQ.Ping(); err != nil {
		checks["rabbitmq"] = echo.Map{"status": "down", "error": err.Error()}
		allOK = false
	} else {
		checks["rabbitmq"] = echo.Map{"status": "ok"}
	}

	resp := echo.Map{
		"status":  map[bool]string{true: "ok", false: "degraded"}[allOK],
		"checks":  checks,
		"version": version.Get(),
	}
	if !allOK {
		return c.JSON(http.StatusServiceUnavailable, resp)
	}
	return c.JSON(http.StatusOK, resp)
}
