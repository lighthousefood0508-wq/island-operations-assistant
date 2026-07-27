# ADR-XXX: Event Lifecycle Adjustment Model

Status: Proposal only - not accepted and not approved for implementation

Architecture Owner: Miles / 林子茂

## Decision Consolidation

**Status:** Consolidated existing Architecture Owner decisions. This section records decisions already made in discussion. It is not an implementation Approval Record and does not authorize code, API, schema, migration, or test changes.

### Decision Matrix

This table is a quick index into the ADR. It does not add, reinterpret, or replace any decision below.

| ID | Topic | Status | Owner Decision | Decision Date | Related ADR Section |
| --- | --- | --- | --- | --- | --- |
| ELM-01 | Event Lifecycle | Decided | Daily operational presentation is Draft, Open, Paused, Closed; `archived` remains separate. | 2026-07-23 (consolidated) | Additional Decisions: Daily Event presentation |
| ELM-02 | Current Event Context | Decided | Current Event is the highest Back Office context. | 2026-07-23 (consolidated) | Additional Decisions: Back Office hierarchy |
| ELM-03 | Paused | Decided | Pause blocks new POS Orders; operational adjustments occur before resume; formal close may start from Paused. | 2026-07-23 (consolidated) | Original Questions 1-3, 5-7 |
| ELM-04 | Inventory Adjustment | Decided | Use one confirmed page-level batch save; never reduce below sold plus reserved; repeated save is one operator action. | 2026-07-23 (consolidated) | Original Questions 4-7 |
| ELM-05 | Waste Before Close | Decided | End Today's Sales opens per-product closeout with waste defaulting to `0` and retained recorded before formal close. | 2026-07-23 (consolidated) | Additional Decisions: Closeout and waste; Retained quantity |
| ELM-06 | Payment Method | Decided | POS records the intended payment method when an Order is created. | 2026-07-23 (consolidated) | Additional Decisions: Payment method and payment status |
| ELM-07 | Payment Status | Decided | Service completion requires an explicit Confirm Received or Not Yet Received choice; method selection is not proof of payment. | 2026-07-23 (consolidated) | Additional Decisions: Payment method and payment status; Unpaid served Order |
| ELM-08 | Order Cancel | Decided | Cancel, never physically delete; only before production starts and before payment is confirmed. | 2026-07-23 (consolidated) | Additional Decisions: Order cancellation |
| ELM-09 | Kitchen Behavior | Decided | During pause, Kitchen may finish existing unresolved Orders but receives no new Orders. | 2026-07-23 (consolidated) | Original Question 3 |
| ELM-10 | POS Behavior | Decided | During pause, keep an unsent cart locally and revalidate central state after resume; never silently submit stale items. | 2026-07-23 (consolidated) | Original Question 2 |
| ELM-11 | Current Event Header | Decided | Current Event identity, status, date, and time are the shared Back Office context shown before page-level work. | 2026-07-23 (consolidated) | Additional Decisions: Back Office hierarchy |
| ELM-12 | Catalog Responsibility | Decided | Catalog remains global and owns product/category/price/published version; Event snapshots do not update automatically. | 2026-07-23 (consolidated) | Current Verified Model: Product snapshot model; Original Question 8 |
| ELM-13 | Inventory Responsibility | Decided | Operations owns Event allocations, remaining quantity, reservations, safety buffer, and adjustment boundaries. | 2026-07-23 (consolidated) | Current Verified Model: Current quantity model; Original Questions 5-7 |
| ELM-14 | Statistics Responsibility | Decided | Statistics presents central committed values as preparation, sold, waste, retained/remaining; empty values show `0` or `NT$0`. | 2026-07-23 (consolidated) | Original Question 9; Additional Decisions: Numeric empty state |
| ELM-15 | Event Analysis Responsibility | Pending | Event Analysis is selected-Event context, but its historical comparison scope and measures have not been decided. | — | Additional Decisions: Back Office hierarchy; Deliberately Deferred |
| ELM-16 | System Status Responsibility | Decided | System and device information is system-wide, not owned by or mutable through the selected Event. | 2026-07-23 (consolidated) | Additional Decisions: Back Office hierarchy |

### Original Open Questions: Resolved

