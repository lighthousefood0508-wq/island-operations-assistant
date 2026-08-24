# PR-COST-011 — Immutable Recipe Cost History Read Model

## Purpose

Expose the smallest deterministic, read-only Recipe Cost History contract from
already immutable Recipe Cost Snapshots. This is a Cost evidence read model for
operational use and the later Analytics slice; it does not value, capture,
mutate, aggregate, or replace Snapshot evidence.

## Fixed behavior

- `GET /api/admin/cost/recipes/:recipeId/cost-history` returns `200` and the
  complete immutable Snapshot timeline for the Recipe, ordered by `capturedAt`
  ascending and then `costSnapshotId` ascending. No Snapshot evidence is an
  empty `200` timeline.
- `GET /api/admin/cost/recipes/:recipeId/cost-history/latest` returns `200`
  and the final entry under that same ordering. No Snapshot evidence is `404
  recipe_cost_history_not_found`.
- `GET /api/admin/cost/recipes/:recipeId/cost-history/:costSnapshotId` returns
  the complete entry only when the immutable Snapshot belongs to the Recipe;
  missing or foreign Snapshot evidence is the same safe `404`.
- An entry carries the complete existing immutable Snapshot contract, including
  Recipe/Recipe Version identity, valued/captured instants, capture actor,
  VAL-2/NONE_EXACT identity, exact results, and each pinned Accepted-Purchase
  actual-price or explicit Quote-fallback source trace. It does not project a
  new valuation or aggregate representation.
- Invalid identity input is `422 recipe_cost_history_invalid`; technical or
  hydration failures are `500 recipe_cost_history_read_failed`. No raw
  persistence detail serializes.

## Boundaries

- `RecipeCostHistoryReadService` depends only on the already Cost-owned public
  `CostEvidenceReadPort`, coordinates typed history outcomes, and creates no
  persistence authority. It imports neither SQLite, `DatabaseAdapter`, Recipe
  persistence, nor Cost Back Office.
- Cost Back Office only delegates. `src/server/index.ts` is the only production
  composition site.
- The model only reads immutable Snapshot contracts. It must not read raw
  Purchase, Accepted Purchase, Quote, Recipe, Ingredient, Profile, or legacy
  purchase persistence to reconstruct a timeline; it does not re-run VAL-2,
  re-normalize, rank sources, or substitute newer evidence.
- Existing direct Snapshot identity reads remain DECISIONS #084 contracts;
  Recipe-scoped identity lookup adds only the membership check necessary for
  this timeline contract.

## Exact implementation allowlist (12 paths)

1. `src/domains/cost/domain/recipe-cost-history-read-contract.ts`
2. `src/domains/cost/application/recipe-cost-history-read-service.ts`
3. `src/domains/cost/application/recipe-cost-history-read-errors.ts`
4. `src/domains/cost/index.ts`
5. `src/server/app/cost-back-office-service.ts`
6. `src/server/app/routes.ts`
7. `src/server/index.ts`
8. `src/tests/recipe-cost-history-read-application.test.ts`
9. `src/tests/recipe-cost-history-read-persistence.integration.test.ts`
10. `src/tests/cost-back-office-api.integration.test.ts`
11. `tests/e2e/cost-back-office.spec.ts`
12. `src/tests/architecture-guards.test.ts`

No thirteenth implementation path, migration/schema, Snapshot repository or
adapter change, lifecycle command, Snapshot capture, valuation selection,
Analytics, broad search/filtering, production UI/navigation, package change,
or legacy-Purchase authority is authorized.

## Required verification

- Focused Application/persistence/API coverage of deterministic timeline
  ordering, empty history, latest and Recipe-scoped identity lookup, complete
  pinned source preservation, safe 422/404/500 failures, and no write side
  effects.
- Snapshot, VAL-2, Accepted Purchase, Recipe/Profile, and Canonical Ingredient
  Reference Impact regressions.
- Architecture Guard substantive responsibility classifier and simulated
  unauthorized thirteenth-path rejection.
- typecheck, lint, build, E2E, `npm test`, `npm run verify`, `npm run
  verify:full`, complete compiled collection, `git diff --check`, UTF-8,
  final-newline, trailing-whitespace, and exact twelve-path audits.
