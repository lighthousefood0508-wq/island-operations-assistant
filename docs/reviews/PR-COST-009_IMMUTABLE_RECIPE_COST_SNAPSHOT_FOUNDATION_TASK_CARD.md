# PR-COST-009 — Immutable Recipe Cost Snapshot Foundation

## Purpose

Establish immutable Cost-owned historical Recipe Cost Snapshot evidence from a
successful existing DECISIONS #082 VAL-2 evaluation. This is a capture
boundary, not a new valuation policy, Cost History, Analytics, Inventory, or
UI feature.

## Fixed behavior

- `POST /api/admin/cost/recipes/:recipeId/snapshots` accepts `valuedAt`,
  `capturedAt`, and `capturedBy`, evaluates the current published Recipe using
  the existing VAL-2 service, then appends one immutable
  `cost_snapshot_<uuid>` only when that evaluation succeeds.
- The Snapshot pins Recipe/Recipe Version identity, VAL-2, NONE_EXACT,
  valuedAt/capturedAt/capturedBy, TWD exact batch and per-yield results, and
  all line-level exact costs/source evidence.
- `ActualPurchase` persists Accepted Purchase and line identity plus the
  complete immutable evidence already returned by VAL-2. `QuoteFallback`
  persists the complete Quote-normalization evidence and remains expected-price
  evidence, never actual-price evidence.
- Capture must not re-normalize Measurement, select replacement evidence, or
  alter any source. A later Quote, Accepted Purchase, Profile, or Recipe state
  cannot change a persisted Snapshot.
- Snapshot header and lines save in one immediate transaction. Failure leaves
  no Snapshot rows. V1 has no update, delete, revision, history, or analytics
  command.

## Reference Impact

Cost owns a narrow Snapshot reference read operation. Canonical Ingredient
Reference Impact must consume it via the Cost read port and report:

```ts
costSnapshots: {
  availability: "Available";
  costSnapshotCount: number;
  costSnapshotIds: readonly string[];
}
```

Available zero differs from unavailable. Snapshot authority alone does not
authorize deletion: deletion eligibility remains `Indeterminate` / blocked.

## Exact implementation allowlist (27 paths)

1. `migrations/022_cost_recipe_snapshots.sql`
2. `src/domains/cost/domain/identities.ts`
3. `src/domains/cost/domain/errors.ts`
4. `src/domains/cost/domain/cost-snapshot.ts`
5. `src/domains/cost/domain/cost-snapshot-repository.ts`
6. `src/domains/cost/persistence/cost-snapshot-records.ts`
7. `src/domains/cost/infrastructure/sqlite-cost-snapshot-repository.ts`
8. `src/domains/cost/application/recipe-cost-snapshot-service.ts`
9. `src/domains/cost/application/recipe-cost-snapshot-errors.ts`
10. `src/domains/cost/index.ts`
11. `src/domains/cost/domain/ingredient-reference-impact-read-port.ts`
12. `src/domains/cost/infrastructure/sqlite-cost-repository.ts`
13. `src/application/canonical-ingredient-reference-impact-service.ts`
14. `src/server/app/cost-back-office-service.ts`
15. `src/server/app/routes.ts`
16. `src/server/index.ts`
17. `src/web/ingredients/page.ts`
18. `src/tests/cost-snapshot-domain.test.ts`
19. `src/tests/cost-snapshot-persistence.integration.test.ts`
20. `src/tests/cost-snapshot-application.test.ts`
21. `src/tests/cost-back-office-api.integration.test.ts`
22. `src/tests/canonical-ingredient-reference-impact-application.test.ts`
23. `src/tests/canonical-ingredient-reference-impact-persistence.integration.test.ts`
24. `src/tests/canonical-ingredient-reference-impact-api.integration.test.ts`
25. `src/tests/architecture-guards.test.ts`
26. `tests/e2e/canonical-ingredient-management.spec.ts`
27. `src/tests/recipe-migration-017.integration.test.ts`

The migration-count expectation in the Migration 018 regression is dynamic and
requires no edit. A 28th path, migration-runner change, schema beyond Migration
022, Snapshot UI/navigation, or a change to DECISIONS #082 is a stop condition.

## Boundaries and failures

- Snapshot Application Service depends only on the existing Cost evaluation
  contract and narrow Snapshot repository; it must not depend on SQLite,
  BetterSqlite3, Recipe/Ingredient/Measurement persistence, or Cost Back
  Office.
- Cost Back Office is facade/composition only. `src/server/index.ts` remains
  the sole production composition site for the new service/repository.
- Existing evaluator remains read-only. It must not acquire Snapshot writes.
- `422`: invalid command or unsuccessful valuation; `404`: published Recipe
  missing; `500`: safe Snapshot persistence failure. Do not serialize raw
  persistence information.

## Required verification

- Snapshot immutable contract/identity/source/result evidence; actual and Quote
  fallback capture; no re-normalization/substitution after source changes.
- atomic persistence/zero-write failure and deterministic Snapshot references.
- Cost API and Reference Impact API/application/persistence coverage, migration
  regression, and Ingredient panel E2E.
- Architecture Guard substantive classifier plus simulated unauthorized 28th
  path.
- typecheck, lint, build, focused tests, E2E, `npm test`, `npm run verify`,
  `npm run verify:full`, compiled collection, `git diff --check`, UTF-8, final
  newline, trailing whitespace, and exact 27-path audit.

## Explicit exclusions

Cost History, Analytics, Inventory, allocation, valuation-policy revision,
averaging/FIFO/LIFO, bitemporal history, Quote/Purchase/Accepted Purchase
mutation, Recipe/Ingredient/Profile mutation, migration infrastructure, package
changes, UI/navigation beyond the existing Reference Impact panel, and legacy
Purchase authority.
