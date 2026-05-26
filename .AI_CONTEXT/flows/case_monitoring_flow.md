# Quy trình xử lý (Workflow) & Phân quyền (RBAC) trên TheHive

Tài liệu này mô tả chi tiết quy trình xử lý luồng công việc của nền tảng TheHive được tinh chỉnh cho NCS Fusion Center, cũng như chi tiết về các nhóm quyền hạn của người dùng.

## 1. Cấu trúc Tổ chức (Organisations)

Nền tảng được thiết kế cho mô hình SOC (Security Operations Center) phục vụ nhiều khách hàng (Multi-tenancy). Các tổ chức hiện tại bao gồm:

- **NCSGroup**: Tổ chức chủ quản SOC (Admin). Những người dùng thuộc tổ chức này có quyền quản lý toàn bộ hệ thống hoặc quản lý luồng xử lý chính.
- **PVO** (và các tổ chức khách hàng khác): Tổ chức khách hàng thuê dịch vụ SOC.

## 2. Các Vai trò & Nhóm quyền (Profiles)

Dựa trên nguyên tắc đặc quyền tối thiểu (Least Privilege), hệ thống thiết lập 3 Profile chính:

### 2.1. Super Admin (`admin`)
- **Mô tả**: Người quản trị toàn quyền của hệ thống.
- **Phân quyền**:
  - `managePlatform`: Quản lý toàn bộ cấu hình hệ thống, tạo mới Organisation, tạo mới Profile.
  - Được phép can thiệp vào tất cả các Case/Alert của mọi Organisation.
- **Tài khoản mặc định**: `ncs_admin@ncsgroup.vn`

### 2.2. Quản trị viên Tổ chức (`org-admin`)
- **Mô tả**: Quản lý cấp cao của một tổ chức (ví dụ SOC Manager của NCS hoặc Trưởng phòng IT của PVO).
- **Phân quyền**:
  - Không có quyền `managePlatform` (Không thể sửa hệ thống lõi hay tạo Profile/Organisation mới).
  - Có quyền quản lý (CRUD) đối với User thuộc Tổ chức của mình.
  - Quản lý toàn bộ Case, Task, Alert, Observable, Tag, CustomField, Dashboard liên quan đến Tổ chức của mình.
- **Tài khoản ví dụ**: 
  - `nghia.dinh@ncsgroup.vn` (SOC Manager tại NCS)
  - `dat.tran@pvo.com.vn` (IT Manager tại PVO)

### 2.3. Chuyên viên phân tích (`analyst`)
- **Mô tả**: Chuyên viên vận hành SOC (Tier 1/Tier 2) thực hiện điều tra và xử lý sự cố.
- **Phân quyền**:
  - Chỉ có quyền làm việc trên Case, Alert, Observable, Task.
  - Không thể thêm/sửa User, không thể đổi cấu hình hệ thống.

### 2.4. Khách hàng (`client`)
- **Mô tả**: Người dùng cuối của tổ chức khách hàng, vào hệ thống để theo dõi tiến độ sự cố do NCS xử lý.
- **Phân quyền**:
  - Read-only (chỉ xem) đối với các Case được NCS chia sẻ (Share) cho tổ chức của họ.
  - Có thể thực hiện comment (Log) trên các Task cụ thể để trao đổi với NCS.

---

## 3. Luồng xử lý sự cố tiêu chuẩn (Incident Response Flow)

Quy trình xử lý một sự cố hoặc cảnh báo trên hệ thống tuân theo các bước logic và chặt chẽ, tối ưu cho việc tự động hóa thông qua Cortex và chia sẻ tri thức qua MISP:

### Bước 1: Phát hiện & Tiếp nhận (Alerting)
- Các hệ thống SIEM/EDR, hoặc người dùng đẩy cảnh báo (Alert) về TheHive thông qua API.
- Alert mặc định ở trạng thái `New`. Cảnh báo sẽ tự động gắn các tag (ví dụ: `malware`, `phishing`) và TLP/PAP tương ứng.

### Bước 2: Phân loại (Triage)
- Chuyên viên SOC (`analyst` của NCSGroup) xem xét Alert thông qua giao diện Alert Management.
- Nếu là **False Positive** (Cảnh báo giả): Đánh dấu `Ignored`.
- Nếu là **True Positive** (Sự cố thật): Chuyển Alert thành Case mới (Import) hoặc gộp (Merge) vào một Case đang có sẵn để tránh trùng lặp điều tra.
- *Lưu ý:* Khi Import thành Case, các thông số của Alert (Artifacts/Observables) sẽ tự động được chuyển hóa thành Observables của Case.

