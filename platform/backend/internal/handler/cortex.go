package handler

import (
	"net/http"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/cortex"
)

type CortexHandler struct {
	svc *cortex.Service
}

func NewCortexHandler(db *sqlx.DB) *CortexHandler {
	return &CortexHandler{svc: cortex.NewService(db)}
}

func (h *CortexHandler) ListAnalyzers(c echo.Context) error {
	dataType := strings.TrimSpace(c.QueryParam("data_type"))
	var analyzers []cortex.Analyzer
	var err error
	if dataType != "" {
		analyzers, err = h.svc.ListAnalyzersForType(c.Request().Context(), dataType)
	} else {
		analyzers, err = h.svc.ListAnalyzers(c.Request().Context())
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to list analyzers"})
	}
	return c.JSON(http.StatusOK, analyzers)
}

func (h *CortexHandler) ListObservableJobs(c echo.Context) error {
	observableID := strings.TrimSpace(c.Param("id"))
	jobs, err := h.svc.ListJobsForObservable(c.Request().Context(), observableID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to list jobs"})
	}
	return c.JSON(http.StatusOK, jobs)
}

type analyzeRequest struct {
	AnalyzerID string `json:"analyzer_id"`
}

func (h *CortexHandler) AnalyzeObservable(c echo.Context) error {
	observableID := strings.TrimSpace(c.Param("id"))
	var req analyzeRequest
	_ = c.Bind(&req)
	if req.AnalyzerID == "" {
		req.AnalyzerID = "placeholder"
	}

	userLogin := ""
	if claims, ok := c.Get("user_login").(string); ok {
		userLogin = claims
	}

	job, err := h.svc.CreateJob(c.Request().Context(), cortex.CreateJobInput{
		ObservableID: observableID,
		AnalyzerID:   req.AnalyzerID,
		CreatedBy:    userLogin,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create job"})
	}
	return c.JSON(http.StatusCreated, job)
}

func (h *CortexHandler) GetJob(c echo.Context) error {
	jobID := strings.TrimSpace(c.Param("id"))
	job, err := h.svc.GetJob(c.Request().Context(), jobID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "job not found"})
	}
	return c.JSON(http.StatusOK, job)
}

func (h *CortexHandler) ProcessPending(c echo.Context) error {
	processed, err := h.svc.ProcessPendingJobs(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to process jobs"})
	}
	return c.JSON(http.StatusOK, map[string]int{"processed": processed})
}

func (h *CortexHandler) RetryFailed(c echo.Context) error {
	retried, err := h.svc.RetryFailedJobs(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to retry jobs"})
	}
	return c.JSON(http.StatusOK, map[string]int{"retried": retried})
}

func (h *CortexHandler) JobStats(c echo.Context) error {
	stats, err := h.svc.JobStats(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get stats"})
	}
	return c.JSON(http.StatusOK, stats)
}
