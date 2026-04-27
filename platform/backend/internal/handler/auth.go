package handler

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"strings"
	"time"
	"unicode"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/lib/pq"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/audit"
	"github.com/thehive-platform/backend/internal/authjwt"
	"github.com/thehive-platform/backend/internal/mail"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	db        *sqlx.DB
	jwtSecret string
	jwtExpiry time.Duration
	audit     *audit.Recorder
	mail      *mail.Sender
}

func NewAuthHandler(db *sqlx.DB, secret string, expiry time.Duration, auditRecorder *audit.Recorder, mailSender *mail.Sender) *AuthHandler {
	return &AuthHandler{db: db, jwtSecret: secret, jwtExpiry: expiry, audit: auditRecorder, mail: mailSender}
}

type loginRequest struct {
	Login    string `json:"login" validate:"required,min=1"`
	Password string `json:"password" validate:"required,min=1"`
}

type registerRequest struct {
	Login        string `json:"login" validate:"required,email"`
	Name         string `json:"name" validate:"required,min=1"`
	Organisation string `json:"organisation" validate:"required,min=1"`
}

type loginResponse struct {
	Token              string    `json:"token"`
	Login              string    `json:"login"`
	ExpiresAt          time.Time `json:"expires_at"`
	MustChangePassword bool      `json:"must_change_password"`
}

type dbUser struct {
	Login              string         `db:"login"`
	Name               string         `db:"name"`
	Organisation       string         `db:"organisation"`
	Profile            string         `db:"profile"`
	Permissions        pq.StringArray `db:"permissions"`
	PasswordHash       string         `db:"password_hash"`
	Locked             bool           `db:"locked"`
	MustChangePassword bool           `db:"must_change_password"`
}

type currentUser struct {
	Login              string   `json:"login"`
	Name               string   `json:"name"`
	Organisation       string   `json:"organisation"`
	Profile            string   `json:"profile"`
	Permissions        []string `json:"permissions"`
	MustChangePassword bool     `json:"must_change_password"`
}

type sessionSummary struct {
	TokenID   string     `db:"token_id" json:"token_id"`
	Current   bool       `json:"current"`
	Revoked   bool       `db:"revoked" json:"revoked"`
	CreatedAt time.Time  `db:"created_at" json:"created_at"`
	ExpiresAt time.Time  `db:"expires_at" json:"expires_at"`
	RevokedAt *time.Time `db:"revoked_at" json:"revoked_at,omitempty"`
}

type passwordResetRequest struct {
	Login string `json:"login" validate:"required,email"`
}

type passwordResetTokenRequest struct {
	Token       string `json:"token" validate:"required,min=20"`
	NewPassword string `json:"new_password" validate:"required,min=12"`
}

type passwordResetIssue struct {
	Token     string    `json:"token,omitempty"`
	ExpiresAt time.Time `json:"expires_at"`
	Delivery  string    `json:"delivery"`
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req loginRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if err := c.Validate(&req); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	user, err := h.findUser(c.Request().Context(), req.Login)
	if err != nil || user.Locked || user.PasswordHash == "" {
		return apierr.New(http.StatusUnauthorized, "invalid credentials")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return apierr.New(http.StatusUnauthorized, "invalid credentials")
	}
	token, tokenID, expiresAt, err := authjwt.Sign(h.jwtSecret, h.jwtExpiry, user.Login, user.Organisation, user.Profile, []string(user.Permissions))
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "token signing failed")
	}
	_, _ = h.db.ExecContext(c.Request().Context(), "UPDATE users SET last_login_at = now(), updated_at = now() WHERE login = $1", user.Login)
	_, _ = h.db.ExecContext(c.Request().Context(), "INSERT INTO auth_sessions (token_id, login, expires_at) VALUES ($1, $2, $3)", tokenID, user.Login, expiresAt)
	if h.audit != nil {
		_ = h.audit.Record(c.Request().Context(), audit.FromContext(c, "auth.login", "user", user.Login, nil, echo.Map{"login": user.Login}))
	}
	return c.JSON(http.StatusOK, loginResponse{Token: token, Login: user.Login, ExpiresAt: expiresAt, MustChangePassword: user.MustChangePassword})
}

