# ROS Branch and Worktree Observations

Historical inventory observation: 2026-08-12 (Asia/Taipei)

This document records only refs and worktrees actually observed. It assigns no
new governance, retention, evidence, cleanup, or deletion status. No branch or
worktree was deleted, rebased, moved, or cleaned by this inventory.

## Historical integration identities and live lookup policy

This inventory ends before the 003D, 003E, and 003F merges. Its SHAs and
containment results are dated historical observations only. Before acting on a
branch, PR, or integration baseline, obtain the live ref, ancestry,
ahead/behind, PR state, and checks from fresh Git/GitHub evidence.

- Owner-Accepted Architecture Development Baseline and remote
  `integration/architecture-development` Head after PR #23:
  `ea46678cbb955b7aeb093dc34525c52325af9cae`.
- Active documentation delivery branch:
  `docs/post-pr23-ingredient-003c-closeout`, created from exact Head
  `ea46678cbb955b7aeb093dc34525c52325af9cae`. This tracked inventory
  intentionally does not freeze its current remote tip or PR #24 Head: a commit
  carrying this file necessarily advances that identity. The live tip, PR state,
  and ahead/behind counts must be read from fresh Git and GitHub evidence.
- Remote `main`: not present.
- Local `main`: `2616fc86f5b1e81ba33ea05c71b561a8f0210e36`, unpromoted.
- `origin/HEAD`: observed pointing to `origin/feature/pr-measure-001` at
  `8b80e9723d55c1e6dc0e30a6c83cb9e52effe20e`. The pointer was not changed.

At this historical observation, the accepted baseline and integration Git Head
identified the same PR #23 merge. That did not make it `main`, release,
deployment, or runtime provenance.

## Observed remote branches and containment

Containment means only that the observed branch tip was reachable from the
historical integration identity
`ea46678cbb955b7aeb093dc34525c52325af9cae`. It does not authorize deletion or
cleanup. The table retains the earlier complete inventory and adds the refs
material to PR #23; omission of another branch is not deletion authority.

| Remote branch | Observed tip | Contained |
| --- | --- | --- |
| `origin/chore/main-gate-migration-upgrade-fixture` | `c3742bce3f3baf471c28bf479eba418172efc61c` | Yes |
| `origin/docs/cost-regression-001-task-card` | `c70d4bbfce77e6b0e0f11bd0e3c648552f5c419c` | Yes |
| `origin/docs/docs-ros-post-pr11-001` | `96ae03cb7b97e2c2bedeabb1323e780c80dbbb9e` | Yes |
| `origin/docs/docs-ros-post-pr11-001-phase-b` | `5f6478d27838f386d4f188d4fd453675bf68a55e` | Yes |
| `origin/docs/post-pr18-ingredient-003b-closeout-task-card` | `7c80fbd13bb196d9c78e938baeb9625a6658e1d3` | Yes |
| `origin/docs/post-pr18-ingredient-003b-governance-closeout` | `86772c838cc0eb053e0dbc65953fe23d38d24bd5` | Yes |
| `origin/docs/post-pr23-ingredient-003c-closeout` | `15fa0fc88b090a3d2856ed5ed3dbde5b757ed661` (historical observation before later correction commits) | No at that observation — PR #24 open and unmerged |
| `origin/docs/pr-ingredient-003-proposal-record` | `850dab8265c8a40e956e1dae39a294c35367ee49` | Yes |
| `origin/docs/pr-ingredient-003a-task-card` | `d115e1e2446b5a6b12098cb449a38a62d7820ffa` | Yes |
| `origin/docs/pr-ingredient-003b-task-card` | `3de9b2d3012792353707edde478be706341ba05f` | Yes |
| `origin/docs/pr-ingredient-003c-task-card` | `594a0504a0c3a5e3ca92501201cf12eb9a4c0e81` | Yes |
| `origin/docs/post-pr20-handover-update` | `49d5b38f2d1d50a334dceec38910a04d0fdf9cb5` | Yes |
| `origin/docs/ros-post-pr7-baseline-sync-001` | `bb44edbc78520dabd178ac5060dd6da913c60c93` | Yes |
| `origin/feature/cost-back-office` | `bec41bb89185c0261c1375b62b1be91e4e2b00df` | Yes |
| `origin/feature/pr-cost-004r` | `7809e8555c58c9ae5d11498361ac88360890f4e4` | Yes |
| `origin/feature/pr-ingredient-003a-command-boundary` | `2b93889fd4a06351d650d73e12ab8567f5fff0f9` | Yes |
| `origin/feature/pr-ingredient-003b-management-api` | `784bb00912fd957dab6a84448dd8f640f0e166fc` | Yes |
| `origin/feature/pr-ingredient-003c-management-ui` | `06929a7c73e370e1a2e0ba4fd230cdbdb0f19a35` | Yes |
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
| `origin/integration/architecture-development` | `ea46678cbb955b7aeb093dc34525c52325af9cae` | Yes |

