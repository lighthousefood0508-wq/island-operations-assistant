# DOCS-ROS-POST-PR18-INGREDIENT-003B-001

## ROS Post-PR18 / Ingredient 003B Governance Closeout Task Card

> **OWNER-AUTHORIZED TASK CARD DRAFT — DOCUMENTATION SYNCHRONIZATION NOT AUTHORIZED**

Status: Task Card draft recorded for Owner pre-commit review

Document type: Documentation-only governance closeout planning record

Recording branch:

```text
docs/post-pr18-ingredient-003b-closeout-task-card
```

Recording base and current Architecture Development Baseline:

```text
97d6c7b52f09643b2cafaa50711f76ccc1ae7a96
```

This Task Card does not authorize documentation synchronization, staging,
commit, push, PR creation, merge, Ingredient 003C, main promotion, release,
deployment or cleanup.

## 1. Constitution Compatibility Gate

Reviewed authority and evidence:

- `AGENTS.md`;
- `CONSTITUTION.md`;
- `docs/REPOSITORY_WORKING_GUIDE.md`;
- `docs/REPOSITORY_POLICY.md`;
- `docs/DECISIONS.md`, including DECISIONS #069;
- ADR-019;
- the Owner-accepted PR-INGREDIENT-003 Proposal;
- the Owner-approved PR-INGREDIENT-003A Task Card;
- the Owner-approved PR-INGREDIENT-003B Task Card;
- PR #14 through PR #18 Git history;
- PR #16 and PR #18 verification evidence;
- PR #18 independent review, merge authorization and post-merge verification;
- the Owner Governance Closeout Preflight acceptance; and
- the Owner Task Card Draft Authorization for this work item.

Compatibility result:

```text
PASS FOR DOCUMENTATION-ONLY TASK CARD RECORDING
```

The future synchronization may record completed facts only. It must not create
or alter Domain authority, public contracts, lifecycle policy, schema,
migration, API behavior, runtime behavior, product authority or release
authority.

## 2. Purpose

This Task Card defines a future, separately authorized documentation-only
governance closeout for PR-INGREDIENT-003B after PR #18.

The future work must:

1. record PR #14 through PR #18 chronology;
2. record PR-INGREDIENT-003A and PR-INGREDIENT-003B as completed and merged;
3. record `97d6c7b52f09643b2cafaa50711f76ccc1ae7a96` as the current
   Owner-Accepted Architecture Development Baseline;
4. record the completed Canonical Ingredient command, management-read,
   persistence and API boundaries without expanding them;
5. preserve historical Proposal, Task Card, review and remediation evidence;
6. create one independent PR-INGREDIENT-003B Closeout Record; and
7. leave PR-INGREDIENT-003C and every other future work item unauthorized.

This closeout makes no new architecture decision and requires no new
DECISIONS number.

## 3. Authoritative identities and protected seals

### Current Git and baseline identity

```text
Branch:
integration/architecture-development

Current Owner-Accepted Architecture Development Baseline:
97d6c7b52f09643b2cafaa50711f76ccc1ae7a96

PR #18 approved implementation Head:
784bb00912fd957dab6a84448dd8f640f0e166fc

PR #18 merge parent 1:
5c2a69282567c6456a5d2e7e2628270a03847e57

PR #18 merge parent 2:
784bb00912fd957dab6a84448dd8f640f0e166fc
```

The Architecture Development Baseline is not:

- remote `main`;
- main promotion;
- a product or production release;
- deployment;
- proof of a running process or executable;
- runtime worktree provenance; or
- database-file provenance.

### Protected blobs

| Protected record | Required Git blob |
| --- | --- |
| Ingredient Proposal | `35a41567b16a714e154162042fba1ee0f6d160d9` |
| PR-INGREDIENT-003A Task Card | `d678765982fa11e9921ab898dfc4d878bbcd7e10` |
| PR-INGREDIENT-003B Task Card | `9453d54b4ad0529c84c277f61ebb83efcae0c1ec` |
| Migration 014 | `5bcc40cddfe9ba14db7dc6a5e8da2d46f41ee23d` |

