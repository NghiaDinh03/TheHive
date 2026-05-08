# STRUCTURE.md — Project Structure Map

> **Rules:** This file is ALWAYS kept up-to-date with the current project structure. When adding/removing/renaming directories or key files, update this file immediately. This is the single source of truth for "where things live."

---

## Top-Level Layout

```text
TheHive/
├── agent_memory/              # Agent persistent memory (this folder)
│   ├── MEMORY.md              # Append-only decisions/lessons/patterns log
│   ├── STRUCTURE.md           # This file — always-current project map
│   ├── CODING_GUIDELINES.md   # Coding rules + self-debate mechanism
│   ├── MASTER_PROMPT.md       # Prompt template for new sessions
│   ├── MIGRATION_ANALYSIS.md  # Honest migration assessment (English)
│   ├── REVIEW_PLAN_vi.md      # Vietnamese review summary for user
│   ├── context.md             # Product/architecture/version context
│   ├── plan.md                # Control plan, phase map, execution order
│   ├── plan_done.md           # Completed evidence log
│   └── plan_unfinish.md       # Actionable unfinished backlog
│
├── platform/                  # NEW platform (Go + Next.js) — active development
│   ├── backend/               # Go API service
│   │   ├── cmd/
│   │   │   ├── server/        # Backend entrypoint
│   │   │   └── fixturemigrate/# Migrator preview from legacy fixtures
│   │   ├── internal/
│   │   │   ├── apierr/        # RFC7807-style error responses
│   │   │   ├── audit/         # Append-only audit recorder/helper
│   │   │   ├── authjwt/       # JWT claims/session helpers
│   │   │   ├── config/        # Env config loader
│   │   │   ├── db/            # PostgreSQL connection/migrations
│   │   │   ├── fixturemigrate/# Fixture migration preview logic
│   │   │   ├── handler/        # HTTP handlers (Echo v4)
│   │   │   │   ├── legacy_parity.go  # 22 legacy TheHive 4 parity endpoints
│   │   │   ├── logger/        # zap structured logging
│   │   │   ├── mail/          # SMTP/Mailpit foundation
│   │   │   ├── metrics/       # Prometheus metrics
│   │   │   ├── mq/            # RabbitMQ client
│   │   │   ├── repository/    # Domain repositories (read/write split)
│   │   │   ├── server/        # Echo server, routes, middleware
│   │   │   ├── tests/         # Integration/smoke tests
│   │   │   └── version/       # Build/version metadata
│   │   ├── migrations/        # Versioned SQL up/down migrations
│   │   │   └── seed/          # Seed data (password hashes, etc.)
│   │   ├── api/
│   │   │   └── openapi.yaml   # OpenAPI v1 contract
│   │   ├── go.mod
│   │   ├── go.sum
│   │   ├── Dockerfile
│   │   └── Makefile
│   │
│   ├── frontend/              # Next.js 14 + TypeScript UI
│   │   ├── src/
│   │   │   ├── app/           # App Router pages
│   │   │   │   ├── admin/     # Admin pages (users, profiles, templates, taxonomy)
│   │   │   │   ├── alerts/    # Alert detail pages
│   │   │   │   ├── cases/     # Case list, create, detail pages
│   │   │   │   ├── dashboards/# Dashboard list and detail
│   │   │   │   ├── investigation/ # Main investigation view (alerts/cases/observables)
│   │   │   │   ├── observables/   # Observable detail pages
│   │   │   │   ├── pages/     # Knowledge pages
│   │   │   │   └── tasks/     # Global task list
│   │   │   ├── components/    # Shared UI components
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── FaIcon.tsx
│   │   │   │   ├── ConfirmDialog.tsx
│   │   │   │   ├── CustomFieldEditor.tsx
│   │   │   │   ├── Dropzone.tsx
│   │   │   │   ├── FilterBox.tsx
│   │   │   │   ├── FlowPanel.tsx
│   │   │   │   ├── MarkdownEditor.tsx
│   │   │   │   ├── ObservableReportModal.tsx
│   │   │   │   ├── PageSizer.tsx
│   │   │   │   └── PermissionMatrix.tsx
│   │   │   ├── lib/           # API client, query provider, utilities
│   │   │   ├── styles/        # TheHive/AdminLTE parity CSS
│   │   │   │   └── globals.css
│   │   │   └── types/         # TypeScript type definitions
│   │   ├── tests/
│   │   │   └── visual/        # Playwright visual regression tests
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── deploy/                # Docker Compose/env/nginx production foundation
│   ├── docs/                  # Operational docs
│   ├── scripts/               # Build/push/healthcheck scripts
│   ├── Makefile
│   └── README.md
│
├── thehive/                   # LEGACY Scala/Play backend — read-only reference
├── frontend/                  # LEGACY AngularJS UI — read-only reference
├── cortex/                    # LEGACY Cortex client/dto reference
├── misp/                      # LEGACY MISP integration reference
├── dto/                       # Legacy DTO definitions (Scala)
├── migration/                 # Legacy migration code (Scala)
├── conf/                      # Legacy config samples
├── client/                    # Legacy Scala client
├── client-common/             # Legacy common client code
├── lib/                       # Legacy library jars
├── project/                   # SBT build config
├── test/                      # Legacy test data (JSON fixtures)
├── images/                    # Documentation images
├── package/                   # Packaging scripts (Docker, RPM, Debian)
│
├── build.sbt                  # Legacy SBT build
├── CHANGELOG.md
├── LICENSE
└── README.md
```

