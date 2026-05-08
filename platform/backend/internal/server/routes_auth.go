package server

import (
	"time"

	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/audit"
	"github.com/thehive-platform/backend/internal/handler"
	"github.com/thehive-platform/backend/internal/mail"
)

// registerAuthRoutes registers authentication and session management routes under /api/v1/auth.
func (s *Server) registerAuthRoutes(api *echo.Group) {
	auditRecorder := s.newAuditRecorder()
	mailSender := s.newMailSender()
	authLimiter := NewRateLimiter(10, 5*time.Minute, 15*time.Minute)
	auth := handler.NewAuthHandler(s.db, s.cfg.JWTSecret, s.cfg.JWTExpiry, auditRecorder, mailSender)

	authGrp := api.Group("/auth")
	authGrp.POST("/login", auth.Login, authLimiter.Middleware("login"))
	authGrp.POST("/register", auth.Register, authLimiter.Middleware("register"))
	authGrp.POST("/password-reset/request", auth.RequestPasswordReset, authLimiter.Middleware("password-reset-request"))
	authGrp.POST("/password-reset/confirm", auth.ResetPassword, authLimiter.Middleware("password-reset-confirm"))

	authRequired := Authenticate(s.cfg.JWTSecret, s.db)
	authGrp.POST("/logout", auth.Logout, authRequired)
	authGrp.GET("/me", auth.Me, authRequired)
	authGrp.PATCH("/me", auth.UpdateMe, authRequired)
	authGrp.POST("/password", auth.ChangePassword, authRequired)
	authGrp.GET("/sessions", auth.ListSessions, authRequired)
	authGrp.POST("/sessions/revoke-all", auth.RevokeAllSessions, authRequired)
	// API key management (personal-settings API key tab)
	authGrp.POST("/api-key", auth.GenerateAPIKey, authRequired)

	// Legacy parity: TOTP 2FA (mirrors legacy POST /api/v1/auth/totp/set, /auth/totp/unset)
	authGrp.POST("/totp/set", handler.TOTPSetSecret, authRequired)
	authGrp.POST("/totp/unset", handler.TOTPUnsetSecret, authRequired)
	authGrp.POST("/totp/unset/:user", handler.TOTPUnsetSecret, authRequired, RequirePermission("manageUser"))
}