At the earlier observation when the PR #24 branch Head was
`b3f56130eb29d477d82849267c0f8bb801e64e7b`, the recorded integration Head
`ea46678cbb955b7aeb093dc34525c52325af9cae` was its first parent and the branch
was ahead by one commit. At the later historical observation shown in the table,
integration remained an ancestor of branch Head
`15fa0fc88b090a3d2856ed5ed3dbde5b757ed661`; the branch was ahead by two commits
and behind by zero, while PR #24 remained open and unmerged. At the subsequent
pre-remediation observation, the remote branch and PR Head were
`b4fcf0fa0d4998f8ff8bd0ce233374b46df647d1`, integration remained its ancestor,
and the branch was ahead by three commits and behind by zero. None of these
historical PR Heads was contained by integration. Mechanical mergeability did
not change any containment result and did not predict a merge commit, future
integration Head, or merge time. This document makes no assertion that any one
of those historical SHAs remains the live tip after its own later commits.

The 2026-08-12 original Independent PR Review of PR #24 returned `FAILED` with
5 blocking findings and 0 non-blocking findings, all concerning stale
delivery-state wording. The first uncommitted five-file remediation candidate
then returned `FAILED` with 2 blocking findings and 0 non-blocking findings:
lifecycle-unsafe delivery-state wording and an obsolete PR #20-era Current
documentation Gate. The second, lifecycle-safe candidate returned `FAILED` with
1 blocking finding and 0 non-blocking findings because this table incorrectly
marked the PR #24 branch as contained. The third, containment-remediation
candidate, identified by this file's blob
`d4dcf593385d2feb5004b428ce1bb205a1f72325` and total statistics of 5 files,
`+98/-34`, was reviewed on 2026-08-12 from 14:00 through 14:04 (UTC+8) and
returned `FAILED` with 1 blocking finding and 0 non-blocking findings because
the five documents omitted the preceding `FAILED 1/0` provenance.

At the subsequent Owner-authorized preparation observation, the five unstaged
working-tree files formed a fourth review-provenance remediation candidate. It
had not been committed, pushed, added to PR #24, or independently reviewed.
That statement records the preparation observation rather than permanent
execution state; later state must be verified from Git, GitHub, and the latest
Owner instruction.

That fourth candidate then received an Independent Candidate Review verdict of
`PASSED` with 0 blocking findings and 0 non-blocking findings. The PASS qualified
only its content for an Owner Commit Decision; it was not a PR Review PASS or
push, merge, closeout, baseline, main, release, or deployment authority. Under
separate Owner authorizations, commit
`15fa0fc88b090a3d2856ed5ed3dbde5b757ed661` was created on 2026-08-12 from
14:40 through 14:41 (UTC+8), with parent `b3f56130...`, tree `aeb2cb6f...`,
message `docs(ingredient): preserve 003c closeout review provenance`, and an
exact five-file `+155/-34` scope; it was then fast-forward pushed at 19:17
(UTC+8). The remote branch and PR #24 Head became `15fa0fc88...`, while PR #24
remained open, non-Draft, and unmerged.