| Original question | Consolidated Owner decision | UX / operational consequence |
| --- | --- | --- |
| 1. May `paused -> closed` be allowed? | Yes. A paused Event may enter the existing formal close flow directly. | Close still requires confirmation, unresolved-order handling, audit, daily snapshot, and idempotency. There is no second close route. |
| 2. What happens to unsent POS carts during pause? | Preserve the cart locally for staff convenience, then revalidate it from central state after resume. | A stale cart must never silently submit. Invalid or sold-out items require clear feedback. |
| 3. May Kitchen advance existing Orders while paused? | Yes, for Orders that existed before pause and are still unresolved. | POS accepts no new Order. Kitchen may complete its existing production work but receives no new Order. |
| 4. Which reasons are mandatory for a negative adjustment? | A normal quantity adjustment requires no mandatory reason. Waste is a separate explicit closeout action. | Do not burden an operator with a reason field for ordinary preparation corrections. Waste must remain distinguishable from ordinary adjustment. |
| 5. Is adjustment one item per action or a batch? | Use one confirmed page-level batch save. | All editable rows validate together; the UX must never imply partial success. |
| 6. How is a duplicate adjustment identified? | A repeat of the same page save is treated as the same operator action. | Retry, reconnect, or double-click must not create a second adjustment or second audit effect. The implementation identity mechanism is deferred. |
| 7. What lower bound governs a negative adjustment? | Never reduce a product below `soldQuantity + reservedQuantity`. | No override path is allowed in normal Back Office operation. |
| 8. May an existing Event product use a newer Catalog version? | Never automatically. A manual replacement may be considered only while Draft or Paused and only when the Event product has no sold or reserved quantity. | Existing Event and Order snapshots remain immutable. |
| 9. How should Statistics display adjustment reasons and waste? | Daily operator presentation uses preparation, sold, waste, and retained/remaining. | Ordinary adjustment reasons are not a primary report surface. Waste is shown separately. |
| 10. Who is the operator before formal authentication exists? | Use the fixed operator value `Owner`. | No account or authentication system is introduced by this model. |

**Original Open Questions remaining:** `0`.

### Additional Decisions Made During Review

These items arose after the original ten questions. They are recorded here so they do not become undocumented workflow assumptions.

| Topic | Consolidated decision |
| --- | --- |
| Daily Event presentation | The daily operating states are Draft, Open, Paused, and Closed. `archived` remains a separate management state and is not presented as Closed. |
| Back Office hierarchy | Current Event is the highest Back Office context. Event selection appears before page navigation. Stock, Today Statistics, and Event Analysis use that selected Event. Product Catalog remains global; System/Device data remains system-wide. |
| Closeout and waste | `End Today's Sales` opens closeout; it does not immediately close an Event. The operator reviews each product's remaining quantity, waste (default `0`), and retained quantity before formal close. |
| Retained quantity | Retained quantity is a closeout snapshot only. It does not automatically carry into the next Event or become a Cost/Inventory transfer. |
| Payment method and payment status | POS selects the intended payment method while creating an Order. At service completion, the operator explicitly chooses Confirm Received or Not Yet Received. Selecting a method is not proof of payment. |
| Unpaid served Order | A served but unpaid Order remains visibly pending collection and cannot be silently treated as complete or ignored by closeout. |
| Order cancellation | The operator uses Cancel Order, never physical deletion. It is limited to an Order that is not yet in production and has not had payment confirmed. Historical identity and audit remain intact. |
| UI operating surfaces | The required high-level surfaces are: Event control, Stock, Product Catalog, Today Statistics, Event Analysis, System/Device; POS ordering; active Orders; served Orders; Kitchen; closeout/waste confirmation. |
| Numeric empty state | Operator-facing statistics display `0` or `NT$0`, never `null`. |

### Deliberately Deferred to the Next Decision Matrix

The following are implementation-design questions, not unresolved operating-policy questions. They require a later scoped Decision Matrix and Approval Record before any implementation:

- exact batch-save request identity and persistence shape;
- exact Operations adjustment/waste record structure and additive migration analysis;
- formal route/request/response contracts for pause, resume, batch save, closeout, payment confirmation, Order edit, and cancellation;
- transaction boundaries, concurrency response, audit payload shape, and test matrix;
- the authoritative Read Model layer responsible for converting absent numeric aggregates to `0`.

## Purpose

This proposal addresses a real food-truck operating gap: an Event currently becomes operationally locked after it is opened, so an operator cannot formally replenish sellable quantity, correct a count, alter a safety buffer, or add an already-published item during service.