// registerAdminRoutes registers admin management routes under /api/v1/admin.
func (s *Server) registerAdminRoutes(api *echo.Group, authRequired echo.MiddlewareFunc) {
	auditRecorder := s.newAuditRecorder()
	mailSender := s.newMailSender()
	admin := handler.NewAdminHandler(s.db, auditRecorder, mailSender)
	catalog := handler.NewAdminCatalogHandler(s.db, auditRecorder)

	adminGrp := api.Group("/admin", authRequired)
	adminGrp.GET("/ui-config", admin.GetUISettings, RequirePermission("manageConfig"))
	adminGrp.POST("/ui-config", admin.SaveUISettings, RequirePermission("manageConfig"))
	adminGrp.GET("/users", admin.ListUsers, RequirePermission("manageUser"))
	adminGrp.POST("/users", admin.CreateUser, RequirePermission("manageUser"))
	adminGrp.PATCH("/users/:login", admin.UpdateUser, RequirePermission("manageUser"))
	adminGrp.DELETE("/users/:login", admin.DeleteUser, RequirePermission("manageUser"))
	adminGrp.POST("/users/:login/lock", admin.LockUser, RequirePermission("manageUser"))
	adminGrp.POST("/users/:login/unlock", admin.UnlockUser, RequirePermission("manageUser"))
	adminGrp.POST("/users/:login/reset-password", admin.ResetUserPassword, RequirePermission("manageUser"))
	adminGrp.POST("/users/:login/reset-token", admin.GenerateResetToken, RequirePermission("manageUser"))
	adminGrp.POST("/users/:login/approve", admin.ApproveUser, RequirePermission("manageUser"))
	adminGrp.GET("/organisations", admin.ListOrganisations, RequirePermission("manageOrganisation"))
	adminGrp.POST("/organisations", admin.UpsertOrganisation, RequirePermission("manageOrganisation"))
	adminGrp.PATCH("/organisations/:id", admin.UpdateOrganisation, RequirePermission("manageOrganisation"))
	adminGrp.DELETE("/organisations/:id", admin.DeleteOrganisation, RequirePermission("manageOrganisation"))
	adminGrp.GET("/profiles", admin.ListProfiles, RequirePermission("manageProfile"))
	adminGrp.POST("/profiles", admin.UpsertProfile, RequirePermission("manageProfile"))
	adminGrp.PATCH("/profiles/:id", admin.UpdateProfile, RequirePermission("manageProfile"))
	adminGrp.DELETE("/profiles/:id", admin.DeleteProfile, RequirePermission("manageProfile"))

	// Custom field definition catalogue (legacy admin/custom-fields.html).
	adminGrp.GET("/custom-fields", catalog.ListCustomFieldDefs, RequirePermission("manageCustomField"))
	adminGrp.POST("/custom-fields", catalog.UpsertCustomFieldDef, RequirePermission("manageCustomField"))
	adminGrp.DELETE("/custom-fields/:reference", catalog.DeleteCustomFieldDef, RequirePermission("manageCustomField"))

	// Taxonomy catalogue (legacy admin/taxonomy/*.html).
	adminGrp.GET("/taxonomies", catalog.ListTaxonomies, RequirePermission("manageTaxonomy"))
	adminGrp.GET("/taxonomies/:id", catalog.GetTaxonomy, RequirePermission("manageTaxonomy"))
	adminGrp.POST("/taxonomies/import", catalog.ImportTaxonomy, RequirePermission("manageTaxonomy"))
	adminGrp.POST("/taxonomies/:id/toggle", catalog.ToggleTaxonomy, RequirePermission("manageTaxonomy"))
	adminGrp.DELETE("/taxonomies/:id", catalog.DeleteTaxonomy, RequirePermission("manageTaxonomy"))

	// MITRE ATT&CK pattern catalogue (legacy admin/attack/*.html).
	adminGrp.GET("/attack-patterns", catalog.ListAttackPatterns, RequirePermission("manageProcedure"))
	adminGrp.POST("/attack-patterns/import", catalog.ImportAttackPatterns, RequirePermission("manageProcedure"))

	// Legacy parity: Admin index management (mirrors legacy /api/v1/admin/index/*)
	indexHandler := handler.NewAdminIndexHandler(s.db)
	adminGrp.GET("/index/status", indexHandler.IndexStatus, RequirePermission("managePlatform"))
	adminGrp.POST("/index/:name/reindex", indexHandler.Reindex, RequirePermission("managePlatform"))
	adminGrp.POST("/index/:name/rebuild", indexHandler.RebuildIndex, RequirePermission("managePlatform"))

	// Legacy parity: Admin check operations (mirrors legacy /api/v1/admin/check/*)
	checkHandler := handler.NewAdminCheckHandler(s.db)
	adminGrp.GET("/check/stats", checkHandler.CheckStats, RequirePermission("managePlatform"))
	adminGrp.GET("/check/:name/trigger", checkHandler.TriggerGlobalCheck, RequirePermission("managePlatform"))
	adminGrp.POST("/check/:name/global/trigger", checkHandler.TriggerGlobalCheck, RequirePermission("managePlatform"))
	adminGrp.POST("/check/:name/dedup/trigger", checkHandler.TriggerDedup, RequirePermission("managePlatform"))
	adminGrp.POST("/check/cancel", checkHandler.CancelCurrentCheck, RequirePermission("managePlatform"))
	adminGrp.GET("/log/set/:packageName/:level", checkHandler.SetLogLevel, RequirePermission("managePlatform"))

	// Legacy parity: Admin schema repair/info (mirrors legacy /api/v1/admin/schema/*)
	schemaHandler := handler.NewAdminSchemaHandler(s.db)
	adminGrp.POST("/schema/repair/:schemaName", schemaHandler.SchemaRepair, RequirePermission("managePlatform"))
	adminGrp.POST("/schema/info/:schemaName", schemaHandler.SchemaInfo, RequirePermission("managePlatform"))

	// Legacy parity: User avatar + reset failed attempts (mirrors legacy /api/v1/user/:id/avatar, /user/:id/reset)
	adminGrp.GET("/users/:login/avatar", func(c echo.Context) error {
		c.Set("db", s.db)
		return handler.GetUserAvatar(c)
	}, RequirePermission("manageUser"))
	adminGrp.POST("/users/:login/reset", func(c echo.Context) error {
		c.Set("db", s.db)
		return handler.ResetUserFailedAttempts(c)
	}, RequirePermission("manageUser"))
}

// registerAuditRoutes registers audit log routes under /api/v1/audit.
func (s *Server) registerAuditRoutes(api *echo.Group, authRequired echo.MiddlewareFunc) {
	auditHandler := handler.NewAuditHandler(s.db)
	api.GET("/audit", auditHandler.List, authRequired, RequirePermission("managePlatform"))
}

// --- Shared factory helpers to avoid duplicating construction logic ---

func (s *Server) newAuditRecorder() *audit.Recorder {
	return audit.NewRecorder(s.db)
}

func (s *Server) newMailSender() *mail.Sender {
	return mail.NewSender(mail.Config{
		Enabled:  s.cfg.MailEnabled,
		Host:     s.cfg.MailHost,
		Port:     s.cfg.MailPort,
		Username: s.cfg.MailUsername,
		Password: s.cfg.MailPassword,
		From:     s.cfg.MailFrom,
		BaseURL:  s.cfg.PublicBaseURL,
	})
}
