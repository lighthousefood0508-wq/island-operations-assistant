# PR-INGREDIENT-003J — Ingredient Measurement Profile Draft-First Re-establishment Application Boundary

> **OWNER-APPROVED TASK CARD — IMPLEMENTATION NOT AUTHORIZED**

## 1. Authority and baseline

- Decision: **DECISIONS #077 — Ingredient Measurement Profile Re-establishment After Standalone Deprecation**.
- Required implementation baseline: `integration/architecture-development` at this governance recording commit or a later Owner-authorized descendant that contains it.
- DECISIONS #069, #073–#076; PR-MEASUREMENT-001; PR-MEASUREMENT-001R; accepted Ingredient Task Cards; and the existing Ingredient Measurement Profile Aggregate remain authoritative unless this Card expressly and narrowly adds a boundary.
- This recording is not implementation authorization, `main`, release, deployment, or runtime provenance.

## 2. Single responsibility

Deliver the complete synchronous Application boundary required to re-establish a Measurement Profile after standalone deprecation:

```text
Deprecated history → append new Draft → revise Draft as needed → activate Draft
```

The old Deprecated Version is immutable. This Card neither reactivates it nor creates a direct `Deprecated -> Active` transition, a new Profile aggregate, a second Profile authority, or UI/navigation.

## 3. Fixed lifecycle contract

1. A new Draft Version may be appended only when the aggregate terminal Version is `Deprecated` and the aggregate has no Draft or Active Version.
2. The Draft receives a new immutable Version identity under the same Profile and Ingredient and is appended at the next Version position. Only one Draft may exist at a time.
3. The append command records `CREATED` audit evidence. A Draft has no `effectiveFrom` or `effectiveTo`; Draft creation/audit time is distinct from later activation.
4. Draft creation and each revision must not predate the terminal Deprecated Version's `effectiveTo` or prior lifecycle evidence.
5. A Draft revision is valid only for that Draft and appends `DRAFT_REVISED` evidence. Each append/revise request supplies complete raw Measurement facts; partial HTTP patch semantics are not authorized.
6. Activation continues through the Aggregate's Draft-to-Active lifecycle behavior. Activation `occurredAt` is the new Active Version's `effectiveFrom` and must be no earlier than the former terminal Deprecated Version's `effectiveTo`. Equal transition instants and a gap are valid; overlap and backdating are invalid.
7. The new Draft must retain the terminal Deprecated Version's typed dimension and canonical unit code. The Aggregate may compare typed equality only; it must not duplicate Measurement compatibility authority.
8. Archived Ingredients reject append, revise, and activation with zero write. Existing optimistic `expectedVersion` / `saveWithExpectedVersion(...)` semantics apply to every mutation; conflicts have zero write and no retry.
9. Historical pinned Profile, Recipe, and Quote evidence remains immutable and resolvable at valid historical instants. While the Draft is not Active, current/future normalization continues to fail closed through existing missing-active-profile behavior.

## 4. Command and HTTP contract

### Append Draft

```text
POST /api/admin/cost/profiles/:profileId/re-establishment-drafts
```

Accepts `expectedVersion`, complete raw Measurement facts, `occurredAt`, `actor`, and optional `reason`; creates the new Draft and returns HTTP `201`.

### Revise Draft

```text
PATCH /api/admin/cost/profiles/:profileId/drafts/:draftVersionId
```

Accepts `expectedVersion`, complete raw Measurement facts, `occurredAt`, `actor`, and optional `reason`; returns the updated Draft Profile contract with HTTP `200`.

### Activate Draft

```text
POST /api/admin/cost/profiles/:profileId/drafts/:draftVersionId/activations
```

Accepts `expectedVersion`, `occurredAt`, `actor`, and optional `reason`; returns the updated Active Profile contract with HTTP `200`.

| Stable error code | HTTP | Meaning |
| --- | ---: | --- |
| `measurement_profile_reestablishment_invalid` | 422 | Invalid command, invalid lifecycle state, one-Draft rule, typed-basis mismatch, timeline violation, or Aggregate rejection. |
| `measurement_profile_not_found` | 404 | Requested Profile or Draft Version does not exist. |
| `measurement_profile_ingredient_inactive` | 422 | Bound Canonical Ingredient is Archived/inactive. |
| `measurement_profile_expected_version_conflict` | 409 | Supplied optimistic-concurrency version is stale. |
| `measurement_profile_measurement_resolution_failed` | 422 | Formal Measurement facts resolution rejected the raw facts. |
| `measurement_profile_reestablishment_persistence_failed` | 500 | A lookup or persistence operation failed through the safe typed boundary. |

SQLite/DB messages, stacks, causes, infrastructure types, and raw persistence detail must never enter an HTTP response.

## 5. Ownership and persistence boundaries

The Application Service may depend only on existing Recipe-hosted Profile Aggregate/value types, a narrow Recipe-owned structural lookup/persistence dependency, a narrow Canonical Ingredient lookup/Active-state dependency, and `MeasurementProfileFactsResolutionContractV1`.

It must not import SQLite implementations, `DatabaseAdapter`, BetterSqlite3, infrastructure-specific errors, Cost business authority, a broad mutable Repository port, or a local Measurement resolver/whitelist/parser/cast.

