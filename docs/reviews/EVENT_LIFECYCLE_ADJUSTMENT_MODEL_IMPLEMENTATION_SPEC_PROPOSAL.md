# Event Lifecycle Adjustment Model - Implementation Spec

Status: Proposal only - not approved for implementation

Related proposal: `docs/adr/ADR-XXX-event-lifecycle-adjustment-model.md`

## Decision Authority Note

The original analysis in this file predates the Architecture Owner's decision consolidation. For all resolved Open Questions, the authoritative current UX and operating-policy answer is now `ADR-XXX: Event Lifecycle Adjustment Model`, section **Decision Consolidation**.

This file remains an implementation-planning analysis only. Its older alternatives, phase cuts, and unresolved-question wording must not be treated as a second decision source. A future Decision Matrix and scoped Approval Record are required before any implementation work begins.

Architecture Owner: Miles / 林子茂

## Constitution Compatibility Gate - Implementation Slice 1

**Approval record:** DECISIONS #047

**Reviewed ADR:** ADR-013 Open Event Product Snapshot Policy; ADR-014 Order State Separation; ADR-015 Sellable Quantity Reservation Lifecycle; ADR-016 Order Idempotency Strategy; ADR-017 Human-readable Order Number; ADR-018 Sales Contract Emission Point; ADR-XXX Decision Consolidation and Decision Matrix.

**Compatibility result:** Compatible if Operations remains the only owner of Event state, Event inventory, adjustment records, and closeout observations; Catalog is read only through the existing published Product Contract boundary; the formal Lifecycle close service remains the only close path; and no Order, Payment, Production, Cost, Sales Contract, or Legacy policy is altered.

**Approved implementation slice:** add the Operations `paused` Event state and pause/resume actions; central, atomic page-level inventory adjustment while Draft or Paused; idempotency and audit for that batch; per-product waste and retained closeout records; formal closeout-before-close validation; and the matching Back Office, POS, Kitchen, Statistics, API, migration, and test work.

**Explicitly excluded from this slice:** Order item editing, Order-cancellation policy changes, payment confirmation/status changes, Payment provider work, Cost/BOM, Customer/Kiosk/Preorder, Sales Contract changes, Legacy, and Event Analysis implementation.

## Purpose

This is a phased implementation-planning document for the proposed Event Lifecycle Adjustment Model. It is deliberately not a work order. No phase may begin until Miles accepts the required decisions, compatibility review, and a scoped Approval Record.

## Baseline Assumptions to Verify at Approval Time

- Operations is the sole owner of Events and sellable inventory.
- Catalog supplies only formally published Product Contract versions.
- OPEN Event product data is Operations-owned snapshot data under ADR-013.
- Event allocation currently derives remaining quantity from planned, reserved, and sold counters.
- POS Orders use central SQLite transactions; SSE notifies and clients REST re-fetch.
- `archived` remains separate from operational close.

If any assumption is no longer true at implementation time, stop and perform a fresh pre-modification audit.

## Candidate Phase 1: Pause / Resume State Machine

### Goal

Add the proposed `paused` Event state and formal transitions without changing Catalog, Order, Payment, Production, Product Contract, Sales Contract, or Cost behaviour.

### Proposed scope

- Operations Event status type and transition service.
- State persistence/migration only if confirmed necessary.
- One formal pause action and one formal resume action.
- Append-only audit for pause/resume.
- SSE notification after committed state change; POS, Kitchen, Statistics, and Back Office re-fetch central state.
- Focused Back Office controls using Chinese UI labels: `暫停調整` and `恢復營業`.

### Dependencies

- Owner decision on `paused -> closed`.
- Owner decision on POS cart and Kitchen existing-order behaviour.
- ADR compatibility review confirming no conflict with ADR-013, ADR-015, and ADR-018.

### Possible persistence/migration impact

The current Event status union and existing records do not include `paused`. Determine whether SQLite status is unconstrained text or needs a compatibility migration; do not assume. Existing Events must retain their meaning exactly.

### API work to approve separately

Candidate pause/resume routes must be defined once, with request/response schemas, operator attribution, validation, idempotency policy, transaction boundaries, audit actions, and errors. Do not add a second lifecycle route beside the existing formal Event service.

### UI work to approve separately

- Back Office may display only controls valid for the selected central state.
- POS/Kitchen must render the same central status after REST refresh.
- The UI cannot decide whether an order or adjustment is permitted; it only calls the formal service.

### Tests required

- Every allowed/forbidden Event transition.
- One OPEN Event constraint remains intact.
- Rejected or duplicate state action leaves no partial UI state.
- Multi-screen SSE notification followed by REST re-fetch.

### Risks and stop conditions

Stop if pause would need to alter existing Order/Production state transitions, Event Close semantics, Product Contract, or the Sales Contract emission point.

## Candidate Phase 2: Append-only Inventory and Safety Adjustments

### Goal

While the Event is paused, record a deliberate adjustment without overwriting the history of initial preparation.

### Proposed scope

- Decide and implement one Operations-owned source of adjustment history.
- Formal adjustment and safety-buffer actions behind paused-state validation.
- Central calculation/read model for current basis, remaining, and customer available.
- Audit events and operator attribution.
- SSE notification plus REST re-fetch.

### Dependencies

- Phase 1 accepted and working.
- Owner decisions on reason taxonomy, lower bounds, batch versus single item, idempotency identity, and operator model.

### Migration and data analysis

Two options require Architecture decision:

1. **Minimal mutable basis plus audit metadata**: lower initial change, weaker operational history.
2. **Dedicated append-only adjustment records**: additive table/migration, explicit history and stronger future reporting.

