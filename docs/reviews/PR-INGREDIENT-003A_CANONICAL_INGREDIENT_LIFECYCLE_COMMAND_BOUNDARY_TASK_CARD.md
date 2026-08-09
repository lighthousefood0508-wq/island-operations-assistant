# PR-INGREDIENT-003A — Canonical Ingredient Lifecycle Command Boundary

> **OWNER-APPROVED TASK CARD — IMPLEMENTATION NOT AUTHORIZED**

Status: Owner-approved Task Card — implementation not authorized

Task identifier: `PR-INGREDIENT-003A`

Authoritative Proposal:

`docs/reviews/PR-INGREDIENT-003_CANONICAL_INGREDIENT_LIFECYCLE_APPLICATION_BOUNDARY_PROPOSAL.md`

Accepted Proposal blob:

`35a41567b16a714e154162042fba1ee0f6d160d9`

## Baseline identities

Formal Owner-Accepted Architecture Development Baseline:

`1c31a31030e7c0d29181ebcc5355a706db95dc50`

Task Card drafting and repository-observation base:

`b3f2e5e28ff55f988859c8e438f8128875d80fe7`

Task Card recording base:

`b3f2e5e28ff55f988859c8e438f8128875d80fe7`

These identities have different meanings.

Neither `b3f2e5e...` identity is frozen as the future 003A implementation
base. After the recorded Task Card is merged, a separate 003A implementation
Work Order must fetch and use the then-current remote:

`integration/architecture-development`

The implementation Work Order must not rely on these recording or drafting
SHAs when integration has advanced. No later PR may be relied upon to repair a
stale or non-typecheckable 003A base.

Protected Migration 014 blob:

`5bcc40cddfe9ba14db7dc6a5e8da2d46f41ee23d`

## Task Card recording metadata

- Filename:
  `docs/reviews/PR-INGREDIENT-003A_CANONICAL_INGREDIENT_LIFECYCLE_COMMAND_BOUNDARY_TASK_CARD.md`
- Task Card branch:
  `docs/pr-ingredient-003a-task-card`
- Commit message:
  `docs(governance): add Ingredient 003A command boundary task card`
- PR title:
  `docs(governance): add Ingredient 003A command boundary task card`

These metadata govern this Task Card record. Their presence does not authorize Ingredient implementation, Task Card merge, release, deployment or cleanup. Commit, push and PR creation remain subject to separate Owner authorization.

## 1. Constitution Compatibility Gate

Reviewed authority:

- `CONSTITUTION.md`, Architecture Constitution v3
- DECISIONS #069
- Accepted PR-INGREDIENT-003 Proposal
- Existing Canonical Ingredient public Contract
- Existing Canonical Ingredient Aggregate
- Existing Canonical Ingredient Repository Port
- Existing Migration 014
- Current Repository Policy and Working Guide

Compatibility Result:

`PASS — OWNER-APPROVED TASK CARD; IMPLEMENTATION NOT AUTHORIZED`

003A remains within Canonical Ingredient Identity Authority, currently hosted
in Recipe Core. It adds an Application command boundary over existing Domain
behavior and existing Repository Port operations.

It creates no second Ingredient authority, persistence source, schema,
management-read boundary, Runtime/API boundary or UI authority.

This compatibility result does not authorize implementation.

## 2. Current-code and future-contract provenance

Currently existing public symbols are:

- `CanonicalIngredientContractV1`;
- `CanonicalIngredientIdV1`;
- `CanonicalIngredientStatusV1`.

The following accepted management alias is a future 003A addition and does not
yet exist in current integration:

```ts
export type CanonicalIngredientManagementRecordV1 =
  CanonicalIngredientContractV1;
```

The four proposed new 003A files are currently absent:

1. `src/domains/recipe/contracts/canonical-ingredient-management-contract.ts`
2. `src/domains/recipe/ingredient-catalog/application/canonical-ingredient-lifecycle-service.ts`
3. `src/domains/recipe/ingredient-catalog/application/errors.ts`
4. `src/tests/canonical-ingredient-lifecycle-application.test.ts`

