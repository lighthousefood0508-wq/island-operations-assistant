# PR-INGREDIENT-003C — Canonical Ingredient Management UI and Navigation

> **OWNER-AUTHORIZED TASK CARD REVIEW CANDIDATE — IMPLEMENTATION NOT AUTHORIZED**

Status: Independent Task Card review candidate

Current Owner Goal: define one independently reviewable UI-only implementation
boundary for Canonical Ingredient management over the already merged 003B API.

This document is a governance artifact. Recording or merging this Task Card does
not authorize Ingredient 003C implementation.

## Baseline identities and authority

- Formal Architecture Development Baseline:
  `97d6c7b52f09643b2cafaa50711f76ccc1ae7a96`
- Task Card drafting and repository-observation Git Head:
  `124f4487b5af672a1b9be6a26993919ad2a6caad`
- Accepted Ingredient Proposal blob:
  `35a41567b16a714e154162042fba1ee0f6d160d9`
- Accepted PR-INGREDIENT-003A Task Card blob:
  `d678765982fa11e9921ab898dfc4d878bbcd7e10`
- Accepted PR-INGREDIENT-003B Task Card blob:
  `9453d54b4ad0529c84c277f61ebb83efcae0c1ec`
- Protected Migration 014 blob:
  `5bcc40cddfe9ba14db7dc6a5e8da2d46f41ee23d`

The drafting Git Head records drafting-time repository observation only. It is
not a permanent comparison seal, future Task Card recording base or 003C
implementation base. A future Task Card recording authorization and a later,
separate implementation Work Order must each name the exact integration Head
that is effective for that Gate. Immediately before acting, the executor must
fetch and compare remote `integration/architecture-development` with the exact
Head named by the currently effective Owner authorization or Work Order. If they
differ, stop and report the discrepancy; do not rebase, change base or absorb new
changes without a new Owner decision.

Authority for this candidate consists of:

- the accepted PR-INGREDIENT-003 Proposal;
- the completed and merged PR-INGREDIENT-003A command boundary;
- the completed and merged PR-INGREDIENT-003B read, persistence and API boundary;
- the Owner-approved Ingredient 003C Readiness Review; and
- the Owner order authorizing this response and file candidate for independent
  Task Card review only.

No Decision number is created, reserved or backdated by this Task Card.

## Task Card record metadata

- Proposed Task Card path:
  `docs/reviews/PR-INGREDIENT-003C_CANONICAL_INGREDIENT_MANAGEMENT_UI_TASK_CARD.md`
- Proposed future Task Card recording branch:
  `docs/pr-ingredient-003c-task-card`
- Proposed future Task Card commit message and PR title:
  `docs(governance): add Ingredient 003C management UI task card`
- Proposed future implementation branch:
  `feature/pr-ingredient-003c-management-ui`
- Proposed future implementation commit message and PR title:
  `feat(recipe): add canonical ingredient management UI`

These are proposed governance identifiers only. They do not authorize branch
creation, staging, commit, push, PR creation, implementation, merge, release,
deployment or cleanup.

## 1. Constitution Compatibility Gate

Reviewed authority:

- `CONSTITUTION.md`;
- `AGENTS.md`;
- `docs/REPOSITORY_WORKING_GUIDE.md`;
- ADR-001, server-side SQLite is the source of truth;
- ADR-002, SQLite-first persistence;
- ADR-003, REST plus SSE;
- ADR-004, Admin web in the same ROS deployment;
- the still-valid cross-boundary prohibition in ADR-007;
- ADR-008, explicit contract versioning and approval;
- ADR-019, Recipe, Measurement and Cost authority;
- DECISIONS #069 Canonical Ingredient lifecycle governance boundaries;
- the accepted PR-INGREDIENT-003 Proposal; and
- the accepted and merged 003A and 003B boundaries.

Compatibility Result:

`PASS — TASK CARD REVIEW CANDIDATE; IMPLEMENTATION NOT AUTHORIZED`

Compatibility depends on all of these conditions remaining true:

1. Canonical Ingredient remains an independent Authority hosted in Recipe Core.
2. The browser communicates only through the accepted HTTP API.
3. The UI does not import Domain, Repository, SQLite or Database internals.
4. Server-side API validation and persistence remain authoritative.
5. The only lifecycle transition exposed is `Active -> Archived`.
6. Rename preserves identity and append-only evidence.
7. Archived identities remain readable.
8. Duplicate-name candidates remain non-blocking warnings.
9. No UI route or navigation placement is treated as an authorization boundary.
10. Actor metadata remains caller-reported and unverified.

## 2. Objective

Implement one Back Office page for Canonical Ingredient lifecycle management
using the already merged 003B APIs.

The page must provide:

- All, Active and Archived management views;
- deterministic list display preserving API order;
- management detail;
- Rename history and Archive evidence;
- Rename for an Active identity;
- explicit Archive confirmation for an Active identity;
- non-blocking duplicate-warning display;
- loading, empty, validation, Not Found, conflict, persistence, unexpected and
  offline states;
- desktop operation; and
- representative mobile responsive and operability coverage.

003C must not create another Canonical Ingredient authority or add missing
business capabilities.

## 3. Verified current UI topology

The current Admin UI is server-rendered HTML returned from TypeScript page
modules under `src/web/<area>/page.ts`. Page-local browser JavaScript calls the
server through `fetch`. There is no React, Vue or separate client bundle.

Existing shared navigation is owned by:

`src/web/shared/navigation.ts`

Existing Admin page routes are registered by:

`src/server/app/routes.ts`

The closest current references are:

- `src/web/cost/page.ts` for Back Office layout, form and notice conventions;
- `src/web/catalog/page.ts` for list/detail editing and explicit confirmation;
- `src/web/events/page.ts` for loading, selection and master-detail behavior;
- `tests/e2e/cost-back-office.spec.ts` for desktop and representative mobile
  Playwright conventions; and
- `src/tests/canonical-ingredient-lifecycle-api.integration.test.ts` for the
  accepted 003B API behavior and current negative UI-route assertion.

003C may reuse these interaction and visual conventions. It must not copy
unrelated Catalog deactivate/delete behavior or Cost creation authority.

## 4. Fixed information architecture

The 003C page route is exactly:

`GET /admin/ingredients`

The shared Back Office navigation entry is exactly:

- key: `ingredients`;
- label: `食材主檔`;
- href: `/admin/ingredients`; and
- placement: immediately after `商品目錄` and immediately before `成本中心`.

The page renderer is proposed as:

`renderCanonicalIngredientManagement()`

The page must render the existing shared System navigation with Admin active and
the shared Back Office navigation with `ingredients` active.

The UI route is distinct from API routes. It does not create a security or
authorization boundary. ADR-004 still requires server-side enforcement by a
separately approved authenticated boundary; 003C does not implement that
boundary.

The following alternative routes are prohibited:

- `/admin/canonical-ingredients`;
- `/api/admin/ingredients`; and
- any Cost-owned Ingredient lifecycle-management page.

## 5. Existing API boundary

003C must use only these already merged endpoints:

| Method | Exact path | Accepted purpose |
| --- | --- | --- |
| `GET` | `/api/admin/canonical-ingredients` | All records; omitted lifecycle means `all` |
| `GET` | `/api/admin/canonical-ingredients?lifecycle=active` | Active records only |
| `GET` | `/api/admin/canonical-ingredients?lifecycle=archived` | Archived records only |
| `GET` | `/api/admin/canonical-ingredients/:ingredientId` | Management detail |
| `POST` | `/api/admin/canonical-ingredients/:ingredientId/rename` | Rename command |
| `POST` | `/api/admin/canonical-ingredients/:ingredientId/archive` | Archive command |

Successful responses use:

```ts
Readonly<{
  ok: true;
  data: unknown;
}>
```

Expected failures use:

```ts
Readonly<{
  ok: false;
  error: Readonly<{
    code: string;
    message: string;
    details?: unknown;
  }>;
}>
```

The UI must not add an API client authority or reinterpret a failed HTTP response
as success. It must use `response.ok` together with the response envelope.

Every Ingredient ID inserted into an API path must use `encodeURIComponent`.

