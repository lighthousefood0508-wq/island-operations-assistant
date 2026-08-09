# Current Status

Last verified: 2026-08-09 (Asia/Taipei)

## Governance and Git state

- Owner-Accepted Architecture Development Baseline:
  `1c31a31030e7c0d29181ebcc5355a706db95dc50`.
- Verified remote `integration/architecture-development` Head after PR #12:
  `20bca12ac7c2620ea2fc3c808bab035c9b5311fa`.
- These SHAs have different meanings. The former is the accepted development
  capability baseline through COST-REGRESSION-001; the latter is the current
  integration tip containing the Phase A Task Card merge only.
- Phase B documentation synchronization is executing on
  `docs/docs-ros-post-pr11-001-phase-b`, created from exact Head `20bca12...`.
- Remote `main` does not exist. Local `main` remains unpromoted at
  `2616fc86f5b1e81ba33ea05c71b561a8f0210e36`.
- `origin/HEAD` was observed pointing abnormally to
  `origin/feature/pr-measure-001`; it was not changed and grants no authority.
- Main promotion, deployment, formal product release, branch deletion, and
  worktree cleanup remain unauthorized.

## Recipe Management closeout

- [DECISIONS #070](DECISIONS.md) records the retrospective governance
  ratification without inventing or backdating a historical Decision number.
- The [Recipe Management Closeout Record](reviews/PR-RECIPE-MANAGEMENT-001_CLOSEOUT_RECORD.md)
  records the verified PR #3 through PR #7 chronology and remediation evidence.
- Recipe 001A: completed, independently reviewed, and merged by PR #5 as merge
  commit `7c6d4704f365ec5a79719321c170b8ca6a6cfff3`.
- Recipe 001B: completed after remediation and three independent read-only
  review rounds, then merged by PR #7 as merge commit
  `6128f8e853b9ac96e2d6870b3a97ffde9d0bf5d7`.
- The third 001B review result was `APPROVE FOR OWNER MERGE DECISION`.
- Recipe 001C through 001E are unauthorized and have not started.
- The historical Recipe Proposal and 001A/001B Task Cards remain unchanged.

## COST-REGRESSION-001 closeout

- PR #10 recorded the dedicated Task Card as merge commit
  `a2791a36c1f063cdf0218aa91ce78955227323a0`.
- PR #11 implemented and remediated the approved two-file scope. Approved Head
  `132789ccbbe65168aa79aa1888b1b3ec4424855d` merged as
  `1c31a31030e7c0d29181ebcc5355a706db95dc50` and passed post-merge verification.
- The independent [Cost Regression Closeout Record](reviews/PR-COST-REGRESSION-001_CLOSEOUT_RECORD.md)
  preserves the diagnosis, initial blocker, remediation, review, merge and test
  chronology under DECISIONS #051, #065 and Owner Authorization
  COST-REGRESSION-001. No new Decision number was created.
- PR #12 later recorded only the Phase A post-PR11 documentation Task Card as
  merge commit `20bca12ac7c2620ea2fc3c808bab035c9b5311fa`.

## Contained capability versus delivery state

| Area | Source capability in integration | Delivery status |
| --- | --- | --- |
| Catalog and Operations | Catalog, Events, sellable inventory, Orders, lifecycle, Kitchen, realtime, and Back Office history are contained | No new release or deployment is established by this document |
| Measurement and Ingredient Profile | Measurement Foundation, Canonical Ingredient, and Ingredient Measurement Profile capabilities are contained | Ingredient lifecycle application/API/UI work remains unauthorized |
| Recipe 001A | Stable Line identity, repeated Ingredient Lines, Draft edit behavior, and terminal abandonment are contained | Completed and merged |
| Recipe 001B | Migration 017, Recipe persistence, durable receipts, persistence Unit of Work, restart/rehydration, and Published pointer invariants are contained | Completed after remediation and merged |
| Recipe 001C-001E | No authorized formal management Application/API/UI implementation | Unauthorized |
| Cost Back Office | Development integration contains the vertical-slice source and Cost Evaluation capability; COST-REGRESSION-001 is completed | Tests are green at the recorded PR-head and post-merge selections; not formally released or deployment-verified |

The existing Cost Back Office create-and-publish endpoint is not the proposed
Recipe management workflow and must not be used to claim 001C through 001E.

## Migrations and verification

- Migration files `001` through `017` are present.
- Migration 016 remained immutable during Recipe 001B.
- Migration 017 is the forward-only Recipe persistence correction.
- Verification evidence is grouped in [Test Plan](09_TEST_PLAN.md); overlapping
  selections are not summed into a fictional test total.
- Source capability and test evidence do not establish runtime provenance,
  main promotion, deployment, or release.

## Closed Cost regression and verification provenance

The earlier post-PR9 diagnostic passed 466/470 and reproducibly failed four Cost
SQLite integration cases. That history is retained in the Test Plan and Cost
Closeout Record. It led to COST-REGRESSION-001; it is not current unresolved
state.

PR #11 preserved method-specific outer transaction locks and introduced nested
savepoint semantics with ordered cleanup and failure evidence. Independent
PR-head verification passed the direct 34-file selection 483/483 under both
default and serial execution, plus the focused adapter, Cost, Recipe,
architecture, build, lint, typecheck and migration selections. Post-merge
verification at `1c31a310...` separately passed adapter 16/16, the original Cost
regression selection 9/9, Architecture Guard 16/16, typecheck, build and diff
checks. These overlapping selections are not summed, and they establish no
release or runtime provenance.

## Runtime observation

The only permitted runtime record is a dated observation from 2026-08-09:
`127.0.0.1:3092/health` returned SQLite ready and the observed process was Node
`dist/server/index.js`, PID 12252. The running worktree, Git SHA, SQLite path,
and deployment provenance were not independently established. This is not a
permanent current-state claim.

## Protected and deferred work

- The Ingredient Proposal remains untracked, unstaged, and outside scope with
  raw SHA-1 `F1CB397736EE073A5C2FD74D895FA672FAF44582` and Git blob SHA-1
  `1d3180139712b6fcf2cc88fd6c8e0d04023e9925`.
- No Recipe 001C-001E, Ingredient lifecycle implementation, main promotion,
  release, deployment, runtime/database change, or cleanup work has started.
- A repository-wide architecture/duplication/security audit remains a future
  independent read-only Gate; this documentation synchronization is not that
  audit.
