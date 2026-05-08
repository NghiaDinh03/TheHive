# Backup/Restore and Rollback Runbook

## Overview

This runbook covers backup, restore, and rollback procedures for TheHive Platform production deployment.

## Components to Backup

| Component | Method | Frequency | Retention |
|-----------|--------|-----------|-----------|
| PostgreSQL | pg_dump | Daily | 30 days |
| MinIO/S3 | mc mirror | Daily | 30 days |
| OpenSearch | Snapshot API | Daily | 14 days |
| Config (.env) | File copy | On change | Forever |

## PostgreSQL Backup

```bash
# Full backup
docker exec thehive-postgres pg_dump -U thehive -d thehive -F c -f /tmp/thehive_backup.dump

# Copy to host
docker cp thehive-postgres:/tmp/thehive_backup.dump ./backups/thehive_$(date +%Y%m%d).dump

# Verify backup
docker exec thehive-postgres pg_restore -l /tmp/thehive_backup.dump | wc -l
```

## PostgreSQL Restore

```bash
# Stop backend to prevent writes
docker compose stop backend

# Drop and recreate database
docker exec thehive-postgres psql -U thehive -c "DROP DATABASE thehive;"
docker exec thehive-postgres psql -U thehive -c "CREATE DATABASE thehive;"

# Restore from backup
docker cp ./backups/thehive_20260508.dump thehive-postgres:/tmp/restore.dump
docker exec thehive-postgres pg_restore -U thehive -d thehive /tmp/restore.dump

# Restart backend
docker compose start backend
```

## MinIO/S3 Backup

```bash
# Mirror all buckets
mc mirror local/thehive-attachments ./backups/minio/thehive-attachments/

# Restore
mc mirror ./backups/minio/thehive-attachments/ local/thehive-attachments/
```

## OpenSearch Snapshot

```bash
# Register snapshot repository
curl -X PUT "localhost:9200/_snapshot/backup_repo" -H 'Content-Type: application/json' -d'
{
  "type": "fs",
  "settings": { "location": "/usr/share/opensearch/backup" }
}'

# Create snapshot
curl -X PUT "localhost:9200/_snapshot/backup_repo/snapshot_$(date +%Y%m%d)?wait_for_completion=true"

# Restore snapshot
curl -X POST "localhost:9200/_snapshot/backup_repo/snapshot_20260508/_restore?wait_for_completion=true"
```

## Rollback Procedure

### Scenario 1: Bad Backend Deployment

```bash
# 1. Stop current backend
docker compose stop backend

# 2. Rollback to previous image
docker compose up -d backend --no-deps

# 3. Verify health
curl -s http://localhost:8080/healthz
```

### Scenario 2: Bad Database Migration

```bash
# 1. Stop backend
docker compose stop backend

# 2. Run down migration
docker exec thehive-postgres psql -U thehive -d thehive -f /app/migrations/NNNNNN_description.down.sql

# 3. Restart backend
docker compose start backend
```

### Scenario 3: Full Data Rollback

```bash
# 1. Stop all services except PostgreSQL
docker compose stop backend frontend

# 2. Restore PostgreSQL from backup (see above)

# 3. Restore MinIO from backup (see above)

# 4. Rebuild OpenSearch index
curl -X POST "localhost:8080/api/v1/admin/index/cases/rebuild" -H "Authorization: Bearer $TOKEN"
curl -X POST "localhost:8080/api/v1/admin/index/alerts/rebuild" -H "Authorization: Bearer $TOKEN"
curl -X POST "localhost:8080/api/v1/admin/index/observables/rebuild" -H "Authorization: Bearer $TOKEN"
curl -X POST "localhost:8080/api/v1/admin/index/tasks/rebuild" -H "Authorization: Bearer $TOKEN"

# 4. Restart services
docker compose up -d
```

## Verification Checklist

After any rollback:

- [ ] `/healthz` returns `{"status":"ok"}`
- [ ] `/readyz` returns postgres=ok, rabbitmq=ok
- [ ] Login works with admin credentials
- [ ] Case list loads with expected count
- [ ] Alert list loads with expected count
- [ ] Dashboard monitoring page loads
- [ ] Config validation passes all checks

## Emergency Contacts

- Backend on-call: [TODO]
- Database admin: [TODO]
- Infrastructure: [TODO]