## 6. Existing management contract

The page consumes the existing:

`CanonicalIngredientManagementRecordV1 = CanonicalIngredientContractV1`

Its accepted visible data is:

- immutable `ingredientId`;
- `name`;
- `categoryCode`;
- lifecycle `status`;
- `aggregateVersion`;
- `createdAt` and `createdBy`;
- append-only `renameHistory`; and
- optional `archiveFact`.

The UI must not infer identity from name, category or list position. It must retain
the selected `ingredientId` as the identity key.

The UI may format dates for operator display, but evidence detail must retain an
exact machine-readable ISO value, such as through a `<time datetime="...">`
attribute or an adjacent exact-value display.

The UI must preserve record and candidate order returned by the API. It must not
add ranking, normalization, similarity scoring or sorting that changes accepted
management order.

## 7. Page structure

The page must have one clear heading:

`食材主檔`

It must contain these functional areas:

1. Lifecycle filter with `全部`, `使用中` and `已封存` choices.
2. Ingredient list showing name, category code and lifecycle status.
3. Selected Ingredient detail.
4. Rename history in append order.
5. Archive evidence when present.
6. Rename form for Active identities.
7. Archive action and explicit confirmation for Active identities.
8. A page-level notice region for success, warning and error feedback.
9. Dedicated loading and empty-state regions.

Archived identities are readable and must remain selectable. Their Rename and
Archive controls must not be rendered as active actions.

The page has no Create control. Existing creation remains under the Cost Back
Office composition endpoint `/api/admin/cost/ingredients` and is not moved,
duplicated or linked as a second lifecycle authority by this PR.

## 8. List and selection behavior

Initial load requests the existing `all` behavior. The page may omit the query
parameter or send `lifecycle=all`, but it must use one consistent implementation.

Changing the filter must:

1. indicate loading;
2. request the exact accepted lifecycle value;
3. replace the displayed collection only after success;
4. show a lifecycle-specific empty state for an empty collection; and
5. clear a selected detail if that identity is absent from the successful new
   collection.

Selecting an Ingredient must request its detail by immutable ID. The list
projection is not sufficient authority for lifecycle commands.

The expected version for Rename or Archive must come from the currently loaded
detail `aggregateVersion`. It must not be typed by the operator, inferred from a
list position or incremented by the UI.

## 9. Rename workflow

Rename is available only for a currently loaded Active identity.

The command body is exactly:

```ts
Readonly<{
  newName: string;
  expectedVersion: number;
  actor: string;
  occurredAt: string;
  reason: string;
}>
```

The page must:

1. require all command fields;
2. retain the selected immutable ID;
3. use the loaded `aggregateVersion`;
4. submit exactly once per explicit operator action;
5. disable duplicate submissions while the request is in flight;
6. use the returned Ingredient as the successful command result;
7. refresh or reconcile list and detail without inventing a new version; and
8. present any returned duplicate warning after the successful Rename.

Duplicate warnings use code `DUPLICATE_NAME_WARNING` and expose only candidate
`ingredientId`, `name` and `status`.

The UI must not remove, filter, sort or synthesize duplicate candidates locally.
When the API returns no warning, the page displays no empty warning block. When
the API returns a warning, the page displays exactly one warning block containing
the complete candidate collection in its original API order.

The warning is informational. It must not:

- block Rename;
- choose another identity;
- offer Merge;
- rewrite the command;
- imply name uniqueness; or
- authorize automatic selection.

## 10. Archive workflow

Archive is available only for a currently loaded Active identity.

The command body is exactly:

```ts
Readonly<{
  expectedVersion: number;
  actor: string;
  occurredAt: string;
  reason: string;
}>
```

Before submitting, the page must display an explicit confirmation naming the
selected Ingredient and explaining that it becomes read-only for lifecycle
management under the currently approved capability.

Confirmation must not claim permanent deletion, reference cleanup, reactivation
availability or deletion eligibility.

After success, the page must display the returned Archived record, retain its
Rename history and display its Archive evidence. The list must be reconciled with
the current lifecycle filter without inventing data.