The second is the recommended direction, but it is not approved by this proposal. Any migration must be additive, preserve existing Events and allocations, be idempotent where the repository migration framework requires it, and have a smoke test.

### API work to approve separately

The selected action must define exactly one API write path for each adjustment type. It must define request schema, error model, idempotent retry behavior, transaction boundary, lower-bound checks, audit linkage, and response read model. It must not update inventory through a second direct repository or UI path.

### UI work to approve separately

- Back Office presents current central values and adjustment form/history only while paused.
- POS and Kitchen do not independently calculate availability.
- Statistics receives committed central values only; presentation of adjustment reasons remains a separate Owner decision.

### Tests required

- Positive and negative delta.
- Restock, decrease, waste, and count-correction reason validation.
- Safety-buffer change validation.
- Reduction below sold/reserved/safety limits rejection.
- Duplicate request idempotency.
- POS order versus adjustment concurrency.
- Two Back Office adjustments concurrency.
- Audit append-only evidence and central read model reconciliation.

### Risks and stop conditions

Stop if the desired accounting of waste requires Cost/BOM data, if Order history would be rewritten, or if a proposed quantity formula conflicts with ADR-015.

## Candidate Phase 3: Add Published Product During Pause

### Goal

Allow a paused Event to add a product that already has a formally published Catalog version, then configure its initial sellable quantity and safety buffer.

### Proposed scope

- Reuse the existing Catalog publication read boundary.
- Validate Product Contract and copy the selected version into Operations.
- Add an Event inventory allocation under paused-only rules.
- Write an audit event and emit an inventory change after commit.

### Dependencies

- Phase 1 pause/resume accepted.
- Phase 2 quantity semantics decided, or an explicit approved decision that initial addition is a separate allocation rather than an adjustment.
- Owner decision on whether a different product version of an already-present product can be added.

### Migration impact

May require none if existing Operations product-copy and sellable-inventory structure can represent the addition correctly. Must be verified in a pre-modification audit; no schema conclusion is made here.

### API work to approve separately

Use one formal Operations application service. The endpoint must refuse draft Catalog products, inactive versions, direct Catalog creation, duplicate/ambiguous Event product selection, OPEN/closed/archived state, and invalid safety/quantity input.

### UI work to approve separately

- Back Office shows published Catalog choices only during pause.
- It names the copied selected version clearly without implying it edits Catalog.
- POS/Kitchen/Statistics re-fetch after commit and never show a locally invented product list.

### Tests required

- Existing Event product snapshot remains unchanged.
- New item uses the selected published version snapshot.
- Catalog republish after addition does not change the Event item.
- Invalid/unpublished/inactive selection is rejected.
- Add, resume, and multi-device refresh sequence is correct.

### Risks and stop conditions

Stop if this feature requires changing Product Contract, direct Catalog write access, or updating an existing OPEN Event snapshot.

## Engineering Impact Estimate (not a schedule)

| Area | Expected change level | Notes |
| --- | --- | --- |
| Operations domain/application | Medium | state machine, validation, formal services |
| Operations repository/database | Medium to high | depends on audit-only versus adjustment-record decision |
| Migration | None to medium | `paused` compatibility plus possible additive adjustment table |
| API/routes | Medium | only after exact write-path design is approved |
| Back Office UI | Medium | state-aware controls, forms, history/read model |
| POS/Kitchen/Statistics UI | Medium | central-state handling and refresh; no independent rule logic |
| Unit/integration/concurrency tests | High | central invariant and idempotency coverage |
| E2E/multi-device tests | High | pause/resume, stale screen, race, and recovery behavior |

### Maximum risks

- An adjustment races an Order allocation and produces inconsistent remaining quantity.
- A new item during pause refreshes or mutates an existing Event snapshot.
- Pause semantics accidentally change Kitchen production or Event Close rules.
- Generic audit JSON is mistaken for a complete inventory ledger without a clear reconstruction model.

### Recommended cuts for a first approved slice

1. Implement only pause/resume plus central read-only state propagation.
2. Then support one-item positive/negative quantity adjustment with a required reason and idempotency.
3. Defer batch adjustment, safety-buffer adjustment, add-product-during-pause, and adjustment history UI until the central invariants are proven.

These cuts are recommendations, not a Decision. They do not authorize implementation.

## Verification Gate for Any Future Approval

Before a future commit, the approved slice must define and pass:

- typecheck and lint;
- existing unit/integration/architecture guard/migration smoke coverage;
- focused new state, quantity, audit, and concurrency tests;
- focused E2E tests for Back Office, POS, Kitchen, and Statistics central refresh;
- full `pnpm verify:full` according to the repository's current scripts;
- a manual multi-device acceptance checklist.

Any failure, any need to change an accepted ADR, or any discovery of a domain/contract/Order/Cost dependency is a stop condition requiring a new Architecture Review.

## Owner Decisions Required Before Any Phase

1. Accept, revise, or reject the proposed pause state model.
2. Decide whether paused may formally close.
3. Decide POS cart and Kitchen existing-order behaviour during pause.
4. Decide adjustment reasons, lower bounds, idempotency, and single-versus-batch interactions.
5. Select minimal audit-only or dedicated append-only adjustment persistence.
6. Decide safety-buffer adjustment semantics.
7. Decide whether and how a different published version of an existing product may be added.
8. Approve an exact phase scope and compatibility result.

## Non-Goals

No Customer/Kiosk/Preorder, Payment, Cost/BOM/Waste Domain, Sales Contract change, AI, forecasting, Kitchen copilot, Archive workflow, authentication system, direct Catalog creation, multiple OPEN Events, or Legacy work is included.
