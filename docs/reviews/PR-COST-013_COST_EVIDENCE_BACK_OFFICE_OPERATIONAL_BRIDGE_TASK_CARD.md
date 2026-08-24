# PR-COST-013 — Cost Evidence Back Office Operational Bridge

## Single responsibility

Make the already-governed Cost v1 evidence workflow usable by a nontechnical
operator in the existing `/admin/cost` Back Office.  This is a browser
orchestration and presentation bridge only: it reuses stable HTTP contracts and
does not establish, move, or reinterpret Cost authority.

No new Architecture Decision is required.  The implementation is governed by
DECISIONS #079 through #086 exactly as recorded.

## Operator workflow

The existing Cost Back Office must retain its Ingredient, Measurement Profile,
Recipe, Quote, and ephemeral Evaluation flows while adding practical flows to:

1. create and list formal Suppliers;
2. create, revise while Draft, load, and Record a governed Supplier-backed
   Purchase with Canonical Ingredient lines;
3. accept a currently Recorded Purchase exactly once, supplying the existing
   line amounts and receiving immutable Accepted Purchase evidence;
4. capture and list immutable Recipe Cost Snapshots; and
5. read immutable Recipe Cost History and the existing deterministic Analytics
   projection for a selected published Recipe.

The page may retain a current-Purchase browser selection and allow explicit
lookup by Purchase ID.  Browser state is not a business authority; all
transitions, validation, concurrency, identity, normalization, and evidence
semantics remain server-owned.

## Existing contracts only

The bridge may call only existing Cost Back Office endpoints, including the
already-published Supplier, Purchase, Accepted Purchase, Snapshot, Cost
History, and Analytics operations.  It must not add or change a route,
application service, Domain contract, repository, persistence adapter,
migration, schema, package, or runtime composition.

Remote values must be rendered as text safely.  The UI must distinguish actual
Accepted Purchase evidence from Quote fallback, display exact rational values
without browser rounding, and present server failures as safe user-facing
messages without treating failure or absent data as zero evidence.

## Exact implementation allowlist

1. `src/web/cost/page.ts`
2. `tests/e2e/cost-back-office.spec.ts`
3. `src/tests/architecture-guards.test.ts`

No fourth implementation path is authorized.

## Explicit exclusions

- Supplier, Purchase, Accepted Purchase, Quote, valuation, normalization,
  Snapshot, History, or Analytics authority changes;
- Snapshot or evidence mutation semantics;
- new API routes, Application/Domain/Repository/Persistence work, runtime
  composition, migration, schema, package, or navigation changes;
- Inventory, receiving, payment, tax, freight, allocation, multi-currency,
  valuation policy, dashboard/analytics redesign, authentication, or
  authorization.

## Acceptance criteria

- Existing Ingredient/Profile/Recipe/Quote/Evaluation flows remain intact.
- An operator can complete the governed Supplier → Purchase → Recorded →
  Accepted Purchase evidence flow with existing API contracts.
- Snapshot capture, Snapshot list, History, and Analytics show governed data
  for the selected Recipe without recalculation or evidence substitution.
- History and Analytics stay read-only; Quote fallback is labelled as expected
  evidence rather than actual purchase evidence.
- Architecture Guard protects the exact three-path UI responsibility scope and
  rejects a simulated unauthorized fourth responsibility path using the same
  classifier.

## Required verification

- typecheck, lint, build;
- focused Cost Back Office E2E, existing Cost API integration, and Architecture
  Guards;
- `npm test`, `npm run verify`, `npm run verify:full`, and compiled repository
  test collection;
- `git diff --check`, UTF-8/final-newline/trailing-whitespace checks; and
- exact three-path scope audit.
