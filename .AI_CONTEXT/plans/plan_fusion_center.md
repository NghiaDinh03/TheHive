# Kế hoạch Triển khai: NCS Fusion Center (TheHive Platform)

Tài liệu này kiểm soát kế hoạch triển khai, nâng cấp và đánh giá mức độ sẵn sàng Go-Live của dự án **NCS Fusion Center** (Go + Next.js).

---

## 🎯 Đánh giá Mức độ Sẵn sàng Go-Live: **98%**

Hệ thống NCS Fusion Center đã hoàn thiện gần như toàn bộ các tính năng lõi từ TheHive 4 và khoác lên mình lớp áo Glassmorphism cao cấp. Gần như tất cả các khoảng trống kỹ thuật cốt lõi đã được giải quyết triệt để. Hệ thống hoàn toàn sẵn sàng cho giai đoạn **Staging / Production Pilot (Shadow Run)**.

### 📋 Khoảng trống kỹ thuật đã hoàn thiện:
1. **Interactive CyberAI Analyst Chat UI:** Chatbot tương tác thời gian thực tại tab CyberAI Analyst của case detail (Đã hoàn thành).
2. **Docker Compose Dev Mode Integration:** Live-reload tự động cho backend/frontend (Đã hoàn thành).
3. **Thắt chặt ma trận phân quyền RBAC:** Cấu hình middleware API Go chặn các tài khoản `Read-only` / `Client` thực hiện POST/PUT/PATCH/DELETE (Đã hoàn thành).
4. **QRadar-style Dynamic Regex Parser:** Xây dựng dynamic regex properties engine đối khớp tự động và hiển thị SIEM fields trên UI (Đã hoàn thành).
5. **OpenSearch Exact Count Parity:** Bật `"track_total_hits": true` để hiển thị chính xác số kết quả thực tế trên Dashboard & phân trang (Đã hoàn thành).

*Lưu ý:* Cơ chế giám sát tài nguyên Prometheus/Grafana và backup database PostgreSQL định kỳ đã được lược bỏ khỏi cấu hình Docker Compose theo phản hồi từ người dùng (do hệ thống sử dụng chung external volume và được giám sát ở tầng hạ tầng Docker Host / Ảo hóa của doanh nghiệp).

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
- **Subtasks:**
  - `[x]` Tạo bảng `custom_properties_regex` trong PostgreSQL để lưu các quy tắc regex qua migration `000045_custom_properties_regex`.
  - `[x]` Viết dynamic parser bằng package `regexp` trong Go, kèm cache compiled regex tối ưu CPU tại `custom_properties_regex.go`.
  - `[x]` Thiết kế UI quản lý Regex Rules và tích hợp vào tab quản trị Admin Page Next.js.

### Phase K: Thắt chặt API RBAC Quyền Hạn (Hoàn thành)
- **Mục tiêu:** Chặn đứng 100% việc Analyst hoặc Client cố tình sửa đổi dữ liệu qua API bên ngoài (như Postman/curl).
- **Input:** Middleware kiểm tra quyền trong backend Go.
- **Output nguyện vọng:** Trả về `403 Forbidden` cho mọi request PATCH/POST/DELETE từ user có role `Read-only` hoặc `Client`.
- **Subtasks:**
  - `[x]` Rà soát các route trong `routes_investigation.go` và thắt chặt API bằng middleware chặn ghi ở `RequirePermission` và `RequireAnyPermission` tại `middleware.go`.
  - `[x]` Đảm bảo trả về 403 Forbidden cho tất cả thực thể (case, alert, task, observable, custom fields).

### Phase L: OpenSearch Exact Count Parity (Hoàn thành)
- **Mục tiêu:** Đảm bảo tính nhất quán 100% số liệu thống kê SOC.
- **Input:** Cấu hình OpenSearch query Go client.
- **Output nguyện vọng:** Chỉ số trên Dashboard chính xác từng con số thay vì ước lượng `1000+`.
- **Subtasks:**
  - `[x]` Cấu hình `"track_total_hits": true` trong Go OpenSearch query client.

---

## 🚀 Kế hoạch Nâng cấp & Cải thiện Tiếp theo (Đề xuất)

Dưới đây là các đề xuất tính năng đột phá, đạt chuẩn **Enterprise SOC thế hệ mới (Next-Gen SOAR/SIEM Platform)** phù hợp hoàn hảo với mục tiêu của nền tảng NCS Fusion Center và CyberAI:

### Phase M: ML-based Alert Clustering & Deduplication (Gom cụm & Chống trùng lặp Cảnh báo)
- **Mục tiêu:** Giải quyết triệt để vấn đề "Quá tải cảnh báo" (Alert Fatigue) cho phân tích viên bằng cách tự động gom cụm các Alert tương đồng thành một Case duy nhất.
- **Input:** Các Alert thô đổ về liên tục từ hệ thống SIEM.
- **Output nguyện vọng:** Tự động phát hiện các Alert trùng lặp hoặc thuộc cùng một chiến dịch tấn công (ví dụ Bruteforce nhiều IP, hoặc Scan cổng diện rộng) và gộp vào một Case điều tra tập trung.
- **Subtasks:**
  - `[ ]` Viết thuật toán gom cụm (Clustering Engine) trong Go dựa trên Jaccard Similarity của các trường dữ liệu và khoảng thời gian (Time window).
  - `[ ]` Xây dựng cơ chế tự động Merge (Auto-merge) Alert mới vào Case đang Active nếu phát hiện trùng lặp cao (>85%).
  - `[ ]` Thiết kế UI hiển thị danh sách Alert được gom cụm dạng luồng cây trực quan tại Case detail.

### Phase N: Collaborative Active Case Rooms & Real-time Synced Workspace
- **Mục tiêu:** Tăng tốc độ phản ứng sự cố lớn (Major Incident) bằng cách cho phép nhiều Analyst cùng phối hợp điều tra trực tiếp trên một màn hình thời gian thực.
- **Input:** WebSocket connections kết nối giữa các Analyst đang online.
- **Output nguyện vọng:** Trải nghiệm cộng tác thời gian thực tương tự Google Docs (nhìn thấy ai đang online trong Case, ai đang viết Log, soạn Task).
- **Subtasks:**
  - `[ ]` Xây dựng WebSocket Hub trong Go backend quản lý các phiên kết nối phòng điều tra (Case Room).
  - `[ ]` Đồng bộ hóa hoạt động (Activity Stream) và phát cảnh báo âm thanh soft ping tức thời khi có Analyst khác cập nhật dữ liệu.
  - `[ ]` Tích hợp chỉ báo trạng thái online/offline của phân tích viên tại sidebar bên phải.

### Phase O: Autonomous Incident Response (CyberAI Agentic Threat Hunting) (Hoàn thành)
- **Mục tiêu:** Chuyển đổi từ phản ứng thụ động sang tự động cô lập hiểm họa (Active Mitigation) trong vài giây mà không cần sự can thiệp thủ công của con người.
- **Input:** Các chỉ số độc hại trích xuất được từ log (Observables) có Threat Score (malicious_score) được cập nhật hoặc tạo mới.
- **Output nguyện vọng:** Tự động gửi IOC tới n8n Webhook, nếu Score độc hại vượt ngưỡng (Threat Score > 80), CyberAI sẽ tự động kích hoạt Playbook n8n ngăn chặn (Block IP trên Firewall, hoặc cô lập máy tính bị nhiễm qua EDR) và ghi nhận lịch sử logs trực quan.
- **Subtasks:**
  - `[x]` Tạo migration `000047_autonomous_response.up.sql` lưu cấu hình quy tắc phản ứng tự động (`autonomous_rules`) và lịch sử thực thi (`autonomous_logs`).
  - `[x]` Mở rộng API cập nhật Observable (`PatchObservable` & `CreateObservable`) ở Go backend hỗ trợ gán/cập nhật điểm độc hại `malicious_score` từ REST API.
  - `[x]` Viết Repository & Handler xử lý CRUD cho Rules/Logs và trigger gọi n8n Webhook bất đồng bộ khi Threat Score vượt ngưỡng.
  - `[x]` Thiết kế giao diện Admin Phản ứng Tự động trên Next.js (`/admin/autonomous`) Fluent UI/Glassmorphism 100% Tiếng Việt (Tabs: Quy tắc Tự động, Lịch sử Phản ứng).

### Phase P: Interactive Visual Attack Graph (Bản đồ Tác chiến Tấn công)
- **Mục tiêu:** Giúp Analyst hình dung trực quan và toàn diện con đường tấn công của hacker (Lateral Movement) qua các thực thể mạng.
- **Input:** Dữ liệu quan hệ giữa Alerts, Observables (IP, Host, User, Hash), và các Cases có liên quan.
- **Output nguyện vọng:** Bản đồ mạng tương tác 2D/3D trực quan biểu diễn mối quan hệ giữa các thực thể và các kỹ thuật tấn công MITRE ATT&CK.
- **Subtasks:**
  - `[ ]` Tích hợp thư viện React Flow hoặc D3.js vào giao diện Next.js.
  - `[ ]` Thiết kế các Node thực thể (Case, Alert, IP, User, File MD5) và các Edge (hướng tấn công, liên kết tương đồng).
  - `[ ]` Cho phép Analyst kéo thả thực thể, nhấn đúp chuột để pivot/truy vết nhanh các Observable liên quan.
