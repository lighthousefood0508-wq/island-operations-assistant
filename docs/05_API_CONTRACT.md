# API Contract

Implemented now:

| Route | Result |
| --- | --- |
| `GET /health` | JSON service and database readiness |
| `GET /events` | SSE connection, immediate heartbeat, then 15-second heartbeats |
| `GET /admin`, `/pos`, `/order`, `/kitchen` | isolated placeholder pages |
| `GET /api/v1` | intentional 501 skeleton response |

Planned REST namespaces, not implemented: `/api/v1/catalog/*`, `/events`, `/availability`, `/orders`, `/orders/:id/status`, `/payments`, `/inventory/*`, `/purchases`, `/admin/*`, `/integrations/*`.

Every future write needs authentication, business scope, request id, idempotency strategy where external retries are possible, validation, an audit log, and an emitted domain event after commit.
