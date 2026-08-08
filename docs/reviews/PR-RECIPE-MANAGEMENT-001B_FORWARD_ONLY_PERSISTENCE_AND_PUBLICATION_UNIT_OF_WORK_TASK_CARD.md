# PR-RECIPE-MANAGEMENT-001B: Forward-only Persistence and Publication Unit of Work

> **TASK CARD DRAFT ONLY - IMPLEMENTATION NOT AUTHORIZED**

Status: Owner review draft

Current Owner Goal: Formal Recipe Draft Creation and Publication

Authoritative proposal:
`docs/reviews/PR-RECIPE-MANAGEMENT-001_FORMAL_RECIPE_DRAFT_CREATION_AND_PUBLICATION_PROPOSAL.md`

Dependency: PR-RECIPE-MANAGEMENT-001A complete

Baseline branch: `integration/architecture-development`

Baseline SHA: `7c6d4704f365ec5a79719321c170b8ca6a6cfff3`

Follow-up dependency: PR-RECIPE-MANAGEMENT-001C Application Publication
Orchestration

This Task Card defines a candidate implementation boundary for
PR-RECIPE-MANAGEMENT-001B only. It does not authorize implementation, branch
creation, file modification outside this Task Card, staging, commit, push,
Pull Request creation, or work on PR-RECIPE-MANAGEMENT-001C through 001E.

## 1. Objective

Introduce one forward-only Recipe persistence migration and a persistence-level
Unit of Work so the Recipe state accepted in 001A can be stored, read, upgraded,
retried, and published atomically in SQLite.

This slice is directly required by the Current Owner Goal because Migration 016
rejects repeated Ingredient Lines, does not persist stable `recipeLineId`, Line
preparation notes, Recipe instructions, Recipe Family identity, terminal
`Abandoned` state, abandonment evidence, or durable command receipts. The
existing mapper also derives legacy Line identity from `ingredientId`, which
cannot represent two Lines that reference the same Ingredient.

001B supplies persistence capability for later use by 001C. It does not decide
when a command is authorized or invoked and does not implement an Application
publication workflow.

## 2. Migration Strategy

### 2.1 Migration identity and immutability

- Migration 016 is immutable and must not be edited, renamed, copied, or
  repurposed.
- Its review-time SHA-256 is
  `C5CC28AF0211142BC1F2D78D2B1373E0A849CF1868DF14219A86BA7B1FE4F427`.
- The next available migration number at the accepted baseline is `017`.
- The only authorized new migration path for a later implementation is:
  `migrations/017_recipe_persistence_line_identity_and_publication_uow.sql`.
- Migration 017 must be forward-only and execute through the repository's
  existing migration transaction mechanism.
- SQLite does not provide a built-in UUIDv5 function. The exact planned data
  hook `src/shared/database/migration-data/017-recipe-line-identity-backfill.ts`
  computes and validates the frozen UUIDv5 mapping. `migrate.ts` may dispatch
  this one hook only for migration ID 017, after 017 has created staging tables
  and before its final table swap/verification. SQL, hook, final verification,
  and `schema_migrations` insert remain inside the same migration transaction.
- The hook receives only the active transaction-bound `DatabaseAdapter`; it
  opens no connection, starts no transaction, commits nothing, and writes only
  Migration 017 staging/mapping rows. Every accepted mapping is revalidated by
  the SQL constraints during final copy.
- A clean database and a populated database already at Migration 016 must both
  reach the same final schema.

### 2.2 Non-destructive SQLite table correction

SQLite constraint changes may require transactional replacement tables. That
mechanism is permitted only when Migration 017:

1. creates explicitly named replacement tables with the approved schema;
2. validates all legacy rows before destructive table replacement;
3. copies every accepted row and verifies row counts and required relationships;
4. fails and rolls back the whole migration when validation or copying fails;
5. swaps tables only inside the migration transaction;
6. recreates only approved indexes, foreign keys, and constraints;
7. leaves no temporary table after success or rollback; and
8. preserves all historical Draft, Version, Line, publish-audit, and
   supersession-audit facts.

Deleting legacy rows, clearing tables, accepting a partial copy, or rebuilding
an empty Recipe schema is prohibited. Migration 017 must not use
`INSERT OR IGNORE`, lossy fallback values, or last-write-wins behavior to hide
invalid legacy data.

### 2.3 Required schema capabilities

Migration 017 must support:

- durable `recipe_family_id` and canonical Product/Family binding;
- terminal `Abandoned` Recipe and Draft state;
- optional Recipe instructions;
- stable immutable `recipe_line_id` on Draft and Version Lines;
- optional Line preparation notes;
- repeated `ingredient_id` Lines;
- append-only abandonment evidence;
- durable command idempotency receipts;
- immutable publication and Version Lines;
- current-Version pointer and supersession consistency; and
- only indexes and constraints justified by the accepted write and read
  contracts.

### 2.4 Upgrade, failure, restart, rerun, and rollback

- Migration 017 runs once after Migration 016 and is recorded only after every
  schema and data operation succeeds.
- A failure at validation, copy, constraint creation, index creation, or final
  verification rolls back the entire migration and does not record 017.
- Restart after a successful upgrade must preserve every upgraded identity and
  historical fact.
- Rerunning the migration runner after success applies zero migrations and does
  not recalculate or rewrite Line IDs.
- Rerunning after a rolled-back failure must produce the same deterministic
  candidate identities from the unchanged Migration 016 data.
- Foreign-key checks, SQLite integrity checks, expected row counts, and the
  absence of temporary replacement tables are required after upgrade and after
  restart.

