# ROS Branch and Worktree Observations

Reality check: 2026-08-09 (Asia/Taipei)

This document records only refs and worktrees actually observed. It assigns no
new governance, retention, evidence, cleanup, or deletion status. No branch or
worktree was modified by this inventory.

## Controlling integration identities

- Owner-Accepted Architecture Development Baseline:
  `1c31a31030e7c0d29181ebcc5355a706db95dc50`.
- Remote `integration/architecture-development` Head after PR #12:
  `20bca12ac7c2620ea2fc3c808bab035c9b5311fa`.
- Phase B documentation branch:
  `docs/docs-ros-post-pr11-001-phase-b`, created locally from exact Head
  `20bca12ac7c2620ea2fc3c808bab035c9b5311fa`.
- Remote `main`: not present.
- Local `main`: `2616fc86f5b1e81ba33ea05c71b561a8f0210e36`, unpromoted.
- `origin/HEAD`: observed pointing to `origin/feature/pr-measure-001` at
  `8b80e9723d55c1e6dc0e30a6c83cb9e52effe20e`. The pointer was not changed.

## Observed remote branches and containment

Containment below means only that the branch-tip commit was proven reachable
from `20bca12ac7c2620ea2fc3c808bab035c9b5311fa` using
`git merge-base --is-ancestor`. It does not authorize deletion or cleanup.

| Remote branch | Observed tip | Contained in current integration Head |
| --- | --- | --- |
| `origin/chore/main-gate-migration-upgrade-fixture` | `c3742bce3f3baf471c28bf479eba418172efc61c` | Yes |
| `origin/docs/cost-regression-001-task-card` | `c70d4bbfce77e6b0e0f11bd0e3c648552f5c419c` | Yes |
| `origin/docs/docs-ros-post-pr11-001` | `96ae03cb7b97e2c2bedeabb1323e780c80dbbb9e` | Yes |
| `origin/docs/ros-post-pr7-baseline-sync-001` | `bb44edbc78520dabd178ac5060dd6da913c60c93` | Yes |
| `origin/feature/cost-back-office` | `bec41bb89185c0261c1375b62b1be91e4e2b00df` | Yes |
| `origin/feature/pr-cost-004r` | `7809e8555c58c9ae5d11498361ac88360890f4e4` | Yes |
| `origin/feature/pr-measure-001` | `8b80e9723d55c1e6dc0e30a6c83cb9e52effe20e` | Yes |
| `origin/feature/pr-recipe-canonical-projection` | `3db30c115861443fb257451f93ff0d8bfa1264f1` | Yes |
| `origin/feature/pr-recipe-management-001a` | `773b129cc3b53fc6435c941b770f3953f7225c98` | Yes |
| `origin/feature/pr-recipe-management-001b` | `ab662a48c0bdfcf835d5c2af2ac002abba8d55a0` | Yes |
| `origin/feature/quote-normalization-evidence` | `e1859aa81c3eec07fb439fd74ca2508cd3159f66` | Yes |
| `origin/feature/recipe-costing-contract-v2` | `febfa4abea3e61748d7a3d0dc0c0f03bf811ace4` | Yes |
| `origin/fix/cost-regression-001-nested-sqlite-transactions` | `132789ccbbe65168aa79aa1888b1b3ec4424855d` | Yes |
| `origin/governance/canonical-ingredient-alignment` | `e3662d71e4ecccd039b817287e2c99355d3ef04a` | Yes |
| `origin/governance/recipe-management-001-proposal` | `8e081059b7569613587faa86854ce5fe94bfd06f` | Yes |
| `origin/governance/recipe-management-001a-task-card` | `22d1411a8b3dc5edf810c66948bec24d8c4fa957` | Yes |
| `origin/governance/recipe-management-001b-task-card` | `21f90c6e1273102d7dbdbe4d1791090b86c6d7d0` | Yes |
| `origin/governance/ros-post-pr7-documentation-task-card` | `70b6dab1159a3e8f10c951aca4a2992691cdf971` | Yes |
| `origin/integration/architecture-development` | `20bca12ac7c2620ea2fc3c808bab035c9b5311fa` | Yes |