The future Documentation Work Order must stop before writing if any protected
blob or the then-authorized Git base differs.

## 4. Required PR chronology

The future synchronized documents must preserve this exact chronology:

| PR | Purpose | Base | Approved Head | Merge commit | Scope |
| --- | --- | --- | --- | --- | --- |
| #14 | Record the Owner-accepted PR-INGREDIENT-003 Proposal | `2bd115ed2b78e10d549dabe38b28f6c824aaf65b` | `850dab8265c8a40e956e1dae39a294c35367ee49` | `b3f2e5e28ff55f988859c8e438f8128875d80fe7` | 1 file, `+584/-0` |
| #15 | Record the Owner-approved PR-INGREDIENT-003A Task Card | `b3f2e5e28ff55f988859c8e438f8128875d80fe7` | `d115e1e2446b5a6b12098cb449a38a62d7820ffa` | `f8dc8af112deaf478621bb653cd782d09e0425db` | 1 file, `+996/-0` |
| #16 | Implement the Canonical Ingredient lifecycle command boundary | `f8dc8af112deaf478621bb653cd782d09e0425db` | `2b93889fd4a06351d650d73e12ab8567f5fff0f9` | `b5641482bbfe34d110ccdf40d1ab5347850a9155` | 6 files, `+878/-3` |
| #17 | Record the Owner-approved PR-INGREDIENT-003B Task Card | `b5641482bbfe34d110ccdf40d1ab5347850a9155` | `3de9b2d3012792353707edde478be706341ba05f` | `5c2a69282567c6456a5d2e7e2628270a03847e57` | 1 file, `+701/-0` |
| #18 | Implement Canonical Ingredient management reads, persistence and API | `5c2a69282567c6456a5d2e7e2628270a03847e57` | `784bb00912fd957dab6a84448dd8f640f0e166fc` | `97d6c7b52f09643b2cafaa50711f76ccc1ae7a96` | 12 files, `+1523/-9` |

PR #14 through PR #18 are sequential governance and implementation history.
Their inclusion in the current integration ancestry does not authorize branch
deletion or cleanup.

## 5. Completed capability facts

### PR-INGREDIENT-003A

PR #16 completed the synchronous Canonical Ingredient Rename and Archive
Application command boundary over the existing Repository Port operations:

- `findById`;
- `findDuplicateCandidates`; and
- `saveWithExpectedVersion`.

It established version-first lifecycle precedence, stable Application errors,
non-blocking duplicate warnings, caller-reported audit metadata and an additive
public Recipe contract surface. It did not add persistence management reads,
runtime routes, UI, schema or migration changes.

### PR-INGREDIENT-003B

PR #18 completed, atomically in one PR:

- Repository Port management-list operations;
- SQLite Repository implementations for Active and Archived management reads;
- deterministic `name ASC`, then `ingredientId ASC` ordering within each
  lifecycle section;
- management read Application service;
- server adapter and composition wiring;
- Canonical Ingredient management HTTP routes;
- persistence, restart, API and Architecture Guard coverage; and
- preservation of the pre-existing Cost creation-composition route.

Migration 014, schema and shared database-adapter infrastructure remained
unchanged.

## 6. Canonical Ingredient management API facts

The completed management namespace is:

```text
/api/admin/canonical-ingredients
```

Four route registrations implement six management behaviors:

| HTTP method and path | Behavior |
| --- | --- |
| `GET /api/admin/canonical-ingredients` | List all; omitted lifecycle is `all`; the same registration also supports `active` and `archived` filters |
| `GET /api/admin/canonical-ingredients/:ingredientId` | Read one Active or Archived identity |
| `POST /api/admin/canonical-ingredients/:ingredientId/rename` | Execute the accepted 003A Rename command |
| `POST /api/admin/canonical-ingredients/:ingredientId/archive` | Execute the accepted 003A Archive command |

The six behaviors are all-list, Active-list, Archived-list, detail, Rename and
Archive. Documentation must not call these “six routes.”

Accepted HTTP mapping:

| Application outcome | HTTP status |
| --- | ---: |
| Validation failure | `422` |
| Not Found | `404` |
| Version Conflict, Already Archived, Archived Rename Rejected or Invalid Lifecycle Transition | `409` |
| Persistence failure | `500` |

