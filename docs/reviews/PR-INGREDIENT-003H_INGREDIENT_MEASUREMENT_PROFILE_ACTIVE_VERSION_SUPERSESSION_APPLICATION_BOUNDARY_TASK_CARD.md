# PR-INGREDIENT-003H — Ingredient Measurement Profile Active-Version Supersession Application Boundary

> **OWNER-APPROVED TASK CARD — IMPLEMENTATION NOT AUTHORIZED**

## 1. Authority and baseline

- Decision: **DECISIONS #075 — Ingredient Measurement Profile Active-Version Supersession Application Boundary**.
- Required implementation baseline: `integration/architecture-development` at this recorded governance commit or a later Owner-authorized descendant that contains it.
- DECISIONS #069, #073, and #074; PR-MEASUREMENT-001; PR-MEASUREMENT-001R; the accepted 003A–003G Task Cards; and the existing Ingredient Measurement Profile Aggregate remain authoritative unless this Card expressly and narrowly adds a boundary.
- This recording is not `main`, release, deployment, runtime provenance, or implementation authorization.

## 2. Single responsibility

Deliver one synchronous Application command that supersedes a currently Active Ingredient Measurement Profile Version by creating a replacement Active version through the existing Profile Aggregate. The Cost Back Office keeps only its existing facade/delegation role.

The authorized HTTP operation is:

```text
POST /api/admin/cost/profiles/:profileId/supersessions
```

This Card creates no standalone deprecation command, Draft revision command, second Profile authority, UI/navigation change, or Canonical Ingredient lifecycle command.

## 3. Fixed lifecycle contract

1. V1 accepts only an existing Active Profile Version as the supersession target.
2. The Application Service loads the Profile Aggregate, requires an Active Canonical Ingredient, resolves replacement facts through `MeasurementProfileFactsResolutionContractV1`, invokes the Aggregate's existing `supersedeActive(...)`, and persists through existing `saveWithExpectedVersion(...)` semantics.
3. The old Active version becomes `Superseded`; the replacement becomes `Active`; both remain versions of the same Profile and Canonical Ingredient.
4. The supplied transition instant is exactly both `old.effectiveTo` and `replacement.effectiveFrom`; the command must create neither a gap nor an overlap.
5. The replacement must retain the old Active version's `dimension` and `canonicalUnitCode`. A changed family or canonical basis is rejected by this V1 command policy after formal Measurement facts resolution.
6. The Aggregate remains lifecycle and invariant authority. Application code must not recreate same-Profile binding, one-Active-version, effective-time, lifecycle-fact, or identity rules.
7. Archived Ingredients reject the command with zero write. Historical reads, pinned historical Profile Versions, Recipe evidence, and Quote evidence remain readable and unchanged.
8. A Profile that exists but has no Active version is a domain-state rejection; it is not malformed input. V1 maps it to the safe `measurement_profile_supersession_invalid` / HTTP 422 outcome.

## 4. Command and HTTP contract

The request body contains:

```json
{
  "expectedVersion": 3,
  "dimension": "mass",
  "canonicalUnitCode": "g",
  "allowedUnitCodes": ["g", "kg"],
  "occurredAt": "2026-08-17T12:00:00.000Z",
  "actor": "operator-id",
  "reason": "supplier packaging revision"
}
```

Success is HTTP `201` with the replacement Active Profile contract. Existing `POST /api/admin/cost/profiles` creation behavior remains unchanged.

| Stable error code | HTTP | Meaning |
| --- | ---: | --- |
| `measurement_profile_supersession_invalid` | 422 | Invalid command, no Active version domain state, replacement-family/canonical-basis rejection, or Aggregate rejection. |
| `measurement_profile_not_found` | 404 | The requested Profile does not exist. |
| `measurement_profile_ingredient_inactive` | 422 | The bound Canonical Ingredient is Archived/inactive. |
| `measurement_profile_expected_version_conflict` | 409 | The supplied optimistic-concurrency version is stale. |
| `measurement_profile_measurement_resolution_failed` | 422 | Formal Measurement facts resolution rejected the raw replacement facts. |
| `measurement_profile_supersession_persistence_failed` | 500 | The command could not be persisted through the safe typed boundary. |

SQLite/DB messages, stacks, causes, infrastructure error types, and raw persistence detail must never enter a serialized response.

## 5. Ownership and dependency boundaries

The Application Service may depend only on:

- existing Recipe-hosted Profile Aggregate/value types;
- a narrow Recipe-owned structural lookup/persistence dependency for Aggregate history and `saveWithExpectedVersion(...)`;
- a narrow Canonical Ingredient lookup/Active-state dependency; and
- `MeasurementProfileFactsResolutionContractV1`.

It must not import SQLite implementations, `DatabaseAdapter`, BetterSqlite3, infrastructure-specific errors, Cost business authority, or a broad mutable Repository port.

