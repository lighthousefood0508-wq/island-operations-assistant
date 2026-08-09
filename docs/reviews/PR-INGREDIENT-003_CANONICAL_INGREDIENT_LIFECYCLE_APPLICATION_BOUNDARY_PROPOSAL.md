# PR-INGREDIENT-003 Proposal: Canonical Ingredient Lifecycle Application Boundary

> **OWNER-ACCEPTED PROPOSAL RECORD**
>
> **PROPOSAL ONLY — NOT AN IMPLEMENTATION WORK ORDER**

Status: Owner accepted proposal
Document type: Proposal-only governance record
Architecture Owner: Miles / Lin Zi-Mao

Formal Owner-Accepted Architecture Development Baseline:

`1c31a31030e7c0d29181ebcc5355a706db95dc50`

Proposal drafting and repository-observation Git base:

`2bd115ed2b78e10d549dabe38b28f6c824aaf65b`

Historical draft provenance:

`43a7fbbf484b71017aaf584d53b76c6f85cbcf24`

The historical SHA is retained only as provenance of the earlier draft. It is
not the current proposed implementation base.

The current integration Git Head does not replace or redesignate the formal
Architecture Development Baseline.

This Proposal creates no implementation, branch, file-modification, migration,
commit, push, PR, release or deployment authority. PR-INGREDIENT-003A, 003B and
003C each require their own Owner-approved Task Card, current Git-base check,
exact allowlist, verification and Git authorization.

## 1. Purpose

The existing Canonical Ingredient foundation provides:

- immutable `ing_<uuid>` identity;
- one authoritative display name and category code;
- `Active -> Archived` as the only approved lifecycle transition;
- Rename and Archive Domain behavior;
- append-only rename and archive evidence;
- optimistic concurrency through `aggregateVersion`;
- a Domain-owned Repository Port;
- SQLite persistence under immutable Migration 014;
- Active-only candidate search; and
- formal Ingredient creation through Cost Back Office composition.

The missing capability is a complete lifecycle management boundary:

- no Rename or Archive Application command service;
- no explicit Active/Archived management-read contract;
- no lifecycle management Runtime/API;
- no lifecycle management UI.

This Proposal separates that work into three independently typecheckable PRs.

Reference Impact coordination, deletion eligibility, Reactivation, permanent
deletion and Ingredient merge remain excluded.

## 2. Governance and authority boundary

Canonical Ingredient Identity Authority is an independent authority currently
hosted in Recipe Core. Hosting does not make it Recipe-owned.

Recipe, Cost, Purchase, Supplier, Inventory and Prototype code must not create
a second Canonical Ingredient authority.

Binding rules:

1. The only lifecycle transition is `Active -> Archived`.
2. Rename preserves Ingredient ID and historical references.
3. Rename facts and Archive evidence remain append-only.
4. Duplicate equal or normalized names are warning candidates only.
5. Duplicate candidates do not block create or Rename.
6. Duplicate candidates do not establish identity or authorize merge.
7. Archived identities remain readable for historical evidence.
8. Archived identities cannot be renamed.
9. Reactivation, deletion and merge are not approved.
10. Reference Impact Coordinator and deletion eligibility are separate work.
11. Migration 014, schema redesign and data migration are excluded.
12. Actor metadata remains caller-reported and unverified.
13. DECISIONS #069 supplies governance boundaries only, not implementation
    authority.

## 3. Existing repository evidence

At repository-observation Head `2bd115ed...`:

- `CanonicalIngredient.rename(...)` and `.archive(...)` enforce Domain
  lifecycle and audit invariants.
- `CanonicalIngredientRepository` already exposes:
  - `findById`;
  - `findDuplicateCandidates`;
  - `saveWithExpectedVersion`.
- `SqliteCanonicalIngredientRepository` implements that Port.
- `SqliteCanonicalIngredientRepository.listActive()` is a concrete-adapter
  convenience, not a published management-read Port.
- `ContractFixture` in `canonical-ingredient-catalog.test.ts` also implements
  the Repository Port.
- `/api/admin/cost/ingredients` is an existing Cost Back Office
  creation-composition endpoint.
