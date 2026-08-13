# PR-INGREDIENT-003E — Canonical Ingredient Reference Impact UI

> **OWNER-DIRECTED TASK CARD CANDIDATE — IMPLEMENTATION NOT AUTHORIZED**

Status: Task Card candidate — implementation not authorized

Current Owner Goal: define one reviewable, UI-only implementation slice that
adds an explicit, on-demand Canonical Ingredient Reference Impact panel to the
existing Ingredient management detail page by consuming the already merged
Ingredient 003D HTTP GET contract.

This Task Card candidate does not authorize an implementation branch, source or
test modification, staging, commit, push, PR creation, merge, Ingredient 003F,
another Domain, `main` promotion, release, or deployment.

## 1. Authority and observation identities

The Owner formally designated this Task Card candidate as:

```text
PR-INGREDIENT-003E — Canonical Ingredient Reference Impact UI
```

The drafting and repository-observation base is:

```text
c793417e9d59a7a77ac9f91283d079a177ba3405
```

At drafting time, local and remote
`integration/architecture-development` both point to that exact Head, with the
local branch ahead `0`, behind `0`, and a clean worktree and staged area.

This observation Head is not automatically frozen as a future recording base or
implementation base. Each later recording, implementation, Git, review, and
merge Work Order must state and reverify its own exact authorized Head.

Protected governance identities observed at the drafting base:

| Evidence | Git blob |
| --- | --- |
| `docs/DECISIONS.md`, including DECISIONS #069 and #071 | `ff511056df2ff71403bd657a608cef0fee77e96d` |
| Accepted Ingredient Proposal | `35a41567b16a714e154162042fba1ee0f6d160d9` |
| PR-INGREDIENT-003A Task Card | `d678765982fa11e9921ab898dfc4d878bbcd7e10` |
| PR-INGREDIENT-003B Task Card | `9453d54b4ad0529c84c277f61ebb83efcae0c1ec` |
| PR-INGREDIENT-003C Task Card | `085858fd39ec5d4d614b862f6e9e664da381f1a5` |
| PR-INGREDIENT-003D Task Card | `58fb914c4a1e8004439fea91062cfd90c08b9222` |

Observed current implementation identities:

| Path | Git blob |
| --- | --- |
| `src/web/ingredients/page.ts` | `c2420e7944a15dd72f9ad37fb03d24e55def5791` |
| `tests/e2e/canonical-ingredient-management.spec.ts` | `5cc160db7fb630684b138d888a00a4afc63376d5` |
| `src/tests/architecture-guards.test.ts` | `f8dbb6dbe8bc010f710966f2953a85ef8bfc5718` |

These implementation blobs are observation evidence, not permission to modify
the files before a later exact Implementation Work Order.

## 2. Constitution Compatibility Gate

Reviewed authority:

- `CONSTITUTION.md`, especially exclusive ownership, Canonical Ingredient
  lifecycle policy, cross-Domain boundaries, and historical truth;
- DECISIONS #069 — Canonical Ingredient Lifecycle Governance Alignment;
- DECISIONS #071 — Canonical Ingredient Reference Impact Read Model;
- the accepted PR-INGREDIENT-003 Proposal;
- the accepted PR-INGREDIENT-003A through 003D Task Cards;
- the current Recipe, Cost, Application, API, and UI public boundaries; and
- `docs/REPOSITORY_WORKING_GUIDE.md`.

Compatibility Result:

```text
PASS — TASK CARD CANDIDATE ONLY; IMPLEMENTATION NOT AUTHORIZED
```

The proposed slice consumes a versioned read projection through its accepted
HTTP boundary. It creates no Domain fact, business authority, lifecycle
transition, persistence authority, cross-Domain table read, schema, migration,
or navigation authority.

## 3. Single responsibility

Ingredient 003E has exactly one responsibility:

```text
Inside the existing /admin/ingredients Ingredient detail UI, let an operator
explicitly request and read the selected Canonical Ingredient's Reference Impact
by consuming the existing Ingredient 003D HTTP GET contract.
```

The UI is a presentation and request-orchestration consumer only. It does not
calculate, infer, amend, rank, filter, rewrite, persist, or authorize any
Reference Impact business fact.

Ingredient 003E adds no lifecycle behavior and no business command.

## 4. Relationship to completed Ingredient slices

### Ingredient 003A

