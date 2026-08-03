# PR-RECIPE-MANAGEMENT-001: Formal Recipe Draft Creation and Publication

> **PROPOSAL ONLY - IMPLEMENTATION NOT AUTHORIZED**

Status: Owner review draft
Document type: Architecture and implementation-boundary proposal
Architecture Owner: Miles / Lin Zi-Mao
Current Owner Goal: Formal Recipe Draft Creation and Publication
Baseline branch: `integration/architecture-development`
Baseline SHA: `2f4663b082fd3c74e8edfb38110a58632d7420c2`

This document does not authorize an Architecture change, Governance change,
Schema, Migration, API, UI, Runtime, Test implementation, branch, commit, push,
or Pull Request. Every proposed implementation PR requires a separate Owner
Work Order with an exact baseline, allowlist, verification plan, and Git gate.

Completion of this Proposal does not authorize PR-INGREDIENT-003 or any Cost,
Kitchen, Planning, Inventory, Purchase, Supplier, or AI implementation.

## 1. Purpose

Define the smallest formal management workflow that lets an authorized Back
Office operator:

1. create the single Recipe Family and Recipe Draft bound to one canonical
   Product;
2. repeatedly edit its name, ordered Ingredient Lines identified by stable
   `recipeLineId`, exact quantities, Standard Output, Standard Yield, optional
   plain-text Recipe instructions, and optional Line preparation notes;
3. validate the Draft without publishing it;
4. publish one immutable Recipe Version atomically;
5. create a later Draft from an immutable Published Version;
6. publish the later revision without overwriting history; and
7. read Draft management state and immutable Published history through
   authority-owned contracts.

The first implementation slice should make the already approved Recipe
authority practically reusable. It must not create a second Recipe/BOM source
inside Cost, Catalog, Kitchen, browser state, or server composition.

## 2. Current Baseline Audit

### 2.1 Approved and implemented

- Constitution v3, ADR-019, and DECISIONS #048 establish Recipe/BOM as the sole
  Recipe authority.
- Catalog owns Product identity and publishes Product Contract v2.
- Canonical Ingredient Identity Authority is independent and currently hosted
  in Recipe Core. Recipe references `ing_<uuid>` identity but does not own it.
- Measurement Foundation and Ingredient Measurement Profile contracts own unit
  interpretation and normalization evidence.
- Migration 016 persists `recipe_recipes`, Recipe Drafts and Lines, immutable
  Recipe Versions and Lines, publication audit, and supersession audit.
- `RecipeAggregate` supports Draft creation, rename, Product binding, Ingredient
  addition, Standard Output/Yield definition, publication, and supersession.
- `RecipePublishService` supports Draft creation, publication, creation of a
  Draft from a Published Version, and supersession with expected-version writes.
- `SqliteRecipeRepository` uses SQLite `IMMEDIATE` transactions, append-first
  Version history, immutable Version-content checks, and optimistic concurrency.
- `RecipePublished` and `RecipeSuperseded` v1 Domain Events exist as immutable
  in-process event envelopes.
- `RecipeCanonicalProjectionV1` and `RecipeCostingContractV2` are approved,
  immutable public boundaries for Cost consumption.
- Domain, persistence, event, projection, Cost-contract, integration, and Cost
  Back Office E2E tests cover the currently implemented vertical slice.

### 2.2 Present but incomplete for the Current Owner Goal

- `/api/admin/cost/recipes` calls `createAndPublishRecipe(...)`. It creates,
  configures, and publishes in one request instead of exposing a reusable Draft.
- `/admin/cost` provides a single-form Recipe path with one Ingredient Line.
  It has no Draft list/detail, repeated edit, separate validate/publish command,
  Published history view, or conflict-recovery workflow.
- The server currently trusts caller-supplied Product and Product Version IDs
  during Recipe creation. It does not validate the pair through Product Contract
  v2 at the Recipe application boundary.
- Draft writes are repository-capable, but there is no complete Draft
  Application Service for stable-identity update/remove/reorder operations or
  typed API outcomes.
- Publish and supersede are separate service operations. The current API creates
  only v1 and does not prove that replacement publication and supersession commit
  as one business transaction.
- Repository `listRecipes()` is a narrow Back Office list, not a versioned Draft
  and Published-history management read contract.
- Published Cost consumption exists. Kitchen and Production Planning have no
  approved implemented Published Recipe consumer contract in this baseline.

### 2.3 Governance and implementation drift requiring explicit correction

DECISIONS #052, #060, #063, and #064 require ordered Recipe Lines to preserve
future repeated Ingredient use. Current implementation instead rejects a second
Line with the same Ingredient and Migration 016 contains unique constraints on
`(draft_id, ingredient_id)` and `(recipe_version_id, ingredient_id)`.

The correction belongs in a separately authorized Schema/Domain slice. This
Proposal must not silently preserve the conflicting uniqueness rule or silently
modify Migration 016.

### 2.4 Not implemented

- Formal independent Draft management API and UI.
- Update, remove, and reorder Ingredient Line commands.
- Draft abandon lifecycle and audit.
- Atomic replacement publication that both publishes the next Version and
  supersedes the previous current Version.
- Durable caller-visible command idempotency receipts.
- General half-product/subrecipe references.
- Recipe Family retirement or archival.
- Published Recipe read contracts for Kitchen or Production Planning.
- Persisted Cost Snapshot references to Recipe Version.

## 3. Direct Blocker Assessment

Direct blockers to authoring this Proposal: **NONE**.

The current Constitution and ADR-019 permit Recipe Drafts, immutable Published
Versions, version history, and Recipe-owned contracts. Existing code and
Migration 016 provide sufficient evidence to propose a bounded correction and
management workflow.

The Owner has resolved the Recipe v1 decisions required by this Proposal:

- every Recipe Line has immutable stable `recipeLineId` identity;
- repeated Ingredient Lines are legal;
- an unpublished Draft may enter terminal `ABANDONED` state;
- one canonical Product has exactly one Recipe Family in the global default
  scope;
- publication requires a durable idempotency receipt in the publication
  transaction;
- optional plain-text Recipe instructions and Line preparation notes are part
  of Recipe v1; and
