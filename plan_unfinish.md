# Plan Unfinished - Actionable 100% TheHive 4 Parity Backlog

> Cleaned: 2026-04-29T03:15+07:00. This file contains only incomplete or not-proven work. Completed evidence belongs in `plan_done.md`.

## 0. Completion Rules

- [ ] Do not mark an item `[x]` unless code exists and validation/smoke evidence is recorded.
- [ ] Use `[-]` only for foundation/partial work that still lacks runtime, visual, or integration proof.
- [ ] Every task must preserve: Input, Will change, Expected output, Actual output, Effect, Completion check, Missing/upgrade.
- [ ] The next agent must read `context.md`, `plan.md`, `plan_done.md`, and this file before coding.
- [ ] Never claim 100% parity until all phases A-F pass.

## 1. Phase A - Runtime Evidence Gate

### A2 - Core SOC workflow smoke

- Status: [-]
- Input:
  - [x] Running Compose stack from A1.
  - [x] `platform/backend/internal/tests/smoke_a2_core_soc_test.go` created.
  - [ ] Admin/test JWT working (blocked by 401).
  - [x] Seeded data from fixture migration.
- Will change:
  - [ ] Debug login credential issue causing 401.
  - [ ] If smoke fails after credential fix, fix smallest broken API/UI path.
- Expected output:
  - [ ] User logs in.
  - [ ] `/api/v1/auth/me` and admin profile/permissions load.
  - [ ] Case can be created and opened.
  - [ ] Task can be created, started, closed, reopened, cancelled.
  - [ ] Alert can be imported/merged or a seeded alert can be actioned.
  - [ ] Observable can be created and toggled IOC/sighted/ignoreSimilarity.
  - [ ] Audit/timeline entries appear.
- Actual output:
  - [-] Test framework created; credential issue blocking execution.
- Effect:
  - [-] Smoke test framework ready; runtime verification pending credential fix.
- Completion check:
  - [ ] All A2 tests passing.
  - [ ] API/browser evidence captured.
  - [ ] No blocking browser console errors.
  - [ ] No server 5xx logs for smoke path.
  - [ ] Result summary copied into `plan_done.md`.
- Missing/upgrade:
  - [ ] Fix login 401 error.
  - [ ] Execute full A2 test suite.

### A3 - Runtime MinIO attachment smoke

- Status: [-]
- Input:
  - [x] Running Compose stack with MinIO.
  - [x] `platform/backend/internal/tests/smoke_a3_minio_test.go` created.
  - [ ] Case ID and observable ID from running tests.
  - [ ] Attachment endpoints verified working.
- Will change:
  - [ ] If upload/finalize/download fails, fix storage endpoint/public URL/fetch object/scan policy only.
  - [ ] If ZIP fails, fix `attachmentzip` or response headers only.
- Expected output:
  - [ ] Upload init returns metadata and presigned URL.
  - [ ] Real bytes are PUT to MinIO.
  - [ ] Finalize computes SHA-256 and size server-side.
  - [ ] Download is blocked before clean scan under clean-only policy.
  - [ ] Manual clean scan allows direct download.
  - [ ] ZIP download returns encrypted ZIP openable with configured password.
  - [ ] File observable stores and renders `attachment_id`.
- Actual output:
  - [-] Test file created; runtime execution pending A2 completion.
- Effect:
  - [-] Evidence storage smoke test framework ready; runtime verification pending.
- Completion check:
  - [ ] All A3 tests passing.
  - [ ] `hash_source` is `server-side` or equivalent proof exists.
  - [ ] Computed size/hash match uploaded bytes.
  - [ ] Clean-only policy behavior captured.
  - [ ] ZIP payload verified by Go test or external unzip/7zip.
  - [ ] Result summary copied into `plan_done.md`.
- Missing/upgrade:
  - [ ] Execute A3 tests after A2 credential fix.
  - [ ] Malware scanner remains placeholder/manual.
  - [ ] Retention policy remains incomplete.

### A4 - Runtime PostgreSQL authorization smoke

- Status: [-]
- Input:
  - [x] Running PostgreSQL stack.
  - [x] `platform/backend/internal/tests/smoke_a4_authz_test.go` created.
  - [ ] Two users in different organisations/profiles (create via tests).
  - [ ] Case with owner and non-owner shares.
- Will change:
  - [ ] If allow/deny behavior fails, fix `authz.go`, share propagation, or route guard only.
- Expected output:
  - [ ] Assignee allowed when user belongs to shared org with required profile permission.
  - [ ] Assignee denied when user is outside shared org or lacks permission.
  - [ ] Owner org can perform destructive share/case action.
  - [ ] Non-owner org is denied destructive share/case action.
  - [ ] `managePlatform` bypass works intentionally.
