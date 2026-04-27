#!/usr/bin/env bash
# Smoke health check after `docker compose up -d`.
# Polls /readyz on the backend and / on the frontend, exits 0 only when both ready.

set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
TIMEOUT="${TIMEOUT:-90}"

echo "Waiting up to ${TIMEOUT}s for backend ${BACKEND_URL}/readyz ..."
deadline=$(( $(date +%s) + TIMEOUT ))
while [ "$(date +%s)" -lt "${deadline}" ]; do
  if curl -fsS "${BACKEND_URL}/readyz" >/dev/null 2>&1; then
    echo "  backend ready"
    backend_ok=1
    break
  fi
  sleep 2
done

if [ "${backend_ok:-0}" != "1" ]; then
  echo "ERROR: backend did not become ready within ${TIMEOUT}s" >&2
  exit 1
fi

echo "Calling /api/v1/status:"
curl -fsS "${BACKEND_URL}/api/v1/status" | sed 's/^/  /'

echo
echo "Waiting for frontend ${FRONTEND_URL}/api/healthz ..."
deadline=$(( $(date +%s) + TIMEOUT ))
while [ "$(date +%s)" -lt "${deadline}" ]; do
  if curl -fsS "${FRONTEND_URL}/api/healthz" >/dev/null 2>&1; then
    echo "  frontend ready"
    frontend_ok=1
    break
  fi
  sleep 2
done

if [ "${frontend_ok:-0}" != "1" ]; then
  echo "ERROR: frontend did not become ready within ${TIMEOUT}s" >&2
  exit 1
fi

echo
echo "==> Phase 1 stack healthy."
