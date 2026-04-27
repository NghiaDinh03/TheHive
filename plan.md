# Production plan chuyển đổi TheHive theo hướng ít rủi ro

> **Cập nhật 2026-04-26 — Phase 1 (v0.1.0) đã chạy được trên Docker Compose.**
> Xem mục [Phase 1 — Trạng thái thực tế](#phase-1--trạng-thái-thực-tế-v010) ở cuối file để xem
> kết quả build, log mẫu, endpoint test, và roadmap Phase 2 dựa trên log thực.

Tài liệu này là plan riêng để review từng phương án trước khi chuyển đổi dần từ source TheHive 4 hiện tại sang một nền tảng SOC/case-management hiện đại hơn, dễ bảo trì hơn, phù hợp production hơn.

Mục tiêu chính:

- Ít rủi ro, ít bug, test được từng bước.
- Không rewrite toàn bộ ngay.
- Có quản lý phiên bản rõ ràng cho code, API, database, config, dữ liệu migration.
- Có plan tích hợp MISP và Cortex ngay từ đầu.
- Có output sản phẩm mong muốn sau từng phase.
- Có công nghệ đề xuất và lý do chọn.

---

## 1. Nhận định nhanh về MISP và Cortex

### 1.1 MISP là gì?

MISP là nơi lưu trữ, quản lý và chia sẻ threat intelligence.

Hiểu đơn giản:

```text
MISP = kho IOC / threat intel
```

MISP lưu các thông tin như:

- IP độc hại.
- Domain phishing.
- URL malware.
- File hash.
- Email sender.
- Threat actor.
- Campaign.
- Malware family.
- Tag, taxonomy, galaxy.

Trong hệ thống mới, MISP nên đóng vai trò:

```text
Nguồn threat intel chính
  -> import IOC vào case/alert
  -> export IOC đã xác nhận từ case ra MISP
  -> đồng bộ IOC giữa các team/tổ chức
```

### 1.2 Cortex là gì? Có giống n8n không?

Cortex không hoàn toàn giống n8n, nhưng có phần giống ở ý tưởng automation.

So sánh dễ hiểu:

| Công cụ | Vai trò chính | Giống workflow automation không? |
|---|---|---|
| Cortex | Chạy analyzer/responder chuyên cho SOC/security | Có, nhưng chuyên cho phân tích và response bảo mật |
| n8n | Workflow automation general-purpose | Có, nhưng không chuyên security mặc định |
| SOAR | Điều phối automation bảo mật nhiều bước | Có, thường rộng hơn Cortex |

Cortex tập trung vào:

- Analyzer: phân tích observable.
- Responder: thực hiện hành động response.

Ví dụ Cortex analyzer:

```text
Input:
  IP = 8.8.8.8

Cortex chạy:
  VirusTotal
  AbuseIPDB
  Shodan
  Passive DNS

Output:
  reputation score
  malicious/clean
  report chi tiết
```

Ví dụ Cortex responder:

```text
Input:
  domain = phishing-example.com

Responder làm:
  block domain trên proxy/firewall
  tạo ticket Jira
  gửi cảnh báo Slack/Mattermost
```

Kết luận:

```text
MISP = nơi lưu threat intel/IOC.
Cortex = nơi chạy phân tích và hành động response cho observable.
n8n = workflow engine tổng quát, có thể dùng bổ sung nhưng không thay Cortex nếu cần analyzer security chuyên dụng.
```

---

## 2. Nguyên tắc production phải tuân thủ

### 2.1 Không rewrite big-bang

Không chuyển toàn bộ hệ thống một lần.

Dùng chiến lược strangler pattern:

```text
TheHive 4 cũ vẫn chạy
  -> build service mới bọc ngoài
  -> chuyển từng workflow sang service mới
  -> test song song
  -> cắt dần phần cũ
```

Lý do:

- Giảm rủi ro mất business logic.
- Dễ rollback.
- Có thể test từng phần.
- Không làm gián đoạn SOC workflow.

### 2.2 Version mọi thứ

Bắt buộc version hóa:

- Source code.
- API contract.
- Database schema.
- Migration script.
- Docker image.
- Docker Compose/Kubernetes manifest.
- Config file.
- Integration mapping.
- Test data.
- Backup format.

### 2.3 Database là phần quan trọng nhất

Database phải có tiêu chuẩn riêng:

- Không sửa schema thủ công trực tiếp trên production.
- Mọi thay đổi schema phải qua migration file.
- Migration phải có mã version.
- Migration phải chạy được nhiều lần an toàn nếu có thể.
- Có backup trước migration.
- Có rollback plan hoặc forward-fix plan.
- Có data validation sau migration.
- Có audit log cho dữ liệu quan trọng.
- Có retention policy.
- Có encryption at rest nếu production yêu cầu.
- Có phân quyền DB user theo nguyên tắc least privilege.

---

## 3. Output sản phẩm mong muốn cuối cùng

Sản phẩm mong muốn không chỉ là clone TheHive, mà là một SOC case-management platform dễ mở rộng.

### 3.1 Output functional

Hệ thống mới nên có:

- Quản lý alert.
- Quản lý case.
- Task/log/timeline trong case.
- Observable và enrichment.
- Attachment/file evidence.
- Custom field.
- Dashboard.
- Multi-organisation hoặc multi-tenant nếu cần.
- Role/profile/permission.
- Notification rule.
- Webhook/API integration.
- MISP import/export.
- Cortex analyzer/responder.
- Audit log.
- Search mạnh.
- Report/export.

### 3.2 Output technical

Hệ thống production nên có:

- Frontend hiện đại, dễ custom UI/UX.
- Backend API rõ ràng, có OpenAPI.
- Database schema versioned.
- Migration pipeline.
- Worker queue cho job async.
- Object storage cho attachment.
- Search engine riêng.
- Auth qua OIDC/SSO.
- Observability đầy đủ.
- Backup/restore tested.
- Docker Compose cho dev/staging.
- Kubernetes-ready cho production nếu cần scale.

---

## 4. Công nghệ đề xuất

### 4.1 Frontend

Đề xuất chính:

```text
React + TypeScript + Next.js
```

Lý do:

- Dễ tuyển developer.
- UI/UX custom nhanh.
- TypeScript giảm bug runtime.
- Next.js hỗ trợ routing, build, SSR nếu cần.
- Ecosystem component/table/form/chart rất mạnh.

Thư viện nên dùng:

| Nhu cầu | Công nghệ đề xuất |
|---|---|
| UI component | Ant Design hoặc MUI |
| Table lớn | TanStack Table |
| Form | React Hook Form + Zod |
| API client | TanStack Query |
| State nhẹ | Zustand |
| Chart/dashboard | ECharts hoặc Recharts |
| Timeline/case activity | custom component + virtual list |

Output mong muốn:

```text
web-ui
  -> analyst thao tác alert/case/observable nhanh
  -> admin quản lý user/org/profile/config
  -> dashboard SOC realtime
```

### 4.2 Backend API

Có 3 lựa chọn tốt.

#### Option A: NestJS + TypeScript

Phù hợp nếu team mạnh JavaScript/TypeScript.

Ưu điểm:

- Cùng language với frontend.
- Làm API nhanh.
- Dễ viết integration service.
- Có module structure rõ.
- Hỗ trợ OpenAPI tốt.

Nhược điểm:

- Cần kiểm soát performance khi workload nặng.
- Job CPU-heavy nên đẩy qua worker riêng.

#### Option B: Go

Phù hợp nếu ưu tiên hiệu năng và binary gọn.

Ưu điểm:

- Hiệu năng tốt.
- Ít tốn RAM.
- Deploy đơn giản.
- Phù hợp service ingest/worker/API hiệu năng cao.

Nhược điểm:

- Build business app nhiều form/rule có thể verbose hơn NestJS.

#### Option C: Kotlin/Spring Boot

Phù hợp nếu team enterprise/Java mạnh.

Ưu điểm:

- Rất ổn cho business backend.
- Security/auth/data migration mature.
- Dễ maintain lâu dài.

Nhược điểm:

- Tốn RAM hơn Go/NestJS.
- Setup ban đầu nặng hơn.

Khuyến nghị:

```text
Nếu team web/fullstack: chọn NestJS + TypeScript.
Nếu team system/backend mạnh: chọn Go cho service hiệu năng cao.
Nếu môi trường enterprise: chọn Kotlin/Spring Boot.
```

Plan thực tế nên dùng:

```text
BFF/API chính: NestJS + TypeScript
Worker hiệu năng cao hoặc collector: Go hoặc Python tùy bài toán
Analyzer custom: Python
```

### 4.3 Worker và automation

Đề xuất:

```text
Python FastAPI + Celery/RQ
hoặc
Node.js worker với BullMQ
```

Lý do:

- Python phù hợp security automation, threat intel, analyzer.
- Nhiều SDK cho VirusTotal, MISP, Shodan, AbuseIPDB.
- Dễ viết script phân tích.
- Worker tách riêng giúp API không bị block.

Nếu dùng Redis queue:

```text
API nhận request
  -> push job vào Redis/BullMQ/Celery
  -> worker xử lý analyzer/responder
  -> ghi kết quả về DB
  -> UI nhận update qua WebSocket/SSE
```

### 4.4 Database chính

Đề xuất:

```text
PostgreSQL
```

Lý do:

- Dễ vận hành hơn Cassandra/JanusGraph.
- Phù hợp dữ liệu case-management.
- Hỗ trợ transaction tốt.
- Hỗ trợ JSONB cho custom field linh hoạt.
- Hỗ trợ full-text search cơ bản.
- Hỗ trợ partitioning nếu data lớn.
- Backup/restore mature.
- Dễ tìm DBA/dev.

Không nên dùng PostgreSQL cho mọi thứ nếu search lớn. Search nên tách sang OpenSearch.

### 4.5 Search/index

Đề xuất:

```text
OpenSearch hoặc Elasticsearch
```

Lý do:

- Search alert/case/observable/log nhanh.
- Full-text tốt.
- Filter theo field tốt.
- Có thể build dashboard/query nâng cao.

Rule:

```text
PostgreSQL = source of truth.
OpenSearch = read/search index, có thể rebuild lại từ PostgreSQL.
```

Không được coi OpenSearch là source of truth.

### 4.6 File storage

Đề xuất:

```text
S3-compatible storage: MinIO cho self-host, AWS S3 nếu cloud.
```

Lý do:

- Attachment/evidence không nên lưu trực tiếp DB.
- Dễ scale.
- Dễ backup/lifecycle policy.
- Dễ scan malware trước/sau upload.
- Dễ dùng pre-signed URL.

### 4.7 Auth/SSO

Đề xuất:

```text
OIDC/OAuth2 qua Keycloak, Azure AD, Okta hoặc Auth0
```

Lý do:

- MFA/SSO chuẩn.
- Không tự maintain password nếu không cần.
- Dễ quản lý user/group/role.
- Audit login tốt hơn.

### 4.8 Message broker

Đề xuất theo scale:

| Scale | Công nghệ |
|---|---|
| Nhỏ/vừa | Redis + BullMQ/RQ |
| Vừa/lớn | RabbitMQ |
| Event streaming lớn | Kafka hoặc Redpanda |

Khuyến nghị ban đầu:

```text
Redis queue trước, RabbitMQ sau nếu workflow phức tạp.
```

---

## 5. Kiến trúc sản phẩm đề xuất

### 5.1 Giai đoạn đầu: modular monolith + worker

Ít rủi ro nhất.

```text
web-ui
  -> api-service
       -> PostgreSQL
       -> OpenSearch
       -> Redis queue
       -> MinIO/S3
  -> worker-service
       -> Cortex adapter
       -> MISP adapter
       -> notification adapter
```

Ưu điểm:

- Dễ build.
- Dễ test.
- Không quá nhiều service.
- Ít overhead hạ tầng.

### 5.2 Giai đoạn sau: tách service khi cần

Chỉ tách khi workload lớn hoặc team đủ lớn.

```text
web-ui
api-gateway / bff
case-service
alert-service
observable-service
integration-service
notification-service
automation-worker
storage-service
```

Nguyên tắc:

```text
Không tách microservice chỉ vì muốn hiện đại.
Chỉ tách khi có lý do rõ: scale, ownership, security boundary, deploy riêng.
```

---

## 6. Database design và tiêu chuẩn versioning

### 6.1 Source of truth

Dữ liệu chính lưu ở PostgreSQL:

- users
- organisations
- roles
- profiles
- alerts
- cases
- tasks
- logs
- observables
- attachments metadata
- custom fields
- dashboards
- notification rules
- integration configs
- audit logs

File binary lưu ở S3/MinIO.

Search index lưu ở OpenSearch.

Threat intel chính có thể nằm ở MISP, nhưng hệ thống nên cache/snapshot IOC cần dùng trong PostgreSQL.

### 6.2 Schema migration tool

Đề xuất:

```text
Flyway hoặc Liquibase
```

Nếu backend là NestJS:

- Có thể dùng Prisma migration hoặc TypeORM migration.
- Nhưng production nghiêm túc nên cân nhắc Flyway vì đơn giản, rõ version SQL.

Khuyến nghị:

```text
Flyway + raw SQL migration
```

Lý do:

- Dễ review.
- Dễ audit.
- Không phụ thuộc ORM quá nhiều.
- DBA đọc được.

### 6.3 Quy chuẩn migration version

Format:

```text
VYYYYMMDDHHMM__short_description.sql
```

Ví dụ:

```text
V202604261000__create_cases_table.sql
V202604261030__create_observables_table.sql
V202604261100__add_case_severity_index.sql
```

Rule:

- Không sửa migration đã chạy ở môi trường shared/prod.
- Nếu cần thay đổi, tạo migration mới.
- Migration phải chạy trong CI trên DB sạch.
- Migration phải chạy trong CI trên DB snapshot gần production nếu có.
- Migration phải có rollback note.

### 6.4 Database version table

Flyway tự tạo bảng version, ví dụ:

```text
flyway_schema_history
```

Ngoài ra nên có bảng app metadata:

```sql
CREATE TABLE app_metadata (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Dùng để lưu:

```text
app_version
schema_version
last_data_migration
search_index_version
```

### 6.5 Data migration version

Schema migration khác data migration.

Ví dụ:

```text
schema migration = tạo bảng cases
data migration = chuyển Case từ TheHive 4 sang bảng cases mới
```

Nên có bảng:

```sql
CREATE TABLE data_migrations (
  id text PRIMARY KEY,
  source_system text NOT NULL,
  source_version text,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  status text NOT NULL,
  checksum text,
  total_records bigint DEFAULT 0,
  success_records bigint DEFAULT 0,
  failed_records bigint DEFAULT 0,
  error_summary text
);
```

Lý do:

- Biết migration nào đã chạy.
- Có thể resume.
- Có log lỗi.
- Có audit.

### 6.6 Audit log tiêu chuẩn

Các thao tác quan trọng phải ghi audit:

- Create/update/delete case.
- Change severity/status/assignee.
- Add/remove observable.
- Run analyzer/responder.
- Export IOC sang MISP.
- Login/logout/token usage.
- Change permission/config.

Bảng audit nên lưu:

```text
id
actor_id
action
entity_type
entity_id
before_json
after_json
ip_address
user_agent
request_id
created_at
```

### 6.7 Backup/restore tiêu chuẩn

Production phải có:

- Backup PostgreSQL định kỳ.
- Backup MinIO/S3 bucket hoặc lifecycle replication.
- Snapshot OpenSearch nếu search index rebuild lâu.
- Backup config/secrets metadata.
- Test restore định kỳ.

Nguyên tắc:

```text
Backup chưa test restore = chưa được coi là backup.
```

### 6.8 Database release checklist

Trước mỗi release có DB change:

- Migration đã chạy pass ở local/test.
- Migration đã chạy pass ở staging snapshot.
- Có backup trước deploy.
- Có estimate lock time.
- Có plan rollback/forward-fix.
- Có query kiểm tra data sau migration.
- Có monitoring slow query/error.

---

## 7. API versioning

### 7.1 Version path

Đề xuất:

```text
/api/v1/...
/api/v2/...
```

Không break contract trong cùng major API.

### 7.2 OpenAPI

Mọi API nên generate OpenAPI spec.

Output:

```text
openapi.yaml
client sdk generated
contract test
```

### 7.3 Backward compatibility

Rule:

- Thêm field mới: OK.
- Xóa/đổi meaning field: phải qua version mới.
- Đổi enum/status: phải migration và mapping rõ.

---

## 8. Feature migration plan

### Phase 0: Baseline TheHive 4 hiện tại

Mục tiêu:

- Chạy được TheHive 4 bằng Docker Compose.
- Có dữ liệu test.
- Hiểu workflow thật.

Output:

- docker-compose baseline.
- context.md.
- plan.md.
- test dataset.
- danh sách API/workflow cần giữ.

Rủi ro thấp.

### Phase 1: Read-only UI/BFF mới

Mục tiêu:

- UI mới đọc data/API cũ.
- Không ghi dữ liệu.

Output:

- web-ui mới.
- BFF/API adapter gọi TheHive API cũ.
- Màn hình list alert/case/observable read-only.

Lý do ít rủi ro:

- Không ảnh hưởng dữ liệu.
- Có thể so sánh UI mới với UI cũ.

### Phase 2: Integration service cho MISP/Cortex

Mục tiêu:

- Tách integration khỏi core.
- Chuẩn hóa adapter.

Output:

- misp-adapter.
- cortex-adapter.
- job queue.
- job result schema.
- retry/dead-letter.

Workflow:

```text
observable created
  -> enqueue enrichment job
  -> Cortex analyzer chạy
  -> result lưu vào enrichment_results
  -> UI hiển thị report
```

MISP workflow:

```text
MISP event imported
  -> tạo alert draft
  -> map attributes thành observables
  -> analyst review
```

### Phase 3: Write workflow mới cho alert/case phụ

Mục tiêu:

- Cho phép tạo alert/case trong hệ mới với scope nhỏ.

Output:

- alert-service hoặc module alert trong API mới.
- case-service hoặc module case trong API mới.
- PostgreSQL schema v1.
- audit log.

Scope nên nhỏ:

```text
Chỉ support alert/case basic trước.
Chưa migrate toàn bộ feature phức tạp.
```

### Phase 4: Migration dữ liệu

Mục tiêu:

- Migrate dữ liệu từ TheHive 4 sang PostgreSQL schema mới.

Output:

- migration tool.
- mapping document.
- migration report.
- validation report.

Mapping cần có:

```text
TheHive Case -> new cases
TheHive Alert -> new alerts
TheHive Observable -> new observables
TheHive Task -> new tasks
TheHive Log -> new case_logs
TheHive Attachment metadata -> new attachments
```

### Phase 5: Cutover từng workflow

Mục tiêu:

- Chuyển từng nhóm user/workflow sang hệ mới.

Output:

- production pilot.
- rollback procedure.
- monitoring dashboard.

Chiến lược:

```text
Team nhỏ dùng trước
  -> compare output
  -> fix bug
  -> mở rộng scope
```

### Phase 6: Decommission hoặc giữ TheHive cũ read-only

Mục tiêu:

- Không phụ thuộc TheHive 4 cho workflow mới.

Output:

- TheHive 4 read-only archive hoặc shutdown.
- Data export lưu trữ.
- Final migration sign-off.

---

## 9. Plan tích hợp MISP

### 9.1 MISP use cases

- Import MISP event thành alert.
- Import MISP attributes thành observables.
- Export IOC từ case sang MISP.
- Sync tag/taxonomy.
- Link case với MISP event.
- Deduplicate IOC.

### 9.2 MISP adapter design

Service/module:

```text
integration-service/misp-adapter
```

Bảng cần có:

```text
misp_connections
misp_sync_jobs
misp_event_links
ioc_sources
```

### 9.3 Mapping ví dụ

```text
MISP Event.uuid       -> external_refs.external_id
MISP Event.info       -> alert.title
MISP Attribute.value  -> observable.value
MISP Attribute.type   -> observable.type
MISP Tag              -> tags
MISP Galaxy           -> threat_context
```

### 9.4 Rủi ro MISP

- IOC trùng lặp.
- Tag/taxonomy không thống nhất.
- API key lộ.
- Import quá nhiều gây noise.
- Sync loop nếu export/import không kiểm soát.

Giảm rủi ro:

- Dedup bằng type + value + source.
- Có import preview.
- Có allowlist feed/source.
- Có sync direction rõ: import-only/export-only/bidirectional.
- Có audit log export.

---

## 10. Plan tích hợp Cortex

### 10.1 Cortex use cases

- Run analyzer trên observable.
- Lưu enrichment result.
- Hiển thị report trong case.
- Run responder khi analyst duyệt.
- Tự động chạy analyzer theo rule.

### 10.2 Cortex adapter design

Service/module:

```text
integration-service/cortex-adapter
```

Bảng cần có:

```text
cortex_connections
analyzer_catalog
responder_catalog
enrichment_jobs
enrichment_results
response_jobs
```

### 10.3 Workflow analyzer

```text
Analyst click Analyze observable
  -> API tạo enrichment_jobs
  -> worker gọi Cortex API
  -> poll job result
  -> lưu enrichment_results
  -> UI update report
```

### 10.4 Workflow responder

```text
Analyst chọn responder
  -> hệ thống kiểm tra permission
  -> tạo response_jobs
  -> worker gọi Cortex responder
  -> lưu kết quả
  -> ghi audit log
```

### 10.5 Cortex vs n8n trong hệ mới

Có thể dùng cả hai nếu cần:

```text
Cortex:
  analyzer/responder bảo mật chuyên dụng

n8n:
  workflow IT/business automation tổng quát
```

Ví dụ kết hợp:

```text
Cortex xác định IP malicious
  -> hệ thống tạo event
  -> n8n nhận webhook
  -> n8n tạo Jira ticket + gửi Teams + gọi firewall API
```

Nhưng nếu muốn đơn giản giai đoạn đầu:

```text
Chỉ tích hợp Cortex trước.
Chưa đưa n8n vào core path.
```

---

## 11. Testing strategy để ít bug

### 11.1 Test pyramid

- Unit test cho domain logic.
- Integration test cho DB/API/MISP/Cortex adapter.
- Contract test cho API.
- E2E test cho workflow chính.
- Migration test cho dữ liệu.

### 11.2 Golden dataset

Tạo bộ dữ liệu chuẩn:

```text
sample alerts
sample cases
sample observables
sample MISP events
sample Cortex reports
sample users/roles/orgs
```

Dùng để test mỗi release.

### 11.3 Shadow mode

Khi build service mới, chạy shadow mode:

```text
Request vẫn xử lý ở hệ cũ
Hệ mới nhận copy event và xử lý thử
So sánh output
Không ảnh hưởng production
```

### 11.4 Feature flag

Mọi feature mới nên bật bằng flag:

```text
FEATURE_NEW_CASE_UI=false
FEATURE_MISP_IMPORT=false
FEATURE_CORTEX_AUTO_ANALYZE=false
```

Lợi ích:

- Bật/tắt nhanh.
- Rollback không cần deploy lại.
- Pilot theo user/org.

---

## 12. Release và versioning

### 12.1 Git branching

Đề xuất:

```text
main        -> stable production
develop     -> integration branch
feature/*   -> feature branch
release/*   -> release candidate
hotfix/*    -> urgent fix
```

Nếu team nhỏ, có thể trunk-based:

```text
main + short-lived feature branches + feature flags
```

### 12.2 Semantic versioning

Format:

```text
MAJOR.MINOR.PATCH
```

Ví dụ:

```text
0.1.0 = prototype
0.5.0 = staging pilot
1.0.0 = production initial
1.1.0 = thêm MISP import
1.2.0 = thêm Cortex responder
```

### 12.3 Docker image tag

Không dùng latest cho production.

Dùng:

```text
app-name:1.2.3
app-name:1.2.3-gitsha
```

Ví dụ:

```text
soc-api:1.2.0-a1b2c3d
soc-web:1.2.0-a1b2c3d
soc-worker:1.2.0-a1b2c3d
```

### 12.4 Config version

Config cũng phải version.

Ví dụ:

```text
config/application.v1.yaml
config/integrations.misp.v1.yaml
config/integrations.cortex.v1.yaml
```

Production secrets không commit vào git.

---

## 13. Security baseline

Production cần:

- OIDC/SSO.
- MFA.
- RBAC rõ ràng.
- API key scoped permission.
- Secrets manager.
- TLS everywhere.
- Audit log immutable hoặc append-only.
- Rate limit.
- Input validation.
- Attachment malware scanning.
- Dependency scanning.
- Container image scanning.
- SAST/DAST cơ bản.

---

## 14. Observability baseline

Cần có:

- Structured JSON logs.
- Request ID/correlation ID.
- Metrics Prometheus.
- Dashboard Grafana.
- Log aggregation Loki/ELK.
- Error tracking Sentry hoặc OpenTelemetry collector.
- Alert khi queue backlog tăng.
- Alert khi DB slow query.
- Alert khi disk/object storage gần đầy.

---

## 15. Production deployment recommendation

### 15.1 Dev/local

```text
Docker Compose
PostgreSQL
Redis
MinIO
OpenSearch optional
Mock MISP/Cortex hoặc dev instances
```

### 15.2 Staging

```text
Docker Compose hoặc Kubernetes namespace riêng
DB snapshot gần production nhưng đã mask sensitive data
MISP/Cortex staging
Full migration test
```

### 15.3 Production

```text
Kubernetes hoặc Docker Compose hardening tùy quy mô
Managed PostgreSQL nếu có thể
Managed OpenSearch nếu có thể
S3/MinIO replicated
Secrets manager
Backup tested
Monitoring đầy đủ
```

---

## 16. Roadmap đề xuất để duyệt từng phương án

### Milestone 1: Baseline TheHive 4 Docker

Output:

- TheHive 4 chạy ổn bằng Compose.
- Có backup volume.
- Có tài liệu vận hành.

### Milestone 2: Architecture prototype

Output:

- Repo/service skeleton.
- PostgreSQL schema draft.
- OpenAPI draft.
- UI mockup.
- MISP/Cortex adapter mock.

### Milestone 3: Read-only portal

Output:

- UI mới xem alert/case/observable.
- BFF gọi TheHive API cũ.
- Không ghi data.

### Milestone 4: Integration MVP

Output:

- MISP import preview.
- Cortex analyze observable.
- Lưu result vào DB mới.
- UI hiển thị enrichment result.

### Milestone 5: Case management MVP

Output:

- Tạo case mới.
- Task/log/observable cơ bản.
- Attachment qua MinIO/S3.
- Audit log.

### Milestone 6: Migration pilot

Output:

- Migration tool.
- Migration report.
- Data validation report.
- Pilot với dataset thật đã mask.

### Milestone 7: Production pilot

Output:

- Một team nhỏ dùng thật.
- Feature flag.
- Monitoring.
- Rollback plan.

### Milestone 8: Cutover

Output:

- Workflow chính chạy trên hệ mới.
- TheHive 4 chuyển read-only hoặc archive.

---

## 17. Phase 1.5 — Read-only investigation portal (đã bổ sung 2026-04-26)

Mục tiêu của phiên này là không đọc log trước khi hoàn thành các phase skeleton/read-only, mà tiếp tục nâng cấp theo `context.md` và `plan.md` để bắt đầu port UI/BFF read-only từ TheHive 4 sang TypeScript/Go.

### 17.1 Đã làm

Backend Go:

- Thêm handler read-only `platform/backend/internal/handler/readonly.go` cho 3 collection cốt lõi: cases, alerts, observables.
- Đăng ký API mới trong `platform/backend/internal/server/server.go`:
  - `GET /api/v1/cases`
  - `GET /api/v1/alerts`
  - `GET /api/v1/observables`
- Response hiện là dataset demo/shadow-read-only, giữ shape gần TheHive 4 list views để frontend có thể port UI trước khi nối legacy API/database thật.

Frontend TypeScript/Next.js:

- Thêm trang `platform/frontend/src/app/investigation/page.tsx` làm read-only portal cho cases / alerts / observables.
- Cập nhật `platform/frontend/src/components/Sidebar.tsx` để bật navigation Investigation, Alerts, Cases, Observables vào read-only portal.
- Bổ sung style bảng/list/tag/TLP/severity trong `platform/frontend/src/styles/globals.css`, bám theo TheHive 4 AdminLTE/table/case-list/tag style.
- Giữ UX read-only/shadow-mode để tránh ảnh hưởng dữ liệu trong giai đoạn chuyển đổi.

### 17.2 Các file legacy đã dùng làm tham chiếu style/UX

- `frontend/app/views/partials/case/case.list.html`
- `frontend/app/views/partials/alert/list.html`
- `frontend/app/views/partials/observables/list/observables.html`
- `frontend/app/views/components/header.component.html`
- `frontend/app/styles/main.css`
- `frontend/app/styles/vendors/AdminLTE-skin-blue.css`

### 17.3 Cập nhật thực hiện tiếp trong phiên này (2026-04-26)

Backend Go:

- [x] Tiếp tục Phase 1.6 legacy API adapter ở mức an toàn/read-only:
  - Thêm `LegacyClient` trong `platform/backend/internal/handler/readonly.go` để Go BFF có thể gọi TheHive 4 legacy khi cấu hình `LEGACY_THEHIVE_URL`.
  - Thêm cấu hình `LEGACY_THEHIVE_URL`, `LEGACY_THEHIVE_API_KEY`, `LEGACY_THEHIVE_TIMEOUT` trong `platform/backend/internal/config/config.go`.
  - Wire adapter vào route `/api/v1/cases`, `/api/v1/alerts`, `/api/v1/observables` trong `platform/backend/internal/server/server.go`.
  - Giữ fallback demo/shadow data nếu legacy URL chưa cấu hình hoặc legacy API lỗi, bảo đảm review UI không bị chặn.
  - Forward `X-Request-ID` sang legacy call để trace request.
- [x] Bổ sung contract OpenAPI Phase 1.7 bước đầu trong `platform/backend/api/openapi.yaml`:
  - Thêm tag `investigation`.
  - Document `GET /api/v1/cases`.
  - Document `GET /api/v1/alerts`.
  - Document `GET /api/v1/observables`.
  - Thêm schema `CaseSummary`, `AlertSummary`, `ObservableSummary` và collection mode `demo-read-only` / `legacy-read-only`.

Frontend TypeScript/Next.js:

- [x] Tiếp tục Phase 1.8 UI parity pass ở mức read-only:
  - Cập nhật `platform/frontend/src/app/investigation/page.tsx` để có tab Cases / Alerts / Observables tương tự list navigation.
  - Thêm filter dùng chung cho cases, alerts, observables.
  - Thêm bulk-selection checkbox read-only và filterbar hiển thị số result/selected để bám UX table/list của TheHive 4 nhưng chưa cho phép action ghi dữ liệu.
  - Hiển thị mode backend (`demo-read-only` hoặc `legacy-read-only`) để biết đang review bằng data demo hay legacy adapter.
- [x] Bổ sung style UI trong `platform/frontend/src/styles/globals.css`:
  - `.thehive-tabs` cho tab list.
  - `.thehive-filterbar` cho thanh filter/bulk read-only.

Docker Compose / cấu hình review:

- [x] Cập nhật `platform/deploy/docker-compose.yml` để truyền legacy adapter env vào backend container.
- [x] Cập nhật `platform/deploy/.env.example` với biến legacy adapter, mặc định rỗng để chạy demo/shadow mode an toàn.
- [x] Build Docker Compose thành công cho backend và frontend:
  - Command đã chạy: `docker compose -f platform\deploy\docker-compose.yml --env-file platform\deploy\.env.example build backend frontend`.
  - Kết quả: `thehive-platform-backend:0.1.0` và `thehive-platform-frontend:0.1.0` build thành công.
- [x] Đã chạy Docker Compose để review:
  - Command đã chạy: `docker compose -f platform\deploy\docker-compose.yml --env-file platform\deploy\.env.example up -d`.
  - Kết quả: postgres/rabbitmq/backend/frontend started, backend healthy, frontend started.
- [x] Smoke test tối thiểu:
  - `http://localhost:8080/readyz` trả status `ok`.
  - `http://localhost:8080/api/v1/cases` trả response thành công.
  - `http://localhost:3000/api/healthz` trả status `ok`.

### 17.4 Chưa hoàn thành / giới hạn hiện tại

- [ ] Chưa thể bảo đảm “giống 100% TheHive 4” vì cần baseline screenshot/DOM hành vi từng màn hình và test visual regression; hiện mới bám màu, layout table/list, tag/TLP/severity và AdminLTE skin-blue ở mức migration skeleton/read-only.
- [ ] Legacy adapter mới gọi endpoint REST phổ biến (`/api/case`, `/api/alert`, `/api/case/artifact`) và normalize field best-effort; chưa implement query DSL chính xác `listCase`, `listAlert`, `observables` theo toàn bộ semantics TheHive 4.
- [ ] Chưa có retry/backoff/circuit-breaker cho legacy adapter; hiện có timeout và fallback demo an toàn.
- [ ] Chưa generate typed frontend client từ OpenAPI; frontend type hiện vẫn khai báo thủ công trong page.
- [ ] Chưa có contract test tự động giữa OpenAPI và handler response.
- [ ] Chưa có auth/RBAC thật, permission gate, organisation/profile mapping.
- [ ] Chưa có PostgreSQL schema nghiệp vụ cho cases/alerts/observables/tasks/users/attachments/custom-fields/audit đầy đủ.
- [ ] Chưa implement write workflow: create/update/close/reopen/merge case, import/merge alert, task/log/observable write, Cortex/MISP adapter, search/dashboard/audit, data migrator.
- [ ] Local Windows host không có `gofmt` trong PATH nên không chạy được `gofmt`/`go test` trực tiếp trên host; Docker build Go vẫn thành công trong container.

### 17.5 Phase đề xuất tiếp theo để migrate đủ TheHive 4 sang TypeScript/Go

- [ ] Phase 1.6.1 — Legacy query parity thật:
  - Implement TheHive 4 query API đúng semantics cho `listCase`, `listAlert`, observable list theo case/global.
  - Thêm query params `range`, `sort`, `filter`, `nparent`, `stats` tương thích list view legacy.
  - Thêm retry có backoff, circuit breaker, log lỗi có `request_id`, metric `legacy_request_duration_seconds`.
  - Thêm mapping test bằng fixture JSON legacy thật/masked.
- [ ] Phase 1.7.1 — Contract/type generation:
  - Chuẩn hóa `platform/backend/api/openapi.yaml` đầy đủ pagination/filter/sort/error.
  - Generate TypeScript client hoặc shared schema cho frontend.
  - Thêm contract test backend so sánh handler response với OpenAPI schema.
- [ ] Phase 1.8.1 — UI/UX parity hardening:
  - Tách component `CaseList`, `AlertList`, `ObservableList`, `FilterPanel`, `BulkActionBar`, `MiniStats`.
  - Port filter panel nâng cao của TheHive 4: severity, TLP/PAP, owner/assignee, status, tags, date range, data type.
  - Thêm screenshot baseline từ TheHive 4 và visual regression để tiến tới exact spacing/color/icon.
- [ ] Phase 2.0 — Auth/RBAC thật:
  - Users/orgs/profiles/permissions từ PostgreSQL hoặc legacy adapter.
  - Session/token guard, route protection, permission gate tương đương `manageCase`, `manageAlert`, `manageObservable`.
- [ ] Phase 2.5 — Database schema core v1:
  - PostgreSQL migrations cho users, organisations, profiles, cases, alerts, tasks, observables, attachments metadata, custom fields, audit logs.
  - Versioned schema + rollback migration + seed/test fixtures.
- [ ] Phase 3.0 — Case/alert write MVP:
  - Create/update/close/reopen/merge case.
  - Import/merge alert.
  - Audit log đầy đủ, feature flag, rollback path, shadow compare với TheHive 4.
- [ ] Phase 4.0 — Task/log/observable parity:
  - Task lifecycle, task logs/timeline, observable create/update/delete/analyze UI.
  - Attachment metadata và MinIO/S3.
- [ ] Phase 5.0 — Cortex adapter:
  - Analyzer/responder catalog, job queue, enrichment result persistence, report renderer parity.
- [ ] Phase 6.0 — MISP adapter:
  - Import preview, event/attribute mapping, IOC dedup, taxonomy/tag sync, export case IOC sang MISP.
- [ ] Phase 7.0 — Search/dashboard/audit:
  - OpenSearch index, global search parity, dashboards, audit stream, monitoring dashboards.
- [ ] Phase 8.0 — Data migration pilot:
  - Migrator từ TheHive 4 dataset sang PostgreSQL, checksum, validation report, resumable `data_migrations` table.
- [ ] Phase 9.0 — Production cutover:
  - Feature flags per org/team, shadow compare, rollback, TheHive 4 read-only archive.

### 17.6 Big update tiếp theo đã thực hiện (2026-04-27)

Backend / database:

- [x] Bổ sung migration core investigation schema `platform/backend/migrations/000002_core_investigation_schema.up.sql`.
- [x] Bổ sung rollback migration `platform/backend/migrations/000002_core_investigation_schema.down.sql`.
- [x] Schema mới đã mở đường cho production core thay vì chỉ demo data:
  - `organisations`
  - `profiles`
  - `users`
  - `cases`
  - `alerts`
  - `observables`
  - `task_items`
  - `case_logs`
  - `attachments`
  - `custom_fields`
  - `data_migrations`
- [x] Thêm index cần thiết cho list/search phase đầu: status, updated date, source/reference, data type, data, tags GIN.
- [x] Giữ migration versioned để rollback/review được và không phá legacy TheHive 4.

Frontend UI/UX parity:

- [x] Nâng cấp mạnh trang `platform/frontend/src/app/investigation/page.tsx` theo cấu trúc list legacy TheHive 4:
  - Tách table render thành `CaseTable`, `AlertTable`, `ObservableTable`.
  - Case list đổi layout gần legacy hơn: TLP bar bên trái, checkbox, Status, `# Number / Title`, Severity, Details, Assignee, Dates.
  - Alert list đổi layout gần legacy hơn: checkbox, Severity, Read, Title, # Case, Type, Source, Reference, Observables, Dates.
  - Observable list thêm các cột TLP, IOC, Type, Value, Case, Created by, Dates.
  - Thêm mini stats panel màu đỏ/cam/xanh tương tự AdminLTE info boxes.
  - Thêm Advanced filters panel read-only với các filter đúng domain: status, severity, TLP/PAP, assignee, owner, tags, dates, source, type, data type, IOC, sighted.
  - Thêm toolbar toggle Stats/Filters, filter preview, bulk action bar read-only gồm Merge/Close/Assign/Export.
- [x] Nâng cấp CSS trong `platform/frontend/src/styles/globals.css`:
  - `.thehive-toolbar`
  - `.thehive-filter-panel`
  - `.filter-grid`
  - `.filters-preview`
  - `.legacy-case-list`
  - `.tlp-bar` / `.bg-tlp-*`
  - `.label-*`
  - `.date-stack`, `.details-stack`, `.case-status .duration`
  - `.mini-stat-*`

Tooling / validation:

- [x] Đã tải Go portable vào `C:\Users\nghia\.thehive-tools\go1.22.12.windows-amd64.zip`, không lưu trong project và không ảnh hưởng source tree.
- [ ] Chưa extract được Go portable vì terminal tải/extract trước đó vẫn đang giữ lock file zip; sẽ xử lý lại sau khi process nhả file hoặc dùng zip copy khác.
- [x] Docker Compose build backend/frontend thành công sau big update:
  - `docker compose -f platform\deploy\docker-compose.yml --env-file platform\deploy\.env.example build backend frontend`.
- [x] Docker Compose review đã up lại thành công:
  - `docker compose -f platform\deploy\docker-compose.yml --env-file platform\deploy\.env.example up -d`.
- [x] Smoke check sau build:
  - backend `/readyz` status `ok`.
  - frontend `/api/healthz` status `ok`.

### 17.7 Chưa hoàn thành sau big update

- [ ] Chưa hoàn thành full migration production TheHive 4 sang TypeScript/Go; mới là schema core + BFF/read-only + UI parity hardening.
- [ ] Chưa nối PostgreSQL schema mới vào repository/service thật; handler vẫn ưu tiên legacy adapter hoặc demo fallback.
- [ ] Chưa implement write APIs cho case/alert/task/log/observable.
- [ ] Chưa implement real auth/RBAC từ bảng users/orgs/profiles.
- [ ] Chưa implement Cortex/MISP adapters production.
- [ ] Chưa implement OpenSearch dashboard/global search.
- [ ] Chưa implement MinIO/S3 attachment storage.
- [ ] Chưa implement data migrator thực sự từ TheHive 4 sang PostgreSQL.
- [ ] Chưa đạt “100% UI/UX parity”; hiện đã gần hơn về cấu trúc bảng/list/filter/AdminLTE nhưng vẫn cần screenshot baseline và visual diff cho từng màn hình.
- [ ] Portable Go host toolchain còn pending do zip bị lock bởi terminal tải/extract trước.

### 17.8 Phase tiếp theo chi tiết

- [ ] Phase 2.0.1 — Database-backed read repository:
  - Tạo package repository/service cho cases, alerts, observables đọc từ PostgreSQL.
  - Thêm env chọn source: `demo`, `legacy`, `postgres`.
  - Seed data development từ sample hiện tại vào migration hoặc seed script riêng.
  - API `/api/v1/cases`, `/api/v1/alerts`, `/api/v1/observables` dùng repository interface thay vì hardcode handler.
- [ ] Phase 2.0.2 — Auth/RBAC thật:
  - Đọc users/orgs/profiles từ PostgreSQL.
  - JWT claims gồm org/profile/permissions.
  - Middleware permission guard cho investigation routes.
  - UI ẩn/disable bulk/write actions theo permission.
- [ ] Phase 3.0.1 — Case write MVP:
  - `POST /api/v1/cases`.
  - `PATCH /api/v1/cases/{id}`.
  - `POST /api/v1/cases/{id}/close`.
  - `POST /api/v1/cases/{id}/reopen`.
  - Audit log cho mọi write action.
- [ ] Phase 3.0.2 — Alert import/merge MVP:
  - `POST /api/v1/alerts/{id}/import`.
  - `POST /api/v1/alerts/{id}/merge`.
  - Shadow compare với TheHive 4 legacy adapter.
- [ ] Phase 4.0.1 — Task/log/observable parity:
  - Task lifecycle APIs/UI.
  - Case timeline/log APIs/UI.
  - Observable create/update/delete/analyze UI.
- [ ] Phase 4.0.2 — Attachment storage:
  - MinIO/S3 compose service.
  - Attachment metadata DB + signed download/upload URL.
- [ ] Phase 5.0 — Cortex adapter production:
  - Analyzer/responder catalog.
  - RabbitMQ worker/job queue.
  - Enrichment result persistence và report renderer.
- [ ] Phase 6.0 — MISP adapter production:
  - Event import preview.
  - Attribute mapping/dedup.
  - Taxonomy/tag sync.
  - Export case IOC sang MISP.
- [ ] Phase 7.0 — Search/dashboard/audit:
  - OpenSearch service/indexer.
  - Global search.
  - Dashboard widgets.
  - Audit stream UI.
- [ ] Phase 8.0 — Data migration pilot:
  - Resumable migration runner dùng `data_migrations`.
  - Checksum/validation report.
  - Masked real dataset pilot.
- [ ] Phase 9.0 — Cutover hardening:
  - Feature flags per org/team.
  - Shadow compare metrics.
  - Rollback runbook.
  - TheHive 4 read-only archive mode.

### 17.9 Phase 2.0.1 tiếp tục đã thực hiện (2026-04-27)

- [x] Đã đọc lại `context.md` và `plan.md` trước khi code tiếp để cập nhật tình hình.
- [x] Cài đặt/khôi phục Go portable ngoài project tại `C:\Users\nghia\.thehive-tools\go`, không ghi toolchain vào source tree.
- [x] Chạy format bằng Go portable:
  - `C:\Users\nghia\.thehive-tools\go\bin\gofmt.exe -w platform\backend\internal\handler\readonly.go platform\backend\internal\config\config.go platform\backend\internal\server\server.go`.
- [x] Chạy Go test bằng portable Go:
  - `cd platform\backend && C:\Users\nghia\.thehive-tools\go\bin\go.exe test ./...`.
- [x] Implement source-switch cho investigation read API:
  - Thêm `INVESTIGATION_DATA_SOURCE` trong `platform/backend/internal/config/config.go` với mặc định `demo`.
  - Hỗ trợ 3 mode đọc: `demo`, `legacy`, `postgres`.
  - Wire source mode vào `platform/backend/internal/server/server.go`.
- [x] Implement PostgreSQL-backed read path trong `platform/backend/internal/handler/readonly.go`:
  - `GET /api/v1/cases` có thể đọc từ bảng `cases`, join `task_items`, `observables`, `alerts` để trả counts.
  - `GET /api/v1/alerts` có thể đọc từ bảng `alerts`, join `cases`, `observables`.
  - `GET /api/v1/observables` có thể đọc từ bảng `observables`, join `cases`.
  - Nếu source postgres/legacy lỗi thì fallback demo data an toàn để UI vẫn review được.
- [x] Update cấu hình Docker Compose:
  - Thêm `INVESTIGATION_DATA_SOURCE` vào `platform/deploy/docker-compose.yml`.
  - Thêm mô tả `demo | legacy | postgres` vào `platform/deploy/.env.example`.
- [x] Update OpenAPI:
  - Thêm `postgres-read-only` vào enum `CollectionMode` trong `platform/backend/api/openapi.yaml`.
- [x] Build/review:
  - Docker Compose build backend/frontend thành công.
  - Docker Compose up backend/frontend thành công.
  - Smoke check backend `/readyz`, backend `/api/v1/cases`, frontend `/api/healthz` thành công.

### 17.10 Chưa hoàn thành sau Phase 2.0.1

- [ ] PostgreSQL read mode đã có query path nhưng chưa seed dữ liệu production/dev vào core tables, nên mode `postgres` cần data migration/seed để có record thật.
- [ ] Chưa tách repository package riêng; hiện query DB nằm trong handler để đi nhanh theo yêu cầu big update.
- [ ] Chưa implement write APIs và audit write transaction.
- [ ] Chưa implement auth/RBAC thật dù schema users/orgs/profiles đã có.
- [ ] Chưa implement migration runner từ legacy dataset sang PostgreSQL.
- [ ] Chưa implement exact query DSL TheHive 4 với pagination/filter/sort đầy đủ.
- [ ] Chưa có MinIO/S3, OpenSearch, Cortex worker, MISP worker.

### 17.11 Phase tiếp theo chi tiết

- [ ] Phase 2.0.2 — Refactor repository/service:
  - Tạo `internal/repository` cho cases/alerts/observables.
  - Tạo interface `InvestigationReader` để handler không chứa SQL.
  - Thêm unit tests cho mapping DB -> API shape.
- [ ] Phase 2.0.3 — Seed/data migration preview:
  - Tạo seed script/dev migration cho dataset mẫu.
  - Tạo migrator đọc JSON fixture TheHive 4 trong `thehive/test/resources/data`.
  - Ghi tiến độ vào `data_migrations`.
- [ ] Phase 2.1 — Auth/RBAC thật:
  - Đọc user/profile/org từ PostgreSQL.
  - JWT claims permissions.
  - Middleware permission guard.
  - UI disable action theo permission.
- [ ] Phase 3.0 — Write MVP:
  - Create/update/close/reopen case.
  - Import/merge alert.
  - Audit logs transaction-safe.
- [ ] Phase 4.0 — Task/log/observable write parity:
  - Task lifecycle.
  - Case timeline/logs.
  - Observable create/update/delete/analyze.
- [ ] Phase 5.0+ — Production integrations:
  - Cortex worker.
  - MISP worker.
  - MinIO/S3 attachments.
  - OpenSearch index/search/dashboard.
  - Cutover shadow compare/rollback.

### 17.12 Phase 2.1 — Production PostgreSQL auth/register + 50-task backlog (2026-04-27)

Đã làm tiếp trong phiên này:

- [x] Đọc lại `context.md` và `plan.md` để xác nhận các phase còn mở.
- [x] Thêm migration `platform/backend/migrations/000003_auth_local_accounts.up.sql` cho local account production:
  - `users.password_hash`
  - `users.locked`
  - `users.last_login_at`
  - seed organisation `admin`
  - seed profile `admin` với permission gần TheHive.
- [x] Thêm rollback `platform/backend/migrations/000003_auth_local_accounts.down.sql`.
- [x] Thay mock auth bằng PostgreSQL auth foundation trong `platform/backend/internal/handler/auth.go`:
  - Login đọc user từ PostgreSQL.
  - Password dùng bcrypt.
  - `GET /api/v1/auth/me` trả organisation/profile/permissions từ DB.
  - `POST /api/v1/auth/register` tạo organisation nếu chưa có và tạo user local.
- [x] Đăng ký route `POST /api/v1/auth/register` trong `platform/backend/internal/server/server.go`.
- [x] Đổi default investigation source sang production PostgreSQL:
  - `platform/backend/internal/config/config.go`: `INVESTIGATION_DATA_SOURCE` mặc định `postgres`.
  - `platform/deploy/docker-compose.yml`: backend env mặc định `postgres`.
  - `platform/deploy/.env.example`: ghi rõ production default là `postgres`.
- [x] Cập nhật frontend login/register trong `platform/frontend/src/app/login/page.tsx`:
  - Có tab Sign in / Register.
  - Register gồm login, name, organisation, password.
  - UI vẫn giữ style TheHive/AdminLTE.
- [x] Cập nhật style auth tab trong `platform/frontend/src/styles/globals.css`.
- [x] Cập nhật OpenAPI trong `platform/backend/api/openapi.yaml`:
  - Thêm `POST /api/v1/auth/register`.
  - Thêm schema `RegisterRequest`.
- [x] Chạy format Go bằng portable Go.
- [x] Chạy `go test ./...` backend thành công.
- [x] Docker Compose build backend/frontend thành công.
- [x] Docker Compose up thành công.
- [x] Smoke check `/readyz` và frontend `/api/healthz` thành công.

### 17.13 Phase 2.0.3 / 2.0.4 / 2.1 tiếp tục đã thực hiện (2026-04-27)

Backend investigation query parity:

- [x] Thêm query parser `range`, `sort`, `filter` và filter fields riêng trong `platform/backend/internal/repository/investigation/types.go`.
- [x] Collection response hiện trả `values`, `total`, `mode`, `range`, `sort`, `filters`.
- [x] `platform/backend/internal/handler/readonly.go` parse query params cho cases/alerts/observables.
- [x] `platform/backend/internal/repository/investigation/postgres.go` hỗ trợ pagination, total count, safe sort allowlist, filters.
- [x] `platform/backend/internal/repository/investigation/legacy.go` forward best-effort range/sort/filter sang legacy adapter và fallback an toàn.
- [x] `platform/backend/internal/repository/investigation/demo.go` hỗ trợ filter/sort/page cho demo mode.
- [x] `platform/backend/api/openapi.yaml` bổ sung params `range`, `sort`, filters và metadata schema.

Fixture migration preview:

- [x] Tạo package `platform/backend/internal/fixturemigrate` đọc fixture legacy `Case.json`, `Alert.json`, `Observable.json`.
- [x] Tính SHA-256 checksum cho fixture và combined checksum.
- [x] Upsert fixture vào PostgreSQL tables `cases`, `alerts`, `observables`.
- [x] Ghi report/checksum vào bảng `data_migrations`.
- [x] Tạo command `platform/backend/cmd/fixturemigrate`.
- [x] Chạy migration preview thật vào Docker PostgreSQL thành công:
  - `cases`: 13
  - `alerts`: 6
  - `observables`: 13
- [x] Smoke test API có JWT bearer và PostgreSQL mode thành công:
  - `GET /api/v1/cases?range=0:9&sort=number:ASC`
  - `GET /api/v1/alerts?source=testSource&range=0:9`
  - `GET /api/v1/observables?dataType=domain&range=0:9`

Frontend query parity:

- [x] `platform/frontend/src/lib/api.ts` tự gắn bearer token từ `sessionStorage`.
- [x] `platform/frontend/src/app/investigation/page.tsx` gửi backend params `range`, `sort`, filters.
- [x] UI hiển thị metadata `range`, `total`, `sort`, `filters` trên filterbar.
- [x] Table header click đổi sort field/order.
- [x] Filter panel gửi filter thật cho status/severity/tlp/pap/tags/assignee/owner/source/dataType.
- [x] Thêm loading/error state cho investigation list.
- [x] Disable bulk action theo permissions từ `/api/v1/auth/me`.

Auth/RBAC foundation:

- [x] Thêm package `platform/backend/internal/authjwt` ký và parse JWT HS256 với claims `login`, `organisation`, `profile`, `permissions`.
- [x] Thêm migration `platform/backend/migrations/000004_auth_sessions.up.sql` cho `auth_sessions`.
- [x] Thêm rollback `platform/backend/migrations/000004_auth_sessions.down.sql`.
- [x] Login trong `platform/backend/internal/handler/auth.go` trả signed JWT thay UUID placeholder.
- [x] Login ghi session vào `auth_sessions`.
- [x] Logout revoke session theo `token_id`.
- [x] `/api/v1/auth/me` đọc user từ JWT claims.
- [x] Thêm middleware authenticate bearer token và check session active trong `platform/backend/internal/server/middleware.go`.
- [x] Thêm permission guard cho investigation routes trong `platform/backend/internal/server/server.go`.

Validation:

- [x] `go test ./...` backend pass.
- [x] Docker build backend/frontend pass.
- [x] Docker Compose backend/frontend up thành công.
- [x] Smoke test API với JWT bearer pass và trả `postgres-read-only`.

Chưa hoàn thành sau Phase 2.1 tiếp tục:

- [ ] Chưa có password reset/first-login password change giống production TheHive.
- [ ] Chưa có UI quản trị users/organisations/profiles.
- [ ] Chưa implement filter đầy đủ cho observable `ioc`, `sighted`, `created_by`.
- [ ] Chưa implement exact TheHive 4 query DSL semantics; hiện là query parity nền tảng an toàn.
- [ ] Chưa xóa fallback demo trong investigation reader; vẫn giữ để UI không chết khi DB/legacy lỗi.
- [ ] Chưa implement write API case/alert/task/observable.
- [ ] Chưa implement audit log transaction-safe cho write actions.
- [ ] Chưa implement admin permission editor/profile manager.

50 task tiếp theo theo phase để migrate đủ TheHive 4 sang TypeScript/Go:

- [x] 01. Refactor `platform/backend/internal/handler/readonly.go` SQL sang `internal/repository/investigation`.
- [x] 02. Tạo interface `InvestigationReader` cho source `postgres`, `legacy`, `demo`.
- [x] 03. Thêm pagination `range` cho cases/alerts/observables.
- [x] 04. Thêm sort fields tương thích TheHive 4 list view.
- [x] 05. Thêm filter status/severity/tlp/pap/tags/assignee/owner/source/dataType.
- [x] 06. Thêm response metadata `range`, `total`, `sort`, `filters`.
- [x] 07. Tạo seed/migrator đọc `thehive/test/resources/data/Case.json` vào PostgreSQL.
- [x] 08. Tạo seed/migrator đọc `thehive/test/resources/data/Alert.json` vào PostgreSQL.
- [x] 09. Tạo seed/migrator đọc `thehive/test/resources/data/Observable.json` vào PostgreSQL.
- [x] 10. Tạo checksum + migration report trong bảng `data_migrations`.
- [x] 11. Thêm JWT signed token có claims login/org/profile/permissions.
- [x] 12. Thêm bảng sessions/token revocation.
- [x] 13. Thêm middleware authenticate bearer token.
- [x] 14. Thêm middleware permission guard theo route.
- [ ] 15. Thêm UI quản lý current user/profile/organisation.
- [ ] 16. Thêm UI admin list users giống TheHive 4.
- [ ] 17. Thêm API create/update/lock/unlock user.
- [ ] 18. Thêm API create/update profiles/permissions.
- [ ] 19. Thêm API create/update organisations.
- [ ] 20. Thêm case detail page layout giống TheHive 4.
- [ ] 21. Thêm `POST /api/v1/cases`.
- [ ] 22. Thêm `PATCH /api/v1/cases/{id}`.
- [ ] 23. Thêm `POST /api/v1/cases/{id}/close`.
- [ ] 24. Thêm `POST /api/v1/cases/{id}/reopen`.
- [ ] 25. Thêm case merge workflow.
- [ ] 26. Thêm audit log transaction-safe cho case writes.
- [ ] 27. Thêm alert detail page layout giống TheHive 4.
- [ ] 28. Thêm `POST /api/v1/alerts/{id}/import`.
- [ ] 29. Thêm `POST /api/v1/alerts/{id}/merge`.
- [ ] 30. Thêm alert bulk import/merge UI.
- [ ] 31. Thêm task list/detail trong case.
- [ ] 32. Thêm task create/update/assign/close APIs.
- [ ] 33. Thêm task log/timeline APIs.
- [ ] 34. Thêm case timeline UI giống TheHive 4.
- [ ] 35. Thêm observable create/update/delete APIs.
- [ ] 36. Thêm observable analyzer action UI placeholder.
- [ ] 37. Thêm MinIO/S3 service vào Docker Compose.
- [ ] 38. Thêm attachment metadata + upload/download signed URL.
- [ ] 39. Thêm Cortex analyzer/responder catalog adapter.
- [ ] 40. Thêm RabbitMQ worker cho Cortex jobs.
- [ ] 41. Thêm Cortex job result persistence/report renderer.
- [ ] 42. Thêm MISP connection config/API client.
- [ ] 43. Thêm MISP event import preview.
- [ ] 44. Thêm MISP attribute -> observable/alert mapping.
- [ ] 45. Thêm MISP taxonomy/tag sync.
- [ ] 46. Thêm OpenSearch service vào Docker Compose.
- [ ] 47. Thêm indexer outbox -> OpenSearch.
- [ ] 48. Thêm global search UI/API.
- [ ] 49. Thêm dashboard widgets giống TheHive 4.
- [ ] 50. Thêm production cutover shadow compare, feature flags, rollback runbook.

### 17.14 Phase 2.1.1 / 2.0.4.1 hardening tiếp tục đã thực hiện (2026-04-27)

Đã code tiếp theo các phase đang mở, tập trung vào vertical slice nhỏ nhưng chạy được và test được thay vì chỉ đọc tài liệu:

Backend auth/RBAC hardening:

- [x] Thêm migration `platform/backend/migrations/000005_auth_password_hardening.up.sql`.
- [x] Thêm rollback `platform/backend/migrations/000005_auth_password_hardening.down.sql`.
- [x] Bổ sung các field production auth trên `users`:
  - `must_change_password`
  - `password_changed_at`
  - `password_algo`
- [x] Mark default admin placeholder account là first-login password change bắt buộc nếu còn hash placeholder.
- [x] Nâng policy local password lên tối thiểu 12 ký tự, có lowercase/uppercase/digit/symbol.
- [x] `POST /api/v1/auth/register` validate password policy và ghi `password_changed_at`, `password_algo`.
- [x] `POST /api/v1/auth/login` trả thêm `must_change_password` cho UI flow first-login.
- [x] Thêm `POST /api/v1/auth/password` để current user đổi password, rotate bcrypt hash, clear `must_change_password`, revoke các session khác trong cùng transaction.
- [x] Thêm `GET /api/v1/auth/sessions` list tối đa 100 sessions của current user, đánh dấu current token.
- [x] Thêm `POST /api/v1/auth/sessions/revoke-all` để revoke toàn bộ sessions current user.
- [x] Wire routes mới trong `platform/backend/internal/server/server.go`.

Backend query parity hardening:

- [x] Observable PostgreSQL filters đã bổ sung:
  - `ioc`
  - `sighted`
  - `createdBy` / `created_by`
- [x] Date range filters đã bổ sung:
  - cases: `createdFrom`, `createdTo`, `updatedFrom`, `updatedTo`
  - alerts: `createdFrom`, `createdTo`, `updatedFrom`, `updatedTo`
  - observables: `createdFrom`, `createdTo`, `updatedFrom`, `updatedTo`
- [x] Demo reader cũng hỗ trợ các filter mới để fallback UI vẫn phản ánh behavior gần production.
- [x] Thêm unit tests cho observable filters `ioc`, `sighted`, `createdBy`, date range và demo boolean filter.

Frontend query parity / UX:

- [x] Investigation filter panel chuyển từ text input thô sang typed controls:
  - select cho status/severity/TLP/PAP/IOC/sighted
  - datetime input cho date range
  - text input chỉ giữ cho field free-text như tags/source/createdBy
- [x] Register form tăng validation password policy tương ứng backend.
- [x] Login response đọc `must_change_password` để chuẩn bị flow first-login redirect.
- [x] CSS filter grid được cập nhật để typed inputs hiển thị ổn theo layout TheHive/AdminLTE.

OpenAPI / contract:

- [x] Document `POST /api/v1/auth/password`.
- [x] Document `GET /api/v1/auth/sessions`.
- [x] Document `POST /api/v1/auth/sessions/revoke-all`.
- [x] Update `LoginResponse`, `User`, `RegisterRequest`, `ChangePasswordRequest`, `SessionCollection`, `SessionSummary`.
- [x] Document observable filters `ioc`, `sighted`, `createdBy`, `createdFrom`, `createdTo`.

Validation đã chạy:

- [x] Format Go bằng portable Go:
  - `C:\Users\nghia\.thehive-tools\go\bin\gofmt.exe -w ...`
- [x] Repository test nhỏ:
  - `cd platform/backend && C:\Users\nghia\.thehive-tools\go\bin\go.exe test ./internal/repository/investigation`
- [x] Backend full test:
  - `cd platform/backend && C:\Users\nghia\.thehive-tools\go\bin\go.exe test ./...`
- [ ] Frontend lint chưa chạy được trên host vì `platform/frontend/node_modules` chưa có hoặc chưa install; `npm run lint` lỗi `'next' is not recognized as an internal or external command`.

### 17.15 Chưa hoàn thành sau Phase 2.1.1 / 2.0.4.1 hardening

- [ ] Chưa có UI đổi password first-login hoàn chỉnh; backend/API contract và login flag đã có, frontend mới redirect placeholder.
- [ ] Chưa có password reset token/email/admin-reset flow production đầy đủ.
- [ ] Chưa có admin UI quản trị users/organisations/profiles.
- [ ] Chưa có admin API list/create/update/lock/unlock users.
- [ ] Chưa có admin API manage organisations/profiles/permissions.
- [ ] Chưa implement exact TheHive 4 query DSL compatibility layer; hiện vẫn là query parity an toàn bằng query params allowlist.
- [ ] Chưa xóa fallback demo trong investigation reader; vẫn giữ để UI không chết khi DB/legacy lỗi.
- [ ] Chưa implement write API case/alert/task/observable.
- [ ] Chưa implement audit log transaction-safe cho write actions ngoài password-change session revocation transaction.
- [ ] Chưa chạy frontend lint/build vì dependency `next` chưa có trong `node_modules` host.

### 17.16 Phase tiếp theo chi tiết

Phase 2.1.2 — Auth/RBAC hardening tiếp:

- [ ] Implement first-login change-password UI modal/page thật, gọi `POST /api/v1/auth/password`.
- [ ] Implement password reset token table + TTL + one-time-use semantics.
- [ ] Implement admin reset password / force change password endpoint.
- [ ] Implement admin API list/create/update/lock/unlock users.
- [ ] Implement admin API manage organisations.
- [ ] Implement admin API manage profiles/permissions.
- [ ] Thêm audit log cho login/logout/password/session/admin actions.
- [ ] Thêm frontend admin screens giống TheHive 4 cho Users / Organisations / Profiles.

Phase 2.0.4.2 — Query parity hardening:

- [ ] Implement exact TheHive 4 query DSL compatibility adapter cho `_and`, `_or`, `_not`, `_like`, `_gt`, `_lt`, `_between`, `_in`.
- [ ] Chuẩn hóa date range semantics theo TheHive 4 `startDate`, `createdAt`, `updatedAt`.
- [ ] Thêm contract tests cho range/sort/filter/error cases.
- [ ] Thêm frontend typed filter controls cho all supported case/alert fields.
- [ ] Thêm OpenAPI examples cho complex filters.

Phase 3.0 — Write API MVP:

- [ ] Tạo repository write cho cases.
- [ ] Implement `POST /api/v1/cases`.
- [ ] Implement `PATCH /api/v1/cases/{id}`.
- [ ] Implement `POST /api/v1/cases/{id}/close`.
- [ ] Implement `POST /api/v1/cases/{id}/reopen`.
- [ ] Implement alert import/merge APIs.
- [ ] Thêm audit log transaction-safe cho case/alert write workflow.
- [ ] Update OpenAPI và tests cho write workflows.

Đề xuất thêm từ TheHive 4 gốc cần giữ/nâng cấp trong bản migrate:

- [ ] Giữ taxonomy/tag UX của TheHive 4 nhưng chuẩn hóa tag source/prefix để tránh noise MISP/Cortex.
- [ ] Giữ TLP/PAP/severity/status semantics, không đổi enum tùy tiện khi migrate dữ liệu.
- [ ] Giữ case number monotonic và audit được nguồn sinh số.
- [ ] Giữ observable IOC/sighted behavior, nhưng thêm typed filter và index rõ trong PostgreSQL/OpenSearch.
- [ ] Giữ task/log timeline workflow, nhưng nâng cấp thành append-only audit-friendly event stream.
- [ ] Giữ profile permission names gần TheHive 4 để dễ map legacy users.
- [ ] Nâng cấp auth sang OIDC/SSO sau local auth MVP; local auth chỉ là fallback/self-host mode.
- [ ] Nâng cấp attachment sang MinIO/S3 với malware scan hook trước khi analyst download.
- [ ] Nâng cấp search sang OpenSearch rebuildable index, PostgreSQL vẫn là source of truth.
- [ ] Thêm shadow compare report để so list/query/write output giữa legacy TheHive 4 và platform mới trước cutover.

### 17.17 Phase 2.1.2 admin/auth API vertical slice đã thực hiện tiếp (2026-04-27)

Đã code tiếp API quản trị production auth/RBAC thay vì chỉ ghi plan:

- [x] Tạo handler mới `platform/backend/internal/handler/admin.go`.
- [x] Implement admin users API:
  - `GET /api/v1/admin/users`
  - `POST /api/v1/admin/users`
  - `PATCH /api/v1/admin/users/{login}`
  - `POST /api/v1/admin/users/{login}/lock`
  - `POST /api/v1/admin/users/{login}/unlock`
  - `POST /api/v1/admin/users/{login}/reset-password`
- [x] Lock user tự revoke active sessions để giảm rủi ro tài khoản bị khóa vẫn còn token sống.
- [x] Admin reset password rotate bcrypt hash, set `must_change_password`, revoke sessions trong transaction.
- [x] Implement admin organisations API:
  - `GET /api/v1/admin/organisations`
  - `POST /api/v1/admin/organisations`
- [x] Implement admin profiles/permissions API:
  - `GET /api/v1/admin/profiles`
  - `POST /api/v1/admin/profiles`
- [x] Wire admin routes trong `platform/backend/internal/server/server.go`.
- [x] Permission gate:
  - users: `manageUser`
  - organisations: `manageOrganisation`
  - profiles: `manageConfig`
- [x] Cập nhật OpenAPI `platform/backend/api/openapi.yaml` cho admin users/organisations/profiles endpoints và schemas.

### 17.18 Phase 2.1.3 admin UI + persistent admin seed + plan cleanup (2026-04-27)

- [x] Seed admin account cố định trong SQL migration `platform/backend/migrations/000005_auth_password_hardening.up.sql` để không mất khi build DB từ đầu:
  - login: `nghia.dinh@ncsgroup.vn`
  - password: `12345@`
  - organisation: `admin`
  - profile: `admin`
  - password lưu dạng bcrypt hash trong DB.
- [x] Tạo frontend admin workspace `platform/frontend/src/app/admin/page.tsx`.
- [x] UI admin bám style TheHive 4/AdminLTE đang dùng trong platform:
  - sidebar dark TheHive
  - tab panel Users / Organisations / Profiles
  - legacy table style
  - label/status style
  - mini stats boxes
  - form panel bên phải như admin console
- [x] Users UI: list/create/lock/unlock/reset password, hiển thị organisation/profile/status/must-change-password.
- [x] Organisations UI: list/create/update organisation.
- [x] Profiles UI: list profiles + permission checkbox editor.
- [x] Bật navigation Admin trong `platform/frontend/src/components/Sidebar.tsx`.
- [x] Thêm CSS admin parity trong `platform/frontend/src/styles/globals.css`.

### 17.19 Plan cleanup — trạng thái tổng hợp không trùng để theo dõi

Đã hoàn thành đến hiện tại:

- [x] Phase 1 — Skeleton Docker/Go/Next/PostgreSQL/RabbitMQ.
- [x] Phase 1.5 — Read-only investigation portal.
- [x] Phase 1.6 — Legacy read adapter safe fallback.
- [x] Phase 1.7 — OpenAPI investigation contract nền tảng.
- [x] Phase 1.8 — Investigation UI parity hardening.
- [x] Phase 2.0.1 — PostgreSQL-backed investigation read repository path.
- [x] Phase 2.0.3 — Fixture migration preview Case/Alert/Observable.
- [x] Phase 2.0.4.1 — Query parity hardening nền tảng: range/sort/filter/date/observable ioc/sighted/createdBy.
- [x] Phase 2.1 — PostgreSQL local auth + JWT sessions + permission guard.
- [x] Phase 2.1.1 — Password hardening: password policy, change password API, session list/revoke-all.
- [x] Phase 2.1.2 — Admin API users/organisations/profiles.
- [x] Phase 2.1.3 — Admin frontend users/organisations/profiles style TheHive/AdminLTE MVP.
- [x] Phase 2.1.4 — First-login change-password UI + password reset token/self-service foundation.

Backlog gọn, chưa hoàn thành:

- [x] First-login change-password UI MVP đã có trang riêng và gọi `POST /api/v1/auth/password`.
- [x] Password reset token/self-service foundation đã có migration, request/confirm API, admin reset-token API và UI placeholder email adapter.
- [ ] Audit log append-only + transaction-safe helper.
- [ ] Admin handler tests.
- [ ] Exact TheHive 4 query DSL compatibility.
- [ ] Case/alert/task/observable write APIs.
- [ ] Case detail page 100% style TheHive 4.
- [ ] Alert detail page 100% style TheHive 4.
- [ ] Task/log timeline 100% style TheHive 4.
- [ ] Observable detail/analyzer UI 100% style TheHive 4.
- [ ] Attachment UI + MinIO/S3 storage.
- [ ] Cortex adapter/worker/report renderer.
- [ ] MISP adapter import/export/taxonomy sync.
- [ ] OpenSearch global search/dashboard.
- [ ] Full data migrator + validation report.
- [x] Frontend dependencies đã cài trên host bằng `npm install`; lint/type-check/build đã chạy pass.

### 17.20 Checklist migrate 100% từ TheHive 4 gốc sang platform mới

UI/UX 100% style TheHive 4 cần port tiếp:

- [ ] Login screen: logo, color, spacing, alert messages, first-login flow giống TheHive 4.
- [ ] Header/topbar: global search, notification, user menu, org context giống TheHive 4.
- [ ] Sidebar: đầy đủ menus Dashboard / Search / Cases / Alerts / Tasks / Observables / Admin / Config.
- [ ] Case list: columns, icons, TLP bar, severity labels, bulk actions, pagination giống TheHive 4.
- [ ] Case detail: summary header, tabs, custom fields, tasks, observables, logs, attachments, sharing.
- [ ] Alert list/detail: import/merge workflow, source/ref, observable preview, similar alerts.
- [ ] Observable list/detail: IOC/sighted flags, tags, analyzers, reports.
- [ ] Task list/detail: status, assignee, logs, group/order.
- [ ] Timeline/log view: markdown/log rendering, attachments, audit events.
- [ ] Admin users: profile/org assignment, lock/unlock, reset password, permission display.
- [ ] Admin organisations: org links/sharing, default dashboards/pages.
- [ ] Admin profiles: permission matrix giống TheHive 4.
- [ ] Config screens: observable types, custom fields, case templates, taxonomy, analyzers/responders.
- [ ] Dashboard widgets: case status, alert volume, SLA/open aging, severity distribution.
- [ ] Report/export screens: case report template, printable/exportable view.

Backend/API 100% parity cần port tiếp:

- [ ] Auth: first-login password change, password reset, OIDC/SSO, API keys scoped permissions.
- [ ] RBAC: org/profile/permission mapping giống TheHive 4, permission matrix tests.
- [ ] Query DSL: exact `_and`, `_or`, `_not`, `_like`, `_gt`, `_lt`, `_between`, `_in`, sort/range/stats semantics.
- [ ] Cases: create/update/close/reopen/merge/share/custom fields/procedures.
- [ ] Alerts: create/update/import/merge/bulk import/dedup.
- [ ] Observables: create/update/delete/ioc/sighted/analyze/datatype validation.
- [ ] Tasks: create/update/assign/close/order/group/logs.
- [ ] Logs/timeline: append-only event/audit stream.
- [ ] Attachments: metadata, upload/download, S3/MinIO, malware scan hook.
- [ ] Taxonomy/tags: import/sync, normalization, color/style mapping.
- [ ] Case templates/custom fields/pages/dashboards.
- [ ] Notifications/webhooks/responders.
- [ ] Cortex: analyzer/responder catalog, job queue, report persistence.
- [ ] MISP: event import preview, attribute mapping, IOC export, taxonomy/tag sync.
- [ ] Search: OpenSearch indexer, rebuild, global search API/UI.
- [ ] Migration: TheHive 4 dataset migrator, checksum, resumable `data_migrations`, validation reports.
- [ ] Observability: metrics, structured logs, audit stream, dashboard, alerts.

### 17.21 Phase 2.1.4 — First-login UI + password reset production foundation (2026-04-27)

Task đã hoàn thành trong phiên này:

- [x] Đọc lại `context.md` và `plan.md` trước khi code tiếp để cập nhật trạng thái thật.
- [x] Cài frontend dependencies trên host bằng `npm install` trong `platform/frontend`, giúp lint/type-check/build Next.js chạy được trực tiếp ngoài Docker.
- [x] Tạo migration `platform/backend/migrations/000006_password_reset_tokens.up.sql` cho bảng `password_reset_tokens`:
  - token hash lưu dạng SHA-256, không lưu raw token.
  - TTL qua `expires_at`.
  - one-time-use qua `used_at`.
  - index active token + lookup theo login.
- [x] Tạo rollback `platform/backend/migrations/000006_password_reset_tokens.down.sql`.
- [x] Implement self-service password reset foundation trong `platform/backend/internal/handler/auth.go`:
  - `POST /api/v1/auth/password-reset/request`.
  - `POST /api/v1/auth/password-reset/confirm`.
  - token TTL 30 phút.
  - token one-time-use trong transaction với `FOR UPDATE`.
  - reset password revoke toàn bộ active sessions của user.
  - request endpoint không leak account existence.
  - delivery hiện là `email-placeholder` để sau này cắm email adapter thật.
- [x] Implement admin reset token endpoint trong `platform/backend/internal/handler/admin.go`:
  - `POST /api/v1/admin/users/{login}/reset-token`.
  - yêu cầu permission `manageUser`.
  - trả raw token một lần cho admin out-of-band delivery.
- [x] Wire routes mới trong `platform/backend/internal/server/server.go`.
- [x] Tạo first-login change-password page `platform/frontend/src/app/change-password/page.tsx`:
  - hiển thị banner bắt buộc đổi password theo flow `must_change_password`.
  - gọi `POST /api/v1/auth/password`.
  - có sign out action.
- [x] Cập nhật login flow `platform/frontend/src/app/login/page.tsx`:
  - nếu login response có `must_change_password = true` thì redirect sang `/change-password`.
  - thêm link Forgot password sang `/reset-password`.
- [x] Tạo self-service reset UI `platform/frontend/src/app/reset-password/page.tsx`:
  - request reset placeholder/email adapter.
  - confirm token + new password.
  - nêu rõ token TTL/one-time-use behavior trong UI.
- [x] Cập nhật CSS `platform/frontend/src/styles/globals.css` cho first-login/reset UI theo AdminLTE/TheHive style.
- [x] Cập nhật OpenAPI `platform/backend/api/openapi.yaml`:
  - document self-service reset request/confirm endpoints.
  - document admin reset-token endpoint.
  - thêm schemas reset request/confirm/response.

Validation đã chạy:

- [x] Format Go bằng `C:\Users\nghia\.thehive-tools\go\bin\gofmt.exe`.
- [x] Backend test pass: `C:\Users\nghia\.thehive-tools\go\bin\go.exe test ./...` trong `platform/backend`.
- [x] Frontend type-check pass: `npm run type-check` trong `platform/frontend`.
- [x] Frontend lint pass: `npm run lint` trong `platform/frontend`.
- [x] Frontend production build pass: `npm run build` trong `platform/frontend`.

Chưa hoàn thành sau Phase 2.1.4:

- [ ] Chưa có email adapter thật SMTP/Mailgun/SES; self-service reset request hiện mới placeholder và không gửi email.
- [ ] Chưa có audit log append-only cho login/logout/change-password/reset-token/admin writes.
- [ ] Chưa có admin handler tests riêng bằng httptest/sqlmock hoặc integration DB.
- [ ] Chưa expose/reset-token action trong admin UI; backend API đã có.
- [ ] Chưa có rate-limit/bruteforce guard cho login/password-reset endpoints.
- [ ] Chưa có OIDC/SSO/API key scoped permissions.
- [ ] Chưa có exact TheHive 4 query DSL compatibility.
- [ ] Chưa có case/alert/task/observable write APIs.
- [ ] Chưa có case/alert/observable/task detail UI 100% giống TheHive 4.
- [ ] Chưa có attachment MinIO/S3, Cortex, MISP, OpenSearch, full migrator.

### 17.22 Phase 2.1.5 — Audit log + invite-only registration + self-host mail (2026-04-27)

Task đã hoàn thành trong phiên này:

- [x] Xác nhận hướng self-host mail server trong repo: dùng Mailpit trong Docker Compose cho dev/self-host capture SMTP; production có thể thay env sang SMTP thật.
- [x] Thêm service `mailpit` vào `platform/deploy/docker-compose.yml`:
  - SMTP nội bộ: `mailpit:1025`.
  - Web UI: `http://localhost:8025`.
- [x] Thêm mail env vào `platform/deploy/.env.example`:
  - `MAIL_ENABLED`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_FROM`, `PUBLIC_BASE_URL`, `MAILPIT_SMTP_PORT`, `MAILPIT_WEB_PORT`.
- [x] Thêm cấu hình mail vào `platform/backend/internal/config/config.go`.
- [x] Tạo email adapter SMTP foundation `platform/backend/internal/mail/mail.go`:
  - gửi password reset email.
  - gửi invite email.
  - hỗ trợ STARTTLS nếu server support.
  - nếu mail disabled thì flow vẫn chạy bằng token placeholder/out-of-band.
- [x] Tạo migration `platform/backend/migrations/000007_audit_invites.up.sql`:
  - bảng `audit_logs` append-only.
  - trigger chặn update/delete audit log.
  - index actor/entity/action/created_at.
  - mở rộng `password_reset_tokens` thêm `purpose`, invited metadata.
- [x] Tạo rollback `platform/backend/migrations/000007_audit_invites.down.sql`.
- [x] Tạo audit helper `platform/backend/internal/audit/audit.go`:
  - `Recorder.Record` dùng DB thường.
  - `RecordTx` dùng chung trong transaction.
  - helper lấy actor/request_id/ip/user_agent từ Echo context.
- [x] Tạo audit stream endpoint `platform/backend/internal/handler/audit.go`:
  - `GET /api/v1/audit?limit=100`.
  - filter actor optional.
  - permission gate `manageConfig`.
- [x] Audit các action auth/admin quan trọng:
  - login.
  - logout.
  - register request.
  - change password.
  - reset password confirm.
  - admin create/update/lock/reset-token/reset-password/approve user.
- [x] Đổi open registration thành invite-only pending approval trong `platform/backend/internal/handler/auth.go`:
  - `POST /api/v1/auth/register` chỉ tạo user `Pending`, password rỗng, locked/must-change-password.
  - user chưa login được cho đến khi admin approve và gửi invite token.
- [x] Admin approval/invite flow trong `platform/backend/internal/handler/admin.go`:
  - `POST /api/v1/admin/users/{login}/approve`.
  - tạo invite token purpose `invite`.
  - token dùng lại endpoint confirm reset để set password lần đầu và chuyển user `Pending` sang `Ok`.
- [x] Admin create user hỗ trợ invite-only:
  - có thể bỏ trống temp password.
  - `send_invite=true` tạo user `Pending` và generate invite token/email.
- [x] Expose reset-token/invite/approve trong admin UI `platform/frontend/src/app/admin/page.tsx`:
  - Token button.
  - Approve pending user button.
  - Create/invite user form.
  - hiển thị token nếu Mailpit/email placeholder hoặc out-of-band delivery.
- [x] Cập nhật OpenAPI `platform/backend/api/openapi.yaml`:
  - invite-only register summary/schema.
  - admin approve endpoint/schema.
  - audit stream endpoint/schema.
  - admin invite/reset token response schema.

Validation đã chạy:

- [x] Format Go bằng `C:\Users\nghia\.thehive-tools\go\bin\gofmt.exe`.
- [x] Backend test pass: `C:\Users\nghia\.thehive-tools\go\bin\go.exe test ./...` trong `platform/backend`.
- [x] Frontend type-check/lint/build pass: `npm run type-check && npm run lint && npm run build` trong `platform/frontend`.
- [x] Docker Compose config pass: `docker compose -f platform\deploy\docker-compose.yml --env-file platform\deploy\.env.example config`.

### 17.23 Phase 2.1.6 / 2.0.4.2 / 3.0 / 4.1 multi-task slice (2026-04-27)

Task đã hoàn thành:

- [x] Task 1 — Rate-limit/bruteforce guard cho login/register/password-reset endpoints bằng `platform/backend/internal/server/ratelimit.go`.
- [x] Task 2 — Tests:
  - `platform/backend/internal/server/ratelimit_test.go`.
  - `platform/backend/internal/handler/admin_test.go` bằng sqlmock.
- [x] Task 3 — Audit stream UI trong Admin bằng tab Audit tại `platform/frontend/src/app/admin/page.tsx`.
- [x] Task 4 — SMTP production secret docs tại `platform/docs/smtp-production.md`.
- [x] Task 5 — TheHive 4 query DSL parser foundation:
  - `platform/backend/internal/repository/investigation/dsl.go`.
  - hỗ trợ `_and`, `_or`, `_not`, `_like`, `_gt`, `_lt`, `_between`, `_in`.
  - tests `platform/backend/internal/repository/investigation/dsl_test.go`.
  - wire `dsl` query param vào PostgreSQL investigation reader.
- [x] Task 6 — Case write repository/endpoints:
  - `platform/backend/internal/repository/casewrite/casewrite.go`.
  - `platform/backend/internal/handler/cases.go`.
  - `POST /api/v1/cases`.
  - `PATCH /api/v1/cases/{id}`.
  - `POST /api/v1/cases/{id}/close`.
  - `POST /api/v1/cases/{id}/reopen`.
- [x] Task 7 — Transaction-safe audit cho case create/update/close/reopen.
- [x] Task 8 — Case detail UI foundation: `platform/frontend/src/app/cases/[id]/page.tsx`.
- [x] Task 9 — Alert detail/import/merge UI foundation: `platform/frontend/src/app/alerts/[id]/page.tsx`.
- [x] Task 10 — Observable detail/analyzer report UI foundation: `platform/frontend/src/app/observables/[id]/page.tsx`.
- [x] Task 11 — Task/log timeline UI foundation: `platform/frontend/src/app/tasks/[id]/page.tsx`.
- [x] Cập nhật CSS detail/timeline style trong `platform/frontend/src/styles/globals.css`.

Validation đã chạy:

- [x] Go format bằng portable Go.
- [x] Backend `go test ./...` pass.
- [x] Frontend `npm run type-check && npm run lint && npm run build` pass.
- [x] Docker Compose config render pass.

Phần chưa hoàn thành:

- [ ] Rate limit hiện in-memory per process; chưa có Redis/distributed limiter cho multi-replica production.
- [ ] Admin tests mới là focused sqlmock slice; chưa có full integration DB test suite.
- [ ] Query DSL mới là compatibility foundation; chưa parity 100% toàn bộ TheHive 4 DSL/stats/nparent semantics.
- [ ] Case write MVP chưa có custom fields/procedures/share/merge và permission matrix chi tiết.
- [x] Alert import/merge backend MVP đã implement API + transaction-safe audit.
- [x] Observable/task/log backend write APIs đã implement MVP + transaction-safe audit.
- [ ] Detail UI chưa 100% pixel-perfect TheHive 4; cần screenshot baseline/visual regression.
- [ ] Attachment MinIO/S3, Cortex, MISP, OpenSearch, full migrator vẫn chưa implement.

### 17.24 Phase 3.1 / 4.0 backend write APIs tiếp tục đã thực hiện (2026-04-27)

Task đã hoàn thành:

- [x] Đọc lại `context.md` và `plan.md` trước khi code tiếp.
- [x] Phase 3.1 — Alert import/merge backend MVP:
  - [x] Tạo `platform/backend/internal/repository/alertwrite/alertwrite.go`.
  - [x] Tạo `platform/backend/internal/handler/alerts.go`.
  - [x] `POST /api/v1/alerts/{id}/import` tạo case mới từ alert, link alert vào case, set status `Imported`, mark read.
  - [x] `POST /api/v1/alerts/{id}/merge` merge alert vào `case_id` hoặc vào case đã import của `target_alert_id`, set status `Merged`, mark read.
  - [x] Audit transaction-safe cho `alert.import` và `alert.merge`.
- [x] Phase 4.0 — Task/log/observable write APIs:
  - [x] Tạo `platform/backend/internal/repository/workwrite/workwrite.go`.
  - [x] Tạo `platform/backend/internal/handler/work.go`.
  - [x] Task lifecycle APIs: create/update/assign/close.
  - [x] Case log append-only API `POST /api/v1/cases/{id}/logs`.
  - [x] Observable create/update/delete APIs.
  - [x] Observable analyze placeholder `POST /api/v1/observables/{id}/analyze` trả `queued-placeholder` để nối Cortex worker sau.
  - [x] Audit transaction-safe cho task/log/observable write actions.
- [x] Thêm migration index `platform/backend/migrations/000008_write_api_indexes.up.sql` và rollback `platform/backend/migrations/000008_write_api_indexes.down.sql`.
- [x] Wire routes trong `platform/backend/internal/server/server.go`.
- [x] Cập nhật OpenAPI `platform/backend/api/openapi.yaml` cho alert import/merge, task, log, observable write/analyze.
- [x] Thêm focused handler tests `platform/backend/internal/handler/write_api_test.go`.
- [x] Validation pass: backend `go test ./...`.

Phần chưa hoàn thành:

- [ ] Alert import chưa copy observables/artifacts từ alert sang case vì schema hiện chưa có relation `observables.alert_id`; cần migration mapping bổ sung.
- [ ] Alert merge chưa có similar-alert scoring/dedup/bulk semantics TheHive 4.
- [ ] Case write chưa có custom fields/procedures/share/merge và permission matrix chi tiết.
- [ ] Task write chưa có task templates, ordering/group parity UI, SLA, bulk actions.
- [ ] Case log chưa có markdown renderer, attachment-in-log, edit prohibition test bằng integration DB.
- [ ] Observable analyze chưa enqueue RabbitMQ/Cortex job thật.
- [ ] Observable delete đang hard-delete MVP; production retention có thể cần soft-delete/tombstone.
- [ ] Chưa có full integration DB test suite cho write APIs.
- [ ] Chưa có screenshot baseline/visual regression cho pixel-perfect TheHive 4 detail UI.
- [ ] Attachment MinIO/S3, Cortex, MISP, OpenSearch, full migrator vẫn chưa implement.

Phase tiếp theo không trùng:

- [x] Phase 2.1.4 — First-login UI + password reset production foundation.
- [x] Phase 2.1.5 — Audit log foundation + invite-only registration + self-host mail foundation.
- [x] Phase 2.1.6 — Auth hardening/test + audit UI + SMTP docs.
- [x] Phase 2.0.4.2 — Exact TheHive 4 query DSL compatibility foundation.
- [x] Phase 3.0 — Case write MVP with transaction-safe audit foundation.
- [x] Phase 3.1 — Alert import/merge backend MVP.
- [x] Phase 4.0 — Task/log/observable write APIs.
- [x] Phase 4.1 — Case/alert/observable/task detail UI style foundation.
- [ ] Phase 4.0.1 — Write API hardening: alert artifact copy, soft-delete decision, permission matrix tests, integration DB tests.
- [ ] Phase 4.1.1 — Visual regression + screenshot baseline for TheHive 4 detail parity.
- [ ] Phase 5.0 — Attachment MinIO/S3 + malware scan hook.
- [ ] Phase 6.0 — Cortex adapter production, nối observable analyze placeholder thành job thật.
- [ ] Phase 7.0 — MISP adapter production.
- [ ] Phase 8.0 — OpenSearch dashboard/global search.
- [ ] Phase 9.0 — Data migration pilot + shadow compare.
- [ ] Phase 10.0 — Production cutover.

### 17.25 Đề xuất migration để đạt 100% style/UI/UX TheHive 4 và tái sử dụng code cũ

UI/UX nên giữ lại từ TheHive 4:

- [ ] Giữ AdminLTE skin-blue tokens: primary `#3c8dbc`, sidebar `#222d32`, body `#ecf0f5`, Roboto, label màu severity/TLP/PAP.
- [ ] Giữ layout list/detail: sidebar trái, topbar, bulk toolbar, table dense mode, tabbed detail panels.
- [ ] Giữ domain labels và icon semantics cho Cases / Alerts / Observables / Tasks để analyst không phải học lại workflow.
- [ ] Giữ case number, TLP/PAP/severity/status wording và filter naming gần legacy.
- [ ] Giữ timeline/log UX append-only, nhưng render bằng React component mới và audit-backed data.
- [ ] Giữ taxonomy/tag display style, nhưng chuẩn hóa tag source/prefix khi ingest từ MISP/Cortex.
- [ ] Giữ analyzer report structure của Cortex legacy để có thể render report cũ và report mới cùng component.

UI/UX nên migrate/rebuild mới:

- [ ] Rebuild AngularJS screens sang Next.js/React; không tái sử dụng AngularJS runtime trong production mới.
- [ ] Port CSS legacy theo token/component, không copy nguyên CSS rối nếu selector phụ thuộc DOM cũ.
- [ ] Tạo visual regression baseline từ TheHive 4 cho login, case list/detail, alert import/merge, observable detail, task timeline, admin screens.
- [ ] Dùng screenshot diff để khóa spacing/font/color trước khi cutover.
- [ ] Tách component reusable: `LegacyShell`, `LegacyTable`, `SeverityLabel`, `TlpPapBadge`, `TagList`, `Timeline`, `AnalyzerReport`.

Backend nên giữ lại từ TheHive 4:

- [ ] Giữ nghiệp vụ cốt lõi: case lifecycle, alert import/merge semantics, observable IOC/sighted/analyze behavior, task/log workflow.
- [ ] Giữ permission names gần legacy (`manageCase`, `manageAlert`, `manageObservable`, `manageUser`, `manageConfig`) để map users/profiles dễ hơn.
- [ ] Giữ query DSL compatibility layer cho client/script cũ: `_and`, `_or`, `_not`, `_like`, `_gt`, `_lt`, `_between`, `_in`, `range`, `sort`, `nparent`, `stats`.
- [ ] Giữ MISP/Cortex mapping logic làm reference; port sang adapter mới theo contract/test, không gọi thẳng legacy service trong core path.
- [ ] Giữ fixture/test data legacy trong `thehive/test/resources/data` làm golden dataset migration.

Backend/database nên migrate/rebuild mới:

- [ ] PostgreSQL là source of truth thay graph/Cassandra legacy; schema phải versioned bằng migrations.
- [ ] Audit logs append-only cho mọi write domain action.
- [ ] File binary chuyển sang MinIO/S3; DB chỉ giữ metadata/storage key/hash/scan status.
- [ ] OpenSearch là rebuildable read index cho dashboard/global search, không là source of truth.
- [ ] Cortex/MISP chạy qua adapter/worker queue, có retry/dead-letter/audit.
- [ ] Auth local chỉ là fallback; production nên thêm OIDC/SSO + API key scoped permissions.
- [ ] Migrator phải resumable, checksum từng entity, shadow compare output legacy/new trước cutover.
- [ ] Nên giữ TheHive 4 read-only archive trong giai đoạn pilot để đối chiếu và rollback nghiệp vụ.

### 17.26 Master execution plan — nơi quản lý task chi tiết từ giờ trở đi

Mục này là nguồn chính để quản lý task chi tiết. `context.md` chỉ giữ overview/version roadmap/product architecture; mọi checklist cụ thể phải cập nhật ở đây.

#### 17.26.1 Quy tắc cập nhật plan

- [ ] Mỗi lần code xong phải thêm task vào đúng phase bên dưới.
- [ ] Không xóa task cũ đã hoàn thành; chỉ mark `[x]` và ghi file/API liên quan.
- [ ] Nếu phát hiện task mới, thêm vào phase phù hợp hoặc tạo phase nhỏ mới.
- [ ] Nếu task chuyển scope, ghi rõ lý do và phase nhận task.
- [ ] Sau validation, ghi command đã chạy và kết quả pass/fail.
- [ ] Không nhồi full task log vào `context.md`; chỉ update `context.md` khi đổi architecture/version roadmap/product capability.
- [ ] Mỗi task đề xuất mới bắt buộc có đủ format: **Mục tiêu**, **Input sẽ dùng**, **Sẽ chỉnh sửa gì**, **Output mong muốn**, **Definition of Done**, **Validation nhỏ nhất**.
- [ ] Không được viết task kiểu chung chung như “làm UI giống TheHive 4”; phải chỉ rõ màn hình/selector/component/file, baseline nào, output pixel/behavior nào.
- [ ] Không được viết task backend chung chung như “port API”; phải chỉ rõ endpoint, repository/service/table/migration/OpenAPI/test cần chỉnh.
- [ ] Không được viết task database chung chung như “migration DB”; phải chỉ rõ source field legacy, target table/column/index/constraint/checksum/rollback.
- [ ] Mọi phase phải bảo đảm mục tiêu cuối cùng: 100% workflow/style/API/data parity với TheHive 4, nhưng bằng stack mới Go/Next.js/PostgreSQL/OpenSearch/MinIO.

#### 17.26.1.1 Template bắt buộc cho mọi task đề xuất

Copy format này khi thêm task mới:

```text
Task ID:
Tên task:
Mục tiêu:
Input sẽ dùng:
  - Legacy reference:
  - File mới hiện có:
  - Data/API/schema liên quan:
Sẽ chỉnh sửa gì:
  - Backend:
  - Frontend:
  - Database:
  - OpenAPI/docs:
  - Tests:
Output mong muốn:
  - User-facing behavior:
  - API behavior:
  - Data behavior:
  - UI/UX parity behavior:
Definition of Done:
  - Functional:
  - TheHive 4 parity:
  - Observability/audit:
  - Rollback/safety:
Validation nhỏ nhất:
  - Command/test:
  - Manual check nếu cần:
```

#### 17.26.2 Trạng thái tổng hợp theo version

Quy ước mới: trước khi migration 100% hoàn chỉnh, các mốc `0.x` là **migration build/milestone**, không phải product release hoàn chỉnh. Product release chính thức bắt đầu từ `v1.0.0` sau khi TheHive 4 core workflow/data/UI parity pass và production pilot vận hành được.

| Version/build | Status | Release class | Big update | Ghi chú quản lý |
|---|---|---|---|---|
| `0.1.x-migration` | Done | Dev/staging build | Skeleton Go/Next/PostgreSQL/RabbitMQ/Docker/metrics | Nền tảng chạy được; chưa phải release sản phẩm. |
| `0.2.x-migration` | Done/MVP | Dev/staging build | Read portal, legacy adapter, PostgreSQL read path, auth/admin/audit foundation | Còn hardening phân tán/integration tests. |
| `0.3.x-migration` | Done/MVP | Dev/staging build | Case write + alert import/merge backend MVP | Còn custom fields/procedures/share/merge/dedup. |
| `0.4.x-migration` | Done/MVP | Dev/staging build | Task/log/observable write backend MVP | Còn UI parity, retention, Cortex queue thật. |
| `0.5.x-migration` | Next | Dev/staging build | UI parity baseline/visual regression | Cần baseline screenshot TheHive 4. |
| `0.6.x-migration` | Pending | Dev/staging build | Attachment MinIO/S3 + malware scan | Chưa implement. |
| `0.7.x-migration` | Pending | Dev/staging build | Cortex adapter production | Chưa implement. |
| `0.8.x-migration` | Pending | Dev/staging build | MISP adapter production | Chưa implement. |
| `0.9.x-migration` | Pending | Staging/pilot build | OpenSearch + full migrator + shadow compare | Chưa implement đầy đủ. |
| `1.0.0-rc.x` | Pending | Release candidate | Full parity hardening | Feature freeze, pilot checklist, rollback drill. |
| `v1.0.0` | Pending | Product release | Initial production replacement for TheHive 4 | Chỉ release khi migration 100%, shadow compare pass, pilot pass. |
| `v1.1.0+` | Future | Product release | Post-migration improvements | Chỉ làm sau production baseline ổn định. |

##### 17.26.2.1 Checklist cập nhật version roadmap

Task đã hoàn thành:

- [x] Phân tích lại sai lệch versioning: các mốc `0.x` trước đây dễ bị hiểu nhầm là product release hoàn chỉnh.
- [x] Chốt lại semantics đúng: trước khi migration TheHive 4 đạt 100% parity, toàn bộ `0.x` chỉ là migration build/milestone.
- [x] Cập nhật `context.md` để tách rõ `Migration build/milestone version` và `Product release version`.
- [x] Cập nhật `context.md` với roadmap mới:
  - [x] `0.1.x-migration` — platform skeleton.
  - [x] `0.2.x-migration` — read/auth/admin foundation.
  - [x] `0.3.x-migration` — case/alert write foundation.
  - [x] `0.4.x-migration` — workbench write foundation.
  - [x] `0.5.x-migration` — UI parity baseline.
  - [x] `0.6.x-migration` — attachment storage.
  - [x] `0.7.x-migration` — Cortex production adapter.
  - [x] `0.8.x-migration` — MISP production adapter.
  - [x] `0.9.x-migration` — OpenSearch + full migrator + shadow compare.
  - [x] `1.0.0-rc.x` — release candidate hardening.
- [x] Cập nhật `context.md` với product release roadmap sau khi migration hoàn chỉnh:
  - [x] `v1.0.0` — initial production replacement for TheHive 4.
  - [x] `v1.1.0` — UI/UX polish + analyst productivity.
  - [x] `v1.2.0` — automation/SOAR hardening.
  - [x] `v1.3.0` — threat intel expansion.
  - [x] `v1.4.0` — reporting/compliance.
  - [x] `v2.0.0` — breaking architecture/API changes.
- [x] Cập nhật `context.md` versioning policy: schema version/data migration version không đồng nghĩa product version.
- [x] Mirror lại quy ước version mới trong `plan.md` tại bảng `Trạng thái tổng hợp theo version`.

Phần chưa hoàn thành:

- [x] Đã gắn version build tự động vào Docker image/tag pipeline theo format `0.x.y-migration-<git-sha>`.
- [x] Đã cập nhật OpenAPI `info.version` theo migration build semantics.
- [x] Đã có release checklist riêng cho `1.0.0-rc.x` gồm feature freeze, shadow compare pass, rollback drill, pilot sign-off.
- [x] Đã có CI check để chặn gọi `0.x` là production release trong docs/release notes.
- [x] Đã có release notes template phân biệt `migration build`, `release candidate`, và `product release` tại `platform/docs/release-notes-template.md`.

Phase tiếp theo chi tiết:

- [x] Phase V.1 — Build metadata/version tagging:
  - [x] Thêm build variable cho `APP_VERSION` hỗ trợ `0.x.y-migration`, `1.0.0-rc.x`, và `v1.x.y`.
  - [x] Cập nhật Docker build/push scripts để tag image bằng migration build + git SHA.
  - [x] Cập nhật backend `/api/v1/status` để trả `release_class` (`migration-build`, `release-candidate`, `product-release`, `development`).
- [x] Phase V.2 — OpenAPI/release docs alignment:
  - [x] Cập nhật `platform/backend/api/openapi.yaml` `info.version` theo build semantics.
  - [x] Thêm release notes template cho migration build/RC/product release.
  - [x] Thêm release checklist vào `plan.md` cho `1.0.0-rc.x` và `v1.0.0`.
##### 17.26.2.2 Release checklist — `1.0.0-rc.x`

- [ ] Version/build metadata:
  - [ ] `APP_VERSION=1.0.0-rc.x` được inject vào backend/frontend image.
  - [ ] `/api/v1/status.release_class` trả `release-candidate`.
  - [ ] Docker images được tag `1.0.0-rc.x` và `1.0.0-rc.x-<git-sha>`.
  - [ ] OpenAPI `info.version` khớp `APP_VERSION`.
- [ ] Feature freeze:
  - [ ] Không nhận feature mới ngoài bug fix/blocker parity fix.
  - [ ] Backlog còn lại đã được phân loại blocker/non-blocker.
  - [ ] Release notes RC đã liệt kê đầy đủ gap còn lại.
- [ ] TheHive 4 parity gates:
  - [ ] Core alert triage/import/merge workflow pass.
  - [ ] Core case/task/log/observable workflow pass.
  - [ ] Attachment/Cortex/MISP/search/migrator workflows pass theo scope parity bắt buộc.
  - [ ] UI/UX baseline hoặc approved delta pass.
- [ ] Migration and shadow compare:
  - [ ] Full data migrator chạy resumable trên staging dataset.
  - [ ] Checksum/validation report không còn critical mismatch.
  - [ ] Shadow compare không còn blocker cho workflow production.
- [ ] Operations:
  - [ ] Backup/restore drill pass.
  - [ ] Rollback runbook drill pass.
  - [ ] Observability dashboard/alerts đủ cho pilot.
  - [ ] Security review các secret/config/image tags pass.
- [ ] Sign-off:
  - [ ] Engineering sign-off.
  - [ ] QA/parity sign-off.
  - [ ] SOC pilot owner sign-off.
  - [ ] Operations sign-off.

##### 17.26.2.3 Release checklist — `v1.0.0`

- [ ] Version/build metadata:
  - [ ] `APP_VERSION=v1.0.0` được inject vào backend/frontend image.
  - [ ] `/api/v1/status.release_class` trả `product-release`.
  - [ ] Docker images được tag `v1.0.0` và `v1.0.0-<git-sha>`; production không pin `latest`.
  - [ ] OpenAPI `info.version` khớp `v1.0.0`.
- [ ] RC promotion gates:
  - [ ] RC cuối cùng chạy pilot thành công trong cửa sổ đã định.
  - [ ] Không còn critical/high bug chưa có mitigation.
  - [ ] Release notes product release đã được review.
- [ ] Production migration gates:
  - [ ] Backup trước cutover đã kiểm thử restore.
  - [ ] Data migration complete và validation report approved.
  - [ ] Shadow compare pass hoặc mismatch còn lại được accepted rõ ràng.
  - [ ] Rollback/cutback criteria được chốt trước deploy.
- [ ] Production operations gates:
  - [ ] Monitoring/logging/alerting hoạt động trên production target.
  - [ ] Runbook on-call, incident, rollback, backup/restore sẵn sàng.
  - [ ] Security review image/config/secret/permission pass.
  - [ ] Post-release watch window owner được phân công.
- [ ] Final sign-off:
  - [ ] Product owner sign-off.
  - [ ] SOC operations sign-off.
  - [ ] Engineering lead sign-off.
  - [ ] Security/operations sign-off.
- [x] Phase V.3 — CI guardrails:
  - [x] Thêm script lint docs/release notes để phát hiện wording sai kiểu `0.x production release`.
  - [x] Thêm validation release class trong build pipeline.
  - [x] Thêm local command `make validate-release` để chạy guardrail trước khi build/push.

#### 17.26.3 Backlog chi tiết đã hoàn thành — giữ lại để audit tiến độ

Foundation/platform:

- [x] Tạo platform skeleton trong `platform/`.
- [x] Backend Go/Echo/sqlx/zap/Prometheus foundation.
- [x] Frontend Next.js/TypeScript/Tailwind foundation.
- [x] Docker Compose PostgreSQL/RabbitMQ/backend/frontend.
- [x] Health/readiness/metrics/status endpoints.
- [x] SQL migration runner foundation.
- [x] OpenAPI contract foundation.
- [x] Docker build/review smoke checks nhiều lần.

Read/query/migration preview:

- [x] Investigation read portal cases/alerts/observables.
- [x] Legacy TheHive read adapter safe fallback.
- [x] PostgreSQL-backed read repository mode.
- [x] Source switch `demo`/`legacy`/`postgres`.
- [x] Pagination/range/sort/filter metadata.
- [x] Date filters and observable `ioc`/`sighted`/`createdBy` filters.
- [x] Query DSL foundation `_and`, `_or`, `_not`, `_like`, `_gt`, `_lt`, `_between`, `_in`.
- [x] Fixture migrator preview from TheHive 4 `Case.json`, `Alert.json`, `Observable.json`.
- [x] Data migration report/checksum foundation in `data_migrations`.

Auth/admin/audit:

- [x] PostgreSQL users/organisations/profiles schema.
- [x] Local auth with bcrypt.
- [x] Signed JWT with org/profile/permissions claims.
- [x] Auth sessions and token revocation.
- [x] Permission middleware.
- [x] Password policy and first-login change-password API/UI.
- [x] Password reset token foundation with SHA-256 hash, TTL, one-time-use.
- [x] Invite-only registration and pending approval flow.
- [x] Admin APIs users/organisations/profiles.
- [x] Admin UI users/organisations/profiles/audit.
- [x] SMTP/Mailpit foundation and SMTP production docs.
- [x] Append-only audit logs table and trigger.
- [x] Transaction-safe audit helper.
- [x] Audit login/logout/register/change password/reset/admin writes.
- [x] Rate limit/bruteforce guard for auth endpoints.
- [x] Focused admin/rate-limit tests.

Domain write MVP:

- [x] Case write repository.
- [x] `POST /api/v1/cases`.
- [x] `PATCH /api/v1/cases/{id}`.
- [x] `POST /api/v1/cases/{id}/close`.
- [x] `POST /api/v1/cases/{id}/reopen`.
- [x] Transaction-safe audit for case writes.
- [x] Alert write repository.
- [x] `POST /api/v1/alerts/{id}/import`.
- [x] `POST /api/v1/alerts/{id}/merge`.
- [x] Transaction-safe audit for alert import/merge.
- [x] Task/log/observable write repository.
- [x] `POST /api/v1/tasks`.
- [x] `PATCH /api/v1/tasks/{id}`.
- [x] `POST /api/v1/tasks/{id}/assign`.
- [x] `POST /api/v1/tasks/{id}/close`.
- [x] `POST /api/v1/cases/{id}/logs`.
- [x] `POST /api/v1/observables`.
- [x] `PATCH /api/v1/observables/{id}`.
- [x] `DELETE /api/v1/observables/{id}`.
- [x] `POST /api/v1/observables/{id}/analyze` placeholder.
- [x] Transaction-safe audit for task/log/observable writes.
- [x] OpenAPI updated for write APIs.
- [x] Focused write API handler tests.

UI foundation:

- [x] TheHive/AdminLTE shell colors and sidebar foundation.
- [x] Investigation list UI with tabs/filterbar/stats/bulk read-only controls.
- [x] Case detail UI style foundation.
- [x] Alert detail/import/merge UI foundation.
- [x] Observable detail/analyzer report UI foundation.
- [x] Task/log timeline UI foundation.
- [x] Admin UI style foundation.

#### 17.26.4 Backlog chi tiết chưa hoàn thành — ưu tiên thực hiện tiếp

Mỗi phase dưới đây ghi rõ **input sẽ dùng**, **sẽ chỉnh sửa gì**, và **output mong muốn** để tránh task mơ hồ. Mục tiêu cuối là migration đạt parity 100% với TheHive 4 về UI/UX, workflow backend, database semantics, audit, integration và vận hành, nhưng bằng ngôn ngữ/stack mới.

##### Phase 4.0.1 — Write API hardening

Mục tiêu:

- Đưa case/alert/task/log/observable write APIs từ MVP lên mức đúng semantics TheHive 4 hơn.
- Đảm bảo alert import/merge copy đúng artifacts/observables, dedup đúng, audit đúng, permission đúng.

Input sẽ dùng:

- Legacy reference: `thehive/app/org/thp/thehive/services/ObservableSrv.scala`, `thehive/app/org/thp/thehive/services/TaskSrv.scala`, legacy alert/case controllers/tests.
- Data fixtures: `thehive/test/resources/data/Alert.json`, `AlertObservable.json`, `Observable.json`, `Case.json`, `Log.json`.
- Code mới hiện có: `platform/backend/internal/repository/alertwrite/alertwrite.go`, `workwrite.go`, `casewrite.go`, handlers trong `platform/backend/internal/handler/`.
- Schema hiện có: `alerts`, `observables`, `cases`, `task_items`, `case_logs`, `audit_logs`.

Sẽ chỉnh sửa gì:

- Database:
  - [ ] Add `observables.alert_id` nullable relation hoặc `alert_observables` join table.
  - [ ] Add indexes cho `alert_id`, `(case_id, data_type, data)`, task `(case_id, group_name, order_index)`.
  - [ ] Nếu chọn soft-delete observable: add `deleted_at`, `deleted_by`, `delete_reason`, filtered indexes.
- Backend:
  - [ ] Update alert import để copy alert observables/artifacts sang case imported.
  - [ ] Preserve original alert observable IDs/source metadata để shadow compare được.
  - [ ] Add duplicate observable handling by `(case_id, data_type, data)`.
  - [ ] Add alert merge conflict report và dedup policy.
  - [ ] Add similar-alert scoring foundation theo `source/source_ref/type/tags/observables`.
  - [ ] Add bulk import/merge endpoint hoặc batch request contract.
  - [ ] Add task ordering/group invariants.
  - [ ] Align task close status semantics với TheHive 4.
- Frontend:
  - [ ] Update alert detail UI để gọi backend import/merge thật thay vì UI foundation.
  - [ ] Show merge conflict/dedup report giống TheHive 4 analyst workflow.
  - [ ] Update observable delete UI theo hard-delete/soft-delete decision.
- OpenAPI/docs:
  - [ ] Document alert import copy result, conflict report, bulk request/response.
  - [ ] Document observable delete retention behavior.
- Tests:
  - [ ] Add integration DB suite for alert import, alert merge, task ordering, log append-only, observable delete.
  - [ ] Add permission matrix tests for case/alert/task/log/observable writes.

Output mong muốn:

- User-facing behavior: analyst import alert sẽ thấy case mới có observables/artifacts giống TheHive 4; merge alert hiển thị conflict/dedup rõ.
- API behavior: write endpoints idempotent/dedup rõ, error contract ổn định, audit mọi mutation.
- Data behavior: migrated/imported data giữ lineage từ alert/source observable, không duplicate sai.
- UI/UX parity behavior: import/merge/task/log/observable workflow bám TheHive 4 về step, wording, state transition.

Definition of Done:

- [ ] Alert import output case + observables khớp legacy fixture expectation.
- [ ] Alert merge conflict report deterministic và test được.
- [ ] Task ordering/group rules có tests.
- [ ] Case logs append-only được enforce/test.
- [ ] Permission matrix tests pass.
- [ ] Backend `go test ./...` pass.

Validation nhỏ nhất:

- [ ] `cd platform/backend && go test ./internal/handler ./internal/repository/...`.
- [ ] Integration DB test command khi suite được scaffold.

##### Phase 4.1.1 — Visual regression/pixel-perfect UI

Mục tiêu:

- Đưa UI mới đạt 100% style/spacing/color/layout parity với TheHive 4 cho các màn hình core.
- Tạo baseline screenshot để mọi thay đổi UI sau này không phá legacy UX.

Input sẽ dùng:

- Legacy AngularJS templates: `frontend/app/views/partials/case/`, `frontend/app/views/partials/alert/`, `frontend/app/views/partials/observables/`, `frontend/app/views/components/`.
- Legacy CSS: `frontend/app/styles/main.css`, `frontend/app/styles/vendors/AdminLTE-skin-blue.css`.
- UI mới: `platform/frontend/src/app/**`, `platform/frontend/src/components/**`, `platform/frontend/src/styles/globals.css`.
- Data seed: fixture migrated cases/alerts/observables/tasks/logs.

Sẽ chỉnh sửa gì:

- Frontend:
  - [ ] Add Playwright hoặc screenshot runner trong `platform/frontend`.
  - [ ] Add visual pages/stories cho login, dashboard, case list/detail, alert list/detail/import/merge, observable detail, task timeline, admin users.
  - [ ] Port missing FontAwesome/icon subset hoặc map icon one-by-one.
  - [ ] Adjust CSS tokens: sidebar width, table row density, label/badge colors, tab spacing, topbar height, filterbar layout.
- Test assets:
  - [ ] Capture TheHive 4 baseline screenshots với deterministic seed data.
  - [ ] Store baseline screenshots outside generated build artifacts.
- CI/docs:
  - [ ] Add pixel threshold policy per page.
  - [ ] Add visual regression command and docs.

Output mong muốn:

- User-facing behavior: analyst nhìn UI mới có style/spacing/workflow như TheHive 4, không bị lệch visual muscle memory.
- UI/UX parity behavior: screenshot diff nằm dưới threshold đã định cho từng page.
- Developer behavior: thay đổi CSS/component phá parity sẽ bị visual test phát hiện.

Definition of Done:

- [ ] Baseline screenshots tồn tại cho toàn bộ core screens.
- [ ] Visual diff pass ở threshold đã thống nhất.
- [ ] CSS/component mapping doc chỉ ra legacy selector tương ứng component mới.
- [ ] Frontend `npm run type-check`, `npm run lint`, `npm run build` pass.

Validation nhỏ nhất:

- [ ] `cd platform/frontend && npm run type-check && npm run lint`.
- [ ] Visual regression command sau khi được thêm.

##### Phase 5.0 — Attachment MinIO/S3 + malware scan

Mục tiêu:

- Migrate attachment/file evidence ra object storage chuẩn S3-compatible, giữ metadata trong PostgreSQL, có malware scan hook trước download.

Input sẽ dùng:

- Legacy reference: TheHive attachment service/tests, `thehive/test/resources/data/Attachment.json`, `LogAttachment.json`, `ObservableAttachment.json`.
- Schema hiện có: `attachments` table.
- Infra hiện có: Docker Compose, backend config, audit helper.

Sẽ chỉnh sửa gì:

- Infrastructure:
  - [ ] Add MinIO service to Docker Compose and `.env.example`.
  - [ ] Add bucket init policy for dev/self-host.
- Database:
  - [ ] Extend `attachments`: hash, scan_status, scan_engine, storage_backend, bucket, object_key, retention, uploaded_by.
  - [ ] Add indexes by case/observable/log and scan status.
- Backend:
  - [ ] Add S3-compatible storage client.
  - [ ] Add upload init endpoint with object key allocation.
  - [ ] Add signed download URL endpoint.
  - [ ] Add malware scan hook interface and ClamAV/placeholder adapter.
  - [ ] Block unsafe download until scan clean or policy allows.
  - [ ] Add attachment audit events.
- Frontend:
  - [ ] Add attachment UI in case logs, observables, case detail.
  - [ ] Show scan status and blocked download reason.
- OpenAPI/tests:
  - [ ] Document upload/download/scan contracts.
  - [ ] Add storage client unit tests and handler tests.

Output mong muốn:

- User-facing behavior: analyst upload/download evidence như TheHive 4 nhưng có scan status rõ.
- API behavior: binary không lưu DB; API trả metadata/signed URL an toàn.
- Data behavior: PostgreSQL giữ metadata, MinIO/S3 giữ object, audit trace đầy đủ.
- Security behavior: malware/unknown files bị block theo policy.

Definition of Done:

- [ ] Upload/download flow works locally with MinIO.
- [ ] Scan hook interface được gọi trong flow.
- [ ] Attachment metadata migration reversible.
- [ ] Audit event có cho upload/download/delete/scan.

Validation nhỏ nhất:

- [ ] Docker Compose config render pass.
- [ ] Backend storage tests pass.
- [ ] Manual upload/download smoke test với MinIO dev.

##### Phase 6.0 — Cortex adapter production

Mục tiêu:

- Biến observable analyze placeholder thành Cortex analyzer/responder production flow async, có job persistence, retry, report rendering.

Input sẽ dùng:

- Legacy reference: `cortex/`, `thehive/app/org/thp/thehive/services/ObservableSrv.scala`, Cortex DTO/tests.
- Current placeholder: `POST /api/v1/observables/{id}/analyze`.
- Queue foundation: RabbitMQ client.

Sẽ chỉnh sửa gì:

- Database:
  - [ ] Add cortex_connections, analyzer_catalog, responder_catalog.
  - [ ] Add enrichment_jobs, enrichment_results, response_jobs.
- Backend/worker:
  - [ ] Add Cortex API client with timeout/retry/backoff.
  - [ ] Add analyzer/responder catalog sync.
  - [ ] Add RabbitMQ job publisher from analyze endpoint.
  - [ ] Add worker command/process to execute/poll jobs.
  - [ ] Persist analyzer reports and errors.
- Frontend:
  - [ ] Render analyzer list/report in observable detail.
  - [ ] Show job queued/running/success/failure states.
- OpenAPI/tests:
  - [ ] Document analyzer catalog, job status, result endpoints.
  - [ ] Add fake Cortex integration tests.

Output mong muốn:

- User-facing behavior: analyst click Analyze giống TheHive 4 và xem report trong observable detail.
- API behavior: analyze returns real job ID, status can be queried, results persisted.
- Data behavior: job/result tables retain history and errors.
- Operations behavior: queue retry/dead-letter observable in metrics/logs.

Definition of Done:

- [ ] Analyze endpoint creates real job and publishes RabbitMQ message.
- [ ] Worker persists result from fake Cortex test server.
- [ ] UI renders report shape matching legacy Cortex report expectations.
- [ ] Audit and metrics exist for job lifecycle.

Validation nhỏ nhất:

- [ ] Backend worker/client tests pass.
- [ ] Manual fake Cortex analyze smoke test pass.

##### Phase 7.0 — MISP adapter production

Mục tiêu:

- Migrate MISP event/attribute import/export workflow sang adapter mới, có preview/dedup/taxonomy/tag sync và audit.

Input sẽ dùng:

- Legacy MISP integration reference nếu có trong `misp/` và TheHive legacy services.
- MISP sample events/attributes.
- Current alert/observable schema and write APIs.

Sẽ chỉnh sửa gì:

- Database:
  - [ ] Add misp_connections, misp_sync_jobs, misp_event_links, ioc_sources.
  - [ ] Add external refs/lineage metadata for imported alerts/observables.
- Backend/worker:
  - [ ] Add MISP API client.
  - [ ] Add event import preview endpoint.
  - [ ] Map MISP event info/source to alert fields.
  - [ ] Map MISP attributes to observables.
  - [ ] Add IOC dedup and sync loop prevention.
  - [ ] Add taxonomy/tag sync.
  - [ ] Add case observable export to MISP.
- Frontend:
  - [ ] Add MISP config screen.
  - [ ] Add import preview screen and export action from case/observable.
- OpenAPI/tests:
  - [ ] Document preview/import/export contracts.
  - [ ] Add fake MISP tests with sample payloads.

Output mong muốn:

- User-facing behavior: analyst preview MISP event before creating alert, export confirmed IOC from case.
- API behavior: preview is non-mutating; import/export audited and idempotent.
- Data behavior: imported IOC has source lineage and dedup metadata.
- UI/UX parity behavior: MISP-imported alerts fit same alert triage/import workflow as TheHive 4.

Definition of Done:

- [ ] Preview/import/export happy paths pass fake MISP tests.
- [ ] Dedup prevents duplicate IOC noise.
- [ ] Taxonomy/tag mapping documented and tested.
- [ ] Audit events exist for import/export.

Validation nhỏ nhất:

- [ ] Backend fake MISP tests pass.
- [ ] Manual import preview smoke test pass.

##### Phase 8.0 — OpenSearch dashboard/global search

Mục tiêu:

- Đưa search/dashboard sang OpenSearch rebuildable index, PostgreSQL vẫn là source of truth.

Input sẽ dùng:

- Current PostgreSQL cases/alerts/observables/logs/audit tables.
- Legacy TheHive dashboard/search behavior.
- Docker Compose infra.

Sẽ chỉnh sửa gì:

- Infrastructure:
  - [ ] Add OpenSearch service to Docker Compose.
  - [ ] Add search config/env docs.
- Database/backend:
  - [ ] Add outbox table for index events.
  - [ ] Add indexer worker.
  - [ ] Define indexes for cases, alerts, observables, logs, audit.
  - [ ] Add rebuild index command.
  - [ ] Add global search API.
  - [ ] Add dashboard aggregation API.
  - [ ] Add fallback behavior if OpenSearch unavailable.
- Frontend:
  - [ ] Add global search UI in topbar.
  - [ ] Add dashboard widgets matching TheHive 4 metrics style.
- Tests/docs:
  - [ ] Add index mapping tests.
  - [ ] Add rebuild runbook.

Output mong muốn:

- User-facing behavior: global search and dashboard feel like TheHive 4 but faster/scalable.
- API behavior: search supports query/filter/sort/page, dashboard returns stable aggregations.
- Data behavior: OpenSearch can be fully rebuilt from PostgreSQL.
- Operations behavior: index lag/failure visible in metrics/logs.

Definition of Done:

- [ ] Rebuild index command produces expected document counts.
- [ ] Search returns parity results for golden dataset.
- [ ] Dashboard widgets match expected aggregation counts.
- [ ] OpenSearch outage does not corrupt source data.

Validation nhỏ nhất:

- [ ] Docker Compose OpenSearch up.
- [ ] Rebuild/search smoke test pass.

##### Phase 9.0 — Data migration pilot + shadow compare

Mục tiêu:

- Migrate dữ liệu TheHive 4 thật theo batch, resumable, checksum, có shadow compare để chứng minh 100% semantic parity trước cutover.

Input sẽ dùng:

- Legacy TheHive 4 database/export/API dump.
- Legacy fixtures trong `thehive/test/resources/data`.
- New PostgreSQL schema and write/read APIs.
- Mapping docs from previous phases.

Sẽ chỉnh sửa gì:

- Migrator:
  - [ ] Inventory legacy entities and fields.
  - [ ] Write mapping doc per entity: Case, Alert, Observable, Task, Log, Attachment, CustomField, Procedure, Share, User/Profile/Org.
  - [ ] Add resumable migration runner with cursor per entity.
  - [ ] Add checksum per source entity and target entity.
  - [ ] Add failed record table/report.
  - [ ] Add dry-run mode.
- Shadow compare:
  - [ ] Add compare reports for list counts, detail shape, workflow state, attachment metadata, permissions.
  - [ ] Add acceptance thresholds and manual review queue.
- Docs/ops:
  - [ ] Add rollback/forward-fix runbook.
  - [ ] Add masked real dataset pilot instructions.

Output mong muốn:

- User-facing behavior: migrated cases/alerts/observables/tasks/logs look and behave like TheHive 4.
- Data behavior: every migrated entity has source ID, checksum, status, error report if failed.
- Operations behavior: migration can resume safely and report exact completeness.
- Cutover behavior: team can prove parity before switching users.

Definition of Done:

- [ ] Golden fixtures migrate with 100% expected counts and checksums.
- [ ] Masked real dataset pilot report passes acceptance threshold.
- [ ] Shadow compare report has no critical mismatch.
- [ ] Rollback/forward-fix runbook reviewed.

Validation nhỏ nhất:

- [ ] Migrator dry-run pass.
- [ ] Migrator real run on masked dataset pass.
- [ ] Shadow compare report generated.

##### Phase 10.0 — Production pilot/cutover

Mục tiêu:

- Cutover từng workflow sang platform mới an toàn, có feature flags, rollback, monitoring, TheHive 4 read-only archive.

Input sẽ dùng:

- Completed v0.5-v0.9 platform.
- Migration/shadow compare reports.
- Production/staging config and backup/restore runbooks.

Sẽ chỉnh sửa gì:

- Backend/config:
  - [ ] Add feature flags per org/team/user.
  - [ ] Add read-only archive mode links to legacy TheHive 4.
  - [ ] Add production config validation.
- Operations:
  - [ ] Add canary group pilot plan.
  - [ ] Add operational dashboards.
  - [ ] Add backup/restore tested checklist.
  - [ ] Add incident rollback runbook.
  - [ ] Add final cutover checklist.
  - [ ] Add post-cutover validation and sign-off.
- Frontend:
  - [ ] Show feature flag disabled/read-only states cleanly.
  - [ ] Add legacy archive links where needed during pilot.

Output mong muốn:

- User-facing behavior: selected team can work fully on new platform; fallback/read-only legacy reference remains available.
- Operations behavior: rollback path is explicit and tested.
- Business behavior: production pilot has sign-off based on metrics, migration report, analyst acceptance.

Definition of Done:

- [ ] Canary pilot succeeds with defined team/org.
- [ ] Monitoring dashboards green.
- [ ] Backup/restore tested.
- [ ] Rollback drill completed.
- [ ] Final sign-off recorded.

Validation nhỏ nhất:

- [ ] Production readiness checklist pass.
- [ ] Canary workflow smoke tests pass.

#### 17.26.5 Step-by-step execution order for next work

1. [ ] Start Phase 4.0.1 with DB relation for alert observables/artifacts.
2. [ ] Implement import-copy behavior with unit + integration tests.
3. [ ] Harden alert merge with dedup/conflict report.
4. [ ] Decide observable delete retention policy and implement migration.
5. [ ] Add permission matrix tests for all write APIs.
6. [ ] Add integration DB test suite scaffold.
7. [ ] Start visual regression baseline capture.
8. [ ] Only after write/API hardening, move to attachment MinIO/S3.
9. [ ] After attachments, wire Cortex analyze real queue.
10. [ ] After Cortex, wire MISP import/export.
11. [ ] After integrations, add OpenSearch read index and dashboards.
12. [ ] After search, run data migration pilot and shadow compare.

#### 17.26.6 Đề xuất giữ lại/migrate từ TheHive 4 để tái sử dụng code cũ đúng cách

Nên giữ lại làm reference/spec:

- [ ] Legacy Scala service/controller behavior cho case lifecycle.
- [ ] Legacy alert import/merge behavior làm acceptance test.
- [ ] Legacy observable analyzer/report shape để render report cũ.
- [ ] Legacy task/log timeline behavior.
- [ ] Legacy permission names và profile semantics.
- [ ] Legacy AngularJS templates làm screenshot/DOM reference, không làm runtime dependency.
- [ ] Legacy test fixtures làm golden dataset.

Nên migrate bằng cách port/rebuild:

- [ ] Port business rules thành Go repository/service + tests.
- [ ] Port UI thành React component theo visual baseline.
- [ ] Port query DSL thành compatibility adapter có contract tests.
- [ ] Port Cortex/MISP integration thành adapter/worker riêng.
- [ ] Port file storage sang S3-compatible storage.
- [ ] Port search sang OpenSearch rebuildable index.
- [ ] Port legacy DB data bằng resumable migrator, không query trực tiếp legacy DB ở runtime production mới.

Không nên giữ nguyên:

- [ ] Không giữ AngularJS runtime trong app mới.
- [ ] Không giữ Scala/Play backend trong core write path mới.
- [ ] Không đưa legacy DB/search làm source of truth lâu dài.
- [ ] Không copy CSS legacy nguyên khối nếu selector phụ thuộc DOM AngularJS cũ.
- [ ] Không gọi trực tiếp Cortex/MISP từ request path nếu có thể queue async.

## 18. Khuyến nghị cuối cùng

Best idea cho production là không cố sửa sâu TheHive 4 legacy, mà dùng nó làm baseline nghiệp vụ và chuyển đổi dần.

Khuyến nghị chọn hướng:

```text
Phase ngắn hạn:
  Docker hóa TheHive 4 + backup + monitoring.

Phase trung hạn:
  Build UI/BFF/integration service mới.
  Tích hợp MISP/Cortex qua adapter riêng.

Phase dài hạn:
  Build case-management core mới bằng stack hiện đại.
  PostgreSQL làm source of truth.
  OpenSearch làm search index.
  MinIO/S3 làm file storage.
  OIDC làm auth.
```

Cách này cân bằng được:

- Ít rủi ro.
- Dễ test.
- Dễ rollback.
- Dễ custom UI/UX.
- Giảm phụ thuộc legacy stack.
- Chuẩn production hơn.