func (h *AuthHandler) Register(c echo.Context) error {
	var req registerRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if err := c.Validate(&req); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "registration request failed")
	}
	defer func() { _ = tx.Rollback() }()

	var orgID string
	if err := tx.QueryRowxContext(c.Request().Context(), `
		INSERT INTO organisations (name, description)
		VALUES ($1, '')
		ON CONFLICT (name) DO UPDATE SET updated_at = now()
		RETURNING id::text`, req.Organisation).Scan(&orgID); err != nil {
		return apierr.New(http.StatusInternalServerError, "organisation registration failed")
	}
	var profileID string
	if err := tx.QueryRowxContext(c.Request().Context(), `SELECT id::text FROM profiles WHERE name = 'admin' LIMIT 1`).Scan(&profileID); err != nil {
		return apierr.New(http.StatusInternalServerError, "profile not configured")
	}
	login := strings.ToLower(req.Login)
	_, err = tx.ExecContext(c.Request().Context(), `
		INSERT INTO users (login, name, organisation_id, profile_id, status, password_hash, locked, must_change_password, password_algo)
		VALUES ($1, $2, $3::uuid, $4::uuid, 'Pending', '', true, true, 'bcrypt')`, login, req.Name, orgID, profileID)
	if err != nil {
		return apierr.New(http.StatusConflict, "registration request already exists")
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "auth.register.request", "user", login, nil, echo.Map{"login": login, "organisation": req.Organisation, "status": "Pending"})); err != nil {
			return apierr.New(http.StatusInternalServerError, "registration audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "registration request failed")
	}
	return c.JSON(http.StatusAccepted, echo.Map{"status": "pending_admin_approval", "login": login, "message": "Registration request submitted. An administrator must approve and send an invite link before first login."})
}

func (h *AuthHandler) ChangePassword(c echo.Context) error {
	var req changePasswordRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if err := c.Validate(&req); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	if err := validatePasswordPolicy(req.NewPassword); err != nil {
		return err
	}
	claims, _ := c.Get("auth_claims").(*authjwt.Claims)
	if claims == nil || claims.Login == "" {
		return apierr.New(http.StatusUnauthorized, "missing authentication")
	}
	user, err := h.findUser(c.Request().Context(), claims.Login)
	if err != nil || user.Locked || user.PasswordHash == "" {
		return apierr.New(http.StatusUnauthorized, "user not found")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		return apierr.New(http.StatusUnauthorized, "invalid current password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.NewPassword)); err == nil {
		return apierr.New(http.StatusBadRequest, "new password must be different from current password")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "password hashing failed")
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "password change failed")
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(c.Request().Context(), `
		UPDATE users
		SET password_hash = $1, password_changed_at = now(), password_algo = 'bcrypt', must_change_password = false, updated_at = now()
		WHERE login = $2`, string(hash), user.Login); err != nil {
		return apierr.New(http.StatusInternalServerError, "password change failed")
	}
	if _, err := tx.ExecContext(c.Request().Context(), `
		UPDATE auth_sessions
		SET revoked = true, revoked_at = now()
		WHERE login = $1 AND token_id <> $2 AND revoked = false`, user.Login, claims.Id); err != nil {
		return apierr.New(http.StatusInternalServerError, "password change failed")
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "auth.password.change", "user", user.Login, nil, echo.Map{"rotated": true, "revoked_other_sessions": true})); err != nil {
			return apierr.New(http.StatusInternalServerError, "password change audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "password change failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"status": "ok"})
}

func (h *AuthHandler) RequestPasswordReset(c echo.Context) error {
	var req passwordResetRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if err := c.Validate(&req); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	issue, err := h.createPasswordResetToken(c.Request().Context(), strings.ToLower(req.Login), "self-service", "password_reset", false)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "password reset request failed")
	}
	return c.JSON(http.StatusAccepted, echo.Map{
		"status":     "ok",
		"delivery":   issue.Delivery,
		"expires_at": issue.ExpiresAt,
		"message":    "If the account exists, a password reset email will be sent.",
	})
}

