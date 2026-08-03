# PR-RECIPE-MANAGEMENT-001A: Domain Correction and Draft Commands

> **TASK CARD DRAFT ONLY - IMPLEMENTATION NOT AUTHORIZED**

Status: Owner review draft

Current Owner Goal: Formal Recipe Draft Creation and Publication

Authoritative proposal:
`docs/reviews/PR-RECIPE-MANAGEMENT-001_FORMAL_RECIPE_DRAFT_CREATION_AND_PUBLICATION_PROPOSAL.md`

Baseline branch: `integration/architecture-development`

Baseline SHA: `d9a1074a043d1232bcfd6f982a664c02e716fd54`

This Task Card defines a candidate implementation boundary for
PR-RECIPE-MANAGEMENT-001A only. It does not authorize implementation, branch
creation, file modification, staging, commit, push, Pull Request creation, or
work on PR-RECIPE-MANAGEMENT-001B through 001E.

## 1. Objective

Correct the Recipe Domain model so a Recipe Family can own a repeatedly
editable Draft with stable Recipe Line identity, ordered repeated Ingredient
Lines, immutable Product binding, and the terminal `ABANDONED` Draft state.

This slice is directly required by the Current Owner Goal because the existing
Aggregate cannot update, remove, or reorder Lines, rejects repeated Ingredient
Lines, has no stable `recipeLineId`, and has no terminal abandonment behavior.

PR-INGREDIENT-003 is not a prerequisite. PR-RECIPE-MANAGEMENT-001A references
the existing canonical `ingredientId`; Ingredient rename, archive, management
read, API, and UI capabilities remain independent and deferred.

## 2. Authorized Scope

Subject to a separate Owner implementation authorization, 001A may change only
pure Recipe Domain behavior, Domain event facts, public Domain exports, and
focused Domain tests needed for the following capabilities.

### 2.1 Domain identities

- Represent `recipeFamilyId`, `draftId`, `recipeLineId`, and
  `recipeVersionId` as validated Domain identities.
- Preserve compatibility only where the accepted Proposal explicitly permits
  it; identity meaning must not depend on display names or list position.
- `recipeLineId` is immutable identity for one logical Line.
- Application-boundary or server identity generation is not part of 001A.
- No caller-trust, collision persistence, or durable identity receipt behavior
  is authorized here.

### 2.2 Recipe Family invariants

- Model one Recipe Family as bound to one canonical `productId`.
- The Product binding cannot be replaced with another Product.
- One Family may have many immutable Published Revisions over time.
- Domain behavior must reject an attempted in-place Product rebind with a
  typed Recipe Domain failure.
- Repository-wide and concurrent enforcement of one Product to one Recipe
  Family remains a required 001B persistence invariant. Pure Domain code must
  not claim it can prove uniqueness across separate Aggregate instances.

### 2.3 Stable Recipe Line identity

- Adding a Line requires a distinct stable `recipeLineId` in the Domain input
  and returns or exposes that identity in the resulting Domain state.
- Update, remove, and reorder target `recipeLineId`, never Ingredient ID or
  list position.
- `linePosition` is ordering data only.
- Reorder changes positions without replacing any `recipeLineId`.
- Updating Ingredient, quantity, unit, or preparation note does not replace
  `recipeLineId`.
- Optional plain-text preparation notes belong to the identified Line.
- Recipe instructions are optional plain text on the editable Draft.

### 2.4 Repeated Ingredient Lines

- The same canonical `ingredientId` may appear on multiple ordered Lines.
- Every occurrence has a distinct `recipeLineId`.
- Remove the Aggregate prohibition represented by `DuplicateIngredient`.
- Remove duplicate-Ingredient rejection from the pure Domain publish
  validator.
- Validation still rejects invalid Ingredient references, inactive references,
  incompatible dimensions, non-positive quantities, and invalid unit facts.
- Migration 016 and persistence uniqueness constraints are not modified in
  001A. Their forward-only correction is mandatory 001B work.

### 2.5 `ABANDONED` Draft lifecycle