A future implementation Work Order must reverify their absence before
implementation begins.

## 3. Objective

003A publishes the command-facing Canonical Ingredient management contract and
implements Rename and Archive Application commands over the existing
Repository Port.

003A must:

1. preserve immutable Canonical Ingredient identity;
2. preserve append-only Rename and Archive evidence;
3. enforce optimistic concurrency before lifecycle-state outcomes;
4. validate lifecycle-eligible command fields before duplicate lookup or
   Domain transition;
5. expose non-blocking duplicate-name warnings for Rename;
6. require caller-provided actor, occurred-at time and reason;
7. apply exactly one authoritative Domain transition;
8. call `saveWithExpectedVersion` exactly once; and
9. map Domain and persistence failures into stable Application errors.

003A does not add management reads, persistence, API or UI behavior.

## 4. Repository dependency boundary

The Application Service dependency is restricted to this non-exported,
structural alias:

```ts
type CanonicalIngredientLifecycleRepository =
  Pick<
    CanonicalIngredientRepository,
    "findById" | "findDuplicateCandidates" | "saveWithExpectedVersion"
  >;
```

The Service must not receive or expose:

- `saveNew`;
- `searchByName`;
- a concrete SQLite Repository;
- a Database Adapter;
- transaction primitives;
- another Ingredient Repository;
- management-list methods; or
- cross-domain repositories.

The existing `CanonicalIngredientRepository` interface remains unchanged.

Current signatures to be reverified by the future implementation Work Order:

```ts
findById(
  ingredientId: CanonicalIngredientId
): CanonicalIngredient | undefined;

findDuplicateCandidates(
  name: string
): readonly CanonicalIngredient[];

saveWithExpectedVersion(
  ingredient: CanonicalIngredient,
  expectedVersion: number
): number;
```

## 5. Accepted command-facing contract

### 5.1 Future management record

```ts
export type CanonicalIngredientManagementRecordV1 =
  CanonicalIngredientContractV1;
```

This future alias preserves the existing Contract’s established public fields.

### 5.2 Duplicate-warning DTO

```ts
export type CanonicalIngredientDuplicateCandidateV1 = Readonly<
  Pick<
    CanonicalIngredientManagementRecordV1,
    "ingredientId" | "name" | "status"
  >
>;

export type CanonicalIngredientDuplicateWarningV1 = Readonly<{
  code: "DUPLICATE_NAME_WARNING";
  candidates: readonly CanonicalIngredientDuplicateCandidateV1[];
}>;
```

Every candidate contains exactly:

- `ingredientId`;
- `name`;
- `status`.

The wrapper contains only:

- `code`;
- `candidates`.

Duplicate warnings:

- are non-blocking;
- exclude the current Ingredient ID;
- expose no normalization algorithm;
- expose no similarity score;
- expose no SQL behavior;
- establish no identity;
- perform no automatic selection; and
- authorize no merge.

### 5.3 Commands

```ts
export type RenameCanonicalIngredientCommandV1 = Readonly<{
  ingredientId: string;
  newName: string;
  expectedVersion: number;
  actor: string;
  occurredAt: string;
  reason: string;
}>;

export type ArchiveCanonicalIngredientCommandV1 = Readonly<{
  ingredientId: string;
  expectedVersion: number;
  actor: string;
  occurredAt: string;
  reason: string;
}>;
```

### 5.4 Results

```ts
export type RenameCanonicalIngredientResultV1 = Readonly<{
  ingredient: CanonicalIngredientManagementRecordV1;
  warnings: readonly CanonicalIngredientDuplicateWarningV1[];
}>;

export type ArchiveCanonicalIngredientResultV1 = Readonly<{
  ingredient: CanonicalIngredientManagementRecordV1;
}>;
```

Archive returns no duplicate warning.

## 6. Accepted Application Service API

