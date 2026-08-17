# PR-INGREDIENT-003G — Ingredient Measurement Profile Creation Application Boundary

> **OWNER-APPROVED TASK CARD — IMPLEMENTATION NOT AUTHORIZED**

Status: Owner-amended after the Measurement prerequisite merge; implementation remains separately authorized and must be rebuilt from a clean later baseline.

## 1. Authority and recording baseline

- Decision: **DECISIONS #073 — Ingredient Measurement Profile Creation Application Boundary**.
- Required implementation baseline: `integration/architecture-development` must contain `1c931b82c3990d40bdbc6092b470013c6355edcf` (the PR-MEASUREMENT-001 merge) and `b803479c5e4b361351c69f709ceb0efcb21ec2c3` (the PR-MEASUREMENT-001R merge), or a later Owner-authorized integration descendant that contains both.
- `MeasurementProfileFactsResolutionContractV1` now resolves `canonicalUnitCode` with the canonical-only type `"g" | "ml" | "each"`, structurally compatible with Profile canonical facts. The 003G Application Service must consume those typed facts directly; it must not restore compatibility through a local narrowing, cast, or whitelist.
- This is an Architecture Development integration identity only. It is not `main`, release, deployment, runtime provenance, or implementation authorization.
- DECISIONS #069, #071, and #072, accepted Ingredient 003A–003F Task Cards, and existing Measurement Profile Aggregate invariants remain authoritative unless this Card expressly and narrowly adds a boundary.

## 2. Constitution compatibility gate

Compatibility result: **PASS — TASK CARD ONLY; IMPLEMENTATION NOT AUTHORIZED.**

Recipe hosts Canonical Ingredient and Measurement Profile business authority. Cost owns its Back Office HTTP facade and Cost facts only. The existing Cost Profile facade may delegate; it must not become a second Profile creation authority.

## 3. Single responsibility

Deliver one synchronous `IngredientMeasurementProfileCreationService` that coordinates creation of an Active Ingredient Measurement Profile using existing Domain invariants. The established endpoint remains:

```text
POST /api/admin/cost/profiles
```

This Card creates neither a second Profile creation route nor a management route, UI/navigation expansion, lifecycle redesign, shared Measurement model, or cross-Domain authority.

## 4. Fixed behavior contract

The Service accepts the same Profile creation facts currently accepted by the existing Cost facade: Ingredient identity, Profile identity evidence, source/audit facts, effective Measurement units, actor, and occurrence time.

It must:

1. coordinate malformed/invalid command handling without duplicating Aggregate authority;
2. look up the Canonical Ingredient and require `Active` state;
3. create one Profile identity and one Profile Version identity;
4. construct the existing Profile Aggregate and execute its existing Draft-to-Active sequence;
5. forward raw dimension, canonical-unit, and ordered allowed-unit command values to `MeasurementProfileFactsResolutionContractV1`, consume its typed Measurement-owned facts and stable failure result; and
6. persist once through a narrow creation dependency and return a typed safe result.

Existing one-active-profile, profile history, source/audit, unit, and activation invariants remain unchanged. This Card establishes no duplicate, alias, merge, identity-resolution, revision, deprecation, or supersession rule. The Application Service must not maintain a dimension/unit whitelist, raw-unit parser, caller-side cast, or compatibility validation; Measurement owns those semantics.

## 5. Typed failure and write boundary

The Application boundary must distinguish safe typed outcomes for invalid command, Ingredient not found, Ingredient archived/inactive, formal Measurement-resolution failure, Aggregate validation, and persistence failure.

- Missing, inactive, invalid-unit, and validation outcomes make **zero writes**.
- A persistence fault becomes a stable safe Application failure; it is not success, a zero-result, or a raw technical exception.
- SQLite/DB messages, infrastructure types, copied causes, and stacks must not enter Application results or serialized HTTP responses.
- The existing Cost Profile HTTP success and safe-error contract remains unchanged. No new route or unapproved error-envelope redesign is permitted.

## 6. Ownership, dependency, and composition boundary

The Service may use only:

- existing Recipe Measurement Profile Aggregate/value types;
- a narrow Recipe-owned structural dependency for `saveNew` creation persistence;
- a narrow Canonical Ingredient lookup/Active-state dependency; and
- `MeasurementProfileFactsResolutionContractV1`, which in turn retains formal raw-dimension and unit-resolution authority.

The Service must not import SQLite implementations, `DatabaseAdapter`, BetterSqlite3, infrastructure-specific error types, or Cost business authority. It must not broadly widen the public mutable Profile Repository Port merely for this slice.

`src/server/index.ts` is the sole new composition site. It supplies the existing repositories and formal Measurement Profile Facts resolver structurally to the new Service, then supplies that Service to Cost Back Office. Cost Back Office delegates and maps its established facade only; it must not create IDs, construct/activate Aggregates, call `saveNew`, apply creation/lifecycle rules, resolve Measurement facts, or hard-code Measurement semantics.

## 7. Exact nine-path implementation allowlist

Maximum implementation scope: **exactly nine paths**.

