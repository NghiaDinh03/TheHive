# Database versioning

## Tooling

- Driver: `golang-migrate/migrate` v4.
- Source: file-based, mounted into the backend container at `/app/migrations`.
- Postgres version: 16-alpine.

## File format

```text
NNNNNN_short_description.up.sql
NNNNNN_short_description.down.sql
```

- `NNNNNN` is a zero-padded sequence: `000001`, `000002`, …
- Both `.up.sql` and `.down.sql` must exist.
- `.up.sql` must be idempotent where reasonable (`IF NOT EXISTS` / `ON CONFLICT`).
- `.down.sql` reverses only what `.up.sql` introduced.

## Rules

1. **Migrations are immutable once merged.** A bug in a shipped migration is fixed by a
   new migration, never by editing an old one.
2. **No manual schema changes** in any non-local environment.
3. **Backups before deploy**: PostgreSQL `pg_dump` is required before applying a
   migration to staging or production.
4. **Long-running migrations** (e.g. backfills, table rewrites) must be split into a
   pure DDL migration and an idempotent data migration runnable from a worker.
5. **No destructive defaults**: a column drop must arrive in a separate migration
   *after* the application has stopped reading from it.

## Phase 1 baseline

`000001_init_schema.up.sql` creates:

| Table | Purpose |
|---|---|
| `app_metadata` | Single-row config (`app_version`, `schema_baseline`, `search_index_ver`). |
| `audit_logs` | Append-only audit, written from Phase 2+. |
| `iocs` | IOC store designed for Cortex/MISP integration. |
| `outbox_events` | Outbox pattern for reliable RabbitMQ publishes. |

The IOC table is created up-front so analytics queries and adapter contracts are stable
across phases.

## Application metadata vs schema metadata

- `schema_migrations` (created by `golang-migrate`) tracks the applied migration
  version and dirty flag.
- `app_metadata` (created by us) tracks application-level versions:
  - `app_version` — semver of the running backend.
  - `schema_baseline` — the migration ID that defined the current architecture
    baseline; used by data-migration tools.
  - `search_index_ver` — incremented each time the OpenSearch (Phase 5+) mapping
    changes; consumers can detect a rebuild requirement.

## Querying current versions

```sql
SELECT version, dirty FROM schema_migrations LIMIT 1;
SELECT key, value FROM app_metadata ORDER BY key;
```

The backend exposes both at `GET /api/v1/status`.
