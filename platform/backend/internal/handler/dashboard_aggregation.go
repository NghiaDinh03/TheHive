package handler

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/opensearch"
)

// DashboardAggregationHandler provides OpenSearch-backed aggregation data for dashboard widgets.
// This replaces the placeholder widget data with real aggregation queries.
type DashboardAggregationHandler struct {
	os *opensearch.Client
}

// NewDashboardAggregationHandler creates a new handler for dashboard aggregation endpoints.
func NewDashboardAggregationHandler(os *opensearch.Client) *DashboardAggregationHandler {
	return &DashboardAggregationHandler{os: os}
}

// WidgetDataRequest represents a request for widget aggregation data.
type WidgetDataRequest struct {
	EntityType string            `json:"entity_type" validate:"required"`
	WidgetType string            `json:"widget_type" validate:"required"`
	Field      string            `json:"field"`
	DateField  string            `json:"date_field"`
	Interval   string            `json:"interval"`
	Filters    map[string]string `json:"filters"`
	Size       int               `json:"size"`
}

// WidgetDataResponse represents aggregation data for a dashboard widget.
type WidgetDataResponse struct {
	WidgetType string                   `json:"widget_type"`
	Data       []map[string]interface{} `json:"data"`
	Total      int                      `json:"total"`
}

// GetWidgetData handles POST /api/v1/dashboards/widget-data
// Provides aggregation data for individual dashboard widgets backed by OpenSearch.
func (h *DashboardAggregationHandler) GetWidgetData(c echo.Context) error {
	var req WidgetDataRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if req.EntityType == "" || req.WidgetType == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "entity_type and widget_type are required"})
	}
	if req.Size == 0 {
		req.Size = 20
	}

	ctx := c.Request().Context()

	switch req.WidgetType {
	case "counter":
		return h.handleCounter(c, ctx, req)
	case "bar", "pie":
		return h.handleTermsAgg(c, ctx, req)
	case "line":
		return h.handleDateHistogram(c, ctx, req)
	case "list":
		return h.handleTopList(c, ctx, req)
	default:
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "unsupported widget_type: " + req.WidgetType})
	}
}

// handleCounter returns a count of documents matching filters.
func (h *DashboardAggregationHandler) handleCounter(c echo.Context, ctx context.Context, req WidgetDataRequest) error {
	count, err := h.os.CountDocuments(ctx, req.EntityType)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "count failed: " + err.Error()})
	}

	return c.JSON(http.StatusOK, WidgetDataResponse{
		WidgetType: "counter",
		Data:       []map[string]interface{}{{"count": count}},
		Total:      count,
	})
}

// handleTermsAgg returns terms aggregation for bar/pie charts.
func (h *DashboardAggregationHandler) handleTermsAgg(c echo.Context, ctx context.Context, req WidgetDataRequest) error {
	if req.Field == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "field is required for bar/pie widgets"})
	}

	result, err := h.os.Aggregate(ctx, req.EntityType, req.Field, req.Size)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "aggregation failed: " + err.Error()})
	}

	// Transform map[string]int into widget data format
	data := make([]map[string]interface{}, 0, len(result))
	total := 0
	for key, count := range result {
		data = append(data, map[string]interface{}{
			"key":   key,
			"count": count,
		})
		total += count
	}

	return c.JSON(http.StatusOK, WidgetDataResponse{
		WidgetType: req.WidgetType,
		Data:       data,
		Total:      total,
	})
}

// handleDateHistogram returns date histogram aggregation for line charts.
func (h *DashboardAggregationHandler) handleDateHistogram(c echo.Context, ctx context.Context, req WidgetDataRequest) error {
	dateField := req.DateField
	if dateField == "" {
		dateField = "created_at"
	}
	interval := req.Interval
	if interval == "" {
		interval = "day"
	}

	buckets, err := h.os.DateHistogram(ctx, req.EntityType, dateField, interval, req.Size)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "date histogram failed: " + err.Error()})
	}

	data := make([]map[string]interface{}, 0, len(buckets))
	for _, b := range buckets {
		data = append(data, map[string]interface{}{
			"date":  b.KeyAsString,
			"count": b.DocCount,
		})
	}

	return c.JSON(http.StatusOK, WidgetDataResponse{
		WidgetType: "line",
		Data:       data,
		Total:      len(data),
	})
}

// handleTopList returns top documents for list widgets.
func (h *DashboardAggregationHandler) handleTopList(c echo.Context, ctx context.Context, req WidgetDataRequest) error {
	sortField := "created_at"
	if req.Field != "" {
		sortField = req.Field
	}

	docs, err := h.os.TopDocuments(ctx, req.EntityType, sortField, req.Size)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "top list failed: " + err.Error()})
	}

	return c.JSON(http.StatusOK, WidgetDataResponse{
		WidgetType: "list",
		Data:       docs,
		Total:      len(docs),
	})
}

