package handler

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

// DashboardHandler manages dashboard entities matching TheHive 4 Dashboard model.
type DashboardHandler struct {
	db *sqlx.DB
}

func NewDashboardHandler(db *sqlx.DB) *DashboardHandler {
	return &DashboardHandler{db: db}
}

type dashboardRow struct {
	ID             string    `db:"id" json:"id"`
	Title          string    `db:"title" json:"title"`
	Description    string    `db:"description" json:"description"`
	Definition     []byte    `db:"definition" json:"definition"`
	Status         string    `db:"status" json:"status"`
	CreatedBy      string    `db:"created_by" json:"created_by"`
	OrganisationID *string   `db:"organisation_id" json:"organisation_id,omitempty"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
}

type createDashboardRequest struct {
	Title          string `json:"title" validate:"required,min=1"`
	Description    string `json:"description"`
	Definition     []byte `json:"definition"`
	Status         string `json:"status"`
	OrganisationID string `json:"organisation_id"`
}

type patchDashboardRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Definition  []byte  `json:"definition"`
	Status      *string `json:"status"`
}

func (h *DashboardHandler) List(c echo.Context) error {
	rows := []dashboardRow{}
	if err := h.db.SelectContext(c.Request().Context(), &rows,
		`SELECT id::text, title, description, definition, status, created_by, organisation_id::text, created_at, updated_at
		 FROM dashboards ORDER BY title`); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to list dashboards"})
	}
	return c.JSON(http.StatusOK, rows)
}

func (h *DashboardHandler) Get(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	row := dashboardRow{}
	if err := h.db.GetContext(c.Request().Context(), &row,
		`SELECT id::text, title, description, definition, status, created_by, organisation_id::text, created_at, updated_at
		 FROM dashboards WHERE id = $1::uuid`, id); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "dashboard not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get dashboard"})
	}
	return c.JSON(http.StatusOK, row)
}

func (h *DashboardHandler) Create(c echo.Context) error {
	var req createDashboardRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	status := "Private"
	if req.Status != "" {
		status = req.Status
	}
	def := req.Definition
	if def == nil {
		def = []byte("{}")
	}
	var orgID interface{}
	if req.OrganisationID != "" {
		orgID = req.OrganisationID
	}
	createdBy := actorLogin(c)
	row := dashboardRow{}
	err := h.db.GetContext(c.Request().Context(), &row,
		`INSERT INTO dashboards (title, description, definition, status, created_by, organisation_id)
		 VALUES ($1, $2, $3, $4, $5, $6::uuid)
		 RETURNING id::text, title, description, definition, status, created_by, organisation_id::text, created_at, updated_at`,
		strings.TrimSpace(req.Title), req.Description, def, status, createdBy, orgID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "failed to create dashboard: " + err.Error()})
	}
	return c.JSON(http.StatusCreated, row)
}

func (h *DashboardHandler) Patch(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var req patchDashboardRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	// Build dynamic update
	sets := []string{}
	args := []interface{}{}
	argIdx := 1
	if req.Title != nil {
		sets = append(sets, "title = $"+itoa(argIdx))
		args = append(args, strings.TrimSpace(*req.Title))
		argIdx++
	}
	if req.Description != nil {
		sets = append(sets, "description = $"+itoa(argIdx))
		args = append(args, *req.Description)
		argIdx++
	}
	if req.Definition != nil {
		sets = append(sets, "definition = $"+itoa(argIdx))
		args = append(args, req.Definition)
		argIdx++
	}
	if req.Status != nil {
		sets = append(sets, "status = $"+itoa(argIdx))
		args = append(args, *req.Status)
		argIdx++
	}
	if len(sets) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no fields to update"})
	}
	sets = append(sets, "updated_at = now()")
	query := "UPDATE dashboards SET " + strings.Join(sets, ", ") + " WHERE id = $" + itoa(argIdx) + "::uuid RETURNING id::text, title, description, definition, status, created_by, organisation_id::text, created_at, updated_at"
	args = append(args, id)
	row := dashboardRow{}
	if err := h.db.GetContext(c.Request().Context(), &row, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "dashboard not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update dashboard"})
	}
	return c.JSON(http.StatusOK, row)
}

func (h *DashboardHandler) Delete(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	result, err := h.db.ExecContext(c.Request().Context(), `DELETE FROM dashboards WHERE id = $1::uuid`, id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete dashboard"})
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "dashboard not found"})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "deleted", "id": id})
}

// PageHandler manages knowledge base pages matching TheHive 4 Page model.
type PageHandler struct {
	db *sqlx.DB
}

func NewPageHandler(db *sqlx.DB) *PageHandler {
	return &PageHandler{db: db}
}

type pageRow struct {
	ID             string    `db:"id" json:"id"`
	Title          string    `db:"title" json:"title"`
	Content        string    `db:"content" json:"content"`
	Category       string    `db:"category" json:"category"`
	Slug           string    `db:"slug" json:"slug"`
	OrderIndex     int       `db:"order_index" json:"order_index"`
	OrganisationID *string   `db:"organisation_id" json:"organisation_id,omitempty"`
	CreatedBy      string    `db:"created_by" json:"created_by"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
}

