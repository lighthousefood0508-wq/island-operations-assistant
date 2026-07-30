# ROS Architecture Development Baseline

Approval record: DECISION #055 — PR-REPO-001 Repository Control Recovery.

Last reviewed: 2026-07-30

## Current approved baseline

```text
Branch: feature/pr-measure-001
HEAD:   e10dd23
```

**This is the current Architecture Development Baseline.**

Commit `e10dd23` is not a production release, a deployment-verified version, or an operational deployment record. It is the approved Architecture Development Baseline for future proposal and implementation work.

It contains:

- DECISION #053 in its ancestry;
- Measurement Foundation v1;
- the approved PR-MEASURE-001 implementation;
- the completed read-only Owner audit; and
- 195 of 195 passing relevant tests at approval time.

## Status of main

`main` is **not yet promoted**.

At the last repository audit:

- local `main` pointed to `2616fc8`;
- `main` was an ancestor of `e10dd23`;
- `main` was 69 commits behind `e10dd23`;
- no remote default branch was configured; and
- a fast-forward was technically possible but had not passed a Release Gate.

The fact that a fast-forward is technically possible is not promotion authority.

`main` may be updated only after:

1. the original dirty worktree has a reviewed recovery record;
2. required historical work has been preserved or rebuilt;
3. repository and product regression verification passes;
4. runtime and database backup/readiness checks pass where applicable; and
5. the Architecture Owner explicitly approves the Release Gate and promotion.

## Use of this baseline

- New PR proposals use `e10dd23` as their evidence baseline.
- New implementation work starts from `e10dd23` or the official integration branch pointing to it.
- A dirty worktree is never a valid baseline.
- PR-COST-004 changes from the recovery worktree must not be copied wholesale.
- Dependent work must follow the sequence recorded in `docs/REPOSITORY_STATUS.md`.

This document does not merge, rename, or promote any branch.
