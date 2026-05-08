# Production Pilot Runbook (E6)

**Status:** Documented
**Last updated:** 2026-05-08

## Overview

This runbook covers the production pilot (canary) process for rolling out the new TheHive Platform alongside the legacy TheHive 4 instance. The pilot follows a **strangler pattern**: new platform reads/writes alongside legacy, shadow compare validates parity, then cutover per workflow.

## Pilot Phases

### Phase 0: Pre-Pilot Checklist

| Check | Description | Status |
|-------|-------------|--------|
| [ ] | Docker Compose stack healthy (7 containers) | |
| [ ] | All 22 backend smoke tests pass | |
| [ ] | All 33 Playwright visual tests pass | |
| [ ] | OpenSearch indices exist, cluster healthy | |
| [ ] | Backup/restore runbook tested | |
| [ ] | Rollback procedure rehearsed | |
| [ ] | Monitoring dashboards operational | |
| [ ] | Config validation passes all checks | |
| [ ] | Feature flags infrastructure ready | |
| [ ] | Archive links migration ready | |

### Phase 1: Read-Only Shadow (Week 1)

**Goal:** New platform reads legacy data via shadow compare, no analyst impact.

1. Deploy new platform stack alongside legacy TheHive 4
2. Configure `INVESTIGATION_DATA_SOURCE=legacy` (reads from legacy API)
3. Run shadow compare nightly:
   ```bash
   docker compose exec backend ./server --mode=shadow-compare
   ```
4. Verify no critical mismatches in shadow compare reports
5. Monitor `/api/v1/monitor/*` endpoints for baseline metrics

**Success criteria:**
- Shadow compare reports < 1% mismatch rate
- Monitoring endpoints return real data
- No performance degradation on legacy instance

### Phase 2: Read-Only New Platform (Week 2)

**Goal:** Analysts use new platform for read operations, legacy for writes.

1. Configure `INVESTIGATION_DATA_SOURCE=postgresql` (reads from new DB)
2. Enable feature flags for pilot org:
   ```bash
   POST /api/v1/feature-flags
   {
     "name": "pilot-read-only",
     "description": "Pilot org read-only access to new platform",
     "enabled": true,
     "scope": "organisation",
     "scope_id": "<pilot-org-id>"
   }
   ```
3. Point pilot team's browser to new platform URL
4. Monitor error rates and response times
5. Collect feedback via weekly survey

**Success criteria:**
- Pilot team can view all cases/alerts/tasks/observables
- Response times within 2x of legacy
- Error rate < 0.1%
- No data loss incidents

### Phase 3: Write Pilot (Week 3-4)

**Goal:** Pilot team uses new platform for full workflow.

1. Enable write operations for pilot org:
   ```bash
   PATCH /api/v1/feature-flags/pilot-write-enabled
   { "enabled": true }
   ```
2. Enable archive link creation for migrated records
3. Monitor write operations via audit log
4. Run daily shadow compare to verify data consistency
5. Keep legacy instance available for rollback

**Success criteria:**
- Pilot team completes full SOC workflow on new platform
- Case/alert/task/observable CRUD works correctly
- Attachment upload/download works
- Cortex/MISP integration operational
- Zero data loss in shadow compare

### Phase 4: Scale Pilot (Week 5-6)

**Goal:** Expand to additional teams/orgs.

1. Enable feature flags for additional orgs
2. Monitor system resource usage (CPU, memory, disk, DB connections)
3. Load test with expected peak concurrent users
4. Verify OpenSearch search performance
5. Document any org-specific configuration needs

**Success criteria:**
- 3+ orgs using new platform
- System handles 2x expected peak load
- Search results return within 3 seconds
- No cross-org data leaks

### Phase 5: Cutover Preparation (Week 7-8)

**Goal:** Prepare for legacy shutdown.

1. Run full data migration (all entities)
2. Verify shadow compare 100% match
3. Create archive links for all migrated records
4. Test rollback procedure end-to-end
5. Train all analysts on new platform
6. Create known-issues document
7. Schedule cutover window

**Success criteria:**
- Full migration complete with 100% parity
- Rollback tested and documented
- All analysts trained
- Known-issues document reviewed and accepted

### Phase 6: Cutover (Week 8)

**Goal:** Switch all traffic to new platform.

1. Announce maintenance window
2. Set legacy TheHive 4 to read-only mode
3. Run final data sync
4. Switch DNS/load balancer to new platform
5. Verify all critical workflows
6. Monitor error rates for 24 hours
7. Keep legacy instance available for 30 days

**Success criteria:**
- All workflows operational on new platform
- Zero critical incidents in first 24 hours
- Rollback not required

## Rollback Triggers

| Severity | Condition | Action |
|----------|-----------|--------|
| Critical | Data loss detected | Immediate rollback to legacy |
| Critical | Authentication broken | Immediate rollback to legacy |
| High | > 1% error rate for 5 minutes | Rollback within 1 hour |
| High | Response time > 5x baseline | Rollback within 1 hour |
| Medium | Feature not working for > 10% of users | Fix or rollback within 24 hours |
| Low | UI cosmetic issues | Document and fix in next sprint |

## Monitoring During Pilot

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API response time (p50) | < 200ms | > 500ms |
| API response time (p99) | < 1000ms | > 3000ms |
| Error rate | < 0.1% | > 1% |
| Active users | Varies | N/A |
| DB connection count | < 50 | > 80 |
| CPU usage | < 70% | > 90% |
| Memory usage | < 80% | > 95% |

### Monitoring Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/v1/monitor/system` | System metrics (CPU, memory, disk, users) |
| `/api/v1/monitor/cases` | Case-related metrics |
| `/api/v1/monitor/alerts` | Alert-related metrics |
| `/api/v1/monitor/workers` | Worker queue metrics |
| `/api/v1/admin/config/validate` | Config validation |
| `/healthz` | Basic health check |
| `/readyz` | Readiness check (DB, queue) |

## Communication Plan

| Audience | Frequency | Channel |
|----------|-----------|---------|
| Pilot team | Daily (first week) | Slack/Teams |
| All analysts | Weekly | Email/newsletter |
| Management | Weekly | Status report |
| Engineering | Daily | Standup |

## Known Issues (Pre-Pilot)

1. MinIO anonymous PUT policy disabled - requires `mc anonymous set download` for full upload flow
2. Malware scanner is placeholder - manual scan only
3. Drag-drop task reorder not implemented - use up/down arrows
4. Font Awesome icon parity not 100% verified - inline SVGs used
5. Negative authz tests not implemented - allow/deny matrix partial

## Sign-off Checklist

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Lead Engineer | | | |
| QA Lead | | | |
| SOC Manager | | | |
| Security Officer | | | |
