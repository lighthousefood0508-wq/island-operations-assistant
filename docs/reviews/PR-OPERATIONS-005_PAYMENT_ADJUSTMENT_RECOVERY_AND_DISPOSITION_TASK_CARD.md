# PR-OPERATIONS-005 — Payment Adjustment, Recovery, and Disposition

## Constitution Compatibility Gate

- **Approval record**: DECISIONS #096.
- **Reviewed authority**: Constitution v3; ADR-014 through ADR-018; DECISIONS
  #007, #012, #013, #088, #089, #095; reviewed program architecture/migration;
  merged PR-OPERATIONS-004 foundation.
- **Compatibility result**: PASS as a proposed Operations Payment and lifecycle
  increment. It does not create provider settlement, Waste, or Cost authority.
- **Status**: NOT AUTHORIZED FOR IMPLEMENTATION. It depends on a separately
  authorized, reviewed, and merged PR-OPERATIONS-004.

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

## Scope to freeze before implementation

The exact allowlist may include only necessary Operations types/services/ports,
SQLite adapter/repositories, existing lifecycle/payment/closeout composition and
routes, safe recovery/read endpoints, focused tests, and Architecture Guards.
No Owner-facing modification page belongs in this PR.

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
