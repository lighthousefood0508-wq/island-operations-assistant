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

The public catalog route validates every returned Product Contract at runtime. It has no BOM, cost, ingredient, inventory, purchase, or internal draft fields. POS has no direct database access and consumes this API only.
