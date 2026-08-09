# Current AI Handover

Last verified reality check: 2026-08-09 (Asia/Taipei)

This is operational handover material. `CONSTITUTION.md`, accepted ADRs, and
Architecture Owner Decisions remain higher authority.

## 1. Project and repository

- Project: Desert Island Restaurant Operating System (ROS).
- Repository worktree observed for this synchronization:
  `C:\Users\user\Documents\荒島餐車 AI 營運資料庫\desert-island-ros-integration`.
- Architecture Owner: Miles / Lin Zi-Mao.
- Architecture: one Node.js modular monolith and one SQLite database with
  exclusive Catalog, Canonical Ingredient, Measurement, Recipe, Operations,
  and Cost authorities.
- Legacy remains separate and was not modified.

## 2. Baseline identities

These identities have different meanings and must not be conflated:

| Identity | SHA | Meaning |
| --- | --- | --- |
| Owner-Accepted Architecture Development Baseline | `1c31a31030e7c0d29181ebcc5355a706db95dc50` | Reviewed integration/development capability through completed COST-REGRESSION-001 and PR #11 |
| Verified remote integration Head after PR #12 | `20bca12ac7c2620ea2fc3c808bab035c9b5311fa` | Current remote branch tip at this reality check; includes only the Phase A Task Card merge after the accepted baseline |
| Phase B documentation branch base | `20bca12ac7c2620ea2fc3c808bab035c9b5311fa` | Exact starting point for `DOCS-ROS-POST-PR11-001` Phase B |

Neither SHA means remote `main`, main promotion, deployment provenance, or a
formal product release.

## 3. Current Git reality

- Remote `integration/architecture-development`:
  `20bca12ac7c2620ea2fc3c808bab035c9b5311fa`.
- Phase B documentation branch:
  `docs/docs-ros-post-pr11-001-phase-b`, created from that exact SHA.
- Remote `main`: does not exist.
- Local `main`: unpromoted at
  `2616fc86f5b1e81ba33ea05c71b561a8f0210e36`.
- `origin/HEAD`: observed pointing to `origin/feature/pr-measure-001` at
  `8b80e9723d55c1e6dc0e30a6c83cb9e52effe20e`. This is an abnormal remote
  pointer observation, not baseline authority, and was not modified.
- No branch or worktree was deleted, cleaned, rebased, or assigned a new
  governance/evidence status by the documentation task.

See [Repository Status](../REPOSITORY_STATUS.md) and
[Active Branches](../ACTIVE_BRANCHES.md) for the verified inventory.

## 4. Governance closeout