## 3. Deterministic Legacy Line Identity Backfill

### 3.1 Fixed identity algorithm

Legacy `recipeLineId` values must be reproducible and must not depend on
`ingredientId`, query return order, SQLite `rowid`, timestamps, or random UUIDs.

Migration 017 uses RFC 9562 UUIDv5 with this fixed namespace UUID:

```text
1eb684cb-79ac-592a-ab08-06d7573be569
```

That namespace is itself UUIDv5(DNS namespace,
`island-operations-assistant/recipe-legacy-line/v1`). The stored identity is
`recipe_line_<uuid-v5>`.

For a legacy Draft Line, the canonical UUIDv5 name is:

```text
draft:<draft_id>:<decimal_position>
```

The decimal position is the explicit persisted `position` column rendered in
canonical base-10 form without padding.

### 3.2 Position validation

Before generating identities, every Draft and Version owner must have:

- non-negative explicit positions;
- one row per position;
- positions exactly contiguous from `0` through `line_count - 1`; and
- deterministic ordering by the explicit `position` column.

Any gap, duplicate, negative value, or reliance on implicit row order aborts
Migration 017.

### 3.3 Published Line continuity

Each legacy Recipe Version identifies its source Draft through
`recipe_versions.source_draft_id`. A Version Line may reuse the source Draft
Line's generated `recipeLineId` only when all of the following are true:

1. the source Draft exists and belongs to the same Recipe;
2. Draft and Version positions are valid and contiguous;
3. the Draft and Version have the same Line count;
4. each Version Line has exactly one source Draft Line at the same persisted
   zero-based position;
5. the paired rows compare equal, using SQLite binary text equality and exact
   integer equality without mapper conversion, for every Migration 016 Line
   semantic column: `position`, `ingredient_id`,
   `ingredient_canonical_name`, `ingredient_measurement_dimension`,
   `ingredient_status`, `ingredient_created_at`, `quantity_coefficient`,
   `quantity_scale`, `quantity_unit_code`, and `quantity_dimension`; and
6. the resulting Line IDs are unique within both owners.

When all conditions hold, the Version Line stores the Draft-derived identity
from `draft:<source_draft_id>:<position>`. This preserves Draft-to-Published
Line identity.

If any Version Line cannot be paired uniquely and exactly, Migration 017 fails
closed. It must not generate a Version-only fallback ID, pair by Ingredient,
choose the first matching row, or silently alter historical content.

Migration 016 has no preparation-note or Measurement Profile identity column.
Migration 017 therefore writes SQL `NULL` as the legacy preparation note for
both paired rows. SQL `NULL` and an empty string remain distinct. It must not
infer a note, Profile identity, normalized amount, or conversion evidence from
current Ingredient/Profile state. No unpersisted fact participates in the
legacy equality claim. `quantity_coefficient` is compared as its persisted
canonical integer text, while `quantity_scale` and `position` are compared as
integers; timestamps and all other text are compared byte-for-byte under
SQLite `BINARY` collation.

### 3.4 Legacy Recipe Family identity

Migration 016 has `recipe_id` but no persisted `recipe_family_id`. Migration
017 backfills the already accepted 001A compatibility identity:

```text
recipe_<uuid> -> recipe_family_<same uuid>
```

The backfill must validate both identity formats and uniqueness before table
replacement. It must not derive Family identity from Recipe name or Product
display data.

## 4. Line Schema, Mapper, and Repository Rules

### 4.1 Line constraints

Migration 017 must remove these Migration 016 constraints through the approved
non-destructive table correction:

- `UNIQUE (draft_id, ingredient_id)`
- `UNIQUE (recipe_version_id, ingredient_id)`

They are replaced by owner-scoped Line identity and ordering constraints:

- Draft Line primary identity: `(draft_id, recipe_line_id)`.
- Version Line primary identity: `(recipe_version_id, recipe_line_id)`.
- Draft position uniqueness: `(draft_id, position)`.
- Version position uniqueness: `(recipe_version_id, position)`.
- `recipe_line_id` must match `recipe_line_<uuid>`.
- Repeated `ingredient_id` is legal and has no uniqueness constraint.
- Both corrected Line tables add nullable `preparation_note TEXT`; migrated 016
  rows receive SQL `NULL`.
- Corrected `recipe_drafts` and `recipe_versions` each add nullable
  `instructions TEXT`; migrated 016 rows receive SQL `NULL` and Published rows
  retain their own immutable copy.

The same `recipe_line_id` is expected to exist once in its source Draft and once
in each immutable Version produced from that Draft. Global uniqueness across
Draft and Version tables is therefore intentionally not required.

### 4.2 Mapper and repository behavior

- `RecipeLineRecord` persists `recipeLineId`, explicit `position`, and nullable
  `preparationNote`.
- `RecipeDraftRecord` persists nullable plain-text `instructions`.
- `RecipeVersionRecord` persists an independent immutable copy of nullable
  plain-text `instructions`; a Version read never obtains instructions from a
  mutable Draft row.
- Draft and Version writes use the `recipeLineId` already present in Domain
  state.
- Published Version Lines preserve the exact IDs from their source Draft
  snapshot.
- Reads parse and restore the persisted ID; the mapper must never derive a
  formal Line ID from `ingredientId` or current list position.
- Reordering updates positions while retaining IDs.
- A retry writes the same IDs and cannot create replacement identities.
- Duplicate `recipeLineId` within one owner fails with typed persistence
  evidence whose stable Recipe failure is `RecipeLineIdentityCollision`.
