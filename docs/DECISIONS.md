# Decisions

- ROS is a new repository, not a refactor of the legacy food truck system.
- Operations and Cost are the only major business domains. Catalog is a deliberately small Admin-owned master.
- ROS uses one SQLite database first, with `catalog_*`, `operations_*`, and `cost_*` ownership boundaries guarded in tests.
- BOM belongs only to Cost. POS and Kitchen cannot write Catalog and never receive BOM data.
- Product Contract and daily-batch Sales Contract are the only cross-domain interfaces.
- Contracts are frozen; Miles / 林子茂 must approve any contract change.
- Google Sheets is a future reporting/review export, not the operational database.
- REST/SSE remain empty service infrastructure only until a Phase 1 decision.
- Legacy migration occurs only after new workflows have explicit acceptance and reconciliation plans.

Detailed rationale is in `docs/adr/`.
