# DOCS-ROS-POST-PR11-001

## Post-PR11 Governance Documentation Synchronization Task Card

Status: Revised draft for Owner review only

Document type: Governance documentation synchronization planning record

Current Owner Goal:

> Synchronize ROS governance and handover documentation with the verified
> post-PR11 repository reality.

Required baseline:

```text
Branch:
integration/architecture-development

Owner-Accepted Architecture Development Baseline:
1c31a31030e7c0d29181ebcc5355a706db95dc50
```

This baseline designation does not constitute:

- remote `main` creation;
- main promotion;
- production release;
- deployment;
- runtime provenance verification; or
- authorization for any new feature.

This Task Card draft does not authorize file modification, staging, commit,
push, PR creation, merge, cleanup or documentation synchronization.

## 1. Constitution Compatibility Gate

Reviewed authority:

- `CONSTITUTION.md`
- `AGENTS.md`
- `docs/REPOSITORY_WORKING_GUIDE.md`
- `docs/REPOSITORY_POLICY.md`
- `docs/DECISIONS.md`
- ADR-019
- DECISIONS #051
- DECISIONS #065
- DECISIONS #070
- Owner Authorization COST-REGRESSION-001
- PR #11 independent review, remediation review, merge authorization and
  post-merge verification
- Owner Task Card Revision Order DOCS-ROS-POST-PR11-001

Compatibility result:

```text
PASS FOR TASK CARD DRAFTING ONLY
```

The proposed work changes documentation only. It creates no Domain authority,
contract, schema, migration, runtime behavior, release authority or feature
implementation authority.

## 2. Purpose

This Task records the plan for synchronizing governance documents after PR #11.

The future documentation work must formally record:

- `1c31a31030e7c0d29181ebcc5355a706db95dc50` as the new Owner-Accepted
  Architecture Development Baseline;
- PR #9 documentation synchronization completion;
- PR #10 COST-REGRESSION-001 Task Card merge;
- PR #11 implementation, remediation, independent reviews, merge and
  post-merge verification;
- COST-REGRESSION-001 as `COMPLETED`;
- correction of the historical four-failure Cost regression;
- the current Recipe, Cost and Ingredient authorization boundaries;
- current GitHub PR, branch, worktree and protected-file observations.

Historical failures and review blockers must remain visible as chronology.
They must be marked resolved or superseded, not erased.

## 3. Governance identity

COST-REGRESSION-001 requires no new retrospective Decision number.

Its Closeout Record must cite:

- DECISIONS #051;
- DECISIONS #065;
- Owner Authorization COST-REGRESSION-001;
- initial PR #11 independent review;
- Owner remediation authorization;
- independent remediation re-review;
- Owner merge authorization; and
- post-merge verification acceptance.

No Decision number may be invented, reserved or backdated.

`docs/DECISIONS.md` may record the subsequent Owner baseline designation under
this expressly identified Owner order, but must not alter the historical
meaning of DECISIONS #070 or represent COST-REGRESSION-001 as a newly numbered
Decision.

## 4. Phase A Task Card recording path

Proposed path:

```text
docs/reviews/ROS_POST_PR11_GOVERNANCE_DOCUMENTATION_SYNCHRONIZATION_TASK_CARD.md
```

Phase A authorizes only recording this Task Card after separate Owner approval.
It does not authorize the Phase B documentation changes.

## 5. Proposed Phase B allowlist necessity audit

The following list is reduced to files with a concrete post-PR11 correction.

