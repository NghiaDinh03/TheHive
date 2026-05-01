package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/repository/investigation"
)

type ReadOnlyHandler struct {
	reader investigation.Reader
}

func NewReadOnlyHandler(reader investigation.Reader) *ReadOnlyHandler {
	if reader == nil {
		reader = investigation.NewPostgresReader(nil)
	}
	return &ReadOnlyHandler{reader: reader}
}

func (h *ReadOnlyHandler) ListCases(c echo.Context) error {
	query := investigation.NewListQuery(c.QueryParams(), investigation.SortSpec{Field: "updated_at", Order: "DESC"})
	return c.JSON(http.StatusOK, h.reader.ListCases(c.Request().Context(), requestID(c), query))
}

func (h *ReadOnlyHandler) ListAlerts(c echo.Context) error {
	query := investigation.NewListQuery(c.QueryParams(), investigation.SortSpec{Field: "created_at", Order: "DESC"})
	return c.JSON(http.StatusOK, h.reader.ListAlerts(c.Request().Context(), requestID(c), query))
}

func (h *ReadOnlyHandler) ListObservables(c echo.Context) error {
	query := investigation.NewListQuery(c.QueryParams(), investigation.SortSpec{Field: "created_at", Order: "DESC"})
	return c.JSON(http.StatusOK, h.reader.ListObservables(c.Request().Context(), requestID(c), query))
}

func requestID(c echo.Context) string {
	if id := c.Response().Header().Get(echo.HeaderXRequestID); id != "" {
		return id
	}
	return c.Request().Header.Get(echo.HeaderXRequestID)
}
