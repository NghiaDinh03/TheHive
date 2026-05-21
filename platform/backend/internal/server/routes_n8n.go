package server

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/lib/pq"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/authjwt"
	"github.com/thehive-platform/backend/internal/misp"
)

// AuthenticateAPIKey xác thực API Key từ bảng api_keys và giả lập Claims
func AuthenticateAPIKey(db *sqlx.DB) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			key := strings.TrimSpace(c.Request().Header.Get("X-API-Key"))
			if key == "" {
				authHeader := c.Request().Header.Get(echo.HeaderAuthorization)
				if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
					key = strings.TrimSpace(authHeader[7:])
				}
			}
			if key == "" {
				key = strings.TrimSpace(c.QueryParam("api_key"))
			}

			if key == "" {
				return apierr.New(http.StatusUnauthorized, "Yêu cầu cung cấp API key")
			}

			hash := sha256.Sum256([]byte(key))
			keyHash := hex.EncodeToString(hash[:])

			type apiUser struct {
				Login        string         `db:"login"`
				Name         string         `db:"name"`
				Organisation string         `db:"organisation"`
				Profile      string         `db:"profile"`
				Permissions  pq.StringArray `db:"permissions"`
			}
			var u apiUser
			err := db.GetContext(c.Request().Context(), &u, `
				SELECT u.login, u.name, COALESCE(o.name, '') AS organisation, COALESCE(p.name, '') AS profile, COALESCE(p.permissions, '{}') AS permissions
				FROM api_keys ak
				JOIN users u ON u.login = ak.login
				LEFT JOIN organisations o ON o.id = u.organisation_id
				LEFT JOIN profiles p ON p.id = u.profile_id
				WHERE ak.key_hash = $1 AND u.status = 'Ok' AND u.locked = false
				LIMIT 1`, keyHash)

			if err != nil {
				if err == sql.ErrNoRows {
					return apierr.New(http.StatusUnauthorized, "API key không hợp lệ hoặc tài khoản đã bị khóa")
				}
				return apierr.New(http.StatusInternalServerError, "Lỗi xác thực hệ thống")
			}

			claims := &authjwt.Claims{
				Login:        u.Login,
				Organisation: u.Organisation,
				Profile:      u.Profile,
				Permissions:  []string(u.Permissions),
			}

			ctx := context.WithValue(c.Request().Context(), authClaimsContextKey{}, claims)
			c.Set("auth_claims", claims)
			c.SetRequest(c.Request().WithContext(ctx))
			return next(c)
		}
	}
}

type n8nObservableInput struct {
	DataType string   `json:"data_type" validate:"required"`
	Data     string   `json:"data" validate:"required"`
	IOC      bool     `json:"ioc"`
	Message  string   `json:"message"`
	Tags     []string `json:"tags"`
}

type n8nCreateCaseRequest struct {
	Title       string               `json:"title" validate:"required"`
	Description string               `json:"description"`
	Severity    int                  `json:"severity"`
	TLP         int                  `json:"tlp"`
	PAP         int                  `json:"pap"`
	Tags        []string             `json:"tags"`
	Flag        bool                 `json:"flag"`
	Observables []n8nObservableInput `json:"observables"`
}

type n8nAddObservablesRequest struct {
	Observables []n8nObservableInput `json:"observables" validate:"required,dive"`
}

func (s *Server) registerN8NRoutes(api *echo.Group, authAPIKey echo.MiddlewareFunc) {
	n8nGrp := api.Group("/n8n", authAPIKey)

	n8nGrp.POST("/cases", s.n8nCreateCase)
	n8nGrp.POST("/cases/:id/observables", s.n8nAddObservables)
	n8nGrp.POST("/cases/:id/sync-misp", s.n8nSyncMISP)
	n8nGrp.GET("/cases", s.n8nListCases)
}

func (s *Server) n8nCreateCase(c echo.Context) error {
	var req n8nCreateCaseRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "Dữ liệu JSON không hợp lệ")
	}
	if err := c.Validate(&req); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}

	claims, _ := c.Get("auth_claims").(*authjwt.Claims)
	actor := "n8n"
	if claims != nil {
		actor = claims.Login
	}

	tx, err := s.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "Không thể bắt đầu transaction")
	}
	defer func() { _ = tx.Rollback() }()

	// 1. Tạo Case mới
	severity := req.Severity
	if severity == 0 {
		severity = 2
	}
	tlp := req.TLP
	if tlp == 0 {
		tlp = 2
	}
	pap := req.PAP
	if pap == 0 {
		pap = 2
	}
	tags := req.Tags
	if tags == nil {
		tags = []string{}
	}

	var caseID string
	var caseNumber int
	err = tx.QueryRowContext(c.Request().Context(), `
		INSERT INTO cases (number, title, description, severity, tlp, pap, status, owner, assignee, tags, flag)
		VALUES ((SELECT COALESCE(MAX(number), 0) + 1 FROM cases), $1, $2, $3, $4, $5, 'Open', $6, '', $7, $8)
		RETURNING id::text, number`,
		req.Title, req.Description, severity, tlp, pap, actor, pq.Array(tags), req.Flag).Scan(&caseID, &caseNumber)

	if err != nil {
		return apierr.New(http.StatusInternalServerError, "Không thể tạo Case: "+err.Error())
	}

	// 2. Thêm các Observables đi kèm
	var createdCount int
	for _, obs := range req.Observables {
		obsTags := obs.Tags
		if obsTags == nil {
			obsTags = []string{}
		}
		_, err = tx.ExecContext(c.Request().Context(), `
			INSERT INTO observables (case_id, data_type, data, message, tlp, ioc, tags, created_by)
			VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, 'n8n')`,
			caseID, obs.DataType, obs.Data, obs.Message, tlp, obs.IOC, pq.Array(obsTags))
		if err == nil {
			createdCount++
		}
	}

	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "Không thể commit transaction")
	}

	// 3. Kích hoạt Auto-Sync MISP không đồng bộ
	go misp.AutoSyncCaseIOCsToMISP(context.Background(), s.db, s.log, caseID)

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"id":                caseID,
		"number":            caseNumber,
		"title":             req.Title,
		"status":            "Open",
		"observables_added": createdCount,
	})
}

