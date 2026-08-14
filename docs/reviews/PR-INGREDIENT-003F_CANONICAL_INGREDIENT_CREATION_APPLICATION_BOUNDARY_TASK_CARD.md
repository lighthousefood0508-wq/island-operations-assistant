# PR-INGREDIENT-003F — Canonical Ingredient Creation Application Boundary

> **OWNER-APPROVED TASK CARD — IMPLEMENTATION NOT AUTHORIZED**

Status: Owner-approved Task Card — implementation not authorized

## 1. Authority and baseline identities

- Decision: **DECISIONS #072 — Canonical Ingredient Creation Application Boundary**.
- Recording baseline: `fb965fed1d8f3e1f731b6f9db4b029ed852ed192` on `integration/architecture-development`.
- This baseline is an Architecture Development integration identity only. It is not `main`, release, deployment, runtime provenance, or an implementation authorization.
- The protected Canonical Ingredient Proposal, 003A through 003E Task Cards, Migration 014, and DECISIONS #069/#071 remain authoritative unless this Task Card expressly and narrowly adds a boundary.

## 2. Constitution Compatibility Gate

Reviewed authority: `CONSTITUTION.md`, DECISIONS #069, DECISIONS #071, DECISIONS #072, and the accepted Ingredient 003A–003E Task Cards.

Compatibility result: **PASS — TASK CARD ONLY; IMPLEMENTATION NOT AUTHORIZED.**

Canonical Ingredient Identity Authority remains the sole owner of Canonical Ingredient identity and creation rules. Cost retains its own Quote and Back Office facts only. The existing Cost endpoint becomes a facade over the Canonical Ingredient Application boundary; it does not acquire Canonical Ingredient authority.

## 3. Single responsibility

Deliver one synchronous `CanonicalIngredientCreationService` that owns creation coordination for a new Canonical Ingredient. The existing `POST /api/admin/cost/ingredients` endpoint remains unchanged and delegates to that Service through Cost Back Office.

This Task Card does not create a management create route, UI control, navigation entry, new lifecycle transition, or cross-Domain shared model.

## 4. Fixed behavior contract

The Creation Service accepts exactly these command values:

```ts
Readonly<{
  name: string;
  categoryCode: string;
  actor: string;
  occurredAt: string;
}>
```

It must:

1. validate the remaining command values using existing Canonical Ingredient validation and invariants;
2. create one new Canonical Ingredient UUID identity;
3. construct one new Active Canonical Ingredient Aggregate;
4. call the existing Repository `saveNew` once; and
5. return the existing public Canonical Ingredient contract.

The Service may use a narrow non-exported Repository dependency containing only `saveNew`. It must not import SQLite, BetterSqlite3, database adapters, persistence records, or Cost internals.

Duplicate or normalized duplicate names remain permitted. They create no uniqueness rule, automatic selection, alias, merge, or identity resolution.

## 5. Typed failure boundary

The implementation may add only the accepted Creation validation and persistence typed Application errors. Their messages and serialized fields must be safe Application-level text.

- invalid name, category, actor, or occurredAt maps to Creation validation failure;
- recognized persistence failure from `saveNew` maps to Creation persistence failure;
- unexpected persistence failure also maps to Creation persistence failure;
- no raw SQLite, Database, Repository, cause, copied stack, or error message may be exposed through the Service result, Cost HTTP error envelope, or serialized response.

The existing Cost endpoint retains its public HTTP success envelope and safe failure behavior. No HTTP status/code redesign is authorized by this Task Card.

## 6. Existing API and composition boundary

The only existing creation endpoint remains:

```text
POST /api/admin/cost/ingredients
```

003F must not add:

```text
POST /api/admin/canonical-ingredients
```

`src/server/index.ts` is the sole new production composition site. It constructs the Canonical Ingredient Creation Service and supplies it to Cost Back Office. Routes continue to call Cost Back Office and must not construct repositories, execute SQL, create UUIDs, or apply Canonical Ingredient creation rules.

## 7. Exact nine-path implementation allowlist

1. `src/domains/recipe/ingredient-catalog/application/canonical-ingredient-creation-service.ts` — new Creation Service and command/result coordination.
2. `src/domains/recipe/ingredient-catalog/application/canonical-ingredient-creation-errors.ts` — new typed Creation failures only.
3. `src/domains/recipe/index.ts` — additive export of the accepted Service, types, and errors only.
4. `src/server/app/cost-back-office-service.ts` — delegate existing `createIngredient`; remove direct creation rule ownership.
5. `src/server/index.ts` — compose and inject the Service exactly once.
6. `src/tests/canonical-ingredient-creation-application.test.ts` — focused Creation Service evidence.
7. `src/tests/cost-back-office-api.integration.test.ts` — existing Cost creation endpoint non-regression evidence.
8. `src/tests/architecture-guards.test.ts` — exact public/export, dependency, composition, route, and nine-path responsibility Guards.
9. `tests/e2e/cost-back-office.spec.ts` — existing Cost Back Office creation-flow non-regression.

