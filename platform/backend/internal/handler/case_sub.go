package handler

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/audit"
)

type CaseSubHandler struct {
	db    *sqlx.DB
	audit *audit.Recorder
}

func NewCaseSubHandler(db *sqlx.DB, auditRecorder *audit.Recorder) *CaseSubHandler {
	return &CaseSubHandler{db: db, audit: auditRecorder}
}

type createCustomFieldRequest struct {
	Name         string     `json:"name" validate:"required"`
	Value        string     `json:"value"`
	FieldType    string     `json:"field_type"`
	FieldOrder   int        `json:"field_order"`
	StringValue  string     `json:"string_value"`
	BooleanValue bool       `json:"boolean_value"`
	IntegerValue int64      `json:"integer_value"`
	FloatValue   float64    `json:"float_value"`
	DateValue    *time.Time `json:"date_value"`
}

type updateCustomFieldRequest struct {
	Value        *string    `json:"value"`
	StringValue  *string    `json:"string_value"`
	BooleanValue *bool      `json:"boolean_value"`
	IntegerValue *int64     `json:"integer_value"`
	FloatValue   *float64   `json:"float_value"`
	DateValue    *time.Time `json:"date_value"`
	FieldOrder   *int       `json:"field_order"`
}

type createProcedureRequest struct {
	Description string     `json:"description"`
	PatternID   string     `json:"pattern_id" validate:"required"`
	PatternName string     `json:"pattern_name"`
	Tactic      string     `json:"tactic"`
	OccurredAt  *time.Time `json:"occurred_at"`
}

type updateProcedureRequest struct {
	Description *string    `json:"description"`
	PatternID   *string    `json:"pattern_id"`
	PatternName *string    `json:"pattern_name"`
	Tactic      *string    `json:"tactic"`
	OccurredAt  *time.Time `json:"occurred_at"`
}

type createShareRequest struct {
	Organisation       string `json:"organisation" validate:"required"`
	Profile            string `json:"profile"`
	TaskRule           string `json:"task_rule"`
	ObservableRule     string `json:"observable_rule"`
	Owner              bool   `json:"owner"`
	TaskActionRequired bool   `json:"task_action_required"`
}

type updateShareRequest struct {
	Profile            *string `json:"profile"`
	TaskRule           *string `json:"task_rule"`
	ObservableRule     *string `json:"observable_rule"`
	Owner              *bool   `json:"owner"`
	TaskActionRequired *bool   `json:"task_action_required"`
}

func (h *CaseSubHandler) CreateCustomField(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	var req createCustomFieldRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	ft := req.FieldType
	if ft == "" {
		ft = "string"
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "custom field create failed")
	}
	defer func() { _ = tx.Rollback() }()

	var id string
	err = tx.GetContext(c.Request().Context(), &id, `
		INSERT INTO custom_fields (owner_type, owner_id, name, value, field_type, field_order, string_value, boolean_value, integer_value, float_value, date_value)
		VALUES ('case', $1::uuid, $2, to_jsonb($3::text), $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (owner_type, owner_id, name) DO UPDATE SET
			value = EXCLUDED.value, field_type = EXCLUDED.field_type, field_order = EXCLUDED.field_order,
			string_value = EXCLUDED.string_value, boolean_value = EXCLUDED.boolean_value,
			integer_value = EXCLUDED.integer_value, float_value = EXCLUDED.float_value,
			date_value = EXCLUDED.date_value, updated_at = now()
		RETURNING id::text`,
		caseID, req.Name, req.Value, ft, req.FieldOrder, req.StringValue, req.BooleanValue, req.IntegerValue, req.FloatValue, req.DateValue)
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "custom_field.create", "custom_field", id, nil, req))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "custom field create failed")
	}
	return c.JSON(http.StatusCreated, map[string]string{"id": id, "name": req.Name, "status": "created"})
}

