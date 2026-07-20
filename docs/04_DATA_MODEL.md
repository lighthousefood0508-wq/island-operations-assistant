# Data Model

IDs are immutable prefixed random UUIDs, timestamps are UTC ISO-8601 text, and money is integer TWD. Business tables retain the `catalog_`, `operations_`, or `cost_` prefix.

| Ownership | Tables | Phase 1A state |
| --- | --- | --- |
| Catalog | `catalog_categories`, `catalog_products`, `catalog_product_drafts`, `catalog_product_draft_channels`, `catalog_product_versions`, `catalog_product_channels` | implemented |
| Operations | `operations_*` | reserved only; no application behavior |
| Cost | `cost_*` | reserved only; no application behavior |
| Shared/System | `schema_migrations`, `users`, `roles`, `user_roles`, `audit_logs`, `system_settings` | migration/audit infrastructure |

`catalog_categories.code` is unique; renaming never changes `category_id`. Products own editable draft data, while published rows in `catalog_product_versions` are immutable by trigger and application rule. Published channel rows belong to the version. Product Contract exposes only approved published data, never the draft description, BOM, cost, stock, or purchase data.
