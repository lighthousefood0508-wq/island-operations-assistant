# PR-INGREDIENT-003B — Canonical Ingredient Management Read, Persistence and API Boundary

> **OWNER-APPROVED TASK CARD — IMPLEMENTATION NOT AUTHORIZED**

Status: Owner-approved Task Card — implementation not authorized
Architecture Owner: Miles / Lin Zi-Mao

## Constitution Compatibility Gate

Reviewed authority:

- `CONSTITUTION.md`;
- DECISIONS #069;
- accepted PR-INGREDIENT-003 Proposal;
- completed PR-INGREDIENT-003A command boundary;
- repository Working Rules and Development Workflow.

Compatibility result:

**PASS — OWNER-APPROVED TASK CARD; IMPLEMENTATION NOT AUTHORIZED**

This Task Card preserves Canonical Ingredient Identity Authority as an
independent authority hosted in Recipe Core. It adds no second Ingredient
master, no cross-domain table access, no migration authority and no UI scope.

## 1. Authority, dependency and baseline identities

Formal Owner-Accepted Architecture Development Baseline:

`1c31a31030e7c0d29181ebcc5355a706db95dc50`

Task Card recording base:

`b5641482bbfe34d110ccdf40d1ab5347850a9155`

The recording base is the verified integration Git Head after PR #16. It is
not frozen as the future 003B implementation base. A future implementation
Work Order must fetch and use the then-current remote
`integration/architecture-development` Head.

Accepted Proposal:

`docs/reviews/PR-INGREDIENT-003_CANONICAL_INGREDIENT_LIFECYCLE_APPLICATION_BOUNDARY_PROPOSAL.md`

Required Proposal blob:

`35a41567b16a714e154162042fba1ee0f6d160d9`

Completed dependency:

- PR-INGREDIENT-003A command-facing Contract and lifecycle Application
  Service are merged into integration through PR #16.
- 003B must consume the accepted 003A public boundary without rewriting its
  Contract, command precedence, warning semantics or error classes.

Protected Migration 014:

`migrations/014_recipe_canonical_ingredients.sql`

Required blob:

`5bcc40cddfe9ba14db7dc6a5e8da2d46f41ee23d`

Completion of this Task Card record does not authorize implementation,
staging, commit, push, merge, release, deployment or cleanup.

## 2. Objective

PR-INGREDIENT-003B may, under a future separate implementation Work Order:

1. add explicit Active and Archived management reads to the existing
   `CanonicalIngredientRepository` Port;
2. update every production implementation and typed fixture of that Port in
   the same PR;
3. implement deterministic Active and Archived SQLite management reads;
4. add a management-read Application Service;
5. add the dedicated server DTO and error adapter;
6. expose management reads plus the completed 003A Rename and Archive commands
   under `/api/admin/canonical-ingredients`;
7. wire the boundary in the existing composition root;
8. add persistence, Application, API and Architecture Guard coverage; and
9. remain independently typecheckable without relying on 003C.

003B contains no UI or navigation implementation.

## 3. Current repository evidence at the recording base

The verified repository contains:

- `CanonicalIngredientRepository` with `saveNew`,
  `saveWithExpectedVersion`, `findById`, `searchByName` and
  `findDuplicateCandidates`;
- `SqliteCanonicalIngredientRepository` as the production implementation;
- `ContractFixture` in `canonical-ingredient-catalog.test.ts` as the known
  typed fixture implementing the Port;
- `SqliteCanonicalIngredientRepository.listActive()` as a concrete-adapter
  convenience used by existing Cost Back Office setup;
- the accepted 003A management Contract, lifecycle Service and seven typed
  Application errors;
- `routes.ts` as the current HTTP registration and error-envelope boundary;
- `server/index.ts` as the current composition root;
- `/api/admin/cost/ingredients` as the existing Cost Back Office
  creation-composition endpoint; and
- no 003B management-read Service, server adapter or API integration test.

At implementation start, the Work Order must reinspect every occurrence of
`CanonicalIngredientRepository`, every structural fake and every composition
site. Discovery of another required implementation or fixture outside the
fixed allowlist is a stop condition.

