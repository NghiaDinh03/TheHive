package server

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/thehive-platform/backend/internal/audit"
	"github.com/thehive-platform/backend/internal/config"
	"github.com/thehive-platform/backend/internal/handler"
	"github.com/thehive-platform/backend/internal/mail"
	"github.com/thehive-platform/backend/internal/metrics"
	"github.com/thehive-platform/backend/internal/mq"
	"github.com/thehive-platform/backend/internal/repository/investigation"
	"github.com/thehive-platform/backend/internal/version"
	"go.uber.org/zap"
)

type Server struct {
	cfg     config.Config
	echo    *echo.Echo
	log     *zap.Logger
	db      *sqlx.DB
	mq      *mq.Client
	metrics *metrics.Registry
}

func New(cfg config.Config, log *zap.Logger, d *sqlx.DB, m *mq.Client, met *metrics.Registry) *Server {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.Validator = NewValidator()
	e.HTTPErrorHandler = ErrorHandler(log)

	e.Use(RequestID())
	e.Use(Recovery(log))
	e.Use(Logging(log))
	e.Use(MetricsMW(met))
	e.Use(CORS(cfg.CORSAllowed))
	e.Use(middleware.TimeoutWithConfig(middleware.TimeoutConfig{
		Timeout: cfg.RequestTimeout,
	}))

	s := &Server{
		cfg:     cfg,
		echo:    e,
		log:     log,
		db:      d,
		mq:      m,
		metrics: met,
	}
	s.routes()
	v := version.Get()
	met.AppInfo.WithLabelValues(v.Version, v.GitSHA, v.ReleaseClass).Set(1)
	return s
}

func (s *Server) routes() {
	hh := handler.NewHealthHandler(s.db, s.mq)
	s.echo.GET("/healthz", hh.Live)
	s.echo.GET("/readyz", hh.Ready)
	s.echo.GET("/metrics", echo.WrapHandler(s.metrics.Handler()))

	api := s.echo.Group("/api/v1")

	stat := handler.NewStatusHandler(s.db)
	api.GET("/status", stat.Status)

	auditRecorder := audit.NewRecorder(s.db)
	mailSender := mail.NewSender(mail.Config{Enabled: s.cfg.MailEnabled, Host: s.cfg.MailHost, Port: s.cfg.MailPort, Username: s.cfg.MailUsername, Password: s.cfg.MailPassword, From: s.cfg.MailFrom, BaseURL: s.cfg.PublicBaseURL})
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
	authGrp.POST("/password", auth.ChangePassword, authRequired)
	authGrp.GET("/sessions", auth.ListSessions, authRequired)
	authGrp.POST("/sessions/revoke-all", auth.RevokeAllSessions, authRequired)

	admin := handler.NewAdminHandler(s.db, auditRecorder, mailSender)
	adminGrp := api.Group("/admin", authRequired)
	adminGrp.GET("/users", admin.ListUsers, RequirePermission("manageUser"))
	adminGrp.POST("/users", admin.CreateUser, RequirePermission("manageUser"))
	adminGrp.PATCH("/users/:login", admin.UpdateUser, RequirePermission("manageUser"))
	adminGrp.POST("/users/:login/lock", admin.LockUser, RequirePermission("manageUser"))
	adminGrp.POST("/users/:login/unlock", admin.UnlockUser, RequirePermission("manageUser"))
	adminGrp.POST("/users/:login/reset-password", admin.ResetUserPassword, RequirePermission("manageUser"))
	adminGrp.POST("/users/:login/reset-token", admin.GenerateResetToken, RequirePermission("manageUser"))
	adminGrp.POST("/users/:login/approve", admin.ApproveUser, RequirePermission("manageUser"))
	adminGrp.GET("/organisations", admin.ListOrganisations, RequirePermission("manageOrganisation"))
	adminGrp.POST("/organisations", admin.UpsertOrganisation, RequirePermission("manageOrganisation"))
	adminGrp.GET("/profiles", admin.ListProfiles, RequirePermission("manageConfig"))
	adminGrp.POST("/profiles", admin.UpsertProfile, RequirePermission("manageConfig"))

	auditHandler := handler.NewAuditHandler(s.db)
	api.GET("/audit", auditHandler.List, authRequired, RequirePermission("manageConfig"))

	investigationReader := investigation.NewReader(s.db, investigation.FactoryConfig{
		Source:        s.cfg.InvestigationDataSource,
		LegacyURL:     s.cfg.LegacyTheHiveURL,
		LegacyAPIKey:  s.cfg.LegacyTheHiveAPIKey,
		LegacyTimeout: s.cfg.LegacyTheHiveTimeout,
	})
	readonly := handler.NewReadOnlyHandler(investigationReader)
	caseWrite := handler.NewCaseWriteHandler(s.db, auditRecorder)
	alertWrite := handler.NewAlertWriteHandler(s.db, auditRecorder)
	workWrite := handler.NewWorkWriteHandler(s.db, auditRecorder)
	api.GET("/cases", readonly.ListCases, authRequired, RequirePermission("manageCase"))
	api.POST("/cases", caseWrite.Create, authRequired, RequirePermission("manageCase"))
	api.PATCH("/cases/:id", caseWrite.Patch, authRequired, RequirePermission("manageCase"))
	api.POST("/cases/:id/close", caseWrite.Close, authRequired, RequirePermission("manageCase"))
	api.POST("/cases/:id/reopen", caseWrite.Reopen, authRequired, RequirePermission("manageCase"))
	api.POST("/cases/:id/logs", workWrite.AppendCaseLog, authRequired, RequirePermission("manageCase"))
	api.GET("/alerts", readonly.ListAlerts, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts/:id/import", alertWrite.Import, authRequired, RequirePermission("manageAlert"))
	api.POST("/alerts/:id/merge", alertWrite.Merge, authRequired, RequirePermission("manageAlert"))
	api.POST("/tasks", workWrite.CreateTask, authRequired, RequirePermission("manageCase"))
	api.PATCH("/tasks/:id", workWrite.PatchTask, authRequired, RequirePermission("manageCase"))
	api.POST("/tasks/:id/assign", workWrite.AssignTask, authRequired, RequirePermission("manageCase"))
	api.POST("/tasks/:id/close", workWrite.CloseTask, authRequired, RequirePermission("manageCase"))
	api.GET("/observables", readonly.ListObservables, authRequired, RequirePermission("manageObservable"))
	api.POST("/observables", workWrite.CreateObservable, authRequired, RequirePermission("manageObservable"))
	api.PATCH("/observables/:id", workWrite.PatchObservable, authRequired, RequirePermission("manageObservable"))
	api.DELETE("/observables/:id", workWrite.DeleteObservable, authRequired, RequirePermission("manageObservable"))
	api.POST("/observables/:id/analyze", workWrite.AnalyzeObservable, authRequired, RequirePermission("manageObservable"))
}

func (s *Server) Start() error {
	s.log.Info("http server starting", zap.String("addr", s.cfg.HTTPAddr))
	if err := s.echo.Start(s.cfg.HTTPAddr); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func (s *Server) Shutdown(ctx context.Context) error {
	shutdownCtx, cancel := context.WithTimeout(ctx, s.cfg.ShutdownGrace)
	defer cancel()
	s.log.Info("http server shutting down", zap.Duration("grace", s.cfg.ShutdownGrace))
	if err := s.echo.Shutdown(shutdownCtx); err != nil {
		return err
	}
	return nil
}