1. `src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-creation-service.ts` — new creation coordination Service.
2. `src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-creation-errors.ts` — typed safe Application failures only.
3. `src/domains/recipe/index.ts` — additive accepted public export only.
4. `src/server/app/cost-back-office-service.ts` — existing Profile facade delegation; remove direct creation authority.
5. `src/server/index.ts` — sole composition/injection site.
6. `src/tests/ingredient-measurement-profile-creation-application.test.ts` — focused Application evidence.
7. `src/tests/cost-back-office-api.integration.test.ts` — existing Cost Profile POST non-regression evidence.
8. `src/tests/architecture-guards.test.ts` — ownership, dependency, route, composition, and exact-scope Guards.
9. `tests/e2e/cost-back-office.spec.ts` — existing Cost Back Office Profile creation-flow evidence.

Every other path is prohibited. A tenth path is a stop condition.

## 8. Existing route and HTTP contract

The existing `POST /api/admin/cost/profiles` is retained as the one Cost Back Office facade. The implementation must not modify `routes.ts`, add a Profile management/create endpoint, or create a second POST route. Existing response shapes and safe HTTP mappings remain the compatibility target.

## 9. Required Architecture Guards

The final Guard set must prove all of the following rather than merely count an allowlist:

1. the new Service is the sole added Profile creation orchestration authority;
2. Cost Back Office delegates and neither creates Profile/Profile Version IDs, constructs/activates the Aggregate, calls `saveNew`, nor hard-codes Measurement semantics;
3. `src/server/index.ts` is the sole new composition site;
4. the existing Cost POST remains and no second/Profile-management creation route exists;
5. Application code imports no SQLite, Database Adapter, infrastructure implementation/error type, or Cost business authority;
6. Application code consumes the formal Measurement Profile Facts contract and contains no local Measurement whitelist, parser, resolver replacement, unsafe raw-to-typed cast, or compatibility authority;
7. the exact nine-path responsibility map uses meaningful repository scanning/classification and detects a simulated unauthorized tenth Profile-creation responsibility path with narrow exclusions only; and
8. existing Ingredient lifecycle, Reference Impact, 003F Creation, and PR-MEASUREMENT-001 Measurement boundaries are not weakened.

## 10. Required focused tests

### Application

- valid Active-Ingredient creation with one persistence call;
- missing Ingredient and archived Ingredient outcomes with zero write;
- malformed/invalid command and formal Measurement-resolution failure with zero write;
- raw Measurement forwarding to a fake formal resolver, including a controlled raw token unknown to the Application Service, and typed Measurement-owned fact consumption;
- no local Measurement filtering, whitelist, parser, compatibility decision, or unsafe cast;
- Aggregate validation preservation;
- recognized and unexpected persistence failures mapped safely without raw detail; and
- no reliance on SQLite, Cost authority, or a broad mutable public Repository contract.

### Cost API

- existing Profile POST success;
- validation, inactive Ingredient, and safe persistence failure behavior;
- response-contract non-regression; and
- absence of a new Profile route.

### E2E and regressions

- existing Cost Back Office Profile creation flow;
- related Cost Back Office non-regression without UI/navigation expansion;
- Measurement Profile Aggregate and persistence regressions;
- Ingredient lifecycle, Canonical Ingredient Creation, and Reference Impact non-regression as relevant; and
- Architecture boundary assertions.

## 11. Required verification

Report each collection separately; do not manufacture a combined total from overlapping suites.

- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- focused Profile Creation Application tests;
- focused Cost API tests;
- focused Cost E2E;
- `npm run architecture:guard`;
- `npm test`;
- `npm run verify`;
- `npm run test:e2e`;
- `npm run verify:full`;
- manual explicit enumeration of all compiled `dist/tests/*.test.js` files;
- `git diff --check`; and
- exact nine-path, strict UTF-8, final-newline, and trailing-whitespace audits.

## 12. Explicit exclusions

003G must not include Profile revision, deprecation, supersession redesign, Ingredient Reactivate/Delete/Merge, aliases, identity resolution, Reference Impact changes, Accepted Purchase authority, Cost Snapshot persistence, migration, schema, package, UI/navigation redesign, new API routes, authentication, authorization, 003H, main promotion, release, deployment, or paths outside the nine-path list.

## 13. Stop conditions

Stop and return to Owner if any of the following is required:

1. a public Profile Repository Port widening;
2. `routes.ts`, SQLite adapter, migration, schema, package, or Cost UI/navigation change;
3. a tenth implementation path;
4. any inability to preserve the existing Cost Profile HTTP contract;
5. Aggregate/lifecycle redesign rather than delegation to existing invariants;
6. raw persistence detail that cannot be safely contained;
7. a copied/hard-coded Measurement unit/dimension authority, local raw parser, compatibility decision, resolver replacement, or unsafe raw-to-typed cast;
8. a second Profile creation route or composition site; or
9. any excluded Ingredient, Purchase, Snapshot, release, deployment, or 003H scope; or
10. an integration baseline that does not contain the PR-MEASUREMENT-001 prerequisite merge.

## 14. Governance and implementation gates

This recording does not authorize an implementation branch, source/test change, staging, implementation commit, push, PR, merge, main promotion, release, or deployment. Implementation requires a later explicit Owner authorization after an implementation preflight confirms the narrow structural persistence dependency closes without public Port widening.