## 4. Exact Repository Port change

003B may add exactly these required methods to the existing Port:

```ts
listActiveForManagement(): readonly CanonicalIngredient[];
listArchivedForManagement(): readonly CanonicalIngredient[];
```

All existing Port methods and their meanings remain unchanged.

The two methods have explicit, separate meanings. 003B must not replace them
with an `includeArchived` flag, a generic lifecycle query, a caller-supplied
SQL fragment or a second Repository authority.

Required ordering for each method:

1. `name ASC`;
2. `ingredientId ASC` as the deterministic tie-breaker.

Ordering is presentation determinism only. It does not establish identity,
uniqueness, duplicate ranking, merge priority or automatic selection.

The pre-existing ordinary Active selector remains Active-only and retains its
existing consumers and semantics.

## 5. SQLite persistence boundary

`SqliteCanonicalIngredientRepository` must implement both new Port methods in
the same PR as the Port change.

Required behavior:

1. Active management reads return only Active identities.
2. Archived management reads return only Archived identities.
3. Both reads use `name ASC, ingredientId ASC`.
4. Archived identities remain readable through the existing `findById` path.
5. Returned Aggregates must be rehydrated through the existing persistence
   mapping and invariants.
6. Rename and Archive evidence must remain intact.
7. Close and reopen must preserve the same management-read result.
8. Technical SQLite failures remain typed persistence failures and do not leak
   raw SQLite details through Application or HTTP boundaries.

Migration 014, schema, indexes and data migration remain unchanged. If the
required behavior cannot be implemented against the current schema within the
fixed allowlist, implementation must stop.

## 6. Management-read Application Service

003B may add:

`src/domains/recipe/ingredient-catalog/application/canonical-ingredient-management-read-service.ts`

Required public Service API:

```ts
export class CanonicalIngredientManagementReadService {
  constructor(
    repository: Pick<
      CanonicalIngredientRepository,
      | "findById"
      | "listActiveForManagement"
      | "listArchivedForManagement"
    >
  );

  list(
    lifecycle?: string
  ): readonly CanonicalIngredientManagementRecordV1[];

  getById(
    ingredientId: string
  ): CanonicalIngredientManagementRecordV1;
}
```

The narrowed Repository dependency alias remains internal and is not exported.

### List behavior

- omitted `lifecycle` defaults to `all`;
- `active` returns the Active management collection;
- `archived` returns the Archived management collection;
- `all` returns the complete Active section first, followed by the complete
  Archived section;
- each section preserves Repository order: `name ASC, ingredientId ASC`;
- an empty selection returns an empty readonly collection; and
- any other lifecycle text throws
  `CanonicalIngredientLifecycleValidationFailure`.

003B must not globally re-sort the combined `all` result. Active and Archived
remain visibly separate ordered sections.

### Detail behavior

- malformed `ingredientId` throws
  `CanonicalIngredientLifecycleValidationFailure` without Repository access;
- a parseable missing identity throws
  `CanonicalIngredientLifecycleNotFound`;
- both Active and Archived identities are readable; and
- unexpected Repository failures throw
  `CanonicalIngredientLifecyclePersistenceFailure`.

The Service returns the accepted
`CanonicalIngredientManagementRecordV1`; it does not introduce another read
DTO, another lifecycle vocabulary or a second identity representation.

## 7. Existing 003A command boundary remains authoritative

003B must call the completed `CanonicalIngredientLifecycleService` for Rename
and Archive. It must not duplicate Domain transitions or implement a second
command service.

The accepted 003A behavior remains unchanged:

1. malformed input maps to Validation Failure;
2. Not Found precedes version comparison when the identifier is parseable;
3. a valid stale `expectedVersion` precedes lifecycle outcomes;
4. matching-version Archived Archive throws
   `CanonicalIngredientAlreadyArchived`;
5. matching-version Archived Rename throws
   `CanonicalIngredientArchivedRenameRejected`;
6. Rename duplicate warnings remain non-blocking;
7. exactly one eligible Domain transition and one conditional save occur; and
8. typed persistence CAS conflict maps to Version Conflict.