- subrecipe composition remains deferred.

Implementation remains blocked until separately authorized PRs correct the
Aggregate and persistence drift after Migration 016 and implement these rules
consistently. These are implementation prerequisites, not open decisions.

## 4. Ownership and Domain Boundaries

### 4.1 Recipe authority

Recipe/BOM is the canonical owner of:

- stable Recipe identity;
- working Recipe Draft identity and editable Draft facts;
- immutable Published Recipe Version identity and content;
- ordered Recipe Lines, stable `recipeLineId` identity, and their exact
  formulation quantities;
- Product/Product Version references pinned by a Published Version;
- Standard Output and Standard Yield;
- optional plain-text Recipe-level instructions and Line preparation notes;
- publication and supersession evidence; and
- Recipe Version history.

Recipe source code remains under `src/domains/recipe`. Canonical Ingredient and
Measurement code may be hosted in the same Core, but hosting does not transfer
their authority to Recipe.

### 4.2 Catalog boundary

Catalog remains the only Product authority. Recipe v1 consumes Product Contract
v2. Recipe must not query `catalog_*`, create a Product, republish a Product, or
treat a Product display name as identity.

For the smallest formal slice:

- one canonical Product ID binds to one Recipe Family in the global default
  scope;
- the Product binding is established when the Recipe Family is created and
  cannot be rebound in place;
- Recipe resolves and validates Product ID/Product Version ID through Product
  Contract v2 rather than treating caller values as authority;
- each publication requires a valid Product ID/Product Version ID pair;
- the Published Version pins both IDs permanently; and
- later Catalog changes do not rewrite Published Recipe history.

Domain, Application, and Persistence must all reject creation of a second
Recipe Family for the same canonical Product ID. One Recipe Family may have
many immutable revisions but at most one current Published Revision.
Application pre-check is advisory only. Persistence must enforce canonical
Product uniqueness in the same transaction that creates the Recipe Family,
first Draft, and creation audit. Concurrent creation attempts for one Product
produce exactly one committed winner; every loser returns
`RECIPE_FAMILY_ALREADY_EXISTS_FOR_PRODUCT` and leaves no empty Family, orphaned
Draft, duplicate Family, or partial audit.

Binding Catalog Draft Products before Product publication is deferred. Recipe v1
requires the server to resolve an eligible published Product Contract.

### 4.3 Canonical Ingredient and Measurement boundary

Each Recipe Line references canonical Ingredient ID. Display name copied into a
Published Version is historical presentation evidence, not Ingredient identity.

Recipe stores the operator's exact quantity and selected unit code. Measurement
Foundation and the active Ingredient Measurement Profile at publication time
must be able to normalize that quantity. Recipe must not guess conversions,
assume `1 ml = 1 g`, or store a second conversion table.

Publication should preflight `RecipeCanonicalProjectionV1` at the proposed
`publishedAt`. Missing, ambiguous, incompatible, or non-exact Measurement
evidence must fail publication with typed issues. The formal Projection pins
the Profile Version and conversion evidence used at that publication instant.

### 4.4 Cost boundary

Cost consumes only immutable Published or Superseded Recipe contracts. Cost:

- must not read Drafts;
- must not query `recipe_*` tables;
- must not rewrite Recipe quantities or select a Recipe Version implicitly;
- owns Quote selection, valuation, cost arithmetic, and Cost Evaluation; and
- must retain the exact Recipe Version reference in future Cost Snapshots.

Draft cost preview, if later approved, must call Cost through a separately
defined preview contract and must be labelled non-authoritative. It is outside
the first formal Draft/Publish implementation.

### 4.5 Kitchen and Production Planning boundary

Kitchen and Operations/Planning may consume only separately approved immutable
Published Recipe projections. They cannot read Draft internals or write Recipe.

Recipe-level formulation instructions may describe the stable formulation or
preparation intent. Kitchen owns operational progression, live task state,
timers, completion, device behavior, and production execution. Production
Planning owns planned quantities and batch operations. This Proposal does not
move those facts into Recipe.

### 4.6 Prohibited duplicate authorities

- No Cost-owned BOM or Ingredient quantities.
- No Catalog-owned Recipe content.
- No Kitchen-local Recipe state.
- No Product identity recreated by Recipe.
- No Recipe unit-conversion authority.
- No browser `localStorage` as formal Recipe persistence.
- No UI calculation presented as authoritative Recipe or Cost evidence.

## 5. Recipe Identity and Formal Data

### 5.1 Identity model

- `recipeId`: stable Recipe family identity across all revisions.
- `draftId`: identity of one editable working revision.
- `recipeVersionId`: immutable identity of one published revision.
- `versionNumber`: monotonic human-readable sequence scoped to `recipeId`.
- `aggregateVersion`: optimistic-concurrency token for current Recipe-family
  management state.
- `recipeLineId`: immutable stable identity of one Recipe Line across Draft
  edits and into its Published Revision.
- `linePosition`: zero-based display and formulation order only; it is not Line
  identity.

`recipeId`/`recipeFamilyId`, `draftId`, `recipeLineId`, and `recipeVersionId`
are server-authoritative identities generated by the Application boundary.
Callers cannot choose or overwrite a newly created authoritative identity.
Callers may reference an existing identity when editing, deleting, reordering,
validating, publishing, abandoning, or reading an existing resource.
Persistence enforces identity uniqueness; a collision fails safely without
overwriting any aggregate. A command idempotency key is replay evidence, not an
aggregate identity, and replay returns the identities from the original result.

Commands that target a Line use `recipeLineId` plus
`expectedAggregateVersion`. Ingredient ID cannot identify a Line because the
same Ingredient may appear on multiple ordered Lines. Reorder changes only
`linePosition`; changing Ingredient, quantity, unit, preparation note, or
position never replaces `recipeLineId` in place.

### 5.2 Draft data

A Draft management record should contain:

- `recipeId`, `draftId`, and `aggregateVersion`;
- name;
- immutable Recipe-Family canonical Product ID binding and proposed
  `productVersionId` for the next publication;
