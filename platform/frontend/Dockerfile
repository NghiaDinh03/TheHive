# syntax=docker/dockerfile:1.7
# Multi-stage build for TheHive Platform frontend (Next.js standalone).

ARG NODE_VERSION=20
ARG ALPINE_VERSION=3.20

############################
# Stage 1: deps
############################
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

############################
# Stage 2: builder
############################
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS builder

ARG APP_VERSION=0.4.0-migration
ARG GIT_SHA=unknown
ENV NEXT_TELEMETRY_DISABLED=1 \
    APP_VERSION=${APP_VERSION} \
    NEXT_PUBLIC_APP_VERSION=${APP_VERSION} \
    GIT_SHA=${GIT_SHA}

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

############################
# Stage 3: runtime
############################
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runtime

ARG APP_VERSION=0.4.0-migration
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown

LABEL org.opencontainers.image.title="thehive-platform-frontend" \
      org.opencontainers.image.description="TheHive re-platform frontend (Next.js)" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.source="https://github.com/thehive-platform/thehive" \
      org.opencontainers.image.licenses="AGPL-3.0"

ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    NEXT_PUBLIC_APP_VERSION=${APP_VERSION} \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app

RUN apk add --no-cache curl tini && \
    addgroup -S app -g 10001 && \
    adduser  -S app -u 10001 -G app

# Copy standalone server
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static     ./.next/static
COPY --from=builder --chown=app:app /app/public           ./public

USER app
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://127.0.0.1:3000/api/healthz || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
