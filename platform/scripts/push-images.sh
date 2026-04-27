#!/usr/bin/env bash
# Tag and push images to a Docker registry.
# Requires: prior `docker login`.
#   ./scripts/push-images.sh [APP_VERSION] [--latest]

set -euo pipefail

cd "$(dirname "$0")/.."

APP_VERSION="${1:-${APP_VERSION:-0.4.0-migration}}"
PUSH_LATEST=false
if [ "${2:-}" = "--latest" ]; then
  PUSH_LATEST=true
fi

GIT_SHA="${GIT_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo local)}"
IMAGE_TAG="${APP_VERSION}-${GIT_SHA}"
REGISTRY="${REGISTRY:-docker.io}"
IMAGE_NS="${IMAGE_NS:-thehiveplatform}"
BACKEND_IMG="${REGISTRY}/${IMAGE_NS}/backend"
FRONTEND_IMG="${REGISTRY}/${IMAGE_NS}/frontend"

push_one() {
  local img="$1"
  echo "==> Pushing ${img}:${APP_VERSION}"
  docker push "${img}:${APP_VERSION}"
  echo "==> Pushing ${img}:${IMAGE_TAG}"
  docker push "${img}:${IMAGE_TAG}"
  if [ "${PUSH_LATEST}" = true ]; then
    docker tag "${img}:${APP_VERSION}" "${img}:latest"
    echo "==> Pushing ${img}:latest"
    docker push "${img}:latest"
  fi
}

push_one "${BACKEND_IMG}"
push_one "${FRONTEND_IMG}"

echo "==> Push complete."
