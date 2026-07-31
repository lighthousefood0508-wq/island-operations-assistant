# ROS Repository Status

Approval record: DECISIONS #055 and #058.

Last reviewed: 2026-07-31

## Current recommended development baseline

The current Architecture Development Baseline is:

- Branch: `feature/pr-measure-001`
- Commit: `354bda24547b467f14ad4455dc4daa969ca2812b`
- Baseline commit state: clean, reviewed, approved, and committed
- Included authority: Measurement Foundation v1, Ingredient Measurement Profile, and governance ancestry through DECISIONS #057
- Remote backup: `origin/feature/pr-measure-001` points to the approved baseline

The baseline statement above describes commit `354bda24547b467f14ad4455dc4daa969ca2812b`. The original 40-file dirty recovery worktree is separate and remains untouched.

`main` has not been promoted to this baseline. New feature proposals and approved feature work must start from `354bda24547b467f14ad4455dc4daa969ca2812b`, or from an official integration branch pointing to it.

## Repository health

| Area | Status | Explanation |
|---|---|---|
| Architecture baseline | Healthy | Commit `354bda2` is the Owner-approved Architecture Development Baseline. |
| Measurement Foundation | Completed | PR-MEASURE-001 is safely committed. |
| Ingredient Measurement Profile | Completed | PR-MEASURE-002 is audited, safely committed, and pushed on the feature branch. |
| Current development worktree | Healthy | Governance synchronization is isolated from production and feature implementation. |
| `main` | Outdated, not broken | It has not passed a Release Gate for promotion. |
| Original development worktree | Recovery required | It contains 40 mixed, unstaged changes and must not be used as a PR baseline. |
| PR-COST-004 | Blocked | It must be rebuilt as PR-COST-004R after the Measurement prerequisites in DECISION #053. |
| PR-INGREDIENT-001 | Governance approved | DECISIONS #058 authorizes the bounded Canonical Ingredient Catalog Foundation after this governance synchronization is safely committed. |
| Governance documents | Synchronized | Current authority and baseline documents reflect the completed Measurement work and DECISIONS #058. |
| Remote backup | Verified | `origin/feature/pr-measure-001` points to the approved baseline. |

## Active worktrees

| Folder | Branch / state | Purpose | Classification | Next action |
|---|---|---|---|---|
| `desert-island-ros-pr-measure-001` | `feature/pr-measure-001` at `354bda2`; clean before DECISIONS #058 synchronization | Approved architecture baseline and current governance worktree | KEEP ACTIVE | Safely commit DECISIONS #058 synchronization, verify clean state, then begin PR-INGREDIENT-001 only under its exact allowlist. |
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

- `feature/pr-measure-001`: approved baseline at `354bda2`.
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
        |
        v
Canonical Ingredient Catalog Foundation
        |
        v
Recipe Canonical Projection
        |
        v
Quote Normalization Evidence
        |
        v
Recipe Costing Contract v2
        |
        v
PR-COST-004R
```

PR-COST-004R remains blocked until the preceding Measurement and contract gates are completed and approved.
