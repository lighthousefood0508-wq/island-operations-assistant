# PR-INGREDIENT-003D — Canonical Ingredient Reference Impact Read Model

> **OWNER-APPROVED TASK CARD — IMPLEMENTATION NOT AUTHORIZED**

Status: Owner-approved Task Card — implementation not authorized

This Task Card records the exact future implementation boundary accepted by
DECISIONS #071. Recording this document does not authorize an implementation
branch, production or test changes, staging, commit, push, PR creation, merge,
Ingredient 003E, another Domain, `main` promotion, release, or deployment.

## 1. Authority and baseline identities

- Constitution compatibility source: `CONSTITUTION.md`.
- Repository working rules: `AGENTS.md` and
  `docs/REPOSITORY_WORKING_GUIDE.md`.
- Architecture authority: DECISIONS #069 and DECISIONS #071.
- Boundary authority: `docs/adr/ADR-019-recipe-measurement-and-cost-authority.md`.
- Accepted Ingredient lifecycle Proposal:
  `docs/reviews/PR-INGREDIENT-003_CANONICAL_INGREDIENT_LIFECYCLE_APPLICATION_BOUNDARY_PROPOSAL.md`.
- Accepted Ingredient 003A Task Card:
  `docs/reviews/PR-INGREDIENT-003A_CANONICAL_INGREDIENT_LIFECYCLE_COMMAND_BOUNDARY_TASK_CARD.md`.
- Accepted Ingredient 003B Task Card:
  `docs/reviews/PR-INGREDIENT-003B_CANONICAL_INGREDIENT_MANAGEMENT_API_TASK_CARD.md`.
- Accepted Ingredient 003C Task Card:
  `docs/reviews/PR-INGREDIENT-003C_CANONICAL_INGREDIENT_MANAGEMENT_UI_TASK_CARD.md`.
- Task Card drafting and repository-observation Head:
  `affa115f5f304f5e7b7826ff7900cceb2a0c8de9`.

The drafting Head is not frozen as the future implementation base. A future
implementation Work Order must fetch and name its then-current exact
`origin/integration/architecture-development` Head. If integration advances,
the implementation must use the newly authorized Head and must not silently
rebase, absorb unrelated changes, or rely on this drafting SHA.

## 2. Constitution Compatibility Gate

Compatibility Result:

**PASS — OWNER-APPROVED TASK CARD; IMPLEMENTATION NOT AUTHORIZED**

The accepted dependency path is:

```text
HTTP route
  -> neutral interactive Application Service
    -> Canonical Ingredient public management read service
    -> Recipe-owned public Reference Impact read port
    -> Cost-owned public Reference Impact read port
      -> each Domain's own SQLite implementation
```

The interactive Reference Impact coordinator is an Application Service under
`src/application/`. It is not a scheduler or job. The Constitution rule for
scheduled coordination under `src/server/jobs/` remains unchanged.

`src/application/` is approved only for cross-Domain orchestration and
coordination use cases. It must not contain a shared Domain model, generic
utility, SQL, persistence implementation, business-fact authority, or a second
authority for Canonical Ingredient, Recipe, Cost, Purchase, or Snapshot facts.

## 3. Objective

Implement one synchronous, read-only use case:

```text
Given one Canonical Ingredient identity, report its formal Reference Impact
across Recipe Drafts, Published Recipe Versions, and Cost Quotes, while
explicitly reporting unavailable Purchase and Cost Snapshot authorities and
blocked, indeterminate deletion eligibility.
```

Ingredient 003D adds no mutation. It must not transition, save, delete,
reactivate, merge, alias, rewrite, or infer an Ingredient identity.

Active and Archived Canonical Ingredients are both readable. Archived
Ingredients remain readable wherever formal historical evidence references
them.

## 4. Fixed public result contract

The neutral Application Service file owns this orchestration DTO. The DTO is a
read projection, not a shared Domain authority.

