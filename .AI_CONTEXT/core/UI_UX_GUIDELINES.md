# NCS FUSION CENTER — PREMIUM FLUENT UI DESIGN SYSTEM & SPECIFICATIONS

Tài liệu này tổng hợp các tiêu chuẩn, best practices và specs thiết kế hiện đại của hệ thống thiết kế **Microsoft Fluent UI (NCS Corporate Theme)** làm cẩm nang hướng dẫn bắt buộc khi lập trình giao diện và logic hệ thống NCS Fusion Center.

---

## 💎 1. MICROSOFT FLUENT UI DESIGN SPECIFICATIONS (NCS CORPORATE BLUE)

Để đạt được giao diện phẳng, hiện đại, sắc sảo chuẩn SOC-grade Enterprise, hệ thống thiết kế sử dụng các CSS Variables và Tokens đồng bộ sau:

### A. Hệ thống màu sắc & Depth Tokens (Variables)
*   **Deep Corporate Navy (`--glass-bg`)**: `rgba(7, 16, 34, 0.96)` hoặc `#071022` — Màu xanh dương đậm của các màn hình chuyên dụng SOC tối ưu độ tương phản trực đêm.
*   **Accent Navy Surface (`--glass-surface`)**: `rgba(14, 30, 61, 0.75)` hoặc `#0e1e3d` — Bề mặt hộp card nổi bật nhẹ nhàng.
*   **Darkest Royal Navy (`--glass-panel`)**: `rgba(4, 9, 20, 0.98)` hoặc `#040914` — Nền các panel điều khiển trung tâm và sidebar siêu tối.
*   **Corporate Blue Border (`--glass-border`)**: `rgba(0, 120, 212, 0.28)` — Viền mảnh, tương phản cao màu xanh dương thương hiệu để định hình khung rõ ràng.
*   **Active Focus Blue Border (`--glass-border-strong`)**: `rgba(0, 120, 212, 0.65)` và `#0078d4` — Trạng thái active/focus của Fluent UI.
*   **Subtle Blue Hover (`--glass-hover`)**: `rgba(0, 120, 212, 0.12)` — Hiệu ứng hover dịu nhẹ, chuyên nghiệp.

### B. Cấu trúc Khung Sắc Sảo (Workstation-grade Sharp Layouts)
*   **Bo góc Sharp**: Tuyệt đối không sử dụng các bo góc quá tròn (`rounded-2xl` hay `0.75rem`/`0.875rem` của Glassmorphism cũ).
    - `6px` (`0.375rem`) cho **Cards/Widgets** thông thường.
    - `8px` (`0.5rem`) cho **Panels/Sidebar** lớn.
    - `4px` (`0.25rem`) cho **Form Inputs/Buttons/Dropdowns**.
*   **Fluent Flat Elevations (Shadows)**: Sử dụng đổ bóng flat, mịn màng có chiều sâu vừa phải:
    - Card: `0 2px 8px 0 rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)`
    - Panel: `0 4px 18px 0 rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)`
*   **Active Edge Accent (Hiệu ứng rìa động)**:
    - Khi hover qua các dòng bảng (`.glass-row:hover`), luôn áp dụng hiệu ứng vệt sáng điểm nhấn màu xanh dương ở rìa trái: `box-shadow: inset 3px 0 0 #0078d4 !important;`

### 💻 Mẫu Thẻ Fluent UI Card Chuẩn (Next.js & CSS):
```tsx
<div className="glass-card p-6 transition-all duration-150 hover:bg-slate-900/40">
  <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">Thông tin Giám sát</h3>
  <p className="text-xs text-slate-400 mt-2">Dữ liệu phân tích sự cố an toàn thông tin.</p>
</div>
```

---

## 👁️ 2. SOC-EYE ACCESSIBILITY (THIẾT KẾ DỊU MẮT & HIGH CONTRAST)

Để hỗ trợ kỹ sư SOC trực ca đêm (12 tiếng liên tục trước màn hình tối) đạt hiệu suất cao nhất:
*   **High Legibility (Độ tương phản cao)**: Chữ trắng/xám sáng hiển thị cực kỳ sắc nét trên phông nền tối (`#f8fafc` cho tiêu đề/nội dung quan trọng, `#94a3b8` cho chú thích). Chữ phải rõ ràng, không bị lu mờ bởi hiệu ứng trong suốt.
*   **Đơn Giản & Nét Vẽ Mỏng**: Sử dụng các biểu tượng (icons) dạng nét vẽ mỏng, đơn sắc (Lucide Icons) thay cho các icon sặc sỡ. Chỉ dùng màu để phân cấp mức độ nghiêm trọng (Severity, TLP).
*   **Căn Chỉnh Đối Xứng Tuyệt Đối**: Sắp xếp các form, input, button thẳng hàng tuyệt đối. Giữ khoảng cách đệm (padding/margin) đồng đều để tránh gây mỏi mắt khi tìm kiếm thông tin mật độ cao.

---

## 🤖 3. CYBERAI ASSESSMENT INTEGRATION PIPELINE & CHỐNG RÒ RỈ CHÉO

### A. Tuyên bố an toàn hệ thống AI:
> [!IMPORTANT]
> **Dự án CyberAI đã loại bỏ hoàn toàn các Cloud LLM (OpenAI, Claude).** Hệ thống vận hành **Offline 100%** sử dụng Local LLM **Gemma 4 31B (Lượng tử hóa Q4_K_M/Q5_K_M)** trên CPU/GPU local. Mọi rủi ro rò rỉ dữ liệu lên đám mây bên thứ ba đã được **TRIỆT TIÊU HOÀN TOÀN**.

