# ROS Architecture Development Baseline

Governance basis: DECISIONS #055, #058, #059, #064, #065, and #066.

Last reviewed: 2026-07-31

## Current approved baseline

```text
Branch: integration/architecture-development
HEAD:   bec41bb89185c0261c1375b62b1be91e4e2b00df
```

**This is the current approved Architecture Development Baseline.**

The baseline contains the completed and independently audited Measurement foundation, PR-COST-004R Recipe Cost Evaluation, and Cost Back Office vertical slice. Its accepted linear ancestry is:

```text
8b80e9723d55c1e6dc0e30a6c83cb9e52effe20e
    -> 7809e8555c58c9ae5d11498361ac88360890f4e4
    -> bec41bb89185c0261c1375b62b1be91e4e2b00df
```

Commit `bec41bb89185c0261c1375b62b1be91e4e2b00df` is not a production release, deployment approval, deployment-verified version, operational deployment record, or `main` promotion. It is the common starting point for later Owner-authorized architecture development.

## Status of main and remote default

- Local `main` remains unpromoted at `2616fc86f5b1e81ba33ea05c71b561a8f0210e36`.
- Remote `main` does not exist.
- `origin/HEAD` remains `origin/feature/pr-measure-001` and has not been adjusted.
- No remote default branch or release state is changed by this document.

`main` may be updated only after a separate Main Release Gate and explicit Architecture Owner promotion authorization. Technical ancestry or fast-forward capability does not provide that authority.

## Use of this baseline

- Future authorized proposals and implementation work use `integration/architecture-development` at `bec41bb89185c0261c1375b62b1be91e4e2b00df`, or a later explicitly approved baseline.
- New work uses a separately authorized clean branch and worktree.
- Completed feature branches remain retained for traceability; they are not the formal baseline and are not deleted by this status update.
- A dirty or recovery worktree is never a valid baseline.
- Dependent work still requires its own Proposal, Authorization, Implementation, Audit, and Git-action gates.

This document does not authorize a feature, release, deployment, merge, branch deletion, remote-default change, or `main` promotion.