```ts
export type CanonicalIngredientDraftReferenceV1 = Readonly<{
  recipeId: string;
  draftId: string;
  recipeLineId: string;
}>;

export type CanonicalIngredientPublishedReferenceV1 = Readonly<{
  recipeId: string;
  recipeVersionId: string;
  recipeLineId: string;
}>;

export type CanonicalIngredientReferenceImpactV1 = Readonly<{
  contractName: "CanonicalIngredientReferenceImpact";
  contractVersion: 1;
  ingredientId: CanonicalIngredientIdV1;

  recipeDrafts: Readonly<{
    availability: "Available";
    uniqueRecipeCount: number;
    draftCount: number;
    lineOccurrenceCount: number;
    recipeIds: readonly string[];
    draftIds: readonly string[];
    references: readonly CanonicalIngredientDraftReferenceV1[];
  }>;

  recipePublishedVersions: Readonly<{
    availability: "Available";
    uniqueRecipeCount: number;
    publishedVersionCount: number;
    lineOccurrenceCount: number;
    recipeIds: readonly string[];
    recipeVersionIds: readonly string[];
    references: readonly CanonicalIngredientPublishedReferenceV1[];
  }>;

  costQuotes: Readonly<{
    availability: "Available";
    quoteCount: number;
    quoteIds: readonly string[];
  }>;

  acceptedPurchases: Readonly<{
    availability: "Unavailable";
  }>;

  costSnapshots: Readonly<{
    availability: "Unavailable";
  }>;

  deletionEligibility: Readonly<{
    status: "Indeterminate";
    blocked: true;
  }>;
}>;
```

Public-contract immutability means TypeScript `Readonly<...>`, readonly arrays,
and no mutating methods. Runtime `Object.freeze()` or deep freezing is not
required by 003D.

## 5. Exact cardinality and ordering semantics

### Recipe Drafts

- `uniqueRecipeCount` is the number of distinct `recipeId` values.
- `draftCount` is the number of distinct `draftId` values.
- `lineOccurrenceCount` is the number of structured Draft reference entries.
- Every reference entry contains `recipeId`, `draftId`, and `recipeLineId`.
- Draft references are not removed or hidden because the Ingredient is
  Archived.

### Published Recipe Versions

- `uniqueRecipeCount` is the number of distinct `recipeId` values.
- `publishedVersionCount` is the number of distinct `recipeVersionId` values.
- `lineOccurrenceCount` is the number of structured Published reference
  entries.
- Every reference entry contains `recipeId`, `recipeVersionId`, and
  `recipeLineId`.
- Published impact includes immutable Published and Superseded Recipe Version
  history. Supersession does not erase Reference Impact.

### Cost Quotes

- `quoteCount` is the number of formal Quote reference identities returned by
  the Cost-owned port.
- `quoteIds` contains every formal historical Quote identity for the
  Ingredient, including Recorded and Superseded Quotes.
- Quote history must not be filtered to only the currently effective Quote.

### Determinism

- `recipeIds`, `draftIds`, `recipeVersionIds`, and `quoteIds` are distinct and
  sorted by lexical ascending identity.
- Draft references are sorted by `recipeId`, then `draftId`, then
  `recipeLineId`, all lexical ascending.
- Published references are sorted by `recipeId`, then `recipeVersionId`, then
  `recipeLineId`, all lexical ascending.
- No ranking, normalization, similarity, name matching, or identity inference
  is allowed.
- A genuinely available category with no references returns its accepted
  `Available` shape with zero counts and empty readonly collections.
- An unavailable category never exposes a numeric count or empty IDs as if the
  authority were available.

## 6. Accepted Purchase, Cost Snapshot and deletion eligibility

Accepted Purchase is fixed in v1 as:

```ts
Readonly<{ availability: "Unavailable" }>
```

Legacy `cost_purchases` and `cost_purchase_items` are non-authoritative
skeletons. 003D must not query them, wrap them in a new port, or promote them to
formal Accepted Purchase Evidence.

