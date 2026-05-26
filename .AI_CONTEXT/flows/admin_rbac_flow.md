# Luồng Logic: Quản trị Phân quyền (RBAC) và Tài khoản tại NCS Fusion Center

## 1. Cơ chế Phân quyền Động (Dynamic RBAC)
Khác với kiến trúc cũ (Hardcode Database), NCS Fusion Center sử dụng cơ chế Dynamic RBAC hoàn toàn thông qua Giao diện Quản trị (Admin Dashboard).

- **Tổ chức (Organisations):** Hệ thống được phân mảnh thành các Tenant độc lập. Mỗi Organisation có dữ liệu Case, Alert, Observable hoàn toàn cách ly với nhau. Master Admin có thể xem được toàn bộ.
- **Vai trò (Profiles):** Chứa danh sách các quyền hạn (`permissions`).
- **Người dùng (Users):** Mỗi user được gán vào 1 Organisation và 1 Profile.

## 2. Luồng thao tác trên Admin Dashboard

### 2.1 Quản lý Tổ chức (Organisation)
- **Ai có quyền?** Users có quyền `manageOrganisation` hoặc `managePlatform`.
- **Thao tác:** Thêm mới, Sửa tên/mô tả, Xóa.
- **Lưu ý Multi-tenant:** Khi một Tổ chức được tạo ra, mọi Case tạo bởi User của tổ chức này sẽ tự động được gán `organisation_ids` chứa ID của Tổ chức.

### 2.2 Quản lý Phân quyền (Profiles)
- **Ai có quyền?** Users có quyền `manageProfile` hoặc `managePlatform`.
- **Thao tác:** 
  - Tạo Profile mới với các Checkbox chia theo nhóm (Nghiệp vụ, Cấu hình, Quản trị).
  - Tích hợp Tooltip giải thích trực quan các quyền.
  - Sửa và Xóa Profile (Không thể xóa Profile `admin` mặc định).

### 2.3 Quản lý Người dùng (Users)
- **Ai có quyền?** Users có quyền `manageUser` hoặc `managePlatform`.
- **Thao tác:**
  - **Tạo mới:** Gán User vào một Organisation và Profile có sẵn. (API `GET /organisations` và `GET /profiles` sẽ tự động hiển thị dropdown list cho người có quyền `manageUser`).
  - **Duyệt (Approve):** Với các tài khoản Pending, Admin cần chọn Tổ chức và Profile để Approve, sau đó hệ thống sinh Invite Token gửi qua Email.
  - **Khóa/Mở khóa:** Tạm ngưng hoặc kích hoạt lại tài khoản.
  - **Reset Password:** Đặt lại mật khẩu tạm thời.

## 3. Luồng Bảo mật Backend (Multi-tenant Isolation)
- Ở Backend, Middleware `RequireAnyPermission` sẽ kiểm tra Token của User.
- Đối với API lấy danh sách Cases, Alerts, Observables, nếu User không có quyền `managePlatform` (Superadmin), Backend tự động inject điều kiện Filter SQL `organisation_ids` phải chứa tên Tổ chức của User.
- Do đó, dù dùng API cURL hay UI, dữ liệu luôn được cô lập an toàn.
