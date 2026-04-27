# syntax=docker/dockerfile:1.7
# Multi-stage build for TheHive Platform backend (Go).
# Build args allow injecting version metadata at build time.

ARG GO_VERSION=1.22
ARG ALPINE_VERSION=3.20

############################
# Stage 1: builder
############################
FROM golang:${GO_VERSION}-alpine${ALPINE_VERSION} AS builder

ARG APP_VERSION=0.4.0-migration
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown

ENV CGO_ENABLED=0 \
    GOOS=linux \
    GOFLAGS=-trimpath

WORKDIR /src

# Cache modules first
COPY go.mod go.sum* ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download

COPY . .

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build \
        -ldflags="-s -w \
            -X github.com/thehive-platform/backend/internal/version.AppVersion=${APP_VERSION} \
            -X github.com/thehive-platform/backend/internal/version.GitSHA=${GIT_SHA} \
            -X github.com/thehive-platform/backend/internal/version.BuildTime=${BUILD_TIME}" \
        -o /out/server ./cmd/server

############################
# Stage 2: runtime
############################
FROM alpine:${ALPINE_VERSION} AS runtime

ARG APP_VERSION=0.4.0-migration
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown

LABEL org.opencontainers.image.title="thehive-platform-backend" \
      org.opencontainers.image.description="TheHive re-platform backend (Go)" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.source="https://github.com/thehive-platform/thehive" \
      org.opencontainers.image.licenses="AGPL-3.0"

RUN apk add --no-cache ca-certificates curl tzdata && \
    addgroup -S app -g 10001 && \
    adduser  -S app -u 10001 -G app

WORKDIR /app

COPY --from=builder /out/server /app/server
COPY migrations /app/migrations
COPY api/openapi.yaml /app/api/openapi.yaml

ENV POSTGRES_MIGRATIONS_PATH=file:///app/migrations \
    HTTP_ADDR=:8080

USER app
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT ["/app/server"]