- Repeated `ingredientId` must round-trip without conflict.
- Published Version rows and Version Lines remain append-only and cannot depend
  on mutable Draft rows to reconstruct historical content.
- Existing canonical projection, snapshot comparison, and Costing Contract
  behavior must continue to consume the same ordered immutable Recipe facts.
- Recipe v1 instructions are one optional plain-text value, not an ordered
  instruction collection. SQL `NULL` and an empty string remain distinct.
  Line positions remain the only ordering facts affected by this slice.

## 5. Abandoned Persistence and Audit

- `RecipeState` and persisted Recipe/Draft state accept `Abandoned`.
- A successful Draft abandonment persists terminal Recipe and Draft state,
  resulting aggregate version, and append-only abandonment evidence.
- The abandonment audit stores at least Recipe Family ID, Recipe ID, Draft ID,
  actor, occurred-at time, non-empty reason, previous aggregate version, and
  resulting aggregate version.
- At most one successful abandonment audit exists for a Draft.
- Infrastructure uses evidence supplied by the accepted Domain/Application
  boundary. It must not infer actor, time, reason, or version evidence.
- Restart must rehydrate the Draft as `Abandoned` with its audit evidence.
- Persistence must reject any attempt to rewrite abandonment evidence or move
  an Abandoned Draft back to Draft, Published, or Superseded.
- Publish and Abandon serialize on the same aggregate-version update.
- The persistence UoW may store authorized evidence but must not introduce
  Application authorization policy or decide when abandonment is invoked.
- Abandon state, aggregate version, append-only audit, and durable receipt are
  one indivisible `IMMEDIATE` transaction. None may commit independently.
- Migration 017 creates `recipe_abandonment_audits`, keyed by a stable
  `event_key`, with `draft_id` unique and owner-consistent Recipe Family,
  Recipe, actor, occurred-at, reason, previous aggregate version, and resulting
  aggregate version facts. Every identity and evidence value comes from the
  accepted persistence input; infrastructure supplies no fallback.

## 6. Product and Recipe Family Uniqueness

- `recipe_family_id` is a non-null durable identity, has a unique constraint on
  `recipe_recipes`, and is independent from Recipe name.
- A bound canonical `product_id` identifies at most one Recipe Family in the
  global-default scope.
- Product binding is immutable once present.
- Migration 017 backfills Product ID only from consistent existing Recipe Draft
  evidence for that Recipe.
- If existing rows for one Recipe disagree on Product ID, migration fails
  closed.
- A legacy Recipe with no Product binding may remain nullable for historical
  readability, but it cannot be formally published or used to create a second
  binding. The exact partial unique index is
  `recipe_recipes_one_bound_product` on `recipe_recipes(product_id) WHERE
  product_id IS NOT NULL`. Multiple rows whose Product ID is SQL `NULL` are
  legal.
- Formal post-017 Family creation must provide Product binding; the nullable
  legacy allowance is not permission for 001C to create an unbound Family.
- The exact trigger `recipe_recipes_product_binding_immutable` rejects any
  update where an existing non-null `product_id` would become null or a
  different value. Product Version remains immutable evidence on each Draft or
  Published Version and does not redefine Family Product identity.
- Concurrent attempts to create Families for one Product are arbitrated by the
  database uniqueness constraint inside independent `IMMEDIATE` transactions.
- Application pre-checks may improve messaging later but never replace the
  persistence constraint.
- `current_draft_id` is non-null because Family creation atomically creates its
  initial Draft. `(recipe_family_id, current_draft_id)` is a deferred composite
  foreign key to an owner-unique `(recipe_family_id, draft_id)` key in
  `recipe_drafts`, with `ON UPDATE RESTRICT ON DELETE RESTRICT`.
- `current_recipe_version_id` is SQL `NULL` before first publication. The pair
  `(recipe_family_id, current_recipe_version_id)` is a deferred composite
  foreign key to an owner-unique `(recipe_family_id, recipe_version_id)` key in
  `recipe_versions`, with `ON UPDATE RESTRICT ON DELETE RESTRICT`. SQLite NULL
  foreign-key semantics permit the pre-publication pointer.
- Recipe Draft and Version rows each persist non-null `recipe_family_id` and
  use deferred composite foreign keys back to the owning Recipe Family. These
  owner keys make a cross-Family pointer invalid even when the target identity
  exists.
- Migration 017 uses `DEFERRABLE INITIALLY DEFERRED` composite foreign keys as
  the single circular-insert strategy. It does not leave insert ordering or
  same-Family verification to repository pre-checks.
- Once a Family has a Published Version, publication replacement moves the
  pointer to exactly one immutable Version; abandonment of a later Draft does
  not erase historical current Published identity.

## 7. Durable Idempotency Receipt

### 7.1 Exact operation, scope, and result mappings

Migration 017 creates `recipe_command_receipts`. The only 001B operation and
scope combinations are:

| Operation canonical value | Scope type | Scope ID | Required committed result identity |
| --- | --- | --- | --- |
| `FAMILY_CREATE` | `PRODUCT` | canonical `productId` | `recipeFamilyId`, `recipeId`, initial `draftId`, resulting aggregate version |
| `DRAFT_ABANDON` | `RECIPE_DRAFT` | target `draftId` | `recipeFamilyId`, `recipeId`, `draftId`, deterministic abandonment event ID, terminal `Abandoned`, resulting aggregate version |
| `RECIPE_PUBLISH` | `RECIPE_FAMILY` | target `recipeFamilyId` | `recipeFamilyId`, `recipeId`, source `draftId`, published `recipeVersionId`, Version number, resulting current-Version pointer, resulting aggregate version |