- Actual output:
  - [-] Test file created; runtime execution pending A2 completion.
- Effect:
  - [-] Multi-org authorization smoke test framework ready; runtime verification pending.
- Completion check:
  - [ ] All A4 tests passing.
  - [ ] Allow/deny matrix run against real DB or DB-backed integration test.
  - [ ] Result summary copied into `plan_done.md`.
- Missing/upgrade:
  - [ ] Execute A4 tests after A2 credential fix.
  - [ ] UI per-button visual permission matrix remains pending.

### A3 - Runtime MinIO attachment smoke

- Status: [ ]
- Input:
  - [ ] Running Compose stack with MinIO.
  - [ ] Case ID and observable ID.
  - [ ] Attachment endpoints from current backend.
- Will change:
  - [ ] If upload/finalize/download fails, fix storage endpoint/public URL/fetch object/scan policy only.
  - [ ] If ZIP fails, fix `attachmentzip` or response headers only.
- Expected output:
  - [ ] Upload init returns metadata and presigned URL.
  - [ ] Real bytes are PUT to MinIO.
  - [ ] Finalize computes SHA-256 and size server-side.
  - [ ] Download is blocked before clean scan under clean-only policy.
  - [ ] Manual clean scan allows direct download.
  - [ ] ZIP download returns encrypted ZIP openable with configured password.
  - [ ] File observable stores and renders `attachment_id`.
- Actual output:
  - [ ] Not run.
- Effect:
  - [ ] Proves evidence handling is real runtime behavior.
- Completion check:
  - [ ] `hash_source` is `server-side` or equivalent proof exists.
  - [ ] Computed size/hash match uploaded bytes.
  - [ ] Clean-only policy behavior captured.
  - [ ] ZIP payload verified by Go test or external unzip/7zip.
  - [ ] Result summary copied into `plan_done.md`.
- Missing/upgrade:
  - [ ] Malware scanner remains placeholder/manual.
  - [ ] Retention policy remains incomplete.

### A4 - Runtime PostgreSQL authorization smoke

- Status: [ ]
- Input:
  - [ ] Running PostgreSQL stack.
  - [ ] Two users in different organisations/profiles.
  - [ ] Case with owner and non-owner shares.
- Will change:
  - [ ] If allow/deny behavior fails, fix `authz.go`, share propagation, or route guard only.
- Expected output:
  - [ ] Assignee allowed when user belongs to shared org with required profile permission.
  - [ ] Assignee denied when user is outside shared org or lacks permission.
  - [ ] Owner org can perform destructive share/case action.
  - [ ] Non-owner org is denied destructive share/case action.
  - [ ] `managePlatform` bypass works intentionally.
- Actual output:
  - [ ] Not run.
- Effect:
  - [ ] Proves permission/share foundation protects multi-org workflows.
- Completion check:
  - [ ] Allow/deny matrix run against real DB or DB-backed integration test.
  - [ ] Result summary copied into `plan_done.md`.
- Missing/upgrade:
  - [ ] UI per-button visual permission matrix remains pending.

## 2. Phase B - Core Behavior And UI Parity

### B1 - Case lifecycle, custom fields, procedures, shares

- Status: [-]
- Input:
  - [ ] Legacy `Case.scala`, `CaseCtrl.scala`, `CaseRenderer.scala`, `CaseTemplate.scala`, `CustomField.scala`, `Procedure.scala`, `Share.scala`.
  - [ ] Current case repository, handlers, and UI.
- Will change:
  - [ ] Add DB-backed lifecycle tests beyond mock SQL.
  - [ ] Add custom field typed editor parity where missing.
  - [ ] Add procedure/share/actionRequired/profile semantic tests.
  - [ ] Fix delete/soft-delete semantics if legacy comparison shows mismatch.
- Expected output:
  - [ ] Case create/update/close/reopen/duplicate/delete match legacy or documented accepted translation.
  - [ ] Template-created tasks/custom fields/tags match fixtures.
  - [ ] Procedures and shares round-trip through API/UI.
  - [ ] Audit/timeline rows exist for lifecycle transitions.
- Actual output:
  - [-] Foundation and mock tests exist; UI is partially migrated.
- Effect:
  - [ ] Prevents core case/SOP/multi-org data loss.
- Completion check:
  - [ ] Focused DB tests pass.
  - [ ] Runtime A2 smoke passes.
  - [ ] Screenshot baseline for case create/detail passes.
- Missing/upgrade:
  - [ ] Delete semantics need legacy comparison.
  - [ ] Dynamic typed custom fields incomplete.
  - [ ] Share profile/actionRequired semantics need proof.