---

## Key File Locations (Quick Reference)

| What | Where |
|------|-------|
| Backend entrypoint | `platform/backend/cmd/server/` |
| HTTP handlers | `platform/backend/internal/handler/` |
| Domain repositories | `platform/backend/internal/repository/` |
| DB migrations | `platform/backend/migrations/` |
| Seed data | `platform/backend/migrations/seed/` |
| OpenAPI spec | `platform/backend/api/openapi.yaml` |
| Frontend pages | `platform/frontend/src/app/` |
| Shared components | `platform/frontend/src/components/` |
| API client | `platform/frontend/src/lib/` |
| Global CSS | `platform/frontend/src/styles/globals.css` |
| Visual tests | `platform/frontend/tests/visual/` |
| Agent memory | `agent_memory/` |
| Legacy backend ref | `thehive/` |
| Legacy frontend ref | `frontend/` |

---

## Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | Next.js (App Router) | 14 |
| Frontend language | TypeScript | 5 |
| Frontend styling | Tailwind CSS + custom CSS tokens | — |
| Frontend data | @tanstack/react-query + fetch | — |
| Backend language | Go | 1.22 |
| Backend HTTP | Echo v4 | 4 |
| Database | PostgreSQL | 16 |
| DB access | sqlx + pgx stdlib | — |
| Migration | golang-migrate (SQL up/down) | — |
| Logging | zap (structured JSON) | — |
| Metrics | Prometheus client | — |
| Auth | JWT + PostgreSQL session revocation | — |
| Object storage | MinIO/S3 | — |
| Search index | OpenSearch | — |
| Queue | RabbitMQ | — |
| Testing (frontend) | Playwright (visual regression) | — |
| Testing (backend) | Go testing + testify | — |

---

## Domain Entities

| Entity | Backend Repository | Frontend Page |
|--------|-------------------|---------------|
| Case | `repository/casewrite/` | `app/cases/` |
| Alert | `repository/alertwrite/` | `app/alerts/` |
| Observable | `repository/observablewrite/` | `app/observables/` |
| Task | `repository/workwrite/` | `app/tasks/` |
| Log | `repository/workwrite/` | (within case detail) |
| Case Template | `repository/casetemplate/` | `app/admin/case-templates/` |
| Custom Field | `handler/case_sub.go` | `components/CustomFieldEditor.tsx` |
| Dashboard | `handler/` | `app/dashboards/` |
| Page | `handler/` | `app/pages/` |
| User | `handler/admin.go` | `app/admin/users/` |
| Profile | `handler/admin.go` | `app/admin/profiles/` |
| Organisation | `handler/admin.go` | `app/admin/` |

---

> **Maintenance:** Update this file whenever directories or key files are added, removed, or renamed. The agent reads this file to understand project layout before making changes.
