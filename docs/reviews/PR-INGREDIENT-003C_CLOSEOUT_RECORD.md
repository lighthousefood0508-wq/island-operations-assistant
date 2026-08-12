# PR-INGREDIENT-003C Closeout Record

Status: Prepared retrospective closeout record — governance closure not yet effective

Record date: 2026-08-11 (Asia/Taipei)

This record preserves the verified implementation, remediation, review, and
merge history of PR-INGREDIENT-003C. It creates no new architecture, product,
implementation, Git, release, deployment, runtime, or database authority. Its
target status is `CLOSED`, but closure becomes effective only after this
documentation set passes independent review and receives separate Owner
authorization for commit, push, Pull Request, and merge.

## 1. Existing authority

This closeout is governed by existing authority only:

- **DECISIONS #069 — Canonical Ingredient Lifecycle Governance Alignment**;
- the Owner-accepted PR-INGREDIENT-003 Proposal;
- the merged PR-INGREDIENT-003A command-boundary Task Card and implementation;
- the merged PR-INGREDIENT-003B management read/persistence/API Task Card and
  implementation;
- the merged PR-INGREDIENT-003C management UI/navigation Task Card;
- the Owner-authorized Ingredient 003C implementation and six remediation
  rounds;
- the independent final PR review, merge authorization, and post-merge
  validation accepted by the Owner.

This record creates, reserves, or backdates no Decision number. In particular,
it does not create or occupy `DECISIONS #071`, and it does not change the
substance of DECISIONS #069.

## 2. Protected governance and migration seals

| Record | Git blob |
| --- | --- |
| PR-INGREDIENT-003 Proposal | `35a41567b16a714e154162042fba1ee0f6d160d9` |
| PR-INGREDIENT-003A Task Card | `d678765982fa11e9921ab898dfc4d878bbcd7e10` |
| PR-INGREDIENT-003B Task Card | `9453d54b4ad0529c84c277f61ebb83efcae0c1ec` |
| Migration 014 | `5bcc40cddfe9ba14db7dc6a5e8da2d46f41ee23d` |
| PR-INGREDIENT-003C Task Card | `085858fd39ec5d4d614b862f6e9e664da381f1a5` |

All five records remained unchanged through PR #23 and the accepted post-merge
validation.

## 3. Dependency chain and Migration 014

The accepted sequence is atomic by boundary:

1. PR-INGREDIENT-003A established synchronous Rename and Archive Application
   commands, typed outcomes, version-first precedence, caller-reported audit
   metadata, and non-blocking duplicate warnings.
2. PR-INGREDIENT-003B added deterministic Active/Archived reads, SQLite
   implementation, server composition, and the management API under
   `/api/admin/canonical-ingredients` while preserving the 003A contract.
3. PR-INGREDIENT-003C added only the API-backed management UI at
   `/admin/ingredients`, navigation, route proof, Architecture Guard coverage,
   and browser acceptance evidence.

Migration 014 remains the historical Canonical Ingredient persistence
foundation. Ingredient 003C did not modify Migration 014, add a migration,
redesign schema, access SQLite directly, or move persistence authority into the
browser.

## 4. Task Card recording — PR #22

PR #22 recorded the independently reviewed 003C Task Card only:

```text
PR:           #22
Base:         124f4487b5af672a1b9be6a26993919ad2a6caad
Head:         594a0504a0c3a5e3ca92501201cf12eb9a4c0e81
Merge commit: c15a03e138e21328a3db0c88f861bca1b6af7e8c
Parents:      124f4487b5af672a1b9be6a26993919ad2a6caad
              594a0504a0c3a5e3ca92501201cf12eb9a4c0e81
Merge tree:   bbb9dab591355b2380f28e6347005f926206aa32
Commits:      1
Statistics:   1 file, +893/-0
Path:         docs/reviews/PR-INGREDIENT-003C_CANONICAL_INGREDIENT_MANAGEMENT_UI_TASK_CARD.md
Blob:         085858fd39ec5d4d614b862f6e9e664da381f1a5
Lines:        893
Raw SHA-1:    5c6d37eac11d2008b45f2c6346c4ea4d78581c10
```

PR #22 created no implementation authority by itself. Implementation began
only under a later dedicated Owner Work Order.

## 5. Implementation merge — PR #23

```text
PR:                     #23
Base branch:            integration/architecture-development
Base SHA:               c15a03e138e21328a3db0c88f861bca1b6af7e8c
Feature branch:         feature/pr-ingredient-003c-management-ui
Final approved Head:    06929a7c73e370e1a2e0ba4fd230cdbdb0f19a35
Merge commit:           ea46678cbb955b7aeb093dc34525c52325af9cae
Merge first parent:     c15a03e138e21328a3db0c88f861bca1b6af7e8c
Merge second parent:    06929a7c73e370e1a2e0ba4fd230cdbdb0f19a35
Merge tree:             7cfc3d7d7d1c661e6363f9a60be87941db886e61
Feature commits:        7
Files:                  6
Statistics:             +1288/-11
Remote checks:          NOT CONFIGURED
Final review findings:  0 blocking / 0 non-blocking
```