### Bước 3: Thu thập Chứng cứ (Evidence & Observables)
- Khởi tạo Case với các trạng thái chuyên dụng (Status):
  - **False positive**: Sự cố do máy tự sinh ra hoặc process noise (nhiễu). Trạng thái này tương đương với việc Đóng Case (Close).
  - **True positive**: Hành vi tấn công/vi phạm do người dùng (hoặc hacker) thực sự thực hiện. Trạng thái này tương đương với Đóng Case (Close) sau khi xử lý xong.
  - **Need confirm**: Khi SOC cần Khách Hàng (KH) vào đọc task, comment xác nhận trước khi hành động. Trạng thái này giữ Case ở dạng Mở (Open).
  - **Incidents**: Khi KH phản hồi "Need confirm" rằng hành vi này họ KHÔNG thực hiện (Xác nhận là sự cố thật). Trạng thái này giữ Case ở dạng Mở (Open) để tiếp tục điều tra sâu.
  - *(Ghi chú: Analyst có thể chuyển đổi linh hoạt giữa các trạng thái này bất cứ lúc nào, mọi thay đổi đều được ghi lại trong History/Audit Trail)*.
- `analyst` tiến hành thêm các IOC (Indicators of Compromise) vào hệ thống dưới dạng Observables (IP, Hash, Domain, URL, File, v.v.).
- Quản lý IOC (Observables Lifecycle):
  - **Deduplication**: Nền tảng tự động quét và đánh dấu (Sighted) nếu IOC này đã từng xuất hiện ở Case khác.
  - **Tích hợp Cortex (Analyzers)**: `analyst` có thể bấm nút chạy Cortex Analyzer trực tiếp trên từng Observable (VD: VirusTotal quét Hash, IPInfo quét IP). Kết quả (Report) sẽ trả về và hiển thị ngay trên UI của TheHive để phân tích nhanh.

### Bước 4: Xử lý & Khắc phục (Containment & Remediation)
- Hệ thống có thể tự động sinh các **Tasks** dựa trên Case Template (ví dụ: "Phân tích file mã độc", "Chặn IP trên Firewall", "Reset Password người dùng").
- Mỗi Task có thể được giao (Assign) cho một chuyên viên cụ thể.
- Quá trình thực hiện Task:
  - `analyst` cập nhật tiến độ, tạo các **Logs** để ghi nhận từng bước thao tác.
  - Có thể đính kèm bằng chứng (Attachments/Screenshots) vào Logs.
- **Tích hợp Cortex (Responders)**: `analyst` có thể gọi Cortex Responders để thực hiện Auto-Remediation (Ví dụ: Ra lệnh cho Firewall block IP ngay lập tức từ giao diện TheHive).

### Bước 5: Chia sẻ & Phối hợp Khách hàng (Collaboration & MISP)
- **Với Khách hàng (PVO)**: 
  - Nếu sự cố ảnh hưởng đến PVO, `org-admin` thực hiện **Share Case** (với quyền Observer) cho tổ chức PVO.
  - Tài khoản của PVO (`dat.tran`) có thể vào xem Dashboard, xem tiến trình Case, và đọc các Log công khai. PVO có thể comment trực tiếp vào Task Log để tương tác với đội SOC.
- **Với Cộng đồng / Threat Intel (MISP)**:
  - Các IOC độc hại (True Positive) sẽ được Export sang hệ thống **MISP** thông qua MISP Adapter tích hợp sẵn. Điều này giúp chia sẻ tri thức về mối đe dọa (Threat Intel) ra toàn bộ hạ tầng bảo mật.

### Bước 6: Đóng ca & Báo cáo (Closure & Audit)
- Sau khi khắc phục xong toàn bộ sự cố và đóng tất cả Tasks, `analyst` sẽ chuyển trạng thái Case sang **True positive** hoặc **False positive** để Đóng Case.
- Cập nhật thông tin Resolution (Ví dụ: mô tả cách giải quyết) và đánh giá lại TLP/PAP.
- Nền tảng tự động lưu lại toàn bộ History/Audit Trail của vòng đời xử lý để phục vụ cho các quy định tuân thủ bảo mật và báo cáo SLA.

## 4. Quy định về Giao diện & Hiển thị (UI/UX)
- Các tài khoản khi đăng nhập sẽ chỉ nhìn thấy dữ liệu thuộc Tổ chức của mình thông qua cơ chế Row-Level Security ở Backend API.
- Các nút bấm thao tác nâng cao (Tạo Case, Xóa, Chạy Cortex) sẽ bị vô hiệu hóa (`.ncs-disabled`) trên UI nếu User không có quyền thực thi.
- Giao diện Dark Theme đồng nhất với màu xanh chủ đạo (NCS Fusion), thiết kế tối giản, tập trung vào hiệu suất cho môi trường SOC hoạt động 24/7.