`src/server/index.ts` is the sole production composition site. Cost Back Office delegates to the Service; it must not generate Profile/Profile Version IDs, construct or supersede the Aggregate, invoke persistence, resolve Measurement facts, or duplicate lifecycle rules.

## 6. Exact ten-path implementation allowlist

1. `src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-supersession-service.ts` — supersession orchestration only.
2. `src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-supersession-errors.ts` — typed safe failures only.
3. `src/domains/recipe/index.ts` — additive public export only.
4. `src/server/app/cost-back-office-service.ts` — facade parsing, delegation, and safe mapping only.
5. `src/server/app/routes.ts` — register only the authorized Cost facade operation.
6. `src/server/index.ts` — sole dependency composition site.
7. `src/tests/ingredient-measurement-profile-supersession-application.test.ts` — focused Application evidence.
8. `src/tests/cost-back-office-api.integration.test.ts` — HTTP contract and safe failure evidence.
9. `src/tests/architecture-guards.test.ts` — responsibility, dependency, route, composition, and exact-scope Guards.
10. `tests/e2e/cost-back-office.spec.ts` — existing Cost Back Office flow coverage without UI expansion.

Every other path is prohibited. An eleventh path is a stop condition.

## 7. Required tests

### Application

- valid supersession creates a new Active version and supersedes the old version;
- exact continuous effective boundary with no gap/overlap;
- same Profile/Ingredient binding and immutable historical versions;
- missing Profile, no Active version, Archived Ingredient, stale expectedVersion, formal Measurement resolution failure, family/canonical-basis mismatch, Aggregate rejection, and persistence failure;
- all rejected commands produce zero writes;
- raw Measurement values reach the formal resolver without Application-local whitelist, parser, compatibility rule, or unsafe cast; and
- persistence errors are safe typed failures without raw detail.

### API and E2E

- POST success is `201` and existing Profile creation remains unchanged;
- `404`, `409`, `422`, and `500` mappings use the specified stable codes and safe messages;
- Cost Back Office remains a delegator; and
- existing Cost Back Office flows have no unintended UI/navigation expansion.

### Regressions

- Profile Aggregate/persistence/history and normalization regressions, including pinned historical Profile Versions;
- Recipe projection and Cost Quote normalization/evaluation regressions prove no historical evidence rewrite or re-normalization; and
- Canonical Ingredient lifecycle, Reference Impact, 003F, 003G, Measurement prerequisite, and existing Cost Back Office regressions remain green.

## 8. Required Architecture Guards

The final Guard set must prove:

1. the supersession Service is the sole new orchestration authority;
2. Cost Back Office delegates and does not own ID creation, Aggregate construction, lifecycle rules, persistence, or Measurement semantics;
3. `src/server/index.ts` is the sole composition site;
4. only the authorized Cost supersession route exists and no second Profile authority route is introduced;
5. Application code contains no SQLite/infrastructure/Cost authority dependency and no local Measurement truth;
6. the exact ten-path responsibility map performs substantive repository scanning with narrow exclusions; and
7. the same classifier rejects a simulated unauthorized eleventh supersession-responsibility path.

## 9. Required verification

- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- focused supersession Application tests;
- focused Cost API integration tests;
- focused Cost Back Office E2E;
- Profile Aggregate, persistence, normalization, Recipe, Quote, and Cost regressions;
- `npm run architecture:guard`;
- `npm test`;
- `npm run verify`;
- `npm run test:e2e`;
- `npm run verify:full`;
- manual explicit enumeration of compiled `dist/tests/*.test.js` files;
- `git diff --check`; and
- exact ten-path, UTF-8, final-newline, and trailing-whitespace audits.

## 10. Explicit exclusions

003H must not include standalone Profile deprecation, Draft revision, Ingredient Reactivate/Delete/Merge, aliases, identity resolution, historical Recipe/Quote rewriting or re-normalization, Reference Impact changes, Accepted Purchase authority, Cost Snapshot authority, migration, schema, package, production UI/navigation, authentication, authorization, 003I, main promotion, release, deployment, or paths outside the ten-path list.

## 11. Stop conditions

Stop and return to Owner if implementation requires:

1. an eleventh path;
2. migration, schema, package, UI/navigation, Purchase, Snapshot, or excluded lifecycle scope;
3. a Profile Aggregate or persistence redesign instead of using existing lifecycle behavior and persistence semantics;
4. a public mutable Repository Port widening;
5. a second composition site or a second Profile authority route;
6. local Measurement parsing, whitelisting, compatibility logic, resolver replacement, or unsafe cast;
7. a changed dimension/canonical unit that cannot be rejected without redesign; or
8. raw persistence detail that cannot be contained behind a safe typed boundary.

## 12. Governance gate

This recording does not authorize an implementation branch, source/test modification, implementation commit, push, PR, merge, 003I, main promotion, release, or deployment. Ingredient 003H implementation requires a later explicit Owner authorization.
