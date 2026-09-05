# POS Order Replacement and Payment Adjustment Architecture Plan

## Constitution Compatibility Gate

- **Approval record**: DECISIONS #096.
- **Reviewed authority**: Constitution v3; ADR-001, ADR-002, ADR-003,
  ADR-014, ADR-015, ADR-016, ADR-017, and ADR-018; DECISIONS #004, #007,
  #010, #012, #013, #087, #088, #089, and #095.
- **Compatibility result**: PASS for architecture documentation. Operations
  retains exclusive Order, Payment, sellable-quantity, Kitchen-progression,
  closeout, and operational-evidence authority. The design adds neither a
  physical Inventory domain nor a Waste domain, a second Order/Payment path,
  cross-domain table access, or browser authority.
- **Implementation gate**: CLOSED. This document, the migration plan, and Task
  Cards authorize no source or migration implementation until the Independent
  Architecture Review passes and the Owner separately authorizes PR 1.

## 1. Purpose and present capability

The current system can correct an unresolved scheduled Order in place only
before production advances, can confirm one positive Payment, and can release
inventory only through its existing cancellation/no-show policy. It has no
replacement chain, modification intent, supplement/refund evidence, or
per-intent reservation identity. Those gaps make an apparently simple paid or
started Order edit unsafe.

The approved solution preserves the original Order as history and creates a
new effective replacement Order only after all frozen changes can be committed.
It keeps three ledgers separate:

1. **Order ledger** — what the customer will finally receive.
2. **Payment ledger** — what was originally collected and what was later
   supplemented or refunded.
3. **Finished-item disposition ledger** — how much removed prepared food was
   returned to sellable quantity and how much was not.

## 2. Scope and non-goals

In scope:

- onsite and scheduled Orders in the current Event;
- add, remove, or change Order lines and Kitchen-visible notes;
- immutable replacement history with one effective Order per chain;
- server-authoritative price difference and Cash/LINE Pay adjustment evidence;
- temporary reservation of only positive quantity deltas;
- explicit removed-item return/not-return disposition;
- cross-device recovery after interruption;
- Kitchen, voice, reminder, closeout, and Daily Report correctness.

Not in scope:

- provider API settlement, automated LINE Pay inquiry/refund, tax, accounting,
  tips, discounts redesign, split tender, or partial line settlement;
- a Customer, physical Inventory, or Waste domain;
- waste valuation, Cost writes, a mutable waste workflow, or historical
  backfill;
- Catalog, Recipe, Cost, Event-product snapshot, or Sales Contract redesign;
- direct SQLite repair, UAT data edits, deployment, or infrastructure changes.

## 3. Identity and effective-order projection

`orderId` remains immutable. A confirmed correction creates a new Order with a
new internal Event order number and one immutable replacement edge:

```text
root order -> replacement revision 2 -> replacement revision 3
                                         ^ effective order
```

- An Order without an edge is its own lazy root and revision 1. Existing rows
  are never backfilled.
- One root may have only one effective, non-superseded member.
- A replacement edge has exactly one superseded Order and one replacement
  Order. An Order cannot be the replacement or superseded member of two edges.
- The public/operator pickup label is the root Order number. Replacement Orders
  keep their new internal number for identity/audit but screens show the stable
  pickup number plus `已修改`.
- Reads, totals, Kitchen queues, closeout, and statistics include only the
  effective member. Superseded members remain retrievable as history and never
  emit a second Sales Contract.
- Deleting all lines follows whole-Order cancellation policy; an empty
  replacement Order is invalid.

### Eligible effective Orders and production mapping

- The effective Order must belong to the current `open` or `paused` Event and
  have `orderStatus = confirmed`. Cancelled and completed Orders are historical
  and cannot enter this workflow.
- `not_started`, `queued`, `preparing`, and `ready` Orders may be prepared.
  `served` must first use the existing authorized completion-reversal workflow
  where that workflow is eligible; it cannot be silently pulled back by an
  edit. A production-content change to `ready` confirms as `preparing`; other
  eligible states retain their current production progress.
- Deleting the final line freezes the outcome as whole-Order cancellation.
  Confirmation cancels the effective Order, handles any refund and disposition
  through the same intent, and creates no empty Order or replacement edge.