Every other path is prohibited. A required tenth path is a stop condition.

## 8. Path-by-path architecture constraints

- The Service may depend only on Canonical Ingredient Aggregate, identity/category/value validation, its narrow Repository pick, and stable technical UUID generation.
- Creation errors must not expose infrastructure types or causes.
- Recipe public index adds only the accepted 003F surface; all legitimate existing exports remain unchanged.
- Cost Back Office may delegate only; it must not create UUIDs, construct `CanonicalIngredient`, parse category as creation authority, or invoke `saveNew`.
- Server composition is the only construction site.
- No route, API DTO, UI, navigation, Database Adapter, migration, schema, package, or generated artifact changes are allowed.

## 9. Required focused tests

Creation Service tests must separately prove:

1. valid input returns a new Active `ing_<uuid>` contract and calls `saveNew` once;
2. name, category, actor, and occurredAt validation failures write nothing;
3. duplicate and normalized duplicate names are allowed and do not create identity rules;
4. recognized and unexpected `saveNew` failures become typed safe persistence failures;
5. no raw persistence message, stack, or cause crosses the public failure boundary;
6. only the three-operation-free narrow creation dependency is used.

Cost API integration must prove the existing creation endpoint retains success and safe invalid/failure behavior, with no new management create route.

Cost E2E must prove the existing operator creation flow remains operable without a new navigation or management-page Create control.

## 10. Architecture Guard requirements

The Guard must prove:

1. the exact nine-path responsibility map is complete and rejects a tenth 003F responsibility path;
2. only the accepted 003F public Recipe export is additive;
3. Creation Service does not import SQLite, BetterSqlite3, infrastructure, Database Adapter, Cost internals, or raw persistence types;
4. Cost Back Office delegates creation and does not create UUIDs, construct the Aggregate, or call `saveNew` for Canonical Ingredient creation;
5. `src/server/index.ts` is the sole 003F composition site;
6. `POST /api/admin/cost/ingredients` remains the existing creation facade;
7. no `POST /api/admin/canonical-ingredients` route exists;
8. 003A Rename/Archive, 003B management reads/routes, 003C/003E UI boundaries, and 003D Reference Impact boundaries remain protected; and
9. no migration, schema, package, UI/navigation, lifecycle mutation, Purchase, Snapshot, or legacy-authority marker enters 003F.

## 11. Required verification

Run and report collections separately; do not sum overlapping tests into a fictional total.

- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- focused Creation Application test;
- focused Cost API integration test;
- focused Cost Back Office E2E;
- `npm run architecture:guard`;
- existing Canonical Ingredient lifecycle/API and Reference Impact non-regression selections;
- `npm test`;
- `npm run verify`;
- `npm run test:e2e`;
- `npm run verify:full`;
- manual explicit execution of every compiled `dist/tests/*.test.js` file;
- `git diff --check`; and
- exact nine-path, UTF-8, final-newline, and trailing-whitespace audits.

## 12. Explicit exclusions

003F must not include:

- Delete, Reactivate, Merge, aliases, identity resolution, or lifecycle mutation;
- Reference Impact behavior or presentation changes;
- Accepted Purchase authority, Cost Snapshot persistence, or use of legacy `cost_purchases` as authority;
- Repository Port, Aggregate, SQLite adapter, Database Adapter, transaction, migration, schema, or package changes;
- new API route, API contract redesign, UI, navigation, authentication, authorization, Recipe/Cost calculation, 003G, main promotion, release, or deployment;
- governance, Roadmap, status, or handover freshness remediation; or
- every path outside the exact nine-path allowlist.

## 13. Stop conditions

Stop and return to Owner if:

1. the implementation base, DECISIONS #072, or this Task Card changes;
2. a tenth implementation path is needed;
3. an API route or HTTP contract change is required;
4. Repository Port, Aggregate, SQLite, migration, schema, package, UI, navigation, or Database Adapter modification is required;
5. Cost Back Office cannot delegate while preserving its existing creation endpoint behavior;
6. raw persistence detail cannot be contained;
7. duplicate names would need to become a uniqueness, merge, alias, or identity rule;
8. legacy `cost_purchases` would be read or promoted as authority;
9. any Delete, Reactivate, Merge, alias, lifecycle mutation, Purchase, Snapshot, 003G, release, deployment, or main-promotion work appears; or
10. an existing Architecture Guard must be weakened rather than extended.

## 14. Governance and implementation gates

1. Owner approved DECISIONS #072 and this Task Card recording.
2. Recording this Task Card does not authorize implementation.
3. A separate Owner Implementation Authorization must name the current integration comparison base and permit an implementation branch.
4. Candidate review, commit, push, PR review, merge, and post-merge verification remain separate Owner Gates.

## Current status

**OWNER-APPROVED TASK CARD — IMPLEMENTATION NOT AUTHORIZED**