003B must not change the 003A command/result DTOs, public method signatures,
error classes, stable codes, warning cardinality, audit mapping or raw-failure
containment.

## 8. Dedicated server adapter

003B may add:

`src/server/app/canonical-ingredient-management-service.ts`

The server adapter is required and not conditional. It owns only HTTP-facing
parsing, command construction, safe Application-error translation and
delegation to the two accepted Application Services.

Required responsibilities:

1. validate JSON object shape and required primitive fields;
2. use the path `ingredientId` as the authoritative command identifier;
3. call `CanonicalIngredientManagementReadService` for management reads;
4. call `CanonicalIngredientLifecycleService` for Rename and Archive;
5. translate accepted typed Application errors to the existing `HttpError`
   boundary; and
6. return accepted Contracts and result DTOs without exposing Domain or
   persistence internals.

Rename JSON fields:

- `newName`;
- `expectedVersion`;
- `actor`;
- `occurredAt`;
- `reason`.

Archive JSON fields:

- `expectedVersion`;
- `actor`;
- `occurredAt`;
- `reason`.

The adapter must not generate fallback actor, time or reason. `actor`,
`occurredAt` and `reason` remain caller-reported, unverified metadata and
append-only evidence. They are not authentication, authorization or verified
operator identity.

Raw Repository, SQLite and persistence failures, messages, properties and
stack traces must not cross the server boundary.

## 9. Exact API namespace and behavior

The accepted management namespace is:

`/api/admin/canonical-ingredients`

Four route registrations implement six API behaviors:

| Registration | Method and exact path | API behavior |
| --- | --- | --- |
| Management list | `GET /api/admin/canonical-ingredients?lifecycle=all` | Active section followed by Archived section |
| Management list | `GET /api/admin/canonical-ingredients?lifecycle=active` | Active management list |
| Management list | `GET /api/admin/canonical-ingredients?lifecycle=archived` | Archived management list |
| Management detail | `GET /api/admin/canonical-ingredients/:ingredientId` | Active or Archived detail |
| Rename command | `POST /api/admin/canonical-ingredients/:ingredientId/rename` | Accepted 003A Rename command |
| Archive command | `POST /api/admin/canonical-ingredients/:ingredientId/archive` | Accepted 003A Archive command |

The three list variants are three API behaviors handled by one list route
registration. Tests and reports must distinguish four route registrations
from six API behaviors.

List default is `lifecycle=all`. Empty lists return `200` with an empty array.

Successful responses use the established envelope:

```ts
{ ok: true, data: result }
```

Failures use the established safe error envelope. These paths are management
APIs only and do not establish a browser UI route.

The existing `/api/admin/cost/ingredients` remains the sole Cost Back Office
creation-composition endpoint. 003B adds no create endpoint, moves no creation
authority and does not turn the Cost route into a lifecycle-management route.

## 10. Accepted HTTP mapping

| Application outcome | HTTP status |
| --- | ---: |
| valid JSON with an invalid lifecycle filter, invalid command field or `CanonicalIngredientLifecycleValidationFailure` | 422 |
| `CanonicalIngredientLifecycleNotFound` | 404 |
| `CanonicalIngredientLifecycleVersionConflict` | 409 |
| `CanonicalIngredientAlreadyArchived` | 409 |
| `CanonicalIngredientArchivedRenameRejected` | 409 |
| `InvalidCanonicalIngredientLifecycleTransition` | 409 |
| `CanonicalIngredientLifecyclePersistenceFailure` or unexpected safe server failure | 500 |

The response may expose the stable Application code and safe Application
message. It must not expose or concatenate a raw Repository, SQLite or
persistence message, property, cause or stack.

Classification must use typed Application errors. It must not inspect raw
message or stack text.

The existing route-wide malformed-JSON behavior remains `400`; 003B must not
silently redesign that shared parser while adding the accepted management
validation mapping.

## 11. Exact fixed implementation allowlist

A future 003B implementation Work Order may change exactly these twelve paths:

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

No conditional path, wildcard scope or thirteenth file is allowed.

## 12. Atomic typecheck boundary

