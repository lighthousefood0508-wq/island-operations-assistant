# Decisions

## Approval Register

- **DECISIONS #001**: Phase 1B approval on 2026-07-20 for Event, Sellable Inventory, Product Contract v2, and POS Current Event.
- **DECISIONS #002**: Phase 1B.1 approval on 2026-07-20 for Governance and OPEN Event Product Snapshot Freeze.
- **DECISIONS #003**: Phase 1C Design Finalization approval on 2026-07-20 for Order Policy Freeze and ADR-014 through ADR-018 acceptance only.
- **DECISIONS #004**: Phase 1C Order Core approval on 2026-07-20 for POS-only Order create/read APIs, snapshots, Event numbers, idempotency, atomic sellable quantity handling, audit logging, and additive Operations migration.
- **DECISIONS #005**: Governance follow-up on 2026-07-20 requiring every implementation completion report to cite its approval record first.
- **DECISIONS #006**: Release v0.4 and Phase 1C.1 approval on 2026-07-20 by Architecture Owner Miles / Lin Zi-Mao for release documentation and a POS-only minimal shopping cart UI. Payment, Kitchen, Kiosk, Preorder, Sales Contract, Cost, LINE, n8n, and Google Sheets remain excluded.
- **DECISIONS #007**: Phase 1C-2 Order Lifecycle approval on 2026-07-20 by Architecture Owner Miles / Lin Zi-Mao for Operations-only status lifecycle, manual no-show, one-time manual inventory release, Event Close, daily-report snapshot, audit, and minimal lifecycle UI. No Payment, Kitchen, Kiosk, Preorder, Sales Contract, Cost, LINE, n8n, Google Sheets, or Legacy scope is approved.
- **DECISIONS #008**: Governance Audit approval on 2026-07-20 by Architecture Owner Miles / Lin Zi-Mao. This is a non-functional review of Phase 1C-2 alignment only. No business logic, API, UI, migration, database, or operating setting change is approved.
- **DECISIONS #010**: Phase 1C.2-R Remediation approval on 2026-07-20 by Architecture Owner Miles / Lin Zi-Mao. Restore ADR-014 state separation, recover prior data through an idempotent migration, represent no-show as cancelled with `cancellationReason=no_show`, unify Event Close, and add the Constitution Compatibility Gate. No new business scope is approved.
- **DECISIONS #013**: 2026-07-26 ROS Shadow Run MVP approval on 2026-07-20 by Architecture Owner Miles / Lin Zi-Mao. Legacy remains the primary system. The unmerged Shadow Run branch may add central SQLite POS/Kitchen synchronization, production-status-only Kitchen workflow, minimal closeout reconciliation, local-network deployment instructions, and acceptance tests. Payment, Customer, Preorder, LINE, Cost, Google Sheets, Voice, VPS, and Legacy changes remain excluded.
- **DECISIONS #014**: 2026-07-26 External Shadow Run approval on 2026-07-20 by Architecture Owner Miles / Lin Zi-Mao. The unmerged external-test branch may add protected ngrok access, SSE transport hardening, minimal POS/Kitchen connectivity status, external testing instructions, and acceptance coverage. It does not approve changes to business rules, contracts, domains, Cost, Catalog, Payment, Customer, Preorder, LINE, Google Sheets, Voice, VPS, or Legacy.
- **DECISIONS #015**: Independent ROS external endpoint review on 2026-07-20. Work stopped before implementation because a separate protected tunnel resource was unavailable; Legacy remained untouched.
- **DECISIONS #016**: Realtime Synchronization Hardening approval on 2026-07-21 by Architecture Owner Miles / Lin Zi-Mao. The unmerged branch may harden POS, Kitchen, and Statistics connection visibility, SSE reconnect, polling fallback, debug observability, and acceptance tests only. No domain, contract, business-rule, Product, Event, Lifecycle, Payment, Cost, or Legacy change is approved.
- **DECISIONS #017**: Cloudflare Tunnel Deployment Preparation approval on 2026-07-21 by Architecture Owner Miles / Lin Zi-Mao. It permits local cloudflared installation, non-secret templates, readiness reporting, ROS-only start/stop scripts, documentation, and a credential-free deployment package. Owner login and tunnel authorization remain manual. No Tunnel is created and no Legacy, domain, contract, or business behavior change is approved.
- **DECISIONS #018**: Quick Tunnel fallback approval on 2026-07-21 by Architecture Owner Miles / Lin Zi-Mao. With no Cloudflare Zone available, ROS may use an accountless `trycloudflare.com` Quick Tunnel on local port 3092 for temporary external verification. No Legacy/ngrok/n8n, domain, contract, or business behavior change is approved.

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
- Phase 1C POS Order Core was explicitly approved by Architecture Owner on 2026-07-20; see **DECISIONS #004**. Only `source=pos` is accepted. POS creates confirmed/unpaid/not_started Orders and directly consumes sellable quantity in one SQLite IMMEDIATE transaction.
- The first implementation uses Operations-owned Event Product snapshots only. It does not reread Catalog during Order creation and does not access Cost.
- Idempotency is recorded by Event, source, and key with a canonical request fingerprint. A matching retry returns the original Order; a mismatched retry returns `409 IDEMPOTENCY_CONFLICT`.
- Governance reporting rule: every implementation completion report starts by citing its `DECISIONS #XX` approval record. A missing record must be added before reporting completion; see **DECISIONS #005**.

Detailed rationale is in `docs/adr/`.