The authoritative database uniqueness key is:

```text
(operation_type, scope_type, scope_id, idempotency_key)
```

`idempotency_key` is a non-empty, byte-sensitive UTF-8 string with the
repository-wide maximum of 200 bytes. Persistence does not trim, fold case, or
otherwise normalize it.

The receipt table uses explicit columns: `operation_type`, `scope_type`,
`scope_id`, `idempotency_key`, `canonical_input_version`,
`request_fingerprint_algorithm`, `request_fingerprint`,
`result_recipe_family_id`, `result_recipe_id`, `result_draft_id`,
`result_recipe_version_id`, `result_version_number`, `result_state`,
`result_event_id`, `result_current_recipe_version_id`,
`result_aggregate_version`, and `created_at`. SQL checks enforce the three
operation/scope pairs and each operation's required/non-applicable result
columns. Non-applicable result columns are SQL `NULL`, not empty strings.

### 7.2 Versioned canonical request identity

Every receipt stores:

- canonical-input version `recipe-receipt-request-v1`;
- `request_fingerprint_algorithm` fixed to `SHA-256`;
- `request_fingerprint` encoded as exactly 64 lowercase ASCII hexadecimal
  characters; and
- the operation, scope, result identities, and canonical `created_at` described
  above.

The fingerprint is SHA-256 over UTF-8 bytes of a deterministic framed field
sequence. It must not use normal JSON serialization or property iteration
order. The byte stream begins with one framed string whose value is
`recipe-receipt-request-v1`, followed by operation-specific fields in the exact
order below.

Each field uses this unambiguous framing:

```text
<name-byte-length>:<name><type-tag><value-byte-length>:<value-bytes>
```

Lengths are unsigned canonical base-10 ASCII without padding. Type tags are
`S` for UTF-8 string, `I` for canonical base-10 integer, `N` for explicit SQL
null, and `M` for an absent optional field. `N` and `M` both have zero value
bytes but remain different because their tags differ. Strings are not trimmed,
Unicode-normalized, locale-folded, or case-folded. Integers contain no sign,
leading zero, decimal point, exponent, or whitespace, except the integer zero
is encoded as `0`.

Operation-specific request fields follow the version frame in this order:

| Operation | Canonical request identity fields in order |
| --- | --- |
| `FAMILY_CREATE` | operation, scopeType, productId, productVersionId, Draft display name, initial Draft content digest, verified actor identity |
| `DRAFT_ABANDON` | operation, scopeType, recipeFamilyId, recipeId, draftId, expectedAggregateVersion, verified actor identity, non-empty reason |
| `RECIPE_PUBLISH` | operation, scopeType, recipeFamilyId, recipeId, draftId, expectedAggregateVersion, expectedCurrentRecipeVersionId (`N` when null), immutable publication-content digest, verified actor identity, non-empty publication reason |

Canonical times and server-generated result identities are excluded from the
request identity so a transport retry does not acquire a new fingerprint. The
receipt returns the original committed time and result identities.

The initial Draft content digest and immutable publication-content digest are
also lowercase SHA-256 over the same framing format. Their framed content is,
in order: name; Product ID and Product Version ID; optional instructions using
`N` versus `S`; Standard Output and Standard Yield exact coefficient, scale,
unit code, and dimension using `M` where not yet present; Line count; then each
Line in persisted zero-based position order. Each Family-create Line includes
position, canonical Ingredient reference facts, exact quantity facts, and
optional preparation note but excludes server-generated Line ID. Each Publish
Line additionally includes its existing `recipeLineId`. Reordering or changing
any semantic Line fact changes the digest.

001C is responsible for constructing this accepted canonical request identity
from verified Application facts. 001B validates the version, framing-produced
fingerprint shape, operation/scope compatibility, and required result fields,
then stores and compares the 64 ASCII bytes exactly. It never reinterprets,
uppercases, or semantically renormalizes a supplied fingerprint.

### 7.3 Receipt arbitration invariants

- Unsupported canonical version, operation, operation/scope pair, fingerprint
  algorithm, non-lowercase/non-64-byte fingerprint, or incomplete result
  identity fails before mutation.
- Same key/scope/operation plus a byte-identical fingerprint returns the
  already committed result identities without another mutation.
- Same key/scope/operation plus any different fingerprint byte fails with a
  typed Recipe persistence idempotency conflict.
- A change to operation, scope type, or scope ID selects a different uniqueness
  scope and is never treated as replay of the original command.
- Receipt and its successful mutation commit in the same transaction.
- The receipt is not an in-memory cache and survives process restart.
- Concurrent same-key requests use the unique receipt key and independent
  SQLite connections. At most one request commits.
- A receipt cannot exist without its complete result, and a mutation requiring
  a receipt cannot commit without that receipt.
- Infrastructure does not fabricate an idempotency key, request fingerprint,
  scope, result identity, actor, or timestamp.
- HTTP status mapping and public DTO shape remain 001C/001D work.

## 8. Publication Persistence Unit of Work

### 8.1 Dedicated persistence interface

001B defines one `RecipePersistenceUnitOfWork` port with exactly three public
write methods:

```text
createFamilyWithInitialDraft(input: FamilyCreationPersistenceInput)
  -> FamilyCreationPersistenceResult

abandonDraft(input: DraftAbandonmentPersistenceInput)
  -> DraftAbandonmentPersistenceResult

publishRecipeVersion(input: RecipePublicationPersistenceInput)
  -> RecipePublicationPersistenceResult
```

The shared `ReceiptRequestEvidence` record is exact:

```text
operationType
scopeType
scopeId
idempotencyKey
canonicalInputVersion = recipe-receipt-request-v1
requestFingerprintAlgorithm = SHA-256
requestFingerprint
receiptCreatedAt
```

The exact operation records are:

```text
FamilyCreationPersistenceInput
  receipt: ReceiptRequestEvidence(FAMILY_CREATE, PRODUCT, productId)
  productId, productVersionId
  recipeFamilyId, recipeId, initialDraftId
  initialDraftName, instructions
  initialLines[]
  initialAggregateVersion
  creationAudit: eventId, actor, occurredAt

FamilyCreationPersistenceResult
  recipeFamilyId, recipeId, initialDraftId
  resultingAggregateVersion
  creationAuditEventId
  receiptCreatedAt

DraftAbandonmentPersistenceInput
  receipt: ReceiptRequestEvidence(DRAFT_ABANDON, RECIPE_DRAFT, draftId)
  recipeFamilyId, recipeId, draftId
  expectedCurrentDraftId
  expectedAggregateVersion
  abandonment: eventId, actor, occurredAt, reason,
               previousAggregateVersion, resultingAggregateVersion

DraftAbandonmentPersistenceResult
  recipeFamilyId, recipeId, draftId
  state = Abandoned
  abandonmentEventId
  resultingAggregateVersion
  currentRecipeVersionId
  receiptCreatedAt

RecipePublicationPersistenceInput
  receipt: ReceiptRequestEvidence(RECIPE_PUBLISH, RECIPE_FAMILY,
                                  recipeFamilyId)
  recipeFamilyId, recipeId, sourceDraftId
  expectedAggregateVersion
  expectedCurrentRecipeVersionId
  publishedVersionSnapshot
  publicationAudit
  supersessionAudit (required exactly when a previous current Version exists)
  resultingCurrentRecipeVersionId
  resultingAggregateVersion

RecipePublicationPersistenceResult
  recipeFamilyId, recipeId, sourceDraftId
  recipeVersionId, versionNumber
  currentRecipeVersionId
  resultingAggregateVersion
  publicationAuditEventId
  supersessionAuditEventId (null when no previous current Version)
  receiptCreatedAt
```

All arrays are readonly ordered records. Nullable values are explicit; missing
required fields are rejected. The UoW recomputes the operation-specific
canonical digest from these exact inputs and requires byte equality with the
supplied fingerprint before any write. This verifies persistence identity while
leaving trusted actor resolution and request construction to 001C.

There is no callback-based transaction API and no flag that omits audit,
receipt, concurrency, or pointer work. The SQLite implementation is the sole
transaction owner. Each method starts exactly one `IMMEDIATE` transaction and
uses only the injected transaction-bound `DatabaseAdapter`. Repository write
helpers invoked inside it must not begin, commit, or roll back a nested
transaction, open another write connection, or persist data before the UoW
begins. Results are returned only after commit succeeds.

The port accepts persistence records containing identities and verified facts
already produced by the Domain/later 001C boundary. It does not expose an HTTP
command, authorize an actor, generate server identities, or choose when an
operation is invoked.

### 8.2 Family creation records and atomic write set

`FamilyCreationPersistenceInput` contains the exact operation/scope/key,
versioned fingerprint evidence, canonical Product and Product Version binding,
server-generated Recipe Family/Recipe/initial Draft identities, initial Draft
record including nullable instructions and optional Lines, expected initial
aggregate version, append-only creation-audit evidence, and canonical receipt
creation time.

`FamilyCreationPersistenceResult` contains the committed Recipe Family, Recipe,
initial Draft identities, resulting aggregate version, creation-audit identity,
and original committed receipt time.

Migration 017 creates append-only `recipe_creation_audits`, keyed by stable
`event_key`, with unique `recipe_family_id` and the Product, Recipe, initial
Draft, actor, occurred-at, and resulting aggregate-version evidence supplied by
the input. Existing `recipe_publish_audits` and
`recipe_supersession_audits` remain append-only and are constraint-aligned with
the new Family identity.

One `IMMEDIATE` transaction performs:

1. receipt replay/conflict arbitration;
2. Product/Family uniqueness and persistence prerequisites;
3. Recipe Family and immutable Product binding insert;
4. initial Draft, instructions, and any supplied stable Lines insert;
5. non-null `current_draft_id` and null current-Version pointer establishment;
6. append-only creation audit insert;
7. durable `FAMILY_CREATE` receipt insert; and
8. commit, or rollback of every effect.

Same-request replay returns the prior result. A uniqueness, fingerprint,
identity, audit, Line, pointer, or commit failure leaves no Family, orphan
Draft, partial Lines, audit, pointer, or receipt.

### 8.3 Draft abandonment records and atomic write set

`DraftAbandonmentPersistenceInput` contains operation/scope/key, versioned
fingerprint evidence, Recipe Family/Recipe/Draft identities, expected aggregate
version, expected current Draft identity, Domain-produced terminal abandonment
evidence, append-only event/audit identity, and receipt creation time.

`DraftAbandonmentPersistenceResult` contains the committed Family/Recipe/Draft
identities, terminal `Abandoned` state, abandonment event identity, resulting
aggregate version, unchanged current Published Version identity when present,
and original committed receipt time.

One `IMMEDIATE` transaction performs:

1. receipt replay/conflict arbitration;
2. owner, current-Draft, state, and expected aggregate-version checks;
3. Draft and Recipe current state transition to `Abandoned` as defined by the
   accepted Aggregate persistence projection;
4. explicit retention of the Family `current_draft_id` pointing to the now
   terminal historical Draft;
