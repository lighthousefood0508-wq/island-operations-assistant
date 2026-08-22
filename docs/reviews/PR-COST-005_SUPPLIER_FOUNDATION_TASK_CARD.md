# PR-COST-005 — Supplier Foundation

> **OWNER-APPROVED TASK CARD — Supplier identity only; Purchase remains deferred.**

## 1. Authority and baseline

- Decision: **DECISIONS #079 — Cost-Owned Supplier Foundation and Purchase Reference Boundary**.
- Required implementation baseline: the governance-recording descendant of
  `integration/architecture-development` that contains DECISIONS #079.
- Constitution Compatibility Gate: ADR-019 and DECISIONS #048, #049, #050,
  #051, #053, #064, #071, and #079 are reviewed; compatibility is **PASS**.

This Card creates formal Cost-owned Supplier identity only. It does not approve
Purchase, Accepted Purchase, Cost Snapshot, inventory, packages, pricing,
valuation, migration of legacy vendor data, a UI, or a new Domain.

## 2. Single responsibility

Create and read a minimal formal Supplier record that a future Cost-owned
Purchase authority can reference:

```text
Supplier registration -> stable sup_<uuid> reference
```

The record does not itself represent a quote, order, receipt, receiving event,
actual-price fact, inventory lot, package, or Supplier Item.

## 3. Fixed Supplier contract

1. `supplierId` has the exact `sup_<uuid>` form and is generated only by the
   Cost Supplier Application Service.
2. A new Supplier contains a non-blank `displayName`, caller-provided canonical
   ISO-8601 UTC `createdAt`, non-blank `createdBy`, and aggregate version `0`.
3. `displayName` is descriptive, not identity. Duplicate and normalized-equal
   names are allowed. V1 establishes no name uniqueness, alias, merge, or
   identity-resolution rule.
4. Registration is the only Supplier lifecycle behavior. Rename, archive,
   deactivate, reactivate, delete, and any lifecycle event history are out of
   scope. A returned Supplier is implicitly available for future governed Cost
   references; this must not be represented as a new business status authority.
5. A failed validation or persistence operation writes no Supplier row.

## 4. Authority boundaries

- Cost owns Supplier identity and the Supplier repository/application boundary.
- Supplier has no Canonical Ingredient, Measurement, Profile, Recipe, Quote
  selection, price calculation, package, Purchase, Accepted Purchase, Snapshot,
  Inventory, or operational authority.
- A future Purchase must use `supplierId`; it must not use legacy `vendor_name`
  as authority.
- Existing `CostSource.supplierId` remains optional Quote provenance metadata.
  PR-COST-005 must not validate, rewrite, or backfill it.
- Legacy `cost_purchases` and `cost_purchase_items` remain non-authoritative
  foundation tables and are not read, migrated, or promoted.

## 5. Persistence policy

Migration 019 adds only:

```text
cost_suppliers(
  supplier_id PK,
  display_name,
  created_at,
  created_by,
  aggregate_version
)
```

The migration is forward-only. It must not alter Migrations 001–018, legacy
purchase tables, Cost Quote persistence, Canonical Ingredient persistence, or
any foreign key owned by another authority. `cost_suppliers` contains no
supplier-package, supplier-item, purchase, quote, price, unit, or inventory
fact.

The Cost repository port and SQLite adapter provide insert-only `saveNew`,
identity lookup, and deterministic identity-ordered listing. The Aggregate and
Application Service never import SQLite, `DatabaseAdapter`, or infrastructure
errors.

## 6. Application and HTTP contract

### Commands and reads

```text
POST /api/admin/cost/suppliers       -> 201
GET  /api/admin/cost/suppliers       -> 200
```

POST body:

```json
{
  "displayName": "北港食材行",
  "occurredAt": "2026-08-22T00:00:00.000Z",
  "actor": "operator-id"
}
```

The response is a stable Cost-owned Supplier representation containing
`supplierId`, `displayName`, `createdAt`, `createdBy`, and `aggregateVersion`.
GET returns the same readonly records in ascending lexical `supplierId` order.

