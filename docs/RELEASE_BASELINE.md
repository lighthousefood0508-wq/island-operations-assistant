# ROS Architecture Development Baseline

Governance basis: DECISIONS #055, #058, #059, #064, #065, and #066.

Last reviewed: 2026-07-31

## Current approved baseline

```text
Branch lineage:                  integration/architecture-development
Accepted implementation SHA:    bec41bb89185c0261c1375b62b1be91e4e2b00df
Governance acceptance commit:   ccc415832b3a21bfdbf1accdb4bd088f69c8b479
Governance commit parent:       bec41bb89185c0261c1375b62b1be91e4e2b00df
Current integration HEAD before this correction:
                                ccc415832b3a21bfdbf1accdb4bd088f69c8b479
```

**This is the current approved Architecture Development Baseline.**

The accepted implementation tree at `bec41bb89185c0261c1375b62b1be91e4e2b00df` contains the completed and independently audited Measurement foundation, PR-COST-004R Recipe Cost Evaluation, and Cost Back Office vertical slice. Its accepted linear ancestry is:

```text
8b80e9723d55c1e6dc0e30a6c83cb9e52effe20e
    -> 7809e8555c58c9ae5d11498361ac88360890f4e4
    -> bec41bb89185c0261c1375b62b1be91e4e2b00df
```

Governance-only commit `ccc415832b3a21bfdbf1accdb4bd088f69c8b479` records Decision #066's acceptance of that implementation tree. The accepted implementation identity remains `bec41bb89185c0261c1375b62b1be91e4e2b00df` even when the integration branch advances through separately reviewed governance commits.

Neither commit is a production release, deployment approval, deployment-verified version, operational deployment record, or `main` promotion.

## Status of main and remote default

- Local `main` remains unpromoted at `2616fc86f5b1e81ba33ea05c71b561a8f0210e36`.
- Remote `main` does not exist.
- `origin/HEAD` remains `origin/feature/pr-measure-001` and has not been adjusted.
- No remote default branch or release state is changed by this document.

`main` may be updated only after a separate Main Release Gate and explicit Architecture Owner promotion authorization. Technical ancestry or fast-forward capability does not provide that authority.

Items 1 through 4 and item 6 below are restored from this file at parent commit `bec41bb89185c0261c1375b62b1be91e4e2b00df`. Item 5 records the independent-Gate requirement in the Owner-authorized identity correction. None is marked complete by this correction:

1. the original dirty worktree has a reviewed recovery record;
2. required historical work has been preserved or rebuilt;
3. repository and product regression verification passes;
4. runtime and database backup/readiness checks pass where applicable;
5. the applicable independent Gate evidence has been reviewed; and
6. the Architecture Owner explicitly approves the Release Gate and promotion.

## Use of this baseline

- Future authorized proposals and implementation work start from the then-current Owner-verified HEAD of `integration/architecture-development`. That HEAD must contain governance acceptance commit `ccc415832b3a21bfdbf1accdb4bd088f69c8b479`; work must not start directly from `bec41bb89185c0261c1375b62b1be91e4e2b00df` and skip Decision #066.
- The implementation tree at `bec41bb89185c0261c1375b62b1be91e4e2b00df` remains the traceable accepted implementation identity.
- New work uses a separately authorized clean branch and worktree.
- Completed feature branches remain retained for traceability; they are not the formal baseline and are not deleted by this status update.
- A dirty or recovery worktree is never a valid baseline.
- Dependent work still requires its own Proposal, Authorization, Implementation, Audit, and Git-action gates.

This document does not authorize a feature, release, deployment, merge, branch deletion, remote-default change, or `main` promotion.
