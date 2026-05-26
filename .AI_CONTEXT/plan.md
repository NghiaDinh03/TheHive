# Kế hoạch Triển khai: NCS Fusion Center Next-Gen SOC features

Tài liệu này kiểm soát kế hoạch triển khai, nâng cấp và đánh giá mức độ sẵn sàng Go-Live của dự án **NCS Fusion Center** (Go + Next.js).

---

## 🎯 Đánh giá Mức độ Sẵn sàng Go-Live: **98%** (Đang triển khai các tính năng Next-Gen SOC)

Hệ thống NCS Fusion Center đã hoàn thiện hầu hết các tính năng lõi từ TheHive 4 và được trang bị giao diện Glassmorphism cao cấp. Hệ thống đang được tích hợp thêm các tính năng SOC tự động và thông minh thế hệ mới (Phases M, N, O, P).

---

## 🛠️ Chi tiết các Phase & Subtask Phát triển

### Phase I: Interactive AI Chat UI & Docker Compose Dev Mode (Hoàn thành)
- **Input:** API Endpoint `/api/v1/cases/:id/ai-chat` của backend Go và component frontend `AIAssistantTab.tsx`.
- **Output nguyện vọng:**
  - Analyst có thể chat trực tiếp với AI thời gian thực ngay trên giao diện case detail.
  - Thay đổi bất kỳ file code nào đều được Docker tự động cập nhật (live-reload).
  - Chỉ cần chạy đúng 1 lệnh docker-compose up là chạy được ngay.
- **Output kết quả thực tế:**
  - [x] Thêm handler `Chat` vào `cyberai.go` và đăng ký route `/api/v1/cases/:id/ai-chat`.
  - [x] Thiết kế giao diện chat bong bóng Glassmorphism, micro-animations và auto-scroll ở frontend.
  - [x] Tích hợp API gửi nhận tin nhắn mượt mà.
  - [x] Sửa `docker-compose.yml` (TheHive) bỏ `external` để tự tạo local volumes.
- **Subtasks:**
  - `[x]` Sửa `platform/backend/internal/handler/cyberai.go` thêm method `Chat`.
  - `[x]` Sửa `platform/backend/internal/server/routes_investigation.go` đăng ký route POST `/cases/:id/ai-chat`.
  - `[x]` Viết lại `platform/frontend/src/app/cases/[id]/AIAssistantTab.tsx` với Chat UI Glassmorphism.
  - `[x]` Sửa `platform/deploy/docker-compose.yml` chuyển các external volumes sang local.

### Phase J: QRadar-style Dynamic Regex Parser (Custom Property Engine) (Hoàn thành)
- **Input:** Cấu hình regex nhập từ UI Admin của NCS Fusion Center.
- **Output nguyện vọng:** Trích xuất tự động thời gian thực khi case được ghi nhận từ SIEM.
- **Output kết quả thực tế:**
  - [x] Đã tạo migration bảng `custom_properties_regex`, viết API quản lý Regex Rules và dynamic regex parser bằng Go.
- **Subtasks:**
  - `[x]` Tạo bảng `custom_properties_regex` trong PostgreSQL để lưu các quy tắc regex qua migration `000045_custom_properties_regex`.
  - `[x]` Viết dynamic parser bằng package `regexp` trong Go, kèm cache compiled regex tối ưu CPU tại `custom_properties_regex.go`.
  - `[x]` Thiết kế UI quản lý Regex Rules và tích hợp vào tab quản trị Admin Page Next.js.

### Phase K: Thắt chặt API RBAC Quyền Hạn (Hoàn thành)
- **Mục tiêu:** Chặn đứng 100% việc Analyst hoặc Client cố tình sửa đổi dữ liệu qua API bên ngoài (như Postman/curl).
- **Input:** Middleware kiểm tra quyền trong backend Go.
- **Output nguyện vọng:** Trả về `403 Forbidden` cho mọi request PATCH/POST/DELETE từ user có role `Read-only` hoặc `Client`.
- **Output kết quả thực tế:**
  - [x] Middleware API Go đã chặn hoàn toàn các request ghi (POST/PUT/PATCH/DELETE) từ tài khoản không đủ quyền.
- **Subtasks:**
  - `[x]` Rà soát các route trong `routes_investigation.go` và thắt chặt API bằng middleware chặn ghi ở `RequirePermission` và `RequireAnyPermission` tại `middleware.go`.
  - `[x]` Đảm bảo trả về 403 Forbidden cho tất cả thực thể (case, alert, task, observable, custom fields).

### Phase L: OpenSearch Exact Count Parity (Hoàn thành)
- **Mục tiêu:** Đảm bảo tính nhất quán 100% số liệu thống kê SOC.
- **Input:** Cấu hình OpenSearch query Go client.
- **Output nguyện vọng:** Chỉ số trên Dashboard chính xác từng con số thay vì ước lượng `1000+`.
- **Output kết quả thực tế:**
  - [x] Đã cấu hình `track_total_hits` thành `true` trong OpenSearch client của Go.