| Path | Current stale or incorrect statement | Required factual correction | Why inclusion is necessary | Governance contradiction if omitted |
| --- | --- | --- | --- | --- |
| `README.md` | Names `6128f8e...` as accepted baseline, `b107c6c...` as current Head and says four Cost failures remain unresolved | Record baseline `1c31a310...`, PR #11 completion and corrected Cost status; retain no-release/no-deployment boundary | Primary repository entry point currently directs readers to retired operational state | Yes |
| `docs/09_TEST_PLAN.md` | Current section records 466/470 with four open failures and says remediation remains future work | Preserve the failure as historical discovery evidence; add PR #11 independent 483/483 evidence and post-merge focused results; mark regression resolved | Prevents historical failure evidence from being mistaken for current test state | Yes |
| `docs/ACTIVE_BRANCHES.md` | Controls from `b107c6c...`; records integration worktree on the former documentation branch and uses old containment baseline | Replace with a new dated observation at `1c31a310...`; record only branches/worktrees actually reverified | Existing branch and worktree statements are factually false today | Yes |
| `docs/CHANGELOG.md` | Stops at post-PR8/PR9 synchronization and records the Cost regression as unresolved | Append PR #10 Task Card and PR #11 remediation/merge/verification chronology | Maintains auditable change chronology without rewriting older entries | No — omission would leave incomplete audit traceability, but not a direct current-state contradiction |
| `docs/CURRENT_STATUS.md` | Says documentation synchronization is executing on the old branch and Cost has four unresolved failures | Record PR #9–#11 completion, new baseline, resolved regression and current unauthorized scope | File explicitly claims to describe current status | Yes |
| `docs/DECISIONS.md` | DECISIONS #070 identifies `6128f8e...` as the then-current accepted baseline and `b107c6c...` as the then-current integration Head | Preserve #070 historical text; add a clearly dated subsequent Owner baseline designation for `1c31a310...`, citing DOCS-ROS-POST-PR11-001; add no Cost Decision number | This is the central authority register, and the new formal baseline designation must be discoverable without rewriting history | Yes |
| `docs/RELEASE_BASELINE.md` | Formally designates `6128f8e...` and stops at PR #8 | Designate `1c31a310...` as the current Owner-Accepted Architecture Development Baseline; record exact PR #11 parents and release exclusions | This is the repository's designated baseline identity document | Yes |
| `docs/REPOSITORY_POLICY.md` | “Current Development Order” still says targeted identity correction is in progress and re-audit pending | Update only the current-order/status section to reflect completed governance correction, Recipe 001A/001B, documentation synchronization and COST-REGRESSION-001; retain policy rules unchanged | Current sequence conflicts with completed integration ancestry | Yes |
| `docs/REPOSITORY_STATUS.md` | Reports `6128f8e...`/`b107c6c...`, old documentation branch and unresolved Cost regression | Record current baseline, PR #9–#11 chronology, resolved regression and present Git observations | Human-readable repository-status authority is materially stale | Yes |
| `docs/ROADMAP.md` | Stops at PR #8 and does not include PR #9–#11 or Cost remediation completion | Add documentation synchronization and COST-REGRESSION-001 completion; keep future feature work unauthorized | Roadmap currently presents a completed remediation as absent/open | Yes |
| `docs/bootstrap/CURRENT_AI_HANDOVER.md` | Hands off the old documentation branch/base and warns that the four Cost failures remain open | Replace operational handover with `1c31a310...`, PR #9–#11 closeout and current planning gate; retain runtime limitations | New sessions would otherwise begin from the wrong SHA and wrong defect state | Yes |
| `docs/reviews/PR-COST-REGRESSION-001_CLOSEOUT_RECORD.md` | File does not exist | Create an independent retrospective closeout covering diagnosis, Task Card, initial blocker, remediation, reviews, merge and post-merge verification | Preserves complete chronology without rewriting the historical Task Card | Yes |

Phase B candidate scope:

- 11 existing documentation files;
- 1 new Cost Regression Closeout Record;
- 12 files total.

The Phase A Task Card file is not counted as a Phase B synchronization file.

## 6. Files deliberately excluded

The following files are excluded because no narrowly bounded post-PR11
correction is necessary, or because editing them would modernize historical
material beyond the Current Owner Goal:

- `docs/ARCHITECTURE_TIMELINE.md`
- `docs/01_ROS_V1_SCOPE.md`
- `docs/04_DATA_MODEL.md`
- `docs/05_API_CONTRACT.md`
- `docs/08_MIGRATION_PLAN.md`
- historical Recipe Proposal;
- Recipe 001A Task Card;
- Recipe 001B Task Card;
- Post-PR7 Documentation Task Card;
- COST-REGRESSION-001 Task Card.

The Cost Task Card's drafting-time Gate snapshot remains historical evidence.
Completion belongs in the independent Closeout Record, not in a rewritten Task
Card.

Older phase-document drift may be recorded as deferred documentation debt. It
must not be repaired under this Task without an Owner allowlist amendment.

## 7. Required baseline record

The synchronized baseline record must state:

```text
Owner-Accepted Architecture Development Baseline:
1c31a31030e7c0d29181ebcc5355a706db95dc50

Branch:
integration/architecture-development

First parent:
a2791a36c1f063cdf0218aa91ce78955227323a0

Second parent:
132789ccbbe65168aa79aa1888b1b3ec4424855d
```

It must also state:

- this is an architecture development/integration baseline;
- remote `main` does not exist;
- local `main` is not promoted;
- it is not a production release;
- it is not deployment evidence;
- it does not identify a running process or SQLite database;
- it does not authorize Recipe 001C–001E or Ingredient 003A–003C.

Earlier baselines remain historical ancestry and must not be erased.

## 8. Required PR chronology

The synchronized documents must accurately include:

| PR | Purpose | Merge SHA |
| ---: | --- | --- |
| #9 | Post-PR7 documentation synchronization and Recipe closeout | `2512c5a7fe1f18dadcf5cbef072594dfbd74d354` |
| #10 | COST-REGRESSION-001 Task Card | `a2791a36c1f063cdf0218aa91ce78955227323a0` |
| #11 | Nested SQLite transaction implementation and remediation | `1c31a31030e7c0d29181ebcc5355a706db95dc50` |

PR #11 record:

```text
Approved Head:
132789ccbbe65168aa79aa1888b1b3ec4424855d

Commit count:
2

Changed files:
2

Cumulative statistics:
+389/-4
```

Changed files:

- `src/shared/database/better-sqlite3-adapter.ts`
- `src/tests/database-transaction-failure.integration.test.ts`

## 9. Cost Regression Closeout requirements

The Closeout Record must preserve this sequence:

1. Expanded documentation verification discovered four reproducible Cost
   failures.
2. The historical diagnostic result was 466/470 PASS and 4 FAIL.
3. Read-only diagnosis identified lost nesting-aware transaction semantics
   after explicit manual transaction control.
4. PR #10 recorded the dedicated Task Card.
5. Initial PR #11 implementation introduced SAVEPOINT handling.
6. Initial independent review returned `BLOCKED` because a failed `ROLLBACK TO`
   prevented the required final `RELEASE`.
7. Owner authorized narrowly scoped remediation.
8. Remediation independently attempted:
   - `ROLLBACK TO`;
   - final `RELEASE`;
   - in that order;
   - exactly once each;
   - with both failure objects preserved.
9. Independent remediation review returned:

   ```text
   APPROVE FOR OWNER MERGE DECISION
   ```

10. Owner separately authorized the standard two-parent merge.
11. PR #11 merged as `1c31a310...`.
12. Post-Merge Verification Gate passed and closed.
13. COST-REGRESSION-001 status became `COMPLETED`.

The record must state that no public `DatabaseAdapter` or
`DatabaseTransactionFailure` change occurred.

## 10. Verification evidence wording

Test selections must remain separate.

Independent PR-head verification:

- Adapter remediation: 16/16 PASS
- Cost regression default: 9/9 PASS
- Cost regression serial: 9/9 PASS
- Cost persistence: 24/24 PASS
- Cost lifecycle: 26/26 PASS
- Recipe Persistence UoW: 11/11 PASS
- Recipe SQLite/Migration: 25/25 PASS
- Architecture Guards: 16/16 PASS
- Repository-configured `npm test`: 64/64 PASS
- Direct 34-file suite default: 483/483 PASS
- Direct 34-file suite serial: 483/483 PASS
- Typecheck: PASS
- Lint: PASS
- Build: PASS
- Migration smoke 001–017: PASS
- Populated migration-014 upgrade/restart/rerun/integrity: PASS
- `git diff --check`: PASS

Post-merge rerun:

- Adapter remediation: 16/16 PASS
- Original Cost regression selection: 9/9 PASS
- Architecture Guards: 16/16 PASS
- Typecheck: PASS
- Build: PASS
- `git diff --check`: PASS

The documents must not describe the PR-head all-file run as a post-merge rerun.
Overlapping selections must not be added together.

## 11. Capability and authorization wording

Permitted current wording:

- Cost Back Office source capability is contained in integration.
- COST-REGRESSION-001 is completed.
- The named regression and post-merge verification selections are green.
- Recipe 001A and 001B are completed.
- Recipe 001C–001E remain unauthorized and not started.
- Cost Back Office is not formally released or deployment-verified.
- Cost Evaluation remains ephemeral and is not Cost Snapshot persistence.

