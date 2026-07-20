# API Contract

Implemented now:

| Route | Result |
| --- | --- |
| `GET /health` | JSON service and database readiness |
| `GET /events` | SSE connection, immediate heartbeat, then 15-second heartbeats |
| `GET /admin`, `/pos`, `/order`, `/kitchen` | isolated placeholder pages |
| `GET /api/v1` | intentional 501 skeleton response |

Planned REST namespaces, not implemented: `/api/v1/catalog/*`, `/events`, `/availability`, `/orders`, `/orders/:id/status`, `/payments`, `/inventory/*`, `/purchases`, and `/admin/*`. They must conform to `CONSTITUTION.md` before implementation.

Every future write needs authentication, request id, idempotency where retries are possible, validation, and audit evidence. Product and Sales Contracts are the only cross-domain interface and cannot be changed without Architecture Owner approval.
