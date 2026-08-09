# PR-COST-REGRESSION-001 - Nested SQLite Transaction Semantics

Status: Owner-authorized Task Card drafting record only. Future
implementation, staging, commit, push, Pull Request creation, merge, release,
and deployment remain separately gated and are not authorized by this record.

Task identifier: `COST-REGRESSION-001`

Required implementation base:

```text
Branch:
integration/architecture-development

SHA:
2512c5a7fe1f18dadcf5cbef072594dfbd74d354
```

## 1. Constitution Compatibility Gate

Reviewed authority:

- [ROS Architecture Constitution v3](../../CONSTITUTION.md)
- [ADR-001 - Server-side SQLite is the single source of truth](../adr/ADR-001-single-source-of-truth.md)
- [ADR-002 - SQLite first](../adr/ADR-002-sqlite-first.md)
- [ADR-009 - better-sqlite3 Behind a Database Adapter](../adr/ADR-009-better-sqlite3-adapter.md)
- [ADR-019 - Recipe, Measurement, and Cost Authority](../adr/ADR-019-recipe-measurement-and-cost-authority.md)
- [DECISIONS #051, #065, and #070](../DECISIONS.md)
- Owner Task Card Drafting Authorization `COST-REGRESSION-001`
- Accepted Cost Regression Read-Only Diagnosis dated 2026-08-09

Compatibility Result:

`PASS FOR TASK CARD DRAFTING ONLY`

The proposed future correction remains inside shared SQLite infrastructure.
It preserves the existing Cost-owned Unit of Work, repository-owned technical
atomicity, Recipe ownership, Cost ownership, synchronous Database Adapter
boundary, and one-server SQLite source of truth. It creates no business
authority, contract direction, schema, migration, API, UI, or lifecycle
behavior.

This Compatibility Gate does not authorize implementation.

## 2. Governance Context

The regression was discovered during the expanded verification performed for
the post-PR #7 documentation baseline synchronization. The repository-configured
`npm test` selection passed 64/64, while a separate direct execution of all 34
repository test files passed 466/470 and exposed four reproducible Cost SQLite
integration failures. Those selections overlap and must not be combined into a
fictional total.

The regression was recorded by the documentation synchronization completed in
PR #9. Recording the finding did not authorize remediation. Owner subsequently
accepted a dedicated read-only diagnosis and issued authority to draft this
Task Card only.

This Task remains independent from:

- Recipe Management 001C through 001E;
- Canonical Ingredient lifecycle or the protected Ingredient Proposal;
- architecture cleanup, duplication review, or broad refactoring;
- security review or remediation;
- main promotion, release, deployment, or runtime provenance; and
- branch or worktree cleanup.

The Cost regression must not be placed into an Ingredient, Recipe, security,
or general architecture work order.

## 3. Accepted Root-Cause Determination

Commit `8d5b211350bffee763dd58f783402b8386e99012` changed
`BetterSqlite3Adapter.transaction()` and
`BetterSqlite3Adapter.transactionImmediate()` from the native
`better-sqlite3` transaction wrapper to explicit transaction control using
`BEGIN` or `BEGIN IMMEDIATE`, followed by explicit `COMMIT` or `ROLLBACK`.

The change added required transaction-failure evidence:

- callback failure remains the primary operation failure when rollback works;
- rollback failure is retained as secondary evidence;
- an unclean rollback marks the adapter unsafe;
- commit failure cannot be returned as success; and
- an unsafe adapter fails closed on later use.

The current `runTransaction()` implementation executes its requested `BEGIN`
statement for every transaction layer. It does not first determine whether the
shared SQLite connection is already inside a transaction.

Two independently valid transaction responsibilities then compose:

1. an outer Application or Infrastructure Unit of Work opens the business
   transaction that must contain multiple reads and writes; and
2. a repository method opens its existing local transaction to preserve an
   atomic expected-version or multi-row persistence operation when the
   repository is used independently.

SQLite does not allow a second `BEGIN IMMEDIATE` on the same connection while
an outer transaction remains active. The inner call therefore fails before its
callback begins with:

```text
SQLITE_ERROR
cannot start a transaction within a transaction
```

The prior native `better-sqlite3` wrapper detected an active transaction and
used `SAVEPOINT`, `ROLLBACK TO`, and `RELEASE` for nested calls. The manual
outer transaction failure handling introduced by `8d5b211` did not preserve
that nesting behavior.

The accepted root cause is therefore the loss of nesting-aware transaction
semantics in the shared adapter, not a Cost Domain rule, Recipe Domain rule,
Cost persistence mapper, Recipe persistence mapper, migration, schema, or test
defect.

## 4. Confirmed Impact and Potential Risk

Confirmed observed impact at the required base:

- Cost Back Office Recipe creation returns HTTP 422 instead of 201.
- Cost Quote replacement success fails.
- Cost Quote replacement exact retry fails.
- The two-connection replacement scenario fails during the first replacement.

Focused execution of the two affected test files is reproducible with both
default scheduling and `--test-concurrency=1`:

```text
9 tests
5 PASS
4 FAIL
```

Isolation evidence at diagnosis time:

- Cost repository standalone integration: 24/24 PASS.
- Cost lifecycle Domain/Application tests: 26/26 PASS.
- Existing database transaction failure integration: 3/3 PASS.
- Recipe Persistence Unit of Work integration: 11/11 PASS.
- TypeScript build: PASS.

This evidence confirms the four listed failures. It does not prove that every
consumer of the shared adapter currently fails. Other combinations of nested
`transaction()` and `transactionImmediate()` remain potential shared-adapter
risk until covered by specific evidence.

The current full repository test state is not green. Cost Back Office must not
be described as release-ready while the four failures remain.

## 5. Authorized Future Implementation Allowlist

A later, separate Owner implementation authorization may permit modification
of only:

- `src/shared/database/better-sqlite3-adapter.ts`
- `src/tests/database-transaction-failure.integration.test.ts`

No other implementation or test file may be modified without a later Owner
scope amendment supported by new evidence.

The existing Cost and Recipe tests are verification gates, not authorized edit
targets.

## 6. Required Future Implementation Behavior

The future implementation must:

1. Preserve the existing public `DatabaseAdapter` interface.
2. Preserve the outermost explicit `BEGIN IMMEDIATE`, `COMMIT`, and `ROLLBACK`
   behavior for `transactionImmediate()`.
3. Preserve the outermost explicit `BEGIN`, `COMMIT`, and `ROLLBACK` behavior
   for `transaction()`.
4. Detect whether the underlying connection is already inside a transaction
   before opening a transaction layer.
5. Use a unique, collision-safe SQLite savepoint identity for every nested
   transaction layer.
6. Execute `SAVEPOINT <identity>` instead of another `BEGIN` for a nested
   transaction.
7. Treat the outermost transaction as the SQLite lock-mode authority. A nested
   `transactionImmediate()` uses a savepoint and must not attempt to upgrade a
   deferred outer transaction's lock mode.
8. Execute `RELEASE <identity>` after a successful nested callback.
9. On nested callback failure:
   - execute `ROLLBACK TO <identity>`;
   - execute `RELEASE <identity>` to remove the savepoint frame; and
   - rethrow the original callback error as primary evidence when cleanup
     succeeds.
10. Preserve callback failure as primary evidence when nested cleanup also
   fails, except where the accepted failure contract makes that impossible.
11. Never silently discard a savepoint rollback or release failure.
12. Mark the adapter unsafe whenever the transaction state cannot be proven
    clean after a failed outer or nested transaction operation.
13. Preserve the outer commit-failure and rollback-failure evidence introduced
    by `8d5b211`.
14. Preserve fail-closed behavior for an adapter already marked unsafe.
15. Preserve synchronous transaction execution; no Promise-based transaction
    workflow is introduced.
16. Preserve the outer transaction's authority over writes released from an
    inner savepoint: a later outer rollback must still reverse those writes.
17. Preserve the existing behavior that a caught, cleanly rolled-back nested
    callback failure allows the outer callback to continue.

The implementation must not:

- remove the Cost Unit of Work transaction boundary;
- remove a repository-local expected-version transaction boundary;
- bypass the shared Database Adapter;
- introduce a second transaction framework;
- change Cost, Recipe, migration, or schema behavior to work around the
  adapter defect;
- expand the public Database Adapter interface;
- introduce asynchronous transaction behavior; or
- perform a broad shared-database refactor.

## 7. Failure-Evidence Contract

The existing failure model remains authoritative:

- callback failures are operation failures;
- outer `COMMIT` failures are commit failures;
- rollback or cleanup failures are retained as secondary evidence;
- a callback failure must not be replaced by a generic SQLite error when its
  savepoint cleanup succeeds;
- a failed cleanup must never be reported as successful rollback; and
- an uncertain transaction state makes the adapter unsafe for reuse.

The implementation review must explicitly document how the existing
`DatabaseTransactionFailure` fields represent:

- nested callback failure plus `ROLLBACK TO` failure;
- nested callback failure plus final `RELEASE` failure;
- nested success followed by `RELEASE` failure; and
- outer rollback after a nested cleanup failure.

No new public error type or phase is authorized by this Task Card. If the
existing failure type cannot represent one of these cases without losing
primary or cleanup evidence, implementation must stop and request an Owner
scope decision before changing the interface.

## 8. Required Regression Coverage

The future implementation must add focused adapter coverage proving at least:

1. Outermost deferred transaction success.
2. Outermost immediate transaction success.
3. Outermost callback failure rolls back all writes.
4. Existing commit failure evidence remains intact.
5. Existing rollback failure evidence remains intact.
6. Existing unsafe-adapter protection remains intact.
7. Nested transaction success uses a savepoint and commits with its outer
   transaction.
8. Nested callback failure rolls back only to its savepoint when the outer
   callback catches it.
9. The original nested callback error remains primary evidence after clean
   savepoint rollback and release.
10. The outer transaction can continue and commit after a caught, cleanly
    rolled-back nested failure.
11. An uncaught nested callback failure causes the outer transaction to roll
    back.
12. An outer rollback reverses writes previously released from an inner
    savepoint.
13. Multiple sequential nested transactions use collision-safe savepoint
    identities.
14. Multiple levels of nesting do not reuse an active savepoint identity.
15. Deferred and immediate transaction methods compose without issuing a
    nested `BEGIN`.
16. Nested cleanup failure is retained and cannot produce silent success.

Existing end-to-end regressions must become green without editing their test
files:

- Cost Back Office Recipe creation returns the expected HTTP 201 and completes
  the existing restart/evaluation scenario.
- Cost Quote replacement success becomes green.
- Cost Quote replacement exact retry becomes green.
- The two-connection replacement scenario reaches and proves its intended
  concurrency result.

## 9. Required Future Verification Gate

The future implementation report must run and separately report at minimum:

1. `npm run typecheck`
2. `npm run architecture:guard`
3. `npm test`
4. Direct execution of every repository test file under `src/tests`
5. The two previously failing Cost test files:
   - `cost-back-office-api.integration.test.ts`
   - `cost-lifecycle.integration.test.ts`
6. Cost repository standalone tests:
   - `cost-persistence.integration.test.ts`
7. Cost lifecycle Domain/Application tests:
   - `cost-lifecycle.test.ts`
8. Recipe Persistence Unit of Work tests:
   - `recipe-persistence-unit-of-work.integration.test.ts`
9. Database transaction failure integration tests:
   - `database-transaction-failure.integration.test.ts`
10. `npm run migration:smoke`
11. `npm run migration:upgrade:014`
12. `npm run build`
13. `git diff --check`

The direct all-file execution must enumerate all compiled test files rather
than rely on the repository-configured `npm test` selection. The report must
state the number of selected files and the resulting pass/fail totals.

Selections that overlap must remain separately reported. They must not be
added into a fictional total. Passing `npm test` does not by itself prove the
all-file repository state is green.

## 10. Explicit Exclusions

- No Cost source modification.
- No Cost test modification.
- No Recipe source modification.
- No Recipe test modification.
- No migration or schema modification.
- No `DatabaseAdapter` public-interface modification.
- No broad adapter or shared-database refactor.
- No API, UI, runtime, or database-data change.
- No unrelated architecture remediation or cleanup.
- No security audit or remediation.
- No Recipe 001C through 001E.
- No Ingredient lifecycle implementation.
- No Ingredient Proposal modification, staging, or commit.
- No main promotion or remote `main` creation.
- No release or deployment.
- No branch deletion or worktree cleanup.
- No unrelated documentation modification.

## 11. Historical and Workspace Protection

The following must remain unchanged throughout Task Card recording and future
implementation unless separately authorized:

- `docs/reviews/ROS_POST_PR7_DOCUMENTATION_BASELINE_SYNCHRONIZATION_TASK_CARD.md`
- all 11 documentation files merged through PR #9, except this newly created
  Task Card is not one of those historical files;
- `docs/reviews/PR-RECIPE-MANAGEMENT-001_FORMAL_RECIPE_DRAFT_CREATION_AND_PUBLICATION_PROPOSAL.md`
- `docs/reviews/PR-RECIPE-MANAGEMENT-001A_DOMAIN_CORRECTION_AND_DRAFT_COMMANDS_TASK_CARD.md`
- `docs/reviews/PR-RECIPE-MANAGEMENT-001B_FORWARD_ONLY_PERSISTENCE_AND_PUBLICATION_UNIT_OF_WORK_TASK_CARD.md`
- all other historical Recipe records; and
- every source, test, migration, script, runtime, and database file outside a
  later explicitly authorized implementation allowlist.

Protected untracked file:

`docs/reviews/PR-INGREDIENT-003_CANONICAL_INGREDIENT_LIFECYCLE_APPLICATION_BOUNDARY_PROPOSAL.md`

Required preserved state:

```text
Git status:
untracked and unstaged

Raw SHA-1:
F1CB397736EE073A5C2FD74D895FA672FAF44582

Git blob SHA-1:
1d3180139712b6fcf2cc88fd6c8e0d04023e9925
```

## 12. Implementation and Review Gates

```text
Gate 1: Owner accepts the read-only diagnosis.                    COMPLETE
Gate 2: Owner authorizes Task Card drafting.                      COMPLETE
Gate 3: Task Card draft receives Owner review.                    PENDING
Gate 4: Owner authorizes Task Card stage, commit, push, and PR.    PENDING
Gate 5: Independent read-only Task Card review.                   PENDING
Gate 6: Owner authorizes Task Card merge.                         PENDING
Gate 7: Owner issues a separate implementation Work Order.        PENDING
Gate 8: Implementation pre-commit review and authorization.       PENDING
Gate 9: Independent implementation review.                        PENDING
Gate 10: Owner implementation merge decision.                     PENDING
```

Completing or merging this Task Card does not authorize a later Gate.

## 13. Stop Conditions

Stop and request Owner direction if:

- the required base SHA differs;
- another file would need modification;
- the public Database Adapter interface appears necessary to change;
- the two-file implementation allowlist is insufficient;
- Cost or Recipe source/test modification appears necessary;
- savepoint cleanup failure cannot be represented by the existing failure
  contract without losing evidence;
- migration, schema, runtime, or database-data change appears necessary;
- the protected Ingredient Proposal changes status or hash; or
- any excluded scope becomes necessary.

Current drafting status:

**TASK CARD DRAFTED FOR OWNER REVIEW - IMPLEMENTATION NOT AUTHORIZED**