| Changed boundary | Production implementation or consumer in the same PR | Test implementation or evidence in the same PR | Independent typecheck reason |
| --- | --- | --- | --- |
| `CanonicalIngredientRepository` gains two required methods | `SqliteCanonicalIngredientRepository` | `ContractFixture` plus repository/persistence tests | Every known implementer and typed fixture changes atomically |
| Management-read Application Service | Recipe public index exports the accepted Service only | Lifecycle Application test covers the read dependency | No later PR is needed to publish or compile the Service |
| Route-local management service dependency | `server/index.ts` constructs and supplies the server adapter | API integration test starts the same composition | Route contract and composition root change together |
| Server adapter uses 003A commands and 003B reads | Dedicated adapter contains parsing and typed error mapping | API integration test exercises every behavior | HTTP concerns do not leak into Domain Application code |
| Recipe public surface | Only accepted read Service additions are exported | Architecture Guard inventories old and new exports | Pre-existing exports remain unchanged |

No later 003C or other PR may be relied upon to restore compilation.

## 13. Public export and composition rules

The 003B change to `src/domains/recipe/index.ts` may add only the accepted
management-read Service public surface. Every legitimate pre-existing export,
including all 003A exports, must remain unchanged.

003B must not newly export:

- the narrowed Repository dependency alias;
- Aggregate internals;
- the Repository Port;
- SQLite Repository or mapper internals;
- Database Adapter or transaction authority; or
- unrelated Recipe internals.

`src/server/index.ts` remains the sole composition root for the new server
adapter. Routes must receive the composed server service; they must not create
SQLite repositories, access the Database Adapter or execute SQL.

The Cost Back Office service and its existing creation composition remain
unchanged except for consuming the same existing database at the composition
boundary. No second Canonical Ingredient repository authority may appear.

## 14. Required Repository and persistence tests

Focused coverage must prove:

1. Active management read excludes Archived identities.
2. Archived management read excludes Active identities.
3. Both reads order by `name ASC, ingredientId ASC`.
4. Equal names use `ingredientId ASC` deterministically.
5. Archived identity remains readable by `findById`.
6. Ordinary pre-existing Active selector remains Active-only.
7. Complete Rename evidence survives management rehydration.
8. Archive evidence survives management rehydration.
9. Close database, reopen and repeat both management reads successfully.
10. Technical failures remain typed and fail closed.
11. `ContractFixture` implements both required methods.
12. Every discovered Port implementer and fixture typechecks in the same PR.
13. Migration 014 remains byte-for-byte unchanged.

Tests must exercise actual SQLite persistence and reopen where specified; they
must not substitute an in-memory object for the restart path.

## 15. Required Application tests

Focused coverage must prove:

1. omitted lifecycle defaults to `all`;
2. `all` returns the Active section before the Archived section;
3. each section preserves `name ASC, ingredientId ASC`;
4. `active` and `archived` return only their selected section;
5. empty selections return an empty readonly collection;
6. invalid lifecycle filter throws Validation Failure without a Repository
   list call;
7. malformed detail ID throws Validation Failure without Repository access;
8. parseable missing detail ID throws Not Found;
9. Active and Archived details return the accepted management Contract;
10. unexpected list or detail Repository failure throws Persistence Failure;
11. no competing management DTO is introduced; and
12. 003A lifecycle command tests remain unchanged in meaning and passing.

## 16. Required API integration tests

The API suite must cover all six API behaviors through the four route
registrations:

1. default and explicit `all` management list;
2. `active` management list;
3. `archived` management list;
4. Active and Archived management detail;
5. Rename command; and
6. Archive command.

It must additionally prove:

7. `all` returns Active then Archived, with each section ordered by
   `name ASC, ingredientId ASC`;
8. empty list returns `200` with `[]`;
9. invalid lifecycle filter returns `422`;
10. malformed ID returns `422` and missing ID returns `404`;
11. command validation returns `422`;
12. stale version returns `409` before lifecycle outcomes;
13. matching-version Archived Archive returns `409` with the accepted stable
    code and no write;
14. matching-version Archived Rename returns `409` with the accepted stable
    code and no write;
