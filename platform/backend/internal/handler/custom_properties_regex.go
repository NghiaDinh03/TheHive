package handler

import (
	"context"
	"net/http"
	"regexp"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/audit"
)

// RegexRule represents a dynamic regex parser rule.
type RegexRule struct {
	ID           string    `db:"id" json:"id"`
	Name         string    `db:"name" json:"name"`
	RegexPattern string    `db:"regex_pattern" json:"regex_pattern"`
	TargetField  string    `db:"target_field" json:"target_field"`
	Description  string    `db:"description" json:"description"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

type RegexHandler struct {
	db    *sqlx.DB
	audit *audit.Recorder
}

func NewRegexHandler(db *sqlx.DB, auditRecorder *audit.Recorder) *RegexHandler {
	return &RegexHandler{db: db, audit: auditRecorder}
}

// Memory Cache for Compiled Regexes to optimize CPU usage
var (
	regexCache = make(map[string]*regexp.Regexp)
	cacheMu    sync.RWMutex
)

func getCompiledRegex(pattern string) (*regexp.Regexp, error) {
	cacheMu.RLock()
	re, exists := regexCache[pattern]
	cacheMu.RUnlock()

	if exists {
		return re, nil
	}

	compiled, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}

	cacheMu.Lock()
	regexCache[pattern] = compiled
	cacheMu.Unlock()

	return compiled, nil
}

// List dynamic property regex rules
func (h *RegexHandler) ListRules(c echo.Context) error {
	rules := []RegexRule{}
	err := h.db.SelectContext(c.Request().Context(), &rules, `
		SELECT id::text AS id, name, regex_pattern, target_field, COALESCE(description, '') AS description, created_at, updated_at
		FROM custom_properties_regex
		ORDER BY created_at DESC`)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to list regex rules")
	}
	return c.JSON(http.StatusOK, rules)
}

// Create dynamic property regex rule
func (h *RegexHandler) CreateRule(c echo.Context) error {
	var req struct {
		Name         string `json:"name" validate:"required,min=1"`
		RegexPattern string `json:"regex_pattern" validate:"required,min=1"`
		TargetField  string `json:"target_field" validate:"required,min=1"`
		Description  string `json:"description"`
	}

	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	if err := c.Validate(&req); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}

	// Validate regexp compilation
	if _, err := regexp.Compile(req.RegexPattern); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid regular expression pattern: "+err.Error())
	}

	var rule RegexRule
	err := h.db.GetContext(c.Request().Context(), &rule, `
		INSERT INTO custom_properties_regex (name, regex_pattern, target_field, description)
		VALUES ($1, $2, $3, $4)
		RETURNING id::text AS id, name, regex_pattern, target_field, COALESCE(description, '') AS description, created_at, updated_at`,
		req.Name, req.RegexPattern, req.TargetField, req.Description)

	if err != nil {
		return apierr.New(http.StatusConflict, "regex rule name already exists")
	}

	if h.audit != nil {
		_ = h.audit.Record(c.Request().Context(), audit.FromContext(c, "admin.regex_rule.create", "regex_rule", rule.ID, nil, rule))
	}

	return c.JSON(http.StatusCreated, rule)
}

// Delete dynamic property regex rule
func (h *RegexHandler) DeleteRule(c echo.Context) error {
	id := c.Param("id")
	if _, err := uuid.Parse(id); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid UUID format")
	}

	result, err := h.db.ExecContext(c.Request().Context(), `DELETE FROM custom_properties_regex WHERE id = $1::uuid`, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "failed to delete regex rule")
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return apierr.New(http.StatusNotFound, "regex rule not found")
	}

	if h.audit != nil {
		_ = h.audit.Record(c.Request().Context(), audit.FromContext(c, "admin.regex_rule.delete", "regex_rule", id, nil, echo.Map{"id": id}))
	}

	return c.JSON(http.StatusOK, echo.Map{"status": "deleted", "id": id})
}

// ParseTextAndExtractCustomProperties runs all regex rules against the input text
// and automatically adds matches as custom fields in the given case.
func ParseTextAndExtractCustomProperties(ctx context.Context, db *sqlx.DB, caseID string, text string) {
	if text == "" || caseID == "" {
		return
	}

	rules := []RegexRule{}
	err := db.SelectContext(ctx, &rules, `SELECT name, regex_pattern, target_field FROM custom_properties_regex`)
	if err != nil || len(rules) == 0 {
		return
	}

	for _, rule := range rules {
		re, err := getCompiledRegex(rule.RegexPattern)
		if err != nil {
			continue
		}

		matches := re.FindAllString(text, -1)
		if len(matches) == 0 {
			continue
		}

		// Use the first match to insert into custom_fields
		matchVal := matches[0]

		// Insert or update custom field in DB
		var exists bool
		_ = db.GetContext(ctx, &exists, `
			SELECT EXISTS(SELECT 1 FROM custom_fields WHERE owner_type = 'case' AND owner_id = $1::uuid AND name = $2)`,
			caseID, rule.TargetField)

		if exists {
			_, _ = db.ExecContext(ctx, `
				UPDATE custom_fields
				SET value = $1, string_value = $1, updated_at = now()
				WHERE owner_type = 'case' AND owner_id = $2::uuid AND name = $3`,
				matchVal, caseID, rule.TargetField)
		} else {
			_, _ = db.ExecContext(ctx, `
				INSERT INTO custom_fields (owner_type, owner_id, name, value, string_value, field_type, field_order)
				VALUES ('case', $1::uuid, $2, $3, $3, 'string', 0)`,
				caseID, rule.TargetField, matchVal)
		}
	}
}
