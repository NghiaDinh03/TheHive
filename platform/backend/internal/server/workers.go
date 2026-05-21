package server

import (
	"context"

	"github.com/thehive-platform/backend/internal/cortex"
	"github.com/thehive-platform/backend/internal/misp"
	"github.com/thehive-platform/backend/internal/notification"
	"github.com/thehive-platform/backend/internal/opensearch"
	"go.uber.org/zap"
)

// configureWorkers builds runtime adapters once and keeps worker composition
// separate from HTTP routing.
func (s *Server) configureWorkers() {
	s.configureCortexWorker()
	s.configureNotificationWorker()
	s.configureMISPSyncWorker()
	s.configureOpenSearch()
}

func (s *Server) configureCortexWorker() {
	if !s.cfg.CortexEnabled || s.cfg.CortexURL == "" {
		return
	}
	cortexClient := cortex.NewCortexClient(cortex.CortexClientConfig{
		BaseURL: s.cfg.CortexURL,
		APIKey:  s.cfg.CortexAPIKey,
		Timeout: s.cfg.CortexTimeout,
	})
	cortexSvc := cortex.NewService(s.db)
	s.cortexWorker = cortex.NewWorker(cortexSvc, cortexClient, s.log, cortex.WorkerConfig{
		PollInterval: s.cfg.CortexPollInterval,
		BatchSize:    s.cfg.CortexBatchSize,
		MaxJobWait:   s.cfg.CortexMaxJobWait,
	})
	s.log.Info("cortex worker configured", zap.String("url", s.cfg.CortexURL))
}

func (s *Server) configureNotificationWorker() {
	if !s.cfg.NotificationWorkerEnabled {
		return
	}
	nw := notification.NewWorker(s.db, s.log, notification.WorkerConfig{
		PollInterval: s.cfg.NotificationWorkerPollInterval,
		BatchSize:    s.cfg.NotificationWorkerBatchSize,
	})
	nw.RegisterAdapter(notification.NewWebhookAdapter())
	nw.RegisterAdapter(notification.NewEmailAdapter(s.db))
	s.notifWorker = nw
	s.log.Info("notification worker configured")
}

func (s *Server) configureMISPSyncWorker() {
	if !s.cfg.MISPSyncEnabled || !s.cfg.MISPEnabled || s.cfg.MISPURL == "" {
		return
	}
	mispClient := misp.NewClient(misp.Config{
		BaseURL:   s.cfg.MISPURL,
		APIKey:    s.cfg.MISPAPIKey,
		Timeout:   s.cfg.MISPTimeout,
		VerifyTLS: s.cfg.MISPVerifyTLS,
	})
	s.mispSyncWorker = misp.NewSyncWorker(mispClient, s.db, s.log, misp.SyncWorkerConfig{
		SyncInterval: s.cfg.MISPSyncInterval,
	})
	s.log.Info("misp sync worker configured",
		zap.String("url", s.cfg.MISPURL),
		zap.Duration("interval", s.cfg.MISPSyncInterval),
	)
}

func (s *Server) configureOpenSearch() {
	if !s.cfg.OpenSearchEnabled || s.cfg.OpenSearchURL == "" {
		return
	}
	osClient := opensearch.NewClient(opensearch.Config{
		URL:         s.cfg.OpenSearchURL,
		IndexPrefix: s.cfg.OpenSearchIndex,
	})
	s.osClient = osClient
	s.osIndexer = opensearch.NewIndexerWorker(osClient, s.db, s.log, opensearch.IndexerConfig{})
	s.log.Info("opensearch configured", zap.String("url", s.cfg.OpenSearchURL))
}

func (s *Server) startWorkers(ctx context.Context) {
	if s.cortexWorker != nil {
		s.cortexWorker.Start(ctx)
	}
	if s.notifWorker != nil {
		s.notifWorker.Start(ctx)
	}
	if s.mispSyncWorker != nil {
		s.mispSyncWorker.Start(ctx)
	}
	if s.osIndexer != nil {
		if err := s.osClient.EnsureIndexes(ctx); err != nil {
			s.log.Warn("opensearch: failed to ensure indexes", zap.Error(err))
		}
		s.osIndexer.Start(ctx)
	}
}

func (s *Server) stopWorkers() {
	if s.cortexWorker != nil {
		s.cortexWorker.Stop()
	}
	if s.notifWorker != nil {
		s.notifWorker.Stop()
	}
	if s.mispSyncWorker != nil {
		s.mispSyncWorker.Stop()
	}
	if s.osIndexer != nil {
		s.osIndexer.Stop()
	}
}