- Only an unpublished `DRAFT` may transition to `ABANDONED`.
- `ABANDONED` is terminal and remains readable as historical Domain state.
- An abandoned Draft cannot be renamed, rebound, edited, validated as
  publishable, published, or abandoned again as a new transition.
- Published and Superseded states cannot transition to `ABANDONED`.
- A new abandon attempt against `ABANDONED` returns the typed
  `RECIPE_ALREADY_ABANDONED` outcome.
- Other invalid transitions return the typed `RECIPE_INVALID_TRANSITION`
  outcome.
- Domain abandonment requires explicit actor, occurred-at time, and non-empty
  reason facts for the append-only Domain event.
- Durable retry replay, idempotency-key conflict, optimistic concurrency,
  authorization, and Publish/Abandon transaction races remain outside 001A.

### 2.6 Domain event facts

- Add an append-only Draft-abandoned Domain event fact.
- The fact identifies Recipe Family, Draft, resulting Domain state, actor,
  occurred-at time, reason, and Aggregate version evidence available in the
  pure Domain/event boundary.
- Existing Draft-created, Published, and Superseded event contracts must remain
  backward compatible unless the Owner separately approves a breaking event
  version.

## 3. Explicit Out of Scope

The following are not authorized in 001A:

- Migration or Schema changes, including edits to Migration 016.
- SQLite repositories, transactions, mappers, records, constraints, or Unit of
  Work behavior.
- Persistence uniqueness for Product/Family, Line identity, or repeated
  Ingredient Lines.
- Durable idempotency receipts or restart replay.
- Independent-connection concurrency and transaction-race tests.
- Server or Application identity generation.
- Application orchestration or Application command handlers.
- Authentication, authorization, trusted actor derivation, or clock adapters.
- Product, Ingredient, or Measurement Contract resolution.
- Published Recipe Read Contracts.
- API routes, HTTP DTOs, HTTP error mapping, Runtime composition, or SSE.
- UI, UX, Prototype, browser state, or E2E tests.
- Ingredient rename/archive management or PR-INGREDIENT-003.
- Cost, Kitchen, Planning, Inventory, Payment, Statistics, or AI integration.
- Subrecipes, recursive BOM, half-product composition, or cycle detection.
- PR-RECIPE-MANAGEMENT-001B through 001E.

## 4. Expected Files to Change

The following is the candidate maximum allowlist for a later 001A Work Order.
The implementation Work Order may narrow it further but must not expand it
without another Owner decision.

Domain identity and model:

- `src/domains/recipe/domain/identities.ts`
- `src/domains/recipe/domain/types.ts`
- `src/domains/recipe/domain/errors.ts`
- `src/domains/recipe/domain/recipe-line.ts`
- `src/domains/recipe/domain/recipe-aggregate.ts`
- `src/domains/recipe/domain/recipe-publish-validator.ts`
- `src/domains/recipe/domain/published-recipe-snapshot.ts`
- `src/domains/recipe/domain/recipe-snapshot-comparator.ts`

Domain event facts and exports:

- `src/domains/recipe/events/recipe-domain-events.ts`
- `src/domains/recipe/events/recipe-event-factory.ts`
- `src/domains/recipe/events/recipe-event-collection.ts`
- `src/domains/recipe/events/errors.ts`
- `src/domains/recipe/index.ts`

Focused tests:

- `src/tests/recipe-domain.test.ts`
- `src/tests/recipe-publish.test.ts`
- `src/tests/recipe-events.test.ts`
- `src/tests/recipe-canonical-projection.test.ts`
- `src/tests/recipe-costing-contract-v2.test.ts`
- `src/tests/architecture-guards.test.ts` only if an existing export guard must
  be aligned with the approved Domain boundary.

An implementation must omit any listed file that does not require a change.
File presence in this candidate allowlist is not a requirement to edit it.

## 5. Files Forbidden to Change

