# COST-REGRESSION-001 Closeout Record

Status: COMPLETED

Recorded: 2026-08-09 (Asia/Taipei)

This is retrospective closeout documentation. It records verified events that
already occurred and creates no new Decision, architecture, product,
implementation, release, deployment, cleanup, or future-work authority.

## Authority

The completed work and this closeout rely on existing authority only:

- DECISIONS #051;
- DECISIONS #065;
- Owner Authorization COST-REGRESSION-001;
- PR #11 independent read-only review;
- PR #11 remediation review;
- PR #11 merge authorization; and
- PR #11 post-merge verification.

No Decision number is invented, reserved, or backdated by this record.

## Discovery and accepted diagnosis

During the post-PR7 documentation verification, repository-configured
`npm test` passed 64/64 within its named 11-file selection. A separate direct
34-file execution passed 466/470 and reproducibly failed four Cost SQLite
integration cases under both default and serial execution. These selections
overlap and were never combined into a fictional total.

The accepted diagnosis was that nested calls reached manual SQLite transaction
boundaries on a shared connection. Outer `transactionImmediate()` calls used
`BEGIN IMMEDIATE`, while inner repository work attempted another transaction.
The correction had to preserve the existing public `DatabaseAdapter` interface,
outer method-specific lock semantics, legitimate transaction boundaries,
commit/rollback failure evidence, and unsafe-adapter behavior.

## Task Card and implementation chronology

| Event | Verified identity | Result |
| --- | --- | --- |
| PR #10 Task Card merge | `a2791a36c1f063cdf0218aa91ce78955227323a0` | Recorded the dedicated COST-REGRESSION-001 Task Card; no implementation |
| PR #11 initial implementation | `32800bc7fec5d6d17781e4224dcd4751c76c9c08` | Added nested savepoint behavior; submitted for independent review |
| Initial independent review | PR #11 at initial Head | BLOCKED: a failed `ROLLBACK TO` prevented the required final `RELEASE` attempt, so simultaneous cleanup failures could not both be observed or preserved |
| Authorized remediation | `132789ccbbe65168aa79aa1888b1b3ec4424855d` | Ensured ordered `ROLLBACK TO` then final `RELEASE` attempts and retained primary plus cleanup evidence |
| Remediation review | approved Head `132789ccbbe65168aa79aa1888b1b3ec4424855d` | APPROVE FOR OWNER MERGE DECISION; no remaining finding |
| PR #11 merge | `1c31a31030e7c0d29181ebcc5355a706db95dc50` | Standard two-parent merge; Post-Merge Verification Gate passed and closed |

The PR #11 merge parents are, in order:

1. `a2791a36c1f063cdf0218aa91ce78955227323a0`
2. `132789ccbbe65168aa79aa1888b1b3ec4424855d`

The approved Head remains intact as the second parent and an ancestor of the
merged integration baseline.

## Exact implementation scope

PR #11 changed exactly two files:

| File | Additions | Deletions |
| --- | ---: | ---: |
| `src/shared/database/better-sqlite3-adapter.ts` | 66 | 4 |
| `src/tests/database-transaction-failure.integration.test.ts` | 323 | 0 |
| **Total** | **389** | **4** |

No Cost Domain, Recipe Domain, migration, schema, public interface, runtime,
database, Ingredient, or unrelated documentation path changed in PR #11.

## Corrected transaction semantics

- Outermost `transaction()` retains its existing deferred outer behavior.
- Outermost `transactionImmediate()` retains `BEGIN IMMEDIATE`.
- A nested transaction uses a collision-safe `SAVEPOINT` on the shared
  connection and never issues `BEGIN` or `BEGIN IMMEDIATE`.
- A nested transaction inherits the lock mode selected by the outermost
  transaction and does not attempt to upgrade it.
- Nested success releases its savepoint.
- Nested failure attempts `ROLLBACK TO` and then final `RELEASE`, even if the
  rollback-to operation itself fails.
- Primary and cleanup failures remain observable in deterministic order.
- Savepoint identity is shared-connection-safe, including calls made through
  distinct adapter instances over the same connection.

## Independent PR-head evidence

The following evidence was verified at approved Head
`132789ccbbe65168aa79aa1888b1b3ec4424855d`:

| Selection | Result |
| --- | --- |
| BetterSqlite3 adapter integration | 16/16 PASS |
| Four cleanup-failure combinations | PASS; each combination had concrete regression evidence |
| Original Cost regression selection, default | 9/9 PASS |
| Original Cost regression selection, serial | 9/9 PASS |
| Cost persistence | 24/24 PASS |
| Cost lifecycle | 26/26 PASS |
| Recipe persistence Unit of Work | 11/11 PASS |
| Recipe SQLite and migration | 25/25 PASS |
| Architecture Guard | 16/16 PASS |
| Repository-configured `npm test` | 64/64 PASS |
| Direct 34-file execution, default | 483/483 PASS |
| Direct 34-file execution, serial | 483/483 PASS |
| Typecheck, lint, build, migration gates and `git diff --check` | PASS |

The four required combinations were independently exercised: callback plus
rollback-to failure, callback plus final-release failure, nested success plus
release failure, and outer rollback after nested cleanup failure. One
representative case was not used as a substitute. An additional simultaneous
rollback-to/release failure trace proved that both cleanup operations were
attempted once, in order, with the same savepoint identity, while preserving
the primary and both cleanup failures.

These selections overlap and must not be added together.

## Post-merge verification

After PR #11 merged, verification at
`1c31a31030e7c0d29181ebcc5355a706db95dc50` separately passed:

- BetterSqlite3 adapter integration: 16/16;
- original Cost regression selection: 9/9;
- Architecture Guard: 16/16;
- Typecheck;
- build; and
- `git diff --check`.

The post-merge selection confirms the integrated correction. It does not
replace or combine with the broader PR-head evidence.

## Baseline and delivery boundary

The Owner formally designated PR #11 merge commit
`1c31a31030e7c0d29181ebcc5355a706db95dc50` as the Owner-Accepted Architecture
Development Baseline. PR #12 later advanced the integration Git Head to
`20bca12ac7c2620ea2fc3c808bab035c9b5311fa` by merging only the Phase A
post-PR11 documentation Task Card. That documentation-only advancement does not
redesignate the accepted baseline or complete Phase B.

COST-REGRESSION-001 is completed. This means the recorded regression and its
review blocker were corrected and verified. It does not mean that Cost Back
Office is formally released, deployed, or bound to a verified running process
or database.

Recipe 001C through 001E, Ingredient 003A through 003C, architecture/security
remediation, remote `main`, main promotion, release, deployment, branch cleanup,
and worktree cleanup remain separately gated and unauthorized by this record.
