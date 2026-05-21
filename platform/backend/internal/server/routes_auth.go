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
	authHandler := handler.NewAuthHandler(s.db, s.cfg.JWTSecret, s.cfg.JWTExpiry, auditRecorder, mailSender)

	authGrp := api.Group("/auth")
	authGrp.POST("/login", authHandler.Login, authLimiter.Middleware("login"))
	authGrp.POST("/totp/login", authHandler.LoginTOTP, authLimiter.Middleware("login"))
	authGrp.POST("/unlock", authHandler.UnlockWith2FA, authLimiter.Middleware("login"))
	authGrp.POST("/register", authHandler.Register, authLimiter.Middleware("register"))
	authGrp.POST("/password-reset/request", authHandler.RequestPasswordReset, authLimiter.Middleware("password-reset-request"))
	authGrp.POST("/password-reset/confirm", authHandler.ResetPassword, authLimiter.Middleware("password-reset-confirm"))

	authMiddleware := Authenticate(s.cfg.JWTSecret, s.db)
	// TOTP setup and management (requires authentication)
	authGrp.GET("/totp/setup", authHandler.SetupTOTP, authMiddleware)
	authGrp.POST("/totp/verify", authHandler.VerifyAndEnableTOTP, authMiddleware, authLimiter.Middleware("totp-verify"))
	authGrp.POST("/totp/disable", authHandler.DisableTOTP, authMiddleware, authLimiter.Middleware("totp-disable"))

	authGrp.POST("/logout", authHandler.Logout, authMiddleware)
	authGrp.GET("/me", authHandler.Me, authMiddleware)
	authGrp.PATCH("/me", authHandler.UpdateMe, authMiddleware)
	authGrp.POST("/password", authHandler.ChangePassword, authMiddleware)
	authGrp.GET("/sessions", authHandler.ListSessions, authMiddleware)
	authGrp.POST("/sessions/revoke-all", authHandler.RevokeAllSessions, authMiddleware)
	// API key management (personal-settings API key tab)
	authGrp.POST("/api-key", authHandler.GenerateAPIKey, authMiddleware)

	// Legacy parity: TOTP 2FA (mirrors legacy POST /api/v1/auth/totp/set, /auth/totp/unset)
	authGrp.POST("/totp/set", handler.TOTPSetSecret, authMiddleware)
	authGrp.POST("/totp/unset", handler.TOTPUnsetSecret, authMiddleware)
	authGrp.POST("/totp/unset/:user", handler.TOTPUnsetSecret, authMiddleware, RequirePermission("manageUser"))

	usersGrp := api.Group("/users", authMiddleware)
	usersGrp.GET("/search", authHandler.SearchUsers)
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
	adminGrp.POST("/users", admin.CreateUser, RequirePermission("manageUser"), RequireStepUp2FA(s.db))
	adminGrp.PATCH("/users/:login", admin.UpdateUser, RequirePermission("manageUser"), RequireStepUp2FA(s.db))
	adminGrp.DELETE("/users/:login", admin.DeleteUser, RequirePermission("manageUser"), RequireStepUp2FA(s.db))
	adminGrp.POST("/users/:login/lock", admin.LockUser, RequirePermission("manageUser"), RequireStepUp2FA(s.db))
	adminGrp.POST("/users/:login/unlock", admin.UnlockUser, RequirePermission("manageUser"), RequireStepUp2FA(s.db))
	adminGrp.POST("/users/:login/reset-password", admin.ResetUserPassword, RequirePermission("manageUser"), RequireStepUp2FA(s.db))
	adminGrp.POST("/users/:login/reset-token", admin.GenerateResetToken, RequirePermission("manageUser"), RequireStepUp2FA(s.db))
	adminGrp.POST("/users/:login/approve", admin.ApproveUser, RequirePermission("manageUser"), RequireStepUp2FA(s.db))
	adminGrp.GET("/organisations", admin.ListOrganisations, RequireAnyPermission("manageOrganisation", "manageUser"))
	adminGrp.POST("/organisations", admin.UpsertOrganisation, RequirePermission("manageOrganisation"), RequireStepUp2FA(s.db))
	adminGrp.PATCH("/organisations/:id", admin.UpdateOrganisation, RequirePermission("manageOrganisation"), RequireStepUp2FA(s.db))
	adminGrp.DELETE("/organisations/:id", admin.DeleteOrganisation, RequirePermission("manageOrganisation"), RequireStepUp2FA(s.db))
	adminGrp.GET("/profiles", admin.ListProfiles, RequireAnyPermission("manageProfile", "manageUser"))
	adminGrp.POST("/profiles", admin.UpsertProfile, RequirePermission("manageProfile"), RequireStepUp2FA(s.db))
	adminGrp.PATCH("/profiles/:id", admin.UpdateProfile, RequirePermission("manageProfile"), RequireStepUp2FA(s.db))
	adminGrp.DELETE("/profiles/:id", admin.DeleteProfile, RequirePermission("manageProfile"), RequireStepUp2FA(s.db))

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

	// Legacy parity: Feature flags management (mirrors legacy /api/v1/admin/feature-flags)
	featureFlagHandler := handler.NewFeatureFlagHandler(s.db)
	adminGrp.GET("/feature-flags", featureFlagHandler.List, RequirePermission("managePlatform"))
	adminGrp.GET("/feature-flags/:name", featureFlagHandler.Get, RequirePermission("managePlatform"))
	adminGrp.POST("/feature-flags", featureFlagHandler.Create, RequirePermission("managePlatform"))
	adminGrp.PATCH("/feature-flags/:name", featureFlagHandler.Patch, RequirePermission("managePlatform"))
	adminGrp.DELETE("/feature-flags/:name", featureFlagHandler.Delete, RequirePermission("managePlatform"))

	// Legacy parity: Archive links management
	archiveLinkHandler := handler.NewArchiveLinkHandler(s.db)
	adminGrp.GET("/archive-links", archiveLinkHandler.List, RequirePermission("managePlatform"))
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
		BaseURL:  s.cfg.PublicBaseURL,
	}, s.db)
}
