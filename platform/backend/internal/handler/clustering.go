package handler

import (
	"net/http"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/repository/clustering"
)

type ClusteringHandler struct {
	db   *sqlx.DB
	repo *clustering.Repository
}

func NewClusteringHandler(db *sqlx.DB) *ClusteringHandler {
	return &ClusteringHandler{
		db:   db,
		repo: clustering.NewRepository(db),
	}
}

func (h *ClusteringHandler) GetClusteredAlerts(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	if caseID == "" {
		return apierr.New(http.StatusBadRequest, "Case ID is required")
	}

	list, err := h.repo.GetClusteredAlerts(c.Request().Context(), caseID)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to fetch clustered alerts")
	}

	return c.JSON(http.StatusOK, list)
}
