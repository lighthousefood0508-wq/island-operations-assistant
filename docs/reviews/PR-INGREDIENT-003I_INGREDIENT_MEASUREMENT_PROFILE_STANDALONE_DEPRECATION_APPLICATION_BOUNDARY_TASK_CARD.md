# PR-INGREDIENT-003I — Ingredient Measurement Profile Standalone Deprecation Application Boundary

> **OWNER-APPROVED TASK CARD — IMPLEMENTATION NOT AUTHORIZED**

## 1. Authority and baseline

- Decision: **DECISIONS #076 — Ingredient Measurement Profile Standalone Deprecation Application Boundary**.
- Required implementation baseline: `integration/architecture-development` at this governance recording commit or a later Owner-authorized descendant that contains it.
- DECISIONS #069, #073, #074, and #075; PR-MEASUREMENT-001; PR-MEASUREMENT-001R; accepted Ingredient Task Cards; and the existing Ingredient Measurement Profile Aggregate remain authoritative unless this Card expressly and narrowly adds a boundary.
- This recording is not implementation authorization, `main`, release, deployment, or runtime provenance.

## 2. Single responsibility

Deliver one synchronous Application command that deprecates a currently Active Ingredient Measurement Profile Version through the existing Aggregate. Cost Back Office remains only the existing facade/delegator.

```text
POST /api/admin/cost/profiles/:profileId/deprecations
```

This Card does not create a replacement Active version, Draft creation/revision/activation workflow, second Profile authority, UI/navigation change, or Canonical Ingredient lifecycle command.

## 3. Fixed lifecycle contract

1. V1 accepts only an existing Active Profile Version as the deprecation target.
2. The Application Service loads the Profile Aggregate, requires an Active Canonical Ingredient, invokes existing `deprecateActive(...)`, and persists through existing `saveWithExpectedVersion(...)` semantics.
3. The former Active version becomes `Deprecated`. No replacement Profile Version or Active version is created.
4. The supplied `occurredAt` is exactly the deprecation transition instant and the former Active version's `effectiveTo`.
5. A successful command intentionally permits no current Active Profile after that instant. This is an allowed operational state, not a persistence defect.
6. Current/future normalization at or after the deprecation instant must use existing fail-closed missing-active-profile behavior until a separately authorized command establishes a new Active Profile.
7. The Aggregate remains lifecycle and invariant authority. Application code must not recreate effective-time, lifecycle-fact, Profile binding, or identity rules.
8. Archived Ingredients reject the command with zero write. A Profile that exists but has no Active version is a domain-state rejection, not malformed input; V1 maps it to `measurement_profile_deprecation_invalid` / HTTP 422.
9. Historical pinned Profile Versions and Recipe/Quote evidence remain immutable and resolvable at their valid historical instants. No history may be deleted, rewritten, substituted with a newer version, or re-normalized.

## 4. Command and HTTP contract

```json
{
  "expectedVersion": 3,
  "occurredAt": "2026-08-19T12:00:00.000Z",
  "actor": "operator-id",
  "reason": "ingredient is no longer operational"
}
```

Success is HTTP `200` with the updated Deprecated Profile contract. Existing Profile creation and supersession HTTP contracts remain unchanged.

| Stable error code | HTTP | Meaning |
| --- | ---: | --- |
| `measurement_profile_deprecation_invalid` | 422 | Invalid command, no Active version domain state, or Aggregate rejection. |
| `measurement_profile_not_found` | 404 | Requested Profile does not exist. |
| `measurement_profile_ingredient_inactive` | 422 | Bound Canonical Ingredient is Archived/inactive. |
| `measurement_profile_expected_version_conflict` | 409 | Supplied optimistic-concurrency version is stale. |
| `measurement_profile_deprecation_persistence_failed` | 500 | Deprecation could not be persisted through the safe typed boundary. |

SQLite/DB messages, stacks, causes, infrastructure error types, and raw persistence detail must never enter a serialized response.

## 5. Ownership and dependency boundaries

The Application Service may depend only on existing Recipe-hosted Profile Aggregate/value types, a narrow Recipe-owned structural lookup/persistence dependency for Aggregate history and `saveWithExpectedVersion(...)`, and a narrow Canonical Ingredient lookup/Active-state dependency.

