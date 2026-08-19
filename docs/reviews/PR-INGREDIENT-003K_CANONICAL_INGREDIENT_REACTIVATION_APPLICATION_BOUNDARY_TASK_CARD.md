# PR-INGREDIENT-003K — Canonical Ingredient Reactivation Application Boundary

> **OWNER-APPROVED TASK CARD — IMPLEMENTATION NOT AUTHORIZED**

## 1. Authority and baseline

- Decision: **DECISIONS #078 — Canonical Ingredient Reactivation Evidence and Application Boundary**.
- Required implementation baseline: `integration/architecture-development` at the governance recording commit or a later Owner-authorized descendant that contains it.
- This Card is limited to Canonical Ingredient lifecycle reactivation evidence. It is not `main`, release, deployment, a deletion decision, or authorization for any Profile lifecycle change.

## 2. Single responsibility

Provide one management Application command that transitions an existing Archived Canonical Ingredient to Active while recording new immutable Reactivation evidence and retaining every prior Rename and Archive fact.

```text
Active -> Archived -> Active -> Archived -> Active
```

The command restores future Ingredient operational eligibility only. It neither deletes, merges, aliases, resolves identity, modifies Measurement Profiles, nor rewrites Recipe, Quote, Profile, or normalization history.

## 3. Fixed Aggregate lifecycle contract

1. `reactivate(...)` is legal only when the Canonical Ingredient is currently `Archived`.
2. Every Archive and Reactivation creates a new immutable lifecycle event. An earlier Archive event remains available after any later Reactivation.
3. Repeated governed Archive/Reactivation cycles are legal. A Reactivation is not an in-place mutation of Archive evidence and not a restoration of a historical event.
4. Lifecycle event aggregate versions are continuous and strictly ordered. `occurredAt` must be no earlier than the immediately prior event instant; equal instants are permitted and backdating is rejected.
5. Rename, Archive, and Reactivate share one authoritative lifecycle sequence. Renames after Reactivation must replay in their actual aggregate order; no separate competing rename-history truth may remain.
6. The Aggregate alone owns lifecycle state, identity, transition validity, event ordering, audit validation, and current-status projection. The Application Service must not duplicate those rules.
7. Optimistic concurrency uses `expectedVersion` and `saveWithExpectedVersion(...)`. A stale conflict, malformed command, invalid state, lookup failure, or persistence failure performs zero write and no retry.

## 4. Historical and Domain boundaries

- Reactivation restores only the Canonical Ingredient's future operational eligibility.
- It must not reactivate, create, revise, supersede, deprecate, or otherwise modify any Measurement Profile version or aggregate.
- It must not alter Recipe, Quote, pinned Profile Version, or historical normalization evidence. Historical reads remain immutable and resolvable.
- Existing Profile commands remain independently governed. A future Profile mutation after Reactivation must be separately authorized; Reactivation itself invokes no Profile, Recipe, Cost, Purchase, or Snapshot dependency.
- Delete, Merge, aliases, identity resolution, Accepted Purchase authority, Cost Snapshot authority, UI/navigation, and unrelated Cost work are excluded.

## 5. Migration and persistence contract

### 5.1 Migration 018 is required

Migration 014 stores current Archive columns under a constraint that requires Active rows to have no Archive evidence. It therefore cannot represent a durable `Archived -> Active` transition. Clearing those columns is prohibited because it destroys evidence.

Migration 018 must:

1. create `recipe_canonical_ingredient_lifecycle_events` as an append-only ledger;
2. record `ingredient_id`, continuous `aggregate_version`, event type, `occurred_at`, actor, reason, and Rename-specific prior/new-name evidence;
3. deterministically migrate all legacy Rename rows and Archive evidence into the ledger;
4. rebuild the Canonical Ingredient current-state table so status is a projection rather than the sole lifecycle-history store; and
5. leave the new ledger as the only authoritative replay/history source for Rename, Archive, and Reactivate facts.

Legacy rows and columns are migration input only. The final schema must not leave a second active lifecycle ledger or status-toggle shortcut.

### 5.2 Mapper and repository rules

- Mapper hydration replays lifecycle events in continuous aggregate-version order.
- Repository transition validation accepts exactly one legal Aggregate event for one expected-version save.
- The repository must preserve existing public `CanonicalIngredientRepository` shape and CAS behavior.
- No SQLite implementation type, `DatabaseAdapter`, raw error, or persistence detail may enter the Aggregate or Application Service.

## 6. Application and HTTP contract

### Command

```text
POST /api/admin/canonical-ingredients/:ingredientId/reactivate
```

Body:

