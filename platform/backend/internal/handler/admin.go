package handler

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/lib/pq"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/audit"
	"github.com/thehive-platform/backend/internal/mail"
	"golang.org/x/crypto/bcrypt"
)

type AdminHandler struct {
	db    *sqlx.DB
	audit *audit.Recorder
	mail  *mail.Sender
}

func NewAdminHandler(db *sqlx.DB, auditRecorder *audit.Recorder, mailSender *mail.Sender) *AdminHandler {
	return &AdminHandler{db: db, audit: auditRecorder, mail: mailSender}
}

type adminUserSummary struct {
	Login              string     `db:"login" json:"login"`
	Name               string     `db:"name" json:"name"`
	Organisation       string     `db:"organisation" json:"organisation"`
	Profile            string     `db:"profile" json:"profile"`
	Status             string     `db:"status" json:"status"`
	Locked             bool       `db:"locked" json:"locked"`
	MustChangePassword bool       `db:"must_change_password" json:"must_change_password"`
	LastLoginAt        *time.Time `db:"last_login_at" json:"last_login_at,omitempty"`
	CreatedAt          time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt          time.Time  `db:"updated_at" json:"updated_at"`
}

type adminOrganisationSummary struct {
	ID          string    `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type adminProfileSummary struct {
	ID          string         `db:"id" json:"id"`
	Name        string         `db:"name" json:"name"`
	Permissions pq.StringArray `db:"permissions" json:"permissions"`
	CreatedAt   time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time      `db:"updated_at" json:"updated_at"`
}

type adminUserRequest struct {
	Login              string `json:"login" validate:"required,email"`
	Name               string `json:"name" validate:"required,min=1"`
	Organisation       string `json:"organisation" validate:"required,min=1"`
	Profile            string `json:"profile" validate:"required,min=1"`
	Password           string `json:"password"`
	MustChangePassword bool   `json:"must_change_password"`
	SendInvite         bool   `json:"send_invite"`
}

type adminUserUpdateRequest struct {
	Name               string `json:"name" validate:"required,min=1"`
	Organisation       string `json:"organisation" validate:"required,min=1"`
	Profile            string `json:"profile" validate:"required,min=1"`
	Status             string `json:"status"`
	MustChangePassword bool   `json:"must_change_password"`
}

type adminOrganisationRequest struct {
	Name        string `json:"name" validate:"required,min=1"`
	Description string `json:"description"`
}

type adminProfileRequest struct {
	Name        string   `json:"name" validate:"required,min=1"`
	Permissions []string `json:"permissions"`
}

type adminResetPasswordRequest struct {
	Password           string `json:"password" validate:"required,min=12"`
	MustChangePassword bool   `json:"must_change_password"`
}

type adminGenerateResetTokenRequest struct {
	TTLMinutes int `json:"ttl_minutes"`
}

type adminApproveUserRequest struct {
	Organisation string `json:"organisation" validate:"required,min=1"`
	Profile      string `json:"profile" validate:"required,min=1"`
	SendInvite   bool   `json:"send_invite"`
}

func (h *AdminHandler) ListUsers(c echo.Context) error {
	rows := []adminUserSummary{}
	if err := h.db.SelectContext(c.Request().Context(), &rows, `
		SELECT u.login, u.name, COALESCE(o.name, '') AS organisation, COALESCE(p.name, '') AS profile,
			u.status, u.locked, u.must_change_password, u.last_login_at, u.created_at, u.updated_at
		FROM users u
		LEFT JOIN organisations o ON o.id = u.organisation_id
		LEFT JOIN profiles p ON p.id = u.profile_id
		ORDER BY lower(u.login)
		LIMIT 500`); err != nil {
		return apierr.New(http.StatusInternalServerError, "user list failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"values": rows, "total": len(rows)})
}

func (h *AdminHandler) CreateUser(c echo.Context) error {
	var req adminUserRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if err := c.Validate(&req); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	hash := []byte("")
	if strings.TrimSpace(req.Password) != "" {
		if err := validatePasswordPolicy(req.Password); err != nil {
			return err
		}
		var err error
		hash, err = bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return apierr.New(http.StatusInternalServerError, "password hashing failed")
		}
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "user creation failed")
	}
	defer func() { _ = tx.Rollback() }()
	orgID, err := ensureOrganisation(c, tx, req.Organisation)
	if err != nil {
		return err
	}
	profileID, err := lookupProfileID(c, tx, req.Profile)
	if err != nil {
		return err
	}
	status := "Ok"
	mustChangePassword := req.MustChangePassword
	if string(hash) == "" || req.SendInvite {
		status = "Pending"
		mustChangePassword = true
	}
	login := strings.ToLower(req.Login)
	_, err = tx.ExecContext(c.Request().Context(), `
		INSERT INTO users (login, name, organisation_id, profile_id, status, password_hash, password_changed_at, password_algo, must_change_password)
		VALUES ($1, $2, $3::uuid, $4::uuid, $5, $6, CASE WHEN $6 = '' THEN NULL ELSE now() END, 'bcrypt', $7)`, login, req.Name, orgID, profileID, status, string(hash), mustChangePassword)
	if err != nil {
		return apierr.New(http.StatusConflict, "user already exists")
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "admin.user.create", "user", login, nil, echo.Map{"login": login, "status": status, "invite": req.SendInvite})); err != nil {
			return apierr.New(http.StatusInternalServerError, "user creation audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "user creation failed")
	}
	var issue passwordResetIssue
	if req.SendInvite || string(hash) == "" {
		issue, _ = h.createPasswordResetToken(c.Request().Context(), login, "admin", "invite", true)
	}
	return c.JSON(http.StatusCreated, echo.Map{"status": status, "login": login, "invite_token": issue.Token, "invite_delivery": issue.Delivery, "invite_expires_at": issue.ExpiresAt})
}

func (h *AdminHandler) UpdateUser(c echo.Context) error {
	login := strings.ToLower(strings.TrimSpace(c.Param("login")))
	if login == "" {
		return apierr.New(http.StatusBadRequest, "missing login")
	}
	var req adminUserUpdateRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if err := c.Validate(&req); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "Ok"
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "user update failed")
	}
	defer func() { _ = tx.Rollback() }()
	orgID, err := ensureOrganisation(c, tx, req.Organisation)
	if err != nil {
		return err
	}
	profileID, err := lookupProfileID(c, tx, req.Profile)
	if err != nil {
		return err
	}
	result, err := tx.ExecContext(c.Request().Context(), `
		UPDATE users
		SET name = $1, organisation_id = $2::uuid, profile_id = $3::uuid, status = $4, must_change_password = $5, updated_at = now()
		WHERE lower(login) = lower($6)`, req.Name, orgID, profileID, status, req.MustChangePassword, login)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "user update failed")
	}
	if changed, _ := result.RowsAffected(); changed == 0 {
		return apierr.New(http.StatusNotFound, "user not found")
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "admin.user.update", "user", login, nil, echo.Map{"status": status, "organisation": req.Organisation, "profile": req.Profile})); err != nil {
			return apierr.New(http.StatusInternalServerError, "user update audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "user update failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"status": "ok"})
}

func (h *AdminHandler) LockUser(c echo.Context) error {
	return h.setUserLocked(c, true)
}

func (h *AdminHandler) UnlockUser(c echo.Context) error {
	return h.setUserLocked(c, false)
}

func (h *AdminHandler) ResetUserPassword(c echo.Context) error {
	login := strings.ToLower(strings.TrimSpace(c.Param("login")))
	if login == "" {
		return apierr.New(http.StatusBadRequest, "missing login")
	}
	var req adminResetPasswordRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if err := c.Validate(&req); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	if err := validatePasswordPolicy(req.Password); err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "password hashing failed")
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "password reset failed")
	}
	defer func() { _ = tx.Rollback() }()
	result, err := tx.ExecContext(c.Request().Context(), `
		UPDATE users
		SET password_hash = $1, password_changed_at = now(), password_algo = 'bcrypt', must_change_password = $2, updated_at = now()
		WHERE lower(login) = lower($3)`, string(hash), req.MustChangePassword, login)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "password reset failed")
	}
	if changed, _ := result.RowsAffected(); changed == 0 {
		return apierr.New(http.StatusNotFound, "user not found")
	}
	if _, err := tx.ExecContext(c.Request().Context(), `UPDATE auth_sessions SET revoked = true, revoked_at = now() WHERE lower(login) = lower($1) AND revoked = false`, login); err != nil {
		return apierr.New(http.StatusInternalServerError, "password reset failed")
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "admin.user.password.reset", "user", login, nil, echo.Map{"must_change_password": req.MustChangePassword, "revoked_sessions": true})); err != nil {
			return apierr.New(http.StatusInternalServerError, "password reset audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "password reset failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"status": "ok"})
}

func (h *AdminHandler) GenerateResetToken(c echo.Context) error {
	login := strings.ToLower(strings.TrimSpace(c.Param("login")))
	if login == "" {
		return apierr.New(http.StatusBadRequest, "missing login")
	}
	var req adminGenerateResetTokenRequest
	if err := c.Bind(&req); err != nil && err != echo.ErrUnsupportedMediaType {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	issue, err := h.createPasswordResetToken(c.Request().Context(), login, "admin", "password_reset", true)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "password reset token generation failed")
	}
	if issue.Token == "" {
		return apierr.New(http.StatusNotFound, "user not found")
	}
	if h.audit != nil {
		_ = h.audit.Record(c.Request().Context(), audit.FromContext(c, "admin.user.reset_token", "user", login, nil, echo.Map{"delivery": issue.Delivery}))
	}
	return c.JSON(http.StatusCreated, echo.Map{"status": "ok", "token": issue.Token, "expires_at": issue.ExpiresAt, "delivery": issue.Delivery})
}

func (h *AdminHandler) ApproveUser(c echo.Context) error {
	login := strings.ToLower(strings.TrimSpace(c.Param("login")))
	if login == "" {
		return apierr.New(http.StatusBadRequest, "missing login")
	}
	var req adminApproveUserRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if err := c.Validate(&req); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "user approval failed")
	}
	defer func() { _ = tx.Rollback() }()
	orgID, err := ensureOrganisation(c, tx, req.Organisation)
	if err != nil {
		return err
	}
	profileID, err := lookupProfileID(c, tx, req.Profile)
	if err != nil {
		return err
	}
	result, err := tx.ExecContext(c.Request().Context(), `
		UPDATE users
		SET organisation_id = $1::uuid, profile_id = $2::uuid, status = 'Pending', locked = false, must_change_password = true, updated_at = now()
		WHERE lower(login) = lower($3)`, orgID, profileID, login)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "user approval failed")
	}
	if changed, _ := result.RowsAffected(); changed == 0 {
		return apierr.New(http.StatusNotFound, "user not found")
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "admin.user.approve", "user", login, nil, echo.Map{"organisation": req.Organisation, "profile": req.Profile, "send_invite": req.SendInvite})); err != nil {
			return apierr.New(http.StatusInternalServerError, "user approval audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "user approval failed")
	}
	issue, _ := h.createPasswordResetToken(c.Request().Context(), login, "admin", "invite", true)
	return c.JSON(http.StatusOK, echo.Map{"status": "pending_invite", "login": login, "invite_token": issue.Token, "invite_delivery": issue.Delivery, "invite_expires_at": issue.ExpiresAt})
}

func (h *AdminHandler) createPasswordResetToken(ctx context.Context, login string, requestedBy string, purpose string, revealToken bool) (passwordResetIssue, error) {
	return (&AuthHandler{db: h.db, mail: h.mail}).createPasswordResetToken(ctx, login, requestedBy, purpose, revealToken)
}

func (h *AdminHandler) ListOrganisations(c echo.Context) error {
	rows := []adminOrganisationSummary{}
	if err := h.db.SelectContext(c.Request().Context(), &rows, `SELECT id::text AS id, name, description, created_at, updated_at FROM organisations ORDER BY lower(name) LIMIT 500`); err != nil {
		return apierr.New(http.StatusInternalServerError, "organisation list failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"values": rows, "total": len(rows)})
}

func (h *AdminHandler) UpsertOrganisation(c echo.Context) error {
	var req adminOrganisationRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if err := c.Validate(&req); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	var id string
	if err := h.db.QueryRowxContext(c.Request().Context(), `
		INSERT INTO organisations (name, description)
		VALUES ($1, $2)
		ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, updated_at = now()
		RETURNING id::text`, req.Name, req.Description).Scan(&id); err != nil {
		return apierr.New(http.StatusInternalServerError, "organisation upsert failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"status": "ok", "id": id})
}

func (h *AdminHandler) ListProfiles(c echo.Context) error {
	rows := []adminProfileSummary{}
	if err := h.db.SelectContext(c.Request().Context(), &rows, `SELECT id::text AS id, name, permissions, created_at, updated_at FROM profiles ORDER BY lower(name) LIMIT 500`); err != nil {
		return apierr.New(http.StatusInternalServerError, "profile list failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"values": rows, "total": len(rows)})
}

func (h *AdminHandler) UpsertProfile(c echo.Context) error {
	var req adminProfileRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if err := c.Validate(&req); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	permissions := normalisePermissions(req.Permissions)
	var id string
	if err := h.db.QueryRowxContext(c.Request().Context(), `
		INSERT INTO profiles (name, permissions)
		VALUES ($1, $2)
		ON CONFLICT (name) DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = now()
		RETURNING id::text`, req.Name, pq.Array(permissions)).Scan(&id); err != nil {
		return apierr.New(http.StatusInternalServerError, "profile upsert failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"status": "ok", "id": id})
}

func (h *AdminHandler) setUserLocked(c echo.Context, locked bool) error {
	login := strings.ToLower(strings.TrimSpace(c.Param("login")))
	if login == "" {
		return apierr.New(http.StatusBadRequest, "missing login")
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "user lock update failed")
	}
	defer func() { _ = tx.Rollback() }()
	result, err := tx.ExecContext(c.Request().Context(), `UPDATE users SET locked = $1, updated_at = now() WHERE lower(login) = lower($2)`, locked, login)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "user lock update failed")
	}
	if changed, _ := result.RowsAffected(); changed == 0 {
		return apierr.New(http.StatusNotFound, "user not found")
	}
	if locked {
		_, _ = tx.ExecContext(c.Request().Context(), `UPDATE auth_sessions SET revoked = true, revoked_at = now() WHERE lower(login) = lower($1) AND revoked = false`, login)
	}
	if h.audit != nil {
		if err := audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "admin.user.lock", "user", login, nil, echo.Map{"locked": locked})); err != nil {
			return apierr.New(http.StatusInternalServerError, "user lock audit failed")
		}
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "user lock update failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"status": "ok"})
}

func ensureOrganisation(c echo.Context, tx *sqlx.Tx, name string) (string, error) {
	var id string
	if err := tx.QueryRowxContext(c.Request().Context(), `
		INSERT INTO organisations (name, description)
		VALUES ($1, '')
		ON CONFLICT (name) DO UPDATE SET updated_at = now()
		RETURNING id::text`, name).Scan(&id); err != nil {
		return "", apierr.New(http.StatusInternalServerError, "organisation lookup failed")
	}
	return id, nil
}

func lookupProfileID(c echo.Context, tx *sqlx.Tx, name string) (string, error) {
	var id string
	err := tx.QueryRowxContext(c.Request().Context(), `SELECT id::text FROM profiles WHERE lower(name) = lower($1) LIMIT 1`, name).Scan(&id)
	if err == sql.ErrNoRows {
		return "", apierr.New(http.StatusBadRequest, "profile not found")
	}
	if err != nil {
		return "", apierr.New(http.StatusInternalServerError, "profile lookup failed")
	}
	return id, nil
}

func normalisePermissions(values []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		out = append(out, value)
	}
	return out
}