It must not import SQLite implementations, `DatabaseAdapter`, BetterSqlite3, infrastructure-specific errors, Cost business authority, Measurement resolvers, or a broad mutable Repository port.

`src/server/index.ts` is the sole production composition site. Cost Back Office delegates to the Service; it must not construct or deprecate the Aggregate, invoke persistence, generate lifecycle facts, or duplicate lifecycle rules.

## 6. Exact ten-path implementation allowlist

1. `src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-deprecation-service.ts` — deprecation orchestration only.
2. `src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-deprecation-errors.ts` — typed safe failures only.
3. `src/domains/recipe/index.ts` — additive public export only.
4. `src/server/app/cost-back-office-service.ts` — facade parsing, delegation, and safe mapping only.
5. `src/server/app/routes.ts` — register only the authorized Cost facade operation.
6. `src/server/index.ts` — sole dependency composition site.
7. `src/tests/ingredient-measurement-profile-deprecation-application.test.ts` — focused Application evidence.
8. `src/tests/cost-back-office-api.integration.test.ts` — HTTP contract and safe failure evidence.
9. `src/tests/architecture-guards.test.ts` — responsibility, dependency, route, composition, and exact-scope Guards.
10. `tests/e2e/cost-back-office.spec.ts` — existing Cost Back Office flow coverage without UI expansion.

Every other path is prohibited. An eleventh path is a stop condition.

## 7. Required tests

### Application

- valid deprecation transitions exactly one Active Version to Deprecated at `occurredAt`;
- no replacement Active version is created;
- missing Profile, no Active version, Archived Ingredient, stale expectedVersion, Aggregate rejection, and persistence failure produce zero writes;
- persistence errors become safe typed failures without raw detail; and
- historical pinned versions remain resolvable at valid historical instants while current normalization after deprecation fails closed.

### API and E2E

- POST success is `200` and returns the Deprecated Profile;
- `404`, `409`, `422`, and `500` use the specified stable codes and safe messages;
- Profile creation and supersession remain unchanged; and
- existing Cost Back Office flows have no UI/navigation expansion.

### Regressions

- Profile Aggregate/persistence/history and normalization regressions, including pinned historical Profile Versions;
- Recipe projection and Cost Quote normalization/evaluation regressions prove no historical evidence rewrite or re-normalization; and
- Canonical Ingredient lifecycle, Reference Impact, 003F–003H, Measurement prerequisite, and existing Cost Back Office regressions remain green.

## 8. Required Architecture Guards

The final Guard set must prove that the deprecation Service is the sole new orchestration authority; Cost Back Office delegates; `src/server/index.ts` is the sole composition site; only the authorized Cost deprecation route exists; Application code contains no SQLite/infrastructure/Cost/Measurement authority dependency; the exact ten-path responsibility map performs substantive repository scanning with narrow exclusions; and the same classifier rejects a simulated unauthorized eleventh deprecation-responsibility path.

## 9. Required verification

- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- focused deprecation Application tests;
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

003I must not include Draft creation/revision/activation, Profile supersession changes, Ingredient Reactivate/Delete/Merge, aliases, identity resolution, historical Recipe/Quote rewriting or re-normalization, Reference Impact changes, Accepted Purchase authority, Cost Snapshot authority, migration, schema, package, production UI/navigation, authentication, authorization, later lifecycle slices, main promotion, release, deployment, or paths outside the ten-path list.

## 11. Stop conditions

Stop and return to Owner if implementation requires an eleventh path; migration, schema, package, UI/navigation, Purchase, Snapshot, or excluded lifecycle scope; a Profile Aggregate or persistence redesign; a public mutable Repository Port widening; a second composition site or Profile authority route; changed normalization semantics; or raw persistence detail that cannot be contained behind a safe typed boundary.

## 12. Governance gate

This recording does not authorize an implementation branch, source/test modification, implementation commit, push, PR, merge, later lifecycle work, main promotion, release, or deployment. Ingredient 003I implementation requires later explicit Owner authorization.
