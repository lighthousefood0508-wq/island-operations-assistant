# Independent Architecture Review — POS Order Replacement and Payment Adjustment

## Review identity

- **Decision**: DECISIONS #096.
- **Review date**: 2026-09-05 (Asia/Taipei).
- **Base**: `integration/architecture-development` at
  `276583c0902d828da80ea0f88f0f5c4c107c8fc7`.
- **Candidate branch**:
  `docs/pos-order-replacement-payment-adjustment-architecture`.
- **Method**: A distinct final read-only architecture pass over the Decision,
  architecture plan, migration plan, three Task Cards, and current-state
  synchronization after draft findings were remediated. The final review pass
  changed no reviewed candidate file. This is an independent review pass by the
  same Codex task, not a claim of a separate human reviewer.

## Verdict

**PASSED**

- Final blocking findings: **0**.
- Final non-blocking findings: **0**.
- Candidate implementation authority: **none**.
- PR-OPERATIONS-004 readiness: **architecture-ready for a separate Owner
  implementation authorization**.

## Draft findings remediated before final review

These findings are retained as review provenance and are not open findings:

1. **AR-096-01 — unpaid Order difference ambiguity (blocking, closed)**
   - Earlier wording could classify an unpaid scheduled Order's positive new
     total as a supplement.
   - Remediation now freezes `payment_basis_status`: unpaid replacements remain
     unpaid with `none`/zero adjustment; only fully paid Orders use net-collected
     difference. Ambiguous payment states and mixed tender fail closed.
2. **AR-096-02 — existing revision type and cancellation references (blocking,
   closed)**
   - The draft migration described the existing deterministic Order revision as
     an integer and required replacement identities even for final-line removal.
   - Remediation preserves the current text revision token, separates it from
     integer chain/intent sequence, and allows a confirmed whole-Order
     cancellation to have no empty replacement/edge while disposition/payment
     evidence continues to reference the intent/effective Order.

## Required independent checks

| Review question | Result | Evidence |
| --- | --- | --- |
| Does the design falsely claim that SQLite can roll back external Cash/LINE Pay? | PASS | External action is explicitly outside SQLite; failure enters durable reconciliation and reuses one idempotency identity. |
| Can pending reservation oversell stock? | PASS | Prepare atomically reserves positive deltas in the existing aggregate and creates exact per-intent evidence; decreases are not released early. |
| Can an original-device failure permanently strand the lock? | PASS | Intent and recovery are server-side; another authorized POS/Admin can reopen the same intent and choose only the three governed outcomes. |
| Can Event closeout cross an unfinished intent? | PASS | Closeout save, Event Close, and Daily Report freeze are all blocked for the three nonterminal states, without exception override. |
| Can lazy-root queries double-count old and replacement Orders? | PASS | Existing rows self-root without backfill; operational projections use only one effective terminal member; unique edges/revisions and CAS are required. |
| Does disposition become a Waste Domain? | PASS | Evidence is immutable Operations history with no value, Cost write, mutable consumption flag, or Waste lifecycle. A future Waste fact requires separate approval and unique reference. |
| Does migration rewrite historical Orders, items, or Payments? | PASS | Plan permits only additive new tables/indexes, bans `INSERT ... SELECT`, `UPDATE`, `DELETE`, rebuild, trigger backfill, and requires pre/post row/value proof. |
| Are all six requested intent states and exits complete? | PASS | State table covers prepared, external in progress, reconciliation required, confirmed, cancelled, and expired; only prepared expires; both reconciliation exits are audited. |
| Are proposal content, amounts, reservations, and disposition frozen? | PASS | Prepare stores canonical snapshots and a fingerprint; later mutation is forbidden; an eligible proposal must be cancelled and recreated. |
| Is production fully locked while pending? | PASS | All Kitchen transitions, reversals, Order edits/cancellation/completion, and out-of-protocol payment confirmation are blocked. |
| Is ready-note behavior correct? | PASS | The current note is classified by its actual Kitchen consumer as production content; changing it moves a ready replacement to preparing. |
| Are voice/reminder rules replay-safe? | PASS | Root + effective revision + event type identifies announcements; pending emits no completion event; pickup-time changes replace the reminder only after commit. |
| Are rollback and deployment claims safe? | PASS | Deployment requires zero nonterminal intents; old runtime and pre-deploy DB restore are forbidden after new facts/external money; recovery is forward repair. |
| Can each PR merge without knowingly exposing a broken partial workflow? | PASS | PR 1 provides hidden foundation and keeps #095 public behavior; PR 2 completes server semantics; PR 3 exposes UI/realtime behavior. Dependencies are strictly serial. |

## Planned migration inventory

The reviewed plan adds, in a future separately authorized migration:

1. `operations_order_modification_intents`
2. `operations_order_modification_intent_items`
3. `operations_order_modification_reservations`
4. `operations_order_replacements`
5. `operations_payment_adjustments`
6. `operations_order_item_dispositions`

Required constraints/indexes cover six-state checks, frozen amount/direction,
one active root intent, intent CAS, one-time reservation transition, unique
chain edges/revisions, unique adjustment idempotency, unique non-null LINE Pay
reference, and exact disposition quantity sums. No SQL file exists at this Gate.

## PR responsibilities and dependencies

- **PR-OPERATIONS-004**: additive migration; lazy root/effective projection;
  frozen intent; reservation; state machine; central locks; no public half-flow.
- **PR-OPERATIONS-005**: supplement/refund evidence; Phase B; cross-device
  recovery/reconciliation; disposition; closeout/report/Sales Contract effects.
- **PR-OPERATIONS-006**: POS/Kitchen Owner workflow; stable pickup number;
  responsive UX; voice/reminder/SSE behavior; complete Chromium E2E.

Dependency is exactly `004 -> 005 -> 006`. Each requires a separate clean base,
scope freeze, implementation review, tests, and merge Gate.

## Verification evidence for this documentation Gate

- State/invariant checklist: PASS.
- `pnpm run architecture:guard`: PASS, 43/43.
- `git diff --check`: PASS.
- Source, migration, package, and lockfile diff from base: zero.
- UAT/SQLite/Cloudflare/Scheduled Task/Docker/n8n/WSL/Legacy mutation: none.
- Product test suites: not run; repository workflow says tests are not required
  for documentation-only work, and no product or migration file changed.

## Gate result

The architecture is internally consistent and can proceed to
PR-OPERATIONS-004 only after the Owner separately authorizes implementation.
This PASS does not authorize migration creation/execution, commit, push, PR,
merge, release, deployment, or any action against Windows UAT.