The Aggregate remains lifecycle/invariant authority. Persistence changes are limited to mapper replay and internal transition validation needed for the legal `Active -> Deprecated -> Draft -> Active` history. No Repository public-contract widening, Aggregate redesign, migration, or schema change is authorized.

Cost Back Office only parses, delegates, and maps safe failures. `src/server/index.ts` is the sole production composition site.

## 6. Exact fifteen-path implementation allowlist

1. `src/domains/recipe/measurement-profile/ingredient-measurement-profile.ts` — append-Draft and timeline/basis lifecycle invariants only.
2. `src/domains/recipe/measurement-profile/persistence/measurement-profile-persistence-mapper.ts` — legal append-after-deprecation history replay only.
3. `src/domains/recipe/measurement-profile/infrastructure/sqlite-ingredient-measurement-profile-repository.ts` — internal single-transition validation for legal Draft append only.
4. `src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-reestablishment-service.ts` — orchestration only.
5. `src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-reestablishment-errors.ts` — typed safe failures only.
6. `src/domains/recipe/index.ts` — additive public export only.
7. `src/server/app/cost-back-office-service.ts` — facade parsing, delegation, and safe mapping only.
8. `src/server/app/routes.ts` — register only the three authorized Cost facade operations.
9. `src/server/index.ts` — sole dependency composition site.
10. `src/tests/ingredient-measurement-profile.test.ts` — Aggregate lifecycle and immutable-history evidence.
11. `src/tests/ingredient-measurement-profile-persistence.integration.test.ts` — persistence mapper/hydration and legacy-history evidence.
12. `src/tests/ingredient-measurement-profile-reestablishment-application.test.ts` — focused Application evidence.
13. `src/tests/cost-back-office-api.integration.test.ts` — HTTP contract and safe failure evidence.
14. `src/tests/architecture-guards.test.ts` — responsibility, dependency, route, composition, and exact-scope Guards.
15. `tests/e2e/cost-back-office.spec.ts` — existing Cost Back Office coverage without UI expansion.

Every other path is prohibited. A sixteenth path is a stop condition.

## 7. Required tests

### Aggregate and persistence

- legal `Active -> Deprecated -> Draft -> Active` hydration and round-trip;
- Draft has no effective range, has unique identity, and is append-only;
- one-Draft-at-a-time, typed dimension/canonical-unit retention, timeline monotonicity, equality boundary, allowed gap, rejected overlap/backdating;
- old Deprecated Version and all pinned Profile/Recipe/Quote evidence remain unchanged and historically resolvable;
- existing pre-003J persisted histories hydrate unchanged; and
- current normalization remains fail-closed until the new Draft activates.

### Application, API, and E2E

- append, revise, and activate use formal Measurement facts resolution without Application-local Measurement truth;
- missing Profile/Draft, invalid terminal state, Archived Ingredient, stale expectedVersion, Measurement-resolution failure, Aggregate rejection, lookup failure, and persistence failure produce safe typed outcomes and zero writes where applicable;
- HTTP success codes are `201`, `200`, and `200` respectively; `404`, `409`, `422`, and `500` use the specified stable safe codes;
- Profile creation, supersession, and deprecation contracts remain unchanged; and
- existing Cost Back Office flows have no UI/navigation expansion.

### Regressions and verification

- Profile lifecycle/persistence/history, normalization, pinned Profile, Recipe projection, Quote normalization/evaluation, Canonical Ingredient lifecycle, Reference Impact, 003F–003I, and Measurement prerequisite regressions;
- `npm run typecheck`, `npm run lint`, `npm run build`, focused tests, `npm run architecture:guard`, `npm test`, `npm run verify`, `npm run test:e2e`, `npm run verify:full`, and manual enumeration of compiled `dist/tests/*.test.js` files;
- `git diff --check`; and
- exact fifteen-path, UTF-8, final-newline, and trailing-whitespace audits.

## 8. Required Architecture Guards

Guards must prove that the re-establishment Service is the sole new orchestration authority; Cost Back Office delegates; `src/server/index.ts` is the only composition site; only the three authorized Cost routes exist; Application code has no SQLite/infrastructure/Cost/local-Measurement authority dependency; and the exact fifteen-path responsibility scan, using the same classifier, rejects a simulated unauthorized sixteenth re-establishment path.

## 9. Explicit exclusions and stop conditions

003J must not include Ingredient Reactivate/Delete/Merge, Purchase authority, Cost Snapshot authority, UI/navigation, a second Profile aggregate, direct Deprecated reactivation, direct Deprecated-to-Active command, Draft work outside this re-establishment boundary, historical evidence rewrite, migration, schema, package, public Repository contract widening, authentication, authorization, later lifecycle slices, main promotion, release, deployment, or paths outside the fifteen-path list.

Stop and return to Owner if implementation requires a sixteenth path; a Decision #077 change; Aggregate redesign; public Repository/persistence contract change; Measurement prerequisite change; migration/schema/package/UI expansion; a second authority route/composition site; or an inability to contain raw persistence detail behind the typed boundary.

## 10. Governance gate

This recording does not authorize an implementation branch, source/test modification, implementation commit, push, PR, merge, later lifecycle work, main promotion, release, or deployment. Ingredient 003J implementation requires later explicit Owner authorization.