- `migrations/**`, especially `migrations/016_recipe_recipes.sql`.
- `src/domains/recipe/infrastructure/**`.
- `src/domains/recipe/persistence/**`.
- `src/domains/recipe/application/**`.
- `src/domains/recipe/contracts/**`.
- `src/domains/recipe/ingredient-catalog/**`.
- `src/domains/recipe/measurement/**`.
- `src/domains/recipe/measurement-profile/**`.
- `src/server/**`.
- `src/web/**`.
- `tests/e2e/**`.
- Catalog, Cost, Operations, Inventory, Payment, Statistics, and Kitchen code.
- Constitution, ADR, Decisions, Roadmap, Repository Policy, and Working Guide.
- The accepted Recipe Proposal.
- `docs/reviews/PR-INGREDIENT-003_CANONICAL_INGREDIENT_LIFECYCLE_APPLICATION_BOUNDARY_PROPOSAL.md`.

## 6. Domain Invariants

1. Recipe Family identity is independent from Recipe display name.
2. Family Product binding is immutable after creation.
3. A Family may represent many immutable Revisions without changing identity.
4. Every Line has one immutable `recipeLineId`.
5. Ingredient ID and `linePosition` are never Line identity.
6. Repeated Ingredient IDs are legal when Line IDs are distinct.
7. Line positions are ordered, deterministic, and contain no duplicates or
   gaps after a completed reorder command.
8. Update and reorder preserve Line identity.
9. Remove targets exactly one existing Line ID and cannot remove a different
   occurrence of the same Ingredient.
10. Quantity and Measurement dimension rules remain fail-closed.
11. Published and Superseded Recipe facts remain immutable.
12. Only `DRAFT` can become `ABANDONED`.
13. `ABANDONED` is terminal and cannot be edited, validated, or published.
14. Abandonment retains actor, occurred-at time, reason, and append-only event
    evidence.
15. No Domain change weakens the canonical Product or Ingredient identity
    boundaries.

## 7. Typed Domain Errors Affected

001A must define or align stable pure Domain failures for at least:

- Recipe Family Product binding conflict.
- Recipe Line not found.
- Recipe Line identity collision within one Aggregate.
- Invalid Recipe Line position or reorder set.
- Invalid Recipe Line quantity, unit, or Ingredient facts.
- Draft already abandoned (`RECIPE_ALREADY_ABANDONED`).
- Draft terminal and not editable/publishable (`RECIPE_DRAFT_ABANDONED`).
- Invalid lifecycle transition (`RECIPE_INVALID_TRANSITION`).
- Existing invalid Recipe state and publish-validation outcomes where still
  applicable.

`DuplicateIngredient` and `DUPLICATE_INGREDIENT` must no longer describe a
valid Domain failure after repeated Ingredient Lines are accepted. Removing or
deprecating that export must be handled without silently breaking unreviewed
external consumers.

HTTP status mapping is not part of 001A.

## 8. Acceptance Test Matrix

| Area | Required proof |
| --- | --- |
| Family identity | Recipe Family identity is stable and independent from name |
| Product binding | In-place Product rebind is rejected without mutation |
| Revision model | One Family can represent multiple Revision identities without replacing the Family identity |
| Add Line | Add stores a distinct stable `recipeLineId` |
| Repeated Ingredient | Two Lines may share `ingredientId` and retain distinct Line IDs |
| Update Line | Quantity, unit, Ingredient, and note changes target one `recipeLineId` and preserve it |
| Remove Line | Removing one repeated-Ingredient Line leaves the other occurrence unchanged |
| Reorder | Reorder targets Line IDs, produces deterministic positions, and preserves identities |
| Invalid reorder | Missing, duplicate, or foreign Line IDs are rejected atomically in Domain state |
| Preparation note | Note is attached to and follows its stable Line identity |
| Instructions | Draft instructions are optional plain text and remain editable only in Draft state |
| Publish validation | Repeated Ingredient IDs are accepted; invalid Line facts still fail closed |
| Abandon | `DRAFT -> ABANDONED` succeeds with actor/time/reason evidence |
| Abandon terminal | Rename, bind, Line mutation, validate, and publish are rejected after abandonment |
| Repeated abandon | A new abandon transition returns `RECIPE_ALREADY_ABANDONED` and adds no second fact |
| Illegal abandon | Published and Superseded state cannot be abandoned |
| Events | One successful abandonment yields one correctly versioned append-only Domain event |
| Immutability | Existing Published/Superseded snapshot immutability remains intact |
| Regression | Existing quantity, unit, identity, publish, supersession, projection, and Costing Contract tests remain green |

