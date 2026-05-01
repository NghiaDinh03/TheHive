package server

import (
	"context"
	"errors"
	"net/http"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/thehive-platform/backend/internal/config"
	"github.com/thehive-platform/backend/internal/cortex"
	"github.com/thehive-platform/backend/internal/handler"
	"github.com/thehive-platform/backend/internal/metrics"
	"github.com/thehive-platform/backend/internal/misp"
	"github.com/thehive-platform/backend/internal/mq"
	"github.com/thehive-platform/backend/internal/notification"
	"github.com/thehive-platform/backend/internal/opensearch"
	"github.com/thehive-platform/backend/internal/version"
	"go.uber.org/zap"
)

type Server struct {
	cfg            config.Config
	echo           *echo.Echo
	log            *zap.Logger
	db             *sqlx.DB
	mq             *mq.Client
	metrics        *metrics.Registry
	cortexWorker   *cortex.Worker
	notifWorker    *notification.Worker
	mispSyncWorker *misp.SyncWorker
	osIndexer      *opensearch.IndexerWorker
	osClient       *opensearch.Client
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

	s.configureWorkers()

	v := version.Get()
	met.AppInfo.WithLabelValues(v.Version, v.GitSHA, v.ReleaseClass).Set(1)
	return s
}

func (s *Server) routes() {
	s.registerHealthRoutes(s.echo)

	api := s.echo.Group("/api/v1")
	authRequired := Authenticate(s.cfg.JWTSecret, s.db)

	s.registerStatusRoutes(api)
	s.registerAuthRoutes(api)
	s.registerAdminRoutes(api, authRequired)
	s.registerAuditRoutes(api, authRequired)
	s.registerInvestigationRoutes(api, authRequired)
	s.registerAttachmentRoutes(api, authRequired)
	s.registerIntegrationRoutes(api, authRequired)
	s.registerContentRoutes(api, authRequired)
	s.registerSearchRoutes(api, authRequired)
}

func (s *Server) registerStatusRoutes(api *echo.Group) {
	stat := handler.NewStatusHandler(s.db)
	api.GET("/status", stat.Status)
}

func (s *Server) Start() error {
	s.startWorkers(context.Background())

	s.log.Info("http server starting", zap.String("addr", s.cfg.HTTPAddr))
	if err := s.echo.Start(s.cfg.HTTPAddr); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func (s *Server) Shutdown(ctx context.Context) error {
	s.stopWorkers()

	shutdownCtx, cancel := context.WithTimeout(ctx, s.cfg.ShutdownGrace)
	defer cancel()
	s.log.Info("http server shutting down", zap.Duration("grace", s.cfg.ShutdownGrace))
	if err := s.echo.Shutdown(shutdownCtx); err != nil {
		return err
	}
	return nil
}
