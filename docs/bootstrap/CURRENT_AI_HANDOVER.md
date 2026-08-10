# Current AI Handover

Last verified reality check: 2026-08-10 (Asia/Taipei)

This is operational handover material. `CONSTITUTION.md`, accepted ADRs, and
Architecture Owner Decisions remain higher authority.

## 1. Project and repository

- Project: Desert Island Restaurant Operating System (ROS).
- Repository worktree:
  `C:\Users\user\Documents\荒島餐車 AI 營運資料庫\desert-island-ros-integration`.
- Architecture Owner: Miles / Lin Zi-Mao.
- Architecture: one Node.js modular monolith and one SQLite database with
  exclusive Catalog, Canonical Ingredient, Measurement, Recipe, Operations,
  and Cost authorities.
- Legacy remains separate and was not modified.

## 2. Baseline identities

| Identity | SHA | Meaning |
| --- | --- | --- |
| Owner-Accepted Architecture Development Baseline | `97d6c7b52f09643b2cafaa50711f76ccc1ae7a96` | Reviewed development capability through completed PR-INGREDIENT-003B / PR #18 |
| Current remote integration Head after PR #19 | `58cce2327f3f7121442e8a0cd4cd29693b9fde3c` | Later documentation-only Git advancement containing the closeout Task Card |
| Current documentation branch base | `58cce2327f3f7121442e8a0cd4cd29693b9fde3c` | Exact starting point for the 14-file closeout candidate |

PR #19 does not redesignate the formal baseline. Neither identity means remote
`main`, main promotion, deployment provenance, a running process, a production
database, or a formal product release.

## 3. Current Git reality

- Current branch:
  `docs/post-pr18-ingredient-003b-governance-closeout`.
- Remote `integration/architecture-development`:
  `58cce2327f3f7121442e8a0cd4cd29693b9fde3c`.
- Remote `main`: does not exist.
- Local `main`: unpromoted at
  `2616fc86f5b1e81ba33ea05c71b561a8f0210e36`.
- `origin/HEAD`: observed pointing to `origin/feature/pr-measure-001` at
  `8b80e9723d55c1e6dc0e30a6c83cb9e52effe20e`; it was not changed.
- PR #14 through PR #19 feature/documentation branches remain remotely
  available and are contained in integration. Containment does not authorize
  deletion.
- No branch or worktree cleanup is authorized by this handover.

See [Repository Status](../REPOSITORY_STATUS.md) and
[Active Branches](../ACTIVE_BRANCHES.md) for the dated inventory.

## 4. Governance closeout chronology

- Recipe 001A and 001B are completed and merged. Recipe 001C through 001E
  remain unauthorized.
- COST-REGRESSION-001 is completed and closed by PR #11. PR #13 completed the
  associated post-PR11 documentation synchronization.
- PR #14 recorded the Owner-accepted Canonical Ingredient lifecycle Proposal.
- PR #15 recorded the Owner-approved PR-INGREDIENT-003A Task Card.
- PR #16 completed the synchronous Rename/Archive command boundary.
- PR #17 recorded the Owner-approved PR-INGREDIENT-003B Task Card.
- PR #18 completed deterministic management reads, SQLite persistence, server
  composition, and management API support.
- PR #19 recorded only the post-PR18 Ingredient 003B governance closeout Task
  Card.
- The current 14-file closeout candidate is documentation-only and has no
  commit, push, PR, or merge authority until its separate Gates pass.

The [Ingredient 003B Closeout Record](../reviews/PR-INGREDIENT-003B_CLOSEOUT_RECORD.md)
contains the detailed authority, finding, remediation, test, and merge history.

This closeout creates no DECISIONS number and does not rewrite DECISIONS #069,
the Ingredient Proposal, or either historical Task Card.

## 5. Canonical Ingredient capability and boundaries

The current integration ancestry contains:

- immutable `ing_<uuid>` identity;
- `Active -> Archived` lifecycle only;
- append-only Rename and Archive evidence;
- synchronous Rename/Archive Application commands with version-first
  precedence;
