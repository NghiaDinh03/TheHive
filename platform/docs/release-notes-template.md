# Release notes template

Use one section per published build. Keep migration builds clearly separated from release candidates and product releases.

## Migration build: `<0.x.y-migration>`

> Release class: `migration-build`.
> Scope: dev/staging/pilot only. This is not a complete production product release.

### Build metadata

- App version: `<0.x.y-migration>`
- Git SHA: `<short-sha>`
- Backend image: `<registry>/<namespace>/backend:<0.x.y-migration>-<short-sha>`
- Frontend image: `<registry>/<namespace>/frontend:<0.x.y-migration>-<short-sha>`
- OpenAPI version: `<0.x.y-migration>`

### Migration milestone scope

- Added:
- Changed:
- Fixed:
- Deferred:

### Compatibility notes

- API compatibility:
- Database migration version:
- Data migration/checksum notes:
- Known TheHive 4 parity gaps:

### Validation evidence

- Unit tests:
- API smoke checks:
- Docker image build:
- Shadow compare / fixture migration evidence:

### Rollback / forward-fix note

- Rollback path:
- Forward-fix path:

## Release candidate: `<1.0.0-rc.x>`

> Release class: `release-candidate`.
> Scope: production-candidate hardening only after full TheHive 4 parity target is feature-frozen.

### Build metadata

- App version: `<1.0.0-rc.x>`
- Git SHA: `<short-sha>`
- Backend image: `<registry>/<namespace>/backend:<1.0.0-rc.x>-<short-sha>`
- Frontend image: `<registry>/<namespace>/frontend:<1.0.0-rc.x>-<short-sha>`
- OpenAPI version: `<1.0.0-rc.x>`

### RC gate summary

- Feature freeze status:
- Critical/high bug count:
- TheHive 4 workflow parity status:
- Shadow compare status:
- Migration pilot status:
- Rollback drill status:

### Changes since previous RC

- Added:
- Changed:
- Fixed:
- Security:
- Operational notes:

### Sign-offs

- Engineering:
- QA/parity:
- SOC pilot owner:
- Operations:
- Security:

## Product release: `<v1.x.y>`

> Release class: `product-release`.
> Scope: production release. `v1.0.0` is allowed only after migration parity, shadow compare, pilot, and rollback gates pass.

### Build metadata

- App version: `<v1.x.y>`
- Git SHA: `<short-sha>`
- Backend image: `<registry>/<namespace>/backend:<v1.x.y>-<short-sha>`
- Frontend image: `<registry>/<namespace>/frontend:<v1.x.y>-<short-sha>`
- OpenAPI version: `<v1.x.y>`

### Release highlights

- Analyst-facing changes:
- Admin/operations changes:
- Integration changes:
- Security changes:

### Upgrade notes

- Supported source versions:
- Required database migrations:
- Required data migrations:
- Config changes:
- Backup/restore requirements:

### Production readiness evidence

- Full test suite:
- OpenAPI contract review:
- Migration validation report:
- Shadow compare report:
- Production pilot report:
- Rollback drill report:

### Post-release watch items

- Metrics to watch:
- Logs to watch:
- Known non-blocking issues:
- Hotfix criteria:
