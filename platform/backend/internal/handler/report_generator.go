package handler

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/lib/pq"
	"github.com/thehive-platform/backend/internal/apierr"
)

type ReportHandler struct {
	db *sqlx.DB
}

func NewReportHandler(db *sqlx.DB) *ReportHandler {
	return &ReportHandler{db: db}
}

type reportCase struct {
	ID          string         `db:"id"`
	Number      int            `db:"number"`
	Title       string         `db:"title"`
	Description string         `db:"description"`
	Severity    int            `db:"severity"`
	TLP         int            `db:"tlp"`
	Status      string         `db:"status"`
	Owner       string         `db:"owner"`
	Assignee    string         `db:"assignee"`
	Tags        pq.StringArray `db:"tags"`
	CreatedAt   time.Time      `db:"created_at"`
	UpdatedAt   time.Time      `db:"updated_at"`
}

type reportObservable struct {
	DataType       string         `db:"data_type"`
	Data           string         `db:"data"`
	Message        string         `db:"message"`
	TLP            int            `db:"tlp"`
	IOC            bool           `db:"ioc"`
	Tags           pq.StringArray `db:"tags"`
	MaliciousScore int            `db:"malicious_score"`
}

type reportTask struct {
	Title      string     `db:"title"`
	Status     string     `db:"status"`
	Assignee   string     `db:"assignee"`
	GroupName  string     `db:"group_name"`
	StartDate  *time.Time `db:"start_date"`
	EndDate    *time.Time `db:"end_date"`
}

type reportLog struct {
	Message   string    `db:"message"`
	CreatedBy string    `db:"created_by"`
	CreatedAt time.Time `db:"created_at"`
}

func (h *ReportHandler) GenerateCaseReport(c echo.Context) error {
	caseID := strings.TrimSpace(c.Param("id"))
	if caseID == "" {
		return apierr.New(http.StatusBadRequest, "Case ID is required")
	}

	lang := strings.ToLower(c.QueryParam("lang"))
	if lang != "en" {
		lang = "vi" // Default to Vietnamese
	}

	ctx := c.Request().Context()

	// 1. Fetch Case
	var kase reportCase
	err := h.db.GetContext(ctx, &kase, 
		"SELECT id::text AS id, number, title, description, severity, tlp, status, owner, assignee, tags, created_at, updated_at FROM cases WHERE id = $1::uuid", 
		caseID)
	if err != nil {
		if err == sql.ErrNoRows {
			return apierr.New(http.StatusNotFound, "Case not found")
		}
		return apierr.New(http.StatusInternalServerError, "Failed to query case")
	}

	// 2. Fetch Observables
	var observables []reportObservable
	err = h.db.SelectContext(ctx, &observables, 
		"SELECT data_type, data, message, tlp, ioc, tags, malicious_score FROM observables WHERE case_id = $1::uuid ORDER BY created_at DESC", 
		caseID)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to query observables")
	}

	// 3. Fetch Tasks
	var tasks []reportTask
	err = h.db.SelectContext(ctx, &tasks, 
		"SELECT title, status, assignee, group_name, start_date, end_date FROM task_items WHERE case_id = $1::uuid ORDER BY order_index ASC", 
		caseID)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to query tasks")
	}

	// 4. Fetch Logs
	var logs []reportLog
	err = h.db.SelectContext(ctx, &logs, 
		"SELECT message, created_by, created_at FROM case_logs WHERE case_id = $1::uuid ORDER BY created_at ASC", 
		caseID)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "Failed to query chat logs")
	}

	// 5. Generate beautiful print-friendly HTML
	htmlContent := h.buildHTMLReport(kase, observables, tasks, logs, lang)

	// Return HTML response
	c.Response().Header().Set(echo.HeaderContentType, "text/html; charset=utf-8")
	return c.String(http.StatusOK, htmlContent)
}

