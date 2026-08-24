# PR-COST-010 — Cost Evidence Read Foundation

## Purpose

Expose the smallest governed, read-only Cost evidence contracts for existing
Supplier, formal Purchase, Accepted Purchase, and immutable Recipe Cost
Snapshot evidence. It is an operational read bridge and a stable input boundary
for later PR-COST-011 History and PR-COST-012 Analytics; it is not broad CRUD,
valuation, Snapshot mutation, or a UI project.

## Fixed behavior

- `GET /api/admin/cost/suppliers` preserves the existing deterministic Supplier
  collection. `GET /api/admin/cost/suppliers/:supplierId` returns one governed
  Supplier.
- `GET /api/admin/cost/purchases/:purchaseId` returns one existing formal
  Purchase contract. Purchase remains a commercial document, not actual-price
  authority.
- `GET /api/admin/cost/purchases/:purchaseId/accepted-purchases` returns the
  deterministic Accepted Purchase evidence collection for that known Purchase.
  `GET /api/admin/cost/accepted-purchases/:acceptedPurchaseId` returns one
  complete immutable Accepted Purchase contract.
- `GET /api/admin/cost/recipes/:recipeId/snapshots` returns the deterministic
  immutable Snapshot collection for that Recipe. `GET
  /api/admin/cost/snapshots/:costSnapshotId` returns one complete stored Snapshot
  contract.
- Collections have stable ordering: Suppliers by `supplierId`; Accepted
  Purchases by `acceptedAt`, then identity; Snapshots by `capturedAt`, then
  identity. An empty child collection is a successful `200`, not a missing
  parent or unavailable authority.
- `422 cost_evidence_read_invalid` is used for malformed governed identity;
  `404 cost_evidence_not_found` for a missing requested record; `500
  cost_evidence_read_failed` for technical read/hydration failure. Responses
  never contain raw SQLite/DB/table/stack/cause detail.

## Boundaries

- `CostEvidenceReadService` only coordinates the new public Cost read port and
  typed safe outcomes. It imports neither SQLite, `DatabaseAdapter`, Recipe,
  Ingredient, Profile, nor the Cost Back Office.
- The SQLite adapter may read only existing Cost-owned authoritative evidence
  tables and rebuild their existing public contracts. It makes no writes and
  treats `cost_purchases`, `cost_purchase_items`, and legacy `vendor_name` as
  non-authoritative.
- Cost Back Office remains facade/delegation only; `src/server/index.ts` is the
  sole production composition site.
- Existing Supplier/Purchase/Accepted Purchase/Snapshot lifecycle, CAS,
  normalization, VAL-2 selection, immutable Snapshot capture, Reference Impact,
  and all persistence schema remain unchanged.

## Exact implementation allowlist (13 paths)

1. `src/domains/cost/domain/cost-evidence-read-port.ts`
2. `src/domains/cost/application/cost-evidence-read-service.ts`
3. `src/domains/cost/application/cost-evidence-read-errors.ts`
4. `src/domains/cost/infrastructure/sqlite-cost-evidence-read-port.ts`
5. `src/domains/cost/index.ts`
6. `src/server/app/cost-back-office-service.ts`
7. `src/server/app/routes.ts`
8. `src/server/index.ts`
9. `src/tests/cost-evidence-read-application.test.ts`
10. `src/tests/cost-evidence-read-persistence.integration.test.ts`
11. `src/tests/cost-back-office-api.integration.test.ts`
12. `tests/e2e/cost-back-office.spec.ts`
13. `src/tests/architecture-guards.test.ts`

No fourteenth implementation path, migration/schema, broad list/search endpoint,
production UI/navigation, lifecycle command, valuation change, Snapshot write,
History, Analytics, Inventory, payment, tax, freight, allocation,
multi-currency, package, or legacy authority promotion is authorized.

## Required verification

- Focused Cost Evidence Read Application/persistence/API coverage, including
  deterministic ordering, complete pinned contracts, empty collection behavior,
  safe identity/not-found/technical failures, and no write side effects.
- Supplier, Purchase, Accepted Purchase, VAL-2, Snapshot, Recipe/Profile, and
  Canonical Ingredient Reference Impact non-regression coverage.
- Architecture Guard substantive responsibility classifier and simulated
  unauthorized fourteenth-path rejection.
- typecheck, lint, build, E2E, `npm test`, `npm run verify`, `npm run
  verify:full`, complete compiled collection, `git diff --check`, UTF-8,
  final-newline, trailing-whitespace, and exact thirteen-path audits.