// DashboardStats handles GET /api/v1/dashboards/stats
// Returns summary statistics for the main dashboard page.
func (h *DashboardAggregationHandler) DashboardStats(c echo.Context) error {
	ctx := c.Request().Context()

	stats := map[string]interface{}{}

	// Count each entity type
	for _, entityType := range []string{"cases", "alerts", "observables", "tasks"} {
		count, err := h.os.CountDocuments(ctx, entityType)
		if err != nil {
			stats[entityType+"_count"] = -1
		} else {
			stats[entityType+"_count"] = count
		}
	}

	// Get case status distribution
	caseStatusAgg, err := h.os.Aggregate(ctx, "cases", "status", 10)
	if err == nil {
		stats["case_status"] = caseStatusAgg
	}

	// Get alert status distribution
	alertStatusAgg, err := h.os.Aggregate(ctx, "alerts", "status", 10)
	if err == nil {
		stats["alert_status"] = alertStatusAgg
	}

	// Get severity distribution for cases
	caseSeverityAgg, err := h.os.Aggregate(ctx, "cases", "severity", 10)
	if err == nil {
		stats["case_severity"] = caseSeverityAgg
	}

	// Get recent case creation trend (last 30 days)
	caseTrend, err := h.os.DateHistogram(ctx, "cases", "created_at", "day", 30)
	if err == nil {
		trendData := make([]map[string]interface{}, 0, len(caseTrend))
		for _, b := range caseTrend {
			trendData = append(trendData, map[string]interface{}{
				"date":  b.KeyAsString,
				"count": b.DocCount,
			})
		}
		stats["case_trend"] = trendData
	}

	return c.JSON(http.StatusOK, stats)
}

// MultiWidgetData handles POST /api/v1/dashboards/multi-widget-data
// Fetches data for multiple widgets in a single request (batch optimization).
func (h *DashboardAggregationHandler) MultiWidgetData(c echo.Context) error {
	var requests []WidgetDataRequest
	if err := c.Bind(&requests); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body, expected array of widget data requests"})
	}

	if len(requests) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "at least one widget request is required"})
	}

	if len(requests) > 20 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "maximum 20 widget requests per batch"})
	}

	ctx := c.Request().Context()
	results := make([]WidgetDataResponse, 0, len(requests))

	for _, req := range requests {
		if req.Size == 0 {
			req.Size = 20
		}

		var resp WidgetDataResponse
		switch req.WidgetType {
		case "counter":
			count, err := h.os.CountDocuments(ctx, req.EntityType)
			if err != nil {
				resp = WidgetDataResponse{WidgetType: "counter", Data: []map[string]interface{}{{"error": err.Error()}}}
			} else {
				resp = WidgetDataResponse{WidgetType: "counter", Data: []map[string]interface{}{{"count": count}}, Total: count}
			}

		case "bar", "pie":
			if req.Field == "" {
				resp = WidgetDataResponse{WidgetType: req.WidgetType, Data: []map[string]interface{}{{"error": "field required"}}}
			} else {
				result, err := h.os.Aggregate(ctx, req.EntityType, req.Field, req.Size)
				if err != nil {
					resp = WidgetDataResponse{WidgetType: req.WidgetType, Data: []map[string]interface{}{{"error": err.Error()}}}
				} else {
					data := termsToWidgetData(result)
					resp = WidgetDataResponse{WidgetType: req.WidgetType, Data: data, Total: len(data)}
				}
			}

		case "line":
			dateField := req.DateField
			if dateField == "" {
				dateField = "created_at"
			}
			interval := req.Interval
			if interval == "" {
				interval = "day"
			}
			buckets, err := h.os.DateHistogram(ctx, req.EntityType, dateField, interval, req.Size)
			if err != nil {
				resp = WidgetDataResponse{WidgetType: "line", Data: []map[string]interface{}{{"error": err.Error()}}}
			} else {
				data := dateHistogramToWidgetData(buckets)
				resp = WidgetDataResponse{WidgetType: "line", Data: data, Total: len(data)}
			}

		case "list":
			sortField := "created_at"
			if req.Field != "" {
				sortField = req.Field
			}
			docs, err := h.os.TopDocuments(ctx, req.EntityType, sortField, req.Size)
			if err != nil {
				resp = WidgetDataResponse{WidgetType: "list", Data: []map[string]interface{}{{"error": err.Error()}}}
			} else {
				resp = WidgetDataResponse{WidgetType: "list", Data: docs, Total: len(docs)}
			}

		default:
			resp = WidgetDataResponse{WidgetType: req.WidgetType, Data: []map[string]interface{}{{"error": "unsupported widget_type"}}}
		}
		results = append(results, resp)
	}

	return c.JSON(http.StatusOK, results)
}

// termsToWidgetData converts map[string]int aggregation result to widget data format.
func termsToWidgetData(agg map[string]int) []map[string]interface{} {
	data := make([]map[string]interface{}, 0, len(agg))
	for key, count := range agg {
		data = append(data, map[string]interface{}{
			"key":   key,
			"count": count,
		})
	}
	return data
}

// dateHistogramToWidgetData converts DateHistogramBucket slice to widget data format.
func dateHistogramToWidgetData(buckets []opensearch.DateHistogramBucket) []map[string]interface{} {
	data := make([]map[string]interface{}, 0, len(buckets))
	for _, b := range buckets {
		data = append(data, map[string]interface{}{
			"date":  b.KeyAsString,
			"count": b.DocCount,
		})
	}
	return data
}
