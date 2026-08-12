# Test Plan

Last verified: 2026-08-11 (Asia/Taipei)

## Evidence rules

- Report every command and selection independently.
- Do not add overlapping selections into one fictional total.
- Source capability, passing tests, runtime observation, main promotion,
  deployment, and product release are distinct facts.
- A failed non-required diagnostic run is still recorded; it is not erased by a
  narrower required command passing.

## Historical post-PR7 documentation verification

The following retained results were produced from
`docs/ros-post-pr7-baseline-sync-001` at base
`b107c6c7a4a2caca25bd46b138bd8baebbd97c1b`. Documentation edits do not change
the compiled product source.

| Group | Command | Result |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | PASS |
| Architecture Guards | `npm run architecture:guard` | 16/16 PASS |
| Repository-configured regression selection | `npm test` | 64/64 PASS |
| Fresh migration | `npm run migration:smoke` | PASS; applied 001 through 017 |
| Populated migration-014 upgrade | `npm run migration:upgrade:014` | PASS; applied 015, 016, and 017; pre-existing rows unchanged; foreign keys, integrity, restart, and rerun PASS |
| Recipe persistence and SQLite | `node --test dist/tests/recipe-persistence.test.js dist/tests/recipe-sqlite-persistence.integration.test.js` | 23/23 PASS |
| Recipe persistence Unit of Work | `node --test dist/tests/recipe-persistence-unit-of-work.integration.test.js` | 11/11 PASS |
| Recipe migration and transaction failure | `node --test dist/tests/recipe-migration-017.integration.test.js dist/tests/database-transaction-failure.integration.test.js` | 5/5 PASS |
| Recipe focused Domain/events/publication | `node --test dist/tests/recipe-domain.test.js dist/tests/recipe-publish.test.js dist/tests/recipe-events.test.js` | 44/44 PASS |
| Recipe Projection and Costing contract | `node --test dist/tests/recipe-canonical-projection.test.js dist/tests/recipe-costing-contract-v2.test.js` | 37/37 PASS |
| Markdown links and referenced repository paths | Read-only link/path validation over the 11 allowlist files | PASS |
| Diff whitespace | `git diff --check`, plus equivalent trailing-whitespace/final-newline check for the untracked new Closeout file | PASS |

These groups overlap. For example, the Architecture Guard file also appears in
`npm test`, and the focused Recipe files also appear in the all-file diagnostic
below. Their counts are never added together.

## COST-REGRESSION-001 closeout evidence

The `package.json` `npm test` script names 11 test files and does not include
every file under `src/tests`. Before COST-REGRESSION-001, a direct all-file
diagnostic found this reproducible regression:

```text
node --test dist/tests/*.test.js
Result: 466/470 PASS; 4 FAIL

node --test --test-concurrency=1 dist/tests/*.test.js
Result: 466/470 PASS; 4 FAIL
```

Running the two affected files independently reproduces the same failures:

- `cost-back-office-api.integration.test.js`: 1/2 failed because Recipe
  creation returned HTTP 422 instead of 201.
- `cost-lifecycle.integration.test.js`: 3/7 failed during Quote replacement
  with `CostPersistenceFailure` wrapping `SQLITE_ERROR`.

Read-only diagnosis shows existing nested transaction paths:

- `CostBackOfficeService.createAndPublishRecipe()` starts
  `transactionImmediate()` and calls Recipe repository writes that also start a
  transaction.
- `SqliteCostQuoteUnitOfWork.execute()` starts `transactionImmediate()` and
  calls `SqliteCostRepository.saveWithExpectedVersion()`, which starts another
  `transactionImmediate()`.
- `BetterSqlite3Adapter` now executes manual `BEGIN`/`BEGIN IMMEDIATE` rather
  than the earlier `better-sqlite3` transaction wrapper that supported nested
  savepoints.