## 11. Caller evidence and local-time conversion

The UI must expose explicit required inputs for:

- `actor`;
- local `occurredAt`; and
- `reason`.

`actor` is caller-reported, unverified metadata. The UI must not label or describe
it as an authenticated user, authorized operator, trusted identity or security
audit principal.

The occurred-at input must:

1. use an operator-editable local date/time control;
2. start empty;
3. never be prefilled with the browser's current time;
4. require an explicit operator value;
5. parse the selected local date/time in the browser's local time zone;
6. deterministically convert the valid value to UTC ISO using
   `Date.prototype.toISOString()` immediately before command construction;
7. reject an invalid conversion before sending the request; and
8. never append `Z` directly to an unparsed local string.

No actor, time or reason fallback may be generated by the UI, Runtime or
Application. The UI must not invent a second audit-evidence model.

## 12. Error and state handling

### Loading and duplicate submission

List, detail and command loading states must be distinguishable. Command buttons
must be disabled during their own in-flight request. A retry must always be an
explicit operator action.

### Validation and Not Found

- HTTP `422` or code `CANONICAL_INGREDIENT_VALIDATION_FAILURE` displays the safe
  Application message and available field detail.
- HTTP `404` or code `CANONICAL_INGREDIENT_NOT_FOUND` clears the stale selection,
  displays a Not Found notice and offers an explicit list refresh.

### Required 409 code-specific handling

The UI must not handle every HTTP 409 identically. It must branch on
`error.code`:

| Stable code | Required UI behavior |
| --- | --- |
| `CANONICAL_INGREDIENT_VERSION_CONFLICT` | Do not retry automatically. Preserve operator-entered text, reload the latest list/detail, show that another change won, and require review plus a new explicit submit. |
| `CANONICAL_INGREDIENT_ALREADY_ARCHIVED` | Reload the current detail, show the Archived state and remove active Archive controls. |
| `CANONICAL_INGREDIENT_ARCHIVED_RENAME_REJECTED` | Reload the current detail, show that an Archived identity is read-only and remove active Rename controls. |
| `INVALID_CANONICAL_INGREDIENT_TRANSITION` | Show the safe transition message, reload current detail and do not infer an alternative command. |

An unknown 409 code must display a safe generic conflict state. It must not be
silently classified as Version Conflict.

### Persistence, unexpected and offline failures

- `CANONICAL_INGREDIENT_PERSISTENCE_FAILURE` displays a safe persistence message
  and allows explicit retry without losing operator input.
- `internal_error` displays a safe unexpected-error message.
- A fetch rejection, unavailable server or unusable response body displays an
  offline/unavailable state and offers explicit retry.

The UI must not display raw Repository or SQLite messages, properties, causes or
stack traces. It must not log them from a server response.

## 13. Safe rendering boundary

The initial page shell and static labels may remain server-rendered template
text, consistent with existing pages.

Every value obtained from an API response or operator input must be rendered
using safe DOM text operations, including:

- `textContent`;
- form-control `value` properties;
- `document.createElement`; and
- safe attribute assignment for validated values.

API and operator data must not be interpolated into `innerHTML`, `outerHTML`,
`insertAdjacentHTML`, inline event-handler text or executable script text.

This rule applies to:

- names and category codes;
- IDs and statuses;
- actor and reason evidence;
- Rename history;
- Archive evidence;
- duplicate candidates; and
- error messages and details.

The page must not use `localStorage`, IndexedDB or another browser store as
business authority. Non-persistent, non-authoritative in-memory presentation and
request-orchestration state may hold only:

- the current filter;
- the fetched collection;
- the selected `ingredientId`;
- the last successfully loaded detail;
- the detail `aggregateVersion`;
- loading and in-flight request identity;
- notices, warnings and safe errors; and
- unsent operator inputs.

The fetched collection, last successfully loaded detail and detail
`aggregateVersion` must originate only from the current API response. The current
filter, selection and unsent operator inputs may originate from operator
interaction. Loading state, in-flight request identity, client-side validation,
network or offline errors and presentation notices may be generated by the page
only for presentation or request orchestration. Client-generated state must not
claim or derive a business fact, version, lifecycle status or command success.
Command success, duplicate warnings and server business errors must be based on
an actual API response. None of these states may survive a page reload or replace
server authority.