Cost Snapshot is fixed in v1 as:

```ts
Readonly<{ availability: "Unavailable" }>
```

It must not be represented as zero or as an available empty collection.

While Snapshot authority is unavailable, deletion eligibility is exactly:

```ts
Readonly<{
  status: "Indeterminate";
  blocked: true;
}>
```

This is informational read evidence only. It does not authorize a deletion
command, eligibility override, or delete button.

## 7. Recipe-owned public read port

Add a versioned, Recipe-owned read boundary in:

`src/domains/recipe/domain/ingredient-reference-impact-read-port.ts`

The accepted shape is:

```ts
export type RecipeDraftIngredientReferenceV1 = Readonly<{
  recipeId: string;
  draftId: string;
  recipeLineId: string;
}>;

export type RecipePublishedIngredientReferenceV1 = Readonly<{
  recipeId: string;
  recipeVersionId: string;
  recipeLineId: string;
}>;

export type RecipeIngredientReferenceImpactReadModelV1 = Readonly<{
  contractName: "RecipeIngredientReferenceImpact";
  contractVersion: 1;
  draftReferences: readonly RecipeDraftIngredientReferenceV1[];
  publishedReferences: readonly RecipePublishedIngredientReferenceV1[];
}>;

export interface RecipeIngredientReferenceImpactReadPort {
  findIngredientReferences(
    ingredientId: IngredientReferenceId
  ): RecipeIngredientReferenceImpactReadModelV1;
}
```

The port exposes Recipe-owned reference evidence only. It does not expose SQL
records, SQLite details, Recipe Aggregate mutation methods, Cost facts,
Purchase facts, or Snapshot facts.

## 8. Cost-owned public read port

Add a versioned, Cost-owned read boundary in:

`src/domains/cost/domain/ingredient-reference-impact-read-port.ts`

The accepted shape is:

```ts
export type CostIngredientQuoteReferenceImpactReadModelV1 = Readonly<{
  contractName: "CostIngredientQuoteReferenceImpact";
  contractVersion: 1;
  quoteIds: readonly string[];
}>;

export interface CostIngredientReferenceImpactReadPort {
  findIngredientQuoteReferences(
    ingredientId: IngredientId
  ): CostIngredientQuoteReferenceImpactReadModelV1;
}
```

The Cost implementation includes every formal Quote identity returned by Cost
history, including Superseded Quotes. It does not expose monetary values,
effective-Quote selection, Cost Evaluation, Cost Snapshot, or Purchase facts.

## 9. Neutral Application Service

Add:

`src/application/canonical-ingredient-reference-impact-service.ts`

The accepted API is synchronous:

```ts
export class CanonicalIngredientReferenceImpactService {
  constructor(
    ingredientReader: Pick<
      CanonicalIngredientManagementReadService,
      "getById"
    >,
    recipeReader: RecipeIngredientReferenceImpactReadPort,
    costReader: CostIngredientReferenceImpactReadPort
  );

  getByIngredientId(
    ingredientId: string
  ): CanonicalIngredientReferenceImpactV1;
}
```

The file may export only the accepted result/reference DTOs, three accepted
Application error classes, and the Service. It must import Recipe and Cost
types through their public indexes. It must not import infrastructure,
persistence records, SQLite, DatabaseAdapter, Aggregate internals, or another
Domain's private path.

The Service does not create a generic service locator, shared repository,
transaction authority, cache, scheduler, or persistence layer.

## 10. Execution and failure precedence

Every request follows this sequence:

1. Call the accepted Canonical Ingredient management read boundary with the
   caller-provided identity.
2. Map malformed identity to Reference Impact Validation Failure.
3. Map a parseable missing identity to Reference Impact Not Found.
4. Map an unexpected Canonical Ingredient read failure to Reference Impact
   Read Failure.
5. After a loaded Active or Archived Ingredient, call the Recipe read port
   exactly once.