003A remains the complete Rename and Archive command boundary. 003E must not
modify its commands, results, audit evidence, version precedence, duplicate
warnings, errors, Repository dependency, or synchronous service behavior.

### Ingredient 003B

003B remains the complete management read, persistence, API, and Runtime
composition boundary. 003E must not modify collection, detail, Rename, Archive,
SQLite management reads, server adapter, or Cost creation-composition behavior.

### Ingredient 003C

003C remains the owner of the existing `/admin/ingredients` page, its fixed
navigation placement, transient UI state, safe rendering, Rename and Archive
flows, code-specific conflict handling, and responsive behavior.

003E extends that existing page with one read-only panel. It does not create a
new page, route, navigation entry, UI framework, or second Ingredient state
model.

### Ingredient 003D

003D remains the sole Application, Domain-owned port, persistence, composition,
and API authority for Canonical Ingredient Reference Impact v1.

003E must consume, without changing:

```text
GET /api/admin/canonical-ingredients/:ingredientId/reference-impact
```

No browser code may import the 003D Application Service, Recipe or Cost public
port, Repository, SQLite implementation, Database Adapter, or another Domain.

## 5. Fixed interaction policy

Reference Impact is an explicit, on-demand operation.

The page must expose an operator-visible control labelled:

```text
查看引用影響
```

The existing GET request may be sent only after the operator activates that
control for the currently selected Ingredient.

The page must not request Reference Impact:

- during initial page load;
- when the Ingredient collection loads or refreshes;
- when the lifecycle filter changes;
- merely because Ingredient selection changes;
- when Ingredient detail loads or refreshes;
- after Rename or Archive unless the operator explicitly requests it again;
- through background polling;
- through a timer or automatic refresh loop;
- through an automatic retry; or
- during browser reload restoration.

After an explicit request completes, the same control may offer an explicit
operator retry or refresh. Every later request must still result from a new
operator action.

No prefetch, speculative fetch, hover fetch, visibility-triggered fetch, or
background revalidation is authorized.

## 6. Selection and request identity

The request path must use exactly the currently selected Ingredient identity as
one encoded path segment:

```text
/api/admin/canonical-ingredients/${encodeURIComponent(ingredientId)}/reference-impact
```

The transport encoding is not identity normalization. The UI must not alter,
decode and re-encode repeatedly, infer, replace, merge, or select another
Ingredient identity.

Every request must retain enough transient request context to prove:

- which selected Ingredient initiated it;
- which request generation or token owns the response;
- whether the selection has changed since the request began; and
- whether a later request superseded it.

When selection changes:

1. the previous panel data is removed from the active selection presentation;
2. any in-flight prior request becomes stale;
3. its later success or failure must not render into the new selection;
4. the new selection remains in the idle, not-yet-requested state; and
5. no automatic request is sent for the new selection.

A successful payload whose `ingredientId` does not exactly equal the initiating
selected identity is unusable and must fail closed. It must not be displayed,
relabelled, or attached to the current Ingredient.

Changing selection and later returning to a prior Ingredient must not restore
the prior response as current business evidence. A new explicit operator action
is required.

## 7. Accepted HTTP contract

Ingredient 003E consumes the existing 003D success envelope:

```ts
Readonly<{
  ok: true;
  data: CanonicalIngredientReferenceImpactV1;
}>
```

The accepted result contract remains owned by the existing 003D Application
boundary:

```ts
Readonly<{
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
    references: readonly Readonly<{
      recipeId: string;
      draftId: string;
      recipeLineId: string;
    }>[];
  }>;
  recipePublishedVersions: Readonly<{
    availability: "Available";
    uniqueRecipeCount: number;
    publishedVersionCount: number;
    lineOccurrenceCount: number;
    recipeIds: readonly string[];
    recipeVersionIds: readonly string[];
    references: readonly Readonly<{
      recipeId: string;
      recipeVersionId: string;
      recipeLineId: string;
    }>[];
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
}>
```

This Task Card does not create a duplicate TypeScript authority for that DTO.
Browser-side shape checks are defensive response validation only. They must not
be exported as a Domain, Application, shared, or persistence contract.

## 8. Browser response validation

Before rendering a success result, the page must reject any response that does
not prove all required v1 fields and discriminants.

At minimum, validation must require:

- an object success envelope with `ok: true`;
- `contractName === "CanonicalIngredientReferenceImpact"`;
- `contractVersion === 1`;
- exact matching `ingredientId`;
- `availability === "Available"` for Recipe Draft, Recipe Published Version,
  and Cost Quote sections;
- non-negative safe-integer counts for every available count;
- arrays for all ID and structured-reference collections;
- text identity fields in every collection item;
- `acceptedPurchases.availability === "Unavailable"`;
- `costSnapshots.availability === "Unavailable"`;
- `deletionEligibility.status === "Indeterminate"`; and
- `deletionEligibility.blocked === true`.

The browser must not repair malformed payloads, default missing fields, coerce
counts, remove malformed entries while rendering the rest, or derive a partial
success result.

A malformed success envelope or unusable payload is one failed request. It is
not zero impact and does not preserve a prior success as current evidence.

## 9. UI presentation semantics

The panel must visibly distinguish these states:

1. idle — no Reference Impact request has been made for the selection;
2. loading — one explicit request is in flight;
3. success with available references;
4. success with an available category whose count is zero;
5. success with an unavailable authority;
6. failed request with a safe message; and
7. stale response ignored after selection or request identity changed.

The panel must display the actual v1 categories:

- Recipe Draft impact;
- Published and Superseded Recipe Version impact;
- Recorded and Superseded Cost Quote references;
- Accepted Purchase availability;
- Cost Snapshot availability; and
- deletion eligibility.

### Recipe Draft presentation

Display:

- unique Recipe count;
- Draft count;
- line-occurrence count;
- Recipe IDs;
- Draft IDs; and
- each structured `recipeId`, `draftId`, `recipeLineId` reference.

### Published Recipe Version presentation

Display:

- unique Recipe count;
- Published Version count;
- line-occurrence count;
- Recipe IDs;
- Recipe Version IDs; and
- each structured `recipeId`, `recipeVersionId`, `recipeLineId` reference.

The UI must not relabel the collection as only current or only Published
history. The 003D contract includes Published and Superseded Version history.

### Cost Quote presentation

Display:

- Quote count; and
- every returned Quote ID.

The UI must not claim the collection contains only current or effective Quotes.
It includes Recorded and Superseded formal Quote history.

### Ordering

The UI must preserve API collection order exactly.

It must not locally:

- sort;
- rank;
- deduplicate;
- normalize;
- filter;
- group away occurrences;
- select a winner; or
- infer identity from names.

### Available zero versus Unavailable

An available category with a numeric zero and empty collections must be shown as
available with no known references in that category.

`Accepted Purchase = Unavailable` and `Cost Snapshot = Unavailable` must be
shown as unavailable authority, not as zero, empty, clear, safe, or complete.

The two states must have distinct visible text and semantics. Styling alone is
not sufficient to distinguish them.

### Deletion eligibility

Display exactly the informational result:

```text
Indeterminate — blocked
```

The panel must not expose a Delete button, override, acknowledgement, bypass,
eligibility calculation, or wording that implies deletion is safe.

## 10. Active and Archived Ingredient behavior

Both Active and Archived Canonical Ingredients may use the on-demand panel.

Archived status must not:

- hide historical Recipe or Cost references;
- convert an unavailable authority to zero;
- enable Reactivation, Delete, Merge, or alias behavior;
- alter the 003D result; or
- make Reference Impact request automatically.

The existing 003C rule that Archived Ingredients have no Rename or Archive
actions remains unchanged.

## 11. Loading and duplicate request behavior

While one Reference Impact request is in flight for the current selection:

- the trigger is disabled or otherwise protected from duplicate submission;
- visible loading state identifies Reference Impact, not a lifecycle command;
- Rename and Archive request identity and results remain independent;
- no timer-based retry is scheduled; and
- a selection change makes the request stale.

003E must not cancel, retry, serialize, or reinterpret an existing lifecycle
mutation. Reference Impact is read-only orchestration alongside, not inside, the
003A command flow.

## 12. Failure mapping and safe messages

The page consumes the existing error envelope and accepted HTTP mapping:

| HTTP | Stable code | UI classification |
| ---: | --- | --- |
| 422 | `CANONICAL_INGREDIENT_REFERENCE_IMPACT_VALIDATION_FAILURE` | Reference Impact identity or request validation failed |
| 404 | `CANONICAL_INGREDIENT_REFERENCE_IMPACT_NOT_FOUND` | The selected identity could not be found by the authoritative read |
| 500 | `CANONICAL_INGREDIENT_REFERENCE_IMPACT_READ_FAILURE` | Reference Impact could not be read |