- `/api/admin/cost/setup` returns Active Ingredients only.
- No shared duplicate-warning DTO currently exists.
- Existing Canonical Ingredient contract fields use:
  - `ingredientId`;
  - `name`;
  - `status`;
  - `aggregateVersion`;
  - `archiveFact`.
- `routes.ts` uses service objects and maps `HttpError` to the existing
  `{ ok, data | error }` envelope.
- `server/index.ts` is the current composition root.
- Migration 014 blob remains:
  `5bcc40cddfe9ba14db7dc6a5e8da2d46f41ee23d`.

## 4. Shared command-facing contract

003A may publish the following command-facing management contract by reusing
the existing Canonical Ingredient contract rather than creating incompatible
field names:

```ts
export type CanonicalIngredientManagementRecordV1 =
  CanonicalIngredientContractV1;
```

The management contract therefore retains the established names `status` and
`archiveFact`. It does not introduce competing `lifecycleStatus` or
`archiveEvidence` fields.

## 5. Duplicate-warning DTO

No existing shared duplicate-warning DTO was found. 003A may establish exactly
one shared Application DTO:

```ts
export type CanonicalIngredientDuplicateCandidateV1 = Readonly<{
  ingredientId: CanonicalIngredientIdV1;
  name: string;
  status: CanonicalIngredientStatusV1;
}>;

export type CanonicalIngredientDuplicateWarningV1 = Readonly<{
  code: "DUPLICATE_NAME_WARNING";
  candidates: readonly CanonicalIngredientDuplicateCandidateV1[];
}>;

export type RenameCanonicalIngredientResultV1 = Readonly<{
  ingredient: CanonicalIngredientManagementRecordV1;
  warnings: readonly CanonicalIngredientDuplicateWarningV1[];
}>;
```

The field names reuse the existing canonical contract convention.

The DTO exposes only:

- Canonical Ingredient ID;
- current display name;
- lifecycle status.

It exposes no normalization algorithm, similarity score, SQL behavior,
automatic selection or merge instruction.

Warnings remain non-blocking. The current Ingredient must be excluded from its
own warning candidates.

## 6. Command DTOs and actor metadata

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

`actor`, `occurredAt` and `reason` are caller-supplied append-only evidence.

The Application Service maps `actor` to the Domain audit field `actorId`.
Neither Application nor Runtime may generate fallback actor, time or reason.

Actor data is caller-reported metadata only. It is not:

- authenticated identity;
- verified operator identity;
- authorization evidence;
- a trusted security-audit principal.

This Proposal introduces no authentication, authorization or user-management
boundary.

## 7. Required application order and error precedence

Every Rename or Archive command follows this order:

1. Parse and load the Canonical Ingredient.
2. Return `NotFound` when no identity exists.
3. Compare `expectedVersion` with the loaded `aggregateVersion`.
4. Return `VersionConflict` when they differ.
5. Only after a version match, evaluate lifecycle state.
6. Validate the requested command and caller evidence.
7. Evaluate duplicate-name warnings where relevant.
8. Persist once using `saveWithExpectedVersion`.
9. Map a persistence compare-and-swap conflict to `VersionConflict`.

Consequences:

- Archived＋stale expected version:
  `VersionConflict`.
- Archived＋matching expected version for Archive:
  `AlreadyArchived`.
- Archived＋matching expected version for Rename:
  `CanonicalIngredientArchivedRenameRejected`.
- `AlreadyArchived` must never hide a stale-version conflict.

Proposed stable Application outcomes:

| Outcome | Stable code | Meaning |
| --- | --- | --- |
| NotFound | `CANONICAL_INGREDIENT_NOT_FOUND` | Identity does not exist |
| VersionConflict | `CANONICAL_INGREDIENT_VERSION_CONFLICT` | Loaded or persisted version differs |
| AlreadyArchived | `CANONICAL_INGREDIENT_ALREADY_ARCHIVED` | Matching-version Archive requested for Archived identity |
| Archived Rename rejected | `CANONICAL_INGREDIENT_ARCHIVED_RENAME_REJECTED` | Matching-version Rename requested for Archived identity |
| Invalid transition | `INVALID_CANONICAL_INGREDIENT_TRANSITION` | Other Domain transition rejection |
| Validation failure | `CANONICAL_INGREDIENT_VALIDATION_FAILURE` | Invalid ID, name, version or evidence |
| Persistence failure | `CANONICAL_INGREDIENT_PERSISTENCE_FAILURE` | Unexpected rolled-back persistence failure |

