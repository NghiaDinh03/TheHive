package server

import (
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/handler"
)

// registerHealthRoutes registers health/readiness/metrics endpoints at the root level.
// These are not behind /api/v1 and do not require authentication.
func (s *Server) registerHealthRoutes(e *echo.Echo) {
	hh := handler.NewHealthHandler(s.db, s.mq)
	e.GET("/healthz", hh.Live)
	e.GET("/readyz", hh.Ready)
	e.GET("/metrics", echo.WrapHandler(s.metrics.Handler()))

	// Legacy parity: Disk monitoring (mirrors legacy GET /api/v1/monitor/disk)
	diskHandler := handler.NewDiskUsageHandler()
	e.GET("/api/v1/monitor/disk", diskHandler.DiskUsage)
}