15. another invalid lifecycle transition returns `409`;
16. persistence failure returns `500`;
17. duplicate Rename warnings remain non-blocking and use the accepted DTO;
18. missing actor, `occurredAt` or reason never receives a fallback;
19. raw Repository/SQLite messages, properties, causes and stacks are absent;
20. successful responses use `{ ok: true, data }`;
21. failure responses use the existing safe error envelope;
22. close and reopen preserves management reads and lifecycle evidence;
23. `/api/admin/cost/ingredients` remains the existing creation endpoint;
24. no second create behavior appears under the management namespace; and
25. no UI or navigation route is introduced.

Reports must say four route registrations and six API behaviors. They must not
describe these as six distinct route registrations.

## 17. Architecture Guard requirements

Architecture Guard must:

1. enforce the exact twelve-path implementation boundary;
2. confirm only the two accepted Repository methods were added;
3. confirm every known Port implementer and typed fixture changed atomically;
4. preserve all existing Port methods and semantics;
5. preserve the ordinary Active-only selector;
6. allow only the accepted read Service addition to the Recipe public index;
7. preserve every legitimate pre-existing public export and all 003A exports;
8. reject public export of the dependency alias, Port and persistence
   internals;
9. keep SQL and Database Adapter use out of routes and Application Services;
10. keep the SQLite implementation under the existing infrastructure path;
11. prove the server adapter depends on public Application boundaries;
12. prove only `server/index.ts` performs new production composition;
13. preserve `/api/admin/cost/ingredients` as the existing creation route;
14. reject any second management or creation namespace;
15. reject UI, navigation, migration, schema, Cost and cross-domain additions;
16. preserve the complete 003A Architecture Guard boundary; and
17. avoid weakening any existing guard.

## 18. Required future verification

Immediately before implementation, the Work Order must reverify:

1. then-current remote integration Head;
2. Proposal blob;
3. Migration 014 blob;
4. merged 003A Task Card and implementation facts;
5. exact Repository signatures;
6. every Port implementer, structural fake and fixture;
7. exact twelve-path allowlist;
8. absence of the three proposed new 003B files;
9. exact pre-existing Recipe public-export inventory;
10. current route and composition boundaries;
11. package scripts and test commands; and
12. current Architecture Guard count and protections.

Required commands, subject to that reinspection:

```text
npm run typecheck
npm run lint
npm run build
node --test dist/tests/canonical-ingredient-lifecycle-application.test.js
node --test dist/tests/canonical-ingredient-catalog.test.js
node --test dist/tests/canonical-ingredient-persistence.integration.test.js
node --test dist/tests/canonical-ingredient-lifecycle-api.integration.test.js
npm run architecture:guard
npm run migration:smoke
npm run migration:upgrade:014
npm test
npm run verify
npm run verify:full
git diff --check
```

A complete repository execution must separately enumerate every compiled
`dist/tests/*.test.js` file and report selected, passed, failed, skipped, todo
and cancelled counts.

Focused tests, `npm test`, `npm run verify`, `npm run verify:full`, migration
checks and the manually enumerated full set are overlapping selections. Report
each separately; never add them into a fictional total.

If a command has been removed or renamed, stop and report the discrepancy
instead of inventing a replacement.

## 19. Explicit exclusions

003B excludes:

- UI and navigation, including `/admin/ingredients`;
- Ingredient 003C;
- Reactivation;
- permanent deletion;
- Ingredient merge or aliases;
- automatic identity resolution;
- name uniqueness constraints;
- Reference Impact Coordinator;
- deletion eligibility or impact counts;
- authentication or authorization;
- verified operator identity or trusted audit principal;
- Migration 014 modification;
- any migration, schema or data migration;
- package-file modification;
- Cost Back Office redesign;
- Cost Snapshot;
- Recipe lifecycle or Recipe 001C through 001E;
- Supplier, Purchase, Package or Inventory work;
- architecture cleanup;
- security remediation;
- unrelated governance synchronization;
- main promotion;
- release or deployment; and
- branch or worktree cleanup.

## 20. Protected paths and facts