That failure evidence remains part of the chronology; it is not current test
state. COST-REGRESSION-001 was implemented by PR #11 and merged as
`1c31a31030e7c0d29181ebcc5355a706db95dc50` after an initial independent-review
blocker and an authorized remediation.

### Independent PR #11 Head evidence

The following results were verified at approved PR #11 Head
`132789ccbbe65168aa79aa1888b1b3ec4424855d`. Each selection is reported
separately because selections overlap:

| Group | Result |
| --- | --- |
| BetterSqlite3 adapter integration | 16/16 PASS |
| Four cleanup-failure combinations | PASS; each combination independently exercised |
| Cost regression files, default execution | 9/9 PASS |
| Cost regression files, serial execution | 9/9 PASS |
| Cost persistence | 24/24 PASS |
| Cost lifecycle | 26/26 PASS |
| Recipe persistence Unit of Work | 11/11 PASS |
| Recipe SQLite and migration | 25/25 PASS |
| Architecture Guard | 16/16 PASS |
| Repository-configured `npm test` | 64/64 PASS |
| Direct 34-file execution, default | 483/483 PASS |
| Direct 34-file execution, serial | 483/483 PASS |
| Typecheck, lint, build, migration gates and `git diff --check` | PASS |

The four required cleanup-failure combinations separately verify nested
callback plus `ROLLBACK TO` failure, nested callback plus final `RELEASE`
failure, nested success plus `RELEASE` failure, and outer rollback after nested
cleanup failure. The additional simultaneous-cleanup-failure case proves that
final `RELEASE` is still attempted after `ROLLBACK TO` fails and that primary
and both cleanup failures are retained in order.

### Post-merge evidence

After PR #11 merged, verification at integration Head
`1c31a31030e7c0d29181ebcc5355a706db95dc50` independently reran:

| Group | Result |
| --- | --- |
| BetterSqlite3 adapter integration | 16/16 PASS |
| Original Cost regression selection | 9/9 PASS |
| Architecture Guard | 16/16 PASS |
| Typecheck, build and `git diff --check` | PASS |

These post-merge checks confirm the merged correction but are not substituted
for, or added to, the broader PR-head evidence. Passing tests do not make Cost
Back Office release-ready or establish deployment/runtime provenance.

## PR-INGREDIENT-003A and 003B closeout evidence

The following results are retained from the approved PR Heads. The selections
overlap and are reported separately.

### PR #16 approved Head evidence

At approved Head `2b93889fd4a06351d650d73e12ab8567f5fff0f9`:

| Group | Result |
| --- | --- |
| Focused PR-INGREDIENT-003A | 14/14 PASS |
| Existing Canonical Ingredient Domain | 21/21 PASS |
| Existing Canonical Ingredient persistence | 18/18 PASS |
| Architecture Guard | 16/16 PASS |
| Repository-configured `npm test` | 64/64 PASS |
| Manually enumerated compiled repository suite | 35 files, 497/497 PASS |
| `npm run verify` | PASS, including migration smoke and upgrade/restart/rerun |
| `npm run verify:full` | PASS, including browser E2E 13/13 |
| Typecheck, lint, build, and `git diff --check` | PASS |

### PR #18 approved Head evidence

At approved Head `784bb00912fd957dab6a84448dd8f640f0e166fc`:

| Group | Result |
| --- | --- |
| Application focused | 20/20 PASS |
| Canonical Ingredient catalog focused | 21/21 PASS |
| Persistence integration | 21/21 PASS |
| API integration | 3/3 PASS |
| Architecture Guard | 16/16 PASS |
| Repository-configured `npm test` | 64/64 PASS |
| Playwright E2E | 13/13 PASS |
| Manually enumerated compiled repository suite | 36 files, 509/509 PASS |
| Migration smoke and upgrade 014 | PASS |
| `npm run verify` and `npm run verify:full` | PASS |
| Typecheck, lint, build, and `git diff --check` | PASS |

