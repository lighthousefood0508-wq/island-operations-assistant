# ROS Repository Policy

Governance basis: DECISIONS #055, #058, #059, #064, #065, and #066.

Status: Approved repository working policy.

This policy supplements `docs/REPOSITORY_WORKING_GUIDE.md`. It does not grant feature, architecture, migration, integration, cleanup, merge, or release authority.

## 1. Future PR Baseline Policy

1. Future authorized work starts from the then-current Owner-verified HEAD of `integration/architecture-development`, or from a later explicitly approved Architecture Development Baseline branch.
2. That starting HEAD must contain governance acceptance commit `ccc415832b3a21bfdbf1accdb4bd088f69c8b479`. New work must not start directly from `bec41bb89185c0261c1375b62b1be91e4e2b00df` and skip Decision #066.
3. Commit `bec41bb89185c0261c1375b62b1be91e4e2b00df` remains the accepted implementation tree identity for the completed Measurement, PR-COST-004R, and Cost Back Office implementation.
4. Commit `ccc415832b3a21bfdbf1accdb4bd088f69c8b479`, whose parent is `bec41bb89185c0261c1375b62b1be91e4e2b00df`, is the governance-only commit that records Decision #066. It is the current integration HEAD before this correction draft, not a permanent fixed starting SHA for all future work.
5. `integration/architecture-development` is the current formal baseline branch. Completed feature branches are retained for traceability but are not development baselines.
6. A later accepted implementation tree or formal baseline branch replaces these identities only after Architecture Owner approval is recorded.
7. A roadmap entry, completed proposal, local patch, or dirty worktree does not establish a baseline.
8. Direct feature development on `main` is prohibited.
9. `main` is updated only after an explicit, independent Release Gate and Architecture Owner promotion authorization.

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
7. Every Owner Task Card has one explicit purpose; completing one Gate does not authorize the next Gate.
8. Owner approval must identify the allowed branch, baseline, file allowlist, verification, and Git action.
9. Independent audit is required when the applicable Owner Task Card defines it; an implementation or self-review report cannot substitute for that audit.

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

When an Owner Task Card requires fast-forward-only integration, the integration must prove ancestry, create no merge commit, and stop instead of substituting merge, rebase, cherry-pick, or force push. No branch is integrated merely because it is reachable or clean.

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
Recipe Management 001A and 001B
(COMPLETED)
        |
        v
Post-PR7 Governance Synchronization
(COMPLETED)
        |
        v
COST-REGRESSION-001 Task Card and Implementation
(COMPLETED; PR #10 AND PR #11)
        |
        v
Post-PR11 Phase A Task Card Recording
(COMPLETED; PR #12)
        |
        v
Post-PR11 Phase B Documentation Synchronization
(COMPLETED; PR #13)
        |
        v
Ingredient Proposal Recording
(COMPLETED; PR #14)
        |
        v
PR-INGREDIENT-003A Task Card and Implementation
(COMPLETED; PR #15 AND PR #16)
        |
        v
PR-INGREDIENT-003B Task Card and Implementation
(COMPLETED; PR #17 AND PR #18)
        |
        v
Post-PR18 Ingredient 003B Closeout Task Card
(COMPLETED; PR #19)
        |
        v
Post-PR18 Ingredient 003B Documentation Closeout
(IN PROGRESS; PRE-COMMIT GATE)
        |
        v
Owner Product-Planning Decision
(PENDING / NOT AUTOMATICALLY AUTHORIZED)
```

The Owner-Accepted Architecture Development Baseline is
`97d6c7b52f09643b2cafaa50711f76ccc1ae7a96`; the current integration Git Head
is the documentation-only PR #19 merge
`58cce2327f3f7121442e8a0cd4cd29693b9fde3c`. Ingredient 003A and 003B are
completed. This status sequence does not authorize Ingredient 003C, Recipe
001C through 001E, release, deployment, cleanup, or `main` promotion.
Architecture Owner review remains required at every applicable Gate.