type createPageRequest struct {
	Title          string `json:"title" validate:"required,min=1"`
	Content        string `json:"content"`
	Category       string `json:"category"`
	Slug           string `json:"slug"`
	OrderIndex     int    `json:"order_index"`
	OrganisationID string `json:"organisation_id"`
}

type patchPageRequest struct {
	Title      *string `json:"title"`
	Content    *string `json:"content"`
	Category   *string `json:"category"`
	Slug       *string `json:"slug"`
	OrderIndex *int    `json:"order_index"`
}

func (h *PageHandler) List(c echo.Context) error {
	rows := []pageRow{}
	if err := h.db.SelectContext(c.Request().Context(), &rows,
		`SELECT id::text, title, content, category, slug, order_index, organisation_id::text, created_by, created_at, updated_at
		 FROM pages ORDER BY order_index, title`); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to list pages"})
	}
	return c.JSON(http.StatusOK, rows)
}

func (h *PageHandler) Get(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	row := pageRow{}
	if err := h.db.GetContext(c.Request().Context(), &row,
		`SELECT id::text, title, content, category, slug, order_index, organisation_id::text, created_by, created_at, updated_at
		 FROM pages WHERE id = $1::uuid`, id); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "page not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get page"})
	}
	return c.JSON(http.StatusOK, row)
}

func (h *PageHandler) Create(c echo.Context) error {
	var req createPageRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	category := "general"
	if req.Category != "" {
		category = req.Category
	}
	var orgID interface{}
	if req.OrganisationID != "" {
		orgID = req.OrganisationID
	}
	createdBy := actorLogin(c)
	row := pageRow{}
	err := h.db.GetContext(c.Request().Context(), &row,
		`INSERT INTO pages (title, content, category, slug, order_index, organisation_id, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6::uuid, $7)
		 RETURNING id::text, title, content, category, slug, order_index, organisation_id::text, created_by, created_at, updated_at`,
		strings.TrimSpace(req.Title), req.Content, category, req.Slug, req.OrderIndex, orgID, createdBy)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "failed to create page: " + err.Error()})
	}
	return c.JSON(http.StatusCreated, row)
}

func (h *PageHandler) Patch(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var req patchPageRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	sets := []string{}
	args := []interface{}{}
	argIdx := 1
	if req.Title != nil {
		sets = append(sets, "title = $"+itoa(argIdx))
		args = append(args, strings.TrimSpace(*req.Title))
		argIdx++
	}
	if req.Content != nil {
		sets = append(sets, "content = $"+itoa(argIdx))
		args = append(args, *req.Content)
		argIdx++
	}
	if req.Category != nil {
		sets = append(sets, "category = $"+itoa(argIdx))
		args = append(args, *req.Category)
		argIdx++
	}
	if req.Slug != nil {
		sets = append(sets, "slug = $"+itoa(argIdx))
		args = append(args, *req.Slug)
		argIdx++
	}
	if req.OrderIndex != nil {
		sets = append(sets, "order_index = $"+itoa(argIdx))
		args = append(args, *req.OrderIndex)
		argIdx++
	}
	if len(sets) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no fields to update"})
	}
	sets = append(sets, "updated_at = now()")
	query := "UPDATE pages SET " + strings.Join(sets, ", ") + " WHERE id = $" + itoa(argIdx) + "::uuid RETURNING id::text, title, content, category, slug, order_index, organisation_id::text, created_by, created_at, updated_at"
	args = append(args, id)
	row := pageRow{}
	if err := h.db.GetContext(c.Request().Context(), &row, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "page not found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update page"})
	}
	return c.JSON(http.StatusOK, row)
}

func (h *PageHandler) Delete(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	result, err := h.db.ExecContext(c.Request().Context(), `DELETE FROM pages WHERE id = $1::uuid`, id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete page"})
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "page not found"})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "deleted", "id": id})
}
