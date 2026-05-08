# Context — TheHive 4 Re-platform

Tài liệu này là bức tranh tổng quan của project: mục tiêu sản phẩm, kiến trúc, stack, quản lý phiên bản, API boundary, database boundary, nguyên tắc migration và roadmap big-update theo version. Tài liệu này không phải nơi ghi toàn bộ task chi tiết từng phiên; task chi tiết, task đã làm, task chưa làm, đề xuất migration và checklist theo phase nằm trong `plan.md`.

## 0. Mục tiêu sản phẩm

Mục tiêu là migrate dần TheHive 4 legacy sang một SOC case-management platform mới, production-ready hơn, dễ vận hành hơn, vẫn giữ workflow quen thuộc của TheHive 4 cho analyst.

Nguyên tắc chính:

- Không rewrite big-bang.
- Legacy TheHive 4 được giữ làm baseline nghiệp vụ và UI/UX reference.
- Platform mới được build theo strangler pattern: đọc trước, ghi từng phần, shadow compare, rồi cutover.
- PostgreSQL là source of truth cho core domain mới.
- Object storage giữ binary attachment.
- OpenSearch là read/search index rebuildable.
- MISP/Cortex đi qua adapter/worker, không trộn trực tiếp vào core API.
- Tất cả API, database, image, config, migration và data migration đều có version.

## 1. Repo layout và vai trò thư mục

```text
TheHive/
├── thehive/                    # Legacy Scala/Play backend — read-only reference nghiệp vụ.
├── frontend/                   # Legacy AngularJS UI — read-only reference UI/UX.
├── cortex/                     # Legacy Cortex client/dto reference.
├── misp/                       # Legacy MISP integration reference nếu có.
├── conf/                       # Legacy config samples.
├── platform/                   # Platform mới đang migrate dần.
│   ├── backend/                # Go API service.
│   │   ├── cmd/server/         # Backend entrypoint.
│   │   ├── cmd/fixturemigrate/ # Migrator preview từ fixture legacy.
│   │   ├── internal/
│   │   │   ├── apierr/         # RFC7807-style errors.
│   │   │   ├── audit/          # Append-only audit recorder/helper.
│   │   │   ├── authjwt/        # JWT claims/session helpers.
│   │   │   ├── config/         # Env config loader.
│   │   │   ├── db/             # PostgreSQL connection/migrations.
│   │   │   ├── fixturemigrate/ # Fixture migration preview logic.
│   │   │   ├── handler/        # HTTP handlers.
│   │   │   ├── logger/         # zap structured logging.
│   │   │   ├── mail/           # SMTP/Mailpit foundation.
│   │   │   ├── metrics/        # Prometheus metrics.
│   │   │   ├── mq/             # RabbitMQ client.
│   │   │   ├── repository/     # Domain repositories.
│   │   │   ├── server/         # Echo server, routes, middleware.
│   │   │   └── version/        # Build/version metadata.
│   │   ├── migrations/         # Versioned SQL up/down migrations.
│   │   └── api/openapi.yaml    # OpenAPI v1 contract.
│   ├── frontend/               # Next.js + TypeScript UI.
│   │   ├── src/app/            # App Router pages.
│   │   ├── src/components/     # Shell/navigation components.
│   │   ├── src/lib/            # API client/query provider.
│   │   └── src/styles/         # TheHive/AdminLTE parity CSS.
│   ├── deploy/                 # Docker Compose/env/nginx production foundation.
│   ├── docs/                   # Operational docs.
│   └── scripts/                # Build/push/healthcheck scripts.
├── context.md                  # File tổng quan project/version này.
└── plan.md                     # File task/phase/checklist chi tiết.
```

## 2. Stack chuẩn của platform mới

### 2.1 Frontend

- Framework: Next.js 14 App Router.
- Language: TypeScript 5.
- Styling: Tailwind CSS + custom CSS tokens để bám TheHive 4 AdminLTE skin-blue.
- Data fetching: `@tanstack/react-query` + fetch wrapper.
- Form: React Hook Form + Zod cho các form phức tạp ở phase sau.
- UI goal: giống workflow TheHive 4, nhưng codebase React hiện đại, component hóa, dễ test visual regression.