Malformed JSON syntax retains the established `400 / invalid_json / Request
body must be a JSON object.` behavior. Valid non-object JSON for the new
management command routes maps to the management validation response; the
existing Cost route retains its prior object-only behavior.

The existing endpoint:

```text
/api/admin/cost/ingredients
```

remains the Cost Back Office creation-composition endpoint only. It is not a
second lifecycle-management authority and must not be documented as one.

No future documentation change may add, infer or modify an API contract.

## 7. Verification provenance

Test collections overlap. They must be reported separately and must never be
summed into a fictional total.

### PR #16 approved Head / pre-merge evidence

At approved Head `2b93889fd4a06351d650d73e12ab8567f5fff0f9`:

| Verification collection | Verified result |
| --- | --- |
| Focused PR-INGREDIENT-003A | 14/14 PASS |
| Existing Canonical Ingredient Domain | 21/21 PASS |
| Existing Canonical Ingredient persistence | 18/18 PASS |
| Architecture Guard | 16/16 PASS |
| Configured `npm test` | 64/64 PASS |
| Manually enumerated compiled repository suite | 35 files, 497/497 PASS |
| `npm run verify` | PASS, including migration smoke and upgrade/restart/rerun |
| `npm run verify:full` | PASS, including browser E2E 13/13 |
| Typecheck, lint, build and `git diff --check` | PASS |

### PR #18 approved Head / pre-merge evidence

At approved Head `784bb00912fd957dab6a84448dd8f640f0e166fc`:

| Verification collection | Verified result |
| --- | --- |
| Application focused | 20/20 PASS |
| Canonical Ingredient catalog focused | 21/21 PASS |
| Persistence integration | 21/21 PASS |
| API integration | 3/3 PASS |
| Architecture Guard | 16/16 PASS |
| Configured `npm test` | 64/64 PASS |
| Playwright E2E | 13/13 PASS |
| Manually enumerated compiled repository suite | 36 files, 509/509 PASS |
| Migration smoke and upgrade 014 | PASS |
| `npm run verify` and `npm run verify:full` | PASS |
| Typecheck, lint, build and `git diff --check` | PASS |

The PR #18 review history must retain the resolved findings, including command
precedence, valid non-object JSON handling, API matrix coverage, Architecture
Guard route/namespace protection and restoration of the established malformed
JSON public message.

### Post-merge evidence boundary

Post-merge verification established:

- the normal two-parent merge structure;
- exact approved-parent ordering;
- merge-tree equality with the approved PR Head;
- exact 12-file `+1523/-9` scope;
- remote integration advancement;
- protected blob preservation; and
- clean local worktree and staged state.

The future documentation must not claim that the complete PR #16 or PR #18
test suites were rerun after merge unless a separately dated, independently
verifiable post-merge test run exists.

## 8. Proposed Documentation Work Order allowlist necessity audit

The following 14 paths are candidates for a later, separately authorized
Documentation Work Order. Their presence here does not authorize modifying
them.

