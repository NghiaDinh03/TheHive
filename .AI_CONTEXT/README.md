# 🧭 NCS FUSION CENTER — CẨM NANG BỘ NHỚ AGENT (AGENT MEMORY INDEX)

Chào mừng bạn, **AI Coding Agent**, đến với dự án **NCS Fusion Center**! 
Tài liệu này đóng vai trò là "bản đồ dẫn lối" và tóm tắt bối cảnh nhanh giúp bạn nắm bắt 100% tình trạng dự án, kiến trúc và quy chuẩn phát triển ngay khi bắt đầu một phiên làm việc mới.

---

## 🏗️ 1. TỔNG QUAN DỰ ÁN (PROJECT OVERVIEW)

**NCS Fusion Center** là nền tảng quản lý, giám sát và phản ứng sự cố an toàn thông tin chuyên dụng dành cho các doanh nghiệp và trung tâm SOC (Security Operations Center) tại Việt Nam.

*   **Technology Stack (Kiến trúc công nghệ):**
    *   **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Hệ thống thiết kế **Microsoft Fluent UI (NCS Corporate Theme)** tối ưu hóa cho trực ca ca đêm 12 tiếng.
    *   **Backend:** Golang REST API (Handler → Repository → DB layer separation).
    *   **Databases:** PostgreSQL (lưu trữ quan hệ & schema chính) + OpenSearch (lưu trữ & tìm kiếm log tốc độ cao).
    *   **Broker & Storage:** RabbitMQ (quản lý outbox/event queue) + MinIO S3 (lưu tệp đính kèm mã hóa tĩnh AES-256).
    *   **SOAR & Automation:** Tách biệt độc lập các playbooks của **n8n Webhook** kết hợp bộ xác thực **2FA / OTP** trên UI trước khi trigger các thao tác cô lập nguy hiểm.
    *   **CyberAI (Local AI):** FastAPI backend gọi **Local LLM Gemma 4 (31B)** lượng tử hóa offline 100%, tích hợp bộ lọc **Prompt Injection Sanitizer** từ Go backend, bảo đảm an toàn dữ liệu tuyệt đối (Zero Cloud Leaks).

---

## 📂 2. BẢN ĐỒ THƯ MỤC BỘ NHỚ (MEMORY MAP)

Thư mục `.AI_CONTEXT/` được quy hoạch khoa học thành các thư mục con logic để tránh lộn xộn và dễ dàng tra cứu:

