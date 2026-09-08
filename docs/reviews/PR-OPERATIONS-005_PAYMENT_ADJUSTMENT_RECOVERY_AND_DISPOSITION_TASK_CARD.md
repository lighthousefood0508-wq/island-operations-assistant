# PR-OPERATIONS-005 — Payment Adjustment, Recovery, and Disposition

## Constitution Compatibility Gate

- **Approval record**: DECISIONS #096.
- **Reviewed authority**: Constitution v3; ADR-014 through ADR-018; DECISIONS
  #007, #012, #013, #088, #089, #095; reviewed program architecture/migration;
  merged PR-OPERATIONS-004 foundation.
- **Compatibility result**: PASS as a proposed Operations Payment and lifecycle
  increment. It does not create provider settlement, Waste, or Cost authority.
- **Status**: PR #64 merged as integration commit `2ffabc95905d...`.
  DECISIONS #100 authorizes a follow-on chain-aware reporting completion on that
  exact baseline through independent review and clean merge. Release and
  deployment remain gated.

## Single responsibility

Complete the server-side two-phase supplement/refund protocol, cross-device
recovery, immutable Payment Adjustment and finished-item disposition evidence,
replacement confirmation, effective-only closeout/report semantics, and
fail-closed reconciliation recovery.

## Required behavior

- Confirm no-external-action replacements atomically.
- Keep unpaid replacements unpaid with no synthetic supplement. For fully paid
  Orders, calculate from net immutable evidence; refund through the original
  method, allow a frozen supported supplement method, and reject mixed/ambiguous
  payment states.
- Advance to `external_in_progress` before any operator external action; freeze
  exact amount, direction, and method.
- Record Cash actor/amount/time evidence or the accepted LINE Pay external
  reference using the original intent/idempotency identity.
- Make Phase B idempotently create the replacement Order/items and chain edge,
  commit held quantity, apply explicit return/not-return disposition, insert the
  immutable Payment Adjustment, audit, and terminalize the intent.
- Prevent one LINE Pay external reference or one intent from creating two
  adjustments.
- If money may have moved and Phase B cannot complete, retain locks/reservations
  and enter `reconciliation_required`; never resume the old Order or request the
  same money again.
- Support cross-device/server-side recovery choices: verified no money ->
  cancel; verified money -> confirm; unknown -> reconciliation required. Both
  reconciliation exits require authorization, reason, actor, and time.
- Treat the existing Kitchen-visible Order note as production content. A ready
  Order with production-content changes returns to preparing at confirmation.
- Store immutable disposition evidence only. Do not add valuation, mutable Waste
  status, or Cost writes.
- Resolve payment totals, unresolved counts, closeout, Daily Report, and Sales
  Contract behavior from the one effective Order per chain. Block closeout save,
  Event Close, and Daily Report freeze for every nonterminal intent.
- Removing the final line confirms as whole-Order cancellation with any required
  refund/disposition, and creates neither an empty Order nor a replacement edge.
- Run one startup and one bounded, non-overlapping periodic expiry sweep through
  `server/jobs -> OrderModificationService`. Only elapsed `prepared` leases may
  CAS-expire; state transition, hold release, unlock, audit and time evidence are
  one transaction. Stop the timer during graceful shutdown. Never auto-expire
  `external_in_progress` or `reconciliation_required`.
- Preserve unique replacement internal identity/number while projecting root
  pickup number, modified state, effective revision and modification sequence
  on every effective Order read. POS and Kitchen render that projection across
  reload/reconnect/device boundaries; no Order row is rewritten or backfilled.

## Scope to freeze before implementation

DECISIONS #099 expands the implementation allowlist only for the two confirmed
blocking findings. It is frozen to these nineteen paths:

1. `src/domains/operations/domain/types.ts`
2. `src/domains/operations/domain/order-modification.ts`
3. `src/domains/operations/application/order-modification-service.ts`
4. `src/domains/operations/infrastructure/order-modification-repository.ts`
5. `src/domains/operations/infrastructure/order-modification-lock.ts`
6. `src/domains/operations/infrastructure/order-repository.ts`
7. `src/domains/operations/infrastructure/lifecycle-repository.ts`
8. `src/domains/operations/index.ts`
9. `src/server/app/access-control.ts`
10. `src/server/app/routes.ts`
11. `src/server/index.ts`
12. `src/server/jobs/order-modification-expiry-runner.ts`
13. `src/web/pos/page.ts`
14. `src/web/kitchen/page.ts`
15. `src/tests/order-modification-payment-recovery.integration.test.ts`
16. `src/tests/order-modification-api.integration.test.ts`
17. `src/tests/order-modification-expiry-runtime.integration.test.ts`
18. `src/tests/architecture-guards.test.ts`
19. `tests/e2e/pos-ordering.spec.ts`

Governance synchronization files are not implementation paths. No twentieth
implementation path and no Owner-facing modification/payment workflow belongs
in this PR. The POS/Kitchen changes are limited to stable pickup presentation.

## Chain-aware reporting completion scope

DECISIONS #100 preserves the merged protocol and authorizes only the reporting
completion in these eleven implementation/test paths:

1. `src/domains/operations/domain/types.ts`
2. `src/domains/operations/domain/daily-report-read-port.ts`
3. `src/domains/operations/application/daily-report-read-service.ts`
4. `src/domains/operations/application/order-modification-service.ts`
5. `src/domains/operations/infrastructure/order-modification-repository.ts`
6. `src/domains/operations/infrastructure/payment-ledger-projection.ts`
7. `src/domains/operations/infrastructure/lifecycle-repository.ts`
8. `src/domains/operations/index.ts`
9. `src/tests/order-modification-foundation.integration.test.ts`
10. `src/tests/order-modification-payment-recovery.integration.test.ts`
11. `src/tests/architecture-guards.test.ts`

It adds no schema/migration and no public modification workflow. The single
canonical ledger projection separates original Payment, supplements, refunds
and net receipts by method. Event statistics, closeout reconciliation and
immutable Daily Report use that projection. Old frozen Daily Reports lacking
the additive projection remain readable. A refund that exceeds the available
balance of its frozen single method fails closed instead of silently creating a
negative per-method receipt or inventing split-tender behavior.

## Acceptance criteria

- Supplement and refund paths preserve original Payment plus immutable
  adjustment evidence and yield correct effective totals.
- External action followed by simulated Phase B failure is recoverable with the
  same intent and cannot double collect/refund.
- CASH no-action attestation and LINE Pay external-status check are distinct.
- LINE Pay reference reuse, amount/method/direction mismatch, stale CAS, or
  changed proposal fails closed.
- Reconciliation required persists across restart and is recoverable from a
  second authorized device.
- Removed quantity equals returned plus not-returned; only returned quantity
  becomes sellable; evidence is immutable and unique.
- Ready production-content edit yields a preparing replacement.
- Effective projections never double-count superseded Orders or emit a second
  Sales Contract for the same business sale chain.
- Event closeout save/close/report freeze cannot bypass unfinished intents or
  use a reconciliation exception to override them.
- Startup, periodic, restart and shutdown runtime regressions prove expired
  prepared cleanup, non-expiry of external/reconciliation states, race-safe
  one-time release, failure isolation and zero residual timer/listener.
- Effective list/detail/POS/Kitchen projection keeps the root pickup number and
  modification sequence while internal IDs/numbers remain unique and reports
  count only the effective Order once.

## Verification

Focused Payment/replacement/recovery/disposition/closeout/Daily Report/Sales
Contract tests including injected transaction failures and process restart;
authentication, admin/POS authorization, CSRF, canonical origin, actor injection,
strict schema and safe errors; existing Order/inventory/Kitchen/payment/closeout
regressions; Architecture Guards; typecheck, lint, build, full tests,
`pnpm run verify`, `pnpm run verify:full`, compiled collection, migration smoke,
diff/text/encoding/secret scans.

## Dependencies and stop conditions

PR-OPERATIONS-004 must be merged and green first. PR 3 cannot begin until this
PR is merged. Stop if completing an external transaction requires provider API
authority not already represented, if the system would claim SQLite can roll it
back, if disposition expands into Waste/Cost, or if UAT/deployment changes are
required.
