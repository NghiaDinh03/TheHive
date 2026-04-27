package server

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/authjwt"
	"github.com/thehive-platform/backend/internal/metrics"
	"go.uber.org/zap"
)

const requestIDHeader = "X-Request-ID"

func RequestID() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			rid := c.Request().Header.Get(requestIDHeader)
			if rid == "" {
				rid = uuid.NewString()
			}
			c.Set("request_id", rid)
			c.Response().Header().Set(requestIDHeader, rid)
			return next(c)
		}
	}
}

func Logging(log *zap.Logger) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()
			err := next(c)
			req := c.Request()
			res := c.Response()

			rid, _ := c.Get("request_id").(string)
			fields := []zap.Field{
				zap.String("request_id", rid),
				zap.String("method", req.Method),
				zap.String("path", req.URL.Path),
				zap.Int("status", res.Status),
				zap.Int64("latency_ms", time.Since(start).Milliseconds()),
				zap.String("client_ip", c.RealIP()),
				zap.String("user_agent", req.UserAgent()),
			}
			if err != nil {
				fields = append(fields, zap.Error(err))
				log.Error("http request error", fields...)
			} else if res.Status >= 500 {
				log.Error("http request 5xx", fields...)
			} else if res.Status >= 400 {
				log.Warn("http request 4xx", fields...)
			} else {
				log.Info("http request", fields...)
			}
			return err
		}
	}
}

func MetricsMW(reg *metrics.Registry) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()
			err := next(c)
			path := c.Path()
			if path == "" {
				path = c.Request().URL.Path
			}
			status := strconv.Itoa(c.Response().Status)
			reg.HTTPRequests.WithLabelValues(c.Request().Method, path, status).Inc()
			reg.HTTPRequestLatency.WithLabelValues(c.Request().Method, path).Observe(time.Since(start).Seconds())
			return err
		}
	}
}

func Recovery(log *zap.Logger) echo.MiddlewareFunc {
	return middleware.RecoverWithConfig(middleware.RecoverConfig{
		StackSize:         1024 * 4,
		DisableStackAll:   false,
		DisablePrintStack: true,
		LogErrorFunc: func(c echo.Context, err error, stack []byte) error {
			rid, _ := c.Get("request_id").(string)
			log.Error("panic recovered",
				zap.String("request_id", rid),
				zap.Error(err),
				zap.ByteString("stack", stack),
			)
			return err
		},
	})
}

func CORS(allowed []string) echo.MiddlewareFunc {
	return middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     allowed,
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{echo.HeaderAuthorization, echo.HeaderContentType, requestIDHeader},
		ExposeHeaders:    []string{requestIDHeader},
		AllowCredentials: true,
		MaxAge:           3600,
	})
}

func Authenticate(secret string, db *sqlx.DB) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			tokenValue := strings.TrimSpace(strings.TrimPrefix(c.Request().Header.Get(echo.HeaderAuthorization), "Bearer "))
			if tokenValue == "" {
				return apierr.New(http.StatusUnauthorized, "missing bearer token")
			}
			claims, err := authjwt.Parse(secret, tokenValue)
			if err != nil {
				return apierr.New(http.StatusUnauthorized, "invalid bearer token")
			}
			if db != nil {
				var active bool
				err = db.GetContext(c.Request().Context(), &active, `
					SELECT EXISTS(
						SELECT 1 FROM auth_sessions
						WHERE token_id = $1 AND login = $2 AND revoked = false AND expires_at > now()
					)`, claims.Id, claims.Login)
				if err != nil || !active {
					return apierr.New(http.StatusUnauthorized, "session expired or revoked")
				}
			}
			ctx := context.WithValue(c.Request().Context(), authClaimsContextKey{}, claims)
			c.Set("auth_claims", claims)
			c.SetRequest(c.Request().WithContext(ctx))
			return next(c)
		}
	}
}

func RequirePermission(permission string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims, _ := c.Get("auth_claims").(*authjwt.Claims)
			if !authjwt.HasPermission(claims, permission) {
				return apierr.New(http.StatusForbidden, "missing permission "+permission)
			}
			return next(c)
		}
	}
}

type authClaimsContextKey struct{}

func ErrorHandler(log *zap.Logger) echo.HTTPErrorHandler {
	return func(err error, c echo.Context) {
		rid, _ := c.Get("request_id").(string)
		problem := &apierr.Problem{
			Type:      "about:blank",
			Title:     http.StatusText(http.StatusInternalServerError),
			Status:    http.StatusInternalServerError,
			Detail:    "internal server error",
			RequestID: rid,
		}

		var pe *apierr.Problem
		var he *echo.HTTPError
		switch {
		case errors.As(err, &pe):
			problem = pe
			problem.RequestID = rid
		case errors.As(err, &he):
			problem.Status = he.Code
			problem.Title = http.StatusText(he.Code)
			if msg, ok := he.Message.(string); ok {
				problem.Detail = msg
			} else {
				problem.Detail = strings.TrimSpace(he.Error())
			}
		default:
			log.Error("unhandled error", zap.String("request_id", rid), zap.Error(err))
		}

		if !c.Response().Committed {
			_ = c.JSON(problem.Status, problem)
		}
	}
}

// keep time import alive for any future timeout helpers
var _ = time.Second
