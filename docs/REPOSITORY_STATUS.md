# ROS Repository Status

Governance basis: DECISIONS #055, #058, #059, #064, #065, and #066.

Last reviewed: 2026-07-31

## Current recommended development baseline

The current approved Architecture Development Baseline is:

- Branch: `integration/architecture-development`
- Commit: `bec41bb89185c0261c1375b62b1be91e4e2b00df`
- Local and remote integration heads: synchronized at the same commit, ahead/behind `0/0`
- Included milestones: completed Measurement foundation, PR-COST-004R, and Cost Back Office
- Integration history: 15 linear commits after `8b80e9723d55c1e6dc0e30a6c83cb9e52effe20e`, with no merge or integration-only commit

The integration worktree was clean before this five-document governance draft. During Owner review, only the five authorized governance files are modified. No production, test, migration, runtime, package, or configuration file is modified. The original recovery worktree remains separate and untouched.

This is a development baseline only. Remote `main` does not exist; local `main` remains unpromoted at `2616fc86f5b1e81ba33ea05c71b561a8f0210e36`; and `origin/HEAD` remains `origin/feature/pr-measure-001`.

## Repository health

| Area | Status | Explanation |
|---|---|---|
| Architecture baseline | Healthy | `integration/architecture-development` points to `bec41bb89185c0261c1375b62b1be91e4e2b00df` locally and remotely. |
| Measurement Foundation | Completed and contained | Measurement Foundation and Ingredient Measurement Profile are contained in the integration baseline. |
| PR-COST-004R | Completed and contained | Implementation, targeted correction, independent audit, and integration audit passed. |
| Cost Back Office | Completed and contained | Implementation, Quote replacement correction, Owner audit, and final integration audit passed. |
| Current integration worktree | Governance draft review | Clean before this task; only the five authorized governance documents are modified for Owner review. |
| Local `main` | Not promoted | It remains at `2616fc86f5b1e81ba33ea05c71b561a8f0210e36`; Main Release Gate has not started. |
| Remote `main` | Does not exist | No remote release branch has been created or promoted. |
| `origin/HEAD` | Unchanged | It still points to `origin/feature/pr-measure-001`. |
| Original development worktree | Recovery required | It contains 40 mixed, unstaged changes and must not be used as a PR baseline. |
| Governance status | Update in progress | This five-document draft synchronizes the accepted integration state. Independent Governance Audit is next. |
| Main Release Gate | Not started | This status update grants no release, deployment, or promotion authority. |

## Active worktrees

| Folder | Branch / state | Purpose | Classification | Next action |
|---|---|---|---|---|
| `desert-island-ros-integration` | `integration/architecture-development` at `bec41bb89185c0261c1375b62b1be91e4e2b00df`; clean before this draft | Formal Architecture Development Integration Baseline and governance status worktree | KEEP ACTIVE FOR BASELINE | Complete Owner draft review, Commit Gate, and Independent Governance Audit. |
| `desert-island-ros-pr-measure-001` | `feature/pr-measure-001` at `8b80e9723d55c1e6dc0e30a6c83cb9e52effe20e`; clean | Completed Measurement feature line retained for traceability | COMPLETED / CONTAINED | Preserve; do not use as the formal baseline or add new development. |
| `desert-island-ros-pr-cost-004r` | `feature/pr-cost-004r` at `7809e8555c58c9ae5d11498361ac88360890f4e4`; clean | Completed PR-COST-004R feature line retained for traceability | COMPLETED / CONTAINED | Preserve pending later cleanup authorization. |
| `desert-island-ros-cost-back-office` | `feature/cost-back-office` at `bec41bb89185c0261c1375b62b1be91e4e2b00df`; clean | Completed Cost Back Office feature line retained for traceability | COMPLETED / CONTAINED | Preserve pending later cleanup authorization. |
| `desert-island-ros` | `feature/catalog-category-auto-code` at `2e27f8f`, dirty | Recovery source for 40 mixed changes | KEEP FOR RECOVERY | Preserve unchanged; recover work by workstream into clean branches. |
| `ros-commit10-*` | detached `c299381`, clean | Historical staged snapshot | REVIEW BEFORE DELETE | Confirm its equivalent patch is retained, then request removal approval. |
| `ros-commit6-*` | detached `cf3e0d4`, clean | Older POS/E2E snapshot variant | REVIEW BEFORE DELETE | Compare with the accepted retry before removal. |
| `ros-commit6-retry-*` | detached `4c7a78b`, clean | Retry snapshot whose patch is already represented | LIKELY SAFE TO DELETE LATER | Remove only after recovery confirmation and Owner approval. |
| `ros-commit7-*` | detached `7938366`, clean | Historical POS/Kitchen/E2E snapshot | LIKELY SAFE TO DELETE LATER | Same as above. |
| `ros-commit8-*` | detached `ea2b2c1`, clean | Historical POS/E2E snapshot | LIKELY SAFE TO DELETE LATER | Same as above. |
| `ros-commit9-*` | detached `444efe1`, clean | Historical Kitchen/E2E snapshot | LIKELY SAFE TO DELETE LATER | Same as above. |
| `ros-staged-e2e-current` | detached `386787f`, clean | Older E2E snapshot variant | REVIEW BEFORE DELETE | Compare against the accepted second snapshot. |
| `ros-staged-e2e-current-2` | detached `7696fcb`, clean | E2E snapshot whose patch is already represented | LIKELY SAFE TO DELETE LATER | Remove only after Owner approval. |

No worktree may be removed under DECISION #055. This document records status only.

## Active branches

The branches requiring current attention are:

- `integration/architecture-development`: the only active formal Architecture Development Baseline at `bec41bb89185c0261c1375b62b1be91e4e2b00df`.
- `feature/pr-measure-001`, `feature/pr-cost-004r`, and `feature/cost-back-office`: completed feature lines contained in the integration baseline and retained for traceability.
- `feature/catalog-category-auto-code`: frozen recovery carrier because its worktree is dirty.
- `main`: protected release branch; not yet promoted.
- `audit/phase-a-pos-ui-restoration`: retains unique historical audit documents.
- `design/legacy-feature-parity-matrix`: retains unique legacy planning documents, also contained by the audit branch above.

Detailed status is recorded in `docs/ACTIVE_BRANCHES.md`.

## Historical branches

All other named local feature, design, remediation, audit, and test branches reviewed under PR-REPO-001 are already contained in `e10dd23`. They remain historical references until a separately approved cleanup confirms:

1. the baseline is stable;
2. no worktree uses the branch;
3. no unique commit remains;
4. recovery evidence exists; and
5. the Owner authorizes deletion.

## Dirty recovery worktree

The original worktree contains 40 unstaged changes across:

- governance and handover documentation;
- the blocked PR-COST-004 implementation;
- repeated Recipe Ingredient Line behavior;
- Architecture Guard synchronization;
- Operations documentation;
- Kitchen, POS, and Voice changes;
- Exact Numeric Policy; and
- ADR-019.

Rules for this worktree:

- do not reset, restore, clean, stash, rebase, or bulk-commit it;
- do not start another PR from it;
- preserve all content until it has been classified and backed up;
- recreate approved work from the current approved baseline in separate clean branches;
- treat PR-COST-004 as design and test recovery material, not merge-ready implementation.

## Current development roadmap

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

No feature implementation or `main` promotion is authorized by this roadmap status.
