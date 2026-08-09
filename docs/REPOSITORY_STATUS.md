# ROS Repository Status

Last verified: 2026-08-09 (Asia/Taipei)

Governance basis: DECISIONS #055, #058, #059, #064, #065, #066,
#069, and #070.

## Status summary

| Area | Verified state |
| --- | --- |
| Owner-Accepted Architecture Development Baseline | `6128f8e853b9ac96e2d6870b3a97ffde9d0bf5d7` |
| Remote integration Head after PR #8 | `b107c6c7a4a2caca25bd46b138bd8baebbd97c1b` |
| Documentation execution branch | `docs/ros-post-pr7-baseline-sync-001`, based exactly on `b107c6c...` |
| Recipe 001A | Completed, independently reviewed, merged by PR #5 |
| Recipe 001B | Completed after remediation and three independent review rounds, merged by PR #7 |
| Recipe 001C-001E | Unauthorized; not started |
| Cost Back Office | Source contained in development integration; not formally released or deployment-verified; current all-file diagnostics expose four Cost integration failures |
| Migrations | Files 001 through 017 present |
| Remote `main` | Does not exist |
| Local `main` | Unpromoted at `2616fc86f5b1e81ba33ea05c71b561a8f0210e36` |
| `origin/HEAD` | Observed abnormal pointer to `origin/feature/pr-measure-001`; unchanged |
| Main promotion / deployment / release | Not authorized; not started |
| Cleanup | Not authorized; not performed |

## Baseline identity

The Owner-Accepted Architecture Development Baseline and current integration
Head are deliberately distinct:

- `6128f8e853b9ac96e2d6870b3a97ffde9d0bf5d7` identifies the accepted
  development capability through Recipe 001B.
- `b107c6c7a4a2caca25bd46b138bd8baebbd97c1b` is the later remote integration
  tip after PR #8 recorded the documentation synchronization Task Card.

Neither SHA identifies `main`, deployment provenance, or a product release.
The local `integration/architecture-development` ref was observed behind the
remote tip in this shared repository; exact remote SHA evidence controls this
documentation work. The local ref was not moved by this task.

## Recipe Management closeout

The retrospective record is [DECISIONS #070](DECISIONS.md). The independent
[Recipe Management Closeout Record](reviews/PR-RECIPE-MANAGEMENT-001_CLOSEOUT_RECORD.md)
contains the complete Proposal, 001A, 001B, remediation, review, and merge
chronology.

Verified merge chain:

```text
PR #3 Proposal merge     d9a1074a043d1232bcfd6f982a664c02e716fd54
PR #4 001A Task Card     c6a550b9e87f9a7cce27948e541808f2bb31ddaf
PR #5 001A implementation 7c6d4704f365ec5a79719321c170b8ca6a6cfff3
PR #6 001B Task Card     29e120096455e26f70dce291a5249e43026b3550
PR #7 001B implementation 6128f8e853b9ac96e2d6870b3a97ffde9d0bf5d7
PR #8 Documentation Task Card b107c6c7a4a2caca25bd46b138bd8baebbd97c1b
```

All six were verified as merged two-parent PR commits with the recorded PR Head
as second parent.

## Source and migration evidence

Contained Recipe 001A/001B source evidence includes:

- `src/domains/recipe/domain/recipe-aggregate.ts`
- `src/domains/recipe/domain/recipe-line.ts`
- `src/domains/recipe/persistence/recipe-persistence-mapper.ts`
- `src/domains/recipe/persistence/recipe-persistence-unit-of-work.ts`
- `src/domains/recipe/infrastructure/sqlite-recipe-repository.ts`
- `src/domains/recipe/infrastructure/sqlite-recipe-persistence-unit-of-work.ts`
- `migrations/017_recipe_persistence_line_identity_and_publication_uow.sql`

The repository contains migration files `001` through `017`. Migration 016 is
historical and remained unchanged during 001B; Migration 017 is the forward-only
Recipe persistence correction. Migration smoke and populated upgrade tests are
verification evidence only and do not prove a production database was upgraded.

## Verification status and open regression

Required documentation checks pass: Typecheck, Architecture Guard 16/16,
repository-configured `npm test` 64/64, fresh migrations 001-017, and populated
014-to-017 upgrade verification.

The configured `npm test` command does not include every repository test file.
The direct 34-file diagnostic fails four Cost integration cases in both default
and serial execution (466/470 pass). The affected paths are Cost Back Office
Recipe creation and Cost Quote replacement. Read-only diagnosis identifies
nested transaction calls against the shared adapter's manual
`BEGIN IMMEDIATE` implementation. See [Test Plan](09_TEST_PLAN.md).

This is an unresolved baseline regression. No source, test, transaction, or
architecture remediation is permitted by `DOCS-ROS-POST-PR7-001`, and none was
started. The finding prevents a claim that the current all-file repository suite
or Cost Back Office integration is green.

## Branch and worktree observations

Remote feature and governance branches were marked "contained" in
[Active Branches](ACTIVE_BRANCHES.md) only where `git merge-base --is-ancestor`
proved reachability from `b107c6c...`. Reachability does not authorize deletion.

The worktree list in that document contains only worktrees returned by
`git worktree list --porcelain` during the 2026-08-09 reality check. The list is
an observation, not a new retention, evidence, cleanup, or deletion
classification.

No branch or worktree was cleaned, deleted, moved, rebased, or otherwise
modified under this documentation task.

## Protected Ingredient Proposal

The only expected untracked file in this documentation worktree remains:

`docs/reviews/PR-INGREDIENT-003_CANONICAL_INGREDIENT_LIFECYCLE_APPLICATION_BOUNDARY_PROPOSAL.md`

- Raw SHA-1: `F1CB397736EE073A5C2FD74D895FA672FAF44582`
- Git blob SHA-1: `1d3180139712b6fcf2cc88fd6c8e0d04023e9925`

It is outside scope and provides no Ingredient implementation authority.

## Current documentation Gate

`DOCS-ROS-POST-PR7-001` permits only the exact documentation allowlist. It does
not permit commit, push, Pull Request creation, or merge. After the authorized
edits and verification, work stops at the Owner pre-commit review Gate.

A future repository-wide architecture/duplication/security audit remains a
separate read-only Gate. No audit or remediation result is implied here.
