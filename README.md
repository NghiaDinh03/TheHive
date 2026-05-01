<div align="center">

<img src="images/thehive-logo.png" alt="TheHive Platform" width="120"/>

# TheHive Platform

**AI-assisted, cloud-native Security Operations Center (SOC) case management**

[![Go](https://img.shields.io/badge/Go-1.22-00ADD8?logo=go)](platform/backend)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](platform/frontend)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](platform/backend/migrations)
[![License](https://img.shields.io/badge/License-AGPL--3.0-blue)](LICENSE)

</div>

---

## What is TheHive Platform?

TheHive Platform is a **production-ready, open-source SOC case-management system** that modernises the battle-tested TheHive 4 workflow onto a cloud-native stack — without disrupting the analyst experience that security teams rely on every day.

Built using a **strangler-fig migration pattern**, the new platform runs alongside the legacy TheHive 4 system, shadow-comparing results and gradually taking over write paths until full parity is verified. No big-bang rewrite. No operational risk.

---

## Why it exists

| Problem | Solution |
|---|---|
| TheHive 4 (Scala/Play + JanusGraph) is operationally brittle and hard to scale | Replaced with Go 1.22 + PostgreSQL 16 — stateless, horizontally scalable |
| Legacy UI (AngularJS) is unmaintainable and hard to extend | Rebuilt with Next.js 14 + TypeScript + Tailwind, pixel-matching the familiar AdminLTE skin |
| No path to AI-native threat intelligence | Modular adapter layer for Cortex, MISP, OpenSearch, and future LLM integrations |
| Migration risk is too high for live SOC teams | Strangler-fig pattern: shadow compare → incremental cutover → zero downtime |

---

## Key capabilities

### 🔐 Authentication & Access Control
- JWT-based authentication with role-based access control (RBAC)
- Fine-grained permission matrix per organisation
- API key support for service accounts

### 📁 Case & Alert Management
- Full lifecycle management: Cases, Alerts, Tasks, Observables, Work logs
- Alert-to-case promotion workflow
- Case templates with custom fields
- Attachment upload/download with ZIP export

### 🔍 Investigation & Search
- OpenSearch full-text search across all entity types
- Observable correlation and evidence linking
- MITRE ATT&CK taxonomy and tagging

### 🤖 Integrations
- **Cortex** — analyzer and responder job dispatch with result polling
- **MISP** — bi-directional event sync (import + attribute push)
- **OpenSearch** — real-time indexing with outbox trigger pattern

### 📊 Dashboards & Observability
- Configurable dashboard widgets (counts, severity breakdown, timeline)
- Prometheus metrics endpoint (`/metrics`)
- Structured JSON logging (zap)
- Health (`/healthz`) and readiness (`/readyz`) probes

### 📬 Notifications
- Email notification pipeline via SMTP (Mailpit for local dev)
- RabbitMQ-backed async worker for notification delivery

---

## Architecture

```
TheHive/
├── platform/                   ← New cloud-native platform (active development)
│   ├── backend/                ← Go 1.22 / Echo / sqlx / zap / Prometheus
│   │   ├── cmd/server/         ← API server entrypoint
│   │   ├── internal/           ← Handlers, repositories, integrations
│   │   ├── migrations/         ← 29 versioned SQL migrations (up/down)
│   │   └── api/openapi.yaml    ← OpenAPI 3.0 contract
│   ├── frontend/               ← Next.js 14 / TypeScript / Tailwind
│   │   └── src/app/            ← App Router pages (cases, alerts, admin…)
│   ├── deploy/                 ← Docker Compose + .env.example
│   ├── docs/                   ← Operational documentation
│   └── scripts/                ← Build, push, healthcheck scripts
├── thehive/                    ← Legacy Scala/Play backend (read-only reference)
├── frontend/                   ← Legacy AngularJS UI (read-only reference)
├── context.md                  ← Architecture decisions and domain model
└── plan.md                     ← Phase-by-phase task tracker
```

**Stack at a glance:**

| Layer | Technology |
|---|---|
| API | Go 1.22, Echo, sqlx, golang-migrate |
| Database | PostgreSQL 16 |
| Search | OpenSearch |
| Message broker | RabbitMQ 3.13 |
| Frontend | Next.js 14, TypeScript 5, Tailwind CSS |
| Observability | Prometheus, zap structured logs |
| Infrastructure | Docker Compose, Makefile |

---

## Quick start

```bash
git clone https://github.com/NghiaDinh03/TheHive.git
cd TheHive/platform

make env        # copy deploy/.env.example → deploy/.env
make up         # docker compose up -d --build
make status     # verify /readyz, /api/v1/status, /healthz
```

| URL | Purpose |
|---|---|
| http://localhost:3000/login | Frontend (default: `admin@thehive.local` / `secret`) |
| http://localhost:8080/healthz | Backend liveness |
| http://localhost:8080/readyz | Backend readiness |
| http://localhost:8080/api/v1/status | App + DB schema version |
| http://localhost:8080/metrics | Prometheus metrics |
| http://localhost:15672 | RabbitMQ management UI |

```bash
make down       # stop all services
make clean      # wipe volumes and restart fresh
```

---

## Roadmap

| Phase | Status | Highlights |
|---|---|---|
| Phase 1 — Foundation | ✅ Complete | Full-stack boot, auth, RBAC, Docker Compose |
| Phase 2 — Core SOC | ✅ Complete | Cases, Alerts, Tasks, Observables, Attachments |
| Phase 3 — Integrations | ✅ Complete | Cortex, MISP, OpenSearch, Notifications |
| Phase 4 — AI Triage | 🔜 Planned | LLM-powered alert classification and playbook suggestion |
| Phase 5 — Autonomous Investigation | 🔜 Planned | Multi-agent observable correlation and ATT&CK mapping |
| Phase 6 — Copilot Layer | 🔜 Planned | Real-time analyst assistant, auto-report generation |

---

## Security

- Real `.env` files are excluded from version control via `.gitignore`
- `JWT_SECRET` is enforced ≥ 32 characters in non-development environments
- CORS origin allowlist is configurable via environment variable
- See [`platform/deploy/.env.example`](platform/deploy/.env.example) for all required variables

---

## Contributing

This project is under active development. See [`plan.md`](plan.md) for the current task tracker and [`context.md`](context.md) for architecture decisions.

---

## License

[AGPL-3.0](LICENSE) — same licence as the original TheHive 4 open-source release.

---

<div align="center">
Built with ❤️ for SOC analysts everywhere.
</div>
