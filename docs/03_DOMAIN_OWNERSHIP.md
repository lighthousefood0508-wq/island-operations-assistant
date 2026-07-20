# Domain Ownership

| Area | Owns | May consume | Forbidden |
| --- | --- | --- | --- |
| Catalog | `catalog_*`: categories, products, versions, channels, publication | Admin input | orders, payments, BOM, inventory, cost calculation |
| Operations | `operations_*`: events, published-product copies, availability, orders, payments, status, sales outbox | Product Contract | direct `cost_*` access and BOM data |
| Cost | `cost_*`: ingredients, aliases, conversions, BOM, purchases, imports, inventory | Product Contract and daily Sales Contract import | direct `operations_*` access or order mutation |
| Shared/System | users, roles, audit logs, settings | infrastructure only | business ownership |

Catalog is intentionally small and Admin-only. The ROS SQLite database is the operational source of truth, but ownership is enforced by naming, source boundaries, and guard tests. Browser storage and Google Sheets are never authorities.
