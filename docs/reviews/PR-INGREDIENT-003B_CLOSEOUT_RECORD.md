# PR-INGREDIENT-003B Closeout Record

Status: COMPLETED / MERGED

Record date: 2026-08-10 (Asia/Taipei)

Record character: Retrospective governance closeout documentation

This record preserves the verified governance, implementation, review,
remediation, merge, and post-merge history of PR-INGREDIENT-003B. It creates no
new architecture, product, implementation, release, deployment, cleanup, or
Decision authority.

## 1. Authority

PR-INGREDIENT-003B proceeded under:

- DECISIONS #069 Canonical Ingredient Lifecycle Governance Alignment;
- the Owner-accepted
  `PR-INGREDIENT-003_CANONICAL_INGREDIENT_LIFECYCLE_APPLICATION_BOUNDARY_PROPOSAL.md`;
- the Owner-approved
  `PR-INGREDIENT-003A_CANONICAL_INGREDIENT_LIFECYCLE_COMMAND_BOUNDARY_TASK_CARD.md`;
- the Owner-approved
  `PR-INGREDIENT-003B_CANONICAL_INGREDIENT_MANAGEMENT_API_TASK_CARD.md`;
- separate Owner implementation, pre-commit, commit, push/PR, review, merge,
  and post-merge Gates for 003A and 003B;
- PR #16 and PR #18 independent read-only reviews; and
- PR #18 remediation review and post-merge verification.

No new DECISIONS number was created, reserved, or backdated. DECISIONS #069
remains unchanged in substance.

## 2. Protected records

| Record | Integrated Git blob |
| --- | --- |
| Ingredient Proposal | `35a41567b16a714e154162042fba1ee0f6d160d9` |
| PR-INGREDIENT-003A Task Card | `d678765982fa11e9921ab898dfc4d878bbcd7e10` |
| PR-INGREDIENT-003B Task Card | `9453d54b4ad0529c84c277f61ebb83efcae0c1ec` |
| Post-PR18 closeout Task Card | `5ef657585a80d3d0aaa23f8826e513940409a56d` |
| Migration 014 | `5bcc40cddfe9ba14db7dc6a5e8da2d46f41ee23d` |

The Proposal and Task Cards retain their original point-in-time
“implementation not authorized” wording. Later authorization and completion
are recorded here rather than by rewriting those historical records.

## 3. PR chronology

| PR | Purpose | Base | Approved Head | Merge commit | Scope |
| --- | --- | --- | --- | --- | --- |
| #14 | Record accepted Ingredient Proposal | `2bd115ed2b78e10d549dabe38b28f6c824aaf65b` | `850dab8265c8a40e956e1dae39a294c35367ee49` | `b3f2e5e28ff55f988859c8e438f8128875d80fe7` | 1 file, `+584/-0` |
| #15 | Record 003A Task Card | `b3f2e5e28ff55f988859c8e438f8128875d80fe7` | `d115e1e2446b5a6b12098cb449a38a62d7820ffa` | `f8dc8af112deaf478621bb653cd782d09e0425db` | 1 file, `+996/-0` |
| #16 | Implement 003A command boundary | `f8dc8af112deaf478621bb653cd782d09e0425db` | `2b93889fd4a06351d650d73e12ab8567f5fff0f9` | `b5641482bbfe34d110ccdf40d1ab5347850a9155` | 6 files, `+878/-3` |
| #17 | Record 003B Task Card | `b5641482bbfe34d110ccdf40d1ab5347850a9155` | `3de9b2d3012792353707edde478be706341ba05f` | `5c2a69282567c6456a5d2e7e2628270a03847e57` | 1 file, `+701/-0` |
| #18 | Implement 003B management persistence/API | `5c2a69282567c6456a5d2e7e2628270a03847e57` | `784bb00912fd957dab6a84448dd8f640f0e166fc` | `97d6c7b52f09643b2cafaa50711f76ccc1ae7a96` | 12 files, `+1523/-9` |
| #19 | Record post-PR18 closeout Task Card | `97d6c7b52f09643b2cafaa50711f76ccc1ae7a96` | `7c80fbd13bb196d9c78e938baeb9625a6658e1d3` | `58cce2327f3f7121442e8a0cd4cd29693b9fde3c` | 1 file, `+565/-0` |

