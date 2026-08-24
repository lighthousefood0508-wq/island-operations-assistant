# PR-COST-012 — Cost Analytics Foundation

## Purpose

Expose a small, governed, read-only Recipe Cost Analytics contract calculated
only from immutable Recipe Cost History / Snapshot contracts. It provides
operational trend and source visibility, not new valuation or evidence truth.

## Fixed behavior

- `GET /api/admin/cost/recipes/:recipeId/analytics` returns `200` with an
  immutable Recipe-scoped analytics contract. Empty History is a successful
  empty result; it is not missing evidence or a new valuation failure.
- Snapshot summaries retain Snapshot/Recipe/Recipe Version identity,
  valued/captured instants, VAL-2/NONE_EXACT identities, exact batch/per-yield
  results, and each line's source type. Summaries are chronological under the
  History ordering: `capturedAt`, then `costSnapshotId`.
- `latest` and `previous` select the last and immediately preceding summary.
  With two or more Snapshots, `latestMinusPrevious` is normalized exact-rational
  subtraction for batch and per-yield results plus exact comparison direction;
  otherwise it is `null`. No rounding, percentages, forecast, or revaluation.
- Source visibility reports separate `ActualPurchase` and `QuoteFallback` line
  counts. ActualPurchase Supplier visibility is grouped by persisted `supplierId`
  with sorted unique Accepted Purchase IDs; QuoteFallback never masquerades as
  actual-price or Supplier evidence.
- `422 cost_analytics_invalid` is malformed Recipe identity; technical History
  read/projection failure is `500 cost_analytics_read_failed`. Responses do not
  contain raw SQLite/DB/table/query/stack/cause detail.

## Boundaries

- `RecipeCostAnalyticsService` receives only the public
  `RecipeCostHistoryReadService` contract. It does not import SQLite,
  `DatabaseAdapter`, Snapshot/Evidence persistence, Recipe/Purchase/Quote/Profile
  services, or valuation/normalization code, and it writes nothing.
- Cost Back Office only delegates. `src/server/index.ts` remains the sole
  production composition site.
- Analytics preserves Snapshot evidence exactly. It never reads raw
  Purchase/Accepted Purchase/Quote to reconstruct source facts, re-runs VAL-2,
  re-normalizes, substitutes newer evidence, or mutates Snapshots/History.
- No Cost UI change is needed: the narrow API is the minimal Back Office read
  bridge. The existing general Analysis page is outside Cost scope.

## Exact implementation allowlist (11 paths)

1. `src/domains/cost/domain/recipe-cost-analytics-contract.ts`
2. `src/domains/cost/application/recipe-cost-analytics-service.ts`
3. `src/domains/cost/application/recipe-cost-analytics-errors.ts`
4. `src/domains/cost/index.ts`
5. `src/server/app/cost-back-office-service.ts`
6. `src/server/app/routes.ts`
7. `src/server/index.ts`
8. `src/tests/recipe-cost-analytics-application.test.ts`
9. `src/tests/cost-back-office-api.integration.test.ts`
10. `tests/e2e/cost-back-office.spec.ts`
11. `src/tests/architecture-guards.test.ts`

No twelfth implementation path, migration/schema, History/Snapshot adapter
change, raw Purchase/Quote read, valuation/normalization, Snapshot mutation,
production UI/navigation, broad Analytics, Inventory, payment, tax, freight,
allocation, multi-currency, package, or legacy authority promotion is allowed.

## Required verification

- Focused Analytics Application/API coverage of exact deterministic change,
  empty/one/two Snapshot histories, source visibility and Supplier grouping,
  safe failures, and no write behavior.
- History/Snapshot/VAL-2/Accepted Purchase/Recipe/Profile/Reference Impact
  regressions.
- Architecture Guard substantive responsibility classifier and simulated
  unauthorized twelfth-path rejection.
- typecheck, lint, build, E2E, `npm test`, `npm run verify`, `npm run
  verify:full`, complete compiled collection, `git diff --check`, UTF-8,
  final-newline, trailing-whitespace, and exact eleven-path audits.