| Path | Current stale or missing statement | Exact permitted future correction | Why inclusion is necessary | Governance contradiction if omitted |
| --- | --- | --- | --- | --- |
| `README.md` | Names retired baseline and integration identities | Record `97d6c7b...`, PR #14–#18 completion, 003A/003B completion and 003C exclusion | Repository entry point otherwise directs readers to retired state | Yes |
| `docs/03_DOMAIN_OWNERSHIP.md` | States that lifecycle UI/API remain deferred together | Record completed command/API boundary while preserving deferred UI, navigation and Reference Impact | Current ownership summary directly contradicts implemented API capability | Yes |
| `docs/05_API_CONTRACT.md` | Omits the completed management namespace and behavior | Add only the verified four registrations, six behaviors, status mapping and Cost-route distinction | Public API documentation otherwise omits an existing boundary | Yes |
| `docs/09_TEST_PLAN.md` | Stops before PR #16 and PR #18 evidence | Add separately attributed PR #16 and PR #18 pre-merge evidence and Git-only post-merge verification | Prevents completed work from lacking discoverable verification provenance | Yes |
| `docs/ACTIVE_BRANCHES.md` | Records retired branch, Head and worktree observations | Replace only with a newly dated observation of actual refs and worktrees; do not infer cleanup authority | Existing branch inventory is factually stale | Yes |
| `docs/CHANGELOG.md` | Does not include PR #14 through PR #18 | Append their exact chronology without rewriting prior entries | Required for complete audit traceability | No — omission leaves incomplete audit traceability, not a direct current-state contradiction |
| `docs/CURRENT_STATUS.md` | Describes Ingredient lifecycle application/API as unauthorized | Record 003A/003B completion, current baseline and 003C exclusion | File explicitly claims to describe current status | Yes |
| `docs/DECISIONS.md` | Latest factual synchronization predates Proposal/003A/003B completion | Append one dated, unnumbered factual closeout synchronization; preserve DECISIONS #069 | Central authority register otherwise presents obsolete authorization state | Yes |
| `docs/RELEASE_BASELINE.md` | Designates a retired Architecture Development Baseline | Designate `97d6c7b...` while stating it is not main, release, deployment or runtime provenance | Repository baseline identity document is materially stale | Yes |
| `docs/REPOSITORY_POLICY.md` | Current Development Order stops before Ingredient work | Update only the current-order/status section; leave permanent policy unchanged | Current execution sequence conflicts with merged ancestry | Yes |
| `docs/REPOSITORY_STATUS.md` | Reports retired Git state and an untracked Proposal | Record current baseline, tracked Proposal and completed 003A/003B chronology | Human-readable repository status is materially stale | Yes |
| `docs/ROADMAP.md` | Omits completed Ingredient Proposal/003A/003B sequence | Mark Proposal, 003A and 003B complete; leave 003C pending and unauthorized | Roadmap otherwise presents completed work as absent or future | Yes |
| `docs/bootstrap/CURRENT_AI_HANDOVER.md` | Hands off retired SHA, branch and Ingredient status | Record current Git/baseline, completed capability, protected boundaries and next planning Gate | New sessions would start from the wrong state | Yes |
| `docs/reviews/PR-INGREDIENT-003B_CLOSEOUT_RECORD.md` | Does not exist | Create a retrospective closeout covering authority, chronology, findings, remediation, verification, merge and exclusions | Preserves completion history without rewriting Proposal or Task Cards | Yes |

Candidate scope:

```text
13 modified existing documentation files
1 new PR-INGREDIENT-003B Closeout Record
14 files total
```

The exact allowlist must be reverified before a Documentation Work Order is
issued. No path may be added conditionally or by wildcard.

## 9. Per-file editing boundaries

The future Documentation Work Order may perform only these narrow operations:

1. `README.md`: replace retired current-state identities and capability status.
2. `docs/03_DOMAIN_OWNERSHIP.md`: separate completed lifecycle API capability
   from still-deferred UI and Reference Impact work.
3. `docs/05_API_CONTRACT.md`: add the verified management contract without
   changing runtime behavior.
4. `docs/09_TEST_PLAN.md`: append separated, source-attributed verification
   evidence.
5. `docs/ACTIVE_BRANCHES.md`: record only branches and worktrees observed in a
   new dated reality check.
6. `docs/CHANGELOG.md`: append PR #14 through PR #18 chronology.
7. `docs/CURRENT_STATUS.md`: replace retired current-state claims.
8. `docs/DECISIONS.md`: append an unnumbered factual synchronization only.
9. `docs/RELEASE_BASELINE.md`: update the Architecture Development Baseline
   identity and its explicit non-release boundaries.
10. `docs/REPOSITORY_POLICY.md`: update the Current Development Order only.
11. `docs/REPOSITORY_STATUS.md`: replace retired repository-state observations.
12. `docs/ROADMAP.md`: mark Proposal, 003A and 003B complete while leaving 003C
    unauthorized.
13. `docs/bootstrap/CURRENT_AI_HANDOVER.md`: replace the operational handover
    with the verified post-PR18 state.