- ordered Ingredient Lines, each with stable `recipeLineId`;
- exact quantity coefficient, scale, raw unit code, and declared dimension;
- optional plain-text Line preparation note bound to `recipeLineId`;
- Standard Output;
- Standard Yield;
- optional plain-text Recipe-level instructions;
- source Published Version ID when created as a revision;
- created and last-updated actor/time evidence; and
- lifecycle state.

Draft data is editable authority, not historical cost or production evidence.

### 5.3 Published Version data

A Published Version freezes:

- all Recipe and Version identities;
- name;
- Product and Product Version IDs;
- ordered Recipe Lines with immutable `recipeLineId` and Ingredient
  presentation snapshots;
- exact raw quantities and units;
- optional plain-text Recipe instructions and Line preparation notes;
- Standard Output and Standard Yield;
- publication actor/time;
- source Draft identity;
- version number; and
- supersession evidence when later replaced.

Published content is append-only and cannot be updated in place. AI may propose
plain text, but no AI may write or alter formal Recipe data without explicit
human review and an authorized command. The `PublishedRecipeSnapshot` is the
immutable Recipe Version together with its
immutable Recipe Lines and publication evidence. It is not a second Recipe
authority and Recipe v1 does not require a separate snapshot table.

## 6. Lifecycle

### 6.1 Approved lifecycle for this proposal

```text
DRAFT
  -> PUBLISHED
  -> ABANDONED
PUBLISHED vN
  -> SUPERSEDED by PUBLISHED vN+1
```

`Published` and `Superseded` describe immutable Version history. One Recipe
family may have one editable Draft and multiple historical Published Versions,
but only one current Published Version for the global default scope.

`Retired` or `Archived` Recipe Family lifecycle is not necessary to complete
the Current Owner Goal and is deferred. It must not be improvised from Product
or Ingredient archive behavior.

### 6.2 Draft behavior

- An authorized Back Office operator may create a Draft.
- Drafts may be saved and repeatedly edited with expected-version protection.
- A Draft may be validated without publishing.
- An `ABANDONED` Draft is readable for audit but cannot be edited, validated as
  publishable, or published.
- Published Versions are never reopened for editing.
- Changes to a Published Version begin with a new Draft cloned from an explicit
  source `recipeVersionId`.
- A revision Draft retains the same canonical Product ID. It may propose a
  Product Version belonging to that Product, which the server validates and the
  next Published Revision pins.
- Creating a new Draft must not copy current Ingredient names or Measurement
  facts over the immutable source Version; copied editable facts begin a new
  working revision only.

### 6.3 Abandonment

`ABANDONED` is the terminal state for an unpublished Draft. Hard deletion of a
persisted Draft is prohibited.

- Only a `DRAFT` may transition to `ABANDONED`.
- A `PUBLISHED` or `SUPERSEDED` Version can never become `ABANDONED`.
- Abandon requires a formal command, authorization check, caller-provided actor,
  canonical time, reason, expected aggregate version, audit, and durable
  idempotency behavior.
- An identical retry returns the committed `ABANDONED` result. Reusing the key
  with different facts returns a typed idempotency conflict.
- Publish and abandon compete on the same aggregate version. At most one may
  succeed; the stale command returns a version conflict without partial writes.

Migration 016 and the current Domain state do not contain this lifecycle state.
A forward-only migration and aligned Domain/Application/Persistence changes are
therefore implementation prerequisites.

### 6.4 Current Published Version

- A Recipe family has at most one current Published Version in the global
  default scope.
- Publishing v1 sets it as current.
- Publishing vN+1 creates the new immutable Version, marks vN Superseded, and
  moves the current pointer in one transaction.
- Historical Versions remain queryable by `recipeVersionId`.
- Future store/channel/date scopes are deferred and must not be encoded as
  hidden fields in this first slice.

## 7. Publication Validation

Publication must fail closed unless all requirements pass:

1. Draft exists and is still `Draft`.
2. Caller supplies the current `expectedAggregateVersion`.
3. Recipe name is non-empty.
4. The Recipe Family is the sole Family bound to its canonical Product ID.
5. Product ID and Product Version ID resolve to one valid Product Contract and
   match the immutable Recipe-Family binding.
6. At least one Ingredient Line exists.
7. Every Ingredient ID resolves and is Active for new publication.
8. Every quantity is positive, exact, and within approved scale limits.
9. Every unit resolves through Measurement authority.
10. Every Ingredient Line normalizes exactly through the effective Profile.
11. Every Line has stable unique `recipeLineId`; repeated Ingredient IDs remain
    ordered and legal after the existing drift is corrected.
12. Standard Output is positive and exactly normalizable.
13. Standard Yield is positive and count-dimensional under the current model.
14. Version number is monotonic.
15. Publication actor comes from trusted authenticated context and canonical UTC
    timestamp comes from the Application clock; neither comes from request-body
    claims.
16. Optional plain-text instructions and preparation notes satisfy approved
    text limits and remain operator-authored authority.
17. The durable idempotency key and normalized request evidence are valid.

Validation issues return a stable ordered collection. Missing data must never
be converted to zero, guessed, or silently omitted.

## 8. Proposed Application Boundary

### 8.1 Commands

```ts
type VerifiedActorRef = Readonly<{
  actorId: string;
  authenticationAuthority: string;
}>;

type CreateRecipeDraftCommandV1 = Readonly<{
  commandId: string;
  idempotencyKey: string;
  name: string;
  productId: string;
  productVersionId: string;
  actor: VerifiedActorRef;
  occurredAt: string;
}>;

type AddRecipeIngredientLineCommandV1 = Readonly<{
  commandId: string;
  idempotencyKey: string;
  recipeId: string;
  draftId: string;
  position: number;
  ingredientId: string;
  quantity: Readonly<{ coefficient: string; scale: number }>;
  unitCode: string;
  dimension: "mass" | "volume" | "count";
  preparationNote?: string;
  expectedAggregateVersion: number;
  actor: VerifiedActorRef;
  occurredAt: string;
}>;

type UpdateRecipeIngredientLineCommandV1 = Readonly<{
  commandId: string;
  recipeId: string;
  draftId: string;
  recipeLineId: string;
  position: number;
  ingredientId: string;
  quantity: Readonly<{ coefficient: string; scale: number }>;
  unitCode: string;
  dimension: "mass" | "volume" | "count";
  preparationNote?: string;
  expectedAggregateVersion: number;
  actor: VerifiedActorRef;
  occurredAt: string;
}>;

type RemoveRecipeIngredientLineCommandV1 = Readonly<{
  commandId: string;
  recipeId: string;
  draftId: string;
  recipeLineId: string;
  expectedAggregateVersion: number;
  actor: VerifiedActorRef;
  occurredAt: string;
}>;

type ReorderRecipeIngredientLineCommandV1 = Readonly<{
  commandId: string;
  recipeId: string;
  draftId: string;
  recipeLineId: string;
  newPosition: number;
  expectedAggregateVersion: number;
  actor: VerifiedActorRef;
  occurredAt: string;
}>;
```