## 14. UI, API and Domain responsibility boundary

The UI owns:

- presentation;
- navigation;
- operator input collection;
- local-time input conversion;
- HTTP request orchestration;
- safe state display; and
- explicit confirmation.

The API and Application boundary own:

- input validation;
- Not Found and version precedence;
- lifecycle decisions;
- duplicate-warning facts;
- persistence compare-and-swap;
- error classification; and
- safe public error messages.

The Domain owns:

- immutable identity;
- lifecycle transition authority;
- Rename and Archive validation;
- aggregate version;
- append-only evidence; and
- historical preservation.

The UI must not reproduce or override Domain rules. Client-side checks improve
operator feedback only and are not authority.

## 15. Exact six-path implementation allowlist

The future 003C implementation PR may change exactly these six paths:

1. Add `src/web/ingredients/page.ts`.
2. Modify `src/web/shared/navigation.ts`.
3. Modify `src/server/app/routes.ts`.
4. Modify `src/tests/canonical-ingredient-lifecycle-api.integration.test.ts`.
5. Add `tests/e2e/canonical-ingredient-management.spec.ts`.
6. Modify `src/tests/architecture-guards.test.ts`.

The Task Card path itself is a preceding governance artifact. It is not part of
the six-path implementation allowlist and must not be modified by the future
implementation PR.

No conditional path, wildcard, `if required`, `as needed` or directory-level
scope is authorized.

If implementation cannot remain typecheckable and complete within these six
paths, stop and report the exact missing dependency. Do not add a seventh path.

## 16. Path-by-path implementation responsibility

| Path | Status | Exact 003C responsibility |
| --- | --- | --- |
| `src/web/ingredients/page.ts` | Add | Static page shell, safe dynamic rendering, lifecycle filters, detail, Rename, Archive confirmation, evidence, warning and state handling |
| `src/web/shared/navigation.ts` | Modify | Add exactly `ingredients` / `食材主檔` / `/admin/ingredients` after Catalog and before Cost |
| `src/server/app/routes.ts` | Modify | Import the page renderer and add exactly `GET /admin/ingredients`; preserve every accepted API registration |
| `src/tests/canonical-ingredient-lifecycle-api.integration.test.ts` | Modify | Replace the current UI-route 404 assertion with page-route 200/HTML proof while preserving 003B API and no-create coverage |
| `tests/e2e/canonical-ingredient-management.spec.ts` | Add | Desktop core workflow, errors, safe management behavior and representative mobile coverage |
| `src/tests/architecture-guards.test.ts` | Modify | Guard exact UI route, navigation, six-path boundary, dependency direction, safe rendering and non-weakening of 003B API authority |

`src/server/index.ts` is excluded because 003B already composes the management
service. The new page renderer is a static route dependency and needs no new
service or composition-root field.

## 17. Atomic typecheck boundary

003C changes no Domain Contract, Repository Port, Application interface, server
service interface, database adapter or schema.

The page calls the already merged HTTP API and must not require an import from
the Recipe public index.

The route module and new page renderer change atomically in the same PR. Shared
navigation gains its new discriminant and item in the same PR as the page that
uses it. API integration, E2E and Architecture Guard changes are included in the
same PR.

No later PR may be relied upon to restore typecheck, tests, API behavior,
navigation or Architecture Guard coverage.

## 18. Required API integration regression

The existing Canonical Ingredient lifecycle API integration suite must retain
all 003B behavior and add or revise only the page-route proof required by 003C.

It must prove:

1. `GET /admin/ingredients` returns `200` and HTML containing the accepted page
   identity.
2. The page route does not invoke a Repository or perform a write.
3. The four existing management API registrations remain unchanged.
4. The six existing API behaviors remain available.
5. The management collection still has no POST Create route.
6. `/api/admin/cost/ingredients` remains the existing Cost creation-composition
   endpoint.
7. Existing HTTP status, code, envelope and malformed-JSON behavior remain
   unchanged.
