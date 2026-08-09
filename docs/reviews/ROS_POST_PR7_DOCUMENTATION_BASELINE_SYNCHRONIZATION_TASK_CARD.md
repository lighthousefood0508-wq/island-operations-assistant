# ROS Post-PR #7 Documentation Baseline Synchronization

Status: Final Owner-approved Task Card content; recording only. Documentation
baseline synchronization remains separately gated and is not authorized by
this record.

Task identifier: `DOCS-ROS-POST-PR7-001`

## 1. Constitution Compatibility Gate

Reviewed authority:

- `CONSTITUTION.md`
- ADR-019
- DECISIONS #055, #058, #059, #064, #065, #066, and #069
- Owner Decision Gate Resolution dated 2026-08-09
- Approved PR #7 merge evidence

Compatibility Result: `PASS FOR DOCUMENTATION TASK CARD RECORDING ONLY`

This Task Card creates no documentation synchronization, implementation,
commit, push, merge, release, deployment, or later-phase authority.

## 2. Owner-Decided Baseline

The following SHA is formally accepted as the
**Owner-Accepted Architecture Development Baseline**:

```text
Branch:
integration/architecture-development

Baseline SHA:
6128f8e853b9ac96e2d6870b3a97ffde9d0bf5d7
```

This designation means only:

- approved architecture-development and integration starting point;
- contains the completed and reviewed Recipe 001A and 001B work; and
- contains Cost Back Office as development-baseline capability.

It does not mean:

- remote `main`;
- main promotion;
- production deployment;
- product release;
- runtime provenance;
- authorization for Recipe 001C through 001E;
- authorization for Ingredient 003; or
- authorization to delete branches or worktrees.

## 3. DECISIONS #070

Owner-assigned record:

**DECISIONS #070 - Retrospective Governance Ratification and Recipe
Management Historical Closeout**

Required wording semantics:

- This is a retrospective governance record.
- No historical Decision number is being backdated or invented.
- It records Owner authorization that actually occurred outside the repository
  record.
- It does not retroactively expand any approved scope.
- It does not authorize future Recipe work.

Required history:

```text
Recipe Management Proposal
PR #3
Head: 8e081059b7569613587faa86854ce5fe94bfd06f
Merge: d9a1074a043d1232bcfd6f982a664c02e716fd54

001A Task Card
PR #4
Head: 22d1411a8b3dc5edf810c66948bec24d8c4fa957
Merge: c6a550b9e87f9a7cce27948e541808f2bb31ddaf

001A Implementation
PR #5
Approved Head: 773b129cc3b53fc6435c941b770f3953f7225c98
Merge: 7c6d4704f365ec5a79719321c170b8ca6a6cfff3

001B Task Card
PR #6
Head: 21f90c6e1273102d7dbdbe4d1791090b86c6d7d0
Merge: 29e120096455e26f70dce291a5249e43026b3550

001B Implementation
PR #7
Original implementation Head:
8d5b211350bffee763dd58f783402b8386e99012

Initial remediation Head:
795d2db896f77cfbd2d3b917561d64cade043ced

Pointer-provenance remediation:
6cab5e23da853bdf7f8868bd5aefd4b07d9db442

Final approved Head:
ab662a48c0bdfcf835d5c2af2ac002abba8d55a0

Integration merge:
6128f8e853b9ac96e2d6870b3a97ffde9d0bf5d7
```

The record must state:

- 001A completed, independently reviewed, and merged.
- 001B completed after remediation and three independent read-only reviews.
- The final review result was `APPROVE FOR OWNER MERGE DECISION`.
- The approved Head was the Head actually merged.
- 001C through 001E remain unauthorized.
- Main promotion, deployment, and release remain unauthorized.

## 4. Independent Closeout Record

Create only under a later, separate Owner Documentation Work Order:

`docs/reviews/PR-RECIPE-MANAGEMENT-001_CLOSEOUT_RECORD.md`

The Closeout Record must contain:

- Proposal, 001A, and 001B chronology;
- PR numbers, approved Heads, and merge commits;
- 001B blocker and remediation history;
- final independent review result;
- verification evidence;
- final baseline relationship;
- explicit deferred and unauthorized scope; and
- reference to DECISIONS #070.

The following historical files remain byte-for-byte unchanged:

- `PR-RECIPE-MANAGEMENT-001_FORMAL_RECIPE_DRAFT_CREATION_AND_PUBLICATION_PROPOSAL.md`
- `PR-RECIPE-MANAGEMENT-001A_DOMAIN_CORRECTION_AND_DRAFT_COMMANDS_TASK_CARD.md`
- `PR-RECIPE-MANAGEMENT-001B_FORWARD_ONLY_PERSISTENCE_AND_PUBLICATION_UNIT_OF_WORK_TASK_CARD.md`

Their original `Owner review draft` wording is retained as historical evidence.

## 5. Proposed Documentation Synchronization Allowlist

Only after a separate Owner Documentation Work Order:

- `docs/DECISIONS.md`
- `docs/reviews/PR-RECIPE-MANAGEMENT-001_CLOSEOUT_RECORD.md`
- `docs/bootstrap/CURRENT_AI_HANDOVER.md`
- `docs/CURRENT_STATUS.md`
- `docs/ROADMAP.md`
- `docs/REPOSITORY_STATUS.md`
- `docs/ACTIVE_BRANCHES.md`
- `docs/RELEASE_BASELINE.md`
- `docs/09_TEST_PLAN.md`
- `docs/CHANGELOG.md`
- `README.md`

