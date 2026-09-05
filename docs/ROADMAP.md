# Roadmap

Last synchronized: 2026-09-05 (Asia/Taipei).

Roadmap entries describe planning and verified completion state. They do not
grant implementation, Git, release, deployment, or cleanup authority.

## Planned Operations correction program — gated

DECISIONS #096 records the Owner-approved architecture-documentation phase for
paid/started Order replacement. The planned dependency sequence is:

1. PR-OPERATIONS-004 — lazy-root replacement and pending-intent/reservation/lock
   foundation plus its additive migration.
2. PR-OPERATIONS-005 — supplement/refund evidence, cross-device recovery,
   finished-item disposition, and closeout/report correctness.
3. PR-OPERATIONS-006 — POS/Kitchen Owner workflow, stable pickup identity,
   voice/reminder behavior, and responsive E2E.

Independent Architecture Review passed and DECISIONS #097 authorizes only
PR-OPERATIONS-004 implementation and local candidate validation. PR 005/006,
commit, push, PR, merge, and deployment remain gated. No historical backfill,
Waste Domain, provider integration, UAT/database change, or deployment is part
of the current Gate.

## Completed and contained milestones

1. Phase 0 through Phase 1C foundations: modular-monolith governance, Catalog,
   Event/Sellable Inventory, Product Contract v2, POS Order Core, lifecycle
   correction, and related verified operating-loop increments.
2. Realtime and Back Office increments: Shadow Run support, connectivity
   diagnostics, Front Office/Back Office/Kitchen separation, runtime
   preparation, and heartbeat correction as recorded by their Decisions.
3. Measurement and Ingredient foundations: Measurement Foundation, Canonical
   Ingredient Domain/persistence, and Ingredient Measurement Profile
   persistence.
4. Recipe-to-Cost foundations: Recipe canonical projection, Quote normalization
   evidence, Recipe Costing Contract v2, and Cost Evaluation.
5. Cost Back Office vertical slice: contained in development integration and
   independently reviewed. It is not a formal product release or verified
   deployment.
6. Recipe Management Proposal and 001A:
   - Proposal and 001A Task Card recorded by PR #3 and PR #4.
   - 001A Domain implementation completed, independently reviewed, and merged
     by PR #5.
7. Recipe Management 001B:
   - Task Card recorded by PR #6.
   - Persistence/Unit-of-Work implementation completed after two blocking
     remediation reviews and a third approving review.
   - PR #7 merged the final approved Head into integration.
8. Post-PR #7 governance:
   - PR #8 recorded the documentation synchronization Task Card.
   - DECISIONS #070 and the independent Recipe Management Closeout Record are
     the authorized historical closeout outputs of `DOCS-ROS-POST-PR7-001`.
9. COST-REGRESSION-001:
   - PR #10 recorded the dedicated nested SQLite transaction Task Card.
   - PR #11 corrected the two-file authorized scope after an initial blocking
     review and remediation, then passed independent and post-merge verification.
   - The regression is completed and closed; its earlier 466/470 failure
     evidence remains historical chronology.
10. Post-PR #11 governance:
   - PR #12 recorded only the Phase A documentation synchronization Task Card.
   - PR #13 completed the authorized Phase B documentation synchronization.
11. Canonical Ingredient lifecycle Application boundary:
   - PR #14 recorded the accepted PR-INGREDIENT-003 Proposal.
   - PR #15 recorded the PR-INGREDIENT-003A Task Card.
   - PR #16 completed and merged the Rename/Archive command boundary.
12. Canonical Ingredient management persistence and API:
   - PR #17 recorded the PR-INGREDIENT-003B Task Card.
   - PR #18 completed and merged deterministic management reads, SQLite
     persistence, server composition, and the management API.
   - PR #19 recorded the post-PR18 governance closeout Task Card only.
13. Post-PR18 Ingredient 003B governance closeout:
   - PR #20 completed the independently reviewed documentation synchronization.
14. Canonical Ingredient management UI/navigation:
   - PR #22 recorded the PR-INGREDIENT-003C Task Card.
   - PR #23 completed the six-file implementation through six remediation
     rounds and passed independent and post-merge validation.
   - Ingredient 003C governance closeout was completed separately by PR #24.
15. Canonical Ingredient Reference Impact read model:
   - PR #25 completed the Recipe/Cost public-read coordination slice.
   - Recipe Draft/Published/Superseded and Cost Quote history are available;
     Accepted Purchase and Cost Snapshot remain explicitly `Unavailable`.
16. Canonical Ingredient Reference Impact UI:
   - PR #26 completed the explicit on-demand management-panel consumer.
17. Canonical Ingredient Creation Application boundary:
   - DECISIONS #072 recorded the ownership boundary and PR #27 completed it.
   - The existing Cost creation endpoint remains a facade; Canonical Ingredient
     creation, identity generation, Aggregate construction, and persistence
     coordination are owned by the Recipe-hosted Application Service.

## Architecture and live-state policy

- Ingredient 003A through 003F are closed implementation workstreams.
- The Architecture Development Baseline through 003F is the dated PR #27 merge
  observation `f9e71b5378de00c8ffdb63833282327d256e6edd`.
- This SHA is historical provenance, not a permanent assertion of the live
  integration tip. Before any new work, obtain the branch, HEAD, ahead/behind,
  PR state, and working-tree status from fresh Git/GitHub evidence.

Neither a recorded baseline nor a completed Ingredient slice means remote
`main`, a deployment, or a product release.

## Unauthorized or separately gated

- Recipe 001C: formal Recipe management Application contracts/orchestration.
- Recipe 001D: Recipe management API and Runtime composition.
- Recipe 001E: Back Office Recipe management UI.
- Ingredient Measurement Profile creation authority remains a separately gated
  boundary: the current Cost Profile facade still performs that orchestration.
- Reactivation, permanent deletion, merge/alias behavior, identity resolution,
  and duplicate-name uniqueness remain unauthorized.
- Accepted Purchase authority and Cost Snapshot persistence/reporting history
  remain unavailable. Deletion eligibility is therefore `Indeterminate` and
  blocked even when available Recipe and Quote reference counts are zero.
- Customer/Kiosk/Preorder, Inventory, package conversion, Supplier/Purchase,
  external integration, and AI work beyond existing accepted capability.
- Remote `main` creation, main promotion, deployment, and product release.
- Branch or worktree cleanup.
- Repository-wide architecture/duplication/security audit and any resulting
  remediation.

Every future item requires its own Owner proposal, authorization, verification,
Git, and merge gates. Completion of 001A/001B does not make 001C the automatic
next task.