- [DECISIONS #070](../DECISIONS.md) is a retrospective governance
  ratification and historical closeout record. It does not backdate a Decision
  number or expand prior scope.
- The [Recipe Management Closeout Record](../reviews/PR-RECIPE-MANAGEMENT-001_CLOSEOUT_RECORD.md)
  preserves the verified Proposal, 001A, and 001B chronology.
- Recipe 001A is completed, independently reviewed, and merged by PR #5.
- Recipe 001B is completed after two blocking remediation reviews and a third
  approving independent read-only review, then merged by PR #7.
- PR #8 recorded the documentation synchronization Task Card and is merged.
- PR #9 completed the post-PR7 documentation synchronization.
- PR #10 recorded the COST-REGRESSION-001 Task Card.
- PR #11 completed the nested SQLite transaction correction after an initial
  blocking review and authorized remediation; its Post-Merge Verification Gate
  is passed and closed.
- PR #12 recorded only the Phase A post-PR11 documentation Task Card. Phase B
  was not completed by that merge.
- Recipe 001C through 001E remain unauthorized.
- The historical Recipe Proposal and 001A/001B Task Cards remain unchanged.

## 5. Contained source capability

The current integration ancestry contains:

- Catalog, Event, Order, lifecycle, Kitchen, realtime, and Back Office
  capabilities already established by earlier accepted work;
- Measurement Foundation and Ingredient Measurement Profile capability;
- Canonical Ingredient Domain and SQLite persistence;
- Recipe canonical projection and Recipe Costing Contract v2;
- Cost Quote evidence, Cost Evaluation, and the Cost Back Office vertical
  slice; and
- Recipe 001A Domain corrections plus 001B forward-only persistence and
  publication Unit of Work.

Recipe 001A/001B source capability includes stable Recipe Line identity,
ordered repeated Ingredient Lines, terminal Draft abandonment, Migration 017,
durable persistence receipts, atomic persistence Unit-of-Work operations, and
fail-closed Published Version pointer validation.

This does not mean the formal Recipe management Application/API/UI workflow is
complete. The existing Cost Back Office single-request create-and-publish path
is not Recipe 001C through 001E.

Cost Back Office is contained in the development integration ancestry. It has
not been formally released or deployment-verified.

## 6. Migration state

The repository contains forward migrations `001` through `017`.

- `001` through `014`: existing Catalog, Operations, Order/lifecycle, runtime
  support, payment, Cost Quote, and Canonical Ingredient schema history.
- `015`: Ingredient Measurement Profile persistence.
- `016`: Recipe persistence baseline; immutable during Recipe 001B.
- `017`: forward-only Recipe Line identity, Family, abandonment, receipt, and
  publication Unit-of-Work persistence correction.

Migration smoke and populated migration-014 upgrade verification are required
for this documentation synchronization. Passing those commands is test
evidence, not production-database or deployment evidence.

## 7. Test evidence

Test results must remain grouped. Focused Recipe persistence, Unit of Work,
migration/transaction, Recipe Domain, Projection/Costing, Architecture Guard,
repository-configured regression, full repository, migration smoke, and
populated upgrade selections overlap and must not be added into one total.

The current verification commands and their scope are documented in
[Test Plan](../09_TEST_PLAN.md). The earlier 466/470 result and four failures
are retained as discovery evidence. PR #11 corrected them: independent PR-head
verification passed the direct 34-file selection 483/483 under default and
serial execution, and post-merge verification separately passed the adapter
16/16, original Cost regression 9/9, Architecture Guard 16/16, typecheck,
build and diff checks. These overlapping selections are not summed. See the
[Cost Regression Closeout Record](../reviews/PR-COST-REGRESSION-001_CLOSEOUT_RECORD.md).

## 8. Runtime observation and limitation

The only runtime statement permitted by the verified reality check is this
dated observation:

> Observation date: 2026-08-09. `127.0.0.1:3092/health` returned SQLite ready.
> The observed process was Node `dist/server/index.js`, PID 12252. The running
> worktree, Git SHA, SQLite path, and deployment provenance were not
> independently established.

PID 12252 is not asserted to remain active. No public Tunnel is asserted to be
active, `runtime/ROS_CURRENT_LINKS.txt` was absent at the observation, and the
observed process is not claimed to run either baseline SHA.

## 9. Protected Ingredient Proposal

The following file remains outside this documentation scope and must stay
untracked and unstaged:

`docs/reviews/PR-INGREDIENT-003_CANONICAL_INGREDIENT_LIFECYCLE_APPLICATION_BOUNDARY_PROPOSAL.md`

- Raw SHA-1: `F1CB397736EE073A5C2FD74D895FA672FAF44582`
- Git blob SHA-1: `1d3180139712b6fcf2cc88fd6c8e0d04023e9925`

Its presence does not authorize Ingredient lifecycle implementation.

## 10. Unauthorized and next gates

Not authorized or started:

- Recipe 001C through 001E;
- Ingredient lifecycle implementation;
- remote `main` creation or main promotion;
- deployment or product release;
- runtime/database mutation;
- branch or worktree cleanup; and
- architecture, duplication, or security remediation.

Phase B is authorized only through preparation and the pre-commit report. Stage,
commit, push, PR creation and merge each remain separately gated. A future repository-wide
architecture/duplication/security audit remains a separate read-only Gate and
must not be presented as completed by this synchronization.