Any file not listed above requires a per-file Owner extension.

## 6. Required Document Corrections

- Replace obsolete handover branch, SHA, test, and migration claims.
- Record `6128f8e853b9ac96e2d6870b3a97ffde9d0bf5d7` as the Architecture
  Development Baseline only.
- Preserve the distinction between development baseline and product release.
- Record PR #7 as merged, not Open, blocked, or awaiting authorization.
- Record Recipe 001A and 001B as complete.
- Record Recipe 001C through 001E as unauthorized.
- Record Cost Back Office as contained in integration but not released.
- Record migrations 001 through 017.
- Record remote `main` as nonexistent.
- Record local `main` as unpromoted.
- Record `origin/HEAD` as an observed abnormal pointer only; do not change it.
- Record remote feature and governance branches as contained only where proven,
  without suggesting deletion authority.
- Record only worktrees actually observed during the verified reality check. Do
  not delete, clean or otherwise modify any branch or worktree under this Task.
- Preserve the distinction between source capability, test evidence, and
  release status.

This Task does not assign a new governance or evidence status to existing
worktrees.

## 7. Verification Evidence Rules

Capability statements must cite at least one applicable source:

- source implementation;
- integration test;
- migration;
- accepted contract;
- independent review; or
- merge evidence.

Test results must retain their original grouping:

- Persistence and SQLite;
- Unit of Work;
- migration and transaction;
- Recipe focused;
- Projection and Costing;
- Architecture Guards;
- full repository suite; and
- migration smoke and upgrade.

Overlapping selections must not be added into a fictional total test count.

## 8. Runtime Wording

Documentation may record only this dated observation:

```text
Observation date: 2026-08-09
127.0.0.1:3092/health returned SQLite ready.
Observed process: Node dist/server/index.js, PID 12252.
The running worktree, Git SHA, SQLite path, and deployment provenance
were not independently established.
```

This observation must not be presented as permanent current-state
information. Documentation must not claim:

- that PID 12252 is permanent or currently active after the observation date;
- that the observed runtime equals baseline
  `6128f8e853b9ac96e2d6870b3a97ffde9d0bf5d7`;
- that a public Tunnel is active;
- that deployment has been verified; or
- that `runtime/ROS_CURRENT_LINKS.txt` exists when it is absent.

Runtime provenance remains a separate proposed Task.

## 9. Protected Ingredient Proposal

The following file remains outside all Task scope:

`docs/reviews/PR-INGREDIENT-003_CANONICAL_INGREDIENT_LIFECYCLE_APPLICATION_BOUNDARY_PROPOSAL.md`

Required preserved state:

```text
Git status: untracked

Raw SHA-1:
F1CB397736EE073A5C2FD74D895FA672FAF44582

Git blob SHA-1:
1d3180139712b6fcf2cc88fd6c8e0d04023e9925
```

It must not be modified, staged, committed, or included in the documentation
Pull Request.

## 10. Explicit Exclusions

- `src/**`
- `migrations/**`
- `scripts/**`
- `package.json`
- runtime or database changes
- historical Recipe proposal or Task Card changes
- Ingredient Proposal
- Recipe 001C through 001E
- Ingredient lifecycle implementation
- remote `main`
- default-branch changes
- release or deployment
- branch or worktree cleanup
- security or architecture remediation
- unrelated documentation cleanup

## 11. Required Verification

Before submission:

1. Confirm integration Head remains exactly
   `6128f8e853b9ac96e2d6870b3a97ffde9d0bf5d7`.
2. Confirm every changed file is in the exact allowlist.
3. Confirm historical Recipe documents have zero diff.
4. Confirm the Ingredient Proposal remains untracked with both hashes
   unchanged.
5. Confirm `src/**`, `migrations/**`, `scripts/**`, and `package.json` have zero
   diff.
6. Search for obsolete SHA, branch, PR status, test-count, and migration claims.
7. Validate every capability statement against source, test, migration, or
   merge evidence.
8. Validate local `main`, remote `main`, and `origin/HEAD` statements.
9. Validate Markdown links and referenced paths.
10. Run `npm run typecheck`.
11. Run `npm run architecture:guard`.
12. Run `npm test`.
13. Run `npm run migration:smoke`.
14. Run `npm run migration:upgrade:014`.
15. Run `git diff --check`.

After push, require an independent read-only documentation review.

## 12. Git and Authorization Gates

```text
Gate 1: Owner approves this Task Card draft.
Gate 2: Owner separately authorizes recording the Task Card.
Gate 3: Task Card is reviewed and merged.
Gate 4: Owner issues Documentation Work Order.
Gate 5: Documentation changes are produced and reviewed.
Gate 6: Owner authorizes commit and push.
Gate 7: Independent read-only review.
Gate 8: Owner issues merge authorization.
```

No later Gate is implied by completing an earlier Gate.

Current status:

**TASK CARD RECORDED AS OWNER-APPROVED CONTENT — DOCUMENTATION
SYNCHRONIZATION NOT AUTHORIZED**
