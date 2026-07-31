# ROS Repository Policy

Governance basis: DECISIONS #055, #058, #059, #064, #065, and #066.

Status: Approved repository working policy.

This policy supplements `docs/REPOSITORY_WORKING_GUIDE.md`. It does not grant feature, architecture, migration, integration, cleanup, merge, or release authority.

## 1. Future PR Baseline Policy

1. Future authorized work starts from branch `integration/architecture-development` at commit `bec41bb89185c0261c1375b62b1be91e4e2b00df`, or from a later explicitly approved Architecture Development Baseline.
2. `integration/architecture-development` is the current formal baseline branch. Completed feature branches are retained for traceability but are not development baselines.
3. A later baseline replaces `bec41bb89185c0261c1375b62b1be91e4e2b00df` only after Architecture Owner approval is recorded.
4. A roadmap entry, completed proposal, local patch, or dirty worktree does not establish a baseline.
5. Direct feature development on `main` is prohibited.
6. `main` is updated only after an explicit Release Gate approval.

## 2. Dirty Worktree Policy

1. No new PR starts from a dirty worktree.
2. Unrelated modified or untracked files are presumed to belong to another workstream.
3. Do not reset, restore, clean, stash, overwrite, or bulk-commit mixed work.
4. A dirty worktree used for recovery is frozen until its files are backed up and classified.
5. Valid work is recreated in a clean worktree from the approved baseline.
6. If an allowlisted file already contains another workstream, stop and request Owner review.

## 3. Worktree Policy

1. One worktree equals one workstream.
2. Mixed workstreams require an immediate Owner stop-and-review.
3. Small-team operating limit:
   - one official integration worktree;
   - no more than two active feature worktrees; and
   - one recovery worktree.
4. Detached worktrees are temporary recovery tools, not development baselines.
5. A worktree may be removed only when:
   - it is clean;
   - no unique unpreserved commit exists;
   - its branch or commit is recoverable;
   - no active review depends on it; and
   - the Owner explicitly authorizes removal.
6. Worktree folders must never be deleted manually as a substitute for Git worktree cleanup.

## 4. Branch Lifecycle

The branch lifecycle is:

```text
Proposed
  -> Owner Authorized
  -> Active
  -> Reviewed
  -> Safely Committed
  -> Integrated
  -> Historical
  -> Delete Candidate
  -> Owner-Approved Deletion
```

Rules:

1. Every branch has one responsibility and one identifiable workstream.
2. A dependent PR does not begin until its prerequisite is integrated into the approved baseline.
3. A feature branch must be proposed for integration promptly after Safe Commit and Owner approval.
4. Old branches may be deleted only after their commits are contained in the approved baseline and no worktree uses them.
5. Unique audit, design, recovery, or legal/governance evidence must be preserved before branch deletion.
6. Branch rename, deletion, merge, rebase, and cherry-pick require the applicable Owner authorization.

## 5. Cleanup Review Cadence

A repository cleanup review occurs:

- at the end of every milestone; or
- after every five completed PRs;

whichever occurs first.

The review covers:

- baseline and `main` distance;
- active and detached worktrees;
- branch reachability and unique commits;
- dirty or staged files;
- abandoned temporary artifacts;
- remote backup readiness; and
- the next development sequence.

No cleanup action is implied by the review.

## 6. Owner Approval Process

1. Architecture and repository authority is recorded with a Decision identifier.
2. Every PR report names its approval Decision.
3. Proposal, Owner authorization, implementation, and audit remain separate review gates.
4. Governance authorization is separate from feature implementation authorization.
5. Implementation completion is separate from Safe Commit authorization.
6. Safe Commit is separate from integration, push, cleanup, and release authorization.
7. Owner approval must identify the allowed branch, baseline, file allowlist, verification, and Git action.

## 7. Integration Sequence

The standard sequence is:

```text
Owner Decision
  -> Clean branch/worktree from approved baseline
  -> Exact allowlist
  -> Implementation
  -> Architecture Gate and tests
  -> Owner Review
  -> Safe Commit
  -> Commit audit
  -> Owner Integration Authorization
  -> Integration baseline verification
  -> Dependent PR may begin
```

Integration must:

- preserve Decision ancestry;
- avoid duplicate or hidden authority;
- leave unrelated recovery work untouched;
- keep one workstream per commit; and
- use non-destructive Git operations approved for that task.

## 8. Prevention of Mixed Work

To prevent another mixed 40-file worktree:

1. Create the clean feature worktree before the first edit.
2. Record its baseline and exact allowlist.
3. Stop when an unrelated change appears.
4. Do not begin the next PR in the current worktree.
5. Finish review, Safe Commit, and integration before starting dependent work.
6. Check `git status --short` before and after every task.
7. Never use bulk staging commands.

## 9. Human-Readable Status

The current repository state is recorded in:

- `docs/REPOSITORY_STATUS.md`
- `docs/RELEASE_BASELINE.md`
- `docs/ACTIVE_BRANCHES.md`

These documents are updated during repository cleanup review or when the approved baseline changes. They describe current status but do not themselves authorize implementation, integration, cleanup, or release.

## 10. Current Development Order

```text
Measurement Foundation
(COMPLETED)
        |
        v
Ingredient Measurement Profile
(COMPLETED)
        |
        v
Canonical Ingredient Domain and Persistence
(COMPLETED)
        |
        v
Recipe Canonical Projection
(COMPLETED)
        |
        v
Quote Normalization Evidence
(COMPLETED)
        |
        v
Recipe Costing Contract v2
(COMPLETED)
        |
        v
PR-COST-004R
(COMPLETED)
        |
        v
Cost Back Office
(COMPLETED)
        |
        v
Governance Status Update
(IN PROGRESS)
        |
        v
Independent Governance Audit
(PENDING)
        |
        v
Main Release Gate
(NOT STARTED)
```

This status sequence does not authorize a new implementation, release, deployment, or `main` promotion. Architecture Owner review remains required at every applicable Proposal, Authorization, Implementation, Audit, Safe Commit, Integration, and Release Gate.