- **Subtasks:**
  - `[x]` Cấu hình `"track_total_hits": true` trong Go OpenSearch query client.

---

## 🚀 Kế hoạch Nâng cấp & Cải thiện Tiếp theo (Các Phase Đang Thực Hiện)

### Phase M: ML-based Alert Clustering & Deduplication (Gom cụm & Chống trùng lặp Cảnh báo) (Hoàn thành)
- **Mục tiêu:** Giải quyết triệt để vấn đề "Quá tải cảnh báo" (Alert Fatigue) cho phân tích viên bằng cách tự động gom cụm các Alert tương đồng thành một Case duy nhất.
- **Input:** Các Alert thô đổ về liên tục từ hệ thống SIEM.
- **Output nguyện vọng:** Tự động phát hiện các Alert trùng lặp hoặc thuộc cùng một chiến dịch tấn công (ví dụ Bruteforce nhiều IP, hoặc Scan cổng diện rộng) và gộp vào một Case điều tra tập trung.
- **Output kết quả thực tế:**
  - [x] Đã tạo DB migration `000046_alert_clustering` tạo bảng `alert_clusters` liên kết Alerts và Cases.
  - [x] Đã viết Clustering Engine với Jaccard Similarity đối khớp Observables (0.5), Text Title/Description (0.3) và Tags (0.2) trên các Active Cases trong vòng 24 giờ.
  - [x] Tích hợp bất đồng bộ vào handler tạo Alert, tự động gộp vào Case nếu điểm tương đồng >85%, hoặc lưu liên kết gom cụm để Analyst kiểm tra.
  - [x] Tích hợp tab hiển thị Clustered Alerts dạng card sang trọng bằng Next.js Fluent UI.
- **Subtasks:**
  - `[x]` Tạo migration `000046_alert_clustering.sql` tạo bảng `alert_clusters` lưu quan hệ gom cụm.
  - `[x]` Viết thuật toán gom cụm (Clustering Engine) trong Go dựa trên Jaccard Similarity của các trường dữ liệu (`title`, `description`, `tags`, `observables`) và khoảng thời gian (Time window).
  - `[x]` Xây dựng cơ chế tự động Merge (Auto-merge) Alert mới vào Case đang Active nếu phát hiện trùng lặp cao (>85%).
  - `[x]` Thiết kế UI hiển thị danh sách Alert được gom cụm dạng luồng cây trực quan tại Case detail tab.

### Phase N: Collaborative Active Case Rooms & Real-time Synced Workspace (Hoàn thành)
- **Mục tiêu:** Tăng tốc độ phản ứng sự cố lớn (Major Incident) bằng cách cho phép nhiều Analyst cùng phối hợp điều tra trực tiếp trên một màn hình thời gian thực.
- **Input:** WebSocket connections kết nối giữa các Analyst đang online.
- **Output nguyện vọng:** Trải nghiệm cộng tác thời gian thực tương tự Google Docs (nhìn thấy ai đang online trong Case, ai đang viết Log, soạn Task).
- **Output kết quả thực tế:**
  - [x] Xây dựng WebSocket Hub an toàn trong Go backend quản lý các phiên kết nối Case Room, tự động parse JWT từ query parameter `token` để handshake an toàn mà không bị vướng CORS/CSRF headers.
  - [x] Phát Toast notification thời gian thực khi có Analyst khác cập nhật dữ liệu kèm âm thanh soft ping 850Hz dịu nhẹ được tạo động qua Browser Web Audio API không phụ thuộc tệp tin.
  - [x] Hiển thị panel Active Analysts trực tuyến với pulsing green indicator trên Sidebar bên phải.
- **Subtasks:**
  - `[x]` Xây dựng WebSocket Hub trong Go backend quản lý các phiên kết nối phòng điều tra (Case Room).
  - `[x]` Đồng bộ hóa hoạt động (Activity Stream) và phát cảnh báo âm thanh soft ping tức thời khi có Analyst khác cập nhật dữ liệu.
  - `[x]` Tích hợp chỉ báo trạng thái online/offline của phân tích viên tại sidebar bên phải.

