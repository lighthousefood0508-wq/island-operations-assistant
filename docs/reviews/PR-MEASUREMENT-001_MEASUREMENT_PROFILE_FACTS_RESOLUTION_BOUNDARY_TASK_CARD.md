# PR-MEASUREMENT-001 — Measurement Profile Facts Resolution Boundary

> **OWNER-APPROVED TASK CARD — IMPLEMENTATION NOT AUTHORIZED**

Status: prerequisite governance record only. Implementation requires a separate Owner authorization after a fresh preflight.

## 1. Authority and baseline

- Decision: **DECISIONS #074 — Measurement Profile Facts Resolution Boundary**.
- Recording baseline: `7cf042b35ea415275ef5840d902d9b1a54441783` on `integration/architecture-development`.
- This baseline is an Architecture Development integration identity only. It is not `main`, a release, deployment, runtime provenance, or implementation authorization.
- The existing `MeasurementUnitResolutionContractV1` remains the formal source of unit-resolution truth. Existing Measurement Profile lifecycle and Aggregate invariants remain authoritative.
- Ingredient 003G is paused. Its rejected diagnostic candidate is excluded from this work and must remain untouched.

## 2. Constitution compatibility gate

Reviewed authority: Constitution v3; DECISIONS #069, #073, and #074; existing Measurement Foundation and Ingredient Measurement Profile contracts.

Compatibility result: **PASS — TASK CARD ONLY; IMPLEMENTATION NOT AUTHORIZED.**

Measurement Foundation owns dimensions, stable units, canonical-unit semantics, compatibility, and unit-resolution facts. Canonical Ingredient Identity Authority owns Profile identity, lifecycle, and history. Cost remains a consumer/facade and cannot become a Measurement validation authority.

## 3. Single responsibility

Create one formal Measurement-owned boundary that converts raw Profile measurement-definition values into typed, compatible Measurement facts.

The boundary is reusable Measurement authority. It is not owned by Ingredient 003G and does not create Profile lifecycle, persistence, HTTP, UI, or Cost behavior.

## 4. Formal contract

The contract must be named `MeasurementProfileFactsResolutionContractV1`, unless an equivalent existing repository convention requires a narrowly different symbol name.

### Raw request

The request accepts raw values without caller pre-narrowing:

```ts
type MeasurementProfileFactsResolutionRequestV1 = Readonly<{
  rawDimension: string;
  rawCanonicalUnit: string;
  rawAllowedUnitValues: readonly string[];
}>;
```

The precise property names may follow current command vocabulary, but must represent the same raw facts. Callers must not use `as MeasurementDimensionV1`, `as any`, local literal unions, or Cost-owned validation before calling this boundary.

### Typed success

Success returns only Measurement-owned types:

```ts
type ResolvedMeasurementProfileFactsV1 = Readonly<{
  dimension: MeasurementDimensionV1;
  canonicalUnitCode: StableMeasurementUnitCodeV1;
  allowedUnitCodes: readonly StableMeasurementUnitCodeV1[];
}>;
```

The allowed-unit ordering follows the request order after formal resolution. The result must not return Profile-owned `CompleteMeasurementProfileFactsV1`. A future 003G Application Service may structurally assemble a Profile command from this output, but cannot revalidate Measurement truth.

### Typed failure

The contract returns a stable tagged failure/result for:

- malformed raw request;
- unsupported raw dimension;
- unresolved canonical unit;
- unresolved allowed unit;
- canonical-unit / dimension mismatch;
- allowed-unit / dimension mismatch; and
- incompatible resolved Profile Measurement facts.

Failure codes describe the classified boundary outcome, never raw resolver implementation messages, stack, causes, SQLite/DB detail, or HTTP detail. Duplicate allowed-unit behavior must preserve existing formal Profile truth; do not invent a duplicate rejection rule unless existing truth already requires it.

## 5. Ownership and dependency direction

```text
Measurement foundation contracts
  -> MeasurementUnitResolutionContractV1
  -> Measurement Profile Facts resolver
  -> typed Measurement-owned facts
  -> future 003G Application Service
  -> Ingredient Measurement Profile Aggregate
```

The new resolver:

- owns runtime raw-dimension validation/resolution and unit/dimension compatibility coordination;
- delegates each individual canonical and allowed unit lookup to `MeasurementUnitResolutionContractV1`;
- reuses returned `unitCode`, `dimension`, and `canonicalUnitCode` as truth;
- must not copy unit aliases, conversion tables, canonical mappings, or unit registries; and
- must not import Cost, server, HTTP, persistence, SQLite, Database Adapter, the Profile Aggregate, or Profile lifecycle types where avoidable.

It does not own Draft/Active behavior, one-Active-Profile enforcement, source/audit facts, historical Profile semantics, or persistence.

## 6. Exact five-path implementation allowlist

Maximum scope is exactly five paths:

1. `src/domains/recipe/contracts/measurement-foundation-contract.ts` — additive versioned Measurement request/result/failure/contract types only.
2. `src/domains/recipe/measurement/measurement-profile-facts-resolver.ts` — new sole Measurement-owned resolver implementation.
3. `src/domains/recipe/index.ts` — additive public export of the approved resolver/contract boundary only.
4. `src/tests/measurement-profile-facts-resolver.test.ts` — focused resolver contract and delegation evidence.
5. `src/tests/architecture-guards.test.ts` — dedicated authority, dependency, no-duplicate-truth, and exact-scope guards.

Every other path is prohibited. A sixth path is a stop condition and requires Owner scope review.

## 7. Implementation rules