- non-blocking duplicate-candidate warnings;
- Active and Archived management reads with deterministic ordering;
- SQLite persistence and restart/rehydration coverage;
- management list, detail, Rename, and Archive APIs; and
- Architecture Guards protecting public exports, Repository boundaries,
  composition, and namespaces.

The management namespace is `/api/admin/canonical-ingredients`. Four route
registrations implement six behaviors: all-list, Active-list, Archived-list,
detail, Rename, and Archive. The existing `/api/admin/cost/ingredients` route
remains the Cost Back Office creation-composition endpoint only.

Caller-provided `actor`, `occurredAt`, and `reason` remain caller-reported,
unverified metadata. They are not authentication, authorization, or verified
operator identity.

Not authorized or implemented by 003A/003B:

- Ingredient 003C UI/navigation;
- Reference Impact Coordinator;
- reactivation;
- permanent deletion;
- Ingredient merge or automatic identity resolution;
- name uniqueness constraints;
- authentication or authorization; or
- Migration 014/schema redesign.

## 6. Protected records and migration

| Record | Protected blob |
| --- | --- |
| Ingredient Proposal | `35a41567b16a714e154162042fba1ee0f6d160d9` |
| PR-INGREDIENT-003A Task Card | `d678765982fa11e9921ab898dfc4d878bbcd7e10` |
| PR-INGREDIENT-003B Task Card | `9453d54b4ad0529c84c277f61ebb83efcae0c1ec` |
| Post-PR18 closeout Task Card | `5ef657585a80d3d0aaa23f8826e513940409a56d` |
| Migration 014 | `5bcc40cddfe9ba14db7dc6a5e8da2d46f41ee23d` |

These records remain unchanged. Migration files 001 through 017 are present.
PR #18 did not modify Migration 014 or schema.

## 7. Test evidence

Test collections overlap and must not be added into one total.

PR #16 approved-Head evidence includes focused 003A 14/14, Domain 21/21,
persistence 18/18, Architecture Guard 16/16, configured `npm test` 64/64,
compiled repository suite 35 files / 497/497, browser E2E 13/13, and passing
typecheck, lint, build, migration, verify, verify:full, and diff checks.

PR #18 approved-Head evidence includes Application 20/20, Catalog 21/21,
persistence 21/21, API 3/3, Architecture Guard 16/16, configured `npm test`
64/64, Playwright 13/13, compiled repository suite 36 files / 509/509, and
passing typecheck, lint, build, migration, verify, verify:full, and diff checks.

Post-merge verification for PR #16 and PR #18 verified Git parents, tree,
scope, seals, and remote integration state. It did not rerun the complete test
collections above. PR #19 was documentation-only and did not rerun product
tests. See [Test Plan](../09_TEST_PLAN.md).

## 8. Runtime observation and limitation

The only retained runtime statement is a historical, dated observation:

> Observation date: 2026-08-09. `127.0.0.1:3092/health` returned SQLite ready.
> The observed process was Node `dist/server/index.js`, PID 12252. The running
> worktree, Git SHA, SQLite path, and deployment provenance were not
> independently established.

PID 12252 is not asserted to remain active. No public Tunnel is asserted to be
active. This observation does not identify either current Git SHA as deployed.

## 9. Current documentation Gate

The current closeout candidate may modify exactly 13 existing documentation
files and create `docs/reviews/PR-INGREDIENT-003B_CLOSEOUT_RECORD.md`.

At handover time it is authorized only through preparation and the
Documentation Pre-Commit Gate. Staging, commit, push, PR creation, review,
merge, and post-merge actions remain separate Gates.

## 10. Unauthorized next work

- Ingredient 003C;
- Recipe 001C through 001E;
- Reference Impact implementation;
- architecture, duplication, or security remediation;
- branch or worktree cleanup;
- remote `main` creation or `origin/HEAD` remediation;
- main promotion;
- release; and
- deployment.

Completion of this documentation closeout does not automatically authorize a
next product or implementation PR.
