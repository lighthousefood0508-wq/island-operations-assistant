# Roadmap

Last synchronized: 2026-08-09

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

## Current baseline identities

- Owner-Accepted Architecture Development Baseline:
  `6128f8e853b9ac96e2d6870b3a97ffde9d0bf5d7`.
- Verified remote integration Head after PR #8:
  `b107c6c7a4a2caca25bd46b138bd8baebbd97c1b`.

The first identifies accepted development capability. The second is the later
integration branch tip containing the documentation Task Card. Neither is
remote `main`, a deployment, or a product release.

## Unauthorized or separately gated

- Recipe 001C: formal Recipe management Application contracts/orchestration.
- Recipe 001D: Recipe management API and Runtime composition.
- Recipe 001E: Back Office Recipe management UI.
- Ingredient lifecycle application/API/UI implementation.
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