func (h *AuthHandler) ResetPassword(c echo.Context) error {
	var req passwordResetTokenRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if err := c.Validate(&req); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	if err := validatePasswordPolicy(req.NewPassword); err != nil {
		return err
	}
	tokenHash := hashPasswordResetToken(req.Token)
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "password hashing failed")
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "password reset failed")
	}
	defer func() { _ = tx.Rollback() }()

	var login, purpose string
	if err := tx.QueryRowxContext(c.Request().Context(), `
		SELECT login, purpose
		FROM password_reset_tokens
		WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
		FOR UPDATE`, tokenHash).Scan(&login, &purpose); err == sql.ErrNoRows {
		return apierr.New(http.StatusBadRequest, "reset token is invalid or expired")
	} else if err != nil {
		return apierr.New(http.StatusInternalServerError, "password reset failed")
	}
	if _, err := tx.ExecContext(c.Request().Context(), `
		UPDATE users
		SET password_hash = $1, password_changed_at = now(), password_algo = 'bcrypt', must_change_password = false,
			status = CASE WHEN status = 'Pending' AND $3 = 'invite' THEN 'Ok' ELSE status END,
			updated_at = now()
		WHERE lower(login) = lower($2)`, string(hash), login, purpose); err != nil {
		return apierr.New(http.StatusInternalServerError, "password reset failed")
	}
	if _, err := tx.ExecContext(c.Request().Context(), `UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = $1`, tokenHash); err != nil {
		return apierr.New(http.StatusInternalServerError, "password reset failed")
	}
	if _, err := tx.ExecContext(c.Request().Context(), `UPDATE auth_sessions SET revoked = true, revoked_at = now() WHERE lower(login) = lower($1) AND revoked = false`, login); err != nil {
		return apierr.New(http.StatusInternalServerError, "password reset failed")
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "auth.password.reset.confirm", "user", login, nil, echo.Map{"revoked_sessions": true})); err != nil {
			return apierr.New(http.StatusInternalServerError, "password reset audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "password reset failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"status": "ok"})
}

func (h *AuthHandler) Logout(c echo.Context) error {
	if claims, ok := c.Get("auth_claims").(*authjwt.Claims); ok && claims.Id != "" {
		_, _ = h.db.ExecContext(c.Request().Context(), "UPDATE auth_sessions SET revoked = true, revoked_at = now() WHERE token_id = $1", claims.Id)
		if h.audit != nil {
			_ = h.audit.Record(c.Request().Context(), audit.FromContext(c, "auth.logout", "user", claims.Login, nil, echo.Map{"token_id": claims.Id}))
		}
	}
	return c.JSON(http.StatusOK, echo.Map{"status": "ok"})
}

func (h *AuthHandler) ListSessions(c echo.Context) error {
	claims, _ := c.Get("auth_claims").(*authjwt.Claims)
	if claims == nil || claims.Login == "" {
		return apierr.New(http.StatusUnauthorized, "missing authentication")
	}
	rows := []sessionSummary{}
	if err := h.db.SelectContext(c.Request().Context(), &rows, `
		SELECT token_id, revoked, created_at, expires_at, revoked_at
		FROM auth_sessions
		WHERE login = $1
		ORDER BY created_at DESC
		LIMIT 100`, claims.Login); err != nil {
		return apierr.New(http.StatusInternalServerError, "session list failed")
	}
	for i := range rows {
		rows[i].Current = rows[i].TokenID == claims.Id
	}
	return c.JSON(http.StatusOK, echo.Map{"values": rows, "total": len(rows)})
}