The PR #18 review and remediation chronology includes corrected command
precedence, valid non-object JSON handling, API matrix coverage, Architecture
Guard namespace protection, and restoration of the established malformed-JSON
message. The approved final candidate contained 12 files at `+1523/-9`.

### Post-merge evidence boundary

Post-merge verification for PR #16 and PR #18 established the approved merge
parents, merge-tree equality, exact scope, protected blobs, remote integration
advancement, and clean Git state. It did not rerun the complete test selections
above. The PR-Head counts must not be described as post-merge reruns.

PR #19 later merged only the Ingredient 003B governance closeout Task Card. It
did not rerun product tests and did not change source or test files.

## PR-INGREDIENT-003C evidence

PR #22 recorded the Owner-approved 003C Task Card as merge commit
`c15a03e138e21328a3db0c88f861bca1b6af7e8c`. PR #23 then implemented the
six-file management UI/navigation scope through seven feature commits. GitHub
had no configured remote checks for PR #23; this is recorded as
`NOT CONFIGURED`, not as remote checks passing.

At approved PR #23 Head `06929a7c73e370e1a2e0ba4fd230cdbdb0f19a35`,
the independent sixth-remediation review reported each overlapping collection
separately:

| Group | Result |
| --- | --- |
| Typecheck | PASS |
| Lint | PASS |
| Build | PASS |
| Focused Canonical Ingredient API integration | 3/3 PASS |
| Architecture Guard | 16/16 PASS |
| Repository-configured `npm test` | 64/64 PASS |
| `npm run verify` | PASS |
| Focused Ingredient management Playwright | 9/9 PASS |
| Complete Playwright E2E | 22/22 PASS |
| `npm run verify:full` | PASS |
| Manually enumerated compiled repository suite | 36 files, 509/509 PASS |
| Fresh `TZ=UTC` focused Playwright run | 9/9 PASS |
| UTF-8, final newline, trailing whitespace, forbidden sink/storage, no-index and `git diff --check` audits | PASS |

The six remediation rounds closed command-response identity safety,
filter/selection reconciliation, initial/offline/unusable-response handling,
code-specific error mapping, the mandatory E2E matrix, distinct non-zero
version evidence, encoded identity request evidence, exact request payload
evidence, and timezone-reproducible local-time conversion. Original Findings
1 through 5 are all `CLOSED`; blocking and non-blocking findings are both zero.

Post-merge validation at
`ea46678cbb955b7aeb093dc34525c52325af9cae` independently confirmed the merge
parents/tree, exact six-file `+1288/-11` scope, protected seals, remote branch
state, the same required validation groups, and a clean repository. These
results establish development evidence only; they do not establish `main`,
release, deployment, production database, or runtime provenance.

## Migration evidence

The migration runner currently contains:

```text
001_initial_foundation.sql
002_catalog_phase_1a.sql
003_operations_events_phase_1b.sql
004_order_core.sql
005_order_lifecycle.sql
006_restore_adr014_state_separation.sql
007_event_closeout_reconciliation.sql
008_phase_b1_pos_operating_loop.sql
009_sellable_inventory_safety_buffer.sql
010_event_pause_inventory_adjustments.sql
011_pos_scheduled_pickup.sql
012_authoritative_payments.sql
013_cost_ingredient_cost_quotes.sql
014_recipe_canonical_ingredients.sql
015_recipe_ingredient_measurement_profiles.sql
016_recipe_recipes.sql
017_recipe_persistence_line_identity_and_publication_uow.sql
```

Fresh migration and populated-014 upgrade tests use disposable databases. They
do not prove that a production database was upgraded or identify any running
SQLite file.

## Future and separate verification

- The nested-transaction regression is completed and closed by PR #11. Any
  further transaction or adapter change requires a new Owner-authorized Gate.
- Browser E2E, runtime provenance, backup/restore, production health, release,
  and deployment verification remain separate Gates.
- Security and architecture audit work remains separate from test remediation.
