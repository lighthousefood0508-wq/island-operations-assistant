# Decisions

- ROS is a new repository, not a refactor of the legacy food truck system.
- Operations and Cost are the only major business domains. Catalog is a deliberately small Admin-owned master.
- ROS uses one SQLite database first, with `catalog_*`, `operations_*`, and `cost_*` ownership boundaries guarded in tests.
- `better-sqlite3` is used only through `DatabaseAdapter`; foreign keys, WAL, and busy timeout are configured centrally.
- BOM belongs only to Cost. POS and Kitchen cannot write Catalog and never receive BOM data.
- Product Contract and daily-batch Sales Contract are the only cross-domain interfaces.
- Contracts are frozen; Miles / 林子茂 must approve any contract change.
- Catalog uses prefixed random UUID IDs; codes and names are never primary keys.
- Google Sheets is a future reporting/review export, not the operational database.
- REST/SSE are service infrastructure only. `server/jobs` may coordinate application services but never execute SQL or business rules.

Detailed rationale is in `docs/adr/`.
