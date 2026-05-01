package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/opensearch"
)

// SearchHandler handles global search and dashboard aggregation API endpoints.
type SearchHandler struct {
	os      *opensearch.Client
	indexer *opensearch.IndexerWorker
}

// NewSearchHandler creates a new search handler.
func NewSearchHandler(os *opensearch.Client, opts ...SearchOption) *SearchHandler {
	h := &SearchHandler{os: os}
	for _, o := range opts {
		o(h)
	}
	return h
}

// SearchOption configures optional dependencies for SearchHandler.
type SearchOption func(*SearchHandler)

// WithSearchIndexer sets the indexer worker for rebuild operations.
func WithSearchIndexer(indexer *opensearch.IndexerWorker) SearchOption {
	return func(h *SearchHandler) { h.indexer = indexer }
}

// GlobalSearch handles GET /api/v1/search?q=...&types=cases,alerts&from=0&size=20
func (h *SearchHandler) GlobalSearch(c echo.Context) error {
	query := strings.TrimSpace(c.QueryParam("q"))
	if query == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "query parameter 'q' is required"})
	}

	typesParam := strings.TrimSpace(c.QueryParam("types"))
	var entityTypes []string
	if typesParam != "" {
		entityTypes = strings.Split(typesParam, ",")
	}

	from, _ := strconv.Atoi(c.QueryParam("from"))
	size, _ := strconv.Atoi(c.QueryParam("size"))
	if size == 0 {
		size = 20
	}

	result, err := h.os.Search(c.Request().Context(), query, entityTypes, from, size)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "search failed: " + err.Error()})
	}

	return c.JSON(http.StatusOK, result)
}

// Aggregate handles GET /api/v1/search/aggregate?entity=cases&field=status&size=20
func (h *SearchHandler) Aggregate(c echo.Context) error {
	entityType := strings.TrimSpace(c.QueryParam("entity"))
	field := strings.TrimSpace(c.QueryParam("field"))
	if entityType == "" || field == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "entity and field parameters are required"})
	}

	size, _ := strconv.Atoi(c.QueryParam("size"))
	if size == 0 {
		size = 20
	}

	result, err := h.os.Aggregate(c.Request().Context(), entityType, field, size)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "aggregation failed: " + err.Error()})
	}

	return c.JSON(http.StatusOK, result)
}

// RebuildIndex handles POST /api/v1/search/rebuild?entity=cases
func (h *SearchHandler) RebuildIndex(c echo.Context) error {
	entityType := strings.TrimSpace(c.QueryParam("entity"))
	if entityType == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "entity parameter is required (cases, alerts, observables, tasks, logs)"})
	}

	if h.indexer == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "indexer worker not available"})
	}

	// Run rebuild in background
	go func() {
		count, err := h.indexer.RebuildIndex(c.Request().Context(), entityType)
		if err != nil {
			// Error is logged by the indexer worker
			_ = err
		}
		_ = count
	}()

	return c.JSON(http.StatusAccepted, map[string]string{
		"status":      "rebuild triggered",
		"entity_type": entityType,
	})
}

// IndexCount handles GET /api/v1/search/count?entity=cases
func (h *SearchHandler) IndexCount(c echo.Context) error {
	entityType := strings.TrimSpace(c.QueryParam("entity"))
	if entityType == "" {
		// Count all
		counts := map[string]int{}
		for _, et := range []string{"cases", "alerts", "observables", "tasks", "logs"} {
			count, err := h.os.CountDocuments(c.Request().Context(), et)
			if err != nil {
				counts[et] = -1
			} else {
				counts[et] = count
			}
		}
		return c.JSON(http.StatusOK, counts)
	}

	count, err := h.os.CountDocuments(c.Request().Context(), entityType)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "count failed: " + err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]int{entityType: count})
}
