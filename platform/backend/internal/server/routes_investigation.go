package server

import (
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/handler"
	"github.com/thehive-platform/backend/internal/notification"
	"github.com/thehive-platform/backend/internal/repository/investigation"
)

// registerInvestigationRoutes registers case, alert, task, observable, attachment,
// case-template, and case sub-resource routes under /api/v1.
// This is the core SOC analyst workflow surface.
func (s *Server) registerInvestigationRoutes(api *echo.Group, authRequired echo.MiddlewareFunc) {
	auditRecorder := s.newAuditRecorder()
	notifEmitter := notification.NewEmitter(s.db, s.log)

	// --- Read-only investigation list ---
	investigationReader := investigation.NewReader(s.db, investigation.FactoryConfig{
		Source:        s.cfg.InvestigationDataSource,
		LegacyURL:     s.cfg.LegacyTheHiveURL,
		LegacyAPIKey:  s.cfg.LegacyTheHiveAPIKey,
		LegacyTimeout: s.cfg.LegacyTheHiveTimeout,
	})
	readonly := handler.NewReadOnlyHandler(investigationReader)

	// --- Write handlers ---
	caseWrite := handler.NewCaseWriteHandler(s.db, auditRecorder, handler.WithCaseNotifEmitter(notifEmitter))
	alertWrite := handler.NewAlertWriteHandler(s.db, auditRecorder, handler.WithAlertNotifEmitter(notifEmitter))
	workWrite := handler.NewWorkWriteHandler(s.db, auditRecorder, handler.WithWorkNotifEmitter(notifEmitter))
	detail := handler.NewDetailHandler(s.db)
	caseSub := handler.NewCaseSubHandler(s.db, auditRecorder)
	tplHandler := handler.NewTemplateHandler(s.db, auditRecorder)

	// --- Cases ---
	api.GET("/cases", readonly.ListCases, authRequired, RequirePermission("manageCase"))
	api.POST("/cases", caseWrite.Create, authRequired, RequirePermission("manageCase"))
	api.POST("/cases/from-template", tplHandler.CreateCaseFromTemplate, authRequired, RequirePermission("manageCase"))
	api.GET("/cases/:id", detail.GetCase, authRequired, RequirePermission("manageCase"))
	api.PATCH("/cases/:id", caseWrite.Patch, authRequired, RequirePermission("manageCase"))
	api.DELETE("/cases/:id", caseWrite.Delete, authRequired, RequirePermission("manageCase"))
	api.POST("/cases/:id/close", caseWrite.Close, authRequired, RequirePermission("manageCase"))
	api.POST("/cases/:id/reopen", caseWrite.Reopen, authRequired, RequirePermission("manageCase"))
	api.POST("/cases/:id/duplicate", caseWrite.MarkDuplicated, authRequired, RequirePermission("manageCase"))
	api.POST("/cases/:id/logs", workWrite.AppendCaseLog, authRequired, RequirePermission("manageCase"))
	api.GET("/cases/:id/tasks", detail.ListCaseTasks, authRequired, RequirePermission("manageCase"))
	api.GET("/cases/:id/logs", detail.ListCaseLogs, authRequired, RequirePermission("manageCase"))
	api.GET("/cases/:id/attachments", detail.ListCaseAttachments, authRequired, RequirePermission("manageCase"))
	api.GET("/cases/:id/observables", detail.ListCaseObservables, authRequired, RequirePermission("manageCase"))
	api.GET("/cases/:id/procedures", detail.ListCaseProcedures, authRequired, RequirePermission("manageCase"))
	api.GET("/cases/:id/shares", detail.ListCaseShares, authRequired, RequirePermission("manageCase"))
	api.GET("/cases/:id/timeline", detail.CaseTimeline, authRequired, RequirePermission("manageCase"))

	// --- Case sub-resources: custom fields, procedures, shares ---
	api.POST("/cases/:id/custom-fields", caseSub.CreateCustomField, authRequired, RequirePermission("manageCustomField"))
	api.PATCH("/cases/:id/custom-fields/:cfid", caseSub.UpdateCustomField, authRequired, RequirePermission("manageCustomField"))
	api.DELETE("/cases/:id/custom-fields/:cfid", caseSub.DeleteCustomField, authRequired, RequirePermission("manageCustomField"))
	api.POST("/cases/:id/procedures", caseSub.CreateProcedure, authRequired, RequirePermission("manageProcedure"))
	api.PATCH("/cases/:id/procedures/:procid", caseSub.UpdateProcedure, authRequired, RequirePermission("manageProcedure"))
	api.DELETE("/cases/:id/procedures/:procid", caseSub.DeleteProcedure, authRequired, RequirePermission("manageProcedure"))
	api.POST("/cases/:id/shares", caseSub.CreateShare, authRequired, RequirePermission("manageShare"))
	api.PATCH("/cases/:id/shares/:shareid", caseSub.UpdateShare, authRequired, RequirePermission("manageShare"))
	api.DELETE("/cases/:id/shares/:shareid", caseSub.DeleteShare, authRequired, RequirePermission("manageShare"))

	// --- Case templates ---
	api.GET("/case-templates", tplHandler.List, authRequired, RequirePermission("manageCaseTemplate"))
	api.GET("/case-templates/:id", tplHandler.Get, authRequired, RequirePermission("manageCaseTemplate"))
	api.POST("/case-templates", tplHandler.Create, authRequired, RequirePermission("manageCaseTemplate"))
	api.PATCH("/case-templates/:id", tplHandler.Patch, authRequired, RequirePermission("manageCaseTemplate"))
	api.DELETE("/case-templates/:id", tplHandler.Delete, authRequired, RequirePermission("manageCaseTemplate"))

	// --- Alerts ---
	api.GET("/alerts", readonly.ListAlerts, authRequired, RequirePermission("manageAlert"))
	api.GET("/alerts/:id", detail.GetAlert, authRequired, RequirePermission("manageAlert"))
	api.PATCH("/alerts/:id", alertWrite.Update, authRequired, RequirePermission("manageAlert"))
	api.DELETE("/alerts/:id", alertWrite.Delete, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts/:id/import", alertWrite.Import, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts/:id/merge", alertWrite.Merge, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts/:id/follow", alertWrite.ToggleFollow, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts/:id/read", alertWrite.ToggleRead, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts/bulk/import", alertWrite.BulkImport, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts/bulk/merge", alertWrite.BulkMerge, authRequired, RequirePermission("manageAlert"))

	// --- Tasks ---
	api.POST("/tasks", workWrite.CreateTask, authRequired, RequirePermission("manageTask"))
	api.GET("/tasks", detail.ListAllTasks, authRequired, RequirePermission("manageTask"))
	api.GET("/tasks/:id", detail.GetTask, authRequired, RequirePermission("manageTask"))
	api.PATCH("/tasks/:id", workWrite.PatchTask, authRequired, RequirePermission("manageTask"))
	api.POST("/tasks/reorder", workWrite.ReorderTasks, authRequired, RequirePermission("manageTask"))
	api.POST("/tasks/bulk/close", workWrite.BulkCloseTasks, authRequired, RequirePermission("manageTask"))
	api.POST("/tasks/bulk/assign", workWrite.BulkAssignTasks, authRequired, RequirePermission("manageTask"))
	api.POST("/tasks/:id/assign", workWrite.AssignTask, authRequired, RequirePermission("manageTask"))
	api.POST("/tasks/:id/close", workWrite.CloseTask, authRequired, RequirePermission("manageTask"))
	api.POST("/tasks/:id/start", workWrite.StartTask, authRequired, RequirePermission("manageTask"))
	api.POST("/tasks/:id/reopen", workWrite.ReopenTask, authRequired, RequirePermission("manageTask"))
	api.POST("/tasks/:id/cancel", workWrite.CancelTask, authRequired, RequirePermission("manageTask"))

	// --- Task logs (task-scoped, mirrors legacy /api/v1/tasks/:id/logs) ---
	api.GET("/tasks/:id/logs", detail.ListTaskLogs, authRequired, RequirePermission("manageTask"))
	api.POST("/tasks/:id/logs", workWrite.AppendTaskLog, authRequired, RequirePermission("manageTask"))

	// --- Observables ---
	api.GET("/observables", readonly.ListObservables, authRequired, RequirePermission("manageObservable"))
	api.GET("/observables/:id", detail.GetObservable, authRequired, RequirePermission("manageObservable"))
	api.POST("/observables", workWrite.CreateObservable, authRequired, RequirePermission("manageObservable"))
	api.PATCH("/observables/:id", workWrite.PatchObservable, authRequired, RequirePermission("manageObservable"))
	api.DELETE("/observables/:id", workWrite.DeleteObservable, authRequired, RequirePermission("manageObservable"))
	api.POST("/observables/:id/analyze", workWrite.AnalyzeObservable, authRequired, RequirePermission("manageObservable"))

	// --- Observable types ---
	api.GET("/observable-types", func(c echo.Context) error {
		rows := []struct {
			Name         string `db:"name" json:"name"`
			IsAttachment bool   `db:"is_attachment" json:"is_attachment"`
		}{}
		if err := s.db.SelectContext(c.Request().Context(), &rows, `SELECT name, is_attachment FROM observable_types ORDER BY name`); err != nil {
			return c.JSON(500, map[string]string{"error": "failed to list types"})
		}
		return c.JSON(200, rows)
	}, authRequired)
}