### Responsibility split

- `CostSupplierService`: validates command shape, generates `sup_<uuid>`,
  constructs the Aggregate, calls the narrow Cost-owned repository port, lists
  records deterministically, and maps safe typed failures.
- `CostBackOfficeService`: parses HTTP-facing values and delegates only.
- `routes.ts`: registers only the two approved routes.
- `server/index.ts`: is the sole production composition site.

### Stable failures

| Condition | HTTP | Code |
| --- | ---: | --- |
| malformed text, identity, actor, or UTC instant | 422 | `COST_SUPPLIER_VALIDATION_FAILURE` |
| lookup/list/insert technical failure | 500 | `COST_SUPPLIER_PERSISTENCE_FAILURE` |

No serialized response may expose SQLite/DB text, table names, stack, cause,
or infrastructure-specific error detail.

## 7. Exact twenty-path implementation allowlist

1. `migrations/019_cost_suppliers.sql`
2. `src/domains/cost/domain/supplier.ts`
3. `src/domains/cost/domain/supplier-repository.ts`
4. `src/domains/cost/domain/identities.ts`
5. `src/domains/cost/domain/errors.ts`
6. `src/domains/cost/persistence/supplier-records.ts`
7. `src/domains/cost/infrastructure/sqlite-cost-supplier-repository.ts`
8. `src/domains/cost/application/cost-supplier-service.ts`
9. `src/domains/cost/application/cost-supplier-errors.ts`
10. `src/domains/cost/index.ts`
11. `src/server/app/cost-back-office-service.ts`
12. `src/server/app/routes.ts`
13. `src/server/index.ts`
14. `src/tests/cost-supplier-domain.test.ts`
15. `src/tests/cost-supplier-persistence.integration.test.ts`
16. `src/tests/cost-supplier-application.test.ts`
17. `src/tests/cost-back-office-api.integration.test.ts`
18. `src/tests/architecture-guards.test.ts`
19. `src/tests/recipe-migration-017.integration.test.ts`
20. `src/tests/canonical-ingredient-reference-impact-persistence.integration.test.ts`

Every other path is prohibited. A twenty-first implementation path is a stop
condition. In particular, `src/web/**`, `tests/e2e/**`, shared contracts,
existing Quote Aggregate/repository files, legacy purchase tables, and package
or inventory paths must not change.

## 8. Required acceptance evidence

- valid Supplier creation yields one immutable `sup_<uuid>` identity and
  aggregate version `0`;
- duplicate display names create distinct Supplier identities;
- malformed name, actor, or instant and technical persistence failure write
  nothing and return only safe typed failures;
- persistence survives restart, lookup and identity ordering are deterministic,
  and the Migration 019 fresh and populated 014-upgrade paths are idempotent;
- Migration 017-to-current and Reference Impact reopen regressions recognize
  the current 19-migration repository without altering their prior behavior;
- neither legacy purchase table nor existing Quote source metadata is queried,
  promoted, or changed;
- Cost Back Office delegates and does not generate identity, construct the
  Supplier, or access Supplier persistence;
- Architecture Guard uses the same substantive classifier to reject a simulated
  unauthorized twenty-first Supplier responsibility path; and
- focused Supplier tests, existing Cost/Ingredient/Profile/Recipe regressions,
  Architecture Guards, typecheck, lint, build, `npm test`, `npm run verify`,
  fresh complete E2E, `npm run verify:full`, compiled collection, encoding,
  whitespace, final-newline, exact-scope, and `git diff --check` all pass.

## 9. Stop conditions and exclusions

Stop and return to Owner if the work requires a twenty-first path, a second
migration, Supplier lifecycle mutation, a public shared-contract change,
Purchase/Accepted Purchase/Snapshot work, a Quote lifecycle change, an
Ingredient/Measurement/Profile/Recipe change, UI/navigation, package or
inventory work, or a new architecture decision.