## 4. Frozen modification proposal

Prepare computes and persists a complete immutable proposal from the current
effective Order and its expected revision:

- root and effective Order identities;
- before and proposed after snapshots for header, lines, quantities, prices,
  notes, pickup time, payment method, and production state;
- authoritative old total, new total, direction (`none`, `supplement`, or
  `refund`), and exact amount;
- outcome kind (`replacement` or whole-Order `cancellation`) and payment basis
  (`unpaid` or `paid`);
- positive item deltas to reserve;
- removed quantities and proposed returned/not-returned disposition;
- actor, device, creation time, idempotency key, request fingerprint, and CAS
  revision.

The browser submits desired content and disposition but does not calculate
authority. Operations resolves Event-frozen Product/price snapshots, totals,
availability, and payment difference. Once prepared, content, amount, method,
reservation, and disposition are frozen. The only way to alter them is to
cancel an eligible `prepared` intent and create a new intent.

Unchanged and decreased lines retain their original Event Product/version/price
snapshot and do not fail merely because the Product was later disabled. New or
increased quantities must be sellable now and have enough current quantity.

## 5. Intent state machine

The word `confirmed` below always means `intent.confirmed`; it is not the Order
status with the same token.

| State | Meaning | Allowed exits | Timeout |
| --- | --- | --- | --- |
| `prepared` | Frozen proposal exists; positive deltas are reserved; no external money action has started | `external_in_progress`, `confirmed` when no external action is needed, `cancelled`, `expired` | Ten-minute lease; renewable |
| `external_in_progress` | Operator has begun or is about to begin external Cash/LINE Pay action | `confirmed`, `cancelled` only after proof money did not move, `reconciliation_required` | Never |
| `reconciliation_required` | Whether external money moved cannot be safely established or Phase B failed after it may have moved | `confirmed` after proof it moved, `cancelled` after proof it did not | Never |
| `confirmed` | Replacement/payment/inventory/disposition transaction completed | terminal | Never |
| `cancelled` | Authorized cancellation released exact held quantities | terminal | Never |
| `expired` | Server expired an untouched `prepared` lease and released exact held quantities | terminal | Never |

### Transition invariants

- Exactly one nonterminal intent may exist for a root chain.
- Every transition uses intent ID, expected intent CAS revision, canonical
  request fingerprint, and trusted actor/device context.
- Same idempotency key plus same fingerprint replays the stored result. Same key
  plus different fingerprint fails closed with zero writes.
- `prepared -> expired` is server-authoritative and valid only when server time
  exceeds `expiresAt`. It atomically releases the intent's reservation rows.
- A visible preparation/recovery screen may renew no more often than once every
  30 seconds. Renewal increments the CAS revision and sets `expiresAt` to server
  time plus ten minutes. It is not a browser-owned lock.
- Advancing to `external_in_progress` occurs before asking the operator to
  perform the external action. That state can never auto-expire.
- `external_in_progress -> cancelled` requires explicit proof/attestation that
  no money moved. Cash accepts authorized actor attestation; LINE Pay requires
  external transaction-status verification under the available manual contract.
- `reconciliation_required` exits only through the same two evidence outcomes:
  money moved -> `confirmed`; money did not move -> `cancelled`.
- Terminal states cannot reopen. A new modification starts from the newly
  effective Order only after the prior intent is terminal.

## 6. Lock matrix

While any intent is nonterminal, the root chain rejects:

- a second prepare, any direct correction, cancellation, or no-show command;
- Order completion;
- Kitchen `not_started/queued -> preparing`, `preparing -> ready`,
  `ready -> served`, completion reversal, or any other production transition;
- payment confirmation outside the intent protocol;
- Event closeout save, Event Close, and Daily Report freeze.

The lock is read from central SQLite by every relevant Application command. It
is not held in memory and survives browser, device, process, and session loss.
Read-only review and recovery remain available to authorized operators.

## 7. Inventory reservation and confirmation

Prepare runs in one immediate transaction:

1. Resolve the current effective Order and expected revision.
2. Reject an existing nonterminal intent.
3. Validate proposed lines and Event-frozen snapshots.
4. Calculate per-version old/new deltas.
5. For each positive delta, atomically verify remaining sellable quantity and
   increment the existing `reserved_quantity` aggregate.
6. Insert matching per-intent reservation evidence.
7. Insert the frozen intent and lines.

Negative deltas are not released during prepare. Cancel/expiry decrements only
the exact still-held positive reservation rows. Confirmation atomically:

- converts positive reserved deltas into sold quantity;
- applies decreases only according to frozen disposition;
- creates the new replacement Order and item snapshots;
- supersedes the old effective Order;
- writes adjustment and disposition evidence;
- marks the intent confirmed.

Every check and write above succeeds or the SQLite transaction writes nothing.
This database atomicity does not and must not claim to roll back Cash or LINE
Pay actions already performed outside SQLite.

## 8. Payment adjustment protocol

Let `original collected` be the effective chain's confirmed net Payment
evidence, including prior immutable adjustments. Let `new total` be the
server-calculated replacement total (zero for whole-Order cancellation).

An unpaid Order does not require a supplement merely because its new total is
positive: it remains unpaid and the new total is collected later through the
existing payment flow. Its adjustment direction and amount are `none` and zero.
Only a fully `paid` Order enters the difference calculation below. Existing
`pending`, `failed`, `partially_refunded`, or `refunded` states fail closed in
this first program and require separate reconciliation rather than inference.

```text
difference = new total - original collected
positive   = supplement
negative   = refund
zero       = no external adjustment
```

The intent freezes method, direction, and absolute amount. A refund uses the
original confirmed payment method. A supplement may use the operator-selected
supported method (`CASH` or `LINE_PAY`) validated at prepare. Mixed-tender
settlement is outside the current contract and fails closed. The UI cannot
override any frozen value during confirmation.

### No external action

If money has not yet been collected or the paid difference is zero, confirmation may
perform replacement, inventory, audit, and any internal payment projection in
one SQLite transaction.

### External action required

1. Prepare and reserve.
2. Advance the original intent to `external_in_progress`.
3. Operator performs exactly the displayed Cash or LINE Pay action.
4. Record evidence using the original intent ID and idempotency key.
5. Run the Phase B SQLite transaction.

Cash evidence contains actor attestation, exact amount, direction, and time.
LINE Pay evidence contains the external reference accepted by the approved
manual contract; a unique constraint prevents its reuse for another confirmed
adjustment. Provider settlement truth remains out of scope.

If step 5 fails after money may have moved, the intent becomes or remains
`reconciliation_required`. Retrying Phase B with the same evidence is safe and
cannot create a second adjustment.

## 9. Cross-device recovery UX

Any authorized POS/Admin opening an unfinished intent sees a server-rendered or
API-backed recovery view with:

- pickup number and intent state;
- before/after modification summary;
- original collected amount, new total, supplement/refund amount, and method;
- original operator and intent creation time;
- every held Product and quantity.

Only three decisions are offered:

### A. 尚未實際收款／退款

Require explicit confirmation. Cash records actor attestation. LINE Pay requires
the operator to verify the external status. Only then may the server cancel the
same intent, release its reservations, unlock the chain, and append reasoned
audit evidence.

### B. 已經完成收款／退款

Use the same intent and idempotency key. Record Cash actor/amount/time or the
accepted LINE Pay external reference, then resume Phase B. The UI must never ask
the operator to collect or refund again.

### C. 無法確認

Move to `reconciliation_required`, retain all reservations and locks, and show:

> 款項狀態尚待核對，請勿再次收款或退款。

No new Order, intent, direct SQLite change, cancellation, Kitchen transition,
or closeout may bypass this state. Another authorized POS/Admin may later
resolve the same server-side intent.

## 10. Production content and disposition

The current single Order note is visible in Kitchen and is classified as
production content. A change to items, item notes, or this Order note on a
`ready` effective Order creates a replacement whose production state is
`preparing`. A future model may separate customer/internal notes only under a
separate Decision.

For every decreased/removed line, the operator must allocate:

```text
removed quantity = returned-to-sellable + not-returned
```

