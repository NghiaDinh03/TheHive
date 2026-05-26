# Migration Analysis — TheHive 4 Re-platform

> **Analysis Date:** 2026-05-07T02:56+07:00
> **Analyst:** MiMo Agent (independent codebase audit)
> **Method:** Read all .AI_CONTEXT files + verified actual file existence in codebase

---

## Executive Summary

**Overall Migration Completion: ~45% (code foundation) / ~12% (runtime-proven)**

The project has made significant progress on **code foundation** — handlers, repositories, UI pages, components, CSS, and test scaffolding exist for most features. However, **almost nothing is runtime-proven**. The plan documents claim "92% backend parity" and "96% frontend parity" but these are **code existence metrics**, not **parity metrics**. True parity requires runtime proof, visual proof, and integration proof — none of which exist yet.

---

## 1. Honest Assessment by Phase

### Phase A — Runtime Evidence Gate

| Gate | Code Status | Runtime Status | Honest % |
|------|------------|----------------|----------|
| A1 Compose/health | ✅ Done | ✅ Verified (7 containers, health OK) | **100%** |
| A2 Core SOC smoke | ✅ Test file exists | ❌ Login 401 fix created but NOT tested | **30%** |
| A3 MinIO attachment | ✅ Test file exists | ❌ NOT executed | **15%** |
| A4 PostgreSQL authz | ✅ Test file exists | ❌ NOT executed | **15%** |

**Critical Blocker:** A2 login 401 fix (`seed/002_password_hashes.sql`) was created but never run against the Docker Compose stack. This blocks ALL downstream runtime verification.

### Phase B — Core Behavior & UI Parity

| Area | Code Status | Runtime/Visual Status | Honest % |
|------|------------|----------------------|----------|
| B1 Case lifecycle | ✅ Handlers + repos + UI exist | ❌ No DB-backed runtime tests | **60%** |
| B2 Alert import/merge | ✅ Handlers + repos + UI exist | ❌ No golden fixture proof | **55%** |
| B3 Task/log workbench | ✅ Handlers + repos + UI exist | ❌ No runtime proof | **55%** |
| B4 Observable/evidence | ✅ Handlers + repos + UI exist | ❌ No runtime proof | **55%** |
| B5 Admin/auth/audit | ✅ 10 admin pages migrated | ❌ No visual matrix proof | **50%** |
| B6 Visual baseline | ✅ Playwright harness exists | ❌ ZERO baselines captured | **10%** |

**Key Issue:** All B1-B5 have code but claim "foundation done" without any runtime or visual proof. The "96% frontend parity" claim is misleading — it measures page existence, not pixel-perfect parity.

### Phase C — Integration Hardening

| Area | Code Status | Runtime Status | Honest % |
|------|------------|----------------|----------|
| C1 Cortex | ✅ Client + worker + fake server | ❌ No runtime worker proof | **40%** |
| C2 MISP | ✅ Client + sync worker + fake server | ❌ No runtime proof | **40%** |
| C3 Notifications | ✅ Worker + trigger + integration tests | ❌ No runtime dispatch proof | **40%** |
| C4 Dashboards/pages | ✅ CRUD + widget editor wired | ❌ No scoping proof | **45%** |

### Phase D — Search & Migration

| Area | Code Status | Runtime Status | Honest % |
|------|------------|----------------|----------|
| D1 OpenSearch | ✅ Client/indexer/outbox/search | ❌ No count parity proof | **35%** |
| D2 Full migrator | ✅ Resumable core + shadow compare | ❌ No runtime artifact | **30%** |

### Phase E — Production Pilot

| Area | Status | Honest % |
|------|--------|----------|
| E1-E6 All gates | ❌ Not started | **0%** |

### Phase F — Deep Parity Verification

| Area | Status | Honest % |
|------|--------|----------|
| F1-F6 All gates | ❌ Not started | **0%** |

---

## 2. What Actually Exists (Verified)

### Backend Files (21 handlers, 5 repos, 29 migrations, 16 test files)

| Category | Files | Status |
|----------|-------|--------|
| Handlers | `admin.go`, `admin_catalog.go`, `alerts.go`, `attachments.go`, `audit.go`, `auth.go`, `authz.go`, `case_sub.go`, `cases.go`, `cortex.go`, `dashboard_aggregation.go`, `dashboards.go`, `detail.go`, `health.go`, `misp.go`, `notifications.go`, `readonly.go`, `search.go`, `status.go`, `templates.go`, `work.go` | ✅ All exist |
| Repositories | `alertwrite/`, `attachment/`, `casetemplate/`, `casewrite/`, `investigation/`, `workwrite/` | ✅ All exist |
| Routes | `routes_auth.go`, `routes_health.go`, `routes_investigation.go`, `routes_attachments.go`, `routes_content.go`, `routes_integrations.go`, `routes_search.go` | ✅ All exist |
| Migrations | 000001-000029 (58 files up/down) + seed/ | ✅ All exist |
| Tests | 16 test files (smoke, parity, integration) | ✅ All exist |
| Workers | `workers.go` | ✅ Exists |

### Frontend Files (40+ pages, 20 components)

| Category | Count | Status |
|----------|-------|--------|
| App Router pages | 40+ pages across all domains | ✅ All exist |
| Reusable components | 20 components | ✅ All exist |
| CSS parity | ~3400+ lines in `globals.css` | ✅ Exists |
| Visual tests | `thehive-parity.spec.ts` (28 screens) | ✅ Harness exists |

### Integration Code

| Integration | Client | Worker | Fake Server | Tests | UI |
|-------------|--------|--------|-------------|-------|-----|
| Cortex | ✅ | ✅ | ✅ | ✅ | ✅ |
| MISP | ✅ | ✅ | ✅ | ✅ | ✅ |
| Notifications | — | ✅ | — | ✅ | ✅ |
| OpenSearch | ✅ | ✅ (outbox) | — | — | ✅ |