### 💎 A. Quy chuẩn & Bối cảnh cốt lõi (`.AI_CONTEXT/core/`)
*   **[MASTER_PROMPT.md](file:///e:/VSC/TheHive/.AI_CONTEXT/core/MASTER_PROMPT.md):** Định hình hành vi phản hồi, phong cách code và quy tắc ứng xử của Agent.
*   **[CODING_GUIDELINES.md](file:///e:/VSC/TheHive/.AI_CONTEXT/core/CODING_GUIDELINES.md):** Quy định thiết kế hệ thống, cấu trúc database, logic nghiệp vụ và quy tắc code sạch (clean code).
*   **[UI_UX_GUIDELINES.md](file:///e:/VSC/TheHive/.AI_CONTEXT/core/UI_UX_GUIDELINES.md):** Hướng dẫn chi tiết hệ thống thiết kế **Microsoft Fluent UI** (tokens màu Navy sâu `#071022`, bo góc sharp `4px`/`6px`/`8px`, borderless tables, active edges, và bộ nhận diện Login).
*   **[CONTEXT.md](file:///e:/VSC/TheHive/.AI_CONTEXT/core/CONTEXT.md):** Bối cảnh lịch sử và mục tiêu re-platform từ TheHive 4 sang NCS Fusion Center.
*   **[STRUCTURE.md](file:///e:/VSC/TheHive/.AI_CONTEXT/core/STRUCTURE.md):** Bản đồ cấu trúc tệp mã nguồn và các route API thực tế.

### 🗺️ B. Kế hoạch & Lộ trình thực thi (`.AI_CONTEXT/plans/`)
*   **[MASTER_PLAN.md](file:///e:/VSC/TheHive/.AI_CONTEXT/plans/MASTER_PLAN.md):** Kế hoạch nâng cấp và tích hợp tổng thể.
*   **[COMPLETED_PLANS.md](file:///e:/VSC/TheHive/.AI_CONTEXT/plans/COMPLETED_PLANS.md):** Lịch sử các phase kế hoạch đã hoàn thành xuất sắc.
*   **[PENDING_PLANS.md](file:///e:/VSC/TheHive/.AI_CONTEXT/plans/PENDING_PLANS.md):** Các đầu việc, nâng cấp tính năng tồn đọng đang chờ thực hiện.
*   **[plan_fusion_center.md](file:///e:/VSC/TheHive/.AI_CONTEXT/plans/plan_fusion_center.md):** Kế hoạch cụ thể hóa SOC Workspace.
*   **[REVIEW_PLAN_vi.md](file:///e:/VSC/TheHive/.AI_CONTEXT/plans/REVIEW_PLAN_vi.md):** Kế hoạch đánh giá sâu tính năng.

### 🛡️ C. Đánh giá kỹ thuật chuyên sâu (`.AI_CONTEXT/reviews/`)
*   **[MIGRATION_ANALYSIS.md](file:///e:/VSC/TheHive/.AI_CONTEXT/reviews/MIGRATION_ANALYSIS.md):** Đánh giá tính chân thực, mức độ hoàn thiện so với TheHive 4 và các rủi ro.
*   **[SECURITY_HARDENING_REVIEW.md](file:///e:/VSC/TheHive/.AI_CONTEXT/reviews/SECURITY_HARDENING_REVIEW.md):** Rà soát an ninh hệ thống, gia cố dữ liệu, mã hóa tĩnh và thắt chặt RBAC.
*   **[PRODUCTION_READINESS_REVIEW.md](file:///e:/VSC/TheHive/.AI_CONTEXT/reviews/PRODUCTION_READINESS_REVIEW.md):** Rà soát khả năng chịu tải và mức độ sẵn sàng go-live.
*   **[FUSION_CENTER_DEEP_ASSESSMENT.md](file:///e:/VSC/TheHive/.AI_CONTEXT/reviews/FUSION_CENTER_DEEP_ASSESSMENT.md):** Đánh giá sâu và đề xuất thực tế cho SOC Fusion Center.

### 🔄 D. Quy trình nghiệp vụ & Flow Logic (`.AI_CONTEXT/flows/`)
*   **[admin_rbac_flow.md](file:///e:/VSC/TheHive/.AI_CONTEXT/flows/admin_rbac_flow.md):** Quy trình phân quyền RBAC và luồng phân cấp tài khoản.
*   **[case_monitoring_flow.md](file:///e:/VSC/TheHive/.AI_CONTEXT/flows/case_monitoring_flow.md):** Luồng giám sát, cảnh báo và tự động hóa xử lý case.

### 📜 E. Lịch sử phiên & Bộ nhớ chính (Root & `.AI_CONTEXT/history/`)
*   **[MEMORY.md](file:///e:/VSC/TheHive/.AI_CONTEXT/MEMORY.md):** **[QUAN TRỌNG NHẤT]** Tệp nhật ký append-only lưu trữ toàn bộ các mốc quyết định, bài học kinh nghiệm và session notes qua các thời kỳ ở ngay root.
*   **[history/walkthrough_v5.md](file:///e:/VSC/TheHive/.AI_CONTEXT/history/walkthrough_v5.md):** Walkthrough tổng kết đợt nâng cấp bảo mật và dynamic parser gần nhất.
*   **[history/session_2026-05-13.md](file:///e:/VSC/TheHive/.AI_CONTEXT/history/session_2026-05-13.md) & [history/session_2026-05-18.md](file:///e:/VSC/TheHive/.AI_CONTEXT/history/session_2026-05-18.md):** Chi tiết kỹ thuật của các session sửa lỗi build và gia cố 2FA.

---

## ⚡ 3. CHỈ DẪN KHI KHỞI ĐỘNG PHIÊN CHAT MỚI (FOR NEW AGENTS)

Khi bạn được khởi tạo trong một phiên chat mới, hãy thực hiện tuần tự các bước sau để nắm bắt bối cảnh ngay lập tức:

1.  **Bước 1:** Đọc phần cuối của tệp gốc [MEMORY.md](file:///e:/VSC/TheHive/.AI_CONTEXT/MEMORY.md) (các Session Notes gần nhất) để biết session trước vừa kết thúc ở đâu, đã làm được những gì và bài học kinh nghiệm (Lessons Learned) là gì.
2.  **Bước 2:** Đọc [UI_UX_GUIDELINES.md](file:///e:/VSC/TheHive/.AI_CONTEXT/core/UI_UX_GUIDELINES.md) và [CODING_GUIDELINES.md](file:///e:/VSC/TheHive/.AI_CONTEXT/core/CODING_GUIDELINES.md) để luôn tuân thủ đúng phong cách thiết kế Fluent UI và cấu trúc Go backend chuẩn SOC Enterprise.
3.  **Bước 3:** Kiểm tra trạng thái runtime qua lệnh `docker compose ps` để nắm chắc trạng thái các container trước khi sửa code.

**⚠️ RÀNG BUỘC TUÂN THỦ TUYỆT ĐỐI (NON-NEGOTIABLE):**
*   *Luôn sử dụng Tiếng Việt chuyên nghiệp để giao tiếp và lập trình các nhãn UI/UX phục vụ các SOC Analyst Việt Nam.*
*   *Tuyệt đối không thêm ghi chú, tag hay chú thích liên quan tới AI agent hoặc nguồn cụ thể trong source code.*
*   *Đóng khung panel/card, triệt tiêu border line trắng sáng, ưu tiên bo góc sharp workstation (`4px`/`6px`/`8px`).*