The remote feature branch remained present at the approved Head after merge.
Its retention does not authorize cleanup, deletion, or reuse.

## 6. Seven feature commits

| Order | Commit | Purpose |
| ---: | --- | --- |
| 1 | `3556477ab4c12a1cc36be4e726f20e1a1d77f299` | Add Canonical Ingredient management UI |
| 2 | `44023298e246c6cc96138f458b522bb13f49c5f8` | Harden management UI state reconciliation |
| 3 | `c2825a716cf341ff36a578364b7e7312f3696dc8` | Fail closed on conflict refresh errors |
| 4 | `a381c39894e63915de4e1f5a836cc26d3fba3e52` | Complete conflict preservation matrix |
| 5 | `efe6a26e91c75f5aaa5fc9ab0eb2aee81bd1ce63` | Distinguish conflict version evidence |
| 6 | `7d71a424a1f3e9c39f3575245cd45e1693f3ab22` | Complete encoded Rename request evidence |
| 7 | `06929a7c73e370e1a2e0ba4fd230cdbdb0f19a35` | Make datetime evidence timezone-reproducible |

The commit chain was preserved intact by a standard two-parent merge commit.

## 7. Exact merged scope

| Path | Additions | Deletions | Responsibility |
| --- | ---: | ---: | --- |
| `src/server/app/routes.ts` | 2 | 0 | Serve the management page route |
| `src/tests/architecture-guards.test.ts` | 95 | 8 | Protect route, navigation, dependency, rendering, and six-path boundaries |
| `src/tests/canonical-ingredient-lifecycle-api.integration.test.ts` | 31 | 2 | Prove page route while retaining 003B API/no-create behavior |
| `src/web/ingredients/page.ts` | 114 | 0 | Render and orchestrate the management UI through the API only |
| `src/web/shared/navigation.ts` | 2 | 1 | Add `ingredients` / `食材主檔` in the accepted location |
| `tests/e2e/canonical-ingredient-management.spec.ts` | 1044 | 0 | Desktop, representative mobile, concurrency, failure, safety, and request evidence |
| **Total** | **1288** | **11** | **6 files** |

No Domain, Repository, SQLite, Database Adapter, Migration, schema, package,
composition-root, Cost, Recipe, or other Domain file changed.

## 8. Implemented capability

The completed technical boundary provides:

- `GET /admin/ingredients` and the `ingredients` / `食材主檔` navigation entry
  after Product Catalog and before Cost Center;
- All, Active, and Archived collection views;
- stable selection and detail/history display;
- Rename with non-blocking duplicate-warning display;
- explicit Archive confirmation;
- caller-entered `actor`, `occurredAt`, and `reason`, with local time converted
  deterministically to UTC ISO and no fallback evidence;
- version-aware requests and code-specific 409 reconciliation;
- fail-closed behavior when conflict refresh is unavailable, malformed, or
  unusable;
- safe text-node rendering for remote and operator-controlled values; and
- representative desktop and mobile operability coverage.

The browser remains presentation and request-orchestration only. It does not
derive Domain facts, invent aggregate versions, persist authority, or access
Repository/SQLite/Database infrastructure directly.

## 9. Six remediation rounds

| Round | Blocking evidence and authorized correction | Result |
| ---: | --- | --- |
| 1 | Correct command-response identity handling, selection reconciliation, initial/offline/unusable response behavior, code-specific error mapping, and mandatory E2E evidence | Remediated; original findings advanced toward closure |
| 2 | Preserve last successfully loaded detail and fail closed when conflict refresh fails | Remediated and retained |
| 3 | Exercise the complete four-case 409 preservation matrix with refresh failure modes | Remediated; matrix added |
| 4 | Prove distinct non-zero A/B aggregate versions, exact request ownership, and encoded operation paths | Remediated; fallback-zero ambiguity removed |
| 5 | Capture and assert the runtime encoded Rename request payload and decode-once behavior | Remediated; payload evidence made exact |
| 6 | Pin the spec-local browser timezone and make local-time-to-UTC evidence reproducible across host timezones | Remediated; fresh `TZ=UTC` run passed |

No remediation expanded the approved six-file scope.

## 10. Original Finding closure matrix

| Original finding | Final status | Closure evidence |
| --- | --- | --- |
| 1. Command response identity safety | `CLOSED` | Response identity is reconciled against the active request/selection before presentation state changes |
| 2. Filter and selection reconciliation | `CLOSED` | Filter changes, stale responses, missing identities, and preserved detail are covered |
| 3. Initial, offline, and unusable responses | `CLOSED` | Safe notices/errors and fail-closed state are proven without inventing business facts |
| 4. Error mapping | `CLOSED` | 422, 404, code-specific 409, 500, network, and malformed/unusable responses are distinct |
| 5. Mandatory E2E evidence | `CLOSED` | Full conflict matrix, distinct versions, encoded identity/payload, timezone, desktop, and mobile evidence passed |

Final independent verdict: `PASSED`.

- Blocking findings: `0`
- Non-blocking findings: `0`