Update name, update Standard Output/Yield, update optional plain-text Recipe
instructions, update preparation notes, validate, and create-revision-Draft
commands use the same explicit identity, actor/time, command ID, and expected
aggregate-version principles. Line commands always target `recipeLineId`;
`linePosition` and Ingredient ID are never command identity.

These command types describe post-authentication Application input. The HTTP
request cannot provide the authoritative `VerifiedActorRef`; the API adapter
derives it from trusted authenticated context. Client-supplied actor ID, name,
or role is rejected by the request contract and can never become verified Audit
identity. The Application clock supplies canonical
`occurredAt`. AI-originated input remains untrusted content and cannot bypass
human approval or command authorization.

```ts
type AbandonRecipeDraftCommandV1 = Readonly<{
  commandId: string;
  idempotencyKey: string;
  recipeId: string;
  draftId: string;
  expectedAggregateVersion: number;
  actor: VerifiedActorRef;
  occurredAt: string;
  reason: string;
}>;
```

```ts
type PublishRecipeCommandV1 = Readonly<{
  commandId: string;
  idempotencyKey: string;
  recipeId: string;
  draftId: string;
  expectedAggregateVersion: number;
  expectedCurrentRecipeVersionId: string | null;
  publishedBy: VerifiedActorRef;
  publishedAt: string;
  reason: string;
}>;
```

The Application boundary generates `recipeId`/`recipeFamilyId` and `draftId`
for Create, `recipeLineId` for Add Line, `recipeVersionId` for Publish, and a new
`draftId` for create-revision-Draft. Request DTOs do not accept these new
identities. Identity-producing commands require a caller idempotency key and
durable replay returns the originally generated identities. Responses return
the generated identities. Existing-resource
commands accept only the existing identity they target. Identity collisions
return a typed persistence failure and never overwrite data. Infrastructure
must not accept client-supplied actor identity or silently invent missing audit
evidence.

### 8.2 Application Service responsibilities

- authorize every Create, Edit, Validate, Publish, and Abandon command from a
  trusted authenticated context before Domain mutation;
- parse and validate command DTOs;
- load authority-owned contracts through Ports;
- verify Product and Ingredient references, including Product-family uniqueness
  and immutable Product binding;
- invoke Aggregate behavior instead of editing rows;
- perform canonical publication preflight through approved contracts;
- enforce expected aggregate/current-Version evidence;
- map concurrent Product-family creation to one typed loser result rather than
  relying on a pre-check;
- execute one publication Unit of Work;
- return stable typed outcomes and immutable management contracts; and
- emit or return Domain Events only after the write commits.

### 8.3 Domain responsibilities

- Draft and Version lifecycle invariants;
- exact Recipe quantity invariants;
- stable `recipeLineId`, repeated-Ingredient, and ordered Line behavior;
- one Product/one Recipe Family and immutable Family binding;
- terminal Draft abandonment;
- optional plain-text Recipe instructions and preparation-note invariants;
- immutability after publication;
- monotonic Version transitions;
- publication and supersession facts; and
- prohibiting direct mutation of Published Versions.

### 8.4 Repository and Unit-of-Work responsibilities

- append-first persistence;
- optimistic concurrency;
- authoritative identity and canonical Product/Recipe-Family uniqueness
  constraints;
- atomic Recipe-Family, first-Draft, and creation-audit persistence;
- one transaction for publication, supersession, audit, current pointer, and
  durable idempotency receipt;
- immutable history verification;
- deterministic management reads; and
- technical error mapping without becoming a second lifecycle authority.

### 8.5 Audit evidence

Draft creation, mutation, abandonment, publication, and supersession retain
append-only actor, canonical occurred-at time, reason where applicable, target
identity, prior aggregate version, and resulting aggregate version. Line audit
targets stable `recipeLineId`. Verified actor comes only from authenticated
context, canonical time comes from the Application clock, and required reason
comes from validated command input. Infrastructure must not substitute
client-reported identity or fabricate missing evidence.

Authorization denial occurs before mutation. It creates no Recipe mutation,
Version, receipt, pointer, supersession, or successful Domain Audit. A security
layer may record separate denial evidence, but that evidence must be labelled as
denied security activity and never as a successful Recipe command.

## 9. Publication Transaction and Concurrency

### 9.1 Transaction boundary

One SQLite `IMMEDIATE` transaction must:

1. load current Recipe family and Draft;
2. verify `expectedAggregateVersion` and expected current Version;
3. read the Product and Ingredient/Measurement contracts required to validate
   the proposed publication from one consistent database state;
4. validate the complete Draft and canonical projection;
5. insert the immutable Recipe Version and Lines;
6. append publication audit;
7. mark the previous current Version Superseded and append its supersession
   audit when applicable;
8. update the Recipe-family current pointers and aggregate version;
9. persist the durable idempotency receipt containing command scope,
   idempotency key, normalized request identity, and formal publication result;
   and
10. commit before returning the Published result/event.

Any failure rolls back all ten effects. No state may contain a new Version
without its audit, a superseded old Version without a replacement, or a moved
current pointer without immutable Version rows. A receipt can never commit
without the complete publication result, and publication can never commit
without its receipt.

### 9.2 Optimistic concurrency

- Every mutation after Draft creation requires `expectedAggregateVersion`.
- Publish additionally requires `expectedCurrentRecipeVersionId`.
- Two devices publishing from the same Draft can produce at most one new
  current Version.