5. retention of any prior current Published Version pointer;
6. append-only abandonment audit insert;
7. durable `DRAFT_ABANDON` receipt insert; and
8. commit, or rollback of every effect.

Same-request replay returns the prior terminal result. A state, version,
identity, audit, pointer, receipt, or commit failure leaves the Draft editable
and adds no abandonment evidence or receipt. Creating a later revision Draft
and moving `current_draft_id` is a separate 001C-orchestrated capability and is
not hidden inside abandonment.

### 8.4 Publication records and atomic write set

`RecipePublicationPersistenceInput` contains operation/scope/key, versioned
fingerprint evidence, Recipe Family/Recipe/source Draft identities, expected
aggregate version, expected current Recipe Version identity including explicit
null, Domain-produced immutable Version snapshot and stable Lines, publication
audit, optional supersession audit, required pointer result, and receipt time.

`RecipePublicationPersistenceResult` contains the committed Family/Recipe/
source Draft/Recipe Version identities, Version number, resulting current
Version pointer, resulting aggregate version, publication audit identity,
optional supersession audit identity, and original committed receipt time.

One `IMMEDIATE` transaction performs:

1. receipt replay/conflict arbitration;
2. owner, state, expected aggregate-version, expected current-Version, and
   persistence prerequisite checks;
3. immutable Published Recipe Version insert, including independent
   instructions snapshot;
4. all immutable Version Lines with source Draft Line IDs and notes insert;
5. append-only publication audit insert;
6. previous current Version supersession and supersession-audit insert when a
   previous current Version exists;
7. Recipe Family current Draft/Version pointer and aggregate-version update
   exactly once;
8. durable `RECIPE_PUBLISH` receipt insert; and
9. commit only after every prior effect succeeds.

Same-request replay returns the prior committed result without another Version,
Line, audit, pointer update, or receipt. Forbidden partial states include a
Version without every Line/instruction/audit, only some Version Lines, a moved
pointer without its Version, a Superseded old Version without replacement, a
receipt without publication, publication without its receipt, or an aggregate
version increment without the complete formal result.

### 8.5 Connection ownership and transaction failure

The production SQLite UoW receives an externally owned `DatabaseAdapter`. It
does not own that connection's lifecycle, never closes or replaces it on
success or ordinary operation failure, and performs every write through that
same adapter. A future factory that creates a dedicated adapter must expose a
different explicitly owning interface and is outside 001B.

The transaction adapter must preserve the original operation failure as the
primary cause. If rollback also fails, rollback failure is attached as
secondary context to a typed persistence transaction failure and the adapter is
marked unsafe for reuse. Commit failure never returns success; it triggers the
adapter's defined rollback attempt, preserves both causes when applicable, and
marks the adapter unsafe whenever transaction state cannot be proven clean.

The accepted implementation therefore requires an additive transaction-failure
contract in `DatabaseAdapter`/`BetterSqlite3Adapter` that reports operation,
commit, and rollback evidence without changing existing successful transaction
semantics for other domains. Recipe UoW maps that contract to typed Recipe
persistence failures.

All test-owned independent adapters are closed in `finally`/teardown. WAL, SHM,
and temporary database artifacts are removed after every adapter is closed,
including assertion and rollback-failure paths. Concurrency tests verify no
connection or lock remains. The UoW must map SQLite uniqueness, busy/locking,
constraint, commit, and rollback failures to typed persistence outcomes without
becoming a second Recipe lifecycle authority.

## 9. 001B / 001C Boundary

| 001B owns | 001C owns |
| --- | --- |
| Forward-only Migration 017 | Application command handlers |
| Repository and mapper persistence | Trusted actor authorization |
| Dedicated Family-create, Abandon, and Publish persistence UoW methods | Application identity orchestration |
| Current pointer persistence | DTO and Contract mapping |
| Supersession persistence | Request validation at the Application boundary |
| Durable idempotency receipt storage and arbitration | Deciding when Family-create, Publish, or Abandon is invoked |
| SQLite `IMMEDIATE` transaction mechanics | Product/Ingredient/Measurement Contract orchestration |
| Persistence concurrency outcomes | Application typed outcome coordination |
| Rollback, restart, rerun, and upgrade verification | API, server, and web integration |

001B may define the exact persistence input/result records required by the three
dedicated UoW methods and atomically persist those supplied facts. It must not
create a complete Application command handler, trust caller-reported actor
data, choose authoritative identities, resolve authorization, map HTTP status,
or expose a management DTO. 001C calls these complete methods and does not
reimplement transaction, repository write order, receipt, or audit internals.

## 10. Exact Candidate Implementation Allowlist

The following is the maximum candidate allowlist for a later 001B Work Order.
The Work Order may narrow it but must not expand it without another Owner
decision.

Forward-only migration and upgrade verification:

- `migrations/017_recipe_persistence_line_identity_and_publication_uow.sql`
- `scripts/migration-upgrade-014.mjs`
- `src/shared/database/migrate.ts`
- `src/shared/database/migration-data/017-recipe-line-identity-backfill.ts`

Transaction failure evidence required by the UoW:

- `src/shared/database/database-adapter.ts`
- `src/shared/database/better-sqlite3-adapter.ts`

Persistence ports, records, mapper, errors, and exports:

- `src/domains/recipe/domain/recipe-repository.ts`
- `src/domains/recipe/persistence/records.ts`
- `src/domains/recipe/persistence/errors.ts`
- `src/domains/recipe/persistence/recipe-persistence-mapper.ts`
- `src/domains/recipe/persistence/recipe-persistence-unit-of-work.ts`
- `src/domains/recipe/infrastructure/sqlite-recipe-repository.ts`
- `src/domains/recipe/infrastructure/sqlite-recipe-persistence-unit-of-work.ts`
- `src/domains/recipe/index.ts`