This document is analysis and a decision proposal. It creates no state, API, table, migration, UI behaviour, or implementation approval.

## Current Verified Model

### Event state machine today

Current implementation defines these internal Event states:

```text
draft -> open -> closed
draft -> archived
closed -> archived
```

- `draft -> open` requires at least one positive sellable allocation.
- There may be only one `open` Event (database unique index).
- `closeEvent()` is a separate formal lifecycle path. It requires explicit `confirmed: true`, no unresolved Orders, creates an idempotent daily report, writes an audit record, then changes `open -> closed`.
- `archived` is allowed only from `draft` or `closed`; it is distinct from closing.
- `setSellableInventory()` is currently legal only while the Event is `draft`.

Current UI Chinese labels must be treated as a presentation concern. The proposal uses these required terms if approved:

| Internal state | Required UI term |
| --- | --- |
| `draft` | 草稿 |
| `open` | 營業中 |
| `paused` | 暫停 |
| `closed` | 已結束 |

`archived` must not be translated as `已結束`. Its UI wording is deferred; the UI may omit it until a later decision.

### Current quantity model

The Operations allocation currently has:

```text
plannedQuantity
reservedQuantity
soldQuantity
safetyBufferQuantity
remainingQuantity = plannedQuantity - reservedQuantity - soldQuantity
customerAvailableQuantity = max(0, remainingQuantity - safetyBufferQuantity)
```

`plannedQuantity` and `safetyBufferQuantity` are overwritten by the existing draft-only upsert. There is no adjustment ledger. POS Order creation updates sold allocation inside an immediate Operations transaction and preserves the non-negative allocation invariant.

### Current product snapshot model

When draft inventory is configured, Operations copies Product Contract v2 into `operations_product_copies` and binds inventory to `productVersionId`. An OPEN Event reads Operations-owned copies rather than Catalog internals. Orders separately preserve item name and price snapshots.

### Current audit capability

`audit_logs` is append-only by convention and stores actor user ID, entity type/ID, action, before JSON, after JSON, and timestamp. Existing lifecycle code writes audit events for production changes, no-show, inventory release, event close, and closeout changes. It does not yet define the Event adjustment actions proposed below.

## Principle

> Event Contract 在開始營業後不可變；Event Operation 在營業期間可透過正式流程調整，所有調整必須留下 Audit。

### Event Contract: immutable after 開始營業

The contract is the frozen selling meaning for the Event:

- selected Product Contract snapshot: product ID, product version ID, names, price, category display snapshot, channels, published information, and contract version;
- the Event's selected product set at the time each item is added;
- existing Order and Order Item snapshots;
- any order price, quantity, customer, payment, and production history already recorded.

An operational adjustment must never rewrite an existing Order, existing Order Item snapshot, historical product snapshot, historical price, or completed daily report.

### Event Operation: adjustable only through formal flow

Operations may need to change while the truck is operating:

- Event operational status;
- sellable quantity adjustments and safety-buffer adjustments;
- adding an existing formally-published Catalog product to the Event while paused;
- future operational notes or reasons where separately approved.

Operation is not permission to mutate Catalog. It is also not permission to create a new product, publish a draft, alter Product Contract content, or change an order after creation.

## Historical Pre-Consolidation Analysis

The following sections preserve the original analysis and alternatives. Where they conflict with **Decision Consolidation**, the consolidation section takes precedence. They are not implementation approval.

### 1. Proposed Event states and transitions

```text
draft  --開始營業-->  open
open   --暫停調整-->  paused
paused --恢復營業-->  open
open   --結束今日販售--> closed
paused --結束今日販售--> OPEN QUESTION

paused -> draft: forbidden
closed -> any: forbidden
draft -> closed: forbidden
```

Rules proposed for `paused`:

- POS and Kitchen must not accept or advance new operational work while paused.
- Every approved Back Office adjustment must commit successfully before the Event is resumed.
- There must be no partial page state: POS, Kitchen, and Back Office re-fetch central data after a committed transition or adjustment.
- During pause, unsent POS carts are preserved locally but must be revalidated after resume; Kitchen may finish already-existing unresolved Orders and must not receive new work.

### 2. Add an existing published Catalog product during `paused`

While an Event is paused, an operator may add an existing formally published Catalog product version to that Event.