## 11. Mandatory E2E closure evidence

The final E2E evidence includes:

- four named 409 cases with real, distinct, non-zero A/B versions;
- exact A command payload and exactly one A POST;
- B remaining selected, readable, Active, and actionable after A conflict;
- a separate B validation probe proving the exact B `expectedVersion` without
  server mutation;
- refresh success, refresh failure, stale-response suppression, no retry, and
  fail-closed behavior;
- raw identity characters encoded exactly once in detail and Rename paths;
- exact five-field Rename DTO including version and caller audit evidence;
- file-local `Asia/Taipei` browser timezone with explicit `+08:00` expected
  conversion and a fresh host `TZ=UTC` focused run;
- complete desktop flows and representative responsive/mobile operability; and
- absence of unsafe HTML sinks and browser-storage authority.

## 12. Independent PR-head evidence

At approved Head `06929a7c73e370e1a2e0ba4fd230cdbdb0f19a35`, the
final independent review reported:

| Collection | Result |
| --- | --- |
| Typecheck | PASS |
| Lint | PASS |
| Build | PASS |
| Focused API integration | 3/3 PASS |
| Architecture Guard | 16/16 PASS |
| Repository-configured `npm test` | 64/64 PASS |
| `npm run verify` | PASS |
| Focused Ingredient management E2E | 9/9 PASS |
| Complete E2E | 22/22 PASS |
| `npm run verify:full` | PASS |
| Manually enumerated compiled repository suite | 36 files, 509/509 PASS |
| Fresh host `TZ=UTC` focused E2E | 9/9 PASS |
| Diff, UTF-8, final-newline, trailing-whitespace, no-index, forbidden-sink/storage, path, and seal audits | PASS |

The first manual compiled-suite attempt timed out before the complete collection
finished. That incomplete result was not counted as PASS, and no single-case or
partial retry was used as a substitute. The complete collection of all 36
compiled test files was then rerun fresh; its final accepted result was 509/509
PASS.

The collections overlap and are not added into a fictional total. GitHub
reported no configured check runs or status contexts, so remote checks are
recorded as `NOT CONFIGURED`, not as passed.

## 13. Post-merge validation

Post-merge validation independently confirmed:

- PR #23 remained merged at `ea46678cbb955b7aeb093dc34525c52325af9cae`;
- both merge parents and merge tree were exact;
- the merge tree equaled the approved feature Head tree;
- the final scope remained six files and `+1288/-11`;
- all five protected seals remained exact;
- the feature branch remained present;
- required typecheck, lint, build, API, Architecture Guard, configured test,
  verify, focused/full E2E, verify:full, manual compiled-test, timezone, and
  static checks passed; and
- the worktree and staged area were clean after validation.

Passing validation establishes technical development evidence. It does not
prove a deployed process, production database, release, or `main` identity.

## 14. Architecture Development Baseline

The Owner accepted:

```text
ea46678cbb955b7aeb093dc34525c52325af9cae
```

as the Architecture Development Baseline after PR #23. It is also the remote
integration Head and base of this prepared documentation branch at preparation
time. It is not a permanent promise that integration will never advance.

The designation does not create remote `main`, promote local `main`, establish
a release, deploy software, identify a running process, or identify a
production SQLite database.

## 15. Preserved exclusions and deferred work

This closeout does not authorize or claim completion of:

- Ingredient 003D;
- Reference Impact Coordinator or deletion eligibility;
- Reactivation;
- permanent deletion;
- Ingredient merge, aliases, automatic identity resolution, or name uniqueness;
- Create in the lifecycle management namespace;
- authentication, authorization, user management, or trusted operator identity;
- Migration 014 or schema changes;
- API, Domain, Repository, persistence, or UI changes beyond the merged PR #23;
- Recipe 001C through 001E;
- Cost Snapshot, Supplier, Purchase, Package, or Inventory work;
- branch or worktree cleanup;
- remote `main` creation, `origin/HEAD` remediation, main promotion;
- release or deployment; or
- production runtime or database provenance.

Caller-provided actor information remains unverified metadata and append-only
evidence only.

## 16. Governance closure condition

Ingredient 003C implementation is technically complete and its target
governance status is `CLOSED`. At preparation time, however, this record and
the synchronized current-state documents are unstaged working-tree changes.

Governance closure becomes effective only when all later Gates occur under
separate Owner authorization:

1. independent pre-commit documentation review;
2. commit authorization and exact committed-scope verification;
3. push and Pull Request authorization;
4. independent review of the actual PR diff;
5. Owner merge authorization; and
6. post-merge verification and final Owner acceptance.

Until then, this record must be described as prepared retrospective closeout
documentation, not as an already merged or effective governance closeout.

Prepared target result:

```text
PR-INGREDIENT-003C
Implementation: TECHNICALLY COMPLETE
Governance closeout target: CLOSED
Architecture Development Baseline:
ea46678cbb955b7aeb093dc34525c52325af9cae
Closeout effectiveness: PENDING INDEPENDENT REVIEW AND OWNER-AUTHORIZED MERGE
```