func (h *CaseSubHandler) UpdateCustomField(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	cfID := strings.TrimSpace(c.Param("cfid"))
	var req updateCustomFieldRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "custom field update failed")
	}
	defer func() { _ = tx.Rollback() }()

	sets := []string{"updated_at = now()"}
	args := []any{}
	idx := 1
	if req.Value != nil {
		args = append(args, *req.Value)
		sets = append(sets, "value = to_jsonb($"+itoa(idx)+"::text)")
		idx++
	}
	if req.StringValue != nil {
		args = append(args, *req.StringValue)
		sets = append(sets, "string_value = $"+itoa(idx))
		idx++
	}
	if req.BooleanValue != nil {
		args = append(args, *req.BooleanValue)
		sets = append(sets, "boolean_value = $"+itoa(idx))
		idx++
	}
	if req.IntegerValue != nil {
		args = append(args, *req.IntegerValue)
		sets = append(sets, "integer_value = $"+itoa(idx))
		idx++
	}
	if req.FloatValue != nil {
		args = append(args, *req.FloatValue)
		sets = append(sets, "float_value = $"+itoa(idx))
		idx++
	}
	if req.DateValue != nil {
		args = append(args, *req.DateValue)
		sets = append(sets, "date_value = $"+itoa(idx))
		idx++
	}
	if req.FieldOrder != nil {
		args = append(args, *req.FieldOrder)
		sets = append(sets, "field_order = $"+itoa(idx))
		idx++
	}
	args = append(args, cfID, caseID)
	query := "UPDATE custom_fields SET " + strings.Join(sets, ", ") + " WHERE id = $" + itoa(idx) + "::uuid AND owner_type = 'case' AND owner_id = $" + itoa(idx+1) + "::uuid"
	result, err := tx.ExecContext(c.Request().Context(), query, args...)
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return apierr.New(http.StatusNotFound, "custom field not found")
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "custom_field.update", "custom_field", cfID, nil, req))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "custom field update failed")
	}
	return c.JSON(http.StatusOK, map[string]string{"id": cfID, "status": "updated"})
}

func (h *CaseSubHandler) DeleteCustomField(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	cfID := strings.TrimSpace(c.Param("cfid"))
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "custom field delete failed")
	}
	defer func() { _ = tx.Rollback() }()
	result, err := tx.ExecContext(c.Request().Context(), `DELETE FROM custom_fields WHERE id = $1::uuid AND owner_type = 'case' AND owner_id = $2::uuid`, cfID, caseID)
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return apierr.New(http.StatusNotFound, "custom field not found")
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "custom_field.delete", "custom_field", cfID, map[string]string{"id": cfID}, nil))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "custom field delete failed")
	}
	return c.JSON(http.StatusOK, map[string]string{"id": cfID, "status": "deleted"})
}

func (h *CaseSubHandler) CreateProcedure(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	var req createProcedureRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "procedure create failed")
	}
	defer func() { _ = tx.Rollback() }()
	var id string
	err = tx.GetContext(c.Request().Context(), &id, `
		INSERT INTO case_procedures (case_id, description, pattern_id, pattern_name, tactic, occurred_at, created_by)
		VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
		RETURNING id::text`,
		caseID, req.Description, req.PatternID, req.PatternName, req.Tactic, req.OccurredAt, actorLogin(c))
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "procedure.create", "procedure", id, nil, req))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "procedure create failed")
	}
	return c.JSON(http.StatusCreated, map[string]string{"id": id, "status": "created"})
}

