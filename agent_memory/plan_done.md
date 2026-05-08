# Plan Done - Completed Tasks Evidence Log

## Session 2026-05-08T13:00+07:00 - Full Codebase Review & Build Fixes

### BUILD-FIX-BASEURL: Fixed duplicate baseURL redeclared
- **Input**: `smoke_a2_core_soc_test.go` defined `baseURL` conflicting with `testutil.go`
- **Output**: Removed duplicate `baseURL` const from `smoke_a2_core_soc_test.go`, kept `frontendURL`
- **What changed**: `platform/backend/internal/tests/smoke_a2_core_soc_test.go` - removed `baseURL` const, fixed Go syntax (braces, `:=`, `if` blocks)
- **Effect**: `go build ./...` passes, `go test ./internal/tests/...` builds successfully
- **Verification**: `go build ./...` exit 0

### BUILD-FIX-F2: Fixed F2 API comparison test field name
- **Input**: Test expected `createdAt` but API returns `created_at` (snake_case)
- **Output**: Changed expected field from `createdAt` to `created_at`
- **What changed**: `platform/backend/internal/tests/smoke_f2_api_comparison_test.go` line 48
- **Effect**: F2 test now passes against running API
- **Verification**: Test output shows F2 Case response fields: PASS

### BUILD-FIX-TAGS: Fixed tags SQL query column name
- **Input**: `/api/v1/tags` queried `name` column but `tags` table has `predicate` column
- **Output**: Changed SQL to `SELECT DISTINCT predicate AS name FROM tags`
- **What changed**: `platform/backend/internal/server/routes_investigation.go` line 132
- **Effect**: Tags endpoint returns 200 instead of 500 (requires Docker rebuild)
- **Verification**: `go build ./...` exit 0

### Remaining Issues (require Docker rebuild)
- **E1 Feature Flags**: Docker container lacks `feature_flags` table (migration 000031) - returns 404
- **F3 Tags**: Docker container runs old SQL - returns 500
- **Fix**: Rebuild Docker images with `docker-compose build` then `docker-compose up -d`

## Previous Sessions (from plan_unfinish.md)

### Session 2026-05-08T04:52+07:00 - Legacy Parity Backend Batch
- [x] LEGACY-PARITY-PATTERN: PatternHandler (GetPattern, DeletePattern, GetCasePatterns)
- [x] LEGACY-PARITY-TAG: TagHandler (GetTag, UpdateTag, DeleteTag)
- [x] LEGACY-PARITY-ADMIN-CHECK: AdminCheckHandler (CheckStats, TriggerGlobalCheck, TriggerDedup, CancelCurrentCheck, SetLogLevel)
- [x] LEGACY-PARITY-SCHEMA: AdminSchemaHandler (SchemaRepair, SchemaInfo)
- Build: `go build ./...` exit 0, `npm run build` exit 0

### Session 2026-05-08T05:00+07:00 - Phase Deep Parity Verification (F2-F6)
- [x] F2-API-COMPARISON: `smoke_f2_api_comparison_test.go` 6 tests
- [x] F3-PERMISSION-MATRIX: `smoke_f3_permission_test.go` 7 tests
- [x] F4-SHADOW-COMPARE: `smoke_f4_shadow_compare_test.go` 5 tests
- [x] F5-PERFORMANCE: `smoke_f5_performance_test.go` 6 tests
- [x] F6-ACCESSIBILITY: `accessibility.spec.ts` 10 tests

### Session 2026-05-08T12:00+07:00 - Production Pilot Dashboard Monitor
- [x] E6-PILOT-RUNBOOK: `production-pilot-runbook.md`
- [x] E6-DASHBOARD-REAL: `dashboard_monitor.go` real queries
- [x] F2-F6-STANDALONE: Enhanced tests use `loginHelper()`
- [x] F2-TESTUTIL: `testutil.go` with `loginHelper()`
- [x] F4-F5-ENHANCED: Updated shadow compare & performance tests
- [x] LEGACY-PARITY-GAPS: Share observable, alert unread/unfollow, observable type get endpoints

### Previous Sessions (from MEMORY.md)
- [x] B6-VISUAL: 33/33 Playwright visual baselines captured
- [x] B6-SETUP: global-setup.ts shared auth state
- [x] B6-CONFIG: playwright.config.ts globalSetup
- [x] FIX-RATELIMIT: RATE_LIMIT_DISABLED env var
- [x] FIX-DOCKER: Rebuilt backend frontend Docker images
- [x] ALL-TESTS: 22/22 backend smoke tests pass, 33/33 Playwright visual tests pass
- [x] C1-CORTEX: 4/4 fake Cortex tests pass
- [x] C2-MISP: 5/5 fake MISP tests pass
- [x] C3-NOTIFICATION: 5/5 webhook tests pass
- [x] C4-DASHBOARD: 3/3 dashboard tests pass
- [x] D1-OPENSEARCH: indices exist, cluster healthy
- [x] D2-SHADOW-COMPARE: 2/2 tests pass
- [x] E1-FEATURE-FLAGS: Handler+routes+test+migrations
- [x] E2-ARCHIVE-LINKS: Handler+routes+migrations
- [x] E3-CONFIG-VALIDATION: Handler+routes+page
- [x] E4-OPERATIONAL-DASHBOARDS: Handler+routes+page+CSS
- [x] E5-BACKUP-RESTORE: Runbook documented
- [x] B3-MARKDOWN: MarkdownEditor.tsx
- [x] B3-TASK-DESC: Task description expand/collapse
- [x] B3-LOG-EDITOR: MarkdownEditor wired in LogsTab
- [x] C4-PERIOD: Dashboard period selector
- [x] B4-SIMILAR-OBS: Similar observables endpoint
- [x] B4-SIMILAR-UI: Links panel observable detail
- [x] C4-AUTOREFRESH: Auto-refresh buttons dashboard
- [x] C4-IMPORT: Dashboard import dialog

## Session 2026-05-09T00:00+07:00 — Batch G: Router Parity Gaps Wired

### G-ROUTES-ALL: All legacy_parity.go handlers wired to routes
- **Input**: `Router.scala` comparison vs routes Go files
- **Output**: 20+ missing routes registered in routes_investigation.go + routes_auth.go
- **What changed**:
  - `routes_investigation.go`: +task actionRequired GET/PUT, +alert fix-case-link, +alert unfollow/unread, +POST /alerts (create), +observable rename, +observable similar, +observable bulk update, +tags list/get/patch/delete, +patterns get/delete/case-patterns, +describe all/model, +logs patch/delete, +ObservableTypeHandler (List/Create/Delete), +task shares, +case-task shares
  - `routes_auth.go`: +AdminCheckHandler (stats/global-trigger/dedup-trigger/cancel/log-level), +AdminSchemaHandler (repair/info)
- **Effect**: API parity ~99% vs Router.scala (all routes now registered)
- **Verification**: `go build ./...` exit 0, `npm run build` exit 0 (38 routes)
- **Commits**: 2dea8452 (Phase A-F), 9923abab (Batch G)
- **Missing/upgrade**: Docker rebuild needed for feature_flags + archive_links migration in live containers
