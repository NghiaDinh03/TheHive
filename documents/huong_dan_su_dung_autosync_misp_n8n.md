# Hướng Dẫn Sử Dụng: Tự Động Đồng Bộ IOC Sang MISP & Hệ Thống API Bảo Mật Cho n8n

Tài liệu này hướng dẫn chi tiết cách vận hành, cấu hình và sử dụng hai tính năng tích hợp tự động hóa cốt lõi trên nền tảng **NCS Fusion Center**:
1. **Tự động Đồng bộ hóa dữ liệu độc hại (IOC) sang máy chủ MISP độc lập**.
2. **Hệ thống API bảo mật dành riêng cho n8n** để kết nối, giám sát và quản lý các sự cố bảo mật từ nguồn bên ngoài.

---

## 1. Tính Năng Tự Động Đồng Bộ IOC Sang MISP

### 1.1 Nguyên Lý Hoạt Động & Điều Kiện Kích Hoạt
Hệ thống **NCS Fusion Center** được trang bị một cơ chế chạy ngầm (Goroutine) tự động theo dõi các hoạt động tạo mới hoặc cập nhật để đẩy trực tiếp các chỉ số độc hại (IOC) sang hệ thống lưu trữ MISP độc lập chạy standalone. 

Một Case (Sự cố) sẽ được tự động kích hoạt cơ chế đồng bộ sang MISP khi và chỉ khi thỏa mãn **đồng thời hai điều kiện** sau:

1. **Case thuộc loại Sự cố (Incident):**
   - Cột **Khẩn cấp** (`flag`) của Case được đánh dấu là `true`.
   - **Hoặc** Case chứa ít nhất một Thẻ (Tag) có nội dung chứa chữ `"incident"`, `"sự cố"`, hoặc `"su co"` (Không phân biệt chữ hoa, chữ thường. Ví dụ: `Incident`, `incident`, `sự cố`, `SỰ CỐ`, `su co`).
2. **Case có chứa dữ liệu độc hại (IOC):**
   - Có ít nhất một Observable trong Case có thuộc tính **IOC** (`ioc = true`).

### 1.2 Luồng Đồng Bộ Ngầm (Background Auto-Sync)
- Mỗi khi Analyst thêm mới, chỉnh sửa Case, hoặc thêm mới/chỉnh sửa một Observable và chuyển thuộc tính của nó thành `ioc = true`:
  - Hệ thống sẽ kích hoạt một Goroutine chạy ngầm độc lập với tiến trình chính, đảm bảo không làm gián đoạn hay ảnh hưởng tới trải nghiệm của người dùng trên UI.
  - Goroutine này sẽ quét và lấy máy chủ MISP đầu tiên được kích hoạt (`enabled = true` và mục đích sử dụng không phải là `ImportOnly`).
  - Toàn bộ các IOC của Case đó sẽ được đóng gói và xuất khẩu sang MISP thành một Event tương ứng dưới dạng sự cố bảo mật.
  - Kết quả đồng bộ (Thành công hay Thất bại kèm lý do lỗi chi tiết) được tự động ghi nhận vào bảng nhật ký hệ thống `misp_sync_log`.

---

## 2. Hướng Dẫn Sử Dụng Trên Giao Diện UI/UX

Để giúp các Analyst có toàn quyền kiểm soát và dễ dàng vận hành, nền tảng hỗ trợ các chức năng tương tác trực quan sau:

### 2.1 Trigger Đồng Bộ Thủ Công Tại Chi Tiết Case
Khi truy cập vào chi tiết một Case bất kỳ:
1. Nhấp chọn tab **Observables** (Nơi quản lý tất cả các chỉ số kỹ thuật).
2. Kế bên nút *New observable(s)*, Analyst sẽ thấy nút **Đồng bộ MISP** (MISP Sync).
3. Nhấp vào nút này, hệ thống sẽ gửi yêu cầu kích hoạt đồng bộ hóa toàn bộ IOC của Case này sang MISP ngay lập tức.
4. Khi quá trình kích hoạt thành công, một hộp thoại thông báo trực quan sẽ hiển thị: *"Đã kích hoạt đồng bộ hóa IOC sang MISP trong nền thành công!"*.

### 2.2 Trigger Đồng Bộ Thủ Công Tại Chi Tiết Observable
Khi Analyst kiểm tra chi tiết một Observable cụ thể:
1. Ở bảng điều khiển bên phải (**Flags & tags**), Analyst sẽ thấy nút **Đồng bộ MISP** màu xanh dương đậm rất thẩm mỹ, được gắn nhãn `Manual` chuyên nghiệp.
2. Nút này chỉ khả dụng khi Observable thuộc về một Case và Analyst có quyền tương tác.
3. Khi click vào nút này:
   - Icon xoay thể hiện tiến trình kích hoạt đồng bộ.
   - Một nhãn thông báo nhanh màu xanh dương dịu sẽ xuất hiện ngay dưới nút: *"Đã kích hoạt đồng bộ hóa IOC sang MISP thành công!"* và tự động ẩn đi sau 5 giây để giao diện gọn gàng.

---

## 3. Hệ Thống API Bảo Mật Cho n8n (Integrations API)

Hệ thống API dành cho n8n được thiết kế tại nhóm đường dẫn độc lập `/api/v1/n8n/*`. API này sử dụng cơ chế xác thực vô cùng bảo mật và có hiệu năng cao.

