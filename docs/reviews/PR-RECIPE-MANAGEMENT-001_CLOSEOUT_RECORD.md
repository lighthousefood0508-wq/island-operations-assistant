# PR-RECIPE-MANAGEMENT-001 Closeout Record

Status: Historical closeout record

Recorded: 2026-08-09 (Asia/Taipei)

Authority: [DECISIONS #070](../DECISIONS.md) and Owner Documentation Work Order
`DOCS-ROS-POST-PR7-001`

This is a retrospective governance record. It records authorization,
implementation, review, remediation, and merge events that actually occurred.
It does not invent or backdate a historical Decision number, expand the scope
of any earlier authorization, or authorize future Recipe work.

## 1. Protected historical documents

The following documents retain their original `Owner review draft` wording and
remain byte-for-byte unchanged by this closeout:

- [Formal Recipe Draft Creation and Publication Proposal](PR-RECIPE-MANAGEMENT-001_FORMAL_RECIPE_DRAFT_CREATION_AND_PUBLICATION_PROPOSAL.md)
- [001A Domain Correction and Draft Commands Task Card](PR-RECIPE-MANAGEMENT-001A_DOMAIN_CORRECTION_AND_DRAFT_COMMANDS_TASK_CARD.md)
- [001B Forward-only Persistence and Publication Unit of Work Task Card](PR-RECIPE-MANAGEMENT-001B_FORWARD_ONLY_PERSISTENCE_AND_PUBLICATION_UNIT_OF_WORK_TASK_CARD.md)

Their original draft status describes the documents when written. Subsequent
Owner authorization and execution are recorded here rather than rewritten into
the historical files.

## 2. Verified chronology

GitHub PR metadata and local Git merge parents were independently
cross-checked on 2026-08-09.

| Milestone | PR | Base SHA | Approved or recorded Head | Merge commit | Result |
| --- | ---: | --- | --- | --- | --- |
| Recipe Management Proposal | #3 | `2f4663b082fd3c74e8edfb38110a58632d7420c2` | `8e081059b7569613587faa86854ce5fe94bfd06f` | `d9a1074a043d1232bcfd6f982a664c02e716fd54` | Proposal recorded |
| 001A Task Card | #4 | `d9a1074a043d1232bcfd6f982a664c02e716fd54` | `22d1411a8b3dc5edf810c66948bec24d8c4fa957` | `c6a550b9e87f9a7cce27948e541808f2bb31ddaf` | Task Card recorded |
| 001A implementation | #5 | `c6a550b9e87f9a7cce27948e541808f2bb31ddaf` | `773b129cc3b53fc6435c941b770f3953f7225c98` | `7c6d4704f365ec5a79719321c170b8ca6a6cfff3` | Completed, reviewed, merged |
| 001B Task Card | #6 | `7c6d4704f365ec5a79719321c170b8ca6a6cfff3` | `21f90c6e1273102d7dbdbe4d1791090b86c6d7d0` | `29e120096455e26f70dce291a5249e43026b3550` | Task Card recorded |
| 001B implementation | #7 | `29e120096455e26f70dce291a5249e43026b3550` | `ab662a48c0bdfcf835d5c2af2ac002abba8d55a0` | `6128f8e853b9ac96e2d6870b3a97ffde9d0bf5d7` | Completed after remediation, reviewed, merged |
| Documentation synchronization Task Card | #8 | `6128f8e853b9ac96e2d6870b3a97ffde9d0bf5d7` | `70b6dab1159a3e8f10c951aca4a2992691cdf971` | `b107c6c7a4a2caca25bd46b138bd8baebbd97c1b` | Task Card recorded |

Every listed merge is a standard two-parent merge. For PR #3 through PR #8,
the recorded PR Head is the second parent of the corresponding merge commit.

## 3. 001A implementation closeout

Owner authorization permitted the pure Recipe Domain correction required for
formal Draft management. PR #5 delivered two implementation commits:

1. `4fd065b498d942307ad9ea74a76c78ecac95959d` - stable Draft Line lifecycle.
2. `773b129cc3b53fc6435c941b770f3953f7225c98` - derived abandonment event evidence.

The merged capability includes:

- stable `recipeFamilyId`, `draftId`, `recipeLineId`, and `recipeVersionId`
  semantics;
- Recipe Family Product-binding invariants;
- stable Line add, update, remove, move, and reorder behavior;
- ordered repeated Ingredient Lines distinguished by Line identity;
- optional Recipe instructions and Line preparation notes;
- terminal `DRAFT -> ABANDONED` behavior with audit facts; and
- preserved immutable Published and Superseded Recipe facts.

Primary source and test evidence:

- `src/domains/recipe/domain/recipe-aggregate.ts`
- `src/domains/recipe/domain/recipe-line.ts`
- `src/domains/recipe/domain/identities.ts`
- `src/domains/recipe/events/recipe-domain-events.ts`
- `src/tests/recipe-domain.test.ts`
- `src/tests/recipe-events.test.ts`
- `src/tests/recipe-publish.test.ts`

001A did not add persistence, API, Runtime composition, or UI authority.

## 4. 001B implementation and remediation closeout

### 4.1 Initial implementation

Head `8d5b211350bffee763dd58f783402b8386e99012` added the forward-only
Migration 017, deterministic legacy Line-identity backfill, Recipe persistence
records and mapper changes, SQLite repository behavior, a dedicated
persistence Unit of Work, durable command receipts, transaction failure
handling, and focused integration tests.

Migration 016 was not changed. Migration 017 is:

`migrations/017_recipe_persistence_line_identity_and_publication_uow.sql`

### 4.2 Independent remediation history

The initial merge candidate was not accepted merely because its tests passed.
Three independent read-only review rounds examined the Published Version
pointer invariant and real SQLite restart paths.

| Review round | Reviewed Head | Outcome | Finding and remediation |
| --- | --- | --- | --- |
| First | `795d2db896f77cfbd2d3b917561d64cade043ced` | `BLOCKED` | The real repository save path could still replace an existing Published pointer with `null`; the first regression arrangement used direct SQL and did not prove the repository path. A same-Family but unproven pointer could also survive. |
| Second | `6cab5e23da853bdf7f8868bd5aefd4b07d9db442` | `BLOCKED` | Repository preservation and non-null pointer provenance were corrected, but `null` was still accepted when Published history already existed. |
| Third | `ab662a48c0bdfcf835d5c2af2ac002abba8d55a0` | `APPROVE FOR OWNER MERGE DECISION` | The null-with-Published-history state became fail-closed while pre-publication null remained legal; publish, later Draft, abandon, close, reopen, and rehydrate retained the Published v1 pointer. |

The final approved Head was merged by PR #7. No review agent approved or merged
the PR; the merge followed a separate Owner Merge Authorization.

### 4.3 Final persistence evidence

Primary implementation evidence:

- `migrations/017_recipe_persistence_line_identity_and_publication_uow.sql`
- `src/shared/database/migration-data/017-recipe-line-identity-backfill.ts`
- `src/domains/recipe/persistence/recipe-persistence-unit-of-work.ts`
- `src/domains/recipe/persistence/recipe-persistence-mapper.ts`
- `src/domains/recipe/infrastructure/sqlite-recipe-repository.ts`
- `src/domains/recipe/infrastructure/sqlite-recipe-persistence-unit-of-work.ts`

Primary verification evidence:

- `src/tests/recipe-persistence.test.ts`
- `src/tests/recipe-sqlite-persistence.integration.test.ts`
- `src/tests/recipe-persistence-unit-of-work.integration.test.ts`
- `src/tests/recipe-migration-017.integration.test.ts`
- `src/tests/database-transaction-failure.integration.test.ts`

The final review independently exercised focused Recipe persistence and SQLite,
Unit of Work, migration and transaction, Recipe Domain, Projection and Costing,
Architecture Guard, full repository, migration smoke, populated upgrade,
restart, rerun, and `git diff --check` groups. These selections overlap and are
not added into one fictional total.

That review outcome is retained as historical review evidence. During the
2026-08-09 documentation reality check, all focused Recipe groups remained
green, while a direct current all-file run exposed four Cost integration
failures outside the focused Recipe groups. [The current Test Plan](../09_TEST_PLAN.md)
records the exact commands and prevents the historical review result from being
misstated as a currently green all-file suite.

## 5. Baseline relationship

`6128f8e853b9ac96e2d6870b3a97ffde9d0bf5d7` is the
**Owner-Accepted Architecture Development Baseline**. It contains the merged
Recipe 001A and 001B work and the previously contained Cost Back Office
development capability.

The verified remote `integration/architecture-development` Head after PR #8 is
`b107c6c7a4a2caca25bd46b138bd8baebbd97c1b`. PR #8 adds the documentation
synchronization Task Card to the ancestry; it does not replace the meaning of
the accepted Architecture Development Baseline.

Neither SHA identifies remote `main`, main promotion, a deployed runtime, or a
formal product release.

## 6. Deferred and unauthorized scope

This closeout does not authorize or claim completion of:

- Recipe 001C Application contracts and orchestration;
- Recipe 001D API and Runtime composition;
- Recipe 001E Back Office Recipe management UI;
- Ingredient lifecycle implementation or the protected Ingredient Proposal;
- Kitchen or Production Planning Recipe consumers;
- Cost Snapshot persistence or Recipe Version pinning by a Cost Snapshot;
- subrecipes, recursive BOM, Inventory, package conversion, density, or AI
  inference;
- remote `main`, main promotion, deployment, product release, branch deletion,
  or worktree cleanup.

The existing Cost Back Office create-and-publish path is not the proposed 001C
through 001E management workflow and must not be described as such.
