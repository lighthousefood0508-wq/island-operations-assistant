# Data Model

IDs are immutable prefixed random UUIDs, timestamps are UTC ISO-8601 text, and money is integer TWD. Business tables retain the `catalog_`, `operations_`, or `cost_` prefix.

| Ownership | Tables | Phase 1A state |
| --- | --- | --- |
| Catalog | `catalog_categories`, `catalog_products`, `catalog_product_drafts`, `catalog_product_draft_channels`, `catalog_product_versions`, `catalog_product_channels` | implemented |
| Operations | `operations_*` | reserved only; no application behavior |
| Cost | `cost_*` | reserved only; no application behavior |
| Shared/System | `schema_migrations`, `users`, `roles`, `user_roles`, `audit_logs`, `system_settings` | migration/audit infrastructure |

`catalog_categories.category_id` is the only formal category relationship key. `catalog_categories.code` is unique, stable, and system generated for new categories as `cat-0001`, `cat-0002`, etc.; existing legacy codes such as `bento`, `rice`, or `side` are preserved and never re-numbered. Users edit only category display name, sort order, and active state. Products own editable draft data, while published rows in `catalog_product_versions` are immutable by trigger and application rule. Published channel rows belong to the version. Product Contract exposes only approved published data, never category code, the draft description, BOM, cost, stock, or purchase data.

## Phase 1C Operations Order Core

`004_order_core.sql` adds fields to the existing Operations order skeleton only. `operations_orders` now stores the Event-local `order_number`, POS source, independent order/payment/production states, optional customer/name notes, idempotency key, canonical request fingerprint, and confirmation timestamps. POS creates only `confirmed` / `unpaid` / `not_started` rows with zero discount.

`operations_order_items` keeps immutable Event Product Snapshot fields: product/version IDs, display/POS/category names, list and selling prices, quantity, discount, line total, item notes, and the deliberately unavailable Cost placeholders. The Order Core never reads Cost or BOM data.

`operations_event_order_sequences` is one row per Event and allocates the next shared order number inside the same transaction. `operations_order_idempotency` stores the Event + source + idempotency key, fingerprint, and order ID for durable retry handling. Both are Operations-owned data.
