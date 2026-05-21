# MISP Standalone — Tự Cấu Hình & Tự Chạy Lưu Trữ IOC

Thư mục này chứa cấu hình Docker Compose độc lập để chạy **MISP (Malware Information Sharing Platform)**. Hệ thống được thiết kế để tự cấu hình, tự chạy độc lập, giúp các nền tảng tự động hóa như **n8n** có thể gửi request API trực tiếp đến để lưu trữ, truy vấn và quản lý các chỉ số độc hại (IOC - Indicators of Compromise).

---

## 🚀 Hướng Dẫn Khởi Chạy Nhanh

Anh chỉ cần di chuyển vào thư mục này và chạy lệnh duy nhất để khởi động toàn bộ stack (MISP Web, MariaDB, Redis):

```powershell
# Di chuyển vào thư mục misp-standalone
cd e:\VSC\TheHive\platform\misp-standalone

# Khởi chạy stack ở chế độ background
docker compose up -d
```

Sau khi chạy lệnh, hãy đợi khoảng 1-2 phút để MariaDB khởi tạo dữ liệu và MISP Web hoàn tất cấu hình ban đầu.

---

## 🌐 Truy Cập Giao Diện MISP

- **HTTP Link:** [http://localhost:8081](http://localhost:8081)
- **HTTPS Link:** [https://localhost:8443](https://localhost:8443) (Sẽ xuất hiện cảnh báo SSL tự ký, anh bấm *Advanced -> Proceed* để tiếp tục).
- **Tài khoản quản trị mặc định (Admin):**
  - **Email:** `admin@misp.local`
  - **Mật khẩu:** `admin-misp-secret-123`

*(Lưu ý: Trong lần đăng nhập đầu tiên, MISP sẽ yêu cầu anh thay đổi mật khẩu mặc định này để đảm bảo an toàn).*

---

## 🔌 Tích Hợp n8n & Lấy API Key để Lưu Trữ IOC

Để n8n có thể request gửi IOC (IP, Domain, Hash, URL) vào MISP:

1. **Lấy API Key từ MISP:**
   - Đăng nhập vào MISP bằng tài khoản Admin.
   - Truy cập **Global Actions** -> **My Profile**.
   - Bấm vào tab **Auth keys** và chọn **Add authentication key**.
   - Điền mô tả (ví dụ: `n8n Connector`) và bấm **Generate**.
   - **Lưu lại Auth Key** vừa tạo (key này sẽ không hiển thị lại lần thứ hai).

2. **Cấu hình trên n8n:**
   - Sử dụng node **HTTP Request** trên n8n.
   - **URL:** `http://localhost:8081/events/add` (để tạo Event mới chứa các IOC) hoặc `http://localhost:8081/attributes/add` (để append IOC vào Event có sẵn).
   - **Headers:**
     - `Authorization`: Điền Auth Key anh vừa lấy ở trên.
     - `Accept`: `application/json`
     - `Content-Type`: `application/json`
   - **Method:** `POST`
   - **Body JSON** mẫu để đẩy IP độc hại vào MISP:
     ```json
     {
       "Event": {
         "info": "IOCs detected from n8n pipeline",
         "threat_level_id": "3",
         "analysis": "1",
         "distribution": "0",
         "Attribute": [
           {
             "type": "ip-dst",
             "value": "8.8.8.8",
             "comment": "Malicious IP detected by SOC"
           }
         ]
       }
     }
     ```

---

## 🛠️ Các Lệnh Quản Trị Khác

```powershell
# Xem logs thời gian thực của MISP Web
docker compose logs -f misp-web

# Dừng hệ thống
docker compose down

# Dừng và xóa toàn bộ dữ liệu (Reset sạch sẽ)
docker compose down -v
```
