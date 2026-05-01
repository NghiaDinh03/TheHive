package handler

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/lib/pq"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/authjwt"
)

func actorClaims(c echo.Context) *authjwt.Claims {
	claims, _ := c.Get("auth_claims").(*authjwt.Claims)
	return claims
}

func actorOrganisation(c echo.Context) string {
	claims := actorClaims(c)
	if claims == nil {
		return ""
	}
	return strings.TrimSpace(claims.Organisation)
}

func actorHasPlatform(c echo.Context) bool {
	return authjwt.HasPermission(actorClaims(c), "managePlatform")
}

func validateAssignableUser(c echo.Context, tx *sqlx.Tx, caseID string, assignee string, requiredPermission string) error {
	caseID = strings.TrimSpace(caseID)
	assignee = strings.TrimSpace(assignee)
	if assignee == "" {
		return nil
	}
	if actorHasPlatform(c) {
		return nil
	}
	var ok bool
	var err error
	if caseID == "" {
		organisation := actorOrganisation(c)
		if organisation == "" {
			return apierr.New(http.StatusForbidden, "missing actor organisation")
		}
		err = tx.GetContext(c.Request().Context(), &ok, `
			SELECT EXISTS (
				SELECT 1
				FROM users u
				JOIN organisations o ON o.id = u.organisation_id
				JOIN profiles p ON p.id = u.profile_id
				WHERE lower(u.login) = lower($1)
				  AND o.name = $2
				  AND u.status = 'Ok'
				  AND u.locked = false
				  AND $3 = ANY(p.permissions)
			)`, assignee, organisation, requiredPermission)
	} else {
		err = tx.GetContext(c.Request().Context(), &ok, `
			SELECT EXISTS (
				SELECT 1
				FROM users u
				JOIN organisations o ON o.id = u.organisation_id
				JOIN profiles p ON p.id = u.profile_id
				JOIN case_shares cs ON cs.case_id = $1::uuid AND cs.organisation = o.name
				WHERE lower(u.login) = lower($2)
				  AND u.status = 'Ok'
				  AND u.locked = false
				  AND $3 = ANY(p.permissions)
			)`, caseID, assignee, requiredPermission)
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "assignee validation failed")
	}
	if !ok {
		return apierr.New(http.StatusBadRequest, "assignee is not allowed by case share/profile permissions")
	}
	return nil
}

func validateTaskAssignableUser(c echo.Context, tx *sqlx.Tx, taskID string, assignee string) error {
	taskID = strings.TrimSpace(taskID)
	if taskID == "" || strings.TrimSpace(assignee) == "" {
		return nil
	}
	var caseID string
	err := tx.GetContext(c.Request().Context(), &caseID, `SELECT case_id::text FROM task_items WHERE id = $1::uuid`, taskID)
	if err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "task not found")
	}
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "task lookup failed")
	}
	return validateAssignableUser(c, tx, caseID, assignee, "manageTask")
}

func validateBulkTaskAssignableUser(c echo.Context, tx *sqlx.Tx, caseID string, taskIDs []string, assignee string) error {
	assignee = strings.TrimSpace(assignee)
	if assignee == "" {
		return nil
	}
	if strings.TrimSpace(caseID) != "" {
		return validateAssignableUser(c, tx, caseID, assignee, "manageTask")
	}
	ids := make([]string, 0, len(taskIDs))
	for _, id := range taskIDs {
		if strings.TrimSpace(id) != "" {
			ids = append(ids, strings.TrimSpace(id))
		}
	}
	if len(ids) == 0 || actorHasPlatform(c) {
		return nil
	}
	var invalidCount int
	err := tx.GetContext(c.Request().Context(), &invalidCount, `
		WITH selected_tasks AS (
			SELECT DISTINCT case_id
			FROM task_items
			WHERE id = ANY($1::uuid[])
		)
		SELECT COUNT(*)
		FROM selected_tasks st
		WHERE NOT EXISTS (
			SELECT 1
			FROM users u
			JOIN organisations o ON o.id = u.organisation_id
			JOIN profiles p ON p.id = u.profile_id
			JOIN case_shares cs ON cs.case_id = st.case_id AND cs.organisation = o.name
			WHERE lower(u.login) = lower($2)
			  AND u.status = 'Ok'
			  AND u.locked = false
			  AND 'manageTask' = ANY(p.permissions)
		)`, pq.Array(ids), assignee)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "assignee validation failed")
	}
	if invalidCount > 0 {
		return apierr.New(http.StatusBadRequest, "assignee is not allowed for one or more selected tasks")
	}
	return nil
}

func requireActorOwnerShare(c echo.Context, tx *sqlx.Tx, caseID string) error {
	if actorHasPlatform(c) {
		return nil
	}
	organisation := actorOrganisation(c)
	if strings.TrimSpace(organisation) == "" {
		return apierr.New(http.StatusForbidden, "missing actor organisation")
	}
	var ok bool
	err := tx.GetContext(c.Request().Context(), &ok, `
		SELECT EXISTS (
			SELECT 1
			FROM case_shares
			WHERE case_id = $1::uuid AND organisation = $2 AND owner = true
		)`, strings.TrimSpace(caseID), organisation)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "owner share check failed")
	}
	if !ok {
		return apierr.New(http.StatusForbidden, "actor organisation must own the case")
	}
	return nil
}
