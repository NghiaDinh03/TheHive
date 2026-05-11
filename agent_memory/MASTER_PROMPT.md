# MASTER_PROMPT.md — Prompt Khởi Động Session AI

> **Đọc file này đầu tiên khi bắt đầu bất kỳ session làm việc nào trên TheHive platform.**

---

## 🎯 Project Context

**TheHive Platform** — Migration từ TheHive 4 (Scala/AngularJS) sang Go + Next.js với 100% parity.

**Stack:** Go (Echo v4) · Next.js 15 (App Router) · PostgreSQL (sqlx/pgx) · MinIO · OpenSearch · Docker Compose

---

## ⚡ Ba Giải Pháp Bắt Buộc (LUÔN LUÔN ÁP DỤNG)

### 1. Caveman Protocol — Token Compression
Tất cả responses phải dùng style terse:
- Bullet points ngắn, không có filler words
- Bỏ qua context hiển nhiên, chỉ giữ thông tin kỹ thuật
- Slash commands: `/caveman` (default) · `/caveman lite` · `/caveman ultra` · `/caveman-commit`
- Ví dụ: Thay "I will now proceed to implement..." → "Implement:"

### 2. Karpathy Guidelines — Behavioral Rules
| Nguyên tắc | Áp dụng |
|-----------|---------|
| **Think Before Coding** | State assumptions explicitly trước khi code. Nếu không chắc, HỎI. |
| **Simplicity First** | Minimum code giải quyết vấn đề. Không thêm feature chưa được yêu cầu. |
| **Surgical Changes** | Chỉ sửa những gì cần sửa. Không "improve" code liền kề. |
| **Goal-Driven** | Định nghĩa success criteria trước. Verify sau mỗi bước. |

### 3. RTK — Shell Command Efficiency
- Prefix tất cả shell commands với `rtk`: `rtk go build ./...` · `rtk npm run build`
- Plan Execution: Thực hiện tuần tự, commit sau mỗi phase hoàn thành
- Tránh Rabbit Holes: Nếu verification cần >3 lệnh, DỪNG và hỏi user

---

## 📋 Self-Debate Protocol (BẮT BUỘC trước khi thêm rule mới)

```markdown
## 🔄 Self-Debate: [Chủ đề]

### 📌 Đề xuất
[Mô tả rõ muốn thêm/thay đổi gì và tại sao]

### ✅ Lý do ủng hộ (Pro)
1. [Lý do 1]
2. [Lý do 2]

### ❌ Lý do phản đối (Con)
1. [Rủi ro 1]
2. [Phương án thay thế tốt hơn?]

### 🔍 Phương án thay thế
1. [Option A] — [lý do bác bỏ hoặc cân nhắc]

### ⚖️ Đánh giá
- Confidence: [High/Medium/Low]
- Risk nếu sai: [Low/Medium/High]
- Reversibility: [Easy/Moderate/Hard]

### ❓ Câu hỏi cho User
[Câu hỏi cụ thể một lần]
```

---

## 📚 Files Phải Đọc Khi Bắt Đầu Session

1. `agent_memory/MEMORY.md` — Lessons learned, decisions log
2. `agent_memory/plan.md` — Work plan hiện tại
3. `agent_memory/STRUCTURE.md` — Bản đồ project

---

## 🏗️ Architecture Chính

```
HTTP Request
    → Echo Handler (internal/handler/)  [thin — chỉ parse + route]
    → Repository (internal/repository/) [business logic + SQL]
    → PostgreSQL
```

**Legacy reference** (chỉ đọc): `thehive/`, `frontend/`, `cortex/`, `misp/`  
**Platform code** (active): `platform/backend/` + `platform/frontend/`

---

## ⚠️ Rules Quan Trọng

- `agent_memory/MEMORY.md` — **APPEND ONLY**, không bao giờ xóa
- `agent_memory/STRUCTURE.md` — Cập nhật ngay khi structure thay đổi
- `CODING_GUIDELINES.md` — Đọc toàn bộ trước khi code
- Không sửa legacy files
- Luôn `go build ./...` và `npm run build` sau khi code
- PowerShell không dùng `&&` — tách thành 2 lệnh riêng

---

## 🎯 Plan Hiện Tại

Xem `agent_memory/plan.md` để biết task đang làm.
