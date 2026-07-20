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
- Phase 1C-Design Finalization was explicitly approved by Architecture Owner Miles / 林子茂 on 2026-07-20. Approved scope: Order Policy Freeze and acceptance of ADR-014 through ADR-018. It does not approve Phase 1C implementation.
- Frozen Order policies: all sources share one Event order number sequence; POS directly sells; Kiosk reserves for 10 minutes then payment confirms/sells/queues; Preorder directly confirms/sells and POS manually queues it; Sales Contract emits once only at completed.
- Accepted known gap: production-stage cancellation does not restore sold quantity and does not reach Cost in first version. A future independent Waste Contract/reporting flow may address it; none is approved now.
- Phase 1C POS Order Core was explicitly approved by Architecture Owner on 2026-07-20. Only `source=pos` is accepted. POS creates confirmed/unpaid/not_started Orders and directly consumes sellable quantity in one SQLite IMMEDIATE transaction.
- The first implementation uses Operations-owned Event Product snapshots only. It does not reread Catalog during Order creation and does not access Cost.
- Idempotency is recorded by Event, source, and key with a canonical request fingerprint. A matching retry returns the original Order; a mismatched retry returns `409 IDEMPOTENCY_CONFLICT`.

Detailed rationale is in `docs/adr/`.
