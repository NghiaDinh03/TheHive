package handler

import (
	"net/http"
	"os"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

// ConfigValidateHandler validates production configuration at startup.
type ConfigValidateHandler struct {
	db *sqlx.DB
}

func NewConfigValidateHandler(db *sqlx.DB) *ConfigValidateHandler {
	return &ConfigValidateHandler{db: db}
}

type ConfigValidationResult struct {
	Valid   bool          `json:"valid"`
	Checks  []ConfigCheck `json:"checks"`
	Summary string        `json:"summary"`
}

type ConfigCheck struct {
	Name    string `json:"name"`
	Status  string `json:"status"` // pass, fail, warn
	Message string `json:"message"`
}

func (h *ConfigValidateHandler) Validate(c echo.Context) error {
	checks := []ConfigCheck{}

	// Check JWT secret
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" || jwtSecret == "please-change-me-please-change-me-32+" {
		checks = append(checks, ConfigCheck{"JWT_SECRET", "fail", "JWT secret is default or empty"})
	} else {
		checks = append(checks, ConfigCheck{"JWT_SECRET", "pass", "JWT secret is configured"})
	}

	// Check PostgreSQL
	var pgOK bool
	if err := h.db.Get(&pgOK, `SELECT true`); err != nil {
		checks = append(checks, ConfigCheck{"PostgreSQL", "fail", "Cannot connect to PostgreSQL"})
	} else {
		checks = append(checks, ConfigCheck{"PostgreSQL", "pass", "PostgreSQL connection OK"})
	}

	// Check S3/MinIO config
	s3Endpoint := os.Getenv("S3_ENDPOINT")
	if s3Endpoint == "" {
		checks = append(checks, ConfigCheck{"S3_ENDPOINT", "warn", "S3 endpoint not configured"})
	} else {
		checks = append(checks, ConfigCheck{"S3_ENDPOINT", "pass", "S3 endpoint configured"})
	}

	// Check CORS
	corsOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if corsOrigins == "" {
		checks = append(checks, ConfigCheck{"CORS", "warn", "CORS origins not configured"})
	} else {
		checks = append(checks, ConfigCheck{"CORS", "pass", "CORS origins configured"})
	}

	// Check public base URL
	publicURL := os.Getenv("PUBLIC_BASE_URL")
	if publicURL == "" {
		checks = append(checks, ConfigCheck{"PUBLIC_BASE_URL", "warn", "Public base URL not configured"})
	} else {
		checks = append(checks, ConfigCheck{"PUBLIC_BASE_URL", "pass", "Public base URL configured"})
	}

	allPass := true
	for _, check := range checks {
		if check.Status == "fail" {
			allPass = false
			break
		}
	}

	summary := "All checks passed"
	if !allPass {
		summary = "Some checks failed — see details"
	}

	return c.JSON(http.StatusOK, ConfigValidationResult{
		Valid:   allPass,
		Checks:  checks,
		Summary: summary,
	})
}