It must:

- obtain the existing Product Contract through the approved Catalog publication boundary;
- create an Operations-owned snapshot for that product version;
- create the Event allocation through the Operations service;
- require a non-negative opening quantity and a valid safety buffer;
- write audit data;
- leave all existing Event snapshots and all existing Orders unchanged.

It must not:

- create a Catalog product;
- publish a Catalog draft;
- change Catalog price, content, channels, or category;
- bypass Product Contract validation;
- update an already selected Event product's frozen contract.

### 3. Quantity adjustment is append-only

The proposal is to retain the initial preparation quantity and append adjustments rather than overwrite history:

```text
initial preparation + sum(approved positive and negative adjustments) = current sellable basis
remaining = current sellable basis - reserved - sold
customer available = max(0, remaining - current safety buffer)
```

The historical reason must distinguish at least: restock, decrease, waste, and count correction. This does not create the Cost/Waste domain. It merely keeps Operations history compatible with a future separately-approved Cost or Waste flow.

### 4. `archived` remains independent

`closed` means the selling operation has ended through the formal close flow. `archived` is a separate management/preservation concept. This proposal does not enable, redesign, or add an Archive workflow. It must not assume archive never exists.

## Alternatives Considered

### A. Keep the current full lock after OPEN

**Strengths**

- Simple state model and small attack surface.
- Strongly protects the product snapshot and makes live quantities stable.
- Existing draft-only validation is easy to reason about.

**Limits for a real food truck**

- A one-person operator cannot record a mid-service restock or a counting correction.
- A newly prepared, already-published dish cannot be offered without ending the operational flow.
- Operators may resort to untracked manual notes or informal workarounds.

**Protections to retain even if changed**

- one OPEN Event;
- Product Contract snapshot isolation;
- transactional non-negative allocation;
- immutable existing Orders and price snapshots;
- formal Event Close and idempotent daily report;
- append-only audit.

### B. Overwrite `plannedQuantity`

**Strengths**

- Minimal screen and database work.
- Mirrors the current draft-only upsert.

**Risks**

- Loses the difference between original preparation, restock, waste, and count correction.
- Makes an audit unable to explain why availability changed.
- Makes later statistics, Cost, and waste reconciliation less trustworthy.
- Creates ambiguous concurrent updates because the last write hides the prior value.

### C. Adjustment model - recommended proposal

**Strengths**

- Preserves initial preparation and each later change.
- Gives one traceable calculation for current sellable basis and remaining quantity.
- Supports audit, concurrency checking, statistics, and future Cost/Waste compatibility without making Cost a dependency now.
- Fits central SQLite as the single operational truth.

**Costs**

- Requires a new state, persistence design, formal APIs, migration, transaction rules, focused UI, and broad tests.
- Requires Owner decisions on reasons, limits, pause behaviour, and operator confirmation.

### D. Allow direct micro-adjustments while OPEN

**Strengths**

- Fastest operator interaction.
- Avoids a visible pause/resume step.

**Risks**

- POS and Kitchen may read a changing product set or quantity while an order is created or produced.
- Multi-device timing makes confirmation, user feedback, and conflict handling harder.
- It weakens the operator's explicit "adjustment window" and increases accidental changes during service.

This proposal does not declare D rejected. It records why the paused gate is the safer proposal for the current one-person, multi-device Shadow Run context.

## Constitution and Accepted ADR Compatibility Review

| Authority | Summary | Alignment / hard conflict | Required action before implementation |
| --- | --- | --- | --- |
| `CONSTITUTION.md` | Separate ownership, no hidden architecture changes, central truth, Owner approval. | Compatible only if Operations remains the owner and Catalog is read through Product Contract. A new `paused` state and adjustment persistence are business-rule and schema changes. | New explicit Owner Decision and compatibility checklist are required. |
| ADR-013 Event Product Snapshot | OPEN Event reads Operations snapshots; Catalog republish cannot change it. | Compatible only if adding during pause copies an existing published version without refreshing any existing Event item. Updating a selected product's price/name/channel would be a hard conflict. | Define add-only snapshot behaviour; do not revise ADR-013 unless Owner explicitly changes snapshot policy. |
| ADR-015 Quantity Lifecycle | Counter changes are transactional and preserve non-negative remaining quantity. | Compatible only if every adjustment is transactional and cannot reduce a basis below reserved plus sold, or leave invalid safety behaviour. Overwriting quantity without traceability would weaken the intent. | Decide lower-limit policy and idempotency/concurrency semantics. An ADR-015 clarification may be needed if the accepted wording is not sufficient. |
| ADR-018 Sales Contract | Emit exactly once only when Order becomes completed. | Compatible: Event quantity adjustments must not emit, replay, cancel, or alter Sales Contracts. Cost cannot be called from this flow. | No revision required unless a future Cost/Waste flow is separately proposed. |