A future implementation must leave unchanged:

- the accepted Ingredient Proposal;
- the 003A Task Card;
- 003A management command/result Contracts;
- 003A lifecycle Service signatures and semantics;
- 003A typed error class names and stable codes;
- Migration 014;
- all package files;
- all governance records;
- all UI and navigation paths;
- Cost creation route semantics; and
- every path outside the exact twelve-file allowlist.

Archived identities remain readable for historical evidence. Duplicate names
remain non-blocking warnings. Caller actor metadata remains unverified.

## 21. Stop conditions

Stop without expanding scope if implementation requires:

1. a thirteenth path;
2. another Port method, implementer or fixture outside the allowlist;
3. a migration, schema, index or data migration;
4. changing a 003A public Contract, Service signature, error class or code;
5. changing 003A precedence, warning or audit semantics;
6. globally mixing Active and Archived ordering instead of preserving the two
   accepted sections;
7. turning duplicate ordering into identity or merge authority;
8. changing the existing Cost creation endpoint;
9. adding a second create or lifecycle-management authority;
10. placing SQL, Repository construction or Database Adapter use in routes;
11. exposing raw Repository, SQLite or persistence failures;
12. classifying errors by raw message or stack matching;
13. generating fallback actor, time or reason;
14. introducing authentication, authorization or trusted-identity claims;
15. adding UI, navigation or 003C work;
16. relying on a later PR to restore typecheck;
17. removing or semantically changing a pre-existing public export;
18. weakening an Architecture Guard;
19. finding a relevant authority, seal, signature or route boundary changed;
20. finding the fixed allowlist non-typecheckable; or
21. encountering any unexpected branch, worktree or protected-file state.

## 22. Task Card recording metadata

Task Card path:

`docs/reviews/PR-INGREDIENT-003B_CANONICAL_INGREDIENT_MANAGEMENT_API_TASK_CARD.md`

Recording branch:

`docs/pr-ingredient-003b-task-card`

Reserved commit message and PR title:

`docs(governance): add Ingredient 003B management API task card`

These metadata govern this Task Card record. Their presence does not authorize
Ingredient implementation, release, deployment or cleanup.

## 23. Governance and implementation gates

1. Owner reviewed the response-only 003B Task Card and accepted the ordering
   and HTTP mapping decisions. **COMPLETE**
2. Owner authorized recording this Task Card with the single wording
   correction: four route registrations implement six API behaviors.
   **COMPLETE**
3. Recorded Task Card receives independent read-only review.
4. Owner separately decides Task Card merge.
5. Owner issues a dedicated 003B implementation Work Order using the
   then-current remote integration Head.
6. Implementation stops at its pre-commit Gate.
7. Owner separately authorizes implementation commit, push and PR.
8. Implementation PR receives independent read-only review.
9. Owner separately decides implementation merge.
10. Post-merge verification is separately accepted.

Completion of any Gate does not authorize the next.

003C remains unauthorized.

## 24. Required future implementation pre-commit report

The report must include:

1. fetched remote integration Head and exact implementation base;
2. Proposal, 003A Task Card and Migration 014 blob verification;
3. every discovered Port implementer and typed fixture;
4. exact twelve-path diff and per-file statistics;
5. exact Port and management-read Service signatures;
6. Active/Archived ordering evidence;
7. Active-first `all` composition evidence;
8. archived-detail and close/reopen evidence;
9. four route registrations and six API behaviors;
10. exact HTTP mapping and response envelopes;
11. 003A command reuse and unchanged command Contract evidence;
12. caller-audit and no-fallback evidence;
13. raw-failure containment evidence;
14. Cost creation endpoint non-regression evidence;
15. complete pre-existing Recipe public-export inventory and additive diff;
16. Architecture Guard changes and non-weakening proof;
17. every verification result with separate provenance and counts;
18. migration seals and checks;
19. `git diff --check` and complete Git status;
20. confirmation all excluded paths remain unchanged; and
21. every discrepancy, failure and uncertainty.

Current status:

**OWNER-APPROVED TASK CARD — IMPLEMENTATION NOT AUTHORIZED**
