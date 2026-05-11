# STRUCTURE.md — Cấu Trúc Project TheHive

> **Quy tắc:** File này LUÔN LUÔN được cập nhật ngay khi cấu trúc project thay đổi. Đây là bản đồ navigation cho mọi AI session.

---

## Tổng Quan

**Project:** TheHive Platform — Migration từ TheHive 4 (Scala/AngularJS) sang Go + Next.js  
**Mục tiêu:** 100% parity với TheHive 4 về chức năng và UX  
**Stack:** Go (Echo v4) · Next.js 15 · PostgreSQL · MinIO · OpenSearch · Docker Compose

---

## Cấu Trúc Thư Mục

```
TheHive/
├── platform/                   ← ✅ CODE ĐANG PHÁT TRIỂN (Go + Next.js)
│   ├── backend/
│   │   ├── cmd/server/         ← main.go — entry point
│   │   ├── internal/
│   │   │   ├── handler/        ← HTTP handlers (thin layer)
│   │   │   │   ├── investigation/
│   │   │   │   ├── auth/
│   │   │   │   └── ...
│   │   │   ├── repository/     ← Business logic + DB queries
│   │   │   │   ├── investigation/
│   │   │   │   │   ├── types.go        ← Structs & types
│   │   │   │   │   ├── postgres.go     ← DB queries
│   │   │   │   │   └── ...
│   │   │   │   ├── workwrite/  ← Write operations
│   │   │   │   └── ...
│   │   │   ├── server/         ← Route registration, middleware
│   │   │   │   ├── routes_investigation.go
│   │   │   │   ├── routes_auth.go
│   │   │   │   └── routes_health.go
│   │   │   ├── apierr/         ← RFC7807 error types
│   │   │   ├── authjwt/        ← JWT auth middleware
│   │   │   └── tests/          ← Smoke tests
│   │   │       ├── testutil.go
│   │   │       ├── smoke_a2_core_soc_test.go
│   │   │       ├── smoke_a3_attachments_test.go
│   │   │       └── smoke_*.go
│   │   └── migrations/         ← golang-migrate SQL files
│   │       ├── 000001_init.up.sql ... 000030_totp_2fa.up.sql
│   │       └── seed/
│   └── frontend/
│       └── src/
│           ├── app/            ← Next.js App Router pages
│           │   ├── cases/
│           │   ├── alerts/
│           │   ├── observables/
│           │   ├── tasks/
│           │   ├── dashboards/
│           │   └── ...
│           ├── components/     ← Reusable React components
│           │   ├── MarkdownEditor.tsx
│           │   ├── Dropzone.tsx
│           │   └── ...
│           ├── lib/            ← API client, utilities
│           └── types/          ← TypeScript type definitions
│
├── thehive/                    ← 📖 LEGACY READ-ONLY (Scala/AngularJS TheHive 4)
├── frontend/                   ← 📖 LEGACY READ-ONLY (AngularJS UI)
├── cortex/                     ← 📖 LEGACY READ-ONLY (Cortex integration)
├── misp/                       ← 📖 LEGACY READ-ONLY (MISP integration)
│
├── agent_memory/               ← 🧠 AI Agent Memory System
│   ├── MEMORY.md               ← Append-only log
│   ├── STRUCTURE.md            ← This file
│   ├── CODING_GUIDELINES.md    ← Rules + Self-Debate Protocol
│   ├── MASTER_PROMPT.md        ← Session startup prompt
│   ├── context.md              ← Product/architecture context
│   ├── plan.md                 ← Active work plan
│   ├── plan_done.md            ← Completed tasks evidence
│   └── plan_unfinish.md        ← Backlog
│
└── docker-compose.yml          ← Dev stack: backend + frontend + postgres + minio + opensearch
```

---

## Key Files

| File | Mô tả |
|------|-------|
| `platform/backend/internal/server/routes_investigation.go` | Route registration cho investigation endpoints |
| `platform/backend/internal/repository/investigation/types.go` | Tất cả structs dùng cho cases, alerts, observables |
| `platform/backend/internal/repository/investigation/postgres.go` | SQL queries chính |
| `platform/frontend/src/app/cases/[id]/page.tsx` | Case detail page |
| `platform/frontend/src/app/alerts/page.tsx` | Alerts list page |
| `platform/backend/migrations/` | SQL migration files (000001 → 000030+) |

---

## Backend Route Map (38 routes hiện tại)

| Group | Path Prefix | Handler File |
|-------|------------|-------------|
| Auth | `/api/v1/auth/*` | `routes_auth.go` |
| Cases | `/api/v1/cases/*` | `routes_investigation.go` |
| Alerts | `/api/v1/alerts/*` | `routes_investigation.go` |
| Observables | `/api/v1/observables/*` | `routes_investigation.go` |
| Tasks | `/api/v1/tasks/*` | `routes_investigation.go` |
| Dashboards | `/api/v1/dashboards/*` | `routes_investigation.go` |
| Health | `/healthz`, `/readyz` | `routes_health.go` |

---

## Docker Services

| Service | Port | Vai trò |
|---------|------|---------|
| backend | 8080 | Go API server |
| frontend | 3000 | Next.js dev server |
| postgres | 5432 | Primary DB |
| minio | 9000/9001 | File attachments |
| opensearch | 9200 | Full-text search |

---

## Quy Tắc Navigation

1. **Trước khi sửa code**: Đọc `agent_memory/plan.md` và `agent_memory/context.md`
2. **Tìm handler**: Xem `internal/server/routes_*.go` → tìm handler file
3. **Tìm DB query**: Xem `internal/repository/*/postgres.go`
4. **Legacy reference**: Chỉ đọc — không sửa `thehive/`, `frontend/`, `cortex/`, `misp/`
5. **Cập nhật file này**: Ngay khi thêm/xóa route, file, hoặc thay đổi cấu trúc

---

*Cập nhật lần cuối: 2026-05-09*