### B2 - Alert import/merge parity

- Status: [-]
- Input:
  - [ ] Legacy `Alert.scala`, `AlertCtrl.scala`, `AlertRenderer.scala`, alert fixtures.
  - [ ] Current alert write repository/handlers/UI.
- Will change:
  - [ ] Add golden DB tests for alert import to case.
  - [ ] Add merge conflict/dedup tests.
  - [ ] Add attachment/custom field/source ref copy assertions.
  - [ ] Polish investigation list multi-select/bulk action UX if needed.
- Expected output:
  - [ ] Alert import maps title, description, PAP/TLP/severity/date, tags, custom fields, observables, attachments, source refs, and case template.
  - [ ] Merge preserves evidence and reports copied/deduplicated/conflicts.
  - [ ] Similar-alert/case scoring matches golden expectations.
- Actual output:
  - [-] Foundation and UI triage parity exist; golden DB proof pending.
- Effect:
  - [ ] Makes SOC alert triage migration safe.
- Completion check:
  - [ ] Golden DB/fixture tests pass.
  - [ ] Merge report assertions pass.
  - [ ] Browser smoke and screenshots pass.
- Missing/upgrade:
  - [ ] Runtime proof pending.
  - [ ] Multi-select list UX still polish.

### B3 - Task/log workbench parity

- Status: [-]
- Input:
  - [ ] Legacy `Task.scala`, `Log.scala`, task/log partials.
  - [ ] Current workwrite repository, handlers, task/log UI.
- Will change:
  - [ ] Add DB tests for lifecycle, order, group, due date, assignment, bulk close/assign.
  - [ ] Prove logs are append-only through normal API.
  - [ ] Add markdown compatibility notes/tests.
  - [ ] Implement drag/drop reorder only if required for parity.
- Expected output:
  - [ ] Task fields/statuses match legacy.
  - [ ] Bulk close maps `InProgress` to `Completed` and `Waiting` to `Cancel`.
  - [ ] Logs cannot be updated/deleted through normal API.
  - [ ] Timeline ordering is deterministic.
- Actual output:
  - [-] Foundation, UI parity pages, and mock tests exist.
- Effect:
  - [ ] Protects analyst workbench behavior.
- Completion check:
  - [ ] Backend DB tests pass.
  - [ ] A2 smoke confirms task/log display.
  - [ ] Screenshots pass.
- Missing/upgrade:
  - [ ] Drag-and-drop reorder missing.
  - [ ] Markdown editor parity missing.
  - [ ] Task sharing/responder jobs UI missing.

### B4 - Observable/evidence/analyzer UI parity

- Status: [-]
- Input:
  - [ ] Legacy `Observable.scala`, `ObservableType.scala`, attachment/analyzer views.
  - [ ] Current observable repository, attachment handler, Cortex UI.
- Will change:
  - [ ] Add DB tests for `full_data`, `data_hash`, `attachment_id`, observable type validation.
  - [ ] Add runtime file observable upload/download test.
  - [ ] Add exact Cortex report renderer/modal parity if missing.
  - [ ] Decide and document soft-delete/retention behavior.
- Expected output:
  - [ ] Large observable preserves original full data and stores indexed hash.
  - [ ] File observable references attachment and renders/downloads correctly.
  - [ ] Observable type registry validates expected types.
  - [ ] Analyzer reports render comparable to legacy.
- Actual output:
  - [-] Observable detail UI and backend foundation exist.
- Effect:
  - [ ] Prevents evidence and IOC data loss.
- Completion check:
  - [ ] DB hash/full-data tests pass.
  - [ ] Runtime file observable smoke passes.
  - [ ] Screenshot baseline passes.
- Missing/upgrade:
  - [ ] Exact hash compatibility decision pending.
  - [ ] Observable delete/retention policy unresolved.
  - [ ] Full report renderer parity pending.

### B5 - Admin/auth/audit and permission UI parity

- Status: [-]
- Input:
  - [ ] Legacy user/org/profile/permission views and models.
  - [ ] Current admin/auth/audit UI and backend.
- Will change:
  - [-] Compare admin subpanels against legacy and migrate remaining generic UI.
  - [ ] Add permission-specific button visibility matrix.
  - [ ] Add runtime admin/profile/invite/reset smoke.
- Expected output:
  - [ ] Users/orgs/profiles/permissions/invites/reset/audit operate and match legacy density.
  - [ ] Buttons show/hide/disable according to profile/share permissions.
- Actual output:
  - [-] Foundation exists; reusable TheHive 4 inline edit/badge/share/modal primitives and admin taxonomy/ATT&CK endpoint wiring were added. Full UI matrix not proven.
- Effect:
  - [ ] Protects operator and security workflows.
