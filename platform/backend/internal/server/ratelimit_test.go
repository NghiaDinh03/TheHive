package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
)

func TestRateLimiterBlocksAfterLimit(t *testing.T) {
	e := echo.New()
	limiter := NewRateLimiter(2, time.Minute, time.Minute)
	handler := limiter.Middleware("login")(func(c echo.Context) error {
		return c.NoContent(http.StatusNoContent)
	})

	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
		req.RemoteAddr = "10.0.0.1:1234"
		rec := httptest.NewRecorder()
		if err := handler(e.NewContext(req, rec)); err != nil {
			t.Fatalf("request %d should pass: %v", i+1, err)
		}
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
	req.RemoteAddr = "10.0.0.1:1234"
	rec := httptest.NewRecorder()
	err := handler(e.NewContext(req, rec))
	if err == nil {
		t.Fatal("expected rate limit error")
	}
}