### 3.1 Cơ Chế Xác Thực API Key
Nền tảng sử dụng xác thực API Key tĩnh để n8n hoặc các công cụ tự động hóa gọi vào hệ thống:
- Khi gửi request, n8n cần đính kèm API Key thông qua một trong các phương thức sau:
  - Header: `X-API-Key: <your_api_key_here>`
  - Header: `Authorization: Bearer <your_api_key_here>`
  - Query Parameter: `?api_key=<your_api_key_here>`
- Hệ thống sẽ lấy mã băm SHA-256 của API Key đầu vào và đối chiếu trực tiếp với bảng dữ liệu bảo mật `api_keys` để định danh tài khoản người dùng, đồng thời tự động nạp các quyền tương ứng giúp bảo mật tối đa.

---

### 3.2 Chi Tiết Các API Endpoints

#### 1. Tạo Case Mới Kèm Observables/IOCs
- **Đường dẫn:** `POST /api/v1/n8n/cases`
- **Chức năng:** Tạo mới một Case sự cố và có thể tùy chọn đính kèm ngay danh sách các chỉ số IOC đi kèm. Hệ thống sẽ tự động kích hoạt đồng bộ sang MISP sau khi tạo thành công nếu Case thỏa mãn điều kiện Incident.
- **Request Body mẫu (JSON):**
```json
{
  "title": "[n8n] Phát hiện rò rỉ thông tin đăng nhập người dùng",
  "description": "Hệ thống giám sát phát hiện tài khoản admin@ncs.com.vn có hoạt động đăng nhập đáng ngờ từ dải IP lạ.",
  "severity": 3,
  "tlp": 3,
  "pap": 2,
  "flag": true,
  "tags": ["incident", "phishing", "leak"],
  "observables": [
    {
      "data_type": "ip",
      "data": "103.28.12.94",
      "ioc": true,
      "message": "IP tấn công Brute-force rò rỉ",
      "tags": ["attacker", "brute-force"]
    },
    {
      "data_type": "mail",
      "data": "admin@ncs.com.vn",
      "ioc": false,
      "message": "Tài khoản nạn nhân",
      "tags": ["victim"]
    }
  ]
}
```
- **Response mẫu (JSON - HTTP 201):**
```json
{
  "id": "8c59bd02-c94b-4b16-bb7e-399fa51829e1",
  "number": 1042,
  "title": "[n8n] Phát hiện rò rỉ thông tin đăng nhập người dùng",
  "status": "Open",
  "observables_added": 2
}
```

#### 2. Thêm Observables/IOCs Vào Case Sẵn Có
- **Đường dẫn:** `POST /api/v1/n8n/cases/:id/observables`
- **Chức năng:** Thêm nhanh một hoặc nhiều chỉ số kỹ thuật độc hại (IOC) vào một Case đã tồn tại bằng cách truyền Case ID trên URL.
- **Request Body mẫu (JSON):**
```json
{
  "observables": [
    {
      "data_type": "domain",
      "data": "evil-domain-phishing.com",
      "ioc": true,
      "message": "Domain máy chủ C2 điều khiển độc hại",
      "tags": ["c2", "malicious"]
    }
  ]
}
```
- **Response mẫu (JSON - HTTP 200):**
```json
{
  "case_id": "8c59bd02-c94b-4b16-bb7e-399fa51829e1",
  "observables_added": 1,
  "ids": [
    "fa89cb01-d85c-4d56-b09e-711fa21932a3"
  ]
}
```

#### 3. Kích Hoạt Đồng Bộ MISP Khẩn Cấp
- **Đường dẫn:** `POST /api/v1/n8n/cases/:id/sync-misp`
- **Chức năng:** Ép buộc hệ thống thực hiện đồng bộ khẩn cấp toàn bộ các IOC hiện tại của Case được chỉ định sang máy chủ MISP đang hoạt động ngay lập tức.
- **Response mẫu (JSON - HTTP 200):**
```json
{
  "case_id": "8c59bd02-c94b-4b16-bb7e-399fa51829e1",
  "status": "triggered",
  "message": "Đã kích hoạt đồng bộ hóa IOC sang máy chủ MISP trong nền."
}
```

#### 4. Lấy Danh Sách Các Case Sự Cố
- **Đường dẫn:** `GET /api/v1/n8n/cases`
- **Chức năng:** Hỗ trợ n8n truy vấn, kiểm tra danh sách 50 Case mới nhất để giám sát hoặc chạy định kỳ (cron jobs). Có thể lọc thông tin dễ dàng qua query parameters.
- **Query Parameters hỗ trợ:**
  - `status`: Lọc trạng thái Case (ví dụ: `Open`, `Resolved`).
  - `tag`: Lọc theo Thẻ cụ thể (ví dụ: `incident`).
- **Response mẫu (JSON - HTTP 200):**
```json
[
  {
    "id": "8c59bd02-c94b-4b16-bb7e-399fa51829e1",
    "number": 1042,
    "title": "[n8n] Phát hiện rò rỉ thông tin đăng nhập người dùng",
    "description": "Hệ thống giám sát phát hiện tài khoản admin@ncs.com.vn có hoạt động đăng nhập đáng ngờ từ dải IP lạ.",
    "severity": 3,
    "tlp": 3,
    "pap": 2,
    "status": "Open",
    "owner": "admin",
    "assignee": "",
    "tags": ["incident", "phishing", "leak"],
    "flag": true,
    "created_at": "2026-05-21T20:00:00Z"
  }
]
```