8. Existing restart, persistence containment and safe-error evidence remains
   intact.

The test must not be weakened merely to replace the previous
`/admin/ingredients` 404 assertion.

## 19. Required desktop E2E coverage

The new Playwright file must cover the complete core operator flow on the
existing default desktop project:

1. Navigate to `食材主檔` from Back Office navigation.
2. Confirm its placement after `商品目錄` and before `成本中心`.
3. Confirm `/admin/ingredients` and its active navigation state.
4. Seed formal Ingredient test records only through existing server APIs.
5. Load All, Active and Archived views.
6. Prove empty-state behavior.
7. Select Active and Archived detail.
8. Display immutable ID, version, created evidence, Rename history and Archive
   evidence as applicable.
9. Submit Rename with explicit actor, local occurredAt and reason.
10. Prove local time converts to the expected UTC ISO value.
11. Prove successful Rename updates detail and list.
12. Prove zero duplicate candidates yields no warning block.
13. Prove a returned duplicate warning is visible, non-blocking and preserves
    candidate order.
14. Confirm Archive requires explicit confirmation.
15. Submit Archive with explicit evidence.
16. Prove the Archived result remains readable and prior Rename history remains.
17. Prove Archived identities have no active Rename or Archive controls.
18. Prove 422 validation feedback.
19. Prove 404 selection recovery.
20. Prove each accepted 409 code has its specified distinct behavior.
21. Prove Version Conflict does not automatically retry or overwrite.
22. Prove persistence and unexpected failures use safe messages.
23. Prove offline/fetch failure retains unsent operator input and offers explicit
    retry.
24. Prove no Create, Reactivate, Delete, Merge or Reference Impact control exists.
25. Prove dynamic remote/operator values are displayed as text rather than
    executable markup.

Test setup may use the existing Cost creation-composition API solely to create
formal test fixtures. That does not add a Create capability to the management
page and must not change Cost ownership or behavior.

## 20. Representative mobile coverage

Mobile coverage must use a representative viewport consistent with current
repository practice, such as `390 x 844`.

It must prove:

1. Back Office navigation remains operable and horizontally accessible.
2. List, detail and action regions remain reachable without overlap.
3. The lifecycle filter and selection flow are operable.
4. A representative Rename or Archive form can be completed and confirmed.
5. Long name, evidence and error text remain readable without clipping critical
   controls.

The mobile test does not need to duplicate the complete desktop API/error matrix.
Desktop tests remain the complete functional matrix; mobile tests are targeted
responsive and operability evidence.

## 21. Architecture Guard requirements

The Architecture Guard change must extend current protection. It must not remove
or weaken the accepted 003A or 003B checks.

It must prove:

1. The exact six implementation paths own the 003C responsibilities.
2. `src/web/ingredients/page.ts` exists and exports exactly the accepted page
   renderer required by route wiring.
3. The new page imports only approved UI/shared modules and does not import
   Recipe internals, Recipe public contracts as authority, Repository, SQLite,
   Database Adapter, migration, server service internals or another Domain.
4. `src/server/app/routes.ts` registers exactly one
   `GET /admin/ingredients` UI route.
5. No alternative `/admin/canonical-ingredients` or
   `/api/admin/ingredients` namespace exists.
6. Navigation contains exactly one `ingredients` entry with the accepted label,
   href and position.
7. Existing `GET/GET/POST/POST` Canonical Ingredient API registrations remain
   exactly the accepted four registrations implementing six behaviors.
8. The Cost creation route remains distinct and no management Create route is
   added.
9. Existing 003B server adapter and composition boundaries remain unchanged.
10. The page contains no Create, Reactivate, Delete, Merge or Reference Impact
    command or route.
11. Dynamic API/operator values use accepted safe text-rendering operations and
    are not interpolated into unsafe HTML sinks.
12. The Task Card, Proposal, Migration 014 and protected 003A/003B implementation
    boundaries remain outside the implementation diff.

API namespace scanning must be scoped precisely:

- production UI and route wiring may contain the accepted namespace only in
  `src/web/ingredients/page.ts` and `src/server/app/routes.ts`;
