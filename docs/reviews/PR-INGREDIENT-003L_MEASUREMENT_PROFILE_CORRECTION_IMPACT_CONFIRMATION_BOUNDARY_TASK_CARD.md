# PR-INGREDIENT-003L — Measurement Profile Correction and Impact Confirmation Boundary

> **OWNER-APPROVED TASK CARD — CONTINUOUS IMPLEMENTATION AUTHORIZED**

## 1. Constitution Compatibility Gate

- **Reviewed ADR**: `CONSTITUTION.md`; ADR-019; DECISIONS #069, #074, #075, #077, #078, #081, #083, #094; PR-INGREDIENT-003D/003E/003G/003H/003J Task Cards.
- **Compatibility Result**: COMPATIBLE. Canonical Ingredient Identity Authority retains Profile lifecycle/history; Measurement retains unit resolution and compatibility; Recipe and Cost remain independent evidence owners; immutable historical evidence is not rewritten. Existing version persistence is reused without migration or schema change.

## 2. Single responsibility

Deliver one understandable and safe Back Office correction workflow for an existing Active Ingredient Measurement Profile:

```text
select Ingredient
→ show current Active measurement facts
→ load correction impact
→ confirm reason and intended facts
→ same-basis supersession, or zero-reference-only cross-basis correction
```

This work does not add general Profile administration, delete history, convert quantities, infer density, edit Recipe/Purchase evidence, or create a second Profile mutation route.

## 3. Fixed product behavior

1. The Measurement workspace explains that it defines the Ingredient's Recipe, Purchase-acceptance, and Cost normalization basis; package quantity, purchase quantity, and price belong elsewhere.
2. Selecting an Ingredient without a Profile shows the existing creation form and `啟用量測設定` action.
3. Selecting an Ingredient with an Active Profile shows its current dimension, canonical unit, allowed units, Profile identity, Active Version identity, and version state. It must not appear to offer another initial creation.
4. `查看引用與更正設定` loads a fresh correction-impact response and lists Recipe Draft, Published/Superseded Recipe Version, Quote, Purchase, Accepted Purchase, and Cost Snapshot references.
5. Same-dimension and same-canonical corrections continue through the existing supersession command and may change allowed units.
6. A changed dimension or canonical unit is accepted only when every governed reference collection is available and empty. Any reference or read uncertainty blocks the command with zero writes.
7. A successful correction requires expectedVersion, non-blank reason, authenticated actor injection, and one canonical UTC transition instant. It creates one replacement Active Version and supersedes the old Active Version; old evidence remains immutable.
8. The UI performs a second confirmation that states old facts, new facts, impact counts, and that historical evidence will not be changed. It never claims existing Recipe contents will be automatically rewritten.

## 4. HTTP and stable failures

- `GET /api/admin/cost/profiles/:profileId/correction-impact` returns the current Profile facts, expected aggregate version, deterministic governed reference collections, and `crossBasisCorrectionAllowed`.
- `POST /api/admin/cost/profiles/:profileId/supersessions` remains the sole mutation route and retains HTTP `201` on success.
- Add one stable safe rejection for referenced cross-basis correction: `measurement_profile_correction_referenced` / HTTP `409`.
- Existing not-found, inactive Ingredient, expected-version conflict, Measurement resolution, validation, and persistence mappings remain unchanged. Raw DB/SQLite/table/stack/cause detail never crosses HTTP.

## 5. Exact implementation allowlist

1. `src/application/ingredient-measurement-profile-correction-impact-service.ts`
2. `src/domains/cost/domain/ingredient-reference-impact-read-port.ts`
3. `src/domains/cost/infrastructure/sqlite-cost-repository.ts`
4. `src/domains/cost/index.ts`
5. `src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-supersession-errors.ts`
6. `src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-supersession-service.ts`
7. `src/server/app/cost-back-office-service.ts`
8. `src/server/app/routes.ts`
9. `src/server/index.ts`
10. `src/web/cost/page.ts`
11. `src/tests/ingredient-measurement-profile-correction-impact-application.test.ts`
12. `src/tests/ingredient-measurement-profile-supersession-application.test.ts`
13. `src/tests/canonical-ingredient-reference-impact-persistence.integration.test.ts`
14. `src/tests/cost-back-office-api.integration.test.ts`
15. `src/tests/architecture-guards.test.ts`
16. `tests/e2e/cost-back-office.spec.ts`

Governance paths are `docs/DECISIONS.md` and this Task Card and are not implementation paths. A seventeenth implementation path is a stop condition.

## 6. Required verification

- Focused correction-impact, supersession, Cost reference persistence, Cost API, and Cost Back Office E2E tests.
- Existing Profile lifecycle/persistence/history, Ingredient Reference Impact, Recipe, Purchase, Accepted Purchase, Quote, Snapshot, normalization, authentication/role, CSRF/canonical-origin, and actor-injection regressions.
- `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`, `pnpm test`, `pnpm run architecture:guard`, `pnpm run verify`, `pnpm run test:e2e`, and `pnpm run verify:full`.
- Fresh explicit compiled `dist/tests/*.test.js` collection, migration pending smoke, `git diff --check`, UTF-8, final-newline, trailing-whitespace, secret scan, and exact-scope audit.

## 7. Explicit exclusions and stop conditions

No migration/schema, database rewrite, public Repository widening, direct SQL outside the approved Cost read adapter, new unit or conversion truth, density/package behavior, Recipe/Purchase/Accepted Purchase/Quote/Snapshot mutation, Catalog/Operations work, authentication change, unrelated UI, deployment, or second Profile mutation route is authorized.

Stop only if safe implementation requires a seventeenth implementation path, migration/schema, a different public contract, historical evidence rewrite, Measurement authority expansion, Profile Aggregate redesign, or another architecture decision.