The UI must also handle:

- network and offline failure;
- non-JSON response;
- malformed JSON success or failure envelopes;
- unknown status or stable code; and
- stale success or failure after selection changes.

For every failure:

- no category is rendered as zero;
- no unavailable category is converted to available;
- no prior response is presented as the current request's success;
- no raw Repository, SQLite, persistence cause, message, property, stack, SQL,
  table name, path, or implementation detail is displayed;
- no command success or lifecycle change is inferred; and
- retry remains an explicit operator action.

Unknown or unsafe server details must be replaced with a safe UI-level message.

## 13. Transient browser-state boundary

The page may hold only transient presentation and request-orchestration state
for this feature, including:

- current selected Ingredient identity;
- current Reference Impact request token or generation;
- loading state;
- the last successful response for the currently unchanged selection;
- safe error state; and
- idle/success/failure presentation state.

Reference Impact browser state:

- must not persist across page reload;
- must not use `localStorage`, `sessionStorage`, IndexedDB, cookies, Cache API, a
  Service Worker, or another offline store;
- must not become business authority;
- must not generate or infer Domain facts, versions, references, availability,
  lifecycle status, command success, or deletion eligibility;
- must not survive selection changes as current evidence; and
- must not trigger background refresh.

## 14. Safe rendering boundary

All server-controlled and identity values must be rendered through safe text
operations such as `textContent`, `createTextNode`, or the existing helper that
assigns `textContent`.

Dynamic values must not flow into:

- `innerHTML`;
- `outerHTML`;
- `insertAdjacentHTML`;
- inline event-handler attributes;
- `document.write`;
- script construction or evaluation;
- CSS selectors assembled from an untrusted identity;
- unvalidated navigation targets; or
- raw error detail rendering.

The static server-rendered page template may contain fixed markup. This does not
authorize interpolation of remote or operator-controlled values into that
template.

## 15. Exact implementation allowlist

A future Ingredient 003E implementation PR may modify exactly these three
existing paths:

1. `src/web/ingredients/page.ts`
2. `tests/e2e/canonical-ingredient-management.spec.ts`
3. `src/tests/architecture-guards.test.ts`

No new file is authorized.

The Task Card path is a preceding governance artifact and is not part of the
three-path implementation allowlist.

There is no conditional path, wildcard, directory permission, `if required`, or
`as needed` scope.

If typecheckable, testable, complete implementation requires a fourth path,
stop and report the exact missing dependency. Do not add or modify that path.

## 16. Path-by-path responsibility

| Path | Exact 003E responsibility |
| --- | --- |
| `src/web/ingredients/page.ts` | Add the on-demand read-only panel, defensive response validation, encoded selected identity, request-generation isolation, loading/success/failure presentation, safe text rendering, explicit retry, and selection clearing |
| `tests/e2e/canonical-ingredient-management.spec.ts` | Add Reference Impact UI behavior, ordering, availability, error, race, safety, active/archive, non-regression, and representative mobile evidence; replace only the superseded 003C assertion that Reference Impact UI must be absent |
| `src/tests/architecture-guards.test.ts` | Precisely permit only the existing Ingredient page to consume the existing GET endpoint while preserving all Domain, persistence, API, Runtime, navigation, mutation, safe-rendering, storage, and prior-slice guards |

## 17. Files that must remain unchanged

The implementation must not modify:

- `src/application/canonical-ingredient-reference-impact-service.ts`;
- either Domain-owned Ingredient Reference Impact read port;
- any Recipe or Cost Repository or SQLite implementation;
- Recipe or Cost public indexes;
- `src/server/app/routes.ts`;
- `src/server/index.ts`;
- `src/web/shared/navigation.ts`;
- any Application, Domain, API, persistence, migration, schema, package, Runtime,
  configuration, generated artifact, governance, or Task Card path;
- any existing focused Application, persistence, API integration, lifecycle, or
  management test outside the exact three-path allowlist; and
- every path not listed in Section 15.

`docs/ROADMAP.md` has a known freshness gap. It is outside 003E implementation
scope and must not be changed, staged, committed, or synchronized in the
implementation PR.

## 18. Architecture Guard change

