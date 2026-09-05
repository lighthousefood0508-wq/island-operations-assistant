# PR-OPERATIONS-004 — Order Replacement and Pending Modification Foundation

## Constitution Compatibility Gate

- **Approval record**: DECISIONS #096.
- **Reviewed authority**: Constitution v3; ADR-001, ADR-002, ADR-014 through
  ADR-018; DECISIONS #004, #007, #010, #087, #095; approved architecture and
  migration plans for this program.
- **Compatibility result**: PASS as a proposed Operations-only foundation.
- **Status**: AUTHORIZED FOR IMPLEMENTATION AND LOCAL CANDIDATE VALIDATION by
  DECISIONS #097. Commit, push, PR, merge, release, and deployment remain gated.

## Single responsibility

Establish the additive persistence, Application contracts, lazy-root/effective
Order projection, frozen intent state machine, exact positive-delta reservation,
and central nonterminal lock needed by later payment and UI work. This PR does
not perform external supplement/refund or expose the Owner modification UI.

## Required behavior

- Add the reviewed forward-only migration with no historical backfill or
  mutation of existing Order/item/Payment rows.
- Resolve old Orders as lazy root revision 1; resolve confirmed chains to one
  effective terminal Order and exclude superseded members from operational
  projections and totals.
- Prepare immutable proposal headers/lines from server-authoritative Event
  snapshots, prices, quantities, totals, notes, production state, and expected
  effective revision.
- Preserve the existing deterministic text Order revision token; do not invent
  or backfill an integer revision column. Distinguish replacement sequence from
  Order concurrency revision.
- Reserve only positive deltas through per-intent evidence and the existing
  aggregate `reserved_quantity` in one immediate transaction.
- Enforce one nonterminal intent per root, CAS, canonical idempotency, content
  freeze, ten-minute prepared lease, 30-second renewal floor, exact
  cancel/expiry release, and no automatic expiry outside `prepared`.
- Add one reusable Operations lock guard for every Order and production command.
  During a nonterminal intent it blocks edits, cancellation/no-show, completion,
  payment confirmation, and all Kitchen transitions.
- Provide internal prepare/read/renew/cancel/expire contracts needed by PR 2 and
  PR 3. Any temporary route used for tests must be removed or explicitly
  approved before merge; this PR must not create a parallel public workflow.
- Preserve #095 behavior until the full replacement protocol is available.
  Integration must not expose a half-implemented paid/started Order edit.

## Exact implementation allowlist (19 paths)

1. `migrations/024_operations_order_modification_foundation.sql`
2. `src/domains/operations/domain/order-modification.ts`
3. `src/domains/operations/application/order-modification-service.ts`
4. `src/domains/operations/infrastructure/order-modification-repository.ts`
5. `src/domains/operations/infrastructure/order-modification-lock.ts`
6. `src/domains/operations/infrastructure/order-repository.ts`
7. `src/domains/operations/infrastructure/lifecycle-repository.ts`
8. `src/domains/operations/infrastructure/payment-repository.ts`
9. `src/domains/operations/application/order-service.ts`
10. `src/domains/operations/application/lifecycle-service.ts`
11. `src/domains/operations/application/payment-service.ts`
12. `src/domains/operations/index.ts`
13. `src/tests/order-modification-foundation.integration.test.ts`
14. `src/tests/order-core.test.ts`
15. `src/tests/lifecycle-api.integration.test.ts`
16. `src/tests/architecture-guards.test.ts`
17. `src/tests/recipe-migration-017.integration.test.ts`
18. `src/tests/recipe-migration-018.integration.test.ts`
19. `src/tests/canonical-ingredient-reference-impact-persistence.integration.test.ts`

No twentieth implementation path is authorized. Governance documents already
prepared under DECISIONS #096 are not implementation paths. If safe
implementation requires server routes/composition, Cost, Catalog, Recipe
behavior, browser pages, external providers, Waste, Windows/deployment, or
another domain, stop.

## Acceptance criteria

- Fresh/populated migration, rerun, restart, FK/integrity, and no-backfill proof.
- Old Orders remain revision 1 and are counted exactly once.
- Two concurrent prepares cannot both lock/reserve one root or oversell one
  Product version.
- Same idempotency/fingerprint replays; mismatch conflicts with zero writes.
- Prepared renew/cancel/expiry are CAS-safe and release each reservation once.
- `external_in_progress` and `reconciliation_required` never auto-expire.
- Frozen proposal cannot be mutated.
- Every prohibited Order/Kitchen/payment transition fails closed while locked.
- No externally visible workflow implies payment adjustment is complete.

## Verification

Focused migration/Application/persistence/concurrency/Order/lifecycle tests;
authentication/role/CSRF/actor regression for any exposed boundary; POS,
scheduled Order, Kitchen, payment, closeout, Daily Report, SSE, and Sales
Contract regression; Architecture Guards; typecheck, lint, build, full tests,
`pnpm run verify`, `pnpm run verify:full`, compiled collection, diff, UTF-8,
newline, whitespace, and secret scans.

## Dependencies and stop conditions

Base is the then-latest clean integration containing DECISIONS #096 and its
reviewed architecture documents. PR 2 cannot begin until this PR is merged.
Stop for a second authority, historical rewrite, non-additive migration,
unidentifiable reservation, in-memory/browser lock, unsafe old-runtime
compatibility claim, or any need to execute against UAT.