Both quantities are non-negative integers. The relation is checked server-side.
Not-returned food creates immutable disposition evidence and never returns to
availability. This evidence contains no value, cost, mutable `consumed` flag,
or Waste status. A future Waste table can hold its own immutable fact and a
unique foreign-key reference to the disposition identity.

## 11. Events, voice, reminders, and closeout

- Confirm emits one `order.modified` business event identified by root,
  effective revision, and event type. It is emitted only after commit.
- New Order voice uses `root + revision + new-order`; modified voice uses
  `root + revision + order-modified`. A modified Order is announced once as
  `訂單 001 已修改`, not replayed as a complete new Order.
- SSE replay/reconnect may redeliver transport data but consumers deduplicate
  the same business identity.
- A pickup-time change invalidates the old reminder key and schedules the new
  time only after confirmation. Nonterminal proposals emit no final voice or
  reminder change.
- Daily and Event queries resolve each root to one effective Order. Superseded
  rows are excluded from counts, totals, unresolved gates, and Sales Contract
  emission.
- Closeout expected Cash/LINE Pay receipts use immutable original paid evidence
  plus supplements and minus refunds for that method. Adjustments never rewrite
  an original Payment row. The closed Daily Report pins these net method totals
  and their reconciliation evidence.
- Any nonterminal intent blocks closeout save, Event Close, and the immutable
  Daily Report snapshot. No reconciliation exception may override this gate.

## 12. Authorization and error boundary

- Only authenticated `admin` and `pos` roles may prepare, recover, cancel, or
  confirm modification intents. Kitchen may view a locked indicator but cannot
  modify an intent or Payment evidence.
- Trusted server-side actor injection overrides all caller-supplied actor fields.
- Existing CSRF, canonical-origin, Secure/HttpOnly/SameSite session, request
  bounds, safe errors, strict schema, and audit rules remain mandatory.
- Conflict, stale revision, expired lease, stock shortage, frozen-content
  mismatch, reused external reference, incomplete disposition, and active lock
  all fail closed with zero unintended writes.

## 13. Delivery decomposition

```text
PR-OPERATIONS-004
Pending intent + replacement persistence, lazy-root projection,
reservation/lock/state machine, migration and application contracts
          |
          v
PR-OPERATIONS-005
Payment adjustment evidence, recovery/reconciliation, closeout/report gates,
finished-item disposition
          |
          v
PR-OPERATIONS-006
POS/Kitchen workflow, voice/reminders, responsive UX and complete E2E
```

Each PR must keep integration buildable and testable. PR 2 cannot start until
PR 1 is merged; PR 3 cannot start until PR 2 is merged. The exact implementation
allowlist is frozen in each Task Card before its PR begins.

## 14. Required verification matrix

The implementation program must prove:

- lazy-root behavior for old Orders and one effective member per chain;
- no historical backfill and no rewriting original Order/item/Payment rows;
- atomic prepare, exact positive reservation, cancel/expiry release, CAS, and
  concurrency safety across two POS clients;
- all Order/Kitchen/payment/closeout locks in every nonterminal state;
- no-difference/unpaid single-transaction confirmation;
- supplement/refund prepare, interrupted recovery, idempotent confirm, unique
  LINE Pay reference, and both reconciliation exits;
- external money handled but Phase B failure never resumes normal service and
  never requests money twice;
- explicit return/not-return math and immutable, uniquely referenceable evidence;
- ready production-content edit returns to preparing;
- effective-only POS, Kitchen, Daily Report, closeout, payment, and Sales
  Contract projections;
- stable pickup number, unique internal number, voice/event deduplication, and
  rescheduled pickup reminder;
- authentication/roles, CSRF, canonical origin, actor injection, strict schema,
  SSE reconnect, desktop/tablet UX, migration upgrade/restart/idempotency,
  architecture guards, typecheck, lint, build, full tests, Chromium E2E,
  repository collection, diff/text/encoding/secret checks.

## 15. Stop conditions

Stop before implementation if review finds that the design requires a second
Order/Payment authority, browser-owned truth, cross-domain persistence, mutable
Waste state, historical backfill, external-provider assumptions not represented
by the accepted contract, or a rollback claim that could erase/duplicate actual
money evidence. Stop deployment if any nonterminal intent exists.
