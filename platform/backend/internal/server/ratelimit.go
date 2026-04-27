package server

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
)

type rateBucket struct {
	count     int
	resetAt   time.Time
	blockedAt time.Time
}

type RateLimiter struct {
	mu      sync.Mutex
	buckets map[string]rateBucket
	limit   int
	window  time.Duration
	block   time.Duration
}

func NewRateLimiter(limit int, window time.Duration, block time.Duration) *RateLimiter {
	return &RateLimiter{buckets: map[string]rateBucket{}, limit: limit, window: window, block: block}
}

func (r *RateLimiter) Middleware(scope string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			key := scope + ":" + c.RealIP() + ":" + strings.ToLower(strings.TrimSpace(c.Request().Header.Get("X-Login")))
			now := time.Now()
			r.mu.Lock()
			bucket := r.buckets[key]
			if !bucket.blockedAt.IsZero() && now.Sub(bucket.blockedAt) < r.block {
				r.mu.Unlock()
				return apierr.New(http.StatusTooManyRequests, "too many requests; retry later")
			}
			if bucket.resetAt.IsZero() || now.After(bucket.resetAt) {
				bucket = rateBucket{resetAt: now.Add(r.window)}
			}
			bucket.count++
			if bucket.count > r.limit {
				bucket.blockedAt = now
				r.buckets[key] = bucket
				r.mu.Unlock()
				return apierr.New(http.StatusTooManyRequests, "too many requests; retry later")
			}
			r.buckets[key] = bucket
			r.mu.Unlock()
			return next(c)
		}
	}
}