14. `docs/reviews/PR-INGREDIENT-003B_CLOSEOUT_RECORD.md`: create the independent
    retrospective closeout.

“Fully update,” “modernize,” “clean up,” “keep current” and similar open-ended
instructions are not authorized.

## 10. PR-INGREDIENT-003B Closeout Record requirements

The new Closeout Record must:

1. identify itself as retrospective governance closeout documentation;
2. cite DECISIONS #069, the accepted Proposal, the 003A and 003B Task Cards and
   the applicable Owner authorization/review/merge/post-merge records;
3. record PR #14 through PR #18 chronology and exact Git identities;
4. record the 003B implementation scope as 12 files, `+1523/-9`;
5. preserve the resolved review and remediation chronology;
6. distinguish PR-Head test evidence from post-merge Git/tree/diff evidence;
7. state that Migration 014 and schema remained unchanged;
8. state that caller actor data remains unverified metadata;
9. state that 003C, UI/navigation and Reference Impact remain unauthorized;
10. state that no main promotion, release or deployment occurred; and
11. state that the record creates no new architecture, product,
    implementation, release or deployment authority.

It must not create, reserve or backdate a Decision number.

## 11. DECISIONS handling

The future `docs/DECISIONS.md` change is limited to one dated, unnumbered
factual synchronization.

It must:

- preserve DECISIONS #069 byte-for-byte in substance;
- identify the Proposal, 003A Task Card, 003B Task Card and Owner Gate records
  as authority;
- record 003A and 003B completion and the current Architecture Development
  Baseline;
- leave 003C unauthorized; and
- make no new architecture or product decision.

It must not:

- create a Decision number;
- reserve a future number;
- backdate authority;
- rewrite an existing Decision; or
- imply that factual closeout authorizes further work.

## 12. Historical integrity

The following records are historical evidence and must remain unchanged:

- `docs/reviews/PR-INGREDIENT-003_CANONICAL_INGREDIENT_LIFECYCLE_APPLICATION_BOUNDARY_PROPOSAL.md`;
- `docs/reviews/PR-INGREDIENT-003A_CANONICAL_INGREDIENT_LIFECYCLE_COMMAND_BOUNDARY_TASK_CARD.md`; and
- `docs/reviews/PR-INGREDIENT-003B_CANONICAL_INGREDIENT_MANAGEMENT_API_TASK_CARD.md`.

Their original “implementation not authorized” wording records their status at
the time of approval. Later authorization and completion belong in current-state
documents and the new Closeout Record, not in rewritten historical records.

Historical findings, blockers and superseded states must be marked resolved or
superseded in later chronology. They must not be erased or rewritten as though
they never existed.

## 13. Files deliberately excluded

The following are outside the future closeout scope:

- `AGENTS.md`;
- `CONSTITUTION.md`;
- `docs/REPOSITORY_WORKING_GUIDE.md`;
- Bootstrap documents `01` through `05`;
- every ADR;
- `docs/02_SYSTEM_ARCHITECTURE.md`;
- `docs/04_DATA_MODEL.md`;
- `docs/ARCHITECTURE_TIMELINE.md`;
- the Ingredient Proposal;
- the 003A Task Card;
- the 003B Task Card;
- every existing Post-PR Task Card;
- Recipe and Cost closeout records;
- Migration 014;
- every path outside the exact 14-path candidate allowlist;
- all source, tests, schema, migrations, scripts, package, runtime, database and
  UI files; and
- branch, worktree, remote-ref or repository-setting changes.

`docs/02_SYSTEM_ARCHITECTURE.md` remains excluded because its deferred statement
concerns Reference Impact coordination/runtime, which remains deferred.
`docs/04_DATA_MODEL.md` remains excluded because PR #18 made no schema change.
`docs/ARCHITECTURE_TIMELINE.md` must not be modernized opportunistically under a
single-purpose 003B closeout.

## 14. Capability and authorization boundaries

The future documentation may state that 003A and 003B are completed. It must
also state that none of the following has been authorized or completed through
this closeout:

- PR-INGREDIENT-003C;
- UI route or navigation work;
- Reference Impact Coordinator;
- reactivation;
- permanent deletion;
- Ingredient merge or alias authority;
- automatic identity resolution;
- name uniqueness constraints;
- authentication or authorization;
- verified operator identity;
- Migration 014 or schema redesign;
- Recipe 001C through 001E;
- Cost Snapshot;
- Supplier, Purchase, Package or Inventory implementation;
- architecture or security remediation;
- branch or worktree cleanup;
- remote `main` creation or `origin/HEAD` remediation;
- main promotion;
- release; or
- deployment.

## 15. Branch, worktree and volatile-state rules

Volatile repository state must always carry an observation date and must be
reverified immediately before future documentation work.

The future work may record:

- actual local and remote branch Heads;
- actual ahead/behind relationships;
- actual worktrees returned by Git;
- remote `main` absence if still observed; and
- the observed `origin/HEAD` target.

It must not:

- assign new evidence status to old worktrees;
- infer branch deletion authority from ancestry containment;
- delete or clean any branch or worktree;
- fix local integration drift;
- change remote default-branch configuration; or
- treat a dated observation as permanent runtime truth.

## 16. Future Documentation Work Order verification

Before any future write, the Documentation Work Order must require:

1. fetch and exact verification of its authorized remote integration base;
2. clean tracked worktree and empty staged area;
3. exact 14-path allowlist inventory;
4. protected Proposal, 003A Task Card, 003B Task Card and Migration 014 blobs;
5. exact PR #14 through PR #18 Git ancestry and statistics;
6. PR #16 and PR #18 test-evidence provenance verification;
7. verification that no overlapping test collections were added together;
8. explicit UTF-8 decoding for every candidate document;
9. final newline and zero trailing whitespace;
10. valid internal Markdown links and static repository paths;
11. consistent Markdown tables;
12. `git diff --check` for tracked files;
13. a no-index whitespace check for the new Closeout Record before staging;
14. confirmation that historical records and excluded paths are unchanged; and
15. a complete pre-commit report with per-file and cumulative statistics.

The Documentation Work Order must stop if a factual correction requires a path
outside the 14-path allowlist.

## 17. Required Gates

### Task Card recording sequence

1. Task Card pre-commit review.
2. Separate Owner commit authorization.
3. Separate push and PR authorization.
4. Independent read-only Task Card PR review.
5. Separate Owner merge authorization.
6. Post-merge verification and Owner acceptance.

### Documentation synchronization sequence

1. Separate Documentation Work Order with the final exact allowlist.
2. Documentation-only preparation.
3. Documentation pre-commit review.
4. Separate Owner commit authorization.
5. Separate push and PR authorization.
6. Independent read-only documentation PR review.
7. Separate Owner merge authorization.
8. Post-merge verification and closeout.

Passing or completing any Gate does not authorize the next Gate.

Merging this Task Card would authorize no documentation synchronization and no
Ingredient implementation.

## 18. Stop conditions

Stop without remediation if:

- the authorized Git base changes without Owner acceptance;
- any protected blob differs;
- the Task Card or future documentation diff exceeds its exact allowlist;
- a new Decision number appears necessary;
- an existing Decision would need substantive modification;
- API facts cannot be proven from the accepted implementation;
- PR #16 or PR #18 test provenance cannot be verified without inventing data;
- a historical Proposal or Task Card would need rewriting;
- any source, test, schema, migration, package, runtime, database or UI change is
  required;
- 003C, Reference Impact, reactivation, delete, merge, authentication or
  authorization work appears;
- branch/worktree cleanup appears necessary;
- main promotion, release or deployment is requested; or
- a failing documentation check cannot be resolved within the expressly
  authorized documentation path and wording scope.

Do not repair a stop condition under this Task Card. Report it and wait for a
new Owner decision.

## 19. Current Task Card status

This file records the Owner-authorized Task Card draft only.

```text
Task Card recording candidate:
PREPARED — UNSTAGED AND UNCOMMITTED

Documentation synchronization:
NOT AUTHORIZED

PR-INGREDIENT-003C:
NOT AUTHORIZED
```

The next permitted action is Owner review of this single-file Task Card
candidate at the Task Card Pre-Commit Review Gate.