The current Guard intentionally proves that 003D added no Reference Impact UI.
003E must replace only that now-superseded absence rule with precise positive
003E protection.

The revised Guard must prove:

1. only `src/web/ingredients/page.ts` among production UI files may contain or
   call the Reference Impact endpoint;
2. the accepted API suffix is exactly `/reference-impact` under the existing
   canonical Ingredient identity path;
3. the page performs only GET consumption for Reference Impact;
4. no POST, PUT, PATCH, or DELETE Reference Impact behavior exists;
5. selection identity is encoded as one path segment;
6. the trigger is explicit and no page load, list load, list refresh, selection
   change, timer, polling, or background loop invokes the request;
7. no new navigation entry or page route exists;
8. the page retains its existing single import boundary to shared navigation
   and does not import Application, Domain, Repository, SQLite, Database,
   migration, server-service internals, or another Domain;
9. dynamic values use safe text rendering;
10. no browser persistence or offline authority is introduced;
11. no Delete, Reactivate, Merge, alias, Create, identity resolution, lifecycle
    mutation, Purchase authority, Snapshot authority, or eligibility override
    control exists;
12. existing Rename and Archive controls and protections remain;
13. the exact 003D API route, service composition, DTO, stable errors,
    Domain-owned ports, query boundary, no-partial-success behavior, and raw
    persistence containment remain unchanged;
14. the exact three-path 003E responsibility is protected without claiming that
    tests or documentation are production UI; and
15. earlier Architecture Guards are extended, not removed or weakened.

The Guard must not globally permit `reference-impact` in arbitrary `src/web`
files. It must use an exact-file exception for the existing Ingredient page and
continue rejecting the namespace elsewhere in production UI and navigation.

## 19. Focused E2E requirements — request policy

The existing Canonical Ingredient management E2E file must prove:

1. initial `/admin/ingredients` load sends zero Reference Impact requests;
2. list refresh sends zero Reference Impact requests;
3. lifecycle filter changes send zero Reference Impact requests;
4. selecting an Active Ingredient sends zero Reference Impact requests;
5. selecting an Archived Ingredient sends zero Reference Impact requests;
6. the trigger is visible for both statuses;
7. one explicit trigger action sends exactly one GET request;
8. the request path contains exactly one encoded selected identity segment;
9. no POST, PUT, PATCH, or DELETE request is issued by the panel;
10. no background request appears after a representative wait; and
11. explicit retry or refresh sends a request only after its own operator action.

## 20. Focused E2E requirements — success semantics

E2E must exercise a valid v1 response containing non-trivial, distinguishable
identities and prove:

- exact selected Ingredient identity;
- Draft unique Recipe, Draft, and line-occurrence counts;
- Draft Recipe IDs, Draft IDs, and structured references;
- Published unique Recipe, Version, and line-occurrence counts;
- Published and Superseded reference identities;
- Recorded and Superseded Cost Quote count and IDs;
- exact returned order for all collections;
- no local sorting, filtering, deduplication, or name-based identity inference;
- `Accepted Purchase = Unavailable`;
- `Cost Snapshot = Unavailable`;
- `deletion eligibility = Indeterminate / blocked`; and
- no Delete or eligibility override action.

A separate successful result must prove that an Available category with zero
count is visibly different from an Unavailable authority.

## 21. Focused E2E requirements — failure and races

E2E must prove:

1. 422 uses the accepted Reference Impact validation classification;
2. 404 uses the accepted Reference Impact Not Found classification;
3. 500 uses a safe read-failure message;
4. network/offline failure is retryable only by explicit action;
5. non-JSON and malformed success payloads are unusable failures;
6. malformed results never become zero references;
7. raw persistence messages, causes, stacks, SQL, or table names are absent;
8. selecting Ingredient A, requesting impact, then selecting Ingredient B before
   A completes leaves B idle and ignores A success;
9. the same race ignores A failure;
10. two explicit requests for one unchanged selection allow only the latest
    response to become current;
11. a response with mismatched `ingredientId` is rejected; and
12. returning to A does not automatically restore or refetch A impact.

## 22. Focused E2E requirements — non-regression and safety

The file must retain and continue proving:

- Ingredient collection, filter, selection, and detail behavior;
- Rename with exact caller-reported audit evidence and local-to-UTC conversion;
- non-blocking duplicate-warning behavior and ordering;
- Archive confirmation and append-only evidence;
- exact 422, 404, code-specific 409, 500, offline, and malformed-response
  behavior for existing management commands;
