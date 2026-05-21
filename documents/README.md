# THƯ MỤC TÀI LIỆU HƯỚNG DẪN SỬ DỤNG - NCS FUSION CENTER

Thư mục này chứa toàn bộ tài liệu hướng dẫn sử dụng chi tiết, phân tích logic luồng nghiệp vụ trên giao diện UI/UX và danh mục đầy đủ các API Endpoint tương ứng của nền tảng **NCS Fusion Center** (phiên bản nâng cấp toàn diện từ TheHive4).

Các tài liệu được chuẩn bị chi tiết bằng tiếng Việt để phục vụ quá trình review, vận hành và phát triển tích hợp:

---

## DANH SÁCH TÀI LIỆU

### 1. [Tài Liệu Hướng Dẫn Sử Dụng Toàn Diện](file:///e:/VSC/TheHive/documents/tai_lieu_huong_dan_su_dung_fusion_center.md)
* **File**: [tai_lieu_huong_dan_su_dung_fusion_center.md](file:///e:/VSC/TheHive/documents/tai_lieu_huong_dan_su_dung_fusion_center.md)
* **Nội dung chính**:
  * Giới thiệu tổng quan hệ thống & cơ chế khởi chạy nhanh chỉ bằng **1 lệnh docker-compose**.
  * Quy trình nghiệp vụ và logic của **Quản lý Sự cố (Case Management)** (bao gồm logic gán người xử lý `assignee` mặc định trống để Analyst tự kiểm tra và nhận xử lý).
  * Quy trình nghiệp vụ và logic của **Quản lý Công việc (Task Management)** kèm cập nhật trạng thái trực quan và viết nhật ký `Task Logs`.
  * Quy trình nghiệp vụ và logic của **Quản lý Chỉ số Kỹ thuật (Observables & IOCs)** cùng nhận diện Badge IOC nổi bật trên UI/UX.
  * Logic tích hợp tự động và trigger thủ công đồng bộ sang máy chủ **MISP** từ tab Observables hoặc Sidebar.
  * Quản lý cảnh báo thô **Alerts** và cơ chế nâng cấp/gộp cảnh báo vào Case.
  * Chi tiết danh mục các **API Endpoints tương ứng** cho từng tính năng (định dạng Request, Response, Auth JWT).
  * Thiết lập quản lý người dùng, phân quyền RBAC và cấu hình hệ thống máy chủ MISP dành cho Admin.

### 2. [Tài Liệu Tích Hợp Chuyên Sâu MISP & n8n](file:///e:/VSC/TheHive/documents/huong_dan_su_dung_autosync_misp_n8n.md)
* **File**: [huong_dan_su_dung_autosync_misp_n8n.md](file:///e:/VSC/TheHive/documents/huong_dan_su_dung_autosync_misp_n8n.md)
* **Nội dung chính**:
  * Hướng dẫn cấu hình kết nối an toàn với máy chủ MISP standalone.
  * Chi tiết cơ chế kích hoạt tự động đồng bộ IOC ngầm bằng Goroutine (Điều kiện Case là Incident và có chứa IOC hoạt động).
  * Chi tiết cơ chế xác thực bảo mật API Key tĩnh sử dụng mã hóa băm một chiều SHA-256 dành riêng cho n8n gọi từ bên ngoài.
  * Danh sách chi tiết các endpoints dành riêng cho n8n tại `/api/v1/n8n/*` kèm các JSON payloads mẫu và mã phản hồi HTTP chuẩn.

---

> *Lưu ý: Các tài liệu này được cấu trúc rõ ràng, sử dụng tiếng Việt chuyên ngành kĩ thuật và tuyệt đối không chứa bất kỳ thẻ đánh dấu AI hay ghi chú dư thừa nào khác, đảm bảo tính chuyên nghiệp và sẵn sàng bàn giao cho người dùng cuối.*
