# Decisions

- ROS is a new repository, not a refactor of the legacy food truck system.
- Operations and Cost are the only major business domains. Catalog is a deliberately small Admin-owned master.
- ROS uses one SQLite database first, with `catalog_*`, `operations_*`, and `cost_*` ownership boundaries guarded in tests.
- `better-sqlite3` is used only through `DatabaseAdapter`; foreign keys, WAL, and busy timeout are configured centrally.
- BOM belongs only to Cost. POS and Kitchen cannot write Catalog and never receive BOM data.
- Product Contract v2 and daily-batch Sales Contract v1 are the only cross-domain interfaces. Product Contract v2 carries Catalog-owned category display snapshots while `categoryId` remains the only category identity.
- Contracts are frozen; Miles / 林子茂 must approve any contract change.
- Catalog uses prefixed random UUID IDs; codes and names are never primary keys.
- Google Sheets is a future reporting/review export, not the operational database.
- REST/SSE are service infrastructure only. `server/jobs` may coordinate application services but never execute SQL or business rules.
- Phase 1B was explicitly approved by Architecture Owner Miles / 林子茂 on 2026-07-20. Approved scope: Event, Sellable Inventory, Product Contract v2, and POS Current Event read-only display.
- OPEN Event Product Snapshot Policy: an Event retains the Product Contract v2 snapshot selected while it was draft. Catalog republishing creates a version for a future Event only; it never changes an OPEN Event.
- New phases, scope expansion, and contract changes require a new explicit Architecture Owner approval. Completion reports and roadmap entries are not approval.

Detailed rationale is in `docs/adr/`.