func (h *CaseSubHandler) UpdateProcedure(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	procID := strings.TrimSpace(c.Param("procid"))
	var req updateProcedureRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "procedure update failed")
	}
	defer func() { _ = tx.Rollback() }()
	sets := []string{}
	args := []any{}
	idx := 1
	if req.Description != nil {
		args = append(args, *req.Description)
		sets = append(sets, "description = $"+itoa(idx))
		idx++
	}
	if req.PatternID != nil {
		args = append(args, *req.PatternID)
		sets = append(sets, "pattern_id = $"+itoa(idx))
		idx++
	}
	if req.PatternName != nil {
		args = append(args, *req.PatternName)
		sets = append(sets, "pattern_name = $"+itoa(idx))
		idx++
	}
	if req.Tactic != nil {
		args = append(args, *req.Tactic)
		sets = append(sets, "tactic = $"+itoa(idx))
		idx++
	}
	if req.OccurredAt != nil {
		args = append(args, *req.OccurredAt)
		sets = append(sets, "occurred_at = $"+itoa(idx))
		idx++
	}
	if len(sets) == 0 {
		return c.JSON(http.StatusOK, map[string]string{"id": procID, "status": "no_change"})
	}
	args = append(args, procID, caseID)
	query := "UPDATE case_procedures SET " + strings.Join(sets, ", ") + " WHERE id = $" + itoa(idx) + "::uuid AND case_id = $" + itoa(idx+1) + "::uuid"
	result, err := tx.ExecContext(c.Request().Context(), query, args...)
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return apierr.New(http.StatusNotFound, "procedure not found")
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "procedure.update", "procedure", procID, nil, req))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "procedure update failed")
	}
	return c.JSON(http.StatusOK, map[string]string{"id": procID, "status": "updated"})
}

func (h *CaseSubHandler) DeleteProcedure(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	procID := strings.TrimSpace(c.Param("procid"))
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "procedure delete failed")
	}
	defer func() { _ = tx.Rollback() }()
	result, err := tx.ExecContext(c.Request().Context(), `DELETE FROM case_procedures WHERE id = $1::uuid AND case_id = $2::uuid`, procID, caseID)
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return apierr.New(http.StatusNotFound, "procedure not found")
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "procedure.delete", "procedure", procID, map[string]string{"id": procID}, nil))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "procedure delete failed")
	}
	return c.JSON(http.StatusOK, map[string]string{"id": procID, "status": "deleted"})
}

func propagateCaseShare(ctx echo.Context, tx *sqlx.Tx, caseID string) error {
	_, err := tx.ExecContext(ctx.Request().Context(), `
		WITH orgs AS (
			SELECT COALESCE(array_agg(DISTINCT organisation ORDER BY organisation), '{}'::text[]) AS organisation_ids
			FROM case_shares
			WHERE case_id = $1::uuid
		)
		UPDATE task_items SET organisation_ids = orgs.organisation_ids, updated_at = now()
		FROM orgs WHERE task_items.case_id = $1::uuid`, caseID)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx.Request().Context(), `
		WITH orgs AS (
			SELECT COALESCE(array_agg(DISTINCT organisation ORDER BY organisation), '{}'::text[]) AS organisation_ids
			FROM case_shares
			WHERE case_id = $1::uuid
		)
		UPDATE observables SET organisation_ids = orgs.organisation_ids, updated_at = now()
		FROM orgs WHERE observables.case_id = $1::uuid`, caseID)
	return err
}

func ensureOwnerShareExists(ctx echo.Context, tx *sqlx.Tx, caseID string) error {
	var count int
	if err := tx.GetContext(ctx.Request().Context(), &count, `SELECT COUNT(*) FROM case_shares WHERE case_id = $1::uuid AND owner = true`, caseID); err != nil {
		return err
	}
	if count == 0 {
		return fmt.Errorf("case must keep at least one owner share")
	}
	return nil
}

func (h *CaseSubHandler) CreateShare(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	var req createShareRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "share create failed")
	}
	defer func() { _ = tx.Rollback() }()
	if err := requireActorOwnerShare(c, tx, caseID); err != nil {
		return err
	}
	var id string
	err = tx.GetContext(c.Request().Context(), &id, `
		INSERT INTO case_shares (case_id, organisation, profile, task_rule, observable_rule, owner, task_action_required, created_by)
		VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id::text`,
		caseID, req.Organisation, req.Profile, req.TaskRule, req.ObservableRule, req.Owner, req.TaskActionRequired, actorLogin(c))
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	if err := propagateCaseShare(c, tx, caseID); err != nil {
		return apierr.New(http.StatusInternalServerError, "share propagation failed")
	}
	if err := ensureOwnerShareExists(c, tx, caseID); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "share.create", "share", id, nil, req))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "share create failed")
	}
	return c.JSON(http.StatusCreated, map[string]string{"id": id, "status": "created"})
}

