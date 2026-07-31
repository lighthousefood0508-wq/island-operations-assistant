# ROS Architecture Development Baseline

Governance basis: DECISIONS #055, #058, and #059. Baseline synchronization approved by the Architecture Owner.

Last reviewed: 2026-07-31

## Current approved baseline

```text
Branch: feature/pr-measure-001
HEAD:   261b8dd4d3b0761c22ef4a3c9ef39ae94040bdd2
```

**This is the current Architecture Development Baseline.**

Commit `261b8dd4d3b0761c22ef4a3c9ef39ae94040bdd2` is not a production release, a deployment-verified version, or an operational deployment record. It is the approved Architecture Development Baseline for subsequent Owner-approved work.

It contains:

- DECISIONS #053, #055, #056, #057, #058, and #059 in its ancestry;
- Measurement Foundation v1;
- Ingredient Measurement Profile;
- the approved PR-MEASURE-001 and PR-MEASURE-002 implementations;
- Canonical Ingredient Domain Foundation;
- Canonical Ingredient SQLite Persistence;
- the completed implementation and focused audits for those capabilities; and
- the safely committed and remotely backed-up Ingredient persistence implementation at `261b8dd`.

## Status of main

`main` is **not yet promoted**.

At the repository recovery audit:

- local `main` pointed to `2616fc8`;
- `main` was an ancestor of the then-current baseline;
- `main` was behind that baseline;
- no remote default branch was configured; and
- a fast-forward was technically possible but had not passed a Release Gate.

The feature branch is now backed up at `origin/feature/pr-measure-001`. This does not promote or push `main`.

The fact that a fast-forward is technically possible is not promotion authority.

`main` may be updated only after:

1. the original dirty worktree has a reviewed recovery record;
2. required historical work has been preserved or rebuilt;
3. repository and product regression verification passes;
4. runtime and database backup/readiness checks pass where applicable; and
5. the Architecture Owner explicitly approves the Release Gate and promotion.

## Use of this baseline

- New PR proposals use `261b8dd4d3b0761c22ef4a3c9ef39ae94040bdd2` as their evidence baseline.
- New implementation work starts from that commit or an official integration branch pointing to it.
- New feature work uses a clean branch and worktree; no additional feature work is added to `feature/pr-measure-001`.
- A dirty worktree is never a valid baseline.
- PR-COST-004 changes from the recovery worktree must not be copied wholesale.
- Dependent work must follow the sequence recorded in `docs/REPOSITORY_STATUS.md`.

This document does not merge, rename, or promote any branch.