Focused persistence and migration tests:

- `src/tests/recipe-persistence.test.ts`
- `src/tests/recipe-sqlite-persistence.integration.test.ts`
- `src/tests/recipe-migration-017.integration.test.ts`
- `src/tests/recipe-persistence-unit-of-work.integration.test.ts`
- `src/tests/database-transaction-failure.integration.test.ts`

The Migration 017 SQL file, deterministic data-backfill module, persistence UoW
port/implementation, and three dedicated integration-test paths that do not yet
exist are authorized candidate creation paths only after a separate
implementation Work Order. The migration runner may dispatch only the exact
017 data hook inside the same migration transaction; it must not become a
general Domain-aware migration service. Listed existing files may be omitted
when no modification is necessary. No wildcard or implied supporting-file
permission exists.

## 11. Explicit Exclusions

001B does not authorize:

- modifying, replacing, or reformatting `migrations/016_recipe_recipes.sql`;
- Application command orchestration or command handlers;
- authentication, authorization, actor derivation, or clock policy;
- API, HTTP DTO, Contract, server, Runtime, web, or UI changes;
- E2E tests;
- Product, Ingredient, or Measurement internal-table business validation;
- Ingredient Proposal or Ingredient lifecycle work;
- PR-RECIPE-MANAGEMENT-001C through 001E;
- Cost, Kitchen, Planning, Inventory, Payment, Statistics, or AI integration;
- subrecipes or recursive Recipe composition;
- governance, ADR, Decision, Roadmap, Repository Policy, Working Guide, or
  Proposal changes;
- package dependency or package-script changes;
- branch deletion;
- opportunistic refactoring; or
- any file not named in the later Owner-approved implementation allowlist.

## 12. Acceptance Test Matrix

### 12.1 Migration

| Case | Required proof |
| --- | --- |
| Clean database | All migrations through 017 create the approved schema |
| Migration 016 upgrade | A populated 016 database upgrades without losing accepted data |
| Migration 016 guard | Migration 016 content remains byte-for-byte unchanged |
| Draft Line backfill | IDs equal UUIDv5 of the fixed namespace and canonical Draft name |
| Published Line backfill | Exactly matched source Draft Lines retain the same IDs |
| Repeated Ingredient legacy rows | Distinct positions produce distinct Line IDs |
| Ambiguous source pairing | Upgrade fails and rolls back instead of guessing |
| Invalid positions | Gaps, duplicates, or invalid positions fail closed |
| Family backfill | Recipe and Family retain same accepted UUID component |
| Product conflict | Conflicting Product/Family legacy evidence fails closed |
| NULL Product bindings | Multiple legacy unbound Families remain legal |
| Current Draft pointer | Missing or cross-Family Draft pointer is rejected |
| Current Version pointer | Missing or cross-Family Version pointer is rejected; null is legal before publication |
| Partial migration failure | No table swap, data loss, or migration record remains |
| Restart | All upgraded identities and evidence survive reopen |
| Rerun | Successful 017 is not reapplied and IDs are unchanged |
| Ordering | 017 follows 016 exactly |
| Integrity | FK and SQLite integrity checks pass after upgrade and restart |

### 12.2 Mapper and repository

| Case | Required proof |
| --- | --- |
| Stable identity round-trip | Draft `recipeLineId` writes and reads unchanged |
| Preparation note | Nullable note writes and reads unchanged |
| Draft instructions | Nullable plain text round-trips and survives restart |
| Published instructions | Version owns an immutable independent copy |
| Draft instruction mutation | Later Draft edits do not change a Published Version |
| Repeated Ingredient | Multiple Lines sharing `ingredientId` round-trip independently |
| Ordering | Reorder persists positions without changing Line IDs |
| Draft/Published continuity | Published Lines retain source Draft Line IDs |
| Immutable Version | Published Line facts cannot be overwritten |
| Abandoned round-trip | Terminal state and evidence survive restart |
| Duplicate Line ID | Owner-scoped duplicate fails as `RecipeLineIdentityCollision` evidence |
| Product/Family uniqueness | One non-null Product binding maps to at most one Family |
| Costing regression | Canonical projection and costing consume unchanged ordered facts |

### 12.3 Persistence Unit of Work

