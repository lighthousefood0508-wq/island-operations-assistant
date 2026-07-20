# Current Status

Date: 2026-07-20

ROS v0.4 is released locally at `v0.4-order-core`; see `docs/releases/RELEASE_v0.4.md`. Phase 1C.1 POS Minimal UI is complete under **DECISIONS #006**. It consumes only the existing Current Event and Order APIs to provide grouped products, a local cart, quantity controls, submit-state protection, success order number, refreshed remaining quantities, and explicit Order error messaging.

Phase 1C Order Core is complete after verification. It implements POS-only Order creation and retrieval against an OPEN Event. A create operation runs in one SQLite IMMEDIATE transaction, creates confirmed/unpaid/not_started Order snapshots, atomically increases `sold_quantity`, assigns a shared Event order number, saves idempotency state, and records one `order.created` audit entry. Replays return the original order without another quantity deduction or audit entry.

Phase 1B and Phase 1B.1 are complete after verification. Phase 1B added Catalog Product Contract v2 display snapshots plus Operations Event and Sellable Inventory. Phase 1B.1 records Architecture Owner approval and freezes the OPEN Event Product Snapshot Policy: an OPEN Event reads only its Operations-owned Product Contract v2 snapshot, while a Catalog republish is selectable only by a new Event. Phase 1C-Design is complete as a documentation-only Architecture Review package; Phase 1C implementation is not approved or started. POS reads only the current Event API. SQLite uses `better-sqlite3` through a thin adapter. Playwright E2E acceptance verifies the UI catalog-to-event-to-POS flow on an isolated database.

Not implemented: payments, Kitchen, Customer/Kiosk, preorder, cancellation/refund, Cost/BOM/inventory behavior, Sales Contract execution, authentication, users/roles UI, LINE/n8n/Google Sheets/OpenAI integration, receipt processing, Docker, VPS, legacy migration, and production monitoring.

The Legacy project remains read-only and unmodified. Any new phase, scope expansion, or contract change requires explicit Architecture Owner approval before work begins.

Governance follow-up: completion reports now cite their `DECISIONS #XX` approval record first; the Phase 1C implementation record is **DECISIONS #004**. `ORDER_OPEN_QUESTIONS.md` explicitly retains no-show and Event Close batch-finalization policies for Architecture Owner decision; neither is implemented. Phase 1B's repeatable five-minute acceptance checklist is in `docs/acceptance/PHASE_1B_MANUAL_ACCEPTANCE.md`.