1. Add a Measurement-owned runtime dimension resolver. It must be the single formal raw-to-`MeasurementDimensionV1` authority.
2. Resolve canonical and allowed raw units only through the injected `MeasurementUnitResolutionContractV1`.
3. Reject non-resolved unit outcomes through stable facts-resolution failures; do not reinterpret them as a known unit.
4. Require the resolved canonical and each resolved allowed unit to have the resolved dimension.
5. Preserve current Profile duplicate semantics. Do not add lifecycle, profile-id, source, audit, or persistence facts.
6. Return frozen/read-only typed result values if this follows existing Measurement contract conventions.
7. Do not create a new HTTP endpoint, composition site, persistence adapter, registry, migration, schema, package dependency, or UI behavior.

## 8. Required Architecture Guards

The guard suite must prove, not merely describe:

1. exactly one formal Measurement Profile Facts resolver authority exists;
2. raw dimension resolution is inside Measurement and no caller-maintained whitelist/cast is accepted;
3. the resolver depends on the formal `MeasurementUnitResolutionContractV1` rather than copied unit truth;
4. Cost does not own or import facts-resolution behavior;
5. the resolver has no Profile Aggregate/lifecycle, persistence, SQLite, server, or HTTP dependency;
6. no second unit registry, conversion table, or canonical mapping appears in the resolver; and
7. the exact five-path responsibility map rejects an unauthorized sixth Measurement facts-resolution path, while excluding legitimate existing Measurement and Profile evidence.

The future 003G guard must not be used as the authority guard for this prerequisite.

## 9. Required focused tests

The focused resolver suite must establish current supported Measurement truth:

- valid supported dimension with canonical unit;
- multiple valid allowed units, preserving their resolved order;
- supported mass case when the current model supports it;
- supported volume case when the current model supports it;
- supported count case when the current model supports it;
- unsupported raw dimension;
- unresolved canonical unit;
- unresolved allowed unit;
- canonical-unit / dimension mismatch;
- allowed-unit / dimension mismatch;
- stable typed failure without raw resolver detail; and
- proof that unit lookup delegates to a `MeasurementUnitResolutionContractV1` test double rather than an internal registry.

Do not encode behavior outside the current Measurement model. Include Measurement Foundation, Measurement Unit Resolver, Profile validator/Aggregate, Recipe export, and Architecture Guard regression evidence as applicable.

## 10. Persistence, API, and UI policy

This prerequisite has no persistence, migration, schema, API, server-composition, or browser/UI responsibility. It makes zero HTTP behavior changes.

It must not modify Ingredient 003G Application Service, Cost Back Office, `server/index.ts`, routes, Profile Aggregate/persistence, Cost persistence, SQLite adapters, UI/navigation, Ingredient lifecycle, Reference Impact, Accepted Purchase, Cost Snapshot, Reactivate, Delete, Merge, aliases, or 003H.

## 11. Required verification

Report each result separately:

- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- focused Measurement Profile Facts resolver tests;
- Measurement Unit Resolver and Measurement Foundation regressions;
- Ingredient Measurement Profile validator/Aggregate regressions;
- Recipe public export regression;
- `npm run architecture:guard`;
- `npm test`;
- `npm run verify`;
- full verification as required by repository workflow;
- manual compiled-test enumeration where repository workflow requires it;
- `git diff --check`; and
- exact five-path, UTF-8, final-newline, and trailing-whitespace audits.

No Cost E2E is required unless a proposed change unexpectedly affects Cost behavior. Such an effect is a stop condition, not a reason to expand this scope.

## 12. Acceptance criteria

- A raw Profile definition resolves to typed Measurement-owned facts for supported mass, volume, and count cases.
- The boundary owns raw dimension resolution; no caller pre-narrows dimension/unit types.
- Unit facts come from `MeasurementUnitResolutionContractV1`, with no duplicate registry or conversion/canonical map.
- Canonical and allowed units must be compatible with the resolved dimension.
- Invalid raw values return stable typed failure and expose no technical message.
- Existing Profile lifecycle, validation ownership, persistence, Cost facade/API behavior, and UI are unchanged.
- The final implementation diff has exactly the five allowlisted paths and no migration/schema/package change.

## 13. Stop conditions

Stop and return to Owner if any of these are required:

1. a sixth implementation path;
2. a Profile Aggregate, Profile lifecycle, persistence, Cost, server, HTTP, routes, UI, migration, schema, or package change;
3. a copied unit registry, conversion table, canonical map, caller whitelist, or unsafe type cast;
4. a circular dependency on Profile-owned types;
5. a change to existing duplicate semantics without independent Owner Decision;
6. an inability to represent stable typed resolver failures without leaking implementation detail; or
7. any change to the frozen 003G diagnostic candidate.

## 14. 003G relationship and exclusions

PR-MEASUREMENT-001 is a prerequisite only. It does not resume, complete, or authorize Ingredient 003G.

After this prerequisite is merged, the Owner must separately authorize the Decision #073 amendment, 003G Task Card amendment, disposal of the rejected 003G candidate, and a rebuild from the resulting integration baseline.

Excluded: all 003G implementation work; Profile creation; Cost behavior; lifecycle mutation; Purchase/Snapshot authority; Reference Impact; Delete/Reactivate/Merge/aliases; 003H; main promotion; release; and deployment.

## 15. Recording and implementation gates

This Task Card recording does not authorize an implementation branch, code/test change, staging, implementation commit, implementation push, PR, merge, 003G cleanup, main promotion, release, or deployment. Each requires explicit subsequent Owner authorization.
