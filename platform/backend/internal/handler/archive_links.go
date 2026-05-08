package handler

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

// ArchiveLinkHandler manages legacy read-only archive links for migrated records.
type ArchiveLinkHandler struct {
	db *sqlx.DB
}

func NewArchiveLinkHandler(db *sqlx.DB) *ArchiveLinkHandler {
	return &ArchiveLinkHandler{db: db}
}

type archiveLinkRow struct {
	ID         string    `db:"id" json:"id"`
	EntityType string    `db:"entity_type" json:"entity_type"`
	EntityID   string    `db:"entity_id" json:"entity_id"`
	LegacyURL  string    `db:"legacy_url" json:"legacy_url"`
	LegacyID   string    `db:"legacy_id" json:"legacy_id"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
	CreatedBy  string    `db:"created_by" json:"created_by"`
}

type createArchiveLinkRequest struct {
	EntityType string `json:"entity_type"`
	EntityID   string `json:"entity_id"`
	LegacyURL  string `json:"legacy_url"`
	LegacyID   string `json:"legacy_id"`
}

func (h *ArchiveLinkHandler) Get(c echo.Context) error {
	entityType := strings.TrimSpace(c.Param("type"))
	entityID := strings.TrimSpace(c.Param("id"))

	row := archiveLinkRow{}
	if err := h.db.GetContext(c.Request().Context(), &row,
		`SELECT id::text, entity_type, entity_id::text, legacy_url, legacy_id, created_at, created_by
		 FROM archive_links WHERE entity_type = $1 AND entity_id = $2::uuid`,
		entityType, entityID); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "archive link not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get archive link"})
	}
	return c.JSON(http.StatusOK, row)
}

func (h *ArchiveLinkHandler) Create(c echo.Context) error {
	var req createArchiveLinkRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if req.EntityType == "" || req.EntityID == "" || req.LegacyURL == "" || req.LegacyID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "entity_type, entity_id, legacy_url, and legacy_id are required"})
	}

	row := archiveLinkRow{}
	if err := h.db.GetContext(c.Request().Context(), &row,
		`INSERT INTO archive_links (entity_type, entity_id, legacy_url, legacy_id, created_by)
		 VALUES ($1, $2::uuid, $3, $4, $5)
		 RETURNING id::text, entity_type, entity_id::text, legacy_url, legacy_id, created_at, created_by`,
		req.EntityType, req.EntityID, req.LegacyURL, req.LegacyID, "system"); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create archive link"})
	}
	return c.JSON(http.StatusCreated, row)
}

func (h *ArchiveLinkHandler) Delete(c echo.Context) error {
	entityType := strings.TrimSpace(c.Param("type"))
	entityID := strings.TrimSpace(c.Param("id"))

	result, err := h.db.ExecContext(c.Request().Context(),
		`DELETE FROM archive_links WHERE entity_type = $1 AND entity_id = $2::uuid`,
		entityType, entityID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete archive link"})
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "archive link not found"})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "deleted"})
}
