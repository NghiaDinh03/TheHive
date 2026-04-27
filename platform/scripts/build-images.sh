#!/usr/bin/env bash
# Build TheHive Platform Docker images locally with version metadata.
# Usage:
#   ./scripts/build-images.sh [APP_VERSION]
# Examples:
#   ./scripts/build-images.sh                 # uses APP_VERSION or 0.4.0-migration
#   ./scripts/build-images.sh 0.4.1-migration
#   ./scripts/build-images.sh v1.0.0

set -euo pipefail

cd "$(dirname "$0")/.."

APP_VERSION="${1:-${APP_VERSION:-0.4.0-migration}}"
GIT_SHA="${GIT_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo local)}"
BUILD_TIME="${BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
IMAGE_TAG="${APP_VERSION}-${GIT_SHA}"

REGISTRY="${REGISTRY:-docker.io}"
IMAGE_NS="${IMAGE_NS:-thehiveplatform}"
BACKEND_IMG="${REGISTRY}/${IMAGE_NS}/backend"
FRONTEND_IMG="${REGISTRY}/${IMAGE_NS}/frontend"

echo "==> Building backend ${BACKEND_IMG}:${APP_VERSION} (${GIT_SHA})"
docker build \
  --build-arg "APP_VERSION=${APP_VERSION}" \
  --build-arg "GIT_SHA=${GIT_SHA}" \
  --build-arg "BUILD_TIME=${BUILD_TIME}" \
  -t "${BACKEND_IMG}:${APP_VERSION}" \
  -t "${BACKEND_IMG}:${IMAGE_TAG}" \
  backend

echo "==> Building frontend ${FRONTEND_IMG}:${APP_VERSION} (${GIT_SHA})"
docker build \
  --build-arg "APP_VERSION=${APP_VERSION}" \
  --build-arg "GIT_SHA=${GIT_SHA}" \
  --build-arg "BUILD_TIME=${BUILD_TIME}" \
  -t "${FRONTEND_IMG}:${APP_VERSION}" \
  -t "${FRONTEND_IMG}:${IMAGE_TAG}" \
  frontend

echo "==> Done."
echo "  ${BACKEND_IMG}:${APP_VERSION}"
echo "  ${BACKEND_IMG}:${IMAGE_TAG}"
echo "  ${FRONTEND_IMG}:${APP_VERSION}"
echo "  ${FRONTEND_IMG}:${IMAGE_TAG}"