The exact typed Application error for matching-version Rename of an Archived
identity is:

```ts
CanonicalIngredientArchivedRenameRejected
```

Raw SQLite errors and stack traces must not cross the Application or HTTP
boundary.

## 8. PR-INGREDIENT-003A — Command boundary only

Responsibility:

Publish the command-facing contract and implement Rename and Archive
Application commands over existing Repository Port operations.

003A uses only:

- `findById`;
- `findDuplicateCandidates`;
- `saveWithExpectedVersion`.

The command service dependency should be narrowed to those existing operations,
for example through a `Pick<CanonicalIngredientRepository, ...>` type. It must
not create a second Repository authority.

003A includes:

- management record alias required by command results;
- duplicate-warning DTO;
- Rename command and result;
- Archive command and result;
- typed Application errors;
- version-first error precedence;
- command unit tests;
- strictly necessary public exports;
- Architecture Guard coverage for the new boundary.

003A excludes:

- Repository Port management-list methods;
- `listActiveForManagement`;
- `listArchivedForManagement`;
- management list/read service;
- SQLite Repository changes;
- existing Repository fixture changes;
- persistence integration;
- Runtime/API routes;
- UI/navigation;
- migration/schema;
- Reference Impact coordination.

### Exact proposed 003A allowlist

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

No other path is proposed for 003A.

## 9. PR-INGREDIENT-003B — Atomic management read, persistence and API

Responsibility:

Add explicit management reads to the Repository Port, implement every changed
interface atomically, expose the management Application boundary through one
exact API namespace, and provide persistence/API verification.

Repository methods proposed in 003B:

```ts
listActiveForManagement(): readonly CanonicalIngredient[];
listArchivedForManagement(): readonly CanonicalIngredient[];
```

These methods have explicit meanings. No `includeArchived` boolean is
introduced.

003B must change in the same PR:

- Repository Port;
- production SQLite implementation;
- every existing test fixture implementing the Port;
- persistence integration coverage;
- management read service;
- server DTO/error adapter;
- Runtime route service type;
- composition root;
- API routes and API integration tests;
- necessary exports;
- Architecture Guards.

### Server adapter conclusion

A dedicated server adapter is required:

`src/server/app/canonical-ingredient-management-service.ts`

Repository evidence:

- current routes receive composed service objects;
- raw JSON validation and `HttpError` mapping are server concerns;
- the Domain Application Service must not accept unvalidated arbitrary JSON;
- putting all parsing and error translation directly in `routes.ts` would mix
  HTTP mapping with the Domain Application boundary.

The server adapter is therefore explicitly included. It is not conditional.

### Exact proposed API namespace

Management API namespace:

`/api/admin/canonical-ingredients`

The existing `/api/admin/cost/ingredients` route remains the pre-existing Cost
Back Office creation-composition endpoint. 003B adds no second create route and
does not move creation authority.

The management namespace owns only management reads and lifecycle commands:

| Method | Exact path | Purpose |
| --- | --- | --- |
| GET | `/api/admin/canonical-ingredients?lifecycle=all` | Active and Archived management list |
| GET | `/api/admin/canonical-ingredients?lifecycle=active` | Active management list |
| GET | `/api/admin/canonical-ingredients?lifecycle=archived` | Archived management list |
| GET | `/api/admin/canonical-ingredients/:ingredientId` | Active or Archived detail |
| POST | `/api/admin/canonical-ingredients/:ingredientId/rename` | Rename command |
| POST | `/api/admin/canonical-ingredients/:ingredientId/archive` | Archive command |

List default: `lifecycle=all`.

Invalid lifecycle filter returns typed validation failure. Empty lists return
`200` with an empty array.