No implementation may proceed if it needs to alter Order completion, Sales Contract emission, Catalog ownership, Product Contract contents, or direct Cost access. Those are hard blockers, not implementation details.

## Data Model Analysis (not a schema decision)

### State

Adding `paused` requires an Event-status type change, state-machine validation, database-compatible status handling, UI translation, and migration analysis. Existing `archived` must remain separately representable.

### Quantity history choices

**Minimal change option**: retain `plannedQuantity` as the current mutable basis and rely on `audit_logs` for adjustment history.

- Pro: fewer tables.
- Con: calculations depend on generic JSON audit entries; reporting and concurrency reconstruction are fragile; the current field no longer truthfully means "initial preparation".

**Traceable option**: retain an initial preparation value and append Operations-owned inventory adjustment records.

- Potential fields to analyse, not approve: adjustment ID, Event ID, product/version reference, signed delta, reason, before/after basis or version, operator attribution, idempotency key, occurred time, and audit-log reference.
- Pro: explicit history, better reporting, idempotency, and future compatibility.
- Con: additive migration, new repository/service logic, and stronger tests.

### Quantities and lower limits

Any implementation must define one central formula and reject unsafe changes. At minimum, an adjustment cannot make the quantity basis lower than `reservedQuantity + soldQuantity`; safety-buffer changes must remain non-negative and fit the selected basis. Frontends must never calculate or persist an alternative remaining quantity. The exact persistence and request design remains deferred to the Decision Matrix.

### Concurrency

The current order path uses an IMMEDIATE transaction and conditional update. The adjustment path must have an equivalent transaction boundary, authoritative reread, lower-bound validation, and conflict response. It must protect against a POS order, release, or another Back Office adjustment racing the same product.

## Proposed API Surface (analysis only)

The following names are not approved APIs. They describe the minimum shape any implementation must specify before coding.

| Operation | Candidate method/path | Required request concerns | Required response / error concerns |
| --- | --- | --- |
| Pause Event | `POST /api/admin/events/:eventId/pause` | operator attribution; explicit confirmation policy | returns current Event; rejects non-OPEN Event and concurrency conflict; emits `event.paused` only after commit |
| Resume Event | `POST /api/admin/events/:eventId/resume` | operator attribution; must verify no incomplete adjustment transaction | returns current Event; rejects non-PAUSED Event; emits `event.resumed` only after commit |
| Inventory adjustment | candidate event-product action endpoint | signed delta, reason, idempotency key, operator, optional human note | returns central inventory view and adjustment identity; rejects invalid reason, duplicate key, lower-bound breach, paused-state violation, and concurrent change |
| Safety update | candidate event-product action endpoint | new safety value or explicitly-defined delta, operator, idempotency rule | rejects negative or unsafe result; returns central inventory view; writes audit |
| Add published item while paused | candidate Event inventory endpoint/action | `productVersionId`, initial quantity, safety buffer, operator, idempotency key | validates formal publication and Product Contract; rejects duplicate Event product unless an explicit existing-item rule is approved |

For every action, the final design must specify: request schema, response schema, idempotency, transaction boundary, audit action, error codes, current operator attribution, SSE notification name, and REST re-fetch behaviour. No endpoint may become a second inventory write path.

## UI / Workflow Analysis

### Back Office

Back Office owns the operator controls: `開始營業`, `暫停調整`, `恢復營業`, and `結束今日販售`. It should display central state and committed adjustment history; it must not perform quantity math independently.

### POS

POS must derive its ability to create Orders from the central Event state and current REST read model. During `暫停`, whether it keeps an unsent cart, clears it, or permits review-only display is unresolved. It must never silently submit a stale cart after resume.

### Kitchen

Kitchen continues to own only `productionStatus`. The treatment of existing queued/preparing/ready Orders during `暫停` is unresolved. It must not use pause as permission to edit price, product, allocation, payment, or Event lifecycle.