- Completion check:
  - [ ] Runtime admin smoke passes.
  - [ ] Permission visual matrix screenshots pass.
- Missing/upgrade:
  - [-] Admin subpanel visual parity partially advanced by reusable components and taxonomy/ATT&CK wiring; case-template detail editing and runtime proof still pending.
  - [ ] Runtime authz proof pending.

### B6 - Visual regression and exact UI style parity

- Status: [ ]
- Input:
  - [ ] Legacy AngularJS/AdminLTE pages and current Next.js pages.
- Will change:
  - [ ] Add Playwright visual baseline or equivalent.
  - [ ] Capture legacy and new screenshots for all core pages.
  - [ ] Fix visual diffs page-by-page.
  - [ ] Document accepted differences.
- Expected output:
  - [ ] New UI visually follows TheHive 4/AdminLTE workflow and density.
  - [ ] Critical actions appear/hide according to permission.
- Actual output:
  - [ ] Manual UI migration exists; no visual proof.
- Effect:
  - [ ] Prevents UI drift.
- Completion check:
  - [ ] `npm run visual:test` or equivalent passes.
  - [ ] Baselines reviewed and accepted.
- Missing/upgrade:
  - [ ] Exact Font Awesome/icon parity pending.
  - [ ] Screenshot baselines missing.

## 3. Phase C - Integration Production Hardening

### C1 - Cortex fake/real integration proof

- Status: [-]
- Input:
  - [ ] Legacy Cortex DTO/client references.
  - [ ] Current Cortex client/worker/module/UI.
- Will change:
  - [ ] Add fake Cortex test server and tests for analyzer list/run/report.
  - [ ] Run worker claim/submit/report persistence test.
  - [ ] Add metrics/audit assertions.
  - [ ] Run real Cortex smoke when config is available.
- Expected output:
  - [ ] Observable analyzer job runs end-to-end against fake Cortex and can be configured for real Cortex.
- Actual output:
  - [-] Client/worker/foundation exists.
- Effect:
  - [ ] Converts analyzer workflow from foundation to proven integration.
- Completion check:
  - [ ] Fake Cortex worker tests pass.
  - [ ] Manual analyze smoke produces completed report.
- Missing/upgrade:
  - [ ] Runtime worker proof missing.

### C2 - MISP fake/real integration proof

- Status: [-]
- Input:
  - [ ] Legacy MISP expectations and current MISP adapter/UI.
- Will change:
  - [ ] Add dedicated fake MISP handler tests for preview/import/export.
  - [ ] Add taxonomy/tag sync assertions.
  - [ ] Add scheduled sync/no-loop assertions.
  - [ ] Prove TLS verification config behavior.
- Expected output:
  - [ ] Import/export workflows are tested without external dependency.
  - [ ] Tags/taxonomies map consistently.
  - [ ] Scheduled sync does not duplicate IOC noise.
- Actual output:
  - [-] MISP foundation/fake server/UI exists.
- Effect:
  - [ ] Moves MISP to production workflow.
- Completion check:
  - [ ] Fake MISP tests pass.
  - [ ] Runtime smoke against fake or real MISP passes.
- Missing/upgrade:
  - [ ] Dedicated assertions and runtime proof pending.

### C3 - Notification dispatch proof

- Status: [-]
- Input:
  - [ ] Current notification config/queue/worker.
  - [ ] TheHive trigger/notifier concepts.
- Will change:
  - [ ] Add fake webhook tests.
  - [ ] Add email adapter smoke if Mailpit is available.
  - [ ] Add retry/dead-letter/audit/metrics assertions.
- Expected output:
  - [ ] Configured notification fires on at least one case/alert/task event.
- Actual output:
  - [-] Worker/trigger foundation exists.
- Effect:
  - [ ] Makes notifications operational instead of static CRUD.
- Completion check:
  - [ ] Notification worker tests pass.
  - [ ] Fake webhook receives payload.
- Missing/upgrade:
  - [ ] Runtime dispatch proof missing.

### C4 - Dashboard/page schema, scoping, rich editing

- Status: [-]
- Input:
  - [ ] Current dashboard/page CRUD and legacy models/views.
- Will change:
  - [ ] Add dashboard definition schema validation.
  - [-] Add widget customization/color editor parity.
  - [ ] Add page permission/scoping tests.
  - [ ] Add markdown preview/WYSIWYG parity if required.
- Expected output:
  - [ ] Dashboards/pages are usable analyst/admin features, not raw CRUD.
- Actual output:
  - [-] UI and aggregation foundation exists; reusable `DashboardWidgetEditor.tsx` now provides Basic/Series/Filters/Sort/Customize editor tabs but is not wired into dashboard flows yet.
