# API versioning

## Path-based versioning

All public API endpoints live under `/api/v{N}`. Phase 1 ships only `/api/v1`.

| Rule | Reason |
|---|---|
| Adding fields to a response is allowed within a major version. | Backward compatible. |
| Removing or renaming a field requires a new major (`/api/v2`). | Protects clients. |
| Changing enum semantics requires a new major. | Subtle breaking change. |
| Adding new endpoints is always allowed. | Pure addition. |
| Authentication contract changes (token shape, header name) require a new major. | Cross-cutting. |

## Source of truth

The OpenAPI 3 spec lives at [`backend/api/openapi.yaml`](../backend/api/openapi.yaml).
`info.version` matches the application semver (`0.1.0` in Phase 1).

CI may generate clients from this spec in later phases. Until then, treat the file as
the canonical contract: **handlers must match the spec, not the other way around**.

## Error format

All error responses follow RFC 7807 problem+json:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "field 'login' is required",
  "request_id": "8e1c…"
}
```

`request_id` is always included. Clients are expected to log it for support
correlation.

## Request correlation

The middleware accepts an inbound `X-Request-ID` header; if missing, it generates a
UUIDv4. The same value is echoed back on the response and used in:

- Every log line for the request.
- The `request_id` field of any error response.
- Outbox / RabbitMQ headers (Phase 2+) so downstream workers correlate work.