### Phase O: Autonomous Incident Response (CyberAI Agentic Threat Hunting) (Hoàn thành)
- **Mục tiêu:** Chuyển đổi từ phản ứng thụ động sang tự động cô lập hiểm họa (Active Mitigation) trong vài giây mà không cần sự can thiệp thủ công của con người.
- **Input:** Các chỉ số độc hại trích xuất được từ log (Observables) có Threat Score (malicious_score) được cập nhật hoặc tạo mới.
- **Output nguyện vọng:** Tự động gửi IOC tới n8n Webhook, nếu Score độc hại vượt ngưỡng (Threat Score > 80), CyberAI sẽ tự động kích hoạt Playbook n8n ngăn chặn (Block IP trên Firewall, hoặc cô lập máy tính bị nhiễm qua EDR) và ghi nhận lịch sử logs trực quan.
- **Output kết quả thực tế:**
  - [x] Tích hợp thành công Migration 47 tạo bảng `autonomous_rules` và `autonomous_logs` trong PostgreSQL.
  - [x] Xây dựng trọn vẹn Package Repository & Handler CRUD cho Rules/Logs ở backend Go.
  - [x] Mở rộng API Observable hỗ trợ gán điểm độc hại `malicious_score` và trigger bất đồng bộ SOAR n8n Webhook khi score vượt ngưỡng.
  - [x] Hoàn thành giao diện quản trị Phản ứng Tự động 100% Tiếng Việt Fluent UI/Glassmorphism tại Next.js (`/admin/autonomous`) với 2 tab: Quy tắc Tự động (Drawer form thêm/sửa) và Lịch sử Phản ứng (expandable JSON payload view).
  - [x] Tích hợp thành công tính năng kích hoạt Playbook n8n thủ công (Manual SOAR Trigger) từ trang chi tiết Task (`app/tasks/[id]/page.tsx`) thông qua dropdown (dropbox) tiện lợi lọc tự động theo loại observable.
  - [x] Viết REST API backend `POST /api/v1/autonomous/trigger-manual` xử lý kích hoạt thủ công, cập nhật trạng thái logs và đồng bộ lịch sử.
  - [x] Vượt qua 100% các suite test smoke an ninh mạng Go bao gồm cả kiểm thử tự động và thủ công (`go test ./internal/tests -run TestAutonomousResponseLifecycle -v`).
- **Subtasks:**
  - `[x]` Tạo migration `000047_autonomous_response.up.sql` lưu cấu hình quy tắc phản ứng tự động (`autonomous_rules`) và lịch sử thực thi (`autonomous_logs`).
  - `[x]` Mở rộng API cập nhật Observable (`PatchObservable` & `CreateObservable`) ở Go backend hỗ trợ gán/cập nhật điểm độc hại `malicious_score` từ REST API.
  - `[x]` Viết Repository & Handler xử lý CRUD cho Rules/Logs và trigger gọi n8n Webhook bất đồng bộ khi Threat Score vượt ngưỡng.
  - `[x]` Thiết kế giao diện Admin Phản ứng Tự động trên Next.js (`/admin/autonomous`) Fluent UI/Glassmorphism 100% Tiếng Việt (Tabs: Quy tắc Tự động, Lịch sử Phản ứng).
  - `[x]` Xây dựng dropdown chọn Playbook và Observable, nút bấm kích hoạt thủ công tại Sidebar của Task detail page Next.js (`app/tasks/[id]/page.tsx`).
  - `[x]` Viết API backend `TriggerManual` trong `AutonomousHandler` và đăng ký route tương ứng.
  - `[x]` Sửa lỗi kiểm thử và hoàn thiện suite smoke test `smoke_autonomous_test.go` hoạt động trơn tru 100% đối với cả 2 luồng.

### Phase P: Interactive Visual Attack Graph (Bản đồ Tác chiến Tấn công) (Hoàn thành)
- **Mục tiêu:** Giúp Analyst hình dung trực quan và toàn diện con đường tấn công của hacker (Lateral Movement) qua các thực thể mạng.
- **Input:** Dữ liệu quan hệ giữa Alerts, Observables (IP, Host, User, Hash), và các Cases có liên quan.
- **Output nguyện vọng:** Bản đồ mạng tương tác 2D/3D trực quan biểu diễn mối quan hệ giữa các thực thể và các kỹ thuật tấn công MITRE ATT&CK.
- **Output kết quả thực tế:**
  - [x] Tích hợp component Threat Map vẽ đồ thị tương tác dạng Solar System bằng các hình học SVG kết hợp tính toán quỹ đạo mượt mà không cần nạp thư viện ngoài nặng nề.
  - [x] Kết nối trực tiếp với API `/api/v1/cases/:id/correlation` của Go backend, tự động Pivot/Truy vết nhanh các Observables có liên quan.
- **Subtasks:**
  - `[x]` Tích hợp thư viện React Flow hoặc SVG tùy biến cao vào giao diện Next.js.
  - `[x]` Thiết kế các Node thực thể (Case, Alert, IP, User, File MD5) và các Edge (hướng tấn công, liên kết tương đồng) sử dụng styling Glassmorphism.
  - `[x]` Cho phép Analyst kéo thả thực thể, nhấn đúp chuột để pivot/truy vết nhanh các Observable liên quan.

