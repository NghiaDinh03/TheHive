package server

import (
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/handler"
)

// registerSearchRoutes registers OpenSearch-backed global search routes.
// If OpenSearch is disabled, these routes remain absent as before.
func (s *Server) registerSearchRoutes(api *echo.Group, authRequired echo.MiddlewareFunc) {
	if s.osClient == nil {
		return
	}

	var searchOpts []handler.SearchOption
	if s.osIndexer != nil {
		searchOpts = append(searchOpts, handler.WithSearchIndexer(s.osIndexer))
	}
	searchH := handler.NewSearchHandler(s.osClient, searchOpts...)
	searchGrp := api.Group("/search", authRequired)
	searchGrp.GET("", searchH.GlobalSearch)
	searchGrp.GET("/aggregate", searchH.Aggregate, RequirePermission("manageCase"))
	searchGrp.GET("/count", searchH.IndexCount, RequirePermission("managePlatform"))
	searchGrp.POST("/rebuild", searchH.RebuildIndex, RequirePermission("managePlatform"))
}
