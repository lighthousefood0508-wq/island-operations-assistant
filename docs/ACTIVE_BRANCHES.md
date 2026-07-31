# ROS Active Branches

Governance basis: DECISIONS #055, #058, #059, #064, #065, and #066.

Last reviewed: 2026-07-31

## Branches requiring current attention

| Branch | Purpose | Owner | Status | Depends on | Next action |
|---|---|---|---|---|---|
| `integration/architecture-development` | Permanent Architecture Development Integration Baseline at `bec41bb89185c0261c1375b62b1be91e4e2b00df` | Architecture Owner: Miles / Lin Zi-Mao | **ACTIVE — SOLE FORMAL ARCHITECTURE DEVELOPMENT BASELINE** | DECISIONS #053 through #066 as applicable | Complete this Governance Status Update, then perform the Independent Governance Audit. Main Release Gate remains separate and not started. |
| `feature/pr-measure-001` | Completed Measurement and Ingredient foundation feature line | Architecture Owner: Miles / Lin Zi-Mao | **COMPLETED — INTEGRATED / CONTAINED; RETAINED FOR TRACEABILITY** | DECISIONS #053, #056, #057, #058, and #059 | Preserve without new development. It is not the formal baseline and is not deleted by this update. |
| `feature/pr-cost-004r` | Completed Recipe Cost Evaluation feature line | Architecture Owner: Miles / Lin Zi-Mao | **COMPLETED — INTEGRATED / CONTAINED; RETAINED FOR TRACEABILITY** | DECISIONS #060 through #064 | Preserve without new development. It is not the formal baseline and is not deleted by this update. |
| `feature/cost-back-office` | Completed Cost Back Office vertical slice and targeted correction | Architecture Owner: Miles / Lin Zi-Mao | **COMPLETED — INTEGRATED / CONTAINED; RETAINED FOR TRACEABILITY** | DECISIONS #064 and #065 | Preserve without new development. It is not the formal baseline and is not deleted by this update. |
| `feature/catalog-category-auto-code` | Branch currently attached to the original mixed recovery worktree | Ownership of individual uncommitted changes is mixed or unconfirmed | **FROZEN — RECOVERY ONLY** | Parent baseline `2e27f8f` | Do not develop or bulk-commit. Recover each workstream into a clean branch from the current approved baseline. |
| `main` | Local release branch | Architecture Owner / Release Gate | **FROZEN — NOT PROMOTED** | Full repository recovery and Release Gate | Keep unchanged until explicit promotion authorization. |
| `audit/phase-a-pos-ui-restoration` | Historical POS restoration audit and legacy parity documents | Historical audit workstream; current owner not proven | **HISTORICAL — UNIQUE DOCUMENTS** | Earlier POS/legacy analysis | Preserve until its six unique documents are integrated, archived, or explicitly retired. |
| `design/legacy-feature-parity-matrix` | Historical legacy-to-ROS parity plan | Historical design workstream; current owner not proven | **HISTORICAL — UNIQUE COMMIT** | None beyond earlier repository history | It is contained by `audit/phase-a-pos-ui-restoration`; review before deleting the duplicate branch reference. |

## Other completed branches already contained in the baseline

The following branches had no commit unique relative to the repository baseline recorded by DECISION #055 and remain frozen historical references, not active development baselines:

- `audit/phase-1c2-governance-review`
- `chore/constitution-v2-alignment`
- `design/phase-1c-order-domain`
- `design/phase-1c-order-policy-freeze`
- `feature/20260726-external-shadow-run`
- `feature/20260726-shadow-run-mvp`
- `feature/cloudflare-tunnel-preparation`
- `feature/device-connectivity-dashboard`
- `feature/front-back-office-information-architecture`
- `feature/phase-1a-catalog-admin`
- `feature/phase-1b-events`
- `feature/phase-1b-governance`
- `feature/phase-1c-order-core`
- `feature/phase-1c1-pos-ui`
- `feature/phase-1c2-order-lifecycle`
- `feature/phase-a-pos-ui-restoration`
- `feature/phase-b1-pos-operating-loop`
- `feature/phase-b1-pos-operating-loop-completion`
- `feature/phase-b1-ui-recovery`
- `feature/realtime-hardening`
- `feature/ros-independent-external-endpoint`
- `remediation/phase-1c2-adr014-recovery`
- `test/phase-1a-e2e-acceptance`

Status for every branch in this list:

- purpose: historical completed workstream;
- owner: original feature/audit owner, where known from its approval record;
- status: **HISTORICAL / SUPERSEDED BY BASELINE**;
- depends on: repository history already contained in the approved development baseline;
- next action: retain until a cleanup review proves no worktree or recovery need remains, then request Owner authorization before deleting the branch reference.

`feature/20260726-external-shadow-run` and `feature/ros-independent-external-endpoint` point to the same commit. One reference is a likely future deletion candidate, but DECISION #055 authorizes no deletion.

## Branch lifecycle labels

- **ACTIVE:** approved work is currently being reviewed or developed.
- **FORMAL BASELINE:** the sole Owner-approved Architecture Development Integration starting point.
- **COMPLETED / CONTAINED:** the feature work is reachable from the formal baseline and retained for traceability.
- **FROZEN:** preserve exactly as-is; no new work may be added.
- **HISTORICAL:** retained for audit or recovery.
- **SUPERSEDED:** all committed content is already reachable from the approved baseline.
- **DELETE CANDIDATE:** may be proposed for deletion only after reachability, worktree use, recovery, and Owner approval are verified.
