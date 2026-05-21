package misp

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
	"go.uber.org/zap"
)

type dbCase struct {
	ID    string         `db:"id"`
	Title string         `db:"title"`
	Flag  bool           `db:"flag"`
	Tags  pq.StringArray `db:"tags"`
}

type dbObservable struct {
	DataType string         `db:"data_type"`
	Data     string         `db:"data"`
	IOC      bool           `db:"ioc"`
	Message  string         `db:"message"`
	Tags     pq.StringArray `db:"tags"`
}

type mispServer struct {
	ID        string `db:"id"`
	Name      string `db:"name"`
	URL       string `db:"url"`
	APIKey    string `db:"api_key"`
	VerifyTLS bool   `db:"verify_tls"`
}

func AutoSyncCaseIOCsToMISP(ctx context.Context, db *sqlx.DB, log *zap.Logger, caseID string) {
	if caseID == "" {
		return
	}

	// 1. Tải thông tin Case từ database
	var c dbCase
	err := db.GetContext(ctx, &c, `SELECT id::text, title, flag, tags FROM cases WHERE id = $1::uuid`, caseID)
	if err != nil {
		if err != sql.ErrNoRows {
			log.Error("autosync misp: failed to get case info", zap.String("case_id", caseID), zap.Error(err))
		}
		return
	}

	// 2. Kiểm tra xem Case có phải là Incident không
	isIncident := c.Flag
	if !isIncident {
		for _, tag := range c.Tags {
			t := strings.ToLower(tag)
			if strings.Contains(t, "incident") || strings.Contains(t, "sự cố") || strings.Contains(t, "su co") {
				isIncident = true
				break
			}
		}
	}

	if !isIncident {
		return
	}

	// 3. Tải tất cả Observables có ioc = true của Case
	var observables []dbObservable
	err = db.SelectContext(ctx, &observables, `SELECT data_type, data, ioc, message, tags FROM observables WHERE case_id = $1::uuid AND ioc = true`, caseID)
	if err != nil {
		log.Error("autosync misp: failed to load observables", zap.String("case_id", caseID), zap.Error(err))
		return
	}

	if len(observables) == 0 {
		return
	}

	// 4. Tìm máy chủ MISP khả dụng đầu tiên
	var srv mispServer
	err = db.GetContext(ctx, &srv, `
		SELECT id::text, name, url, api_key, verify_tls 
		FROM misp_servers 
		WHERE enabled = true AND purpose <> 'ImportOnly' 
		ORDER BY name LIMIT 1`)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Warn("autosync misp: no active misp server with export enabled found")
		} else {
			log.Error("autosync misp: failed to query misp servers", zap.Error(err))
		}
		return
	}

	// 5. Chuẩn bị dữ liệu xuất sang MISP
	exportObs := make([]ExportObservable, 0, len(observables))
	for _, o := range observables {
		exportObs = append(exportObs, ExportObservable{
			DataType: o.DataType,
			Data:     o.Data,
			IOC:      o.IOC,
			Comment:  o.Message,
			Tags:     []string(o.Tags),
		})
	}

	client := NewClient(Config{
		BaseURL:   srv.URL,
		APIKey:    srv.APIKey,
		VerifyTLS: srv.VerifyTLS,
	})

	log.Info("autosync misp: starting export to misp", 
		zap.String("case_id", caseID), 
		zap.String("misp_server", srv.Name), 
		zap.Int("ioc_count", len(exportObs)))

	result, err := client.ExportToEvent(ctx, ExportRequest{
		CaseID:      caseID,
		EventInfo:   fmt.Sprintf("[Auto-Sync] %s", c.Title),
		Observables: exportObs,
	})

	if err != nil {
		// Ghi log lỗi vào db misp_sync_log
		_, _ = db.ExecContext(ctx, `
			INSERT INTO misp_sync_log (server_id, direction, case_id, observable_count, status, error, created_by)
			VALUES ($1::uuid, 'export', $2::uuid, $3, 'failed', $4, 'system')`,
			srv.ID, caseID, len(exportObs), err.Error())
		log.Error("autosync misp: export failed", zap.String("case_id", caseID), zap.Error(err))
		return
	}

	// Ghi log thành công vào db misp_sync_log
	_, _ = db.ExecContext(ctx, `
		INSERT INTO misp_sync_log (server_id, direction, misp_event_id, case_id, observable_count, ioc_count, status, created_by)
		VALUES ($1::uuid, 'export', $2, $3::uuid, $4, $5, 'completed', 'system')`,
		srv.ID, result.EventID, caseID, result.Exported, result.Exported)

	log.Info("autosync misp: export completed successfully", 
		zap.String("case_id", caseID), 
		zap.String("misp_event_id", result.EventID), 
		zap.Int("exported_count", result.Exported))
}