The subsequent full-range Independent PR Re-Review, conducted on 2026-08-12
from 19:42 through 19:46 (UTC+8) over `ea46678...15fa0fc88...`, returned
`FAILED` with 1 blocking finding and 0 non-blocking findings. Its sole finding
was that these five current-state documents omitted the Candidate Review PASS,
commit, push, and Head provenance; identity, chain, 13-path scope, statistics,
format, containment boundaries, and unauthorized-scope checks had no other
finding. The reviewer made no repository or GitHub change, and PR #24 did not
qualify for Owner Merge Decision.

At the later Owner-authorized remediation observation, edits to these same five
local working-tree files formed a post-re-review provenance candidate. They had
not been staged, committed, pushed, added to PR #24, or independently reviewed.
This is a historical observation, not permanent execution state; later state
must be verified from Git, GitHub, and the latest Owner instruction. Candidate
review, commit, push, PR re-review, and merge remain separate Owner Gates.

That candidate later received the exact Independent Corrected Candidate Review
verdict `PASSED` with 0 blocking findings and 0 non-blocking findings. Under
separate Owner authorizations, commit
`b4fcf0fa0d4998f8ff8bd0ce233374b46df647d1` was created with parent
`15fa0fc88...`, tree `8380900e...`, message
`docs(ingredient): correct closeout post-review provenance`, and the exact five
reviewed files at `+118/-15`; it was then fast-forward pushed. The next full
Independent PR Re-Review returned `FAILED` with 1 blocking finding and
0 non-blocking findings solely because this file still described historical
Head `15fa0fc88...` as the current remote and PR tip. All other final-range
identity, commit-chain, 13-document scope, blob, chronology, governance-boundary,
format, and excluded-scope checks passed.

At the following Owner-authorized remediation observation, the correction was
limited to this branch inventory. It converts tip identities into explicitly
historical observations and delegates all live-tip and PR-state decisions to
fresh Git/GitHub evidence. This statement does not claim that the correction is
committed, pushed, present in PR #24, reviewed, merged, or effective; those later
facts remain governed by their separate Gates and current external evidence.

Remote checks were `NOT CONFIGURED`; GitHub's clean / Ready to merge state
recorded mechanical mergeability only. Both this closeout branch and the
Ingredient 003C feature branch remain protected from cleanup.

## Worktrees actually observed

The following entries are the exact worktrees returned by
`git worktree list --porcelain` during the reality check. Detached entries are
reported as detached; no purpose or future disposition is inferred.

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
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-integration` | `docs/post-pr23-ingredient-003c-closeout` | `ea46678cbb955b7aeb093dc34525c52325af9cae` before documentation edits |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-main-gate-upgrade` | `chore/main-gate-migration-upgrade-fixture` | `c3742bce3f3baf471c28bf479eba418172efc61c` |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-pr-cost-004r` | `feature/pr-cost-004r` | `7809e8555c58c9ae5d11498361ac88360890f4e4` |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-pr-measure-001` | `feature/pr-measure-001` | `8b80e9723d55c1e6dc0e30a6c83cb9e52effe20e` |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-pr-recipe-canonical-projection` | `feature/pr-recipe-canonical-projection` | `3db30c115861443fb257451f93ff0d8bfa1264f1` |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-quote-normalization-evidence` | `feature/quote-normalization-evidence` | `e1859aa81c3eec07fb439fd74ca2508cd3159f66` |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-realtime-fix` | `fix/realtime-heartbeat-last-event` | `dfd5f294aa65bb9ac89bd630c0e1f72cc918de58` |
| `C:/Users/user/Documents/荒島餐車 AI 營運資料庫/desert-island-ros-recipe-costing-contract-v2` | `feature/recipe-costing-contract-v2` | `febfa4abea3e61748d7a3d0dc0c0f03bf811ace4` |

## Task boundary

Record only worktrees actually observed during the verified reality check. Do
not delete, clean, or otherwise modify any branch or worktree under this Task.
This Task assigns no new governance or evidence status to any listed entry.