Theme tokens cần giữ ổn định:

| Token | Giá trị | Lý do |
|---|---:|---|
| Primary | `#3c8dbc` | TheHive/AdminLTE skin-blue.
| Primary dark | `#367fa9` | Header/sidebar active.
| Sidebar dark | `#222d32` | Legacy shell.
| Sidebar hover | `#1e282c` | Legacy shell hover.
| Body bg | `#ecf0f5` | AdminLTE content background.
| Text | `#333` | Legacy readable default.
| Font | Roboto | TheHive 4 dùng Roboto/fontface style.

### 2.2 Backend

- Language: Go 1.22.
- HTTP framework: Echo v4.
- DB access: sqlx + pgx stdlib driver.
- Migration: golang-migrate với SQL up/down files.
- Logging: zap structured JSON.
- Metrics: Prometheus client.
- Auth: JWT session foundation + PostgreSQL session revocation.
- Audit: append-only audit table + transaction-safe helper.
- Mail: SMTP adapter foundation, Mailpit trong dev/self-host.
- Queue: RabbitMQ client foundation; worker production sẽ mở rộng ở Cortex/MISP/attachment phases.

### 2.3 Database

- PostgreSQL 16.
- Core tables hiện tại gồm users/orgs/profiles, cases, alerts, observables, task_items, case_logs, attachments metadata, custom_fields, audit_logs, data_migrations.
- SQL migration format hiện tại: `NNNNNN_description.up.sql` và `NNNNNN_description.down.sql`.
- Rule: không sửa migration đã chạy/shared; tạo migration mới để thay đổi schema.
- PostgreSQL là source of truth, OpenSearch chỉ là read/search index rebuildable.

### 2.4 Infrastructure dev/self-host

- Docker Compose cho local/dev/staging foundation.
- PostgreSQL, RabbitMQ, Mailpit đã có foundation.
- MinIO/S3, OpenSearch, Cortex worker, MISP worker sẽ được thêm theo phase.

## 3. API boundary và versioning

API public của platform mới dùng path version:

```text
/api/v1/...
```

Quy tắc:

- Không break contract trong cùng major API.
- Thêm field mới: được phép nếu backward-compatible.
- Xóa/đổi meaning field: phải qua API version mới hoặc migration note rõ.
- OpenAPI contract nằm ở `platform/backend/api/openapi.yaml`.
- Frontend chỉ gọi API mới qua wrapper trong `platform/frontend/src/lib/api.ts`.

Nhóm API chính:

| Nhóm | Mục tiêu |
|---|---|
| Health/status | Liveness, readiness, metrics, build version, DB schema status. |
| Auth/session | Login/logout/me, password change/reset, invite-only registration, session revoke. |
| Admin | Users, organisations, profiles, approval/invite/reset token. |
| Audit | Append-only audit stream. |
| Investigation read | Cases, alerts, observables read list với range/sort/filter/DSL foundation. |
| Domain writes | Case write, alert import/merge, task/log/observable write MVP. |
| Integration future | Attachment/S3, Cortex, MISP, OpenSearch, migrator/cutover APIs. |

## 4. Product capability map

### 4.1 Đã có foundation trong platform mới

- Docker/Go/Next/PostgreSQL/RabbitMQ skeleton.
- Health/readiness/metrics/version endpoint foundation.
- TheHive/AdminLTE skin-blue UI foundation.
- Investigation read portal cho cases/alerts/observables.
- PostgreSQL-backed read repository path.
- Legacy read adapter safe fallback.
- Fixture migrator preview từ TheHive 4 JSON fixtures.
- Local auth + JWT session + session revocation.
- Password hardening, first-login change password, reset token foundation.
- Invite-only registration + admin approval/invite foundation.
- Admin users/organisations/profiles UI/API MVP.
- Append-only audit log + audit stream API/UI foundation.
- Query DSL compatibility foundation.
- Case write MVP.
- Alert import/merge backend MVP.
- Task/log/observable write backend MVP.
- Detail UI style foundation cho case/alert/observable/task.