```ts
export class CanonicalIngredientLifecycleService {
  constructor(repository: CanonicalIngredientLifecycleRepository);

  rename(
    command: RenameCanonicalIngredientCommandV1
  ): RenameCanonicalIngredientResultV1;

  archive(
    command: ArchiveCanonicalIngredientCommandV1
  ): ArchiveCanonicalIngredientResultV1;
}
```

The methods remain synchronous because the existing Repository Port is
synchronous.

Successful calls return their accepted result DTOs.

Failed calls throw one of the seven accepted typed Application errors. Failure
paths do not return error DTOs or error result unions.

## 7. Exact current Domain validation constraints

### 7.1 Rename name

Current Domain behavior:

1. calls `trim()` on `newName`;
2. rejects an empty trimmed value;
3. rejects a trimmed value equal to the current authoritative name;
4. records the trimmed value after a successful transition.

There is currently:

- no length limit;
- no character-set constraint;
- no case-folding rule;
- no Unicode normalization rule beyond `trim()`.

### 7.2 Actor

Current Domain `AuditInput.actorId` is a string.

The Domain:

1. calls `trim()`;
2. rejects an empty trimmed value;
3. records the trimmed value as `renamedBy` or `archivedBy`.

There is no current length limit or identity verification.

### 7.3 Occurred-at time

Current Domain `AuditInput.occurredAt` is a string.

It must satisfy:

1. `Date.parse(value)` is finite;
2. `new Date(milliseconds).toISOString() === value`;
3. the parsed instant is not earlier than the latest audit instant.

The latest audit instant is:

- the last Rename fact’s `renamedAt`; or
- `createdAt` when no Rename fact exists.

Equality with the latest audit instant is currently allowed.

The canonical ISO string is passed through unchanged after validation.

### 7.4 Reason

Current Domain `AuditInput.reason` is a string.

The Domain:

1. calls `trim()`;
2. rejects an empty trimmed value;
3. records the trimmed value.

There is no current length limit.

## 8. Private pure Application prevalidation

Private, pure prevalidation may exist only inside:

`src/domains/recipe/ingredient-catalog/application/canonical-ingredient-lifecycle-service.ts`

No separate validation file is authorized.

The prevalidation must:

1. match the current Domain constraints in Section 7 exactly;
2. perform no Aggregate mutation;
3. perform no lifecycle evaluation;
4. perform no Repository write;
5. generate no fallback actor, time or reason;
6. generate no replacement audit evidence;
7. preserve the original canonical `occurredAt` string;
8. pass the original command values to the Domain transition; and
9. throw `CanonicalIngredientLifecycleValidationFailure` on failure.

The Domain must still revalidate authoritatively when `rename()` or
`archive()` is called.

Domain validation must not be removed, bypassed or replaced.

For Rename, invalid:

- `newName`;
- actor;
- `occurredAt`;
- reason; or
- audit-time ordering

must throw before `findDuplicateCandidates`, Domain transition or save.

For Archive, invalid:

- actor;
- `occurredAt`;
- reason; or
- audit-time ordering

must throw before Domain transition or save.

## 9. Exact audit mapping

The existing Domain uses:

```ts
type AuditInput = Readonly<{
  occurredAt: string;
  actorId: string;
  reason: string;
}>;
```

Application mapping:

```ts
{
  actorId: command.actor,
  occurredAt: command.occurredAt,
  reason: command.reason
}
```

Rules:

- `actor` maps only to `actorId`;
- `occurredAt` maps only to `occurredAt`;
- `reason` maps only to `reason`;
- canonical `occurredAt` passes unchanged;
- actor and reason are recorded using existing Domain trimming;
- no clock, actor or reason fallback is permitted;
- no second audit-evidence model is introduced.

Actor metadata remains caller-reported and unverified. It is not
authentication, authorization, verified operator identity or trusted security
evidence.

## 10. Input, version and lifecycle precedence

The current persistence implementation accepts `expectedVersion` only when:

```ts
Number.isSafeInteger(expectedVersion) && expectedVersion >= 0
```

Every Rename or Archive command must follow:

1. Parse `ingredientId`.
2. If parsing fails, throw
   `CanonicalIngredientLifecycleValidationFailure` without a Repository call.
3. Load with `findById`.
4. If absent, throw `CanonicalIngredientLifecycleNotFound`.
5. Validate `expectedVersion` as a safe integer `>= 0`.
6. If malformed, throw
   `CanonicalIngredientLifecycleValidationFailure`.
7. Compare the valid version with loaded `aggregateVersion`.
8. If different, throw
   `CanonicalIngredientLifecycleVersionConflict`.
9. Only after a matching version, evaluate lifecycle state.
10. For matching-version Archived Archive, throw
    `CanonicalIngredientAlreadyArchived` without duplicate lookup, transition
    or save.
11. For matching-version Archived Rename, throw
    `CanonicalIngredientArchivedRenameRejected` without duplicate lookup,
    transition or save.
12. For a lifecycle-eligible command, execute the private pure prevalidation.
13. Evaluate duplicate warnings where relevant.
14. Apply exactly one Domain transition.
15. Call `saveWithExpectedVersion` exactly once.
16. Map a typed persistence CAS conflict to
    `CanonicalIngredientLifecycleVersionConflict`.

Consequences:

- malformed version throws Validation Failure, not Version Conflict;
- parseable missing identity throws Not Found before version validation;
- valid stale version precedes lifecycle evaluation;
- valid stale version precedes remaining-field validation;
- matching-version terminal outcomes precede remaining-field validation;
- no invalid command performs duplicate lookup, transition or save.

## 11. Duplicate-warning cardinality and ordering

After removing the current Ingredient ID:

### Zero candidates

```ts
warnings: []
```

No empty `DUPLICATE_NAME_WARNING` wrapper is returned.

### One or more candidates

Return exactly one warning:

```ts
warnings: [{
  code: "DUPLICATE_NAME_WARNING",
  candidates: remainingCandidates
}]
```

The single warning contains the complete remaining candidate collection.

003A must not:

- return one warning per candidate;
- return an empty warning wrapper;
- sort or rank candidates;
- introduce similarity scoring; or
- alter Repository ordering.

Candidate order remains exactly as returned by `findDuplicateCandidates`,
except for removal of the current identity.

## 12. Accepted Application errors and complete mapping

| Application class | Stable code |
| --- | --- |
| `CanonicalIngredientLifecycleNotFound` | `CANONICAL_INGREDIENT_NOT_FOUND` |
| `CanonicalIngredientLifecycleVersionConflict` | `CANONICAL_INGREDIENT_VERSION_CONFLICT` |
| `CanonicalIngredientAlreadyArchived` | `CANONICAL_INGREDIENT_ALREADY_ARCHIVED` |
| `CanonicalIngredientArchivedRenameRejected` | `CANONICAL_INGREDIENT_ARCHIVED_RENAME_REJECTED` |
| `InvalidCanonicalIngredientLifecycleTransition` | `INVALID_CANONICAL_INGREDIENT_TRANSITION` |
| `CanonicalIngredientLifecycleValidationFailure` | `CANONICAL_INGREDIENT_VALIDATION_FAILURE` |
| `CanonicalIngredientLifecyclePersistenceFailure` | `CANONICAL_INGREDIENT_PERSISTENCE_FAILURE` |

Operational mapping:

1. malformed Ingredient ID, malformed version, invalid name or invalid caller
   audit evidence throws
   `CanonicalIngredientLifecycleValidationFailure`;
2. a parseable missing identity throws
   `CanonicalIngredientLifecycleNotFound`;
3. a loaded Aggregate version mismatch throws
   `CanonicalIngredientLifecycleVersionConflict`;
4. a persistence `CanonicalIngredientVersionConflict` thrown specifically by
   `saveWithExpectedVersion` is caught by its typed class and mapped to
   `CanonicalIngredientLifecycleVersionConflict`;
