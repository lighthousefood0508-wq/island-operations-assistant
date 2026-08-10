# Roadmap

Last synchronized: 2026-08-10

Roadmap entries describe planning and verified completion state. They do not
grant implementation, Git, release, deployment, or cleanup authority.

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
   - Documentation synchronization is active only through its pre-commit Gate.
   - The future closeout does not authorize Ingredient 003C or another feature.

## Current baseline identities

- Owner-Accepted Architecture Development Baseline:
  `97d6c7b52f09643b2cafaa50711f76ccc1ae7a96`.
- Verified remote integration Head after PR #19:
  `58cce2327f3f7121442e8a0cd4cd29693b9fde3c`.

The first identifies accepted development capability through PR #18. The
second is the later integration branch tip containing only the PR #19
governance closeout Task Card merge. Neither is
remote `main`, a deployment, or a product release.

## Unauthorized or separately gated

- Recipe 001C: formal Recipe management Application contracts/orchestration.
- Recipe 001D: Recipe management API and Runtime composition.
- Recipe 001E: Back Office Recipe management UI.
- Ingredient 003C UI/navigation implementation and Reference Impact
  coordination. Ingredient 003A and 003B are completed.
- Cost Snapshot persistence and reporting history.
- Customer/Kiosk/Preorder, Inventory, package conversion, Supplier/Purchase,
  external integration, and AI work beyond existing accepted capability.
- Remote `main` creation, main promotion, deployment, and product release.
- Branch or worktree cleanup.
- Repository-wide architecture/duplication/security audit and any resulting
  remediation.

Every future item requires its own Owner proposal, authorization, verification,
Git, and merge gates. Completion of 001A/001B does not make 001C the automatic
next task.