```json
{
  "expectedVersion": 4,
  "actor": "operator-id",
  "occurredAt": "2026-08-19T00:00:00.000Z",
  "reason": "Operational restoration"
}
```

The encoded path identity is authoritative. Success is HTTP `200`, returning the existing Canonical Ingredient management record.

### Responsibility split

- `CanonicalIngredientLifecycleService`: command-shape coordination, identity parsing, lookup, expected-version check, Aggregate invocation, CAS persistence, and typed safe failures.
- `CanonicalIngredientManagementService`: HTTP body parsing, safe delegation, and HTTP error mapping only.
- `routes.ts`: registers only the approved route.
- The existing server composition remains sufficient; `src/server/index.ts` must not change.

### Stable failure model

| Condition | HTTP | Code |
| --- | ---: | --- |
| malformed command, identity, audit evidence, or version | 422 | `CANONICAL_INGREDIENT_VALIDATION_FAILURE` |
| missing Ingredient | 404 | `CANONICAL_INGREDIENT_NOT_FOUND` |
| current Ingredient is not Archived | 409 | `CANONICAL_INGREDIENT_NOT_ARCHIVED` |
| stale expected version | 409 | `CANONICAL_INGREDIENT_VERSION_CONFLICT` |
| rejected Aggregate transition | 409 | `INVALID_CANONICAL_INGREDIENT_TRANSITION` |
| lookup or persistence technical failure | 500 | `CANONICAL_INGREDIENT_PERSISTENCE_FAILURE` |

No response may expose SQLite/DB text, schema/table names, stack, cause, or infrastructure error detail.

## 7. Exact eighteen-path implementation allowlist

1. `migrations/018_canonical_ingredient_lifecycle_events.sql`
2. `src/domains/recipe/contracts/canonical-ingredient-contract.ts`
3. `src/domains/recipe/contracts/canonical-ingredient-management-contract.ts`
4. `src/domains/recipe/ingredient-catalog/canonical-ingredient.ts`
5. `src/domains/recipe/ingredient-catalog/persistence/records.ts`
6. `src/domains/recipe/ingredient-catalog/persistence/canonical-ingredient-persistence-mapper.ts`
7. `src/domains/recipe/ingredient-catalog/infrastructure/sqlite-canonical-ingredient-repository.ts`
8. `src/domains/recipe/ingredient-catalog/application/errors.ts`
9. `src/domains/recipe/ingredient-catalog/application/canonical-ingredient-lifecycle-service.ts`
10. `src/domains/recipe/index.ts`
11. `src/server/app/canonical-ingredient-management-service.ts`
12. `src/server/app/routes.ts`
13. `src/tests/canonical-ingredient-catalog.test.ts`
14. `src/tests/canonical-ingredient-persistence.integration.test.ts`
15. `src/tests/recipe-migration-018.integration.test.ts`
16. `src/tests/canonical-ingredient-lifecycle-application.test.ts`
17. `src/tests/canonical-ingredient-lifecycle-api.integration.test.ts`
18. `src/tests/architecture-guards.test.ts`

Every other path is prohibited. A nineteenth implementation path is a stop condition.

## 8. Required acceptance evidence

- legacy Migration 014 Active and Archived rows upgrade deterministically;
- legacy Rename and Archive facts migrate once into the authoritative ledger;
- Archive → Reactivate retains both events and produces Active current state;
- repeated Archive/Reactivate cycles, including a Rename after Reactivation, replay with continuous aggregate versions and monotonic event instants;
- archive evidence is never cleared, replaced, or made unavailable by Reactivation;
- malformed, non-Archived, missing, stale-version, read-failure, and persistence-failure paths write nothing and expose only stable safe errors;
- no Profile, Recipe, Quote, normalization, Purchase, Snapshot, Delete, Merge, alias, or UI behavior changes;
- Architecture Guard uses the same substantive responsibility classifier to reject a simulated unapproved nineteenth path; and
- the exact eighteen-path audit, typecheck, lint, build, focused Aggregate/persistence/migration/Application/API tests, existing regressions, `npm test`, `npm run verify`, `npm run verify:full`, compiled collection, UTF-8/final-newline/trailing-whitespace checks, and `git diff --check` pass.

## 9. Stop conditions and exclusions

Stop and return to Owner before implementation if it requires a nineteenth path, an additional migration, package/UI work, a public Repository expansion, Profile mutation, cross-Domain read/write, a different HTTP namespace, or any Delete/Merge/alias/identity-resolution behavior.

This Card does not authorize an implementation branch, source or test edits, implementation commit, PR, merge, main promotion, release, or deployment.