6. Call the Cost read port exactly once.
7. If either available Domain read fails, throw Reference Impact Read Failure.
8. Do not return a partial result and do not replace the failed category with
   zero references.
9. Deduplicate and order the accepted public result collections.
10. Add the fixed Purchase, Snapshot, and deletion-eligibility states.
11. Return one immutable TypeScript DTO.

No transition, save, retry, fallback identity, current time, actor, reason,
automatic repair, or compensating write belongs to this flow.

## 11. Stable Application errors

The exact accepted classes and codes are:

| Application class | Stable code |
|---|---|
| `CanonicalIngredientReferenceImpactValidationFailure` | `CANONICAL_INGREDIENT_REFERENCE_IMPACT_VALIDATION_FAILURE` |
| `CanonicalIngredientReferenceImpactNotFound` | `CANONICAL_INGREDIENT_REFERENCE_IMPACT_NOT_FOUND` |
| `CanonicalIngredientReferenceImpactReadFailure` | `CANONICAL_INGREDIENT_REFERENCE_IMPACT_READ_FAILURE` |

Exported errors must not expose a raw error through `cause` or another public
property. Their public message must not copy or concatenate a raw persistence
message. Their Application stack must not copy or chain a raw persistence
stack. Result DTOs and serialized responses must contain no raw error. A newly
constructed Application error may retain its normal Application-level
JavaScript stack.

Error classification must use accepted typed errors and boundary ownership. It
must not inspect raw error messages or stack text.

## 12. API contract

Add exactly one production registration:

```text
GET /api/admin/canonical-ingredients/:ingredientId/reference-impact
```

Successful response:

```text
200 { ok: true, data: CanonicalIngredientReferenceImpactV1 }
```

Error mapping:

| Stable code | HTTP |
|---|---:|
| `CANONICAL_INGREDIENT_REFERENCE_IMPACT_VALIDATION_FAILURE` | 422 |
| `CANONICAL_INGREDIENT_REFERENCE_IMPACT_NOT_FOUND` | 404 |
| `CANONICAL_INGREDIENT_REFERENCE_IMPACT_READ_FAILURE` | 500 |

The route uses the existing safe failure envelope. It adds no POST, PUT,
PATCH, or DELETE behavior. It does not modify the existing Ingredient list,
detail, rename, archive, Cost, or page routes.

No Reference Impact UI or navigation is authorized. The existing
`/admin/ingredients` page must not gain a control, request, panel, link, or
client-side state for this endpoint.

## 13. SQLite persistence and controlled full-scan policy

The Recipe SQLite implementation uses exactly two set-based reads:

1. Draft line references scoped by `ingredient_id`.
2. Published and Superseded Recipe Version line references scoped by
   `ingredient_id`.

Each query must return only the accepted identity fields, use parameter
binding, and provide deterministic identity ordering. The implementation must
not hydrate Recipe Aggregates or issue one query per reference.

The Cost SQLite implementation performs one set-based identity read over
formal `cost_ingredient_cost_quotes` history and includes Recorded and
Superseded Quote IDs. It must not select only the currently effective Quote.

Ingredient 003D v1 accepts the current Recipe full scan. Implementation
evidence must report:

- exact SQL shape;
- query count;
- `EXPLAIN QUERY PLAN` output;
- representative fixture row counts;
- confirmation of no N+1 behavior; and
- classification of the scan as the Owner-accepted v1 tradeoff.

003D must not add a migration, schema change, Recipe ingredient index, or
modify Migration 017. If evidence demonstrates that an index is required for
correctness or operability, stop before completion and return to Owner scope
review. Do not add Migration 018 or another path.

## 14. Exact thirteen-path implementation allowlist

A future implementation PR may change exactly these paths:

1. Add `src/application/canonical-ingredient-reference-impact-service.ts`.
2. Add `src/domains/recipe/domain/ingredient-reference-impact-read-port.ts`.
3. Modify `src/domains/recipe/infrastructure/sqlite-recipe-repository.ts`.
4. Modify `src/domains/recipe/index.ts`.
5. Add `src/domains/cost/domain/ingredient-reference-impact-read-port.ts`.
6. Modify `src/domains/cost/infrastructure/sqlite-cost-repository.ts`.
7. Modify `src/domains/cost/index.ts`.
8. Modify `src/server/app/routes.ts`.
9. Modify `src/server/index.ts`.
10. Add `src/tests/canonical-ingredient-reference-impact-application.test.ts`.
11. Add `src/tests/canonical-ingredient-reference-impact-persistence.integration.test.ts`.
12. Add `src/tests/canonical-ingredient-reference-impact-api.integration.test.ts`.
13. Modify `src/tests/architecture-guards.test.ts`.

No fourteenth implementation path is authorized. This Task Card document and
DECISIONS record are governance artifacts and are not implementation paths.

## 15. Atomic typecheck and composition boundary

The thirteen paths form one atomic typecheck boundary:

- both new Domain ports and their production SQLite implementers change in the
  same PR;
- both Domain public indexes export only the accepted versioned read-port
  surface;
- the neutral Application Service depends only on the public indexes;
- `src/server/index.ts` is the composition root that supplies infrastructure
  implementations;
- `src/server/app/routes.ts` depends on the Application Service and adds only
  the accepted GET route;
- focused fixtures and Architecture Guards change in the same PR.

No later PR may be relied upon to repair a stale or non-typecheckable 003D
base.

## 16. Required focused Application tests

At minimum, prove separately:

1. Malformed Ingredient ID throws Validation Failure without Recipe or Cost
   calls.
2. Parseable missing Ingredient throws Not Found without Recipe or Cost calls.
3. Canonical Ingredient read failure maps to Read Failure.
4. Active Ingredient is readable.
5. Archived Ingredient is readable.
6. Recipe read port is called exactly once after identity success.
7. Cost read port is called exactly once after Recipe success.
8. Recipe failure throws Read Failure and returns no result.
9. Cost failure throws Read Failure and returns no result.
10. Available zero-reference categories use zero counts and empty readonly
    collections.
11. Purchase and Snapshot remain `Unavailable` without count or IDs.
12. Deletion eligibility remains exactly `Indeterminate` and blocked.
13. Draft cardinalities and structured identities are exact.
14. Published cardinalities and structured identities are exact.
15. Cost Quote count and IDs include Superseded history.
16. Duplicate identity projections are deduplicated without losing distinct
    line occurrences.
17. All public collections use deterministic lexical ordering.
18. Contract name and version are exact.
19. No raw failure cause, property, message, or copied stack leaks.
20. No transition or persistence write method is called.

## 17. Required persistence integration tests

At minimum, prove:

- multiple Drafts and Recipes referencing the same Ingredient;
- multiple line occurrences with exact structured identities;
- Published and Superseded Recipe Versions both retained;
- identical stable line identity across different Version owners remains
  distinguishable by the structured occurrence tuple;
- another Ingredient is excluded;
- Recorded and Superseded Cost Quotes are both returned;
- Quote ordering is deterministic;
- database close and reopen preserves the same Reference Impact;
- Recipe query count is exactly two set-based reads;
- Cost query count is one set-based read;
- no N+1 reads;
- exact `EXPLAIN QUERY PLAN` evidence is captured and reported;
- the accepted v1 Recipe full scan is explicit;
- legacy `cost_purchases` and `cost_purchase_items` are not queried;
- technical Recipe and Cost read failures remain typed at their boundaries;
- Migration 017 and all schema blobs remain unchanged.

## 18. Required API integration tests

At minimum, prove:

- exact GET route returns `200` and the accepted envelope;
- malformed identity returns `422` with the exact stable code;
- parseable missing identity returns `404` with the exact stable code;
- Active and Archived Ingredient reports are readable;
- Draft, Published, Quote, Purchase, Snapshot, and deletion fields serialize
  exactly;
