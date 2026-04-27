# Observability

Phase 1 instruments three pillars: logs, metrics, health.

## Logs

- Format: JSON, single line per record.
- Library: `go.uber.org/zap` (production preset).
- Default level: `info`. Override via `LOG_LEVEL=debug|info|warn|error`.
- Common fields: `ts`, `level`, `msg`, `service`, `env`, `pid`, `caller`.
- Per-request fields added by the HTTP middleware:
  - `request_id`
  - `method`
  - `path`
  - `status`
  - `latency_ms`
  - `client_ip`
  - `user_agent`

Sensitive header redaction is the responsibility of upstream proxies for now; the
backend never logs request bodies in Phase 1.

## Metrics

Endpoint: `GET /metrics` (Prometheus text exposition).

| Metric | Type | Labels |
|---|---|---|
| `http_requests_total` | Counter | `method`, `path`, `status` |
| `http_request_duration_seconds` | Histogram | `method`, `path` |
| `db_query_duration_seconds` | Histogram | `query` |
| `mq_publish_total` | Counter | `exchange`, `routing_key`, `status` |
| `mq_consume_total` | Counter | `queue`, `status` |
| `app_info` | Gauge | `version`, `git_sha` |

Plus the standard Go runtime collectors and process collector.

## Health

| Probe | Endpoint | What it checks |
|---|---|---|
| Liveness | `/healthz` | Process is up. Always returns 200 unless the binary is crashed. |
| Readiness | `/readyz` | Pings Postgres and RabbitMQ. 200 only when both are healthy. |

Use `/readyz` for the load balancer / Kubernetes readiness probe. Use `/healthz` for
liveness so a transient DB outage does not restart the pod.

## Alert recommendations (Phase 2+)

- **Backend down**: `up{job="thehive-backend"} == 0` for 2m.
- **High 5xx ratio**: `sum(rate(http_requests_total{status=~"5.."}[5m])) /
  sum(rate(http_requests_total[5m])) > 0.05`.
- **Slow latency**: `histogram_quantile(0.95, sum by (le)
  (rate(http_request_duration_seconds_bucket[5m]))) > 1`.
- **MQ publish failures**: `increase(mq_publish_total{status="error"}[5m]) > 0`.
- **DB connection saturation**: `pg_stat_activity_count{state="active"} >
  POSTGRES_MAX_OPEN_CONNS * 0.8`.