### 4.2 Chưa production-complete

- Rate limit vẫn in-memory, chưa distributed Redis limiter.
- Query DSL chưa parity 100% TheHive 4 `stats`/`nparent`/edge semantics.
- Case write chưa có custom fields/procedures/share/merge đầy đủ.
- Alert import/merge chưa copy alert artifacts/observables chính xác như TheHive 4.
- Observable analyze mới là placeholder, chưa Cortex worker thật.
- Attachment storage chưa có MinIO/S3 + malware scan hook.
- MISP adapter production chưa có.
- OpenSearch global search/dashboard chưa có.
- Full data migrator + shadow compare chưa có.
- UI chưa có screenshot baseline/visual regression để đảm bảo pixel-perfect TheHive 4.

## 5. Version roadmap big-update

Phân biệt rõ hai loại version:

1. **Migration build/milestone version**: dùng trong giai đoạn đang port dần từ TheHive 4 sang platform mới. Các mốc này có thể chạy dev/staging/pilot nội bộ, nhưng **chưa được tính là product release hoàn chỉnh** vì migration chưa 100%.
2. **Product release version**: chỉ bắt đầu khi migration đạt 100% parity, shadow compare pass, vận hành production pilot thành công. Theo nghĩa này, bản production đầu tiên mới là `v1.0.0`.

Vì vậy, các năng lực đang làm hiện tại không nên hiểu là “v0.1.0 production có hết feature”. Chúng là các **build/milestone trong nhánh migration** để tích lũy dần đến bản production hoàn chỉnh.

### 5.1 Migration build roadmap trước production

| Build/Milestone | Release class | Big update | Output mong muốn |
|---|---|---|---|
| `0.1.x-migration` | Dev/staging build | Platform skeleton | Docker Compose, Go API, Next.js UI, PostgreSQL, RabbitMQ, health/metrics/versioning chạy được để làm nền. |
| `0.2.x-migration` | Dev/staging build | Read/auth/admin foundation | Investigation read portal, PostgreSQL read path, fixture migration preview, auth/JWT/session/admin/audit foundation. |
| `0.3.x-migration` | Dev/staging build | Case/alert write foundation | Case write MVP, alert import/merge backend MVP, audit transaction-safe, chưa cam kết parity 100%. |
| `0.4.x-migration` | Dev/staging build | Workbench write foundation | Task lifecycle, case logs append-only, observable create/update/delete/analyze placeholder. |
| `0.5.x-migration` | Dev/staging build | UI parity baseline | Screenshot baseline TheHive 4, visual regression, style diff cho list/detail/admin/workbench. |
| `0.6.x-migration` | Dev/staging build | Attachment storage | MinIO/S3 metadata/upload/download, malware scan hook, attachment retention policy. |
| `0.7.x-migration` | Dev/staging build | Cortex production adapter | Analyzer/responder catalog, RabbitMQ worker, job persistence, report renderer. |
| `0.8.x-migration` | Dev/staging build | MISP production adapter | Event import preview, attribute mapping, IOC export, taxonomy/tag sync. |
| `0.9.x-migration` | Staging/pilot build | OpenSearch + full migrator | OpenSearch indexer/global search/dashboard, resumable data migrator, checksum, validation report, shadow compare. |
| `1.0.0-rc.x` | Release candidate | Full parity hardening | Feature freeze, all critical TheHive 4 workflows pass parity tests, migration pilot pass, rollback runbook tested. |

### 5.2 Product release roadmap sau khi migration hoàn chỉnh