### Statistics

Statistics is read-only central data. It must reflect committed adjustments through the authoritative Operations read model, not through duplicated browser state. The reporting treatment of restock, waste, and count correction is an Open Question.

## Required Audit Events (proposal)

The following action names are proposed for an append-only audit trail:

- `event_paused`
- `event_resumed`
- `inventory_adjusted`
- `safety_buffer_adjusted`
- `event_product_added_during_pause`

Each needs analysis of: event ID, product/version when relevant, operator identity, timestamp, reason, idempotency identity, before/after values or enough information to reconstruct them, and correlation to any dedicated adjustment record. Current audit storage can record general metadata, but this document does not claim it already supports the complete required model.

## Conflict Scenarios That Must Be Designed Before Coding

1. An adjustment would reduce the quantity basis below sold or reserved quantity.
2. An adjustment would leave an invalid safety-buffer relationship.
3. POS creates an Order while pause is requested.
4. Two Back Office devices adjust the same item concurrently.
5. The same adjustment request is submitted twice.
6. A published item is added during pause and resume is pressed before all work commits.
7. One adjustment in a batch fails after another has succeeded.
8. Kitchen has queued, preparing, ready, or served Orders while the Event is paused.
9. A stale POS/Kitchen/Statistics read model receives only an SSE notification.
10. A closed Event is targeted by a late adjustment or retry.

Each outcome must be central, transactional where needed, auditable, and re-fetched by clients. No screen may maintain a second source of truth.

## Test Strategy Required Before Acceptance

- Event state-machine unit/integration coverage for every allowed and forbidden transition.
- Adjustment tests for positive, negative, restock, waste, count correction, safety changes, limits, and idempotent retry.
- Concurrent POS order versus pause/adjustment and concurrent adjustment versus adjustment coverage.
- Snapshot tests proving a new paused addition copies the selected published Product Contract while existing Event and Order snapshots do not change.
- Frontend tests for central refresh and state-aware UI, including no partial UI after rejected action.
- Migration smoke and data-preservation tests if any schema/state change is selected.

## Explicit Exclusions

This proposal does not approve or include:

- multiple simultaneous OPEN Events;
- direct Catalog creation or publishing from Event controls;
- changing a Catalog product or any existing Event snapshot during service;
- changing existing Order price, quantity, or history;
- automatic adjustment selection;
- AI preparation, forecast, or Kitchen Copilot;
- Cost Domain, Waste Domain, BOM, or Cost integration;
- Sales Contract changes;
- payment work;
- formal authentication/authorization;
- an Archive workflow;
- a new Customer/Kiosk/Preorder flow.

## Original Open Questions Index

All ten original Open Questions are resolved in **Decision Consolidation**. This table is retained only as an index to the original concerns; it is not a second decision list.

| Question | Consolidated result |
| --- | --- |
| 1. May `paused -> closed` be allowed? | Yes, through the same formal close flow. |
| 2. What happens to unsent POS carts during pause? | Preserve locally, then revalidate from central state after resume. |
| 3. May Kitchen advance existing Orders while paused? | Yes, existing unresolved Orders only. |
| 4. Which reasons are mandatory for a negative adjustment? | No mandatory reason for ordinary adjustment; waste is separate closeout action. |
| 5. Is adjustment always one item per action or may it be a batch? | One confirmed page-level batch save. |
| 6. How is a duplicate adjustment identified? | Repeat page save represents one operator action; exact mechanism deferred. |
| 7. What lower bound governs a negative adjustment? | Never below `soldQuantity + reservedQuantity`; no normal override. |
| 8. May an existing Event product be re-added with a newer Catalog version? | Never automatically; manual replacement only under the consolidated safeguards. |
| 9. How should Statistics display adjustment reasons and waste? | Preparation, sold, waste, retained/remaining; waste separate. |
| 10. Who is the operator before formal authentication exists? | Fixed `Owner`. |

## Future Compatibility Only

An append-only Operations adjustment history may later support separately approved Cost/Waste reporting, prep forecasting, AI suggestions, or a Kitchen copilot. This proposal does not define, approve, or implement any of those capabilities.

## Decision Needed

The operating-policy questions have been consolidated. Before any implementation, Miles must review the next Decision Matrix and explicitly approve the resulting state, API, schema, migration, and test scope.