Each PR used a normal two-parent merge commit with the approved PR Head as the
second parent. The merged feature branches remain remotely available;
containment in integration does not authorize deletion.

## 4. PR-INGREDIENT-003A prerequisite completion

PR #16 completed the command-facing Application boundary:

- readonly management, command, result, and duplicate-warning contracts;
- synchronous Rename and Archive commands;
- a Repository dependency restricted to `findById`,
  `findDuplicateCandidates`, and `saveWithExpectedVersion`;
- version-first error precedence;
- stable typed Application errors;
- caller-reported audit metadata mapping;
- non-blocking duplicate warnings that exclude the current identity and
  preserve Repository ordering; and
- Architecture Guard protection for the additive public surface.

It did not change the Repository Port, SQLite implementation, API, runtime,
composition, UI, schema, or migration.

## 5. PR-INGREDIENT-003B completed capability

PR #18 completed in one atomic, typecheckable PR:

- Repository Port methods `listActiveForManagement()` and
  `listArchivedForManagement()`;
- the sole production SQLite Repository implementation of both methods;
- updates to the known full Repository contract fixture;
- deterministic `name ASC`, then `ingredientId ASC` ordering within each
  lifecycle selector;
- preservation of the existing Cost-facing `listActive()` behavior;
- management list/detail Application reads;
- the dedicated server adapter;
- centralized composition in `src/server/index.ts`;
- four Canonical Ingredient management route registrations;
- persistence close/reopen and historical-read coverage;
- API integration coverage; and
- Architecture Guard protection of the Port, public exports, internal imports,
  composition exception, route namespace, and no-UI boundary.

The 12-file implementation scope was:

```text
M src/domains/recipe/index.ts
A src/domains/recipe/ingredient-catalog/application/canonical-ingredient-management-read-service.ts
M src/domains/recipe/ingredient-catalog/canonical-ingredient-repository.ts
M src/domains/recipe/ingredient-catalog/infrastructure/sqlite-canonical-ingredient-repository.ts
A src/server/app/canonical-ingredient-management-service.ts
M src/server/app/routes.ts
M src/server/index.ts
M src/tests/architecture-guards.test.ts
M src/tests/canonical-ingredient-catalog.test.ts
A src/tests/canonical-ingredient-lifecycle-api.integration.test.ts
M src/tests/canonical-ingredient-lifecycle-application.test.ts
M src/tests/canonical-ingredient-persistence.integration.test.ts
```

No thirteenth implementation path was introduced.

## 6. Management behavior and API boundary

The completed management namespace is:

```text
/api/admin/canonical-ingredients
```

Four route registrations implement six behaviors:

1. list all;
2. list Active;
3. list Archived;
4. detail;
5. Rename; and
6. Archive.

List-all returns the complete Active section followed by the complete Archived
section, preserving `name ASC`, then `ingredientId ASC` within each section.
Archived identities remain readable for historical evidence.

Accepted HTTP mapping:

| Application outcome | HTTP status |
| --- | ---: |
| Validation failure | `422` |
| Not Found | `404` |
| Version Conflict, Already Archived, Archived Rename Rejected, or Invalid Lifecycle Transition | `409` |
| Persistence failure | `500` |

Malformed JSON syntax retains
`400 / invalid_json / Request body must be a JSON object.`. Valid non-object
JSON on management command routes maps to `422`. Raw Repository and SQLite
messages, stacks, and causes do not cross the Application/HTTP boundary.

`POST /api/admin/cost/ingredients` remains the existing Cost Back Office
creation-composition endpoint. It is not a competing lifecycle-management
namespace and no second Canonical Ingredient authority was introduced.

## 7. Review and remediation chronology

The completed result preserves rather than erases these review findings:

1. The 003B Task Card review corrected “all six routes” to the precise “four
   route registrations implement six API behaviors” wording.
2. Implementation-readiness review corrected a stop condition that could have
   prohibited the allowlisted SQLite Repository change and clarified that only
   database/shared-adapter infrastructure outside the 12-file allowlist was
   excluded.
3. Independent implementation review found that eager server-adapter field
   validation could override 003A Not Found, stale-version, and terminal
   lifecycle precedence. The authorized candidate deferred those reads so the
   003A service remained authoritative.
