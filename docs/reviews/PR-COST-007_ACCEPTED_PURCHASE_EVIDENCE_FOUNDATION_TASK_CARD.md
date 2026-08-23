# PR-COST-007 — Accepted Purchase Evidence Foundation

> **OWNER-APPROVED TASK CARD — immutable actual-price evidence only.**

## Responsibility

Create one immutable Cost-owned Accepted Purchase evidence record from one
already Recorded formal Purchase.  It establishes actual-price evidence without
changing the Purchase aggregate, accepting a partial document, or selecting a
Cost Snapshot / valuation result.

## Fixed behavior

- `POST /api/admin/cost/purchases/:purchaseId/acceptances` accepts exactly one
  Recorded Purchase at expected Purchase version and returns `201`.
- Request evidence is document `currencyCode`, one exact monetary amount for
  every source Purchase line, `acceptedAt`, and `acceptedBy`. Source line
  identities must match the Recorded Purchase exactly once and in its existing
  order. A second acceptance is rejected; v1 contains no partial acceptance.
- A generated `accepted_purchase_<uuid>` header and immutable accepted-line
  evidence preserve source Purchase/version, Supplier, canonical Ingredient,
  raw exact quantity/unit, amount/currency, normalized exact quantity,
  Measurement dimension/canonical unit, pinned Profile/Profile Version, actor,
  and time.
- Each source line is normalized at `acceptedAt` through
  `IngredientMeasurementNormalizationContractV1`. The Application layer keeps
  the returned typed evidence; it must not parse units or duplicate Measurement
  / Profile semantics.
- Accepted Purchase is formal actual-price evidence. Recorded Purchase stays
  unaccepted commercial-document evidence; Quotes remain expected-price
  evidence. Cost Snapshot, selection/valuation, Inventory, payment, tax,
  freight, allocation, package, and legacy-Purchase authority are excluded.
- Existing Reference Impact reports Accepted Purchase references as
  `Available`, with deterministic IDs and an exact count. `Available + 0` is
  distinct from `Unavailable`. Cost Snapshot remains `Unavailable`; deletion
  eligibility remains `Indeterminate` / blocked.

## Persistence and boundaries

Migration 021 adds only Accepted Purchase header and line evidence tables. A
single Cost-owned transaction verifies source Purchase state/version and absent
prior acceptance, writes the complete header/line set, and otherwise persists
nothing. The Cost Application Service is orchestration only; it imports neither
SQLite nor infrastructure-specific errors. Cost Back Office is facade/delegator
only, and `src/server/index.ts` is the sole composition site. The Reference
Impact coordinator accesses Accepted Purchase references only via the public
Cost read port.

## Exact implementation allowlist

1. `migrations/021_accepted_purchase_evidence.sql`
2. `src/domains/cost/domain/accepted-purchase.ts`
3. `src/domains/cost/domain/accepted-purchase-repository.ts`
4. `src/domains/cost/domain/identities.ts`
5. `src/domains/cost/domain/errors.ts`
6. `src/domains/cost/persistence/accepted-purchase-records.ts`
7. `src/domains/cost/infrastructure/sqlite-accepted-purchase-repository.ts`
8. `src/domains/cost/application/accepted-purchase-service.ts`
9. `src/domains/cost/application/accepted-purchase-errors.ts`
10. `src/domains/cost/index.ts`
11. `src/domains/cost/domain/ingredient-reference-impact-read-port.ts`
12. `src/domains/cost/infrastructure/sqlite-cost-repository.ts`
13. `src/application/canonical-ingredient-reference-impact-service.ts`
14. `src/server/app/cost-back-office-service.ts`
15. `src/server/app/routes.ts`
16. `src/server/index.ts`
17. `src/web/ingredients/page.ts`
18. `src/tests/accepted-purchase-domain.test.ts`
19. `src/tests/accepted-purchase-persistence.integration.test.ts`
20. `src/tests/accepted-purchase-application.test.ts`
21. `src/tests/canonical-ingredient-reference-impact-application.test.ts`
22. `src/tests/canonical-ingredient-reference-impact-persistence.integration.test.ts`
23. `src/tests/canonical-ingredient-reference-impact-api.integration.test.ts`
24. `src/tests/cost-back-office-api.integration.test.ts`
25. `src/tests/architecture-guards.test.ts`
26. `tests/e2e/canonical-ingredient-management.spec.ts`
27. `src/tests/recipe-migration-017.integration.test.ts`
28. `src/tests/recipe-migration-018.integration.test.ts`

Any twenty-ninth path, second migration, migration-runner change, formal
Purchase/Supplier/Quote mutation, Cost Snapshot/valuation, legacy-Purchase use,
Inventory/payment/tax/freight/allocation, Package work, navigation, or
Recipe/Ingredient/Measurement/Profile authority change is a stop condition.

## Required verification

Run focused Accepted Purchase domain, persistence, Application, Cost API, and
Reference Impact tests; Measurement, Purchase, Supplier, Quote, Recipe/Profile
and migration regressions; Architecture Guards; typecheck, lint, build, `npm
test`, fresh E2E, `npm run verify`, `npm run verify:full`, complete compiled
collection, `git diff --check`, exact twenty-eight-path audit, UTF-8, final
newline, and trailing-whitespace checks.
