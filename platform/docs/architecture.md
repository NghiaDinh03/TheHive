# Architecture (Phase 1)

```text
┌─────────────────────┐         ┌─────────────────────┐
│   Browser (UA)      │ ──HTTP─▶│   Frontend (Next)   │
│                     │         │   :3000             │
└─────────────────────┘         └──────────┬──────────┘
                                           │ rewrites /api/* → backend
                                           ▼
                                ┌─────────────────────┐
                                │   Backend (Go/Echo) │
                                │   :8080             │
                                │   /api/v1, /healthz,│
                                │   /readyz, /metrics │
                                └──────┬──────────┬───┘
                                       │          │
                          ┌────────────▼──┐    ┌──▼──────────────┐
                          │ PostgreSQL 16 │    │ RabbitMQ 3.13    │
                          │ :5432         │    │ :5672 / :15672   │
                          │ schema v1     │    │                  │
                          └───────────────┘    └──────────────────┘
```

Phase 1 keeps everything in a single Docker Compose network `thehive-net`. The frontend
proxies `/api/*` to the backend, so the browser never speaks to the backend directly in
production. Healthchecks gate `depends_on` so the backend only starts after Postgres
and RabbitMQ are healthy, and the frontend only after the backend is healthy.

## Service responsibilities

| Service | Owns |
|---|---|
| frontend | UI rendering, login form, dashboard skeleton, theme. |
| backend | API v1, health, metrics, DB migration, MQ connection. |
| postgres | Source of truth for `app_metadata`, `audit_logs`, `iocs`, `outbox_events`. |
| rabbitmq | Async work pipeline (used in Phase 5+ for Cortex/MISP workers). |

## Trust boundaries

- Browser ↔ frontend: HTTP(S). In production, terminate TLS at a reverse proxy.
- Frontend ↔ backend: server-to-server inside Docker network. Never expose backend
  port `:8080` publicly when running behind a proxy.
- Backend ↔ Postgres: TCP inside Docker network. Use `sslmode=verify-full` in
  production with managed Postgres.
- Backend ↔ RabbitMQ: AMQP inside Docker network. Use TLS in production.

## Where Phase 2+ will plug in

- New services (e.g. `worker-cortex`, `worker-misp`) attach to the same `thehive-net`
  and consume from RabbitMQ.
- New domain modules (case, alert, observable) live under
  `backend/internal/<domain>/{handler,service,repo,model}.go`.
- Frontend gains routes under `src/app/<domain>/` reusing the existing layout.
