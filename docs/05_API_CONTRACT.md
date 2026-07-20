# API Contract

All JSON responses use `{ "ok": true, "data": ... }` or `{ "ok": false, "error": { "code", "message", "details?" } }`. SQLite errors and stack traces are never exposed.

| Method | Route | Phase 1A behavior |
| --- | --- | --- |
| GET | `/health` | service readiness |
| GET | `/events` | SSE heartbeat only |
| GET/POST | `/api/admin/categories` | list/create categories |
| PATCH | `/api/admin/categories/:categoryId` | update category |
| GET/POST | `/api/admin/products` | list/create product drafts |
| GET/PATCH | `/api/admin/products/:productId` | view/update draft |
| POST | `/api/admin/products/:productId/publish` | validate and publish immutable version |
| GET | `/api/catalog/products/published?channel=pos` | validated Product Contract v1 list |
| POST | `/api/orders` | POS-only, idempotent Order creation for the OPEN Event; `201` new / `200` replay |
| GET | `/api/orders/:orderId` | public immutable Order and item snapshots |

The public catalog route validates every returned Product Contract at runtime. It has no BOM, cost, ingredient, inventory, purchase, or internal draft fields. POS has no direct database access and consumes this API only.

## POS Order Core

`POST /api/orders` accepts `source: "pos"`, `eventId`, `idempotencyKey`, non-empty `items`, and optional `customerName`/`notes`. Each item requires `productId`, `productVersionId`, a positive integer `quantity`, and optional notes. Prices are never accepted as an authority: the server uses the frozen Event Product Snapshot.

Success returns a public Order with `orderId`, `orderNumber`, states, totals, timestamps, and item snapshots. `GET /api/orders/:orderId` returns the same public shape. Neither route exposes request fingerprints, SQLite fields, Cost, BOM, customer contact, or stack traces.

Errors are `{ ok: false, error: { code, message, details? } }`. The Order Core uses `EVENT_NOT_OPEN`, `PRODUCT_NOT_IN_EVENT`, `PRODUCT_VERSION_MISMATCH`, `CHANNEL_NOT_ENABLED`, `INVALID_QUANTITY`, `INSUFFICIENT_QUANTITY`, `IDEMPOTENCY_CONFLICT`, `VALIDATION_ERROR`, `ORDER_NOT_FOUND`, and `UNSUPPORTED_ORDER_SOURCE`. Validation is `400`, missing resources are `404`, and state, quantity, or idempotency conflicts are `409`.
