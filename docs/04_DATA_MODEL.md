# Data Model

The initial schema is in `migrations/001_initial_foundation.sql`. IDs are stable text IDs, timestamps are UTC ISO-8601 text, and money is integer TWD. No business table may omit its `catalog_`, `operations_`, or `cost_` prefix.

| Ownership | Tables |
| --- | --- |
| Catalog | `catalog_categories`, `catalog_products`, `catalog_product_versions`, `catalog_product_channels` |
| Operations | `operations_events`, `operations_product_copies`, `operations_availability`, `operations_orders`, `operations_order_items`, `operations_payments`, `operations_order_status_events`, `operations_sales_outbox` |
| Cost | `cost_ingredients`, `cost_ingredient_aliases`, `cost_unit_conversions`, `cost_boms`, `cost_bom_items`, `cost_sales_imports`, `cost_inventory_transactions`, `cost_purchases`, `cost_purchase_items` |
| Shared/System | `schema_migrations`, `users`, `roles`, `user_roles`, `audit_logs`, `system_settings` |

`operations_product_copies` stores a Product Contract snapshot without a cross-domain foreign key. `cost_boms` stores product and product-version IDs as contract references; BOM itself exists only in `cost_*`. `operations_sales_outbox` and `cost_sales_imports` are separate records connected by `salesEventId`, not direct table access.
