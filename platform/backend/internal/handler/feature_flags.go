package handler

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

// FeatureFlagHandler manages feature flags for org/team/user rollout.
type FeatureFlagHandler struct {
	db *sqlx.DB
}

func NewFeatureFlagHandler(db *sqlx.DB) *FeatureFlagHandler {
	return &FeatureFlagHandler{db: db}
}

type featureFlagRow struct {
	ID          string    `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	Scope       string    `db:"scope" json:"scope"`
	ScopeID     *string   `db:"scope_id" json:"scope_id,omitempty"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type createFeatureFlagRequest struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Enabled     bool    `json:"enabled"`
	Scope       string  `json:"scope"`
	ScopeID     *string `json:"scope_id"`
}

type patchFeatureFlagRequest struct {
	Enabled *bool `json:"enabled"`
}

func (h *FeatureFlagHandler) List(c echo.Context) error {
	rows := []featureFlagRow{}
	if err := h.db.SelectContext(c.Request().Context(), &rows,
		`SELECT id::text, name, description, enabled, scope, scope_id, created_at, updated_at
		 FROM feature_flags ORDER BY name`); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to list feature flags"})
	}
	return c.JSON(http.StatusOK, rows)
}

func (h *FeatureFlagHandler) Get(c echo.Context) error {
	name := strings.TrimSpace(c.Param("name"))
	row := featureFlagRow{}
	if err := h.db.GetContext(c.Request().Context(), &row,
		`SELECT id::text, name, description, enabled, scope, scope_id, created_at, updated_at
		 FROM feature_flags WHERE name = $1`, name); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "feature flag not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get feature flag"})
	}
	return c.JSON(http.StatusOK, row)
}

func (h *FeatureFlagHandler) Create(c echo.Context) error {
	var req createFeatureFlagRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "name is required"})
	}
	if req.Scope == "" {
		req.Scope = "global"
	}

	row := featureFlagRow{}
	if err := h.db.GetContext(c.Request().Context(), &row,
		`INSERT INTO feature_flags (name, description, enabled, scope, scope_id)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id::text, name, description, enabled, scope, scope_id, created_at, updated_at`,
		req.Name, req.Description, req.Enabled, req.Scope, req.ScopeID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create feature flag"})
	}
	return c.JSON(http.StatusCreated, row)
}

func (h *FeatureFlagHandler) Patch(c echo.Context) error {
	name := strings.TrimSpace(c.Param("name"))
	var req patchFeatureFlagRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if req.Enabled == nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no fields to update"})
	}

	row := featureFlagRow{}
	if err := h.db.GetContext(c.Request().Context(), &row,
		`UPDATE feature_flags SET enabled = $1, updated_at = now()
		 WHERE name = $2
		 RETURNING id::text, name, description, enabled, scope, scope_id, created_at, updated_at`,
		*req.Enabled, name); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "feature flag not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update feature flag"})
	}
	return c.JSON(http.StatusOK, row)
}

func (h *FeatureFlagHandler) Delete(c echo.Context) error {
	name := strings.TrimSpace(c.Param("name"))
	result, err := h.db.ExecContext(c.Request().Context(), `DELETE FROM feature_flags WHERE name = $1`, name)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete feature flag"})
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "feature flag not found"})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "deleted"})
}

// IsEnabled checks if a feature flag is enabled for a given scope.
func (h *FeatureFlagHandler) IsEnabled(name string, scope string, scopeID *string) bool {
	var enabled bool
	query := `SELECT enabled FROM feature_flags WHERE name = $1 AND scope = $2`
	if scopeID != nil {
		query += ` AND scope_id = $3`
		err := h.db.Get(&enabled, query, name, scope, *scopeID)
		return err == nil && enabled
	}
	err := h.db.Get(&enabled, query, name, scope)
	return err == nil && enabled
}
