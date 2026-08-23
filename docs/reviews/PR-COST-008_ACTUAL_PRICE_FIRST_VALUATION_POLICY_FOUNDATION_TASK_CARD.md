# PR-COST-008 — Actual-Price-First Valuation Policy Foundation

> **OWNER-APPROVED TASK CARD — ephemeral VAL-2 source selection only.**

## Responsibility

Extend the existing ephemeral Recipe Cost Evaluation so immutable Accepted
Purchase line evidence is the preferred actual-price source.  An effective Cost
Quote remains available only as explicitly-labelled expected-price fallback.

This work does not create a Cost Snapshot, Cost History, Analytics, Inventory,
allocation, payment, tax, freight, package, or legacy-Purchase authority.

## Fixed behaviour

- The request retains the existing canonical `evaluatedAt` field; VAL-2 calls it
  `valuedAt` in selection semantics.  It is the business instant, not a new
  bitemporal knowledge-time facility.
- For each Recipe line, eligible Accepted Purchase lines have the same
  Canonical Ingredient and `acceptedAt <= valuedAt`.  The greatest `acceptedAt`
  ranks first.  Multiple candidates at that greatest instant fail closed; IDs
  and line positions are not arbitrary tie breakers.
- A selected Accepted Purchase is `ActualPurchase` source evidence.  The result
  preserves immutable Accepted Purchase/line IDs, source Purchase/version,
  Supplier, `acceptedAt`, currency, exact amount, normalized quantity,
  dimension/canonical-unit, and pinned Profile/Profile Version.
- When no eligible actual-price line exists, the existing effective Quote
  selection and Quote normalization path runs unchanged.  That result is
  `QuoteFallback`, never actual-price evidence.
- An eligible actual source with an incompatible typed measurement basis fails;
  it cannot fall through to Quote.  Arithmetic remains exact/no-rounding and
  current single-currency rules remain in force.
- Evaluation remains read-only and ephemeral.  It stores no Snapshot and
  modifies no Quote, Purchase, Accepted Purchase, Recipe, Ingredient, or
  Profile.  Later historical entries are not prevented by a bitemporal model.

## Boundaries

- The Cost evaluation read Unit of Work is the only selection read boundary.
  Its SQLite implementation can query Cost-owned Quote and Accepted Purchase
  tables only.  No Recipe, Ingredient, Measurement/Profile, legacy Purchase,
  Snapshot, or cross-Domain table reads are allowed.
- Accepted Purchase is already normalized/pinned immutable evidence and must
  never be normalized again.  Quote fallback continues to use the existing
  formal Quote normalization contract.
- Existing Cost Back Office and `/api/admin/cost/evaluations` remain the
  facade/route.  `src/server/index.ts` remains untouched.  The existing Cost
  page may render the explicit source type safely but receives no navigation or
  new command.

## Exact implementation allowlist

1. `src/domains/cost/domain/cost-evaluation-read-unit-of-work.ts`
2. `src/domains/cost/domain/recipe-cost-evaluation.ts`
3. `src/domains/cost/application/recipe-cost-evaluation-service.ts`
4. `src/domains/cost/infrastructure/sqlite-cost-evaluation-read-unit-of-work.ts`
5. `src/domains/cost/infrastructure/sqlite-cost-repository.ts`
6. `src/domains/cost/index.ts`
7. `src/web/cost/page.ts`
8. `src/tests/cost-evaluation.test.ts`
9. `src/tests/cost-evaluation.integration.test.ts`
10. `src/tests/cost-back-office-api.integration.test.ts`
11. `src/tests/architecture-guards.test.ts`
12. `tests/e2e/cost-back-office.spec.ts`

No migration, schema, package, route, runtime-composition, Aggregate,
repository-write, Snapshot, History, Analytics, navigation, or thirteenth path
is authorized.

## Required tests and verification

- Actual Purchase preference, latest-`acceptedAt` selection, equal-rank
  ambiguity, Quote fallback only when no actual candidate exists, measurement
  incompatibility, exact arithmetic, currency mismatch, and immutable source
  trace.
- Cost evaluation integration/API and existing Cost page E2E coverage.
- Existing Quote, Accepted Purchase, Recipe/Profile, Reference Impact, Supplier,
  Purchase, and migration regressions.
- Architecture Guard with a substantive classifier and simulated unauthorized
  thirteenth responsibility path rejection.
- Typecheck, lint, build, focused tests, E2E, `npm test`, `npm run verify`,
  `npm run verify:full`, compiled collection, `git diff --check`, UTF-8, final
  newline, trailing-whitespace, and exact twelve-path audits.

## Stop conditions

Stop for a thirteenth path, migration/schema/package work, Snapshot/History/
Analytics persistence, valuation averaging/FIFO/LIFO, a new currency policy,
legacy-purchase promotion, cross-Domain persistence read, or any change to
Decision #082 semantics.
