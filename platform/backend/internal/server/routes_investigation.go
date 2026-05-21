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
	api.POST("/cases/:id/sync-misp", caseWrite.SyncMISP, authRequired, RequirePermission("manageCase"))
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
	api.GET("/cases/:id/tasks/:taskid/shares", detail.ListCaseShares, authRequired, RequirePermission("manageCase"))
	api.DELETE("/tasks/:id/shares", caseSub.DeleteShare, authRequired, RequirePermission("manageShare"))

	// --- Case templates ---
	api.GET("/case-templates", tplHandler.List, authRequired, RequirePermission("manageCaseTemplate"))
	api.GET("/case-templates/:id", tplHandler.Get, authRequired, RequirePermission("manageCaseTemplate"))
	api.POST("/case-templates", tplHandler.Create, authRequired, RequirePermission("manageCaseTemplate"))
	api.PATCH("/case-templates/:id", tplHandler.Patch, authRequired, RequirePermission("manageCaseTemplate"))
	api.DELETE("/case-templates/:id", tplHandler.Delete, authRequired, RequirePermission("manageCaseTemplate"))

	// --- Alerts ---
	api.GET("/alerts", readonly.ListAlerts, authRequired, RequirePermission("manageAlert"))
	api.GET("/alerts/:id", detail.GetAlert, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts", alertWrite.CreateAlert, authRequired, RequirePermission("manageAlert"))
	api.PATCH("/alerts/:id", alertWrite.Update, authRequired, RequirePermission("manageAlert"))
	api.DELETE("/alerts/:id", alertWrite.Delete, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts/:id/import", alertWrite.Import, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts/:id/merge", alertWrite.Merge, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts/:id/follow", alertWrite.ToggleFollow, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts/:id/unfollow", alertWrite.ToggleFollow, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts/:id/read", alertWrite.ToggleRead, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts/:id/unread", alertWrite.ToggleRead, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts/bulk/import", alertWrite.BulkImport, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts/bulk/merge", alertWrite.BulkMerge, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts/fix-case-link", alertWrite.FixAlertCaseLink, authRequired, RequirePermission("manageAlert"))

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
	api.GET("/tasks/:id/action-required", workWrite.GetTaskActionRequired, authRequired, RequirePermission("manageTask"))
	api.PUT("/tasks/:id/action-required/:orgId", workWrite.SetTaskActionRequired, authRequired, RequirePermission("manageTask"))
	api.PUT("/tasks/:id/action-done/:orgId", workWrite.SetTaskActionDone, authRequired, RequirePermission("manageTask"))

	// --- Task logs ---
	api.GET("/tasks/:id/logs", detail.ListTaskLogs, authRequired, RequirePermission("manageTask"))
	api.POST("/tasks/:id/logs", workWrite.AppendTaskLog, authRequired, RequirePermission("manageTask"))
	api.PATCH("/logs/:id", workWrite.UpdateLog, authRequired, RequirePermission("manageTask"))
	api.DELETE("/logs/:id", workWrite.DeleteLog, authRequired, RequirePermission("manageTask"))

	// --- Observables ---
	api.GET("/observables", readonly.ListObservables, authRequired, RequirePermission("manageObservable"))
	api.GET("/observables/:id", detail.GetObservable, authRequired, RequirePermission("manageObservable"))
	api.POST("/observables", workWrite.CreateObservable, authRequired, RequirePermission("manageObservable"))
	api.PATCH("/observables/:id", workWrite.PatchObservable, authRequired, RequirePermission("manageObservable"))
	api.DELETE("/observables/:id", workWrite.DeleteObservable, authRequired, RequirePermission("manageObservable"))
	api.POST("/observables/:id/analyze", workWrite.AnalyzeObservable, authRequired, RequirePermission("manageObservable"))
	api.GET("/observables/:id/similar", detail.SimilarObservables, authRequired, RequirePermission("manageObservable"))
	api.PATCH("/observables/bulk", workWrite.BulkUpdateObservables, authRequired, RequirePermission("manageObservable"))

	// --- Observable types ---
	obsTypeHandler := handler.NewObservableTypeHandler(s.db)
	api.GET("/observable-types", obsTypeHandler.ListObservableTypes, authRequired)
	api.POST("/observable-types", obsTypeHandler.CreateObservableType, authRequired, RequirePermission("manageObservable"))
	api.DELETE("/observable-types/:idOrName", obsTypeHandler.DeleteObservableType, authRequired, RequirePermission("manageObservable"))
	api.PUT("/observable-types/rename/:from/:to", obsTypeHandler.RenameObservableType, authRequired, RequirePermission("manageObservable"))

	// --- Tags ---
	tagHandler := handler.NewTagHandler(s.db)
	api.GET("/tags", func(c echo.Context) error {
		rows := []struct {
			Name string `db:"name" json:"name"`
		}{}
		if err := s.db.SelectContext(c.Request().Context(), &rows, `SELECT DISTINCT predicate AS name FROM tags ORDER BY predicate`); err != nil {
			return c.JSON(500, map[string]string{"error": "failed to list tags"})
		}
		return c.JSON(200, rows)
	}, authRequired)
	api.GET("/tags/:id", tagHandler.GetTag, authRequired)
	api.PATCH("/tags/:id", tagHandler.UpdateTag, authRequired, RequirePermission("manageCase"))
	api.DELETE("/tags/:id", tagHandler.DeleteTag, authRequired, RequirePermission("manageCase"))

	// --- Patterns ---
	patternHandler := handler.NewPatternHandler(s.db)
	api.GET("/patterns/:id", patternHandler.GetPattern, authRequired, RequirePermission("manageProcedure"))
	api.DELETE("/patterns/:id", patternHandler.DeletePattern, authRequired, RequirePermission("manageProcedure"))
	api.GET("/patterns/case/:caseId", patternHandler.GetCasePatterns, authRequired, RequirePermission("manageProcedure"))

	// --- Describe API ---
	describeHandler := handler.NewDescribeHandler(s.db)
	api.GET("/describe/_all", describeHandler.DescribeAll, authRequired)
	api.GET("/describe/:model", describeHandler.DescribeModel, authRequired)
	// --- Archive API ---
	archiveHandler := handler.NewArchiveLinkHandler(s.db)
	api.GET("/archive/:type/:id", archiveHandler.Get, authRequired, RequirePermission("manageCase"))
	api.POST("/archive", archiveHandler.Create, authRequired, RequirePermission("manageCase"))
	api.DELETE("/archive/:type/:id", archiveHandler.Delete, authRequired, RequirePermission("manageCase"))
}