These are API paths only. They do not establish a UI route.

### Exact proposed 003B allowlist

1. Modify:
   `src/domains/recipe/ingredient-catalog/canonical-ingredient-repository.ts`
2. Modify:
   `src/domains/recipe/ingredient-catalog/infrastructure/sqlite-canonical-ingredient-repository.ts`
3. Add:
   `src/domains/recipe/ingredient-catalog/application/canonical-ingredient-management-read-service.ts`
4. Modify:
   `src/domains/recipe/index.ts`
5. Add:
   `src/server/app/canonical-ingredient-management-service.ts`
6. Modify:
   `src/server/app/routes.ts`
7. Modify:
   `src/server/index.ts`
8. Modify:
   `src/tests/canonical-ingredient-catalog.test.ts`
9. Modify:
   `src/tests/canonical-ingredient-persistence.integration.test.ts`
10. Modify:
    `src/tests/canonical-ingredient-lifecycle-application.test.ts`
11. Add:
    `src/tests/canonical-ingredient-lifecycle-api.integration.test.ts`
12. Modify:
    `src/tests/architecture-guards.test.ts`

No UI, navigation, package, migration or schema path is proposed for 003B.

## 10. PR-INGREDIENT-003C — Separate UI proposal boundary

003C remains a future, separate UI PR.

Its proposed responsibility is:

- Active/Archived management views;
- management detail;
- rename history and archive evidence;
- Rename action;
- Archive confirmation;
- non-blocking duplicate warning display;
- loading, empty, error, offline and version-conflict states;
- no Reactivate, Delete, Merge or Reference Impact controls.

No 003C implementation or file allowlist is authorized by this Proposal.

Before a future 003C Task Card, the Owner must reverify against the then-current
integration Head:

- exact UI route;
- navigation placement;
- current web page topology;
- exact page and navigation paths;
- whether `routes.ts` still requires modification;
- exact Playwright path;
- desktop and mobile acceptance scope.

The current candidate recommendation is a dedicated management view rather than
presenting lifecycle authority as Cost-owned, but `/admin/ingredients` is not
fixed until the future 003C Task Card.

## 11. Typecheck-atomicity matrix

| Proposed PR | Changed interface | Production implementation changed in same PR | Test fixture/fake changed in same PR | Independent typecheck reason |
| --- | --- | --- | --- | --- |
| 003A | No Repository interface change | None required | New lifecycle Application test uses a narrowed dependency over existing Port methods | Existing SQLite Repository and existing `ContractFixture` continue satisfying the unchanged Port |
| 003B | `CanonicalIngredientRepository` gains two required management methods | `SqliteCanonicalIngredientRepository` updated in 003B | Existing `ContractFixture`, persistence tests and lifecycle Application/read test updated in 003B | Port, every known implementer and every typed fixture change atomically |
| 003B | Route-local `Services` composition gains Canonical Ingredient management server service | `server/index.ts` constructs and supplies it in 003B | API integration fixture starts the same composed service in 003B | Route service contract and composition root remain synchronized |
| 003C | No interface change is pre-approved | Must be determined by future Task Card | Future E2E fixture fixed in future Task Card | 003C cannot rely on an unspecified later PR to repair compilation |

No PR may knowingly leave a required interface method unimplemented until a
later PR.

## 12. Transaction and concurrency boundary

- Caller supplies `expectedVersion`.
- Missing or invalid version is a validation failure.
- Application compares loaded version before lifecycle-state evaluation.
- The Domain applies exactly one Rename or Archive transition.
- Application calls `saveWithExpectedVersion` once.
- SQLite Repository retains ownership of the transaction and conditional
  compare-and-swap persistence.
- Rename history and current state commit or roll back together.
- Archive state and archive evidence commit or roll back together.
- Persistence compare-and-swap conflict maps to VersionConflict.
- Duplicate warnings are advisory snapshots, not locks.
- No cross-domain transaction is introduced.

## 13. Required verification by proposed PR

### 003A