5. matching-version Archived Archive throws
   `CanonicalIngredientAlreadyArchived`;
6. matching-version Archived Rename throws
   `CanonicalIngredientArchivedRenameRejected`;
7. any other recognized Domain lifecycle rejection throws
   `InvalidCanonicalIngredientLifecycleTransition`;
8. an authoritative Domain validation failure encountered when the single
   Domain transition revalidates the command throws
   `CanonicalIngredientLifecycleValidationFailure`;
9. unexpected failures from:
   - `findById`;
   - `findDuplicateCandidates`; or
   - `saveWithExpectedVersion`, except the recognized typed CAS conflict,
   throw `CanonicalIngredientLifecyclePersistenceFailure`.

CAS classification must use the current typed
`CanonicalIngredientVersionConflict` convention.

003A must not classify errors by inspecting or pattern-matching:

- raw error messages;
- raw stack text;
- SQLite message fragments; or
- implementation-specific string content.

Raw-failure containment:

1. exported Application errors expose no raw failure through `cause`;
2. they expose no other raw-error property;
3. their message does not copy or concatenate a raw Repository, SQLite or
   persistence message;
4. their Application stack does not copy or chain a raw persistence stack;
5. result DTOs contain no raw failure;
6. serialized data contains no raw failure.

A newly constructed Application error may retain its normal JavaScript
Application-level `.stack`.

003A contains no Runtime or transport serializer. Suppression of Application
stacks from HTTP, logs or UI belongs to a future authorized adapter boundary.

## 13. Rename behavior

For an Active Ingredient with a matching valid version:

1. prevalidate `newName`, actor, `occurredAt`, reason and audit ordering;
2. call `findDuplicateCandidates(newName)` once;
3. remove every candidate matching the current Ingredient ID;
4. preserve the order of remaining candidates;
5. construct zero or exactly one warning wrapper;
6. apply exactly one Domain Rename;
7. call `saveWithExpectedVersion` exactly once; and
8. return the management record and warnings.

Duplicate candidates never block a valid Rename.

## 14. Archive behavior

For an Active Ingredient with a matching valid version:

1. prevalidate actor, `occurredAt`, reason and audit ordering;
2. perform no duplicate lookup;
3. apply exactly one Domain Archive;
4. call `saveWithExpectedVersion` exactly once; and
5. return the archived management record.

Archive preserves every pre-existing Canonical Ingredient Contract field and
all prior Rename evidence, except for transition-defined changes to:

- status;
- Aggregate version; and
- Archive evidence.

003A must not invent a new field or rewrite unrelated evidence.

## 15. Contract immutability semantics

003A public-contract immutability means:

- `Readonly<...>`;
- readonly arrays and collections;
- no mutating methods exposed by the Contract.

003A does not require new runtime `Object.freeze()` or deep-freezing behavior.

Tests use type/source or Architecture Guard evidence for readonly declarations.
They must not require `Object.isFrozen(...)`.

Existing Domain identity, append-only evidence and pre-existing Domain freezing
behavior remain unchanged.

## 16. Exact six-path implementation allowlist

Exactly these paths may be permitted by a future implementation Work Order:

1. Add:
   `src/domains/recipe/contracts/canonical-ingredient-management-contract.ts`
2. Add:
   `src/domains/recipe/ingredient-catalog/application/canonical-ingredient-lifecycle-service.ts`
3. Add:
   `src/domains/recipe/ingredient-catalog/application/errors.ts`
4. Modify:
   `src/domains/recipe/index.ts`
5. Add:
   `src/tests/canonical-ingredient-lifecycle-application.test.ts`
6. Modify:
   `src/tests/architecture-guards.test.ts`

No conditional, wildcard or additional path is allowed.

## 17. Scoped additive public-export rule

The 003A change to `src/domains/recipe/index.ts` may add only:

- accepted management Contract and DTO types;
- accepted command and result types;
- seven accepted Application error classes;
- `CanonicalIngredientLifecycleService`.

Every legitimate pre-existing public export must remain unchanged.

003A must not:

- remove an existing public export;
- rename an existing public export;
- narrow an existing public export;
- rewrite an existing export;
- reorder existing exports for semantic effect;
- clean up or redesign the Recipe public index.

The only new 003A module/export surface may come from:

- the accepted management Contract file;
- the accepted lifecycle Application service file;
- the accepted Application errors file.

003A must not newly export:

- the Repository dependency alias;
- Aggregate internals;
- `CanonicalIngredientRepository`;
- `CanonicalIngredientId`;
- SQLite Repository;
- persistence mapper, records or errors;
- Database Adapter;
- transaction authority; or
- unrelated internals.

Required evidence:

1. At implementation start, capture the exact pre-existing public-export
   inventory from the reverified integration base.
2. Architecture Guard must assert that every captured legitimate pre-existing
   export remains present.
3. Architecture Guard must permit only the exact accepted new 003A surface.
4. Focused source tests must assert the accepted new exports exist and
   forbidden new exports do not exist.
5. The implementation report must provide the exact
   `src/domains/recipe/index.ts` base-to-candidate diff.
6. That diff must be additive only except for formatting strictly necessary to
   insert the accepted export statements.
7. No pre-existing export may change semantic identity or module source.

## 18. Architecture Guard requirements

The Architecture Guard must:

1. enforce the scoped additive public-export rule;
2. preserve every legitimate pre-existing public export;
3. permit only the accepted new 003A exports;
4. preserve the prohibition against other `ingredient-catalog` internals;
5. prove the dependency is the three-operation `Pick`;
6. reject `saveNew`, `searchByName`, management-list and generic-save
   authority;
7. reject SQLite Infrastructure, persistence and Database Adapter imports;
8. reject Cost, Recipe Aggregate, Measurement and Profile internals;
9. prove no API, Runtime, UI, migration or schema authority is introduced;
10. prove readonly Contract declarations without requiring runtime freezing;
11. prove exported Application errors expose no raw cause or raw-error
    property;
12. preserve all existing guards; and
13. remain inside the exact six-path diff.

No existing guard may be weakened merely to make the new boundary pass.

## 19. Required focused tests

### Input and precedence

1. malformed Ingredient ID throws Validation Failure;
2. malformed ID performs no Repository call;
3. parseable missing ID throws Not Found even with malformed version;
4. existing identity plus malformed version throws Validation Failure;
5. malformed version performs no transition or save;
6. valid version means safe integer `>= 0`;
7. valid stale version precedes lifecycle evaluation;
8. valid stale version precedes invalid name, actor, time and reason;
9. matching Archived Archive throws
   `CanonicalIngredientAlreadyArchived`;
10. matching Archived Archive performs no lookup, transition or save;
11. matching Archived Rename throws
    `CanonicalIngredientArchivedRenameRejected`;
12. matching Archived Rename performs no lookup, transition or save.

### Pure prevalidation

13. blank or unchanged Rename name throws before duplicate lookup;
14. blank actor throws before lookup, transition or save;
15. noncanonical time throws before lookup, transition or save;
16. time earlier than latest evidence throws before lookup, transition or save;
17. blank reason throws before lookup, transition or save;
18. Archive invalid actor, time or reason performs no transition or save;
19. Domain still revalidates when the transition is applied.

### Successful lifecycle behavior

20. successful Rename returns the accepted Rename result DTO;
21. Rename preserves Ingredient ID;
22. Rename appends evidence and increments version;
23. successful Archive returns the accepted Archive result DTO;
24. Archive preserves every prior Contract field except transition-defined
    changes;
25. Archive preserves complete Rename history;
26. Archive appends evidence and increments version;
27. exactly one Domain transition occurs;
28. exactly one save occurs;
29. Archive performs no duplicate lookup.