| Case | Required proof |
| --- | --- |
| Successful publication | Version, Lines, audit, pointer, aggregate version, and receipt commit |
| Replacement publication | Previous current Version becomes Superseded with audit |
| Pointer update | Current pointer moves exactly once to the committed Version |
| Stage failure injection | Failure at every write stage rolls back all effects |
| Same-key retry | Same fingerprint returns durable prior result without new writes |
| Key conflict | Different fingerprint with the same scoped key fails closed |
| Fingerprint reproducibility | Same canonical fields produce identical lowercase SHA-256 across restart/processes |
| Null versus missing | `N` and `M` frames produce different fingerprints |
| Malformed receipt identity | Bad version, operation/scope pair, algorithm, casing, length, or result fields fail before writes |
| Content digest | Line reorder, instruction/note, quantity, or Ingredient fact change alters the digest |
| Restart retry | Reopen returns the same committed publication identities |
| Concurrent publish | Independent connections permit at most one current replacement |
| Concurrent same key | Independent connections commit one receipt/result |
| Concurrent different payload | At most one commits; the other reports conflict |
| Concurrent Family creation | Database uniqueness permits one Family per Product |
| Publish/Abandon race | Aggregate-version arbitration permits at most one transition |
| No partial state | Every prohibited partial receipt/publication state remains absent |
| Family creation | Family, initial Draft/instructions/Lines, pointer, audit, and receipt commit atomically |
| Family creation replay | Same request returns the original Family and Draft identities |
| Family creation rollback | No Family, Draft, pointer, audit, Line, or receipt survives failure |
| Multiple null Product bindings | Independent legacy null bindings remain legal |
| Product uniqueness race | Independent connections permit one bound Family per Product |
| Abandon success | State, aggregate version, audit, pointer handling, and receipt commit atomically |
| Abandon replay | Same request returns the original terminal result |
| Abandon rollback | Draft remains editable and no audit/receipt survives failure |
| Cross-Family pointer | Existing target identity owned by another Family is rejected |
| Nonexistent pointer | Missing Draft or Version pointer target is rejected |
| Concurrent pointer update | Expected-version/current-pointer arbitration permits one winner |
| Transaction operation failure | Original operation error remains primary typed cause |
| Rollback failure | Rollback error is retained as secondary context and connection becomes unsafe |
| Commit failure | No success result is returned and connection safety is explicit |
| Connection cleanup | Every independent adapter closes and leaves no WAL/SHM/lock artifact |
| Dedicated interface | No callback or skip-audit/skip-receipt entry point exists |
| Instruction rollback | No partial Draft or Published instructions survive a failed UoW |

Concurrency tests must use separate SQLite connections to the same temporary
database file and exercise real transaction contention. Sequential calls or two
repositories sharing one connection do not count as concurrency evidence.
Every adapter closes in `finally`/teardown, and tests prove no lock or temporary
WAL/SHM artifact remains after cleanup.

### 12.4 Expected existing test correction and regression

- The persistence test must stop expecting `DuplicateIngredient` for repeated
  Ingredient IDs.
- Repeated `ingredientId` is valid when Line IDs differ.
- Duplicate `recipeLineId` within one owner is the actual collision and must
  retain typed `RecipeLineIdentityCollision` evidence.
- Focused Recipe Domain, event, persistence, SQLite, projection, comparator,
  and Costing Contract tests must remain green except for no documented
  expected failure after 001B is complete.
- Architecture guards and the repository full suite must remain green.

## 13. Required Verification for a Later Implementation

A separately authorized 001B implementation must run at least:

```text
npm run typecheck
npm run lint
npm run build
node --test dist/tests/recipe-persistence.test.js
node --test dist/tests/recipe-sqlite-persistence.integration.test.js
node --test dist/tests/recipe-migration-017.integration.test.js
node --test dist/tests/recipe-persistence-unit-of-work.integration.test.js
node --test dist/tests/database-transaction-failure.integration.test.js
node --test dist/tests/recipe-domain.test.js dist/tests/recipe-publish.test.js dist/tests/recipe-events.test.js
node --test dist/tests/recipe-canonical-projection.test.js dist/tests/recipe-costing-contract-v2.test.js
npm run migration:smoke
npm run migration:upgrade:014
npm run architecture:guard
npm test
git diff --check
```

The implementation report must show actual commands and results. It must not
call absent GitHub checks a CI pass or preserve the known persistence `11/12`
failure as an accepted final result.

## 14. Stop Conditions

Stop and request Owner clarification or allowlist extension if implementation
would require:

1. changing Migration 016;
2. any migration other than the exact 017 path in this Task Card;
3. a legacy Line backfill that cannot use validated explicit positions;
4. Published/Draft pairing that is not unique and exact;
5. inventing Product, actor, time, reason, identity, or request-fingerprint
   evidence;
6. weakening atomic receipt/publication or Product/Family uniqueness rules;
7. moving Application orchestration into persistence;
8. API, Runtime, UI, E2E, Ingredient, Cost, Kitchen, or Planning changes;
9. editing a file outside the separately approved implementation allowlist;
10. a package or dependency change;
11. an unexplained working-tree change; or
12. reset, rebase, force push, stash, clean, branch deletion, or history
    rewriting.

## 15. Completion Report Format for a Later Implementation

The implementation report must include:

1. baseline branch/SHA, implementation branch, and ending HEAD;
2. exact migration path and proof Migration 016 is unchanged;
3. final changed-file list and allowlist audit;
4. legacy Line UUIDv5 backfill evidence;
5. Draft/Published identity continuity evidence;
6. Abandoned persistence and audit evidence;
7. repeated Ingredient constraints and round-trip results;
8. durable receipt schema and arbitration behavior;
9. Product/Family uniqueness and nullable legacy policy;
10. complete `IMMEDIATE` transaction boundary and rollback evidence;
11. independent-connection concurrency results;
12. 001B/001C boundary confirmation;
13. every test and verification result;
14. `git diff --stat`, `git diff --check`, and `git status --short`;
15. Ingredient Proposal SHA-1 and protected untracked status; and
16. confirmation that 001C-001E did not begin.

## 16. Authorization Gate

Completion or Owner acceptance of this Task Card does not authorize Migration
017, persistence, tests, branch creation, staging, commit, push, or Pull Request
creation. PR-RECIPE-MANAGEMENT-001B requires a separate Owner Implementation
Work Order with a verified baseline, exact final allowlist, Git permissions,
verification commands, and stop conditions.

PR-RECIPE-MANAGEMENT-001C through 001E remain unauthorized. The protected
PR-INGREDIENT-003 Proposal remains deferred, untracked, and outside this Task
Card.
