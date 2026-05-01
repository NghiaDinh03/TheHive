# Attachment storage — MinIO/S3 foundation

Phase 5 moves binary evidence out of PostgreSQL into S3-compatible object storage.

## Local services

Docker Compose now includes:

- `minio` on `http://localhost:9000`
- MinIO console on `http://localhost:9001`
- `minio-init`, which creates the configured bucket and keeps it private

Default local credentials from `.env.example`:

```text
MINIO_ROOT_USER=thehive
MINIO_ROOT_PASSWORD=thehive-secret
S3_BUCKET=thehive-attachments
```

## API flow

1. Client calls `POST /api/v1/attachments/upload` with metadata.
2. Backend allocates an object key and inserts attachment metadata with `scan_status=pending`.
3. Backend returns a signed `PUT` URL.
4. Client uploads bytes directly to MinIO/S3.
5. Malware scan worker or placeholder marks status through `POST /api/v1/attachments/{id}/scan`.
6. Client calls `GET /api/v1/attachments/{id}/download`.
7. Download is blocked unless `scan_status=clean`.

## Scan policy

Current implementation is a malware scan hook foundation:

- `pending`, `malicious`, and `error` block signed downloads.
- `clean` allows signed downloads.
- Production ClamAV or commercial scanner worker should call the scan endpoint after object upload.

## Validation

Minimal commands:

```bash
docker compose -f platform/deploy/docker-compose.yml --env-file platform/deploy/.env.example config
cd platform/backend && go test ./...
```
