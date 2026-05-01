package server

import (
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/handler"
)

// registerContentRoutes registers dashboards and knowledge-base pages.
func (s *Server) registerContentRoutes(api *echo.Group, authRequired echo.MiddlewareFunc) {
	s.registerDashboardRoutes(api, authRequired)
	s.registerPageRoutes(api, authRequired)
}

func (s *Server) registerDashboardRoutes(api *echo.Group, authRequired echo.MiddlewareFunc) {
	dashH := handler.NewDashboardHandler(s.db)
	dashGrp := api.Group("/dashboards", authRequired)
	dashGrp.GET("", dashH.List, RequirePermission("manageCase"))

	// Register static aggregation routes before /:id so Echo does not treat them as IDs.
	if s.osClient != nil {
		dashAggH := handler.NewDashboardAggregationHandler(s.osClient)
		dashGrp.GET("/stats", dashAggH.DashboardStats, RequirePermission("manageCase"))
		dashGrp.POST("/widget-data", dashAggH.GetWidgetData, RequirePermission("manageCase"))
		dashGrp.POST("/multi-widget-data", dashAggH.MultiWidgetData, RequirePermission("manageCase"))
	}

	dashGrp.GET("/:id", dashH.Get, RequirePermission("manageCase"))
	dashGrp.POST("", dashH.Create, RequirePermission("manageCase"))
	dashGrp.PATCH("/:id", dashH.Patch, RequirePermission("manageCase"))
	dashGrp.DELETE("/:id", dashH.Delete, RequirePermission("managePlatform"))
}

func (s *Server) registerPageRoutes(api *echo.Group, authRequired echo.MiddlewareFunc) {
	pageH := handler.NewPageHandler(s.db)
	pageGrp := api.Group("/pages", authRequired)
	pageGrp.GET("", pageH.List, RequirePermission("managePage"))
	pageGrp.GET("/:id", pageH.Get, RequirePermission("managePage"))
	pageGrp.POST("", pageH.Create, RequirePermission("managePage"))
	pageGrp.PATCH("/:id", pageH.Patch, RequirePermission("managePage"))
	pageGrp.DELETE("/:id", pageH.Delete, RequirePermission("managePage"))
}