Prohibited wording:

- Cost Back Office is production-ready solely because tests passed.
- Runtime provenance is established.
- Recipe management Application/API/UI is complete.
- Ingredient lifecycle implementation is approved.
- `main` promotion or product release has occurred.

## 12. Ingredient Proposal protection

Protected file:

```text
docs/reviews/PR-INGREDIENT-003_CANONICAL_INGREDIENT_LIFECYCLE_APPLICATION_BOUNDARY_PROPOSAL.md
```

Required preserved state:

```text
Untracked: yes
Unstaged: yes
Unchanged: yes

Raw SHA-1:
F1CB397736EE073A5C2FD74D895FA672FAF44582

Git blob SHA-1:
1d3180139712b6fcf2cc88fd6c8e0d04023e9925
```

It must not be opened as an implementation PR, modified, tracked, staged or
included in either Phase A or Phase B.

## 13. Branch and worktree rules

The documentation may record only a new dated reality check.

It must preserve these distinctions:

- remote branch containment does not authorize deletion;
- a worktree observation does not assign evidence or retention status;
- dirty worktrees remain untouched;
- detached worktrees remain untouched;
- `origin/HEAD` abnormality is recorded but not corrected;
- local-only branch divergence is recorded but not resolved.

No reset, restore, clean, stash, rebase, branch deletion, worktree removal or
manual directory deletion is permitted.

## 14. Explicit exclusions

Not authorized:

- Recipe 001C–001E;
- Ingredient Proposal modification;
- Ingredient 003A–003C;
- source or test modification;
- migrations or schema;
- runtime or database work;
- architecture remediation;
- security audit or remediation;
- public-interface modification;
- branch or worktree cleanup;
- remote `main` creation;
- main promotion;
- release or deployment;
- unrelated documentation modernization.

## 15. Phase A — Task Card recording

Sequence:

1. Submit revised Task Card draft.
2. Owner reviews and authorizes recording.
3. Record only the approved Task Card file.
4. Stop at the Task Card pre-commit Gate if required by Owner order.
5. Commit/push only under separate authority.
6. Independent read-only review.
7. Owner separately authorizes Task Card merge.
8. Post-merge verification and stop.

Phase A does not authorize Phase B.

## 16. Phase B — Documentation synchronization

Sequence:

1. Owner issues a separate Documentation Work Order with final allowlist.
2. Reverify exact baseline and workspace protections.
3. Prepare documentation-only changes.
4. Run required documentation verification.
5. Stop at the pre-commit Gate.
6. Owner separately authorizes commit, push and PR creation.
7. Independent read-only documentation review.
8. Owner separately authorizes merge.
9. Perform post-merge verification.
10. Stop and report.

Completing any phase or Gate does not authorize the next.

## 17. Future Phase B verification requirements

Before a documentation commit:

- verify branch and exact base;
- verify local and remote integration identities;
- verify PR #9–#11 GitHub states and exact merge parents;
- verify all changed files are in the final allowlist;
- verify all protected historical Task Cards have zero diff;
- verify source, tests, migrations, scripts, runtime and database paths have
  zero diff;
- verify Ingredient Proposal state and both hashes;
- validate Markdown links and referenced repository paths;
- verify UTF-8, final newline and trailing whitespace;
- run `git diff --check`;
- report exact file statistics;
- distinguish newly executed checks from historical verification evidence.

## 18. Stop conditions

Stop and request Owner direction if:

- integration differs from the authorized baseline;
- PR history or merge parents differ;
- a required file falls outside the approved allowlist;
- a historical Proposal or Task Card appears necessary to rewrite;
- a new Decision number appears necessary;
- the Cost Closeout cannot be supported by existing authority;
- source, test, migration, runtime or database changes appear necessary;
- Ingredient Proposal status or either hash changes;
- branch/worktree cleanup appears necessary;
- documentation wording would imply release, deployment or feature authority;
- another workstream appears in an allowlisted file.

## 19. Draft result

```text
TASK CARD REVISED FOR OWNER REVIEW
PHASE A RECORDING NOT YET AUTHORIZED
PHASE B DOCUMENTATION SYNCHRONIZATION NOT AUTHORIZED
NO FILE MODIFICATION PERFORMED
```