- stale command-response protection;
- safe path-segment encoding;
- safe rendering of malicious remote values;
- no Create, Reactivate, Delete, Merge, or alias behavior;
- no automatic command retry; and
- representative mobile operability.

The old 003C assertion that no `Reference Impact` control exists must be changed
only to permit the accepted read-only trigger and panel. Other forbidden control
assertions remain.

## 23. Representative mobile coverage

The existing representative mobile test may be extended or a focused case may
be added in the same allowed E2E file.

It must prove:

- the on-demand trigger is reachable;
- the panel does not obscure list, detail, Rename, or Archive controls;
- long IDs, reference collections, unavailable labels, and safe errors remain
  readable without clipping critical controls; and
- the panel does not add a navigation entry or automatic request.

Mobile coverage need not repeat the full desktop contract and error matrix.

## 24. Required verification

Before any future implementation is reported complete, run and separately
report:

```text
npm run typecheck
npm run lint
npm run build
npm run test:e2e -- tests/e2e/canonical-ingredient-management.spec.ts
npm run architecture:guard
npm run test:e2e
npm test
npm run verify
npm run verify:full
git diff --check
```

After `npm run build`, run focused compiled regression selections for:

- Canonical Ingredient lifecycle Application behavior;
- Canonical Ingredient management and lifecycle API integration;
- Reference Impact Application behavior;
- Reference Impact persistence integration;
- Reference Impact API integration; and
- Architecture Guards.

Manually enumerate every compiled `dist/tests/*.test.js` file and execute the
complete explicit collection. Report the exact file count and test count from
that run.

Report each suite and command with its own provenance and passed/total counts.
Do not sum overlapping suites into a fictional aggregate.

If a first run is incomplete, locked, timed out, or otherwise not a valid full
run, record it as not counted. A later clean, complete rerun must be separately
identified.

The final verification report must also include:

- exact three-path diff inventory;
- zero diff outside the allowlist;
- zero migration, schema, package, API, Runtime, navigation, Application,
  Domain, Repository, and persistence diff;
- strict UTF-8 validation;
- final newline validation;
- zero trailing whitespace;
- Markdown or generated-artifact checks where applicable;
- worktree blob for all three changed files;
- staged state; and
- generated-artifact inventory.

## 25. Explicit exclusions

Ingredient 003E must not include:

- Delete;
- Reactivate;
- Merge or aliases;
- Create or automatic identity resolution;
- any Canonical Ingredient lifecycle mutation;
- a new UI route or page;
- a new navigation item or navigation rearrangement;
- Reference Impact Application, Domain, persistence, API, or composition change;
- direct import of Application, Domain, Repository, SQLite, Database Adapter,
  migration, or server internals by browser UI;
- Purchase Domain or Accepted Purchase authority;
- reads from legacy `cost_purchases` or `cost_purchase_items`;
- Cost Snapshot identity, persistence, calculation, or reporting history;
- deletion eligibility calculation, override, acknowledgement, or bypass;
- Recipe or Cost calculation;
- Supplier, Inventory, Package, Measurement, conversion, density, or
  variable-weight work;
- authentication or authorization;
- migration, schema, index, package, or dependency change;
- browser persistence, Service Worker, offline cache, or background polling;
- governance or Roadmap synchronization;
- Ingredient 003F or another Ingredient item;
- another Domain implementation;
- branch cleanup;
- `main` promotion;
- release; or
- deployment.

## 26. Protected behavior

The implementation must preserve:

- immutable Canonical Ingredient identity;
- append-only Rename and Archive evidence;
- version-first lifecycle command precedence;
- non-blocking duplicate warnings;
- caller-reported and unverified actor evidence wording;
- existing four management API registrations and six 003B behaviors;
- the existing Cost-only Ingredient creation-composition route;
- existing `/admin/ingredients` route and navigation placement;
- existing Active/Archived list and detail behavior;
- existing 003C safe rendering and transient-state rules;
- exact 003D DTO, HTTP route, stable errors, status mapping, read failure
  semantics, deterministic ordering, controlled full scans, and Domain-owned
  public read ports;
- Accepted Purchase and Cost Snapshot `Unavailable` semantics;
- deletion eligibility `Indeterminate / blocked` semantics;
- all migrations, including Migration 014 and Migration 017; and
- all governance documents and every path outside the exact allowlist.

