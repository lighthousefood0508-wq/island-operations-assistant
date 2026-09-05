# POS Order Replacement and Payment Adjustment Migration Plan

## Constitution Compatibility Gate

- **Approval record**: DECISIONS #096.
- **Reviewed authority**: Constitution v3; ADR-001, ADR-002, ADR-014 through
  ADR-018; DECISIONS #004, #007, #010, #012, #013, #087, #088, #089, and #095.
- **Compatibility result**: PASS for a forward-only Operations-owned design.
- **Execution status**: PLAN ONLY. No migration file is created by this Gate,
  no migration is executed, and no development or UAT database is opened.

## 1. Existing schema facts

The current schema already contains immutable Order/item snapshots,
`operations_sellable_inventory.reserved_quantity` and `sold_quantity`, positive
`operations_payments`, audit logs, Event closeout declarations, and immutable
Daily Report JSON. It does not identify a reservation by modification intent,
represent a replacement edge, preserve supplement/refund evidence, or record
finished-item disposition.

The future migration is additive. It must not alter, delete, backfill, or
recalculate existing `operations_orders`, `operations_order_items`,
`operations_payments`, sellable-quantity, closeout, closure, or audit rows.

## 2. Planned additive tables

Exact SQL and migration identity are deferred to PR-OPERATIONS-004 review. The
following logical shape is the approved minimum; implementation may adjust
physical naming only when the same invariants remain demonstrably enforced.

### `operations_order_modification_intents`

Durable state and frozen financial/content authority:

| Column | Constraint / meaning |
| --- | --- |
| `intent_id` | text primary key |
| `event_id` | non-null FK to `operations_events` |
| `root_order_id` | non-null FK to `operations_orders`; lazy root |
| `effective_order_id` | non-null FK to the Order revision used for prepare |
| `expected_effective_revision` | non-null text; current deterministic Order revision token |
| `state` | check: `prepared`, `external_in_progress`, `confirmed`, `cancelled`, `expired`, `reconciliation_required` |
| `intent_revision` | positive integer CAS token |
| `idempotency_key` | non-null unique |
| `request_fingerprint` | non-null canonical hash |
| `before_json`, `after_json`, `difference_json` | non-null bounded canonical evidence; server-produced, not browser authority |
| `original_collected`, `new_total`, `adjustment_amount` | non-negative integer currency units |
| `adjustment_direction` | check: `none`, `supplement`, `refund` |
| `adjustment_method` | nullable/check: `CASH`, `LINE_PAY`; required when amount > 0 |
| `payment_basis_status` | check: `unpaid`, `paid`; other current states are ineligible |
| `outcome_kind` | check: `replacement`, `cancellation` |
| `production_reset_required` | integer check 0/1 |
| `created_by`, `device_id`, `created_at` | trusted actor/device/time |
| `expires_at`, `last_renewed_at` | required only while prepared; server-time lease |
| transition timestamps/actors/reasons | nullable until the matching audited transition |

Header checks must couple direction and amount: `none` iff amount is zero;
supplement/refund iff amount is positive. An unpaid basis always has `none` and
zero even when `new_total` is positive; a paid basis derives adjustment from
net collected versus new total. A cancellation has `new_total = 0` and may have
no proposed item rows. Terminal timestamps must agree with terminal state.
`event_id`, root, and effective Order must be consistent at the
Application/persistence boundary; SQLite FKs alone do not prove that relation.

### `operations_order_modification_intent_items`

Normalized frozen proposed lines and snapshots:

| Column | Constraint / meaning |
| --- | --- |
| `intent_item_id` | text primary key |
| `intent_id` | non-null FK with delete restricted |
| `line_sequence` | non-negative integer; unique with intent |
| Product/copy/version identities | non-null governed Event snapshot identity |
| display/category snapshots | non-null frozen presentation facts |
| `quantity` | integer > 0 |
| unit list/selling price, discount, line total | non-negative server-calculated values |
| item note and cost/BOM compatibility snapshots | same compatibility semantics as current Order item |

The intent cannot contain duplicate governed Product-version lines. The table
is immutable after prepare.

### `operations_order_modification_reservations`

Identity for each positive delta mirrored into the existing aggregate counter:

| Column | Constraint / meaning |
| --- | --- |
| `reservation_id` | text primary key |
| `intent_id` | non-null FK with delete restricted |
| `event_id`, `product_id`, `product_version_id` | governed inventory key |
| `reserved_quantity` | integer > 0 |
| `status` | check: `held`, `committed`, `released` |
| created/terminal actor and time | append-only transition evidence |

Unique `(intent_id, product_version_id)` prevents duplicate release/commit
rows. State CAS plus the intent transaction prevents a quantity from being
released or committed twice. The aggregate and evidence transition together.

### `operations_order_replacements`

Immutable confirmed chain edge:

| Column | Constraint / meaning |
| --- | --- |
| `replacement_id` | text primary key |
| `intent_id` | non-null unique FK |
| `event_id`, `root_order_id` | non-null governed chain identity |
| `superseded_order_id` | non-null unique FK |
| `replacement_order_id` | non-null unique FK |
| `effective_revision` | integer > 1; unique with root |
| `reason`, `created_by`, `device_id`, `created_at` | non-null audit context |

Checks prohibit self-replacement. Application validation proves one Event and
one root. An active-chain uniqueness transaction plus expected revision ensures
only one concurrent replacement succeeds.

### `operations_payment_adjustments`

Immutable actual supplement/refund evidence, inserted only at successful Phase B:

| Column | Constraint / meaning |
| --- | --- |
| `payment_adjustment_id` | text primary key |
| `intent_id` | non-null unique FK |
| `root_order_id`, `effective_order_id` | non-null FKs |
| `replacement_order_id` | nullable FK; null only for whole-Order cancellation |
| `direction` | check: `supplement`, `refund` |
| `payment_method` | check: `CASH`, `LINE_PAY` |
| `amount` | integer > 0 |
| `external_reference` | nullable for Cash, required for LINE Pay |
| `idempotency_key`, `request_fingerprint` | non-null unique/replay evidence |
| `confirmed_by`, `device_id`, `occurred_at` | trusted immutable evidence |

A partial unique index on non-null LINE Pay `external_reference` prevents one
external transaction from confirming two adjustments. Amount, direction, and
method must equal the frozen intent; the Application service validates this in
the same transaction.

### `operations_order_item_dispositions`

Immutable evidence for decreased/removed quantities at replacement confirmation:

| Column | Constraint / meaning |
| --- | --- |
| `disposition_id` | text primary key |
| `intent_id` | non-null FK to the confirmed intent |
| `replacement_id` | nullable FK; null for whole-Order cancellation |
| source Order/item and Product/version/price snapshots | non-null historical identity |
| `removed_quantity` | integer > 0 |
| `returned_to_sellable_quantity` | integer >= 0 |
| `not_returned_quantity` | integer >= 0 |
| `reason`, `recorded_by`, `device_id`, `occurred_at` | non-null immutable evidence |

Check `returned_to_sellable_quantity + not_returned_quantity = removed_quantity`.
Unique `(intent_id, source_order_item_id)` prevents duplicate disposition.
There is deliberately no mutable Waste status, valuation, `consumed_at`, or
Cost reference. A future independently approved Waste record may contain a
unique FK to `disposition_id`; it will not mutate this table.

## 3. Required indexes

- Partial unique root lock on intents whose state is `prepared`,
  `external_in_progress`, or `reconciliation_required`.
- Intent lookup by `(event_id, state)` for closeout blocking and recovery lists.
- Intent lookup by `(root_order_id, created_at)` for history.
- Reservation lookup by `(intent_id, status)` and governed inventory key.
- Replacement lookup by root and effective revision; unique superseded and
  replacement Order identities.
- Unique non-null LINE Pay external reference and unique adjustment idempotency.
- Disposition lookup by intent/replacement and source Order.

SQLite partial indexes and checks must be verified against the repository's
actual SQLite version before SQL is accepted.

## 4. No-backfill proof

The migration contains only `CREATE TABLE` and `CREATE INDEX` statements for
new Operations-owned structures. It contains no `INSERT ... SELECT` from old
Orders, no `UPDATE` or `DELETE`, no table rebuild, no trigger that creates
historical chains, and no rewrite of Order numbers, items, Payments, inventory,
closeout, or Daily Reports.

The query rule is lazy:

```text
if order has no replacement relationship:
    root = orderId
    effective revision = 1
else:
    follow the unique confirmed chain to its terminal replacement
```

Migration verification must compare row counts and stable hashes of all
pre-existing Order/item/Payment facts before and after upgrade.

## 5. Transaction boundaries

- **Prepare**: intent header/items + positive reservation evidence + aggregate
  `reserved_quantity` update, one immediate transaction.
- **Renew**: prepared-state/CAS/lease update only, one transaction.
- **Cancel/expire**: state transition + exact held reservation release +
  aggregate decrement + audit, one transaction.
- **Confirm without external money**: replacement Order/items + chain edge, or
  whole-Order cancellation without an empty replacement; reservation
  commit/release + disposition + intent terminal state + audit, one transaction.
- **Confirm after external money**: same database transaction plus immutable
  Payment Adjustment evidence. The already-performed external action is outside
  the SQLite transaction and is handled through idempotency/reconciliation.

No transaction may leave a reservation row `held` while failing to increment
the aggregate, or decrement the aggregate without terminalizing that row.

## 6. Migration verification

The implementation migration must pass on fresh and populated disposable
databases:

- upgrade from the immediately preceding complete migration set;
- rerun/idempotency under the repository migration runner;
- restart/rehydration;
- foreign-key check and `PRAGMA integrity_check`;
- zero pre-existing row/value change and zero automatic backfill;
- all checks, partial unique indexes, CAS, root lock, external-reference
  uniqueness, reservation once-only, and disposition sum constraints;
- old Orders resolve as lazy revision 1 and are counted once;
- production startup reports pending migration until explicit release migration
  execution, consistent with the existing production policy.

## 7. Forward and rollback policy

The migration is forward-only. Before deployment, create a verified backup and
prove there are zero nonterminal intents. Applying an empty additive schema may
allow an old executable to ignore the new tables, but this is not a general
rollback promise.

- If deployment fails before any new intent/replacement/adjustment/disposition
  fact exists, the executable may roll back only under the existing verified
  release procedure.
- If any nonterminal intent exists, neither runtime nor database may roll back;
  the new runtime must recover or resolve it first.
- After any external money action or new replacement/payment/disposition fact,
  do not restore a pre-deployment database backup. Doing so could request a
  duplicate supplement/refund or resurrect a superseded Order.
- Such failures require forward repair and explicit financial reconciliation.
- Old runtime must never serve a database containing new active/history facts,
  because it would ignore root-chain projections and locks.

## 8. Explicitly unchanged

No current migration or UAT database is modified by this plan. No existing
Order/item/Payment row is rewritten. Product and Sales Contracts, Event product
snapshots, authentication schema, Cost/Recipe/Catalog data, Windows runtime,
Cloudflare, Scheduled Task, Docker, n8n, WSL, and Legacy remain unchanged.
