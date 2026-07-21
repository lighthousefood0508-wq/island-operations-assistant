# Legacy Feature Phase Plan

Approval: DECISIONS #020. Proposed order only; every phase still needs its own Architecture Owner approval and compatibility gate.

## Phase A: POS Core UI Restoration

- **Goal:** Staff can create central POS Orders against an OPEN Event using an ergonomic Legacy-familiar surface.
- **Scope:** category/product cards, cart, totals, identity/notes only if allowed, submit/retry messages, central Order list, safe status display, no financial cards on POS homepage.
- **Dependencies:** accepted Event/Product Contract snapshot, Order Core, idempotency, realtime baseline.
- **Not included:** Payment recording, Kitchen ownership changes, Customer, Preorder, Cost, Invoice.
- **Acceptance:** two terminals cannot oversell; retry is idempotent; order number and remaining quantities are central; no finance/debug leakage on POS home.
- **ADR:** 013, 014, 015, 016, 017.
- **Risk:** Payment must remain visibly unpaid until a Payment phase, so the UI cannot mimic Legacy “paid” semantics.

## Phase B: Payment and Order Closure

- **Goal:** Record staff-confirmed cash/LINE Pay payment and allow compliant Order completion only after payment paid and production served.
- **Scope:** payment action, payment audit, correction/refund policy, completion action and clear POS status copy.
- **Dependencies:** explicit payment provider/recording decision and staff authorization rules.
- **Not included:** payment gateway, LINE Bot, invoice issuance, Cost posting.
- **Acceptance:** no production action creates payment; no payment action silently completes; completed emits one Sales Contract when Cost import exists.
- **ADR:** 014, 016, 018.
- **Risk:** LINE Pay “label only” versus formal payment is an Owner decision.

## Phase C: Customer Kiosk

- **Goal:** A customer iPad creates central Kiosk Orders safely.
- **Scope:** kiosk catalog from current Event, customer cart, UUID retry, 10-minute reservation lifecycle, staff/payment handoff.
- **Dependencies:** Phase B policy decisions, Kiosk timeout trigger and customer-data retention.
- **Not included:** LINE preorder, Customer self-service cancellation, PWA/offline queue.
- **Acceptance:** Kiosk double submit produces one Order; reservation expires/releases only through approved Operations path; POS/Kitchen see central result.
- **ADR:** 014, 015, 016, 017.
- **Risk:** no browser storage becomes formal Order storage.

## Phase D: Preorder

- **Goal:** A LINE/URL preorder creates central Event-scoped preorder allocation.
- **Scope:** deadline, quotas, Event product availability, direct sold allocation, idempotent external submission, staff manual Kitchen queue.
- **Dependencies:** deadline timezone, per-product quota, customer modification/cancellation decisions.
- **Not included:** LINE Bot/n8n automation unless separately approved.
- **Acceptance:** cutoff and quota are server-enforced; failed retry does not double sell; preorder is not auto-queued to Kitchen.
- **ADR:** 014, 015, 016, 017.
- **Risk:** must not reuse Legacy `close` URL-only policy as enforcement.

## Phase E: Voice

- **Goal:** Restore optional spoken operational cues without becoming system truth.
- **Scope:** remaining, queued order and reservation speech; controlled operator preferences.
- **Dependencies:** Phase A/C/D read models and approved scheduler model for reminders.
- **Not included:** AI voice, automatic business actions, Kitchen state changes.
- **Acceptance:** voice failure never blocks POS/Kitchen; no duplicate repeated announcements after reconnect.
- **ADR:** no contract change expected.
- **Risk:** browser speech support differs by device.

## Phase F: Cost, Waste and Reports

- **Goal:** Replace Legacy local cost/margin/waste calculations with a separate Cost-owned ledger and reports.
- **Scope:** BOM/cost, purchase/import, waste flow, remaining retention policy, cost reports and margin.
- **Dependencies:** Cost domain implementation and approved Waste Contract/report path.
- **Not included:** direct POS access to BOM/cost tables.
- **Acceptance:** Operations and Cost retain domain boundaries; only formal contracts cross them; reports identify data freshness.
- **ADR:** 018 and future approved Waste decision.
- **Risk:** the accepted post-production cancellation gap must remain visible until a Waste mechanism exists.

## Phase G: Google Sheets and External Integrations

- **Goal:** Export finalized reporting records without making Sheets operational truth.
- **Scope:** durable export coordination, delivery/retry observation, optional LINE/n8n adapters under their own approvals.
- **Dependencies:** formal completion, Sales Contract and defined report records.
- **Not included:** browser-to-Sheets writes; n8n as Order database.
- **Acceptance:** idempotent export, no duplicate rows, auditability, and a failed export does not affect current Event operations.
- **ADR:** 018.
- **Risk:** credentials and user data require deployment/security review.