## 27. Stop conditions

Stop before implementation completion, staging, commit, push, or PR creation if:

1. the future Work Order's remote integration Head differs from its exact
   authorized Head;
2. this Task Card, DECISIONS #069, DECISIONS #071, the accepted Proposal, an
   earlier Ingredient Task Card, Constitution, or protected migration differs;
3. a fourth implementation path is required;
4. a new file is required;
5. the existing 003D endpoint or DTO must change;
6. an Application, Domain, Repository, persistence, API route, Runtime
   composition, navigation, migration, schema, package, or dependency change is
   required;
7. Reference Impact cannot remain explicit and on-demand;
8. selection, list refresh, page load, timer, or background activity would need
   to trigger the request;
9. a stale response cannot be isolated from current selection;
10. Available zero cannot be distinguished from Unavailable;
11. a malformed or failed response would need to be interpreted as zero or
    partial success;
12. a raw persistence detail would cross into browser presentation;
13. the UI would need to infer, recalculate, sort, filter, deduplicate, or amend
    003D business evidence;
14. direct browser dependency on an internal Application, Domain, Repository,
    SQLite, Database, or server adapter is required;
15. Delete, Reactivate, Merge, aliases, lifecycle mutation, Purchase authority,
    Snapshot persistence, or eligibility override enters scope;
16. the existing Architecture Guards must be generally weakened rather than
    precisely extended;
17. the known Roadmap freshness gap would need to be changed in this PR;
18. Ingredient 003F or another Domain enters scope;
19. final required verification remains failing and cannot be corrected within
    the exact three paths; or
20. branch, worktree, stage, generated-artifact, or protected-path state differs
    from the future Work Order.

Do not self-repair a governance, base, scope, or seal discrepancy. Report the
exact blocker to the Owner.

## 28. Governance and implementation gates

1. Owner designated the 003E objective, interaction policy, exact three-path
   allowlist, UI semantics, failure policy, architecture boundary, exclusions,
   and verification requirements for this Task Card candidate.
2. Creation of this response-authorized Task Card candidate is not recording,
   commit, push, PR, merge, or implementation authority.
3. Owner must independently review and accept the complete Task Card candidate.
4. Task Card staging, commit, push, PR creation, review, and merge require
   separately authorized Git Gates.
5. Task Card merge does not authorize implementation.
6. Before implementation, Owner must issue a separate exact Implementation Work
   Order using the then-current integration Head and reverified protected
   identities.
7. Implementation must stop at an independently reviewable uncommitted candidate
   Gate.
8. Implementation commit, push, PR creation, independent PR review,
   remediation, and merge each require separate Owner authorization.
9. Post-merge verification and governance closeout remain separate work.
10. Ingredient 003F, another Domain, `main`, release, and deployment remain
    unauthorized.

## 29. Required future implementation report

A future implementation candidate report must include:

- approval record and exact implementation base;
- current branch, local Head, remote integration Head, upstream, and
  ahead/behind;
- exact three-path inventory and diff statistics;
- worktree blobs for all three paths;
- protected Decision, Proposal, Task Card, migration, and baseline seals;
- exact on-demand request evidence;
- proof of zero initial, selection, list-refresh, filter, polling, and background
  Reference Impact requests;
- exact GET method, encoded path, selected identity, request count, and response
  identity evidence;
- stale selection and latest-request evidence;
- exact DTO validation and presentation evidence;
- Available-zero versus Unavailable evidence;
- Active and Archived evidence;
- 422, 404, 500, offline, malformed, mismatch, and safe-error evidence;
- no raw persistence leakage evidence;
- safe text rendering evidence;
- no Delete, Reactivate, Merge, alias, lifecycle mutation, Purchase, Snapshot,
  override, navigation, or new route evidence;
- exact Architecture Guard changes and non-weakening evidence;
- existing Rename and Archive regression evidence;
- focused, full E2E, repository verification, and complete compiled-test counts;
- `git diff --check`, UTF-8, final newline, trailing whitespace, and generated
  artifact results;
- complete worktree and staged state; and
- every blocker, discrepancy, incomplete run, or remaining uncertainty.

## Current status

**OWNER-DIRECTED TASK CARD CANDIDATE — IMPLEMENTATION NOT AUTHORIZED**
