# API Contract

All JSON responses use `{ "ok": true, "data": ... }` or `{ "ok": false, "error": { "code", "message", "details?" } }`. SQLite errors and stack traces are never exposed.

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/health` | service readiness |
| GET | `/events` | SSE heartbeat only |
| GET/POST | `/api/admin/categories` | list/create categories |
| PATCH | `/api/admin/categories/:categoryId` | update category |
| GET/POST | `/api/admin/products` | list/create product drafts |
| GET/PATCH | `/api/admin/products/:productId` | view/update draft |
| POST | `/api/admin/products/:productId/publish` | validate and publish immutable version |
| GET | `/api/admin/canonical-ingredients` | management list; omitted lifecycle means `all`; supports `all`, `active`, and `archived` |
| GET | `/api/admin/canonical-ingredients/:ingredientId` | management detail for Active or Archived identity |
| POST | `/api/admin/canonical-ingredients/:ingredientId/rename` | Rename through the Canonical Ingredient lifecycle Application boundary |
| POST | `/api/admin/canonical-ingredients/:ingredientId/archive` | Archive through the Canonical Ingredient lifecycle Application boundary |
| GET | `/api/catalog/products/published?channel=pos` | validated Product Contract v1 list |
| POST | `/api/orders` | POS-only, idempotent Order creation for the OPEN Event; `201` new / `200` replay |
| GET | `/api/orders/:orderId` | public immutable Order and item snapshots |

The public catalog route validates every returned Product Contract at runtime. It has no BOM, cost, ingredient, inventory, purchase, or internal draft fields. POS has no direct database access and consumes this API only.

`POST /api/admin/categories` accepts `displayName`, optional `sortOrder`, and optional `isActive`. The server generates immutable category `code` values for new categories using `cat-0001` format and rejects caller-supplied `code`. `PATCH /api/admin/categories/:categoryId` accepts only `displayName`, `sortOrder`, and `isActive`; caller-supplied `code` or `categoryId` is rejected. Responses still include `categoryId`, `code`, `displayName`, `sortOrder`, and `isActive`.

## POS Order Core

`POST /api/orders` accepts `source: "pos"`, `eventId`, `idempotencyKey`, non-empty `items`, and optional `customerName`, `customerPhoneTail`, `paymentMethod`, and `notes`. `customerPhoneTail`, when present, must be exactly four digits. `paymentMethod`, when present, is limited to `CASH` or `LINE_PAY`; it is a POS-recorded method hint only and does not create a Payment domain, payment provider, reconciliation, or paid state. Each item requires `productId`, `productVersionId`, a positive integer `quantity`, and optional notes. Prices are never accepted as an authority: the server uses the frozen Event Product Snapshot.

Success returns a public Order with `orderId`, `orderNumber`, `customerName`, `customerPhoneTail`, `paymentMethod`, states, totals, timestamps, `servedAt`, and item snapshots. `GET /api/orders/:orderId` returns the same public shape. `GET /api/events/:eventId/orders` is the current-Event lifecycle read model used by POS and Kitchen and includes the same phone tail, payment method, and served timestamp projection. Neither route exposes request fingerprints, SQLite internals, Cost, BOM, full customer contact, or stack traces.

Errors are `{ ok: false, error: { code, message, details? } }`. The Order Core uses `EVENT_NOT_OPEN`, `PRODUCT_NOT_IN_EVENT`, `PRODUCT_VERSION_MISMATCH`, `CHANNEL_NOT_ENABLED`, `INVALID_QUANTITY`, `INSUFFICIENT_QUANTITY`, `IDEMPOTENCY_CONFLICT`, `VALIDATION_ERROR`, `ORDER_NOT_FOUND`, and `UNSUPPORTED_ORDER_SOURCE`. Validation is `400`, missing resources are `404`, and state, quantity, or idempotency conflicts are `409`.

## Canonical Ingredient management

The `/api/admin/canonical-ingredients` namespace has four route registrations
and six management behaviors: list all, list Active, list Archived, detail,
Rename, and Archive. List-all returns the complete Active section followed by
the complete Archived section. Each section preserves Repository ordering by
`name ASC`, then `ingredientId ASC`.

Canonical Ingredient management maps typed Application outcomes as follows:

| Outcome | Status |
| --- | ---: |
| Validation failure | `422` |
| Not Found | `404` |
| Version Conflict, Already Archived, Archived Rename Rejected, or Invalid Lifecycle Transition | `409` |
| Persistence failure | `500` |

Malformed JSON syntax retains the established
`400 / invalid_json / Request body must be a JSON object.` response. Valid
non-object JSON on the management command routes is a `422` management
validation failure. Valid non-object JSON on the existing Cost creation route
remains `400 / invalid_json`. Raw Repository and SQLite failure details never
cross the Application or HTTP boundary.

`POST /api/admin/cost/ingredients` remains the existing Cost Back Office
creation-composition endpoint. It is not a Canonical Ingredient lifecycle
management authority and does not duplicate the management namespace.
