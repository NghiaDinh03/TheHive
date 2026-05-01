package server

import (
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/handler"
)

// registerIntegrationRoutes registers external integration routes for Cortex,
// MISP, and notification dispatch configuration.
func (s *Server) registerIntegrationRoutes(api *echo.Group, authRequired echo.MiddlewareFunc) {
	s.registerCortexRoutes(api, authRequired)
	s.registerMISPRoutes(api, authRequired)
	s.registerNotificationRoutes(api, authRequired)
}

func (s *Server) registerCortexRoutes(api *echo.Group, authRequired echo.MiddlewareFunc) {
	cortexH := handler.NewCortexHandler(s.db)
	cortexGrp := api.Group("/cortex", authRequired)
	cortexGrp.GET("/analyzers", cortexH.ListAnalyzers, RequirePermission("manageAnalyse"))
	cortexGrp.GET("/observables/:id/jobs", cortexH.ListObservableJobs, RequirePermission("manageAnalyse"))
	cortexGrp.POST("/observables/:id/analyze", cortexH.AnalyzeObservable, RequirePermission("manageAnalyse"))
	cortexGrp.GET("/jobs/:id", cortexH.GetJob, RequirePermission("manageAnalyse"))
	cortexGrp.POST("/jobs/process", cortexH.ProcessPending, RequirePermission("managePlatform"))
	cortexGrp.POST("/jobs/retry", cortexH.RetryFailed, RequirePermission("managePlatform"))
	cortexGrp.GET("/jobs/stats", cortexH.JobStats, RequirePermission("manageAnalyse"))
}

func (s *Server) registerMISPRoutes(api *echo.Group, authRequired echo.MiddlewareFunc) {
	mispH := handler.NewMISPHandler(s.db, s.newAuditRecorder())
	mispGrp := api.Group("/misp", authRequired)
	mispGrp.GET("/servers", mispH.ListServers, RequirePermission("managePlatform"))
	mispGrp.POST("/servers", mispH.CreateServer, RequirePermission("managePlatform"))
	mispGrp.DELETE("/servers/:id", mispH.DeleteServer, RequirePermission("managePlatform"))
	mispGrp.POST("/import/preview", mispH.ImportPreview, RequirePermission("manageAlert"))
	mispGrp.POST("/import", mispH.ImportEvent, RequirePermission("manageAlert"))
	mispGrp.POST("/export", mispH.ExportCase, RequirePermission("manageCase"))
	mispGrp.GET("/sync-log", mispH.ListSyncLog, RequirePermission("managePlatform"))
}

func (s *Server) registerNotificationRoutes(api *echo.Group, authRequired echo.MiddlewareFunc) {
	notifH := handler.NewNotificationHandler(s.db)
	notifGrp := api.Group("/notifications", authRequired)
	notifGrp.GET("", notifH.List, RequirePermission("managePlatform"))
	notifGrp.POST("", notifH.Create, RequirePermission("managePlatform"))
	notifGrp.DELETE("/:id", notifH.Delete, RequirePermission("managePlatform"))
}
