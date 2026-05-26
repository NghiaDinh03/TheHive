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
	"github.com/thehive-platform/backend/internal/handler"
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
	// Rà soát Origins: nếu chứa "*" (wildcard) thì không cho phép credentials vì lý do an toàn bảo mật.
	allowCredentials := true
	for _, origin := range allowed {
		if origin == "*" {
			allowCredentials = false
			break
		}
	}

	return middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     allowed,
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{echo.HeaderAuthorization, echo.HeaderContentType, requestIDHeader, "X-CSRF-Token"},
		ExposeHeaders:    []string{requestIDHeader},
		AllowCredentials: allowCredentials,
		MaxAge:           3600,
	})
}

func Authenticate(secret string, db *sqlx.DB) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Hybrid Authentication: 1. Cookie "thehive_token"
			var tokenValue string
			if cookie, err := c.Cookie("thehive_token"); err == nil && cookie.Value != "" {
				tokenValue = cookie.Value
			}
			// 2. Header "Authorization" Bearer
			if tokenValue == "" {
				tokenValue = strings.TrimSpace(strings.TrimPrefix(c.Request().Header.Get(echo.HeaderAuthorization), "Bearer "))
			}

			if tokenValue == "" {
				return apierr.New(http.StatusUnauthorized, "missing bearer token or session cookie")
			}
			claims, err := authjwt.Parse(secret, tokenValue)
			if err != nil {
				return apierr.New(http.StatusUnauthorized, "invalid token")
			}

			if db != nil {
				// Query active session along with fingerprint fields
				var sess struct {
					Active    bool    `db:"active"`
					UserAgent *string `db:"user_agent"`
				}
				err = db.GetContext(c.Request().Context(), &sess, `
					SELECT EXISTS(
						SELECT 1 FROM auth_sessions
						WHERE token_id = $1 AND login = $2 AND revoked = false AND expires_at > now()
					) AS active,
					(SELECT user_agent FROM auth_sessions WHERE token_id = $1 LIMIT 1) AS user_agent
				`, claims.Id, claims.Login)
				
				if err != nil || !sess.Active {
					return apierr.New(http.StatusUnauthorized, "session expired or revoked")
				}

				// Session Hijacking Protection: Verify fingerprint (User-Agent)
				if sess.UserAgent != nil && *sess.UserAgent != "" && *sess.UserAgent != c.Request().UserAgent() {
					return apierr.New(http.StatusUnauthorized, "session hijacked: client fingerprint mismatch")
				}
			}

			// --- SOC-grade CSRF Protection ---
			// Chống giả mạo request bằng cách đối chiếu custom header X-CSRF-Token với Token ID của JWT
			method := c.Request().Method
			if method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch || method == http.MethodDelete {
				csrfToken := c.Request().Header.Get("X-CSRF-Token")
				if csrfToken == "" {
					return apierr.New(http.StatusForbidden, "missing X-CSRF-Token header")
				}
				if csrfToken != claims.Id {
					return apierr.New(http.StatusForbidden, "invalid X-CSRF-Token")
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
			if claims != nil {
				method := c.Request().Method
				profile := strings.ToLower(claims.Profile)
				if (method == "POST" || method == "PUT" || method == "PATCH" || method == "DELETE") &&
					(strings.Contains(profile, "read-only") || strings.Contains(profile, "client")) {
					return apierr.New(http.StatusForbidden, "write operations are forbidden for read-only or client profiles")
				}
			}
			if !authjwt.HasPermission(claims, permission) {
				return apierr.New(http.StatusForbidden, "missing permission "+permission)
			}
			return next(c)
		}
	}
}

func RequireAnyPermission(permissions ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims, _ := c.Get("auth_claims").(*authjwt.Claims)
			if claims != nil {
				method := c.Request().Method
				profile := strings.ToLower(claims.Profile)
				if (method == "POST" || method == "PUT" || method == "PATCH" || method == "DELETE") &&
					(strings.Contains(profile, "read-only") || strings.Contains(profile, "client")) {
					return apierr.New(http.StatusForbidden, "write operations are forbidden for read-only or client profiles")
				}
			}
			hasAny := false
			for _, p := range permissions {
				if authjwt.HasPermission(claims, p) {
					hasAny = true
					break
				}
			}
			if !hasAny {
				return apierr.New(http.StatusForbidden, "missing one of permissions: "+strings.Join(permissions, ", "))
			}
			return next(c)
		}
	}
}

func RequireStepUp2FA(db *sqlx.DB) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims, _ := c.Get("auth_claims").(*authjwt.Claims)
			if claims == nil || claims.Login == "" {
				return apierr.New(http.StatusUnauthorized, "missing authentication")
			}

			// Check if TOTP is enabled or forced for this user
			var userTOTP struct {
				TotpEnabled bool   `db:"totp_enabled"`
				TotpSecret  string `db:"totp_secret"`
				Force2FA    bool   `db:"force_2fa"`
			}
			err := db.GetContext(c.Request().Context(), &userTOTP, 
				"SELECT totp_enabled, COALESCE(totp_secret, '') AS totp_secret, COALESCE(force_2fa, false) AS force_2fa FROM users WHERE lower(login) = lower($1)", claims.Login)
			if err != nil {
				return apierr.New(http.StatusForbidden, "user not found or db error")
			}

			// Check global force_2fa setting
			globalForce := false
			var rawF2FA string
			_ = db.QueryRowxContext(c.Request().Context(), `SELECT value::text FROM ui_settings WHERE key = 'force_2fa'`).Scan(&rawF2FA)
			if strings.Contains(rawF2FA, "true") {
				globalForce = true
			}

			// If 2FA is not enabled and not forced globally or individually, we bypass 2FA check!
			if !userTOTP.TotpEnabled && !userTOTP.Force2FA && !globalForce {
				return next(c)
			}

			// Extract X-TOTP-Code from header
			code := strings.TrimSpace(c.Request().Header.Get("X-TOTP-Code"))
			if code == "" {
				return apierr.New(http.StatusUnauthorized, "missing X-TOTP-Code header for sensitive action")
			}
			if len(code) != 6 {
				return apierr.New(http.StatusBadRequest, "invalid TOTP code length")
			}

			if userTOTP.TotpSecret == "" {
				return apierr.New(http.StatusForbidden, "2FA must be enabled to perform this action")
			}

			// Verify code using the handler package's exported VerifyTOTPCode function
			if !handler.VerifyTOTPCode(userTOTP.TotpSecret, code) {
				return apierr.New(http.StatusUnauthorized, "invalid TOTP code")
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