- A stale Draft receives `409 RECIPE_VERSION_CONFLICT` and remains unchanged.
- No automatic merge or last-write-wins behavior is allowed.
- Concurrent Recipe-Family creation for one canonical Product is protected by
  a persistence uniqueness constraint and transaction, not only an Application
  pre-check. One request wins; losers receive
  `RECIPE_FAMILY_ALREADY_EXISTS_FOR_PRODUCT` with no orphaned data.
- Concurrent Publish and Abandon serialize on the same aggregate version and
  produce at most one terminal transition.
- Concurrent requests sharing an idempotency key follow the durable receipt
  arbitration rules below.

### 9.3 Idempotency

Every Publish command requires a caller-provided idempotency key scoped to the
Publish command and persisted as a durable receipt.

Create Family/Draft, Add Line, and create-revision-Draft also return
server-generated identities and therefore require command-scoped durable replay
evidence. Their retries return the original identities rather than generating a
second aggregate, Draft, Line, or revision Draft. Publication additionally
requires the full atomic receipt behavior below.

- The receipt binds command scope, idempotency key, normalized request identity,
  and the formal publication result.
- Same key plus identical normalized request identity returns the committed
  result without another Version, audit, or event.
- Same key plus different facts returns a typed idempotency conflict.
- If same-key/same-request calls arrive concurrently, the receipt uniqueness
  constraint and SQLite `IMMEDIATE` transaction permit one publication winner.
  Other callers observe and return the winner's exact formal result and
  identities without creating another Version, Lines, audit, or receipt.
- If same-key/different-request calls arrive concurrently, at most one request
  may commit; every conflicting request returns
  `RECIPE_IDEMPOTENCY_CONFLICT`. Generic success is prohibited.
- A retry after an unknown transport result can discover the committed result.
- The behavior survives process restart; memory-only deduplication and random
  identity generation are not sufficient replay protection.
- The receipt, Published Version/Lines, supersession, current pointer, and audit
  are written in the same SQLite `IMMEDIATE` transaction.
- Any failure rolls back the receipt and all publication state together.

The exact receipt schema requires a separate Schema authorization, but durable
receipt persistence is not optional.

### 9.4 Abandon transaction

Abandon loads the Draft, verifies `expectedAggregateVersion`, verifies that the
Draft is still editable, writes terminal `ABANDONED` state, append-only audit, and
its idempotency receipt in one SQLite `IMMEDIATE` transaction. Publish and
abandon therefore serialize on the same aggregate. Any failure rolls back all
abandon state and evidence.

### 9.5 Recipe Family creation transaction

Family creation resolves the Product Contract, authorizes the command, and in
one SQLite `IMMEDIATE` transaction inserts the unique canonical Product/Family
binding, server-generated Recipe Family, first Draft, creation audit, and
durable identity-result receipt. A persistence uniqueness constraint, not only
an Application pre-check, arbitrates concurrent requests. Exactly one request
commits. Losers return `RECIPE_FAMILY_ALREADY_EXISTS_FOR_PRODUCT`; rollback
leaves no empty Family, orphan Draft, partial audit, or receipt.

## 10. Typed Failure Model

Minimum stable outcomes:

| Failure | Meaning | Proposed HTTP |
| --- | --- | ---: |
| `RECIPE_FORBIDDEN` | Trusted authenticated actor is not authorized for the command | 403 |
| `RECIPE_NOT_FOUND` | Recipe identity is absent | 404 |
| `RECIPE_DRAFT_NOT_FOUND` | Draft identity is absent or belongs elsewhere | 404 |
| `RECIPE_FAMILY_ALREADY_EXISTS_FOR_PRODUCT` | Canonical Product already owns a Recipe Family | 409 |
| `RECIPE_PRODUCT_BINDING_CONFLICT` | Request conflicts with immutable Family Product binding | 409 |
| `PRODUCT_REFERENCE_INVALID` | Product Contract pair is absent/mismatched | 422 |
| `INGREDIENT_REFERENCE_INVALID` | Ingredient is absent or not selectable | 422 |
| `RECIPE_VALIDATION_FAILED` | Draft has one or more ordered issues | 422 |
| `RECIPE_MEASUREMENT_UNAVAILABLE` | Unit/Profile normalization cannot prove the Recipe | 422 |
| `RECIPE_VERSION_CONFLICT` | Aggregate/current-Version evidence is stale | 409 |
| `RECIPE_ALREADY_PUBLISHED` | Draft is no longer publishable | 409 |
| `RECIPE_DRAFT_ABANDONED` | Draft is terminal and cannot be edited, validated, or published | 409 |
| `RECIPE_ALREADY_ABANDONED` | A new abandon command targets a terminal Draft | 409 |
| `RECIPE_IDEMPOTENCY_CONFLICT` | Idempotency key was reused with different facts | 409 |
| `RECIPE_INVALID_TRANSITION` | Lifecycle transition is not approved | 409 |
| `RECIPE_IDENTITY_COLLISION` | Server-generated identity already exists; nothing was overwritten | 500 |
| `RECIPE_PERSISTENCE_FAILURE` | Atomic persistence failed | 500 |

Responses must not leak SQLite messages, stack traces, or raw internal objects.

## 11. Proposed Read Contracts

### 11.1 Recipe management read contract

Back Office needs one versioned Recipe-owned management boundary containing:

- Recipe family identity and aggregate version;
- current Draft summary, if present;
- current Published Version summary, if present;
- historical Version summaries;
- editable Draft detail with ordered Lines;
- immutable Published detail by Version ID;
- optional plain-text Recipe instructions and preparation notes keyed by
  `recipeLineId`; and
- lifecycle/audit evidence required for management presentation.

Management reads may include Drafts. They are not consumer contracts for Cost,
Kitchen, or Planning.

### 11.2 Published Recipe boundary

The existing immutable `PublishedRecipeSnapshot`, formed by the immutable
Recipe Version and its immutable Recipe Lines rather than a separate authority,
`RecipeCanonicalProjectionV1`, and `RecipeCostingContractV2` remain the formal
Cost path. Cost must request an explicit Recipe Version and never read Draft.