---

## 3. What Does NOT Exist (Gaps)

### Critical Gaps (Blocking v1.0.0)

1. **No runtime proof for ANY feature except A1 health check**
   - Login has never been tested against running stack
   - No API endpoint has been smoke-tested at runtime
   - No UI page has been loaded in a browser with real data

2. **No visual regression baselines**
   - Playwright harness exists but ZERO screenshots captured
   - Cannot claim UI parity without visual proof

3. **No DB-backed integration tests run**
   - All test files exist but require Docker Compose stack
   - Mock tests pass but don't prove real DB behavior

4. **No MinIO/S3 attachment runtime proof**
   - Upload/download/ZIP flow untested at runtime

5. **No authorization runtime proof**
   - Permission matrix exists in code but allow/deny untested

### Important Gaps (Blocking production readiness)

6. **No OpenSearch count parity**
   - Rebuild index never compared against PostgreSQL counts

7. **No migration runtime artifact**
   - Resumable migrator exists but never ran against real data

8. **No Cortex/MISP runtime worker proof**
   - Fake servers work but real integration untested

9. **No production pilot infrastructure**
   - Feature flags, monitoring, backup/restore — all absent

10. **No deep parity verification**
    - Side-by-side comparison, performance baseline, accessibility — all absent

---

## 4. Recommended Next Steps (Priority Order)

### Immediate (This Week)

1. **Run A2 smoke test** — Execute `seed/002_password_hashes.sql` against PostgreSQL, test login with `nghia.dinh@ncsgroup.vn / 12345@`, run full A2 test suite
2. **Verify A2 results** — If login works, test case create/open, task lifecycle, alert import/merge, observable toggles, audit/timeline
3. **Fix any A2 failures** — Smallest possible fix for each failure

### Short-Term (Next 2 Weeks)

4. **Run A3 MinIO smoke** — Upload init, PUT bytes, finalize hash/size, clean-only gate, download, encrypted ZIP
5. **Run A4 authz smoke** — Allow/deny matrix for two users/orgs/profiles
6. **Capture B6 visual baselines** — Playwright screenshots for all 36 routes vs legacy AdminLTE

### Medium-Term (Next Month)

7. **DB-backed lifecycle tests** — Case/alert/task/observable/share/custom field round-trip with real DB
8. **Integration runtime tests** — Cortex/MISP/Notification fake server runtime assertions
9. **OpenSearch count parity** — Rebuild index and compare document counts

### Long-Term (Next 2-3 Months)

10. **Full migration runtime artifact** — Golden fixtures migration + shadow compare report
11. **Production pilot infrastructure** — Feature flags, monitoring, backup/restore, rollback
12. **Deep parity verification** — Side-by-side comparison, performance baseline, accessibility

---

## 5. Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Login 401 blocks all runtime testing | 🔴 Critical | High | Run seed SQL immediately |
| Visual parity unproven | 🟡 Medium | High | Capture baselines after A2 passes |
| Integration runtime untested | 🟡 Medium | Medium | Run fake server tests after A2 |
| Migration data loss | 🔴 Critical | Low | Shadow compare before cutover |
| Permission bypass | 🔴 Critical | Medium | Runtime authz matrix after A2 |

---

## 6. Honest Timeline Estimate

| Milestone | Estimated Time | Dependencies |
|-----------|---------------|--------------|
| A2 runtime proof | 1-2 days | Docker Compose stack running |
| A3+A4 runtime proof | 2-3 days | A2 passing |
| B6 visual baselines | 3-5 days | A2 passing + Playwright setup |
| B1-B5 DB-backed tests | 1-2 weeks | A2 passing |
| C1-C3 integration runtime | 1-2 weeks | A2 passing |
| D1-D2 search/migration | 2-3 weeks | A2 passing + OpenSearch running |
| E1-E6 production pilot | 1-2 months | All above complete |
| F1-F6 deep parity | 2-4 weeks | E1-E6 complete |
| **v1.0.0 release candidate** | **3-6 months from now** | All above complete |

---

## 7. Comparison: Plan Claims vs Reality

| Claim in plan.md | Reality | Gap |
|------------------|---------|-----|
| "Backend Parity: ~92% Complete" | Code exists for ~92% of features; runtime proof: ~10% | **82% gap** between code existence and runtime proof |
| "Frontend Parity: ~96% Complete" | Pages exist for ~96% of routes; visual proof: ~0% | **96% gap** between page existence and visual parity |
| "Integration Parity: ~70% Complete" | Code exists for ~70%; runtime proof: ~0% | **70% gap** between code and runtime |
| "Migration Parity: ~70% Complete" | Core exists for ~70%; runtime artifact: ~0% | **70% gap** between core and artifact |
| "All 36 UI pages migrated" | ✅ True — all pages exist | No gap (code level) |
| "Full legacy CSS parity (~3400+ lines)" | ✅ True — CSS file exists | No gap (code level) |
| "Playwright harness extended to 28 screens" | ✅ True — harness exists | **100% gap** — zero baselines captured |

---

## 8. Conclusion

The project has a **solid code foundation** but is **not migration-complete** by any meaningful definition. The plan documents are accurate about what code exists but misleading about completion percentage. 

**The single most impactful action is running the A2 smoke test.** Everything else is blocked by or dependent on proving the platform actually works at runtime.

**Recommended immediate action:**
1. Start Docker Compose stack
2. Run `seed/002_password_hashes.sql`
3. Execute A2 smoke test
4. Report results

Until A2 passes, all other work is building on an unproven foundation.