- Rename preserves Ingredient ID.
- Rename appends evidence and increments version.
- Archive preserves identity and Rename history.
- NotFound precedes state evaluation.
- VersionConflict precedes lifecycle-state outcomes.
- Archived＋matching Archive returns AlreadyArchived without write.
- Archived＋matching Rename returns
  `CanonicalIngredientArchivedRenameRejected`.
- Duplicate warnings exclude the current identity and do not block persistence.
- Caller actor/time/reason are required.
- Typecheck, lint, focused tests, Architecture Guard and diff check pass.

### 003B

- Active and Archived management methods are deterministic.
- Archived identities remain readable by ID.
- Existing ordinary Active selector remains Active-only.
- Every Repository implementer and fixture satisfies the changed Port.
- List filters `all`, `active`, and `archived` behave exactly.
- Invalid filter maps to typed validation failure.
- Rename and Archive routes enforce version-first precedence.
- Raw persistence errors never appear in HTTP responses.
- API responses use the existing `{ ok, data | error }` envelope.
- Typecheck, lint, persistence/API tests, Architecture Guard, migration smoke
  and diff check pass.
- Migration 014 remains byte-for-byte unchanged.

### 003C

Verification will be fixed by its future Task Card and must include desktop and
mobile Playwright coverage, failed-command truthfulness, offline state,
conflict handling and absence of unauthorized controls.

Test collections must be reported separately and never added into a fictional
total.

## 14. Explicit exclusions

- Reference Impact Coordinator.
- Accepted Purchase, Recipe/BOM, Draft, Quote or Snapshot impact counts.
- Snapshot `Unavailable` DTO implementation.
- deletion eligibility or `Indeterminate` DTO implementation.
- Reactivation.
- permanent deletion.
- Ingredient merge or aliases.
- automatic identity resolution.
- uniqueness constraints on names.
- schema or migration changes.
- Migration 014 modification.
- Prototype `localStorage` migration.
- authentication or authorization.
- verified user/operator identity.
- security remediation.
- Recipe 001C–001E.
- Cost Snapshot.
- Supplier, Purchase, Package or Inventory work.
- branch/worktree cleanup.
- main promotion.
- release or deployment.

## 15. Acceptance boundary

The complete proposed sequence is acceptable only when:

1. Every PR has separate Owner authorization.
2. Every PR starts from its then-current approved Git base.
3. Every PR is independently typecheckable.
4. Rename retains immutable identity and append-only evidence.
5. Version conflict precedes lifecycle-state outcomes.
6. Archived identity cannot be renamed.
7. Duplicate warnings remain non-blocking.
8. Archived identity remains readable historically.
9. Ordinary selectors exclude Archived records.
10. No second Ingredient authority or persistence source appears.
11. No migration/schema change occurs.
12. Actor metadata is never described as authenticated or verified.
13. UI work remains separate from 003B.
14. No later PR is relied upon to repair compilation.

## 16. Owner acceptance and future implementation gates
The Owner accepts the following Proposal decisions for recording:
1. `CanonicalIngredientManagementRecordV1` aliases the existing
   `CanonicalIngredientContractV1`.
2. The literal duplicate-warning DTO using `ingredientId`, `name` and `status`
   is accepted.
3. `CanonicalIngredientArchivedRenameRejected` is the exact matching-version
   Archived Rename outcome.
4. Version Conflict precedes lifecycle-state outcomes.
5. `/api/admin/canonical-ingredients` is the accepted 003B management API
   namespace.
6. `/api/admin/cost/ingredients` remains the existing Cost Back Office
   creation-composition endpoint only.
7. Actor metadata remains caller-reported and unverified.
Before 003A implementation:
8. Approve a dedicated 003A Task Card using its then-current Git base and exact
   six-path allowlist.
Before 003B implementation:
9. Reverify every Repository implementer and fixture.
10. Approve a dedicated 003B Task Card using its then-current Git base and an
    exact fixed allowlist.
Before 003C implementation:
11. Reinspect and decide the UI route, navigation placement and exact file
    allowlist against the then-current integration Head.
This recorded Proposal establishes governance and sequencing boundaries only.
It does not authorize 003A, 003B or 003C implementation, branch creation for
implementation, source modification, release or deployment.