The minimum versioned Published Recipe read contract exposes only immutable
`PUBLISHED` or `SUPERSEDED` revisions and includes:

- identity: `recipeFamilyId`/`recipeId`, `recipeVersionId`, revision/version
  evidence, lifecycle state, and aggregate-version or equivalent trace evidence;
- locked Product reference: canonical `productId` and `productVersionId`;
- output: Standard Output quantity/unit and Standard Yield/serving definition;
- content: optional plain-text Recipe instructions and ordered Recipe Lines;
- each Line: `recipeLineId`, canonical `ingredientId`, locked Ingredient
  reference/version evidence available from the approved Ingredient Contract,
  exact quantity, unit, `linePosition`, and optional preparation note; and
- publication evidence: `publishedAt`, verified `publishedBy` actor reference,
  optional `supersededAt`, optional `supersededByRecipeVersionId`, and explicit
  current/supersession evidence.

Drafts are never exposed by this contract. Missing fields cannot be guessed or
reconstructed by Cost, Kitchen, Planning, or UI. This contract definition does
not authorize Ingredient 003 or any Cost/Kitchen/Planning implementation.

A general Published Recipe management response may expose human-readable
details, but it must not replace the approved Costing Contract.

### 11.3 Consumer matrix

| Consumer | May read | Must not read/write |
| --- | --- | --- |
| Cost | Explicit Published/Superseded `RecipeCostingContractV2` | Drafts, Recipe repository, Recipe tables |
| Admin Recipe UI | Management Draft and Published-history contracts | SQLite, Domain internals |
| Production Planning | Future approved scaling/planning projection | Drafts, Cost evidence, Recipe writes |
| Kitchen | Future approved preparation projection | Drafts, Cost evidence, Recipe writes |

Kitchen and Planning contracts are deferred. Their absence must not cause the
first Recipe management implementation to invent or pre-wire them.

## 12. Proposed API Direction

Routes are proposals only:

- `POST /api/admin/recipes/drafts`
- `GET /api/admin/recipes`
- `GET /api/admin/recipes/:recipeId`
- `GET /api/admin/recipes/:recipeId/drafts/:draftId`
- `PATCH /api/admin/recipes/:recipeId/drafts/:draftId`
- `POST /api/admin/recipes/:recipeId/drafts/:draftId/lines`
- `PATCH /api/admin/recipes/:recipeId/drafts/:draftId/lines/:recipeLineId`
- `DELETE /api/admin/recipes/:recipeId/drafts/:draftId/lines/:recipeLineId`
- `POST /api/admin/recipes/:recipeId/drafts/:draftId/lines/:recipeLineId/reorder`
- `POST /api/admin/recipes/:recipeId/drafts/:draftId/validate`
- `POST /api/admin/recipes/:recipeId/drafts/:draftId/publish`
- `POST /api/admin/recipes/:recipeId/drafts/:draftId/abandon`
- `POST /api/admin/recipes/:recipeId/versions/:recipeVersionId/drafts`
- `GET /api/admin/recipes/:recipeId/versions/:recipeVersionId`

The final API may consolidate Draft field updates, but it must preserve typed
commands, expected versions, stable errors, and atomic publication. Route
handlers must not calculate, mutate rows, or compose cross-domain internals.
Create must resolve Product Contract and reject a second Recipe Family for the
same canonical Product. Line mutation routes target `recipeLineId`. Publish and
abandon require explicit idempotency keys and map typed lifecycle, concurrency,
and idempotency outcomes without guessing caller evidence.

Create request DTOs omit `recipeFamilyId`/`recipeId` and `draftId`; Add Line
omits `recipeLineId`; Publish omits `recipeVersionId`. Successful responses
return server-generated identities. Existing-resource routes accept existing
identities only as targets. Caller-supplied authoritative creation IDs are
rejected as invalid request fields rather than ignored ambiguously.

All management routes obtain `VerifiedActorRef` from authenticated server
context. Request-body actor claims are not trusted. Authorization failure maps
to `403 RECIPE_FORBIDDEN`; version, uniqueness, lifecycle, and idempotency
conflicts map to their typed outcomes and never render generic success. The
Published-Version GET response implements the complete immutable contract in
Section 11.2, including Product, output/yield, Lines, instructions, and
publication/supersession evidence.

The existing `/api/admin/cost/recipes` create-and-publish route should be
deprecated only after the formal workflow is available and compatibility is
reviewed. This Proposal does not remove it.

## 13. Schema and Migration Direction

Migration 016 is immutable and must not be edited.

A forward-only Recipe migration is expected to address only approved gaps:

- add stable immutable `recipeLineId` to Draft and Published Lines while
  retaining mutable ordered positions;
- permit repeated Ingredient Lines by removing Ingredient uniqueness;
- add optional plain-text Recipe instructions and Line preparation notes;
- add terminal Draft abandonment state and append-only abandonment evidence;
- add durable idempotency receipts with command scope, key, normalized request
  identity, and committed result;
- enforce one Recipe Family per canonical Product ID and one current Published
  Revision per Recipe Family; and
- enforce receipt uniqueness by command scope and idempotency key, and
  server-generated identity uniqueness without overwrite; and
- add only indexes and constraints justified by approved read/write contracts.

Migration 016 remains immutable. The forward-only correction is an
implementation prerequisite: Aggregate, Persistence, Application validation,
and tests must converge on repeated Ingredient Lines and stable `recipeLineId`.
Removing only the SQL constraint while retaining a Domain prohibition, or
changing only Domain behavior while retaining the SQL prohibition, is invalid.

Product and Ingredient database foreign keys are an implementation-level schema
choice, not an Open Owner Decision. Whether a database FK is used does not alter
Domain ownership and never replaces Product/Ingredient Contract validation.
Omitting a database FK likewise never permits reference validation to be
removed. Recipe must not query Catalog or Ingredient internal tables for
business validation.

No migration is authorized by this Proposal.

## 14. Proposed UI Scope

Recommended location: a dedicated Back Office Recipe management workspace,
separate from Cost calculations while linked from Back Office navigation.

Minimum workflow:

1. Recipe list: Draft/current Published/history summary per Recipe family.
2. Create Draft: choose a canonical Product that does not already own a Recipe
   Family, then create the Family-bound Draft.
3. Draft editor: immutable Product binding, ordered Ingredient Lines identified
   by stable `recipeLineId`, exact quantity/unit, Standard Output/Yield,
   optional plain-text Recipe instructions and Line preparation notes, save
   status, and aggregate version.
4. Validate: display exact ordered blocking issues without publishing.
5. Publish confirmation: Version, Product, yield, Line count, actor/time/reason,
   and replacement effect.
6. Published detail: immutable, explicit Version ID, publication evidence, and
   action to create a new Draft.
7. Conflict recovery: preserve unsent user input, show central latest version,
   and require explicit reload/reapply. Never auto-overwrite.
8. Abandon Draft: require reason and confirmation, then show immutable terminal
   status; the Draft can no longer be edited, validated, or published.

Required UI states: Loading, Empty, Ready, Validation Error, API Error,
Forbidden, Offline, and Version Conflict. Failed or forbidden commands must
never show success. The UI displays server authorization outcomes and never
infers or grants permission locally.

The browser may retain unsent form state for recovery only. Formal Draft and
Published facts always come from central API/SQLite.

## 15. Acceptance Criteria and Test Matrix

| Area | Required proof |
| --- | --- |
| Draft create | Server generates unique Family/Draft identities, resolves Product Contract, and creates one Product-bound Family/Draft with audit evidence |
| Identity authority | Caller-supplied creation IDs are rejected; generated IDs are unique and collision never overwrites data |
| Identity replay | Durable retry returns the original Family, Draft, Line, and Version identities |
| Product uniqueness | A canonical Product cannot own a second Recipe Family |
| Concurrent Family create | Independent SQLite connections produce one winner, typed losers, and no orphan Family/Draft/audit |
| Product binding | Family Product binding cannot be changed in place |
| Product | Invalid or mismatched Product Contract is rejected |
| Ingredient | Invalid or Archived Ingredient is rejected for new publication |
| Draft edit | Name, Lines, yield, instructions, and notes persist across restart while Product binding remains unchanged |
| Lines | Add creates stable `recipeLineId`; update/remove/reorder target it with expected version |
| Line create identity | Caller cannot supply `recipeLineId`; Add returns one server-generated stable ID |
| Line identity | Position, Ingredient, quantity, unit, and note changes never replace `recipeLineId` |
| Repeated Ingredient | Same Ingredient may appear on multiple ordered Lines with distinct IDs |
| Quantity | Zero/negative/invalid scale is rejected |
| Measurement | Unknown, ambiguous, missing Profile, incompatible dimension, and non-exact normalization fail closed |
| Empty Recipe | Cannot publish |
| Draft visibility | Draft is readable by management API only |
| Draft isolation | Cost, Kitchen, and Planning cannot consume Draft |
| Instructions | Optional plain-text Recipe instructions and preparation notes persist and publish immutably |
| Abandon | Draft becomes terminal with actor/time/reason audit and cannot be edited, validated, or published |
| Abandon retry | Identical retry is idempotent; conflicting reuse or stale concurrency is rejected |
| Publish/abandon race | Same Draft produces at most one successful terminal transition |
| Publish | Creates one immutable Version with complete evidence |
| Immutability | Published Version cannot be edited in place |
| Revision | New Draft does not overwrite source Version |
| Current Version | One Recipe family has one current Published Version |
| Supersession | Replacement publish and old-Version supersession are atomic |
| Idempotency | Durable receipt survives restart; identical retry returns one result and changed retry conflicts |
| Concurrent same-key replay | Same request produces one Version/Lines/result/receipt and every caller receives that result |
| Concurrent key mismatch | Different normalized requests sharing a key produce one winner and typed conflicts |
| Concurrency | Two devices publishing the same Draft produce one success |
| Stale Draft | Stale expected version conflicts without partial writes |
| Rollback | Injected transaction failure leaves no Version/audit/pointer/receipt fragment |
| Receipt rollback | Failed publication leaves no durable receipt and retry can proceed safely |
| Authorization | Unauthorized Create/Edit/Validate/Publish/Abandon return `RECIPE_FORBIDDEN` before mutation |
| Actor trust | Spoofed client actor is rejected and never becomes verified Audit identity |
| Denial isolation | Denied commands leave aggregate, Version, receipt, pointer, supersession, and successful Audit unchanged |
| Read Contract | Published/Superseded responses contain every Section 11.2 identity, Product, output, Line, note, and publication field |
| Historical read | Published and Superseded revisions remain independently queryable and Draft remains isolated |
| Cost history | Future Snapshot pins original Recipe Version and never drifts |
| Audit | Draft creation/mutation, Line identity, abandonment, publication, and supersession evidence is complete |
| Restart | Draft, `ABANDONED`/Published state, and durable idempotency result survive Node restart |
| UI states | Loading/Empty/Error/Forbidden/Offline/Conflict are truthful |
| Architecture | No cross-domain table/internal access or browser authority |
| Regression | Typecheck, lint, Recipe/Cost suites, Architecture Guard, migration smoke, API integration, and E2E pass |

Subrecipe, Kitchen, Planning, Cost Snapshot persistence, and AI tests remain
deferred because those capabilities are outside Recipe v1.

SQLite concurrency integration tests use independent connections and real
overlap rather than sequential calls. They must cover concurrent Family
creation, same-key/same-request publication, same-key/different-request
publication, two-device publish, and Publish/Abandon competition. Assertions
include the single winner, exact typed loser/replay result, durable restart
behavior, and absence of orphaned or partial rows.

## 16. Proposed PR Decomposition

Each PR below directly supports the Current Owner Goal and requires separate
Owner authorization. The names are planning labels, not authorized branches.

### PR-RECIPE-MANAGEMENT-001A - Domain correction and Draft commands

Direct relationship: makes Recipe Drafts repeatedly editable and aligns ordered
Line behavior with accepted repeated-Ingredient governance.

Scope direction:

- Aggregate Line update/remove/reorder behavior;
- stable immutable `recipeLineId` and repeated Ingredient behavior;
- server-authoritative Recipe identity types and no-overwrite invariants;
- terminal `ABANDONED` Draft lifecycle and audit facts;
- one Product/one Recipe Family invariants;
- optional plain-text Recipe instructions and Line preparation notes;
- immutable Published Revision rules;
- typed Draft command failures;
- pure Domain/Application tests; and
- no Runtime/API/UI.

The 001A Domain correction and 001B forward-only persistence correction must be
reviewed as coordinated prerequisites. Migration 016 itself remains immutable.

### PR-RECIPE-MANAGEMENT-001B - Forward-only persistence and Unit of Work

Direct relationship: persists repeated Draft edits and makes replacement
publication/supersession atomic and concurrency-safe.

Scope direction:

- one authorized forward migration;
- Migration 016 forward correction for stable Line IDs, repeated Ingredients,
  abandonment, Product-family uniqueness, and notes;
- repository/mapper, authoritative-identity uniqueness, canonical Product/Family
  uniqueness, and current-Version persistence constraints;
- durable idempotency receipt persistence;
- concurrent same-key receipt arbitration and concurrent Family creation using
  independent SQLite connections;
- publication Unit of Work;
- current pointer and supersession persistence; and
- SQLite concurrency/rollback/restart/upgrade tests.

### PR-RECIPE-MANAGEMENT-001C - Recipe management Application contracts

Direct relationship: exposes formal Create/Edit/Validate/Publish use cases and
versioned management reads without leaking Repository or Domain internals.

Scope direction:

- commands, DTOs, management contracts, typed outcomes;
- Product/Ingredient/Measurement read Ports;
- Product Contract verification and Product-family uniqueness coordination;
- server-side identity generation and original-identity idempotent replay;
- authorization from trusted actor context before every management command;
- stable-Line, abandon, publish, concurrency, idempotency, and Audit
  orchestration;
- Application-level concurrent Family creation and idempotent replay/conflict
  tests over the persistence Port;
- complete Published/Superseded read-contract DTOs and contract tests;
- application tests; and
- no HTTP or UI.

### PR-RECIPE-MANAGEMENT-001D - API and Runtime composition

Direct relationship: makes the formal management boundary usable by Back
Office while preserving central SQLite authority.

Scope direction:

- routes and server composition;
- command and management-read endpoints;
- request DTO rejection of caller-supplied creation identities and response DTOs
  carrying server-generated identities;
- authenticated actor context and `403 RECIPE_FORBIDDEN` mapping;
- expected-version and idempotency-key transport;
- typed conflict and lifecycle error mapping;
- Published/Superseded API response contract tests;
- API integration tests; and
- compatibility handling for the old Cost create-and-publish route.

### PR-RECIPE-MANAGEMENT-001E - Back Office Recipe UI

Direct relationship: lets the Owner repeatedly create, edit, validate, publish,
and revise formal Recipes through the approved API.

Scope direction:

- management workspace;
- stable Line operations and optional instructions/note editing;
- abandon action with reason and terminal-state presentation;
- full UI states and conflict handling;
- truthful Forbidden state without client-side permission inference;
- desktop/mobile Playwright; and
- no Cost/Kitchen/Planning integration.

### Deferred consumer PRs

- Cost integration beyond existing `RecipeCostingContractV2`.
- Production Planning projection and integration.
- Kitchen preparation projection and integration.
- Cost Snapshot persistence and Recipe Version pinning.

These are not required to complete the formal Recipe management workflow and
must not displace the Current Owner Goal.

## 17. Deferred Findings

- General half-product/subrecipe composition, recursive BOM, semi-finished
  dependencies, graph expansion, and cycle detection.
- Product Draft binding before Catalog publication.
- Recipe Family retirement/archive and restoration policy.
- Store/channel/specification/effective-date Recipe scopes.
- Multiple concurrent Drafts for one Recipe family.
- Draft cost preview and incomplete-cost presentation.
- Package specification, density, variable weight, yield loss, and waste.
- SOP execution, equipment, timers, Kitchen Copilot, and production tasks.
- Full authentication, account management, and RBAC design beyond the trusted
  Recipe command context required by this Proposal.
- Cost Snapshot persistence and historical reporting.
- Recipe search, pagination, tags, and categories.
- PR-INGREDIENT-003 lifecycle management implementation.

These findings are recorded only. They are not automatically the next PR.

## 18. Known Limitations

- Current baseline actor metadata is caller-reported. The formal workflow cannot
  reuse it as verified identity: 001C/001D must obtain a trusted authenticated
  actor context, while full authentication/RBAC architecture remains outside
  this Proposal. UI and audit wording must never elevate client claims.
- Current formal Recipe publication is Product-bound. Standalone half-products
  are not represented by the existing Published snapshot or Costing Contract.
- Current schema and Aggregate reject repeated Ingredient Lines despite later
  accepted contract governance.
- Current Published projection is created on demand from immutable Recipe facts
  and historical Profile evidence; no separate projection table exists.
- Domain Events are returned in-process. Durable outbox/broker delivery is not
  authorized.
- Cost Evaluation is ephemeral and is not a Cost Snapshot.
- Kitchen and Planning have no approved Recipe consumer implementation here.

## 19. Open Owner Decisions

Open Owner Decisions: **NONE**.

The Owner has frozen stable `recipeLineId`, repeated Ingredient Lines,
`ABANDONED` Draft lifecycle, one Product/one Recipe Family, durable idempotency
receipts, optional plain-text instructions/preparation notes, atomic
publish-and-supersede, and deferred subrecipe scope for this Proposal.

This closure makes the Proposal reviewable. It does not authorize Architecture,
Schema, Migration, API, UI, Runtime, tests, or implementation. Every 001A-001E
slice still requires its own Owner Work Order and exact Git gate.

## 20. Proposal Gate Summary

- Architecture accepted by this document: **NO**
- Governance changed: **NO**
- Schema or Migration approved: **NO**
- API approved: **NO**
- UI approved: **NO**
- Implementation authorized: **NO**
- Ingredient 003 authorized: **NO**
- Cost/Kitchen/Planning integration authorized: **NO**
- Current Owner Goal retained: **YES**
