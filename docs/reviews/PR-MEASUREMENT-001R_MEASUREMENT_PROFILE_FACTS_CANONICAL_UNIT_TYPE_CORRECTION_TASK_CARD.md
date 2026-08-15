# PR-MEASUREMENT-001R — Measurement Profile Facts Canonical Unit Type Correction

> **OWNER-APPROVED TASK CARD — IMPLEMENTATION NOT AUTHORIZED**

Status: corrective follow-up to the closed PR-MEASUREMENT-001. This Card records no new architecture authority and does not authorize Ingredient 003G.

## 1. Authority, baseline, and provenance

- Governing authority: **DECISIONS #074 — Measurement Profile Facts Resolution Boundary**.
- Required baseline: `integration/architecture-development` must contain `2c9ccde29739f421aa720aafabefafa337ea58c6` or a later Owner-authorized descendant containing it.
- Provenance: closed PR-MEASUREMENT-001 established the Measurement-owned raw-to-typed Profile Facts resolver. An independent 003G rebuild preflight found that its public resolved DTO was statically wider than its canonical-unit semantics.
- This is a contract precision correction only. It does not amend DECISIONS #074, DECISIONS #073, the closed PR-MEASUREMENT-001 Task Card, or the paused 003G Task Card.

## 2. Single responsibility

Make `ResolvedMeasurementProfileFactsV1.canonicalUnitCode` express the canonical-unit invariant already satisfied at runtime. The correction must make the Profile Facts result structurally consumable by the existing Profile canonical-unit field without a cast, whitelist, switch, or caller-local narrowing.

It is not a runtime redesign, unit-registry change, Measurement semantic change, Profile redesign, or Ingredient 003G implementation.

## 3. Current defect and fixed contract

`StableMeasurementUnitCodeV1` correctly includes canonical and non-canonical stable codes such as `g`, `kg`, `ml`, `l`, and `each`.

The existing `MeasurementUnitResolutionContractV1` is already precise: its resolved `canonicalUnitCode` is `"g" | "ml" | "each"`. Runtime behavior is likewise canonical: raw `kg` resolves to canonical `g`, raw `l` to `ml`, and count-family units to `each`.

Only `ResolvedMeasurementProfileFactsV1.canonicalUnitCode` is too broad today. It must become exactly:

```ts
"g" | "ml" | "each"
```

Do not introduce a new named public alias unless a later Owner scope review authorizes the extra public-surface work.

## 4. Exact implementation allowlist

Maximum implementation scope: **exactly three paths**.

1. `src/domains/recipe/contracts/measurement-foundation-contract.ts` — narrow only the Profile Facts resolved DTO canonical-unit field.
2. `src/domains/recipe/measurement/measurement-profile-facts-resolver.ts` — assemble its outgoing canonical field from the already typed `canonical.canonicalUnitCode`, not the broader `canonical.unitCode`.
3. `src/tests/measurement-profile-facts-resolver.test.ts` — focused type-level and runtime regression evidence.

Every other path is prohibited. A fourth path is a stop condition.

## 5. Resolver and ownership boundary

Measurement remains the sole authority for supported dimensions, unit resolution, canonical mapping, and compatibility. The Profile Facts resolver must continue to delegate every raw unit lookup to `MeasurementUnitResolutionContractV1`.

No new registry, alias, conversion table, raw-unit parser, unit mapping, dimension policy, or failure policy is authorized. The resolver changes only the type-accurate outgoing canonical field assembly.

## 6. Profile consumer boundary

Do not modify `CompleteMeasurementProfileFactsV1`, the Profile Aggregate, Profile validator, lifecycle, persistence, or Profile public contract. Its existing canonical unit type already matches Measurement truth.

Focused evidence must prove that a resolved Profile Facts canonical value assigns directly to the Profile canonical union type without a cast, switch, whitelist, or local narrowing. This proof must not resume 003G.

## 7. Type-level acceptance criteria

The focused test must compile with evidence that:

```ts
const canonical: "g" | "ml" | "each" = result.facts.canonicalUnitCode;
```

It must also use repository-compatible compile-time assertions (for example `@ts-expect-error`) showing `kg` and `l` cannot inhabit the resolved canonical field type. The assertions must test the exported DTO type, not merely an implementation-local variable.

## 8. Runtime and failure regression criteria

Preserve these runtime facts:

- raw `kg` retains stable-unit evidence but resolves canonical `g`;
- raw `l` retains stable-unit evidence but resolves canonical `ml`;
- a supported count unit resolves canonical `each`.

Preserve existing malformed-input, unsupported-dimension, unresolved-unit, dimension-mismatch, incompatibility, allowed-unit ordering, duplicate, and stable typed-failure behavior exactly.

## 9. Required verification

- focused Measurement Profile Facts resolver tests, including type-level assertions;
- `npm run typecheck`;
- relevant Measurement unit-resolution and Profile Facts regressions;
- `npm test`;
- `npm run verify`;
- `npm run verify:full` when repository wiring runs it;
- `git diff --check`;
- exact three-path audit; and
- UTF-8, final-newline, and trailing-whitespace checks.

Report any timeout as not-pass and replace it with one complete run.

## 10. Explicit exclusions and stop conditions

Do not modify MeasurementUnitResolutionContractV1 semantics, unit registry, aliases, conversion behavior, Profile Aggregate/contracts/persistence, Cost Back Office, server composition, routes, SQLite, migrations, schema, package, UI, governance other than this Card, or Ingredient 003G.

Stop for Owner scope review if the correction requires a fourth path, a Profile contract change, a Measurement Unit Resolution redesign, a named public type needing a wider export, an Architecture Guard change, a runtime semantic redesign, or any 003G change.

## 11. Future relationship

PR-MEASUREMENT-001R is required before the paused Ingredient 003G clean rebuild can structurally consume Profile Facts canonical output. Its completion does not authorize 003G; the Owner must separately verify future prerequisite containment and issue a new rebuild authorization.

## 12. Publication and implementation gates

Suggested branch: `feature/pr-measurement-001r-canonical-unit-type`.

Suggested implementation commit and PR title:

```text
fix(measurement): narrow profile facts canonical unit type
```

This Task Card recording does not authorize an implementation branch, code/test change, staging, implementation commit, implementation push, PR, merge, 003G continuation, main promotion, release, or deployment.