| Product version | Khi nào được tính | Big update | Điều kiện bắt buộc |
|---|---|---|---|
| `v1.0.0` | Migration 100% TheHive 4 core workflow đã pass và production pilot vận hành được | Initial production replacement for TheHive 4 | UI/UX core parity, backend workflow parity, database migration complete, Cortex/MISP/attachment/search/migrator pass, shadow compare không còn critical mismatch, rollback tested. |
| `v1.1.0` | Sau khi `v1.0.0` ổn định | UI/UX polish + analyst productivity | Giảm click/latency, dashboard cải tiến, saved views, visual regression vẫn pass TheHive 4 baseline hoặc baseline mới được duyệt. |
| `v1.2.0` | Sau production baseline | Automation/SOAR hardening | Cortex responder workflow nâng cao, queue/dead-letter dashboards, notification/webhook policies. |
| `v1.3.0` | Sau automation ổn định | Threat intel expansion | MISP sync nâng cao, taxonomy/galaxy mapping, IOC lifecycle, feed governance. |
| `v1.4.0` | Sau search/dashboard ổn định | Reporting/compliance | Case report templates, export, audit retention, compliance dashboards. |
| `v2.0.0` | Chỉ khi có breaking changes | Major architecture/API change | API v2 hoặc permission/data model breaking change, có migration guide và backward-compat window. |

## 6. Versioning policy

| Loại | Policy |
|---|---|
| Migration build | Dùng `0.x.y-migration` hoặc `0.x.y-<git-sha>` cho dev/staging/pilot trước khi migration hoàn chỉnh. Không gọi các bản này là production release hoàn chỉnh. |
| Product release | Bắt đầu từ `v1.0.0` sau khi migration 100% core TheHive 4 hoàn tất, shadow compare pass, production pilot pass. |
| App | Sau `v1.0.0`, dùng semantic versioning: `MAJOR.MINOR.PATCH`. |
| API | Path version `/api/v1`; breaking change cần `/api/v2` hoặc migration compatibility adapter. |
| Database schema | Versioned SQL migrations, up/down file pair; schema version không đồng nghĩa product version. |
| Data migration | Tracked qua `data_migrations`, checksum/report/status/cursor; data migration version không đồng nghĩa product version. |
| Docker image | Tag bằng build/product version + git SHA; production pin version cụ thể, không pin `latest`. |
| Config | `.env.example` là contract dev/self-host; production secrets không commit. |
| OpenAPI | Update cùng API implementation; dùng làm contract review. |

## 7. Migration strategy

Migration không làm một lần lớn. Luồng chuẩn:

1. Giữ TheHive 4 legacy chạy/read-only reference.
2. Build platform mới theo module nhỏ.
3. Đọc dữ liệu trước: read portal, repository, fixture migration preview.
4. Ghi từng workflow nhỏ: case, alert, task/log/observable.
5. Audit mọi write action.
6. Shadow compare output legacy/new.
7. Migrate data theo batch, có checksum và resumable cursor.
8. Pilot theo user/org/team bằng feature flag.
9. Cutover từng workflow.
10. Giữ TheHive 4 read-only archive cho rollback/đối chiếu.

## 8. Legacy reuse policy

Nên giữ từ TheHive 4:

- Domain language: case, alert, observable, task, log, TLP/PAP, severity, status.
- Analyst workflow: alert triage/import/merge, case timeline, observable analyze, task assignment.
- Permission naming gần legacy để map profile/user dễ hơn.
- Fixture/golden data trong `thehive/test/resources/data`.
- UI visual language: AdminLTE skin-blue, labels, dense tables, detail tabs.

Nên rebuild mới:

- AngularJS UI runtime → Next.js/React.
- Scala/Play core path → Go API + PostgreSQL repositories.
- Legacy storage/search assumptions → MinIO/S3 + OpenSearch.
- Direct integration coupling → adapter/worker queue.
- Manual/implicit migration → versioned/resumable migrator with reports.

## 9. File ownership

- `context.md`: tổng quan project, product, architecture, version roadmap, migration principles.
- `plan.md`: task chi tiết, phase checklist, task đã làm, task chưa làm, đề xuất chi tiết, runbook từng bước.
- `platform/backend/api/openapi.yaml`: API contract hiện hành.
- `platform/backend/migrations/`: database schema history.
- `platform/docs/`: vận hành/observability/SMTP/database docs.

Khi cập nhật tiến độ:

- Cập nhật `plan.md` trước cho task/checklist chi tiết.
- Chỉ cập nhật `context.md` khi có thay đổi lớn về version roadmap, architecture, stack, capability map hoặc migration policy.
