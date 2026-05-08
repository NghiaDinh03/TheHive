# Deep Parity Verification (Phase F)

## F1 — Side-by-Side Screenshot Comparison

**Status:** Partially done (33/33 Playwright baselines captured)

**What exists:**
- Playwright visual regression tests in `platform/frontend/tests/visual/thehive-parity.spec.ts`
- 33 screenshot baselines in `__screenshots__/`
- Global setup with shared auth state

**Remaining:**
- [ ] Compare against legacy TheHive 4 screenshots (requires running legacy instance)
- [ ] Document accepted visual differences
- [ ] Add dynamic route screenshots (cases/[id], alerts/[id]) with seeded data

## F2 — API Response Field-by-Field Comparison

**Status:** Foundation done

**What exists:**
- OpenAPI spec at `platform/backend/api/openapi.yaml`
- Legacy API routes in `thehive/app/org/thp/thehive/controllers/v1/Router.scala`
- 100% route coverage in `legacy_parity.go`

**Remaining:**
- [ ] Automated comparison script (legacy vs new API responses)
- [ ] Field mapping documentation
- [ ] Accept/reject differences log

## F3 — Permission Matrix Visual Regression

**Status:** Foundation done

**What exists:**
- `PermissionMatrix.tsx` component
- `permission-matrix.spec.ts` unit tests
- Route permission guards in `server.go`

**Remaining:**
- [ ] Visual screenshots per profile (admin, analyst, read-only)
- [ ] Button show/hide verification per permission
- [ ] API allow/deny matrix per route × profile

## F4 — Data Migration Round-Trip and Shadow Compare

**Status:** Core done

**What exists:**
- Resumable migrator in `fixturemigrate/resumable.go`
- Shadow compare in `fixturemigrate/shadow_compare.go`
- D2 test verifies function exists

**Remaining:**
- [ ] Run against real legacy data export
- [ ] Generate comparison report artifact
- [ ] Verify all entity types (cases, alerts, observables, tasks, logs, custom fields)

## F5 — Performance Baseline Comparison

**Status:** Not started

**Plan:**
- [ ] Benchmark key API endpoints (case list, alert list, search)
- [ ] Compare response times against legacy
- [ ] Load testing with concurrent users
- [ ] Document acceptable performance thresholds

## F6 — Accessibility and Keyboard Navigation Parity

**Status:** Not started

**Plan:**
- [ ] WCAG 2.1 AA compliance check
- [ ] Keyboard navigation for core workflows
- [ ] Screen reader compatibility
- [ ] Color contrast verification