func (h *CaseSubHandler) UpdateShare(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	shareID := strings.TrimSpace(c.Param("shareid"))
	var req updateShareRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid request body")
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "share update failed")
	}
	defer func() { _ = tx.Rollback() }()
	if err := requireActorOwnerShare(c, tx, caseID); err != nil {
		return err
	}
	sets := []string{}
	args := []any{}
	idx := 1
	if req.Profile != nil {
		args = append(args, *req.Profile)
		sets = append(sets, "profile = $"+itoa(idx))
		idx++
	}
	if req.TaskRule != nil {
		args = append(args, *req.TaskRule)
		sets = append(sets, "task_rule = $"+itoa(idx))
		idx++
	}
	if req.ObservableRule != nil {
		args = append(args, *req.ObservableRule)
		sets = append(sets, "observable_rule = $"+itoa(idx))
		idx++
	}
	if req.Owner != nil {
		args = append(args, *req.Owner)
		sets = append(sets, "owner = $"+itoa(idx))
		idx++
	}
	if req.TaskActionRequired != nil {
		args = append(args, *req.TaskActionRequired)
		sets = append(sets, "task_action_required = $"+itoa(idx))
		idx++
	}
	if len(sets) == 0 {
		return c.JSON(http.StatusOK, map[string]string{"id": shareID, "status": "no_change"})
	}
	args = append(args, shareID, caseID)
	query := "UPDATE case_shares SET " + strings.Join(sets, ", ") + " WHERE id = $" + itoa(idx) + "::uuid AND case_id = $" + itoa(idx+1) + "::uuid"
	result, err := tx.ExecContext(c.Request().Context(), query, args...)
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return apierr.New(http.StatusNotFound, "share not found")
	}
	if err := ensureOwnerShareExists(c, tx, caseID); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	if err := propagateCaseShare(c, tx, caseID); err != nil {
		return apierr.New(http.StatusInternalServerError, "share propagation failed")
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "share.update", "share", shareID, nil, req))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "share update failed")
	}
	return c.JSON(http.StatusOK, map[string]string{"id": shareID, "status": "updated"})
}

func (h *CaseSubHandler) DeleteShare(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	shareID := strings.TrimSpace(c.Param("shareid"))
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "share delete failed")
	}
	defer func() { _ = tx.Rollback() }()
	if err := requireActorOwnerShare(c, tx, caseID); err != nil {
		return err
	}
	var deletingOwner bool
	if err := tx.GetContext(c.Request().Context(), &deletingOwner, `SELECT owner FROM case_shares WHERE id = $1::uuid AND case_id = $2::uuid`, shareID, caseID); err != nil {
		return apierr.New(http.StatusNotFound, "share not found")
	}
	if deletingOwner {
		var ownerCount int
		if err := tx.GetContext(c.Request().Context(), &ownerCount, `SELECT COUNT(*) FROM case_shares WHERE case_id = $1::uuid AND owner = true`, caseID); err != nil {
			return apierr.New(http.StatusInternalServerError, "share owner check failed")
		}
		if ownerCount <= 1 {
			return apierr.New(http.StatusBadRequest, "cannot delete the last owner share")
		}
	}
	result, err := tx.ExecContext(c.Request().Context(), `DELETE FROM case_shares WHERE id = $1::uuid AND case_id = $2::uuid`, shareID, caseID)
	if err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return apierr.New(http.StatusNotFound, "share not found")
	}
	if err := propagateCaseShare(c, tx, caseID); err != nil {
		return apierr.New(http.StatusInternalServerError, "share propagation failed")
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "share.delete", "share", shareID, map[string]string{"id": shareID}, nil))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "share delete failed")
	}
	return c.JSON(http.StatusOK, map[string]string{"id": shareID, "status": "deleted"})
}

func itoa(n int) string {
	return fmt.Sprintf("%d", n)
}