### B. Ngăn Chặn Rò Rỉ Chéo (Cross-Tenant Data Leakage via RAG)
*   **Phân Tách Tenant chặt chẽ**: Khi Analyst gửi request phân tích hoặc chat với CyberAI, backend Go bắt buộc phải trích xuất `Organisation` ID từ JWT claims của Analyst đang đăng nhập và truyền sang API CyberAI.
*   CyberAI FastAPI backend sử dụng `Organisation` ID để phân tách không gian lưu trữ Vector DB (ChromaDB Namespace/Collection). Chỉ truy xuất dữ liệu log thuộc đúng phạm vi tổ chức của Analyst, chặn 100% việc rò rỉ tri thức sang tổ chức khác.
*   **Indirect Prompt Injection Sanitizer**: Lọc sạch toàn bộ log thô và dữ liệu đầu vào chứa payload hiểm độc (như "ignore previous instructions") bằng module parser Go trước khi gửi cho LLM để bảo vệ tính chính xác của AI.

---

## ⚙️ 4. QUY TRÌNH NGHIỆP VỤ BẮT BUỘC & SOAR PLAYBOOK N8N

### A. Quy Trình Đóng Case Chặt Chẽ (Force Tasks Closure)
*   **Bắt buộc đóng task**: Analyst phải **tự tay hoàn thành hoặc đóng/hủy toàn bộ các task** của Case trước thì mới được phép đóng Case.
*   **Chặn Đóng Case (Database & Frontend Enforcement)**:
    - Tại database/backend: Hàm Close Case kiểm tra các task dở dang của case. Nếu còn task chưa đóng, trả về lỗi cấm đóng case.
    - Tại Frontend: Khi Analyst bấm Close Case, hệ thống quét kiểm tra: Nếu phát hiện còn bất kỳ task nào dở dang, hệ thống sẽ **khóa chặt nút Confirm Close** và hiển thị cảnh báo đỏ đậm yêu cầu Analyst giải quyết hết các task còn lại trước.

### B. Cấu Hình SOAR Playbook n8n Tiện Lợi & 2FA OTP
*   **Cấu hình linh hoạt trên UI (Dynamic Playbook Link)**: Cho phép chọn từ dropdown các playbooks mẫu hoặc nhập thủ công **Playbook Name** và **Webhook URL** trực tiếp trên UI Task.
*   **Xác thực 2FA / OTP trước khi trigger**: Khi Analyst nhấn "Trigger Playbook", hệ thống bắt buộc mở popup yêu cầu nhập mã 2FA / OTP để xác thực quyền trước khi trigger sang n8n Webhook, đảm bảo an toàn tuyệt đối.

---

## 📁 5. FLUENT COMPACT ATTACHMENT DESIGN

Cải tiến khu vực quản lý tệp đính kèm theo chuẩn Microsoft Office / OneDrive chuyên nghiệp:
*   Không dùng màu sắc lòe loẹt. Sử dụng bảng màu tối giản, sang trọng:
    - PDF: Màu đỏ gạch nhạt (`text-red-400/90`, `bg-red-950/20`).
    - ZIP/RAR: Màu vàng cát mờ (`text-amber-400/90`, `bg-amber-950/20`).
    - LOG/TXT: Màu xám bạc (`text-slate-300`, `bg-slate-800/40`).
    - Image: Màu ngọc lục bảo mờ (`text-emerald-400/90`, `bg-emerald-950/20`).
*   Sắp xếp thẳng hàng, bo viền mảnh Fluent Blue, hover chuyển màu mượt mà có active edge.

---

## 🔐 6. FLUENT AUTHENTICATION & LOGIN WORKSPACES

Đồng bộ thiết kế cổng Đăng nhập, Khôi phục và Đổi mật khẩu chuẩn SOC-grade:
*   **Không gian tối dịu mắt (`.ncs-login-shell`)**: Sử dụng nền xanh Navy tối sẫm (`#040914` tiệp với `#071022`) giúp giảm thiểu sự co giãn điều tiết mắt của SOC Analyst khi chuyển đổi giữa tab giám sát sự cố và tab đăng nhập.
*   **Thẻ đăng nhập sharp (`.ncs-login-card`)**: Bo góc `8px` (`0.5rem`) sharp, viền trong xanh thương hiệu mờ `var(--glass-border)`, chiều sâu box shadow mịn màng `0 20px 40px 0 rgba(0,0,0,0.65)` triệt tiêu hoàn toàn viền trắng mờ.
*   **Form Inputs & Buttons sắc sảo (`4px`)**:
    - Ô nhập liệu dùng nền tối `rgba(4, 9, 20, 0.85)` và viền xanh dương corporate mảnh, bo góc sharp `4px`. Focus tiêu điểm màu xanh active `#0078d4`.
    - Nút bấm đăng nhập sử dụng màu active `#0078d4` và viền `#005a9e`, bo góc `4px`, hover mượt mà và có độ nảy shadow nhẹ.
*   **Nhận diện thương hiệu đồng bộ**: Sử dụng logo phẳng nền trắng `logo_ncs_nentrang.jpg` để khẳng định tính chính danh Enterprise và tiệp với Sidebar chính.

