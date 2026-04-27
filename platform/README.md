# TheHive Platform — Phase 1 Skeleton

Phase 1 (`v0.1.0`) is the **foundation** of TheHive re-platform. It does **not** port business
features yet — it boots a full stack on Docker so we can validate logging, observability,
versioning, image distribution, and the deploy story before porting case/alert/observable
in Phase 2+.

| Layer | Phase 1 stack |
|---|---|
| Frontend | Next.js 14 + TypeScript + Tailwind, theme mirrors TheHive 4 AdminLTE skin-blue |
| Backend | Go 1.22 + Echo + sqlx + zap + Prometheus + OpenAPI |
| Database | PostgreSQL 16 |
| Message broker | RabbitMQ 3.13 |
| Migrations | golang-migrate (file-based, versioned) |
| API versioning | `/api/v1` + OpenAPI 3 (`backend/api/openapi.yaml`) |
| Observability | structured JSON logs + `/healthz` + `/readyz` + `/metrics` |

The legacy TheHive 4 source remains untouched at the repo root. New code lives under `platform/`.

---

## Quick start

```bash
cd platform
make env          # creates deploy/.env from deploy/.env.example
make up           # docker compose up -d --build
make ps
make status       # curls /readyz, /api/v1/status, /api/healthz
make logs         # follow logs
```

Then open:

| URL | Purpose |
|---|---|
| http://localhost:3000/login | Frontend login (mock: `admin@thehive.local` / `secret`) |
| http://localhost:8080/healthz | Backend liveness |
| http://localhost:8080/readyz | Backend readiness (Postgres + RabbitMQ) |
| http://localhost:8080/api/v1/status | App + DB schema version |
| http://localhost:8080/metrics | Prometheus metrics |
| http://localhost:15672 | RabbitMQ management UI (`thehive` / `thehive`) |

Stop everything:

```bash
make down
```

Wipe data and restart fresh:

```bash
make clean
make up
```

---

## Repository layout

```text
platform/
├── backend/                  # Go API (Echo + sqlx + zap)
├── frontend/                 # Next.js 14 (App Router, standalone build)
├── deploy/                   # docker-compose.yml + .env.example
├── scripts/                  # build / push / healthcheck shell scripts
├── docs/                     # architecture / API / DB / observability notes
├── .github/workflows/        # build-and-push CI
├── Makefile
└── README.md
```

---

## API surface (Phase 1)

| Method | Path | Notes |
|---|---|---|
| `GET`  | `/healthz` | Liveness — process up. |
| `GET`  | `/readyz` | Readiness — pings Postgres + RabbitMQ. |
| `GET`  | `/metrics` | Prometheus exposition. |
| `GET`  | `/api/v1/status` | Version + DB schema info. |
| `POST` | `/api/v1/auth/login` | Mock login. |
| `POST` | `/api/v1/auth/logout` | Mock logout. |
| `GET`  | `/api/v1/auth/me` | Mock current user. |

Real auth (LDAP/local/JWT/TOTP) and the case / alert / observable endpoints land in
Phase 2+ and will preserve `/api/v1` backward compatibility.

---

## Versioning

| Concern | Convention |
|---|---|
| App | `MAJOR.MINOR.PATCH` (`0.1.0`, `0.2.0`, …). Each phase bumps minor. |
| API | path-based: `/api/v1`, `/api/v2`. Breaking change ⇒ new major path. |
| OpenAPI | `info.version` matches app. |
| Docker images | `:0.1.0`, `:0.1.0-<git-sha>`, `:latest` (only on main). |
| DB schema | Sequential SQL files: `NNNNNN_description.{up,down}.sql`. |
| `app_metadata` table | `app_version`, `schema_baseline`, `search_index_ver`. |

---

## Database notes

- PostgreSQL is the source of truth.
- Migrations are immutable once merged. New change → new migration file.
- Phase 1 baseline (`000001_init_schema.up.sql`) creates:
  - `app_metadata` — single-row config like `app_version`.
  - `audit_logs`  — schema reserved for Phase 2+ writes.
  - `iocs`        — IOC table sized for Cortex/MISP integration.
  - `outbox_events` — outbox pattern for reliable RabbitMQ publishing.

See [`docs/database-versioning.md`](docs/database-versioning.md).

---

## Build & push images

Build locally:

```bash
make build VERSION=0.1.0
```

Push to Docker Hub (requires `docker login` and `IMAGE_NS` set):

```bash
IMAGE_NS=your-dockerhub-namespace make push VERSION=0.1.0
```

Or via the included CI workflow — push a tag `v0.1.0`:

```bash
git tag v0.1.0 && git push --tags
```

The workflow at `platform/.github/workflows/build-and-push.yml` builds both images,
tags them with `:0.1.0` and `:0.1.0-<sha>`, and pushes to `${IMAGE_NS}/backend` /
`${IMAGE_NS}/frontend`.

CI requires repo secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

And optionally repo variable:

- `IMAGE_NS` (defaults to `thehiveplatform`)

---

## Logs & debugging

Logs are JSON. Each request line includes:

```json
{
  "level":"info",
  "ts":"2026-04-26T11:00:00Z",
  "msg":"http request",
  "request_id":"…",
  "method":"GET",
  "path":"/api/v1/status",
  "status":200,
  "latency_ms":3,
  "client_ip":"172.18.0.1",
  "user_agent":"curl/8.4.0"
}
```

Tail logs:

```bash
make logs                       # all services
docker compose logs -f backend
docker compose logs -f frontend
```

Inspect inside a container:

```bash
make backend-shell
make frontend-shell
make db-shell
make mq-shell
```

---

## Phase roadmap (preview)

| Phase | Version | Scope |
|---|---|---|
| 1 | 0.1.0 | This skeleton: Docker, API v1 stub, mock auth, schema baseline. |
| 2 | 0.2.0 | Real auth (local password / session / JWT / TOTP) + user / org / profile. |
| 3 | 0.3.0 | Core case + alert CRUD with audit log. |
| 4 | 0.4.0 | Task / log / observable + attachments via S3-compatible storage. |
| 5 | 0.5.0 | Cortex adapter via RabbitMQ worker + enrichment results. |
| 6 | 0.6.0 | MISP adapter (event import → alert, IOC export from case). |
| 7 | 0.7.0 | Dashboard, search, stable audit pipeline. |
| 1.0 | 1.0.0 | Production pilot. |

The next phase is decided based on the Phase 1 logs and behaviour.