The local Phase B branch has no remote branch. Push and Pull Request creation
remain separately gated.

## Worktrees actually observed

The following entries are the exact worktrees returned by
`git worktree list --porcelain` during the reality check. Detached entries are
reported as detached; no purpose or future disposition is inferred here.

| Observed folder | Branch/state | Observed HEAD |
| --- | --- | --- |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros` | `feature/catalog-category-auto-code` | `2e27f8f2db6596f35eb2137b7305887c4ac6b0a6` |
| `C:/Users/user/AppData/Local/Temp/ros-commit10-1a5089ead66c49a9aa36df7ce00b802a` | detached | `c2993815f6d510bf4af5a262f0fd8eee8c5f87c8` |
| `C:/Users/user/AppData/Local/Temp/ros-commit6-9ec439aa00c94b47b1013adb427eebeb` | detached | `cf3e0d44553078884afafbb798e9125d725f6a51` |
| `C:/Users/user/AppData/Local/Temp/ros-commit6-retry-40ef5b25e2854ab59d867f58776f6112` | detached | `4c7a78b5b244ff0f288858053964d5a85a33924a` |
| `C:/Users/user/AppData/Local/Temp/ros-commit7-aa724ba044fd44a59a223c1999365480` | detached | `7938366f79050476391ee42888e49fb9107b1f73` |
| `C:/Users/user/AppData/Local/Temp/ros-commit8-61c27c0e46ac43dcaae7a94075cb030d` | detached | `ea2b2c163b8477b95d47f16099207f75768dd4e6` |
| `C:/Users/user/AppData/Local/Temp/ros-commit9-dbd23d2f31f447908013befaa9113371` | detached | `444efe1b53409452180e172ef063dc6cb12bad7f` |
| `C:/Users/user/AppData/Local/Temp/ros-staged-e2e-current` | detached | `386787f9bf9ad3f5964a100e76be38c018465923` |
| `C:/Users/user/AppData/Local/Temp/ros-staged-e2e-current-2` | detached | `7696fcb13ca67db140c6cfc775fcaef2d6e45369` |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-cost-back-office` | `feature/cost-back-office` | `bec41bb89185c0261c1375b62b1be91e4e2b00df` |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-governance-ingredient` | `governance/canonical-ingredient-alignment` | `e3662d71e4ecccd039b817287e2c99355d3ef04a` |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-integration` | `docs/docs-ros-post-pr11-001-phase-b` | `20bca12ac7c2620ea2fc3c808bab035c9b5311fa` before Phase B documentation edits |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-main-gate-upgrade` | `chore/main-gate-migration-upgrade-fixture` | `c3742bce3f3baf471c28bf479eba418172efc61c` |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-pr-cost-004r` | `feature/pr-cost-004r` | `7809e8555c58c9ae5d11498361ac88360890f4e4` |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-pr-measure-001` | `feature/pr-measure-001` | `8b80e9723d55c1e6dc0e30a6c83cb9e52effe20e` |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-pr-recipe-canonical-projection` | `feature/pr-recipe-canonical-projection` | `3db30c115861443fb257451f93ff0d8bfa1264f1` |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-quote-normalization-evidence` | `feature/quote-normalization-evidence` | `e1859aa81c3eec07fb439fd74ca2508cd3159f66` |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-realtime-fix` | `fix/realtime-heartbeat-last-event` | `dfd5f294aa65bb9ac89bd630c0e1f72cc918de58` |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-recipe-costing-contract-v2` | `feature/recipe-costing-contract-v2` | `febfa4abea3e61748d7a3d0dc0c0f03bf811ace4` |

## Task boundary

Record only worktrees actually observed during the verified reality check. Do
not delete, clean or otherwise modify any branch or worktree under this Task.
This Task assigns no new governance or evidence status to any listed entry.