- Recipe failure returns safe `500` Read Failure;
- Cost failure returns safe `500` Read Failure;
- no partial-success body is returned after a Domain failure;
- raw Repository and SQLite details do not cross the API;
- no Reference Impact mutation route exists;
- existing list, detail, rename, archive, malformed-JSON, Cost, and
  `/admin/ingredients` behavior remains unchanged;
- no Reference Impact UI route, renderer, navigation, or client request is
  introduced.

## 19. Architecture Guard requirements

Extend, never weaken, the current guards to prove:

1. The implementation diff is exactly the thirteen authorized paths.
2. `src/application/` contains only the accepted Reference Impact Application
   Service for this PR.
3. The Service imports Recipe and Cost only through public Domain indexes.
4. The Service imports no infrastructure, persistence record, SQLite,
   DatabaseAdapter, Aggregate internal, or private Domain path.
5. Canonical Ingredient code imports no Recipe, Cost, Purchase, or Snapshot
   persistence.
6. Recipe and Cost ports contain only their own Domain facts.
7. Recipe SQLite code queries only Recipe-owned tables.
8. Cost SQLite code queries only Cost-owned Quote tables.
9. Only `src/server/index.ts` performs runtime infrastructure composition.
10. The exact Reference Impact GET API route exists once.
11. No POST, PUT, PATCH, or DELETE Reference Impact route exists.
12. Existing 003A, 003B, and 003C public surfaces and guards remain intact.
13. The current 003C prohibition against Reference Impact UI/navigation stays
    effective; the new guard exception is limited to production API wiring and
    its authorized API tests.
14. No migration, schema, package, shared contract, UI, or navigation path is
    added.
15. `src/application/` is not used as a generic utility or shared Domain
    authority.

## 20. Required future verification

Immediately before implementation, re-inspect `package.json` and stop if an
authorized command has been removed or renamed. Using the current repository
scripts, verification must include and report separately:

- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- focused compiled Application test;
- focused compiled persistence integration test;
- focused compiled API integration test;
- `npm run architecture:guard`;
- `npm run migration:smoke`;
- `npm run migration:upgrade:014`;
- `npm test`;
- `npm run verify`;
- `npm run test:e2e`;
- `npm run verify:full`;
- manually enumerate every `dist/tests/*.test.js` file and run that exact
  collection;
- `git diff --check`;
- new-file no-index whitespace checks;
- UTF-8, final-newline, and trailing-whitespace checks; and
- exact thirteen-path audit.

Report each collection with its own provenance and counts. Do not add
overlapping test totals into a fictional aggregate.

## 21. Explicit exclusions

Ingredient 003D must not include:

- Delete;
- Reactivate;
- Merge or aliases;
- Canonical Ingredient lifecycle mutation;
- Create or automatic identity resolution;
- Reference Impact UI or navigation;
- browser persistence or offline authority;
- Purchase Domain or Accepted Purchase authority implementation;
- reads from legacy `cost_purchases` or `cost_purchase_items`;
- Cost Snapshot identity, persistence, or reporting history;
- Recipe Cost Evaluation or Cost calculation;
- Supplier, Inventory, Package, Measurement, conversion, density, or
  variable-weight work;
- authentication or authorization;
- shared cross-Domain Domain models or generic utilities;
- another repository, database, transaction, cache, scheduler, job, or event
  authority;
- migration, schema, Migration 017 modification, or Recipe ingredient index;
- package or dependency change;
- Ingredient 003E or another Ingredient work item;
- another Domain implementation;
- governance synchronization beyond separately authorized recording;
- branch cleanup;
- `main` promotion;
- release; or
- deployment.

## 22. Protected paths and facts

The implementation must leave unchanged:

- `CONSTITUTION.md`;
- `AGENTS.md`;
- `docs/REPOSITORY_WORKING_GUIDE.md`;
- `docs/DECISIONS.md`;
- ADR-019;
- the accepted Ingredient Proposal;
- the accepted 003A, 003B, and 003C Task Cards;
- all migrations, including Migration 014 and Migration 017;
- all schema and package files;
- existing 003A command/result/error and lifecycle behavior;
- existing 003B management read/API behavior;
- existing 003C UI/navigation behavior;
- existing Cost Quote lifecycle, Cost Evaluation, and Cost Back Office
  behavior; and
- every path outside the exact thirteen-path allowlist.

## 23. Stop conditions

Stop without staging, commit, push, or PR creation if:

1. the future Work Order's exact remote integration Head differs;
2. DECISIONS #071 or this Task Card differs from its Owner-accepted record;
3. any accepted Ingredient Proposal, Task Card, ADR, Constitution, or migration
   seal differs;
4. a fourteenth implementation path is required;
5. a migration, schema change, index, package, dependency, generated artifact,
   UI, or navigation change is required;
6. the Recipe full scan is shown to require an index for correctness or
   operability;
7. the DTO cannot preserve the exact accepted cardinalities or references;
8. Published or Superseded Recipe history would be hidden;
9. Superseded Cost Quote history would be hidden;
10. Accepted Purchase or Cost Snapshot would be represented as zero;
11. a Domain failure would require partial success or a zero fallback;
12. raw persistence detail would cross the Application or API boundary;
13. Canonical Ingredient code would need to query another Domain;
14. `src/application/` would need to become a generic/shared authority;
15. an existing Architecture Guard must be weakened rather than precisely
    extended;
16. Delete, Reactivate, Merge, aliases, lifecycle mutation, UI, authentication,
    authorization, 003E, or another Domain enters scope;
17. final verification remains failing and cannot be corrected within the exact
    thirteen paths; or
18. the worktree, staged area, branch identity, or protected path inventory
    differs from the future Work Order.

Do not self-repair a governance, base, scope, or seal discrepancy. Report the
exact blocker to the Owner.

## 24. Governance and implementation gates

1. Owner approved DECISIONS #071 and this Task Card content for recording.
2. Recording these governance artifacts does not authorize implementation.
3. Owner must separately review the recorded identities and issue an exact
   implementation Work Order.
4. The Work Order must reverify the then-current integration Head, protected
   seals, current public exports, port signatures, SQLite schema, package
   scripts, and exact thirteen-path allowlist.
5. Implementation must stop at a separately defined pre-commit review Gate.
6. Commit, push, PR creation, independent PR review, remediation, and merge each
   require their separately authorized Gates.
7. Post-merge verification and Owner acceptance are required before Ingredient
   003D can be declared technically complete.
8. Governance closeout, `main`, release, and deployment remain separate work.

## 25. Required future implementation pre-commit report

The future report must include:

- exact implementation base and remote integration Head;
- branch, local Head, upstream, ahead/behind, worktree, and staged state;
- Decision, Task Card, Proposal, ADR, and migration seals;
- exact thirteen-path inventory and per-file statistics;
- worktree blob for every changed file;
- exact final Application, Recipe port, Cost port, error, and API signatures;
- DTO/cardinality/ordering evidence;
- Active and Archived Ingredient evidence;
- Published/Superseded Recipe and Recorded/Superseded Quote evidence;
- unavailable Purchase/Snapshot and blocked deletion evidence;
- Domain failure/no-partial-success/raw-error-containment evidence;
- exact SQL, query counts, `EXPLAIN QUERY PLAN`, representative fixture, and
  no-N+1 evidence;
- Architecture Guard non-weakening evidence;
- all required verification commands and separate counts;
- `git diff --check`, encoding, newline, whitespace, and new-file results;
- excluded-path and generated-artifact audit;
- every failure, discrepancy, or remaining uncertainty; and
- confirmation that nothing is staged, committed, pushed, or submitted as a
  PR without the next Owner Gate.

## Current status

**OWNER-APPROVED TASK CARD — IMPLEMENTATION NOT AUTHORIZED**