- Effect:
  - [ ] Preserves dashboard and knowledge workflows.
- Completion check:
  - [ ] UI smoke and permission tests pass.
- Missing/upgrade:
  - [-] Exact customization editor component exists; dashboard page wiring and page scoping proof pending.

## 4. Phase D - Search And Full Migration

### D1 - OpenSearch rebuild and search parity

- Status: [-]
- Input:
  - [ ] PostgreSQL cases/alerts/observables/tasks/logs/audit.
  - [ ] Legacy search/query/dashboard behavior.
- Will change:
  - [ ] Run rebuild index and compare document counts with PostgreSQL.
  - [ ] Add golden search dataset tests.
  - [ ] Compare query DSL filters/stats against legacy examples.
  - [ ] Polish search result UI density if needed.
- Expected output:
  - [ ] Search workload is rebuildable and returns expected hits.
- Actual output:
  - [-] OpenSearch service/client/indexer/search/dashboard foundation exists.
- Effect:
  - [ ] Completes read/search architecture.
- Completion check:
  - [ ] Rebuild index document counts match PostgreSQL.
  - [ ] Golden search dataset returns expected hits.
- Missing/upgrade:
  - [ ] Count parity and golden hit validation pending.

### D2 - Runtime migration and shadow compare artifact

- Status: [-]
- Input:
  - [ ] Legacy TheHive 4 export/API/fixture data.
  - [ ] Current PostgreSQL schema.
  - [ ] Existing resumable migrator and shadow compare core.
- Will change:
  - [ ] Run golden fixtures through executable migrator.
  - [ ] Save report artifact.
  - [ ] Run shadow compare against migrated DB.
  - [ ] Expand coverage beyond cases/alerts/observables if missing.
- Expected output:
  - [ ] Shadow compare runtime report has no critical mismatch.
- Actual output:
  - [-] Core runner and CLI modes exist.
- Effect:
  - [ ] Proves migration correctness before cutover.
- Completion check:
  - [ ] Golden fixtures migrate with expected counts.
  - [ ] Shadow compare artifact stored and linked from `plan_done.md`.
- Missing/upgrade:
  - [ ] Runtime artifact pending.
  - [ ] Full entity coverage pending.

## 5. Phase E - Production Pilot/Cutover

### E1 - Feature flags by org/team/user

- Status: [ ]
- Input:
  - [ ] Completed Phase A-D gates.
- Will change:
  - [ ] Add feature flag model/API/UI or config-driven rollout.
- Expected output:
  - [ ] Enable new platform per org/team/user.
- Actual output:
  - [ ] Not started.
- Effect:
  - [ ] Supports safe canary rollout.
- Completion check:
  - [ ] Flag allow/deny tests pass.
- Missing/upgrade:
  - [ ] Entire task pending.

### E2 - Legacy read-only archive links

- Status: [ ]
- Input:
  - [ ] Legacy TheHive base URL and migrated entity legacy IDs.
- Will change:
  - [ ] Add archive link fields/UI for cases/alerts/observables/tasks.
- Expected output:
  - [ ] Analysts can open legacy read-only reference for migrated records.
- Actual output:
  - [ ] Not started.
- Effect:
  - [ ] Supports rollback/traceability during pilot.
- Completion check:
  - [ ] Links render and are permission-gated.
- Missing/upgrade:
  - [ ] Entire task pending.

### E3 - Production config validation

- Status: [ ]
- Input:
  - [ ] Production env requirements.
- Will change:
  - [ ] Add startup config validation for secrets, URLs, storage, OpenSearch, MISP/Cortex, SMTP, feature flags.
- Expected output:
  - [ ] Bad production config fails fast with actionable error.
- Actual output:
  - [ ] Not started.
- Effect:
  - [ ] Reduces deployment mistakes.
- Completion check:
  - [ ] Config validation tests pass.
- Missing/upgrade:
  - [ ] Entire task pending.

### E4 - Operational dashboards and alerting

- Status: [ ]
- Input:
  - [ ] Metrics/logging/worker status.
- Will change:
  - [ ] Add dashboards/alerts for API, DB, workers, queues, storage, OpenSearch, MISP/Cortex failures.
- Expected output:
  - [ ] Operators can see health and failure modes.
- Actual output:
  - [ ] Not started.
- Effect:
  - [ ] Supports production pilot.
- Completion check:
  - [ ] Dashboards load and alert rules fire in test.
- Missing/upgrade:
  - [ ] Entire task pending.

### E5 - Backup/restore and rollback runbook

- Status: [ ]
- Input:
  - [ ] PostgreSQL, object storage, OpenSearch rebuild, legacy archive.