## 9. Regression Tests

Regression verification must prove that 001A does not weaken:

- exact quantity coefficient and scale validation;
- Measurement dimension compatibility;
- Active Ingredient requirement for new Lines/publication;
- Standard Output and count-dimensional Standard Yield rules;
- Product and Product Version requirements for publication;
- Published Snapshot deep immutability;
- Published/Superseded Version transition rules;
- Recipe canonical projection and Recipe Costing Contract v2 behavior;
- Architecture boundaries preventing duplicate Recipe, Product, Ingredient, or
  Measurement authorities.

Persistence tests are expected to expose the known Migration 016 mismatch once
Domain repeated-Line behavior exists. That mismatch is a coordinated 001B
prerequisite, not permission to edit persistence or weaken 001A Domain tests.

## 10. Required Verification Commands

A later 001A implementation Work Order must confirm the repository's current
scripts before execution and run at least:

```text
npm run typecheck
npm run lint
npm run build
node --test dist/tests/recipe-domain.test.js dist/tests/recipe-publish.test.js dist/tests/recipe-events.test.js dist/tests/recipe-canonical-projection.test.js dist/tests/recipe-costing-contract-v2.test.js
npm run architecture:guard
npm test
git diff --check
```

If the repository uses different focused-test or Architecture Guard commands,
the implementation report must show the discovered canonical commands rather
than inventing a passing substitute. Full verification remains required at the
integration gate defined by the accepted Proposal.

## 11. Stop Conditions

Stop and report without expanding scope if implementation would require:

1. any Migration or Schema change;
2. persistence records, mapper, repository, Unit of Work, or SQLite changes;
3. server/Application identity generation or durable idempotency;
4. API, Runtime, authorization, UI, or E2E changes;
5. Ingredient lifecycle management or PR-INGREDIENT-003;
6. Product, Ingredient, or Measurement internal-table access;
7. weakening accepted repeated-Ingredient, stable-Line, Product-binding, or
   `ABANDONED` invariants;
8. changing an accepted Recipe Proposal decision;
9. editing a file outside the separately authorized implementation allowlist;
10. unexplained working-tree changes; or
11. reset, rebase, force push, stash, clean, or history rewriting.

The known Migration 016 conflict is not permission to fix persistence inside
001A. It must be reported as the expected coordinated 001B dependency.

## 12. Completion Report Format

A later implementation report must include:

1. baseline branch, starting SHA, implementation branch, and ending HEAD;
2. exact changed files and confirmation of the approved allowlist;
3. Domain identities and invariants implemented;
4. stable Recipe Line operations and repeated-Ingredient behavior;
5. `ABANDONED` lifecycle and Domain event behavior;
6. typed Domain failures added, changed, deprecated, or removed;
7. acceptance and regression tests added or updated;
8. every verification command and result;
9. `git diff --stat`, `git diff --check`, and `git status --short`;
10. known 001B persistence mismatch and all deferred items;
11. confirmation that Migration 016, persistence, Runtime, API, UI, and
    Ingredient 003 were not modified; and
12. confirmation that no commit, push, PR, or next-slice work occurred unless
    separately authorized.

## 13. Authorization Gate

Completion or Owner acceptance of this Task Card does not authorize
implementation. PR-RECIPE-MANAGEMENT-001A requires a separate Owner Work Order
that specifies the exact baseline, clean branch/worktree, final file allowlist,
verification commands, Git permissions, and stop conditions.

PR-RECIPE-MANAGEMENT-001B through 001E remain unauthorized. Ingredient 003
remains deferred and is not a direct dependency of 001A.