func (s *Server) n8nAddObservables(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	var req n8nAddObservablesRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "Dữ liệu JSON không hợp lệ")
	}
	if err := c.Validate(&req); err != nil {
		return apierr.New(http.StatusBadRequest, err.Error())
	}

	// Kiểm tra Case có tồn tại không
	var exists bool
	err := s.db.GetContext(c.Request().Context(), &exists, `SELECT EXISTS(SELECT 1 FROM cases WHERE id = $1::uuid)`, caseID)
	if err != nil || !exists {
		return apierr.New(http.StatusNotFound, "Không tìm thấy Case tương ứng")
	}

	tx, err := s.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "Không thể bắt đầu transaction")
	}
	defer func() { _ = tx.Rollback() }()

	var added []string
	for _, obs := range req.Observables {
		obsTags := obs.Tags
		if obsTags == nil {
			obsTags = []string{}
		}
		var obsID string
		err = tx.QueryRowContext(c.Request().Context(), `
			INSERT INTO observables (case_id, data_type, data, message, tlp, ioc, tags, created_by)
			VALUES ($1::uuid, $2, $3, $4, 2, $5, $6, 'n8n')
			RETURNING id::text`,
			caseID, obs.DataType, obs.Data, obs.Message, obs.IOC, pq.Array(obsTags)).Scan(&obsID)
		if err == nil {
			added = append(added, obsID)
		}
	}

	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "Không thể commit transaction")
	}

	// Kích hoạt Auto-Sync MISP không đồng bộ
	go misp.AutoSyncCaseIOCsToMISP(context.Background(), s.db, s.log, caseID)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"case_id":           caseID,
		"observables_added": len(added),
		"ids":               added,
	})
}

func (s *Server) n8nSyncMISP(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))

	var exists bool
	err := s.db.GetContext(c.Request().Context(), &exists, `SELECT EXISTS(SELECT 1 FROM cases WHERE id = $1::uuid)`, caseID)
	if err != nil || !exists {
		return apierr.New(http.StatusNotFound, "Không tìm thấy Case tương ứng")
	}

	// Trigger cưỡng bức đồng bộ trong background
	go misp.AutoSyncCaseIOCsToMISP(context.Background(), s.db, s.log, caseID)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"case_id": caseID,
		"status":  "triggered",
		"message": "Đã kích hoạt đồng bộ hóa IOC sang máy chủ MISP trong nền.",
	})
}

func (s *Server) n8nListCases(c echo.Context) error {
	status := strings.TrimSpace(c.QueryParam("status"))
	tag := strings.TrimSpace(c.QueryParam("tag"))

	query := `SELECT id::text AS id, number, title, description, severity, tlp, pap, status, owner, assignee, tags, flag, created_at FROM cases WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if status != "" {
		query += ` AND status = $` + strconv.Itoa(argIdx)
		args = append(args, status)
		argIdx++
	}

	if tag != "" {
		query += ` AND $` + strconv.Itoa(argIdx) + ` = ANY(tags)`
		args = append(args, tag)
		argIdx++
	}

	query += ` ORDER BY created_at DESC LIMIT 50`

	type n8nCaseRow struct {
		ID          string         `db:"id" json:"id"`
		Number      int            `db:"number" json:"number"`
		Title       string         `db:"title" json:"title"`
		Description string         `db:"description" json:"description"`
		Severity    int            `db:"severity" json:"severity"`
		TLP         int            `db:"tlp" json:"tlp"`
		PAP         int            `db:"pap" json:"pap"`
		Status      string         `db:"status" json:"status"`
		Owner       string         `db:"owner" json:"owner"`
		Assignee    string         `db:"assignee" json:"assignee"`
		Tags        pq.StringArray `db:"tags" json:"tags"`
		Flag        bool           `db:"flag" json:"flag"`
		CreatedAt   time.Time      `db:"created_at" json:"created_at"`
	}

	var rows []n8nCaseRow
	if err := s.db.SelectContext(c.Request().Context(), &rows, query, args...); err != nil {
		return apierr.New(http.StatusInternalServerError, "Không thể lấy danh sách Case: "+err.Error())
	}

	return c.JSON(http.StatusOK, rows)
}