- Will change:
  - [ ] Write and test backup/restore and rollback steps.
- Expected output:
  - [ ] Restore and rollback are rehearsed.
- Actual output:
  - [ ] Not started.
- Effect:
  - [ ] Makes cutover reversible.
- Completion check:
  - [ ] Restore test and rollback rehearsal recorded.
- Missing/upgrade:
  - [ ] Entire task pending.

### E6 - Canary pilot sign-off

- Status: [ ]
- Input:
  - [ ] Completed E1-E5.
- Will change:
  - [ ] Run selected SOC team pilot.
- Expected output:
  - [ ] Pilot succeeds or blockers are filed.
- Actual output:
  - [ ] Not started.
- Effect:
  - [ ] Final release-candidate gate.
- Completion check:
  - [ ] Sign-off recorded in `plan_done.md`.
- Missing/upgrade:
  - [ ] Entire task pending.

## 6. Phase F - Deep 100% Parity Verification

### F1 - Side-by-side screenshot comparison

- Status: [ ]
- Input:
  - [ ] Legacy running UI/screenshots and migrated UI.
- Will change:
  - [ ] Add visual harness and baseline artifacts.
- Expected output:
  - [ ] All key pages have reviewed diff artifacts.
- Actual output:
  - [ ] Not started.
- Effect:
  - [ ] Makes UI parity objective.
- Completion check:
  - [ ] Visual test command passes.
- Missing/upgrade:
  - [ ] Entire task pending.

### F2 - API response field-by-field comparison

- Status: [ ]
- Input:
  - [ ] Legacy API responses and new `/api/v1` responses.
- Will change:
  - [ ] Add comparison scripts/tests per entity.
- Expected output:
  - [ ] Field mapping differences are fixed or explicitly accepted.
- Actual output:
  - [ ] Not started.
- Effect:
  - [ ] Prevents contract/data loss.
- Completion check:
  - [ ] Comparison report has no critical mismatch.
- Missing/upgrade:
  - [ ] Entire task pending.

### F3 - Permission matrix visual regression

- Status: [ ]
- Input:
  - [ ] Profiles/permissions/share scenarios.
- Will change:
  - [ ] Add screenshots/API checks for button visibility/action denial.
- Expected output:
  - [ ] UI and API agree on allow/deny.
- Actual output:
  - [ ] Not started.
- Effect:
  - [ ] Prevents privilege bleed.
- Completion check:
  - [ ] Matrix passes for key profiles.
- Missing/upgrade:
  - [ ] Entire task pending.

### F4 - Data migration round-trip and shadow compare

- Status: [ ]
- Input:
  - [ ] Legacy export and migrated DB.
- Will change:
  - [ ] Run end-to-end migration and compare every supported entity.
- Expected output:
  - [ ] No critical mismatch.
- Actual output:
  - [ ] Not started.
- Effect:
  - [ ] Proves cutover data safety.
- Completion check:
  - [ ] Report artifact stored.
- Missing/upgrade:
  - [ ] Entire task pending.

### F5 - Performance baseline comparison

- Status: [ ]
- Input:
  - [ ] Legacy and new platform representative workloads.
- Will change:
  - [ ] Add response time and concurrency comparison.
- Expected output:
  - [ ] New platform meets or exceeds accepted baseline.
- Actual output:
  - [ ] Not started.
- Effect:
  - [ ] Prevents slow replacement release.
- Completion check:
  - [ ] Performance report accepted.
- Missing/upgrade:
  - [ ] Entire task pending.

### F6 - Accessibility and keyboard navigation parity

- Status: [ ]
- Input:
  - [ ] Legacy workflows and migrated UI.
- Will change:
  - [ ] Add keyboard and accessibility checks for core workflows.
- Expected output:
  - [ ] No critical keyboard/accessibility regressions.
- Actual output:
  - [ ] Not started.
- Effect:
  - [ ] Improves analyst usability.
- Completion check:
  - [ ] A11y/keyboard report accepted.
- Missing/upgrade:
  - [ ] Entire task pending.

## 11. Session 2026-04-29T06:00+07:00 Completed

The following tasks were completed in this session:

- [x] Backend: `PATCH /case-templates/:id` (TemplateHandler.Patch) — admin case-template edit.
- [x] Backend: `GET /cases/:id/observables` (DetailHandler.ListCaseObservables) — case observables tab refresh.
- [x] Backend: `casetemplate.Repository.Patch` — partial update of template metadata.
- [x] Tests: `integration_cortex_test.go` — fake Cortex server: list analyzers, filter by type, job lifecycle (Waiting→InProgress→Success), report retrieval, report-not-ready-before-success.
- [x] Tests: `integration_misp_test.go` — fake MISP server: list events, get event with attributes/IOC/tags, export event, taxonomy sync (list/enable/verify).
- [x] Tests: `integration_notification_test.go` — fake webhook: delivery success, retry on 5xx, payload required fields, trigger type vocabulary, dead-letter after max retries.
- [x] Tests: Fixed `testValidator` pointer receiver conflict across test package; fixed `testNow` redeclaration; fixed mock query patterns for case lifecycle (caseTasks LEFT JOIN, custom_fields order, Reopen GET pre-fetch, MarkDuplicated GET pre-fetch, Delete managePlatform bypass, timeline two-query sequence).
- [x] Frontend: `admin/profiles/page.tsx` — wired PATCH for edit, POST for create.
- [x] Frontend: `admin/organisations/page.tsx` — wired PATCH for edit, POST for create.
- [x] Frontend: `notifications/page.tsx` — rewrote to TheHive 4 nav-tabs-custom style with trigger/notifier config, enable/disable, edit/delete.
- [x] Frontend: `pages/page.tsx` — rewrote to TheHive 4 knowledge-pages style with category grouping, create/edit/view modals, markdown editor, slug display.
- [x] Frontend: `styles/globals.css` — added `modal-backdrop-custom`, `modal-dialog-custom`, `page-category-header` CSS tokens.
- [x] Validation: `go test ./internal/handler/... ./internal/server/... ./internal/tests/...` exit 0; `npm run build` exit 0 (35/35 routes).

## 12. Next Batch Recommendation (after session 2026-04-29T06:00+07:00)

Priority order for next session:

1. **A2 runtime browser/API smoke** — login, admin profile, case create/open, task lifecycle, alert import/merge, observable toggles, audit/timeline. Proves all the UI code actually works end-to-end.
2. **A3 MinIO attachment smoke** — upload init, PUT bytes, finalize hash/size, clean-only gate, download, encrypted ZIP, file observable link.
3. **A4 PostgreSQL authz smoke** — allow/deny matrix for two users/orgs/profiles against shared/non-shared cases.
4. **B6 visual baseline harness** — Playwright screenshots for all 35 routes vs legacy AdminLTE screenshots; fix diffs page-by-page.
5. **B7 DB-backed lifecycle tests (full mock-chain)** — replace structural tests with full sqlmock chains for alert import, case delete cascade; add observable toggle, custom field round-trip.
6. **C4 dashboard editor wiring** — wire `DashboardWidgetEditor` save to backend `PATCH /dashboards/:id`; verify widget JSON round-trip.
7. **D1 OpenSearch rebuild count parity** — run rebuild index and compare document counts with PostgreSQL; add golden search dataset tests.
8. **D2 runtime shadow compare** — run golden fixtures through migrator, save report artifact, compare migrated DB.

## 9. Session 2026-04-29T04:59+07:00 Completed

The following tasks were completed in this session:

- [x] Backend: `PATCH /api/v1/auth/me` (UpdateMe) — personal-settings profile tab save.
- [x] Backend: `POST /api/v1/auth/api-key` (GenerateAPIKey) — personal-settings API key tab.
- [x] Backend: `DELETE /api/v1/admin/users/:login` (DeleteUser) — admin users delete.
- [x] Backend: `PATCH /api/v1/admin/organisations/:id` (UpdateOrganisation) — admin org edit.
- [x] Backend: `DELETE /api/v1/admin/organisations/:id` (DeleteOrganisation) — admin org delete.
- [x] Backend: `PATCH /api/v1/admin/profiles/:id` (UpdateProfile) — admin profile edit.
- [x] Backend: `DELETE /api/v1/admin/profiles/:id` (DeleteProfile) — admin profile delete.
- [x] Backend: `POST /api/v1/tasks/:id/logs` (AppendTaskLog) — task-scoped log append.
- [x] Backend: `GET /api/v1/tasks/:id/logs` (ListTaskLogs) — task-scoped log list.
- [x] Backend: `GET /api/v1/observables/:id` (GetObservable with jobs) — observable detail.
- [x] Migration 000028_api_keys: `api_keys` table for personal-settings API key feature.
- [x] Frontend: `observables/[id]/page.tsx` — rewrote to use new GET endpoint, TheHive 4 Summary/Analyzers/Sharing/Attachments tabs, inline TLP/IOC/sighted/ignoreSimilarity toggles, ObservableFlags, TagList.
- [x] Frontend: `alerts/[id]/page.tsx` — rewrote to remove all Vietnamese text, use Severity/TLP/PAP active pickers in edit form, ObservableFlags in observables tab, TagList, proper English labels.
- [x] Validation: `go build ./...` exit 0; `go test ./internal/handler/... ./internal/server/...` exit 0; `npm run build` exit 0 (32/32 routes).