4. Review found that valid non-object JSON was still handled by the shared
   malformed-JSON path and that required API/Architecture Guard evidence was
   incomplete. The candidate separated management shape validation, expanded
   the API matrix, and strengthened exact namespace/route guards.
5. Owner pre-commit review found a public malformed-JSON message drift from
   `Request body must be a JSON object.`. Narrow remediation restored the
   exact existing message and added permanent management/Cost compatibility
   coverage.
6. Final independent PR review reported zero blocking and zero non-blocking
   findings. The merge and post-merge Git verification then passed.

These findings were resolved before the approved commit and are retained as
historical quality evidence, not current open defects.

## 8. Verification provenance

Selections overlap and are never summed.

### PR #16 approved Head

At `2b93889fd4a06351d650d73e12ab8567f5fff0f9`:

| Collection | Result |
| --- | --- |
| Focused 003A | 14/14 PASS |
| Existing Canonical Ingredient Domain | 21/21 PASS |
| Existing Canonical Ingredient persistence | 18/18 PASS |
| Architecture Guard | 16/16 PASS |
| Configured `npm test` | 64/64 PASS |
| Compiled repository enumeration | 35 files, 497/497 PASS |
| `npm run verify` | PASS |
| `npm run verify:full` | PASS, including E2E 13/13 |
| Typecheck, lint, build, migration, and diff checks | PASS |

### PR #18 approved Head

At `784bb00912fd957dab6a84448dd8f640f0e166fc`:

| Collection | Result |
| --- | --- |
| Application focused | 20/20 PASS |
| Catalog focused | 21/21 PASS |
| Persistence integration | 21/21 PASS |
| API integration | 3/3 PASS |
| Architecture Guard | 16/16 PASS |
| Configured `npm test` | 64/64 PASS |
| Playwright E2E | 13/13 PASS |
| Compiled repository enumeration | 36 files, 509/509 PASS |
| Migration smoke and upgrade 014 | PASS |
| `npm run verify` and `npm run verify:full` | PASS |
| Typecheck, lint, build, and diff checks | PASS |

### Post-merge boundary

Post-merge verification confirmed merge parents, merge-tree equality, exact
scope/statistics, protected blobs, remote integration advancement, and clean
Git state. It did not rerun the complete test selections above. PR #19 was a
documentation-only Task Card merge and did not rerun product tests.

## 9. Baseline and delivery status

The Owner accepted:

```text
97d6c7b52f09643b2cafaa50711f76ccc1ae7a96
```

as the Architecture Development Baseline after PR #18.

PR #19 later advanced the integration Git Head to:

```text
58cce2327f3f7121442e8a0cd4cd29693b9fde3c
```

by merging only the closeout Task Card. PR #19 does not redesignate the formal
baseline. Neither SHA is remote `main`, main promotion, a product release,
deployment, runtime provenance, or production database provenance.

## 10. Preserved exclusions

The following remain unauthorized or unimplemented by this closeout:

- PR-INGREDIENT-003C UI/navigation;
- Reference Impact Coordinator;
- reactivation;
- permanent deletion;
- Ingredient merge or aliases;
- automatic identity resolution;
- name uniqueness constraints;
- authentication, authorization, or verified operator identity;
- Migration 014 or schema redesign;
- Recipe 001C through 001E;
- Cost Snapshot;
- Supplier, Purchase, Package, or Inventory implementation;
- architecture or security remediation;
- branch or worktree cleanup;
- remote `main` creation or `origin/HEAD` remediation;
- main promotion;
- release; and
- deployment.

Caller-provided actor metadata remains caller-reported and unverified.

## 11. Closeout result

```text
PR-INGREDIENT-003A:
COMPLETED / MERGED

PR-INGREDIENT-003B:
COMPLETED / MERGED

PR #18 Post-Merge Owner Gate:
PASSED AND CLOSED

Architecture Development Baseline:
97d6c7b52f09643b2cafaa50711f76ccc1ae7a96

PR-INGREDIENT-003C:
NOT AUTHORIZED
```

This retrospective record closes the governance trail for 003B only. It does
not select or authorize the next product work item.