- existing API implementation and server composition remain governed by their
  existing 003B checks;
- tests may reference accepted routes as test evidence and must not be rejected
  merely for containing their literal strings; and
- the Guard must not scan documentation as production implementation.

The current 003B assertion that prohibits `/admin/ingredients` must be replaced
with exact positive 003C route/navigation protection. Other 003B namespace,
route-count, Cost-authority and no-create assertions must remain effective.

## 22. Required future verification

Immediately before implementation, the future Work Order must re-inspect package
scripts and use only commands that still exist.

Current verified commands are:

```text
npm run typecheck
npm run lint
npm run build
node --test dist/tests/canonical-ingredient-lifecycle-api.integration.test.js
npm run architecture:guard
npm test
npm run verify
npm run test:e2e -- canonical-ingredient-management.spec.ts
npm run verify:full
git diff --check
```

Required verification also includes:

- explicit UTF-8 decoding of all six changed files;
- final newline;
- zero trailing whitespace;
- new-file no-index whitespace checks;
- exact six-path diff audit;
- static path and import verification;
- a complete staged-diff audit before any later commit authorization; and
- manual enumeration of compiled `dist/tests/*.test.js` when required by the
  future implementation Work Order.

Focused API, E2E, `npm test`, `verify`, `verify:full`, Architecture Guard and any
manually enumerated test collection must be reported separately. Overlapping
collections must not be summed into a fictional total.

Playwright artifacts generated by testing are verification outputs, not
authorized source changes. They must not be staged or committed.

## 23. Explicit exclusions

003C must not include:

- Canonical Ingredient Create;
- Reactivation;
- permanent deletion;
- Ingredient merge or aliases;
- automatic identity resolution;
- a uniqueness constraint or blocking duplicate-name validation;
- Reference Impact Coordinator or deletion eligibility;
- Repository Port modification;
- SQLite Repository modification;
- persistence integration modification;
- Domain or Aggregate modification;
- 003A Contract, command, result, error or lifecycle-service modification;
- 003B read service, server adapter, API contract or composition modification;
- migration or schema modification;
- Database Adapter or transaction modification;
- `src/server/index.ts` modification;
- package or script modification;
- SSE or background refresh authority;
- another UI framework, shared component architecture or API-client framework;
- authentication, authorization or user management;
- a claim that actor is a trusted or authenticated identity;
- Recipe 001C through 001E;
- Cost Snapshot;
- Supplier, Purchase, Package or Inventory work;
- governance-document synchronization beyond recording this Task Card in its
  own separately authorized governance PR;
- architecture or security remediation outside the new page's own safe-rendering
  requirement;
- branch or worktree cleanup;
- remote `main` creation or origin/HEAD remediation;
- main promotion;
- release; or
- deployment.

## 24. Protected paths and facts

The future 003C implementation must leave unchanged every path outside the exact
six-file allowlist, including:

- `docs/reviews/PR-INGREDIENT-003_CANONICAL_INGREDIENT_LIFECYCLE_APPLICATION_BOUNDARY_PROPOSAL.md`;
- `docs/reviews/PR-INGREDIENT-003A_CANONICAL_INGREDIENT_LIFECYCLE_COMMAND_BOUNDARY_TASK_CARD.md`;
- `docs/reviews/PR-INGREDIENT-003B_CANONICAL_INGREDIENT_MANAGEMENT_API_TASK_CARD.md`;
- this 003C Task Card after it is separately recorded and merged;
- `docs/DECISIONS.md`;
- `migrations/014_recipe_canonical_ingredients.sql`;
- all other migrations;
- `src/domains/recipe/**`;
- `src/server/app/canonical-ingredient-management-service.ts`;
- `src/server/index.ts`;
- `src/shared/database/**`;
- `package.json` and lockfiles;
- existing Cost service and UI behavior; and
- every unrelated test and UI page.

Protected facts include:

- immutable `ing_<uuid>` identity;
- Active to Archived as the only transition;
- append-only Rename and Archive evidence;
- optimistic-concurrency enforcement;
- version-first Application precedence;
- Archived readability;
- non-blocking duplicate warnings;
- four API registrations providing six management behaviors;
- the dedicated `/api/admin/canonical-ingredients` management namespace;
- `/api/admin/cost/ingredients` as the existing creation-composition endpoint;
- safe Application error messages; and
- caller-reported, unverified actor metadata.

## 25. Stop conditions

Stop before implementation or during implementation and report `BLOCKED` if:

1. the remote integration Head differs from the exact comparison Head named by
   the currently effective Owner authorization or Work Order, or the accepted
   Proposal, 003A Task Card, 003B Task Card or Migration 014 seal differs;
2. the exact six-path allowlist no longer matches repository topology;
3. a seventh source, test, package or documentation path is required;
4. the accepted API lacks a behavior required by this Task Card;
5. API, Application, Domain, Repository, SQLite, schema, migration, package or
   composition modification is required;
6. `/admin/ingredients` conflicts with a then-current route or navigation entry;
7. safe dynamic rendering cannot be implemented within the new page;
8. local-time to UTC ISO conversion cannot be implemented without silently
   generating or changing caller evidence;
9. code-specific 409 handling cannot preserve accepted server semantics;
10. Architecture Guard coverage would need to be removed or materially weakened;
11. existing Cost creation or 003B management behavior would change;
12. typecheck depends on a later PR;
13. final verification still fails and cannot be corrected within the six-path
    boundary;
14. Reactivation, Delete, Merge, Reference Impact, authentication, authorization
    or another excluded capability becomes necessary; or
15. any authorization identity or governance boundary becomes uncertain.

The drafting observation Head is not a permanent Stop Condition seal. A Head
mismatch against the currently effective authorization requires a report; it
does not authorize rebasing, changing base or absorbing new changes.

A stop condition does not authorize remediation or scope expansion. It requires
a report and a new Owner decision.

## 26. Governance and implementation gates

1. Owner authorized this Task Card candidate after passing 003C Readiness.
2. Independent read-only Task Card review must return a verdict.
3. Owner must separately authorize Task Card recording.
4. Task Card recording must use a governance-only branch and contain only this
   document.
5. The recorded Task Card PR requires independent review and separate Owner merge
   authorization.
6. After Task Card merge, Owner must separately issue a 003C implementation Work
   Order against the then-current integration Head.
7. Implementation must stop at its required pre-commit Gate.
8. Staging and commit require separate Owner authorization.
9. Push, PR creation and independent implementation review require separate
   Owner authorization.
10. Remediation, if any, requires explicit Owner authorization.
11. Merge requires a separate Owner Merge Authorization tied to exact Base, Head,
    file inventory and statistics.
12. Post-merge verification must pass before 003C is complete.

Completing one Gate never authorizes the next.

## 27. Required future implementation pre-commit report

The future implementation report must include:

1. Approval record and exact implementation base.
2. Current branch, Head, remote integration Head and ahead/behind.
3. Exact six-path inventory and per-file/cumulative statistics.
4. Path-by-path implementation summary.
5. Confirmation that no seventh path changed.
6. UI route and navigation evidence.
7. UI/API/Domain dependency evidence.
8. Exact API endpoint and envelope use.
9. Each 409 code and its distinct UI behavior.
10. Caller evidence and local-time-to-UTC conversion evidence.
11. Safe DOM rendering evidence.
12. Desktop E2E results.
13. Representative mobile results, reported separately.
14. API integration and Architecture Guard results.
15. Typecheck, lint, build, configured suite, verify and verify:full results,
    reported as separate collections.
16. Exact diff and whitespace checks.
17. Protected path and seal verification.
18. Complete Git status and confirmation that the staged area remains empty.
19. Confirmation that no Create, Reactivate, Delete, Merge, Reference Impact,
    authentication or other excluded work occurred.
20. Every failure, discrepancy and uncertainty.

The future implementation must stop at its Owner-defined pre-commit Gate. It may
not infer staging, commit, push, PR or merge authority from this Task Card.

## Current status

**TASK CARD REVIEW CANDIDATE — INGREDIENT 003C IMPLEMENTATION NOT AUTHORIZED**
