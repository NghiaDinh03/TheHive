# NCS Fusion Center — Tactical SOC Workstation Login Design

Tài liệu này lưu trữ toàn bộ thông tin chi tiết về các thành phần tùy biến (UI/UX) và kiến trúc an ninh nâng cấp (Security Engineering) đã được thiết kế và triển khai hoàn tất cho trang Đăng nhập của nền tảng **NCS Fusion Center**.

---

## 🎨 1. Thiết kế Giao diện (UI/UX Customization)

Giao diện trang Đăng nhập được thiết kế theo phong cách **Thiết bị giám sát SOC bọc thép (Tactical SOC Workstation Card)**, đảm bảo tính đầm, có khối rõ rệt, nổi bật trên nền lưới kỹ thuật (Tech Grid) nhưng hoàn toàn tuân thủ tiêu chí dịu mắt và không chói sáng.

### Thành phần Khung đăng nhập (`.ncs-login-card`)
- **Kích thước**: Mở rộng chiều rộng tối đa (`max-width`) lên **`460px`** giúp bố cục thông thoáng, tăng độ dễ đọc cho người dùng.
- **Màu nền**: Sử dụng gam màu đen than đặc nguyên khối (`#090d16`) cho cảm giác đầm chắc và có chiều sâu cơ khí.
- **Dải viền trên (Top border Plate)**: Điểm nhấn viền trên dày **`4px solid #2563eb`** màu xanh công nghệ hoàng gia, mô phỏng khe cắm server SOC đang hoạt động tích cực.
- **Khung viền công nghiệp (Industrial Frame)**: Viền xung quanh dày **`2px solid #1e293b`** màu xám thép Slate-800 định hình ranh giới cực kỳ rõ ràng.
- **Bóng đổ hào quang phát quang (Atmospheric Blue Halo Drop Shadow)**:
  - Tích hợp bóng đổ quầng sáng xanh dương trầm tỏa rộng:
    ```css
    box-shadow: 
      0 30px 60px rgba(0, 0, 0, 0.95), 
      0 0 45px rgba(37, 99, 235, 0.25) !important;
    ```
  - Quầng sáng này giúp phân tách hoàn hảo ranh giới giữa card đăng nhập và màu nền lưới tối của trang, tạo sự dễ chịu tối đa cho mắt của nhà phân tích.
- **Bo góc (Rounded Corners)**: Tinh chỉnh góc bo tròn **`12px`** tạo các góc cạnh cứng cáp, mạnh mẽ.
- **Đệm lót (Paddings)**: Phần đầu (`32px`), phần thân (`36px`), khoảng cách giữa các phần tử biểu mẫu (`gap: 18px`).

### Thành phần Nhập liệu (`.ncs-input-wrap input`)
- **Màu nền**: Màu đen tuyền tuyệt đối (`#04070f`) tăng độ tương phản của chữ trắng.
- **Đường viền**: Viền Slate-700 chắc chắn (`#334155`).
- **Trạng thái Focus**: Chuyển sang viền xanh Cobalt rực rỡ (`#3b82f6`) cùng hiệu ứng hào quang mỏng (`rgba(59, 130, 246, 0.15)`) tạo tính tương tác cao.
- **Placeholder**: Chuẩn hóa tiếng Anh hoàn toàn thành `username@ncsgroup.vn` thay vì tiếng Việt pha tạp.

### Thành phần Tương tác UX
- **Ẩn/Hiện mật khẩu (Show/Hide Password)**: Nút Visibility tích hợp biểu tượng Eye/EyeOff đặt khéo léo ở góc phải của input password, căn chỉnh padding hoàn hảo chống tràn text.
- **Spinner xử lý trực quan (Loading State)**: Biểu tượng vòng xoay hoạt họa dạng SVG xuất hiện ngay trên nút primary Sign in khi đang gửi API. Các trường nhập liệu tự động bị khóa (`disabled`) để chống gửi đúp dữ liệu.

---

## 🔒 2. Kiến trúc An ninh (Security Engineering)

