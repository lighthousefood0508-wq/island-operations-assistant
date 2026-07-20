# Data Model

The initial schema is in `migrations/001_initial_foundation.sql`. All ids are application-generated text identifiers, timestamps are ISO-8601 UTC text, and money is integer TWD.

| Domain | Tables | Responsibility |
| --- | --- | --- |
| Platform | businesses, users, roles, user_roles, devices, audit_logs | tenant boundary, access, device identity, mutation evidence |
| Catalog | categories, products, product_versions, product_channels | versioned products and explicit channel publication |
| Operations | events, availability_allocations, orders, order_items, order_status_events, payments | event-based selling, immutable order snapshots, payment record |
| Cost & Inventory | ingredients, boms, bom_items, production_batches, inventory_transactions, purchases, purchase_items, waste | future inventory and cost ledger interfaces |
| Integrations | sync_jobs, external_events | asynchronous reporting sync and deduplicated external delivery |

Planned later tables: `ingredient_aliases`, `unit_conversions`, promotions, order discounts, invoice records, invoice events, and an audit export index. They are documented contracts, not implemented schema in Phase 1.

Important relations: `products.category_id -> categories`; `product_versions.product_id -> products`; `product_channels.product_version_id -> product_versions`; `orders.event_id -> events`; `order_items` holds product/version/name/price/cost snapshots; `payments.order_id -> orders`; `boms.product_id -> products`; `bom_items.ingredient_id -> ingredients`.
