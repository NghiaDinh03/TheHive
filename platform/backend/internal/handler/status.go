package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/db"
	"github.com/thehive-platform/backend/internal/version"
)

type StatusHandler struct {
	DB *sqlx.DB
}

func NewStatusHandler(d *sqlx.DB) *StatusHandler {
	return &StatusHandler{DB: d}
}

func (h *StatusHandler) Status(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 2*time.Second)
	defer cancel()

	v := version.Get()
	resp := echo.Map{
		"app":           "thehive-platform-backend",
		"version":       v.Version,
		"git_sha":       v.GitSHA,
		"build_time":    v.BuildTime,
		"release_class": v.ReleaseClass,
		"timestamp":     time.Now().UTC().Format(time.RFC3339),
	}
	if h.DB != nil {
		ver, dirty, err := db.SchemaVersion(ctx, h.DB)
		if err == nil {
			resp["db_schema_version"] = ver
			resp["db_schema_dirty"] = dirty
		}
	}
	return c.JSON(http.StatusOK, resp)
}