Bên cạnh giao diện đỉnh cao, trang Đăng nhập được gia cố bằng hệ thống phòng thủ đa lớp SOC-grade bảo vệ phiên làm việc và tài khoản.

### Chuyển đổi HttpOnly Cookie Storage
- **Lưu trữ an toàn**: JWT token sau khi xác thực thành công sẽ được Go server thiết lập trực tiếp vào cookie trình duyệt `thehive_token` với các cờ `HttpOnly`, `Secure` và `SameSite=Lax`. Cơ chế này loại bỏ hoàn toàn nguy cơ bị tấn công XSS đánh cắp phiên.
- **Ngăn ngừa Session Fixation**: Tự động xóa sạch toàn bộ token cũ trong `localStorage`/`sessionStorage` và gửi lệnh logout giải phóng cookie cũ ngay khi người dùng truy cập trang Đăng nhập.
- **Xác thực lai (Hybrid Authenticator)**: Middleware xác thực tại backend tự động kiểm tra token trong Cookie trước, nếu trống mới fallback qua `Authorization: Bearer <token>` header để duy trì tính tương thích 100% với các test suite và API client bên ngoài.

### Chống dò quét Brute Force & Rate Limiting
- **Rate Limiting**: Hạn chế tần suất gọi API đăng nhập thông qua middleware RateLimiter (10 yêu cầu/5 phút, khóa 15 phút).
- **Khóa tài khoản tạm thời (Account Lockout)**: Tự động khóa tài khoản tạm thời **15 phút** (`locked_until`) sau 5 lần nhập sai mật khẩu liên tiếp.
- **Tự động đặt lại**: Hệ thống đặt lại số lần thử sai về 0 sau khi khóa để người dùng có thể thử lại sau khi hết thời gian khóa.
- **Đếm ngược thời gian khóa**: Trả về thông báo lỗi dạng JSON hiển thị thời gian đếm ngược thực tế (ví dụ: `Account is temporarily locked. Please try again in 14m30s`).

### Chống chiếm quyền Phiên (Session Hijacking Protection)
- **Vân tay trình duyệt**: Lưu vết chính xác IP Client (`ip_address`) và chuỗi `User-Agent` của trình duyệt vào bảng `auth_sessions` qua Migration `000048_session_fingerprint.up.sql`.
- **Đối khớp Signature**: Middleware xác thực thực hiện đối so khớp chuỗi `User-Agent` của mỗi request với phiên đăng ký gốc. Bất kỳ sự sai khác nào sẽ lập tức bị hủy bỏ phiên làm việc.

---

## 📂 3. Cấu trúc Tệp tin Liên quan

Mọi thành phần của thiết kế này được phân bổ đúng cấu trúc tiêu chuẩn để dễ dàng bảo trì và mở rộng:

1. **Giao diện & Cấu trúc Form**:
   - [page.tsx](file:///e:/VSC/TheHive/platform/frontend/src/app/login/page.tsx)
2. **Kiểu dáng & Bóng đổ**:
   - [globals.css](file:///e:/VSC/TheHive/platform/frontend/src/styles/globals.css) (Dòng 3785-3840 & 3896-3914)
3. **Thư viện API client**:
   - [api.ts](file:///e:/VSC/TheHive/platform/frontend/src/lib/api.ts)
4. **Backend Authentication & Lockout**:
   - [auth.go](file:///e:/VSC/TheHive/platform/backend/internal/handler/auth.go)
5. **Middleware Xác thực & Fingerprint**:
   - [middleware.go](file:///e:/VSC/TheHive/platform/backend/internal/server/middleware.go)
6. **Cấu trúc Database (Migration)**:
   - [000048_session_fingerprint.up.sql](file:///e:/VSC/TheHive/platform/backend/migrations/000048_session_fingerprint.up.sql)
   - [000048_session_fingerprint.down.sql](file:///e:/VSC/TheHive/platform/backend/migrations/000048_session_fingerprint.down.sql)