### Duplicate warnings

30. current identity is excluded;
31. zero candidates returns no warning wrapper;
32. one candidate returns exactly one wrapper;
33. multiple candidates still return exactly one wrapper;
34. the wrapper contains the complete remaining collection;
35. candidate order is preserved;
36. candidate DTOs expose exactly `ingredientId`, `name` and `status`;
37. warnings remain non-blocking.

### Audit evidence

38. actor maps to `actorId`;
39. canonical time passes unchanged;
40. reason is preserved semantically;
41. no fallback evidence is generated.

### Complete error mapping

42. unexpected `findById` failure throws
    `CanonicalIngredientLifecyclePersistenceFailure`;
43. unexpected duplicate-query failure throws
    `CanonicalIngredientLifecyclePersistenceFailure`;
44. unexpected non-CAS save failure throws
    `CanonicalIngredientLifecyclePersistenceFailure`;
45. typed persistence CAS conflict thrown by `saveWithExpectedVersion` throws
    only `CanonicalIngredientLifecycleVersionConflict`;
46. authoritative Domain validation failure during revalidation throws
    `CanonicalIngredientLifecycleValidationFailure`;
47. another recognized Domain lifecycle rejection throws
    `InvalidCanonicalIngredientLifecycleTransition`;
48. every mapped failure is the correct accepted class and stable code;
49. no mapping classifies a failure by raw message or stack matching;
50. no public `cause` exists;
51. no raw-error property exists;
52. raw persistence message is absent from the Application message;
53. raw persistence stack is not copied or chained into the Application stack;
54. result DTOs contain no raw failure.

### Contract, exports and architecture

55. Repository Port source is unchanged;
56. service dependency exposes only three accepted operations;
57. readonly declarations and collections are present;
58. no test requires runtime `Object.isFrozen`;
59. only the accepted new 003A public surface was added;
60. all legitimate pre-existing public exports remain unchanged;
61. forbidden Repository, persistence and internal exports remain absent;
62. Architecture Guard protects the boundary without weakening existing guards.

## 20. Required future verification

Before implementation, the Work Order must reverify:

1. then-current remote integration Head;
2. Proposal blob;
3. Migration 014 blob;
4. exact Repository signatures;
5. exact six-path allowlist;
6. absence of the four proposed new files;
7. exact pre-existing Recipe public-export inventory;
8. every Repository implementer and fixture remains independently
   typecheckable;
9. current package scripts;
10. focused and complete test commands;
11. Architecture Guard count and current boundary.

Required separately reported commands, subject to reinspection:

```text
npm run typecheck
npm run lint
npm run build
node --test dist/tests/canonical-ingredient-lifecycle-application.test.js
node --test dist/tests/canonical-ingredient-catalog.test.js
node --test dist/tests/canonical-ingredient-persistence.integration.test.js
npm run architecture:guard
npm test
npm run verify
npm run verify:full
git diff --check
```

A complete repository execution must separately enumerate every compiled
`dist/tests/*.test.js` file and report:

- selected file count;
- pass count;
- fail count;
- skipped count;
- todo count; and
- cancelled count.

The following remain distinct overlapping selections:

- focused tests;
- `npm test`;
- `npm run verify`;
- `npm run verify:full`;
- manually enumerated complete test execution.

Their counts must not be added into a fictional total.

If future reinspection finds a command removed or renamed, stop and report the
discrepancy rather than inventing a replacement.

## 21. Explicit exclusions

003A excludes:

- Repository management-list methods;
- Active or Archived management reads;
- Repository Port modification;
- SQLite Repository modification;
- Repository fixture modification;
- persistence integration implementation;
- Database Adapter or transaction modification;
- API or Runtime routes;
- server adapter;
- composition root;
- UI, UI routes and navigation;
- Reference Impact Coordinator;
- Reactivation;
- deletion;
- Ingredient merge or aliases;
- automatic identity resolution;
- name uniqueness constraints;
- authentication or authorization;
- verified operator identity;
- Migration 014 modification;
- any migration or schema change;
- Ingredient 003B or 003C;
- Recipe 001C through 001E;
- Cost Snapshot;
- Supplier, Purchase, Package or Inventory work;
- architecture cleanup;
- security remediation;
- unrelated governance synchronization;
- main promotion;
- release or deployment;
- branch or worktree cleanup.

