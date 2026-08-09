# Test Plan

Last verified: 2026-08-09 (Asia/Taipei)

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
