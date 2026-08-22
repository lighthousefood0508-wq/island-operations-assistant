# PR-COST-006 — Purchase Foundation

> **OWNER-APPROVED TASK CARD — formal unaccepted Purchase only.**

## Responsibility

Implement the Cost-owned `Draft -> Recorded` Purchase aggregate. Every formal
Purchase references an existing `sup_<uuid>` Supplier and each line references
one typed canonical `ing_<uuid>` Ingredient identity. Recording locks the
commercial document; it does **not** accept it as actual-price evidence.

## Fixed behavior

- `POST /api/admin/cost/purchases` creates a Draft (`201`) from `supplierId`,
  ordered lines (`ingredientId`, `quantityCoefficient`, `quantityScale`,
  `unitCode`), `occurredAt`, and `actor`.
- `PATCH /api/admin/cost/purchases/:purchaseId` replaces Draft lines only and
  requires `expectedVersion`, `occurredAt`, and `actor` (`200`).
- `POST /api/admin/cost/purchases/:purchaseId/records` requires
  `expectedVersion`, `recordedAt`, and `recordedBy`, and returns the immutable
  Recorded contract (`200`).
- A line receives `pur_line_<uuid>` only in the Application Service. Lines may
  repeat one Ingredient but line identities must remain unique and order is
  explicit. Quantity is positive `ExactDecimal`; unit is an opaque `CostUnit`.
- Draft revision and recording are aggregate transitions. Expected-version
  conflict or any validation/state/read/write failure has zero durable writes.
- `Recorded` contains no accepted amount, currency, valuation, normalization,
  receipt settlement, inventory, or Snapshot fact. It is deliberately not
  actual-price evidence.

## Persistence

Migration 020 creates only `cost_purchase_aggregates` and
`cost_purchase_lines`. `supplier_id` references `cost_suppliers`; Ingredient
identity is stored as a typed reference without a cross-Domain FK. Legacy
`cost_purchases`, `cost_purchase_items`, `vendor_name`, and all Quote tables
remain untouched and non-authoritative.

## Exact implementation allowlist

1. `migrations/020_cost_purchases.sql`
2. `src/domains/cost/domain/purchase.ts`
3. `src/domains/cost/domain/purchase-repository.ts`
4. `src/domains/cost/domain/identities.ts`
5. `src/domains/cost/domain/errors.ts`
6. `src/domains/cost/persistence/purchase-records.ts`
7. `src/domains/cost/infrastructure/sqlite-cost-purchase-repository.ts`
8. `src/domains/cost/application/cost-purchase-service.ts`
9. `src/domains/cost/application/cost-purchase-errors.ts`
10. `src/domains/cost/index.ts`
11. `src/server/app/cost-back-office-service.ts`
12. `src/server/app/routes.ts`
13. `src/server/index.ts`
14. `src/tests/cost-purchase-domain.test.ts`
15. `src/tests/cost-purchase-persistence.integration.test.ts`
16. `src/tests/cost-purchase-application.test.ts`
17. `src/tests/cost-back-office-api.integration.test.ts`
18. `src/tests/architecture-guards.test.ts`
19. `src/tests/recipe-migration-017.integration.test.ts`
20. `src/tests/recipe-migration-018.integration.test.ts`
21. `src/tests/canonical-ingredient-reference-impact-persistence.integration.test.ts`

Any twenty-second path, second migration, migration-runner change, Supplier
lifecycle change, Accepted Purchase, price/valuation/Snapshot, legacy table
use, Quote change, Inventory/package/UI work, or Recipe/Ingredient/Measurement
authority change is a stop condition.

## Required verification

Run focused aggregate, persistence, Application, API, migration, Supplier and
Reference Impact regressions; Architecture Guards; typecheck, lint, build,
`npm test`, `npm run verify`, fresh E2E, `npm run verify:full`, the complete
compiled collection, `git diff --check`, exact twenty-one-path audit, UTF-8,
final newline, and trailing-whitespace checks.