## 22. Protected paths

A future implementation must leave unchanged:

- accepted Ingredient Proposal;
- Migration 014;
- `CanonicalIngredientRepository`;
- SQLite Canonical Ingredient Repository;
- existing Repository fixtures;
- all governance records;
- every path outside the exact six-file allowlist.

## 23. Stop conditions

Stop without expanding scope if implementation requires:

1. changing the Repository Port;
2. changing SQLite persistence or a fixture;
3. changing a migration or schema;
4. changing Runtime, API, composition or UI;
5. adding a seventh path;
6. creating another Ingredient authority;
7. approximating rather than matching Domain prevalidation;
8. removing or bypassing Domain revalidation;
9. weakening malformed-input or version-first precedence;
10. returning an error DTO instead of throwing an accepted typed error;
11. allowing a terminal outcome to hide a stale conflict;
12. performing duplicate lookup for an invalid eligible command;
13. blocking Rename because duplicate candidates exist;
14. reordering duplicate candidates;
15. generating fallback evidence;
16. inspecting raw messages or stack text to classify CAS conflict;
17. exposing or chaining a raw persistence failure;
18. adding runtime freezing solely for 003A;
19. removing, narrowing, renaming or semantically changing a pre-existing
    public export;
20. adding an unaccepted public export;
21. changing an accepted Proposal or Task Card decision;
22. relying on 003B, 003C or another later PR to restore compilation;
23. weakening an Architecture Guard;
24. finding a dependency that makes the six-file boundary non-typecheckable;
25. needing another public type or behavior;
26. encountering unexpected workspace, branch, migration or Proposal state; or
27. needing authentication, authorization, Reference Impact, Reactivation,
    deletion or merge behavior.

## 24. Governance and implementation gates

1. Owner accepted the corrected response-only Task Card. **COMPLETE**
2. Owner authorized Task Card recording using the reverified Git base.
   **COMPLETE**
3. Recorded Task Card receives independent read-only review.
4. Owner separately authorizes Task Card merge.
5. Owner issues a dedicated 003A implementation Work Order using the
   then-current remote integration Head.
6. Implementation stops at its pre-commit Gate.
7. Owner separately authorizes commit, push and PR.
8. Implementation PR receives independent read-only review.
9. Owner separately decides implementation merge.
10. Post-merge verification is separately accepted.

Completion of any Gate does not authorize the next.

003B and 003C remain unauthorized.

## 25. Required future implementation report

The pre-commit report must include:

1. fetched remote integration Head and exact implementation base;
2. Proposal and Migration 014 blob verification;
3. confirmation the four new paths were absent at implementation start;
4. exact six-path diff and statistics;
5. accepted Contract and service signatures;
6. seven Application errors and complete operational mapping;
7. proof failures throw rather than return typed errors;
8. malformed-input, Not Found, version and lifecycle precedence;
9. pure prevalidation and retained Domain revalidation;
10. zero side effects for invalid and terminal commands;
11. exact audit mapping;
12. warning cardinality and ordering;
13. Repository call counts;
14. raw-failure containment and typed CAS classification;
15. readonly Contract evidence without new freezing;
16. complete pre-existing public-export inventory;
17. additive-only Recipe index diff;
18. Architecture Guard changes and non-weakening proof;
19. every verification result with separate provenance;
20. complete all-file test results;
21. `git diff --check` and complete status;
22. confirmation all excluded paths remained unchanged; and
23. every discrepancy, failure or uncertainty.

Current status:

**OWNER-APPROVED TASK CARD — IMPLEMENTATION NOT AUTHORIZED**
