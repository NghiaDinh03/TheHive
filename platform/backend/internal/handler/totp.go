package handler

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/authjwt"
)

// generateTOTPSecret creates a random base32 encoded string of length 32
func generateTOTPSecret() string {
	b := make([]byte, 20)
	_, _ = rand.Read(b)
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b)
}

// verifyTOTPCode verifies the 6-digit TOTP code against the secret
func verifyTOTPCode(secret string, code string) bool {
	secret = strings.ToUpper(strings.TrimSpace(secret))
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(secret)
	if err != nil {
		// Fallback to standard padding if needed
		key, err = base32.StdEncoding.DecodeString(secret)
		if err != nil {
			return false
		}
	}

	code = strings.TrimSpace(code)
	if len(code) != 6 {
		return false
	}

	// Check current, previous, and next 30-second windows (allow minor time skew)
	t := time.Now().Unix() / 30
	for i := int64(-1); i <= 1; i++ {
		hash := generateTOTPHash(key, t+i)
		if fmt.Sprintf("%06d", hash) == code {
			return true
		}
	}
	return false
}

func generateTOTPHash(key []byte, t int64) uint32 {
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(t))
	mac := hmac.New(sha1.New, key)
	mac.Write(buf)
	sum := mac.Sum(nil)
	offset := sum[len(sum)-1] & 0xf
	value := int64(((int(sum[offset]) & 0x7f) << 24) |
		((int(sum[offset+1] & 0xff)) << 16) |
		((int(sum[offset+2] & 0xff)) << 8) |
		(int(sum[offset+3]) & 0xff))
	return uint32(value % int64(math.Pow10(6)))
}

type setupTOTPResponse struct {
	Secret string `json:"secret"`
	URI    string `json:"uri"`
}

type verifyTOTPRequest struct {
	Code string `json:"code" validate:"required,min=6,max=6"`
}

// SetupTOTP generates a new TOTP secret for the user
func (h *AuthHandler) SetupTOTP(c echo.Context) error {
	claims, _ := c.Get("auth_claims").(*authjwt.Claims)
	if claims == nil || claims.Login == "" {
		return apierr.New(http.StatusUnauthorized, "missing authentication")
	}

	user, err := h.findUser(c.Request().Context(), claims.Login)
	if err != nil {
		return apierr.New(http.StatusNotFound, "user not found")
	}

	if user.TotpEnabled {
		return apierr.New(http.StatusBadRequest, "TOTP is already enabled")
	}

	secret := generateTOTPSecret()

	// Store the provisional secret in DB
	_, err = h.db.ExecContext(c.Request().Context(), `
		UPDATE users SET totp_secret = $1 WHERE lower(login) = lower($2)
	`, secret, claims.Login)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to save TOTP secret")
	}

	// Generate OTPAuth URI
	issuer := "NCSFusionCenter"
	uri := fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s", issuer, claims.Login, secret, issuer)

	return c.JSON(http.StatusOK, setupTOTPResponse{
		Secret: secret,
		URI:    uri,
	})
}

// VerifyAndEnableTOTP verifies the first code and enables TOTP
func (h *AuthHandler) VerifyAndEnableTOTP(c echo.Context) error {
	claims, _ := c.Get("auth_claims").(*authjwt.Claims)
	if claims == nil || claims.Login == "" {
		return apierr.New(http.StatusUnauthorized, "missing authentication")
	}

	var req verifyTOTPRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request")
	}

	user, err := h.findUser(c.Request().Context(), claims.Login)
	if err != nil || user.TotpSecret.String == "" {
		return apierr.New(http.StatusBadRequest, "TOTP not setup")
	}

	if !verifyTOTPCode(user.TotpSecret.String, req.Code) {
		return apierr.New(http.StatusBadRequest, "invalid TOTP code")
	}

	_, err = h.db.ExecContext(c.Request().Context(), `
		UPDATE users SET totp_enabled = true WHERE lower(login) = lower($1)
	`, claims.Login)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to enable TOTP")
	}

	if h.audit != nil {
		_ = h.audit.Record(c.Request().Context(), "auth.totp.enable", "user", claims.Login, echo.Map{})
	}

	return c.JSON(http.StatusOK, echo.Map{"status": "ok"})
}

// DisableTOTP disables TOTP for the user
func (h *AuthHandler) DisableTOTP(c echo.Context) error {
	claims, _ := c.Get("auth_claims").(*authjwt.Claims)
	if claims == nil || claims.Login == "" {
		return apierr.New(http.StatusUnauthorized, "missing authentication")
	}

	var req verifyTOTPRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request")
	}

	user, err := h.findUser(c.Request().Context(), claims.Login)
	if err != nil || !user.TotpEnabled {
		return apierr.New(http.StatusBadRequest, "TOTP is not enabled")
	}

	if !verifyTOTPCode(user.TotpSecret.String, req.Code) {
		return apierr.New(http.StatusBadRequest, "invalid TOTP code")
	}

	_, err = h.db.ExecContext(c.Request().Context(), `
		UPDATE users SET totp_enabled = false, totp_secret = NULL WHERE lower(login) = lower($1)
	`, claims.Login)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to disable TOTP")
	}

	if h.audit != nil {
		_ = h.audit.Record(c.Request().Context(), "auth.totp.disable", "user", claims.Login, echo.Map{})
	}

	return c.JSON(http.StatusOK, echo.Map{"status": "ok"})
}