func (h *ReportHandler) buildHTMLReport(kase reportCase, observables []reportObservable, tasks []reportTask, logs []reportLog, lang string) string {
	// Translation Dictionary
	t := map[string]map[string]string{
		"vi": {
			"title":          "BÁO CÁO SỰ CỐ AN NINH MẠNG",
			"subtitle":       "Được tạo bởi NCS Fusion Center SOC Engine",
			"case_info":      "THÔNG TIN SỰ CỐ",
			"case_id":        "Mã sự cố",
			"severity":       "Mức độ nghiêm trọng",
			"tlp":            "Độ bảo mật (TLP)",
			"status":         "Trạng thái",
			"assignee":       "Người xử lý",
			"created_at":     "Thời gian tạo",
			"desc":           "Tóm tắt mô tả sự cố",
			"observables":    "DANH SÁCH IOC PHÁT HIỆN (OBSERVABLES)",
			"tasks":          "TIẾN TRÌNH XỬ LÝ (TASKS & PLAYBOOKS)",
			"chat_logs":      "NHẬT KÝ CHI TIẾT (ANALYST CHAT LOGS)",
			"empty":          "Không có dữ liệu.",
			"footer":         "Báo cáo mật - Chỉ sử dụng trong nội bộ doanh nghiệp - NCS Fusion Center © %d",
			"malicious":      "Độ độc hại",
			"ioc_type":       "Loại IOC",
			"ioc_value":      "Giá trị",
			"ioc_tags":       "Nhãn",
			"task_name":      "Tên nhiệm vụ",
			"task_status":    "Trạng thái",
			"task_assignee":  "Người xử lý",
			"time_start":     "Bắt đầu",
			"time_end":       "Kết thúc",
		},
		"en": {
			"title":          "CYBERSECURITY INCIDENT REPORT",
			"subtitle":       "Generated by NCS Fusion Center SOC Engine",
			"case_info":      "INCIDENT INFORMATION",
			"case_id":        "Incident ID",
			"severity":       "Severity",
			"tlp":            "Classification (TLP)",
			"status":         "Status",
			"assignee":       "Assignee",
			"created_at":     "Created At",
			"desc":           "Incident Description Summary",
			"observables":    "DETECTED IOCs & OBSERVABLES",
			"tasks":          "RESPONSE PROGRESS (TASKS & PLAYBOOKS)",
			"chat_logs":      "DETAILED TIMELINE (ANALYST CHAT LOGS)",
			"empty":          "No data available.",
			"footer":         "Confidential - Internal Use Only - NCS Fusion Center © %d",
			"malicious":      "Malicious Score",
			"ioc_type":       "IOC Type",
			"ioc_value":      "Value",
			"ioc_tags":       "Tags",
			"task_name":      "Task Name",
			"task_status":    "Status",
			"task_assignee":  "Assignee",
			"time_start":     "Start",
			"time_end":       "End",
		},
	}

	tr := t[lang]

	// Format Severity / TLP
	severityStr := "Low"
	if kase.Severity == 2 {
		severityStr = "Medium"
	} else if kase.Severity == 3 {
		severityStr = "High"
	} else if kase.Severity == 4 {
		severityStr = "Critical"
	}

	tlpStr := "WHITE"
	tlpColor := "#ffffff"
	if kase.TLP == 1 {
		tlpStr = "GREEN"
		tlpColor = "#22c55e"
	} else if kase.TLP == 2 {
		tlpStr = "AMBER"
		tlpColor = "#f97316"
	} else if kase.TLP == 3 {
		tlpStr = "RED"
		tlpColor = "#ef4444"
	}

	// Observables HTML
	obsRows := ""
	if len(observables) == 0 {
		obsRows = fmt.Sprintf("<tr><td colspan='5' class='empty-row'>%s</td></tr>", tr["empty"])
	} else {
		for _, obs := range observables {
			tagBadges := ""
			for _, tag := range obs.Tags {
				tagBadges += fmt.Sprintf("<span class='badge tag-badge'>%s</span>", tag)
			}
			scoreClass := "score-low"
			if obs.MaliciousScore >= 75 {
				scoreClass = "score-high"
			} else if obs.MaliciousScore >= 40 {
				scoreClass = "score-medium"
			}

			obsRows += fmt.Sprintf(`
				<tr>
					<td><strong>%s</strong></td>
					<td class="ioc-val">%s</td>
					<td><span class="tlp-badge" style="background-color: %s;">TLP:%s</span></td>
					<td><span class="score-badge %s">%d%%</span></td>
					<td>%s</td>
				</tr>`, obs.DataType, obs.Data, tlpColor, tlpStr, scoreClass, obs.MaliciousScore, tagBadges)
		}
	}

	// Tasks HTML
	taskRows := ""
	if len(tasks) == 0 {
		taskRows = fmt.Sprintf("<tr><td colspan='5' class='empty-row'>%s</td></tr>", tr["empty"])
	} else {
		for _, task := range tasks {
			start := "-"
			if task.StartDate != nil {
				start = task.StartDate.Format("2006-01-02 15:04:02")
			}
			end := "-"
			if task.EndDate != nil {
				end = task.EndDate.Format("2006-01-02 15:04:02")
			}
			statusClass := "status-waiting"
			if task.Status == "Completed" {
				statusClass = "status-completed"
			} else if task.Status == "InProgress" {
				statusClass = "status-inprogress"
			} else if task.Status == "Cancel" {
				statusClass = "status-cancel"
			}

			taskRows += fmt.Sprintf(`
				<tr>
					<td>%s</td>
					<td><span class="status-badge %s">%s</span></td>
					<td>%s</td>
					<td>%s</td>
					<td>%s</td>
				</tr>`, task.Title, statusClass, task.Status, task.Assignee, start, end)
		}
	}

	// Logs HTML
	logRows := ""
	if len(logs) == 0 {
		logRows = fmt.Sprintf("<div class='empty-row'>%s</div>", tr["empty"])
	} else {
		for _, log := range logs {
			logRows += fmt.Sprintf(`
				<div class="log-item">
					<div class="log-meta">
						<span class="log-user">👤 %s</span>
						<span class="log-time">🕒 %s</span>
					</div>
					<div class="log-msg">%s</div>
				</div>`, log.CreatedBy, log.CreatedAt.Format("2006-01-02 15:04:02"), log.Message)
		}
	}

	printBtnText := "Print Report"
	if lang == "vi" {
		printBtnText = "In báo cáo"
	}

	// Output HTML with Print CSS and modern branding layout
	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="%s">
<head>
	<meta charset="UTF-8">
	<title>%s - %s</title>
	<style>
		@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
		body {
			font-family: 'Inter', sans-serif;
			color: #334155;
			background-color: #ffffff;
			line-height: 1.6;
			margin: 0;
			padding: 40px;
		}
		.report-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			border-bottom: 3px solid #1d4ed8;
			padding-bottom: 20px;
			margin-bottom: 30px;
		}
		.branding h1 {
			color: #1e293b;
			font-size: 28px;
			font-weight: 700;
			margin: 0 0 5px 0;
			letter-spacing: -0.5px;
		}
		.branding p {
			color: #64748b;
			font-size: 14px;
			margin: 0;
		}
		.logo {
			font-size: 24px;
			font-weight: 800;
			color: #1d4ed8;
			border: 2px solid #1d4ed8;
			padding: 5px 15px;
			border-radius: 4px;
		}
		h2.section-title {
			color: #0f172a;
			font-size: 18px;
			font-weight: 600;
			border-left: 4px solid #1d4ed8;
			padding-left: 10px;
			margin-top: 40px;
			margin-bottom: 15px;
			text-transform: uppercase;
		}
		.meta-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 15px;
			background-color: #f8fafc;
			padding: 20px;
			border-radius: 8px;
			border: 1px solid #e2e8f0;
			margin-bottom: 30px;
		}
		.meta-item {
			font-size: 14px;
		}
		.meta-item strong {
			color: #475569;
			display: inline-block;
			width: 160px;
		}
		.desc-box {
			background-color: #f1f5f9;
			padding: 15px 20px;
			border-radius: 8px;
			border-left: 4px solid #64748b;
			font-size: 14px;
			white-space: pre-line;
		}
		table {
			width: 100%%;
			border-collapse: collapse;
			margin-top: 15px;
			font-size: 13px;
		}
		th {
			background-color: #f1f5f9;
			color: #334155;
			text-align: left;
			font-weight: 600;
			padding: 10px 12px;
			border-bottom: 2px solid #cbd5e1;
		}
		td {
			padding: 10px 12px;
			border-bottom: 1px solid #e2e8f0;
			vertical-align: middle;
		}
		.empty-row {
			text-align: center;
			color: #94a3b8;
			padding: 30px;
			font-style: italic;
		}
		.tlp-badge {
			color: #ffffff;
			font-size: 11px;
			font-weight: 700;
			padding: 2px 8px;
			border-radius: 12px;
		}
		.score-badge {
			font-size: 11px;
			font-weight: 700;
			padding: 2px 8px;
			border-radius: 12px;
		}
		.score-low { background-color: #dcfce7; color: #15803d; }
		.score-medium { background-color: #fef3c7; color: #b45309; }
		.score-high { background-color: #fee2e2; color: #b91c1c; }
		.badge {
			font-size: 11px;
			padding: 2px 6px;
			border-radius: 4px;
			margin-right: 4px;
			display: inline-block;
		}
		.tag-badge {
			background-color: #e2e8f0;
			color: #475569;
		}
		.status-badge {
			font-size: 11px;
			font-weight: 600;
			padding: 2px 8px;
			border-radius: 12px;
		}
		.status-waiting { background-color: #cbd5e1; color: #475569; }
		.status-inprogress { background-color: #dbeafe; color: #1d4ed8; }
		.status-completed { background-color: #dcfce7; color: #15803d; }
		.status-cancel { background-color: #fee2e2; color: #b91c1c; }
		.log-item {
			border-bottom: 1px solid #f1f5f9;
			padding: 12px 5px;
		}
		.log-meta {
			display: flex;
			justify-content: space-between;
			font-size: 12px;
			color: #64748b;
			margin-bottom: 4px;
		}
		.log-user { font-weight: 600; color: #475569; }
		.log-msg {
			font-size: 13.5px;
			white-space: pre-wrap;
		}
		.footer {
			margin-top: 60px;
			border-top: 1px solid #e2e8f0;
			padding-top: 15px;
			text-align: center;
			font-size: 11px;
			color: #94a3b8;
		}
		.ioc-val {
			font-family: monospace;
			background-color: #f8fafc;
			padding: 2px 6px;
			border-radius: 4px;
		}
		@media print {
			body {
				padding: 0;
			}
			.no-print {
				display: none;
			}
			.page-break {
				page-break-before: always;
			}
		}
		.print-btn-container {
			display: flex;
			justify-content: flex-end;
			margin-bottom: 20px;
		}
		.print-btn {
			background-color: #1d4ed8;
			color: #ffffff;
			border: none;
			padding: 8px 20px;
			border-radius: 4px;
			font-size: 14px;
			font-weight: 600;
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 8px;
			box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
		}
		.print-btn:hover {
			background-color: #1e40af;
		}
	</style>
</head>
<body>
	<div class="print-btn-container no-print">
		<button class="print-btn" onclick="window.print()">
			🖨️ %s
		</button>
	</div>

	<div class="report-header">
		<div class="branding">
			<h1>%s</h1>
			<p>%s</p>
		</div>
		<div class="logo">NCS Fusion</div>
	</div>

	<h2 class="section-title">%s</h2>
	<div class="meta-grid">
		<div class="meta-item"><strong>%s:</strong> %s#%08d</div>
		<div class="meta-item"><strong>%s:</strong> %s</div>
		<div class="meta-item"><strong>%s:</strong> %s</div>
		<div class="meta-item"><strong>%s:</strong> <span style="color: %s; font-weight:700;">TLP:%s</span></div>
		<div class="meta-item"><strong>%s:</strong> %s</div>
		<div class="meta-item"><strong>%s:</strong> %s</div>
	</div>

	<div class="desc-box">
		<strong>%s:</strong><br/>
		%s
	</div>

	<h2 class="section-title">%s</h2>
	<table>
		<thead>
			<tr>
				<th>%s</th>
				<th>%s</th>
				<th>TLP</th>
				<th>%s</th>
				<th>%s</th>
			</tr>
		</thead>
		<tbody>
			%s
		</tbody>
	</table>

	<div class="page-break"></div>

	<h2 class="section-title">%s</h2>
	<table>
		<thead>
			<tr>
				<th>%s</th>
				<th>%s</th>
				<th>%s</th>
				<th>%s</th>
				<th>%s</th>
			</tr>
		</thead>
		<tbody>
			%s
		</tbody>
	</table>

	<h2 class="section-title">%s</h2>
	<div class="logs-container">
		%s
	</div>

	<div class="footer">
		%s
	</div>
</body>
</html>`,
		lang,
		tr["title"], kase.Title,
		printBtnText,
		tr["title"],
		tr["subtitle"],
		tr["case_info"],
		tr["case_id"], strings.ToUpper(kase.Owner), kase.Number,
		tr["status"], kase.Status,
		tr["severity"], severityStr,
		tr["tlp"], tlpColor, tlpStr,
		tr["assignee"], kase.Assignee,
		tr["created_at"], kase.CreatedAt.Format("2006-01-02 15:04:02"),
		tr["desc"], kase.Description,
		tr["observables"],
		tr["ioc_type"], tr["ioc_value"], tr["malicious"], tr["ioc_tags"],
		obsRows,
		tr["tasks"],
		tr["task_name"], tr["task_status"], tr["task_assignee"], tr["time_start"], tr["time_end"],
		taskRows,
		tr["chat_logs"],
		logRows,
		fmt.Sprintf(tr["footer"], time.Now().Year()),
	)

	return html
}