## 7. Session 2026-04-29T04:35+07:00 Completed

The following frontend pages were fully rewritten to clone TheHive 4 style and features:

- [x] `investigation/page.tsx` — CaseTable (TLP strip, flag row, status badge, dates S/C/U, sort), AlertTable (TLP strip, read/unread, source/ref, action icons), ObservableTable, filter pills, pagination.
- [x] `admin/organisations/page.tsx` — org list with name+description+linked orgs, dates C/U, edit/delete/link modals.
- [x] `admin/profiles/page.tsx` — profile list with permission label-list, edit/delete, permission grid modal.
- [x] `admin/users/page.tsx` — NEW page: user list with login/name/org/profile/status, lock/unlock, edit/delete, create modal.
- [x] `tasks/page.tsx` — task list with group/status flags/title/assignee/due date, flat+grouped views, bulk close/assign.
- [x] `tasks/[id]/page.tsx` — task detail with Timeline/Logs/Attachments/Audit tabs, append-only log form, dl-horizontal, progress bar, lifecycle buttons.
- [x] `search/page.tsx` — search with entity type filter buttons, per-entity result rows, score badge, pagination.
- [x] `live/page.tsx` — flow/live stream with per-entity-type flow items, entity detail rendering, pause/resume, filter by type.
- [x] `personal-settings/page.tsx` — Profile/Password/API key/Preferences tabs, account info sidebar.
- [x] `admin/observable-types/page.tsx` — observable types list with built-in vs custom, isAttachment, add/delete.
- [x] `admin/analyzer-templates/page.tsx` — analyzer template list with content preview, edit/delete/import modals.
- [x] `styles/globals.css` — ~250 lines of missing tokens: TLP strip, severity, tag list, dl-horizontal, empty-message, filter-panel, task/timeline/flow/search/modal CSS.
- [x] `components/Sidebar.tsx` — Users nav updated to `/admin/users`.
- [x] `npm run lint` passed (0 errors); `npm run build` passed (32/32 routes).

## 10. Next Batch Recommendation (after session 2026-04-29T04:59+07:00)

Priority order for next session:

1. **A2 runtime browser/API smoke** — login, admin profile, case create/open, task lifecycle, alert import/merge, observable toggles, audit/timeline. Proves all the UI code actually works end-to-end.
2. **A3 MinIO attachment smoke** — upload init, PUT bytes, finalize hash/size, clean-only gate, download, encrypted ZIP, file observable link.
3. **A4 PostgreSQL authz smoke** — allow/deny matrix for two users/orgs/profiles against shared/non-shared cases.
4. **B5 admin subpanel wiring** — wire admin users/profiles/organisations PATCH/DELETE to new backend endpoints; confirm personal-settings PATCH /me and POST /api-key work end-to-end.
5. **B6 visual baseline harness** — Playwright screenshots for all 32 routes vs legacy AdminLTE screenshots; fix diffs page-by-page.
6. **B7 DB-backed lifecycle tests** — case create/close/reopen/delete, alert import/merge, task lifecycle, observable toggle, custom field round-trip.
7. **C1/C2/C3 fake integration assertions** — fake Cortex/MISP/webhook tests and runtime worker smoke.
8. **D2 runtime shadow compare** — run golden fixtures through migrator, save report artifact, compare migrated DB.

## 8. Next Batch Recommendation

Priority order for next session (superseded by section 10 above):

1. **A2 runtime browser/API smoke** — login, admin profile, case create/open, task lifecycle, alert import/merge, observable toggles, audit/timeline. Proves all the UI code actually works end-to-end.
2. **A3 MinIO attachment smoke** — upload init, PUT bytes, finalize hash/size, clean-only gate, download, encrypted ZIP, file observable link.
3. **A4 PostgreSQL authz smoke** — allow/deny matrix for two users/orgs/profiles against shared/non-shared cases.
4. **B6 visual baseline harness** — Playwright screenshots for all 32 routes vs legacy AdminLTE screenshots; fix diffs page-by-page.
5. **Backend endpoint verification** — confirm `/api/v1/tasks/:id/logs` POST, `/api/v1/auth/api-key` POST, `/api/v1/admin/users` CRUD, `/api/v1/admin/profiles` CRUD, `/api/v1/admin/organisations` DELETE exist and match UI expectations. ✅ DONE in session 2026-04-29T04:59+07:00.
6. **D2 runtime shadow compare** — run golden fixtures through migrator, save report artifact, compare migrated DB.
7. **C1/C2/C3 fake integration assertions** — fake Cortex/MISP/webhook tests and runtime worker smoke.