func (h *AuthHandler) RevokeAllSessions(c echo.Context) error {
	claims, _ := c.Get("auth_claims").(*authjwt.Claims)
	if claims == nil || claims.Login == "" {
		return apierr.New(http.StatusUnauthorized, "missing authentication")
	}
	if _, err := h.db.ExecContext(c.Request().Context(), `
		UPDATE auth_sessions
		SET revoked = true, revoked_at = now()
		WHERE login = $1 AND revoked = false`, claims.Login); err != nil {
		return apierr.New(http.StatusInternalServerError, "session revoke failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"status": "ok"})
}

func (h *AuthHandler) Me(c echo.Context) error {
	login := ""
	if claims, ok := c.Get("auth_claims").(*authjwt.Claims); ok {
		login = claims.Login
	}
	if login == "" {
		login = c.Request().Header.Get("X-TheHive-Login")
	}
	if login == "" {
		return apierr.New(http.StatusUnauthorized, "missing authentication")
	}
	user, err := h.findUser(c.Request().Context(), login)
	if err != nil {
		return apierr.New(http.StatusUnauthorized, "user not found")
	}
	return c.JSON(http.StatusOK, currentUser{Login: user.Login, Name: user.Name, Organisation: user.Organisation, Profile: user.Profile, Permissions: []string(user.Permissions), MustChangePassword: user.MustChangePassword})
}

func (h *AuthHandler) createPasswordResetToken(ctx context.Context, login string, requestedBy string, purpose string, revealToken bool) (passwordResetIssue, error) {
	expiresAt := time.Now().UTC().Add(30 * time.Minute)
	rawToken, err := generatePasswordResetToken()
	if err != nil {
		return passwordResetIssue{}, err
	}
	delivery := "email-placeholder"
	if h.mail != nil && h.mail.Enabled() {
		delivery = "smtp"
	}
	result, err := h.db.ExecContext(ctx, `
		INSERT INTO password_reset_tokens (login, token_hash, requested_by, delivery, expires_at, purpose)
		SELECT login, $2, $3, $4, $5, $6
		FROM users
		WHERE lower(login) = lower($1) AND status IN ('Ok', 'Pending') AND locked = false`, login, hashPasswordResetToken(rawToken), requestedBy, delivery, expiresAt, purpose)
	if err != nil {
		return passwordResetIssue{}, err
	}
	issue := passwordResetIssue{ExpiresAt: expiresAt, Delivery: delivery}
	if changed, _ := result.RowsAffected(); changed > 0 {
		if h.mail != nil {
			if purpose == "invite" {
				_ = h.mail.SendInvite(ctx, login, rawToken)
			} else {
				_ = h.mail.SendPasswordReset(ctx, login, rawToken)
			}
		}
		if revealToken || delivery == "email-placeholder" {
			issue.Token = rawToken
		}
	}
	return issue, nil
}

func (h *AuthHandler) findUser(ctx context.Context, login string) (dbUser, error) {
	user := dbUser{}
	err := h.db.GetContext(ctx, &user, `
		SELECT u.login, u.name, COALESCE(o.name, '') AS organisation, COALESCE(p.name, '') AS profile,
			COALESCE(p.permissions, '{}') AS permissions, u.password_hash, u.locked, u.must_change_password
		FROM users u
		LEFT JOIN organisations o ON o.id = u.organisation_id
		LEFT JOIN profiles p ON p.id = u.profile_id
		WHERE lower(u.login) = lower($1) AND u.status = 'Ok'
		LIMIT 1`, login)
	if err == sql.ErrNoRows {
		return dbUser{}, err
	}
	return user, err
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"required,min=1"`
	NewPassword     string `json:"new_password" validate:"required,min=12"`
}

func generatePasswordResetToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func hashPasswordResetToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func validatePasswordPolicy(password string) error {
	if len(password) < 12 {
		return apierr.New(http.StatusBadRequest, "password must be at least 12 characters")
	}
	var hasLower, hasUpper, hasDigit, hasSymbol bool
	for _, char := range password {
		switch {
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsDigit(char):
			hasDigit = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSymbol = true
		}
	}
	if !hasLower || !hasUpper || !hasDigit || !hasSymbol {
		return apierr.New(http.StatusBadRequest, "password must include lowercase, uppercase, digit, and symbol")
	}
	return nil
}
