import assert from "node:assert/strict";
import test from "node:test";
import {
  INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
  type FormalMeasurementProfileDefinitionContractV1,
  type IngredientMeasurementNormalizationContractV1,
  type IngredientMeasurementProfileRepositoryPortV1,
  type IngredientNormalizationResultV1,
  type MeasurementProfileDefinitionContractV1
} from "../domains/recipe/contracts/ingredient-measurement-profile-contract.js";
import {
  MEASUREMENT_FOUNDATION_CONTRACT_VERSION,
  type MeasurementFoundationContractV1
} from "../domains/recipe/contracts/measurement-foundation-contract.js";
import {
  RECIPE_CANONICAL_PROJECTION_CONTRACT_NAME,
  RECIPE_CANONICAL_PROJECTION_CONTRACT_VERSION
} from "../domains/recipe/contracts/recipe-canonical-projection-contract.js";
import { RecipeCanonicalProjectionService } from "../domains/recipe/application/recipe-canonical-projection-service.js";
import type {
  PublishedRecipeLineSnapshot,
  PublishedRecipeSnapshot
} from "../domains/recipe/domain/published-recipe-snapshot.js";
import { IngredientMeasurementNormalizationService } from "../domains/recipe/measurement-profile/ingredient-normalization-service.js";
import { MeasurementNormalizer } from "../domains/recipe/measurement/measurement-normalizer.js";
import { MeasurementUnitResolver } from "../domains/recipe/measurement/measurement-unit-resolver.js";

const PUBLISHED_AT = "2026-07-31T01:00:00.000Z";
const EFFECTIVE_FROM = "2026-07-30T01:00:00.000Z";
const INGREDIENT_MASS = "ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INGREDIENT_VOLUME = "ing_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INGREDIENT_COUNT = "ing_cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type Dimension = "mass" | "volume" | "count";
type UnitCode = "g" | "kg" | "tw_catty" | "ml" | "l" | "cc" | "each" | "dozen";

function profile(
  ingredientId: string,
  dimension: Dimension,
  suffix: string
): FormalMeasurementProfileDefinitionContractV1 {
  const canonicalUnitCode = dimension === "mass"
    ? "g"
    : dimension === "volume"
      ? "ml"
      : "each";
  const allowedUnitCodes = dimension === "mass"
    ? ["g", "kg", "tw_catty"] as const
    : dimension === "volume"
      ? ["ml", "l", "cc"] as const
      : ["each", "dozen"] as const;
  return Object.freeze({
    contractVersion: INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
    identity: Object.freeze({
      profileId: `measurement_profile_${suffix}`,
      profileVersionId: `measurement_profile_version_${suffix}`,
      ingredientId
    }),
    state: "Active",
    lifecycle: Object.freeze([]),
    dimension,
    canonicalUnitCode,
    allowedUnitCodes: Object.freeze([...allowedUnitCodes]),
    profileAliases: Object.freeze([]),
    source: Object.freeze({
      sourceType: "SYSTEM",
      referenceId: "recipe-projection-test",
      recordedAt: EFFECTIVE_FROM,
      recordedBy: "actor_measurement"
    }),
    effectiveFrom: EFFECTIVE_FROM
  });
}

class ProfileRepository implements IngredientMeasurementProfileRepositoryPortV1 {
  constructor(
    private readonly versions: readonly MeasurementProfileDefinitionContractV1[]
  ) {}

  findHistoryByProfileId(
    profileId: string
  ): readonly MeasurementProfileDefinitionContractV1[] {
    return this.versions.filter(
      (version) => version.identity.profileId === profileId
    );
  }

  findActiveProfilesAt(
    ingredientId: string,
    evaluatedAt: string
  ): readonly FormalMeasurementProfileDefinitionContractV1[] {
    return this.versions.filter(
      (version): version is FormalMeasurementProfileDefinitionContractV1 =>
        version.state !== "Draft"
        && version.identity.ingredientId === ingredientId
        && Date.parse(version.effectiveFrom) <= Date.parse(evaluatedAt)
        && (
          version.state === "Active"
          || Date.parse(evaluatedAt) < Date.parse(version.effectiveTo)
        )
    );
  }

  findProfileVersion(
    profileVersionId: string
  ): MeasurementProfileDefinitionContractV1 | undefined {
    return this.versions.find(
      (version) => version.identity.profileVersionId === profileVersionId
    );
  }
}

function line(
  ingredientId: string,
  coefficient: string,
  scale: number,
  code: UnitCode,
  dimension: Dimension
): PublishedRecipeLineSnapshot {
  return {
    recipeLineId: `recipe_line_${ingredientId}`,
    linePosition: 0,
    ingredient: {
      ingredientReferenceId: ingredientId,
      canonicalName: "Display only",
      measurementDimension: dimension,
      status: "active",
      createdAt: EFFECTIVE_FROM
    },
    quantity: {
      coefficient,
      scale,
      unit: { code, dimension }
    },
    preparationNote: null
  };
}

function snapshot(
  lines: readonly PublishedRecipeLineSnapshot[] = [
    line(INGREDIENT_MASS, "2", 0, "kg", "mass")
  ],
  input: Partial<Pick<
    PublishedRecipeSnapshot,
    "state" | "publishedAt" | "supersession"
  >> = {}
): PublishedRecipeSnapshot {
  return {
    recipeId: "recipe_11111111-1111-4111-8111-111111111111",
    recipeFamilyId: "recipe_family_11111111-1111-4111-8111-111111111111",
    sourceDraftId: "recipe_draft_22222222-2222-4222-8222-222222222222",
    recipeVersionId: "recipe_version_33333333-3333-4333-8333-333333333333",
    versionNumber: 1,
    state: input.state ?? "Published",
    name: "Projection test",
    instructions: null,
    product: {
      productId: "prod_44444444-4444-4444-8444-444444444444",
      productVersionId: "pver_55555555-5555-4555-8555-555555555555"
    },
    lines: lines.map((recipeLine, linePosition) => ({ ...recipeLine, linePosition })),
    standardOutput: {
      coefficient: "500",
      scale: 0,
      unit: { code: "g", dimension: "mass" }
    },
    standardYield: {
      coefficient: "10",
      scale: 0,
      unit: { code: "each", dimension: "count" }
    },
    publishedBy: "actor_recipe",
    publishedAt: input.publishedAt ?? PUBLISHED_AT,
    supersession: input.supersession ?? null
  };
}

const profiles = [
  profile(INGREDIENT_MASS, "mass", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
  profile(INGREDIENT_VOLUME, "volume", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
  profile(INGREDIENT_COUNT, "count", "cccccccc-cccc-4ccc-8ccc-cccccccccccc")
];
const measurement = new MeasurementNormalizer();
const normalization = new IngredientMeasurementNormalizationService(
  new ProfileRepository(profiles),
  new MeasurementUnitResolver(),
  measurement
);

function service(
  normalizationContract: IngredientMeasurementNormalizationContractV1 =
    normalization,
  measurementContract: MeasurementFoundationContractV1 = measurement
): RecipeCanonicalProjectionService {
  return new RecipeCanonicalProjectionService(
    normalizationContract,
    measurementContract
  );
}

function projected(
  source: PublishedRecipeSnapshot = snapshot()
) {
  const result = service().project(source);
  assert.equal(result.status, "projected");
  if (result.status !== "projected") {
    throw new Error("Expected canonical Recipe Projection.");
  }
  return result.projection;
}

function assertFailure(
  result: ReturnType<RecipeCanonicalProjectionService["project"]>,
  code: string
): void {
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.failure.code, code);
  }
}

test("projection publishes stable contract identity and Recipe Version facts", () => {
  const projection = projected();
  assert.equal(
    projection.contractName,
    RECIPE_CANONICAL_PROJECTION_CONTRACT_NAME
  );
  assert.equal(
    projection.contractVersion,
    RECIPE_CANONICAL_PROJECTION_CONTRACT_VERSION
  );
  assert.equal(projection.basis, "PUBLISHED_RECIPE_VERSION");
  assert.equal(projection.recipeVersionId, snapshot().recipeVersionId);
  assert.deepEqual(projection.product, snapshot().product);
});

test("mass quantity normalizes exactly from kg to g", () => {
  const evidence = projected().lines[0]!.normalizationEvidence;
  assert.deepEqual(evidence.measurementEvidence.rawQuantity, {
    coefficient: "2",
    scale: 0
  });
  assert.deepEqual(evidence.measurementEvidence.normalizedQuantity, {
    coefficient: "2000",
    scale: 0
  });
  assert.equal(evidence.measurementEvidence.canonicalUnitCode, "g");
});

test("tw_catty normalization preserves the exact 600-to-1 evidence", () => {
  const projection = projected(snapshot([
    line(INGREDIENT_MASS, "5", 0, "tw_catty", "mass")
  ]));
  const evidence = projection.lines[0]!.normalizationEvidence.measurementEvidence;
  assert.deepEqual(evidence.conversionRatio, {
    numerator: "600",
    denominator: "1"
  });
  assert.deepEqual(evidence.normalizedQuantity, {
    coefficient: "3000",
    scale: 0
  });
});

test("volume and count lines use ml and each canonical units", () => {
  const projection = projected(snapshot([
    line(INGREDIENT_VOLUME, "2", 0, "l", "volume"),
    line(INGREDIENT_COUNT, "3", 0, "dozen", "count")
  ]));
  assert.equal(
    projection.lines[0]!.normalizationEvidence.measurementEvidence.canonicalUnitCode,
    "ml"
  );
  assert.deepEqual(
    projection.lines[0]!.normalizationEvidence.measurementEvidence.normalizedQuantity,
    { coefficient: "2000", scale: 0 }
  );
  assert.equal(
    projection.lines[1]!.normalizationEvidence.measurementEvidence.canonicalUnitCode,
    "each"
  );
  assert.deepEqual(
    projection.lines[1]!.normalizationEvidence.measurementEvidence.normalizedQuantity,
    { coefficient: "36", scale: 0 }
  );
});

test("line positions are zero-based and immutable source order is preserved", () => {
  const projection = projected(snapshot([
    line(INGREDIENT_COUNT, "1", 0, "each", "count"),
    line(INGREDIENT_MASS, "1", 0, "g", "mass"),
    line(INGREDIENT_VOLUME, "1", 0, "ml", "volume")
  ]));
  assert.deepEqual(
    projection.lines.map((entry) => [entry.linePosition, entry.ingredientId]),
    [
      [0, INGREDIENT_COUNT],
      [1, INGREDIENT_MASS],
      [2, INGREDIENT_VOLUME]
    ]
  );
});

test("future repeated Ingredient lines remain separate and ordered", () => {
  const projection = projected(snapshot([
    line(INGREDIENT_MASS, "1", 0, "kg", "mass"),
    line(INGREDIENT_MASS, "250", 0, "g", "mass")
  ]));
  assert.equal(projection.lines.length, 2);
  assert.deepEqual(
    projection.lines.map((entry) =>
      entry.normalizationEvidence.measurementEvidence.normalizedQuantity
    ),
    [
      { coefficient: "1000", scale: 0 },
      { coefficient: "250", scale: 0 }
    ]
  );
});

test("Profile identity, Profile Version, source, and conversion facts are carried", () => {
  const evidence = projected().lines[0]!.normalizationEvidence;
  assert.match(evidence.profileId, /^measurement_profile_/);
  assert.match(evidence.profileVersionId, /^measurement_profile_version_/);
  assert.equal(evidence.source.sourceType, "SYSTEM");
  assert.ok(evidence.measurementEvidence.conversionId);
  assert.ok(evidence.measurementEvidence.conversionVersion > 0);
});

test("publishedAt is the only normalization evaluatedAt", () => {
  const calls: string[] = [];
  const spy: IngredientMeasurementNormalizationContractV1 = {
    normalizeAt(request) {
      calls.push(request.evaluatedAt);
      return normalization.normalizeAt(request);
    }
  };
  const result = service(spy).project(snapshot([
    line(INGREDIENT_MASS, "1", 0, "g", "mass"),
    line(INGREDIENT_COUNT, "1", 0, "each", "count")
  ]));
  assert.equal(result.status, "projected");
  assert.deepEqual(calls, [PUBLISHED_AT, PUBLISHED_AT]);
});

test("Standard Output and Standard Yield are normalized by Measurement authority", () => {
  const projection = projected();
  assert.equal(projection.standardOutput.canonicalUnitCode, "g");
  assert.deepEqual(projection.standardOutput.normalizedQuantity, {
    coefficient: "500",
    scale: 0
  });
  assert.equal(projection.standardYield.canonicalUnitCode, "each");
  assert.deepEqual(projection.standardYield.normalizedQuantity, {
    coefficient: "10",
    scale: 0
  });
});

test("Superseded Recipe Version remains projectable with immutable history", () => {
  const source = snapshot(undefined, {
    state: "Superseded",
    supersession: {
      supersededByRecipeVersionId:
        "recipe_version_66666666-6666-4666-8666-666666666666",
      supersededBy: "actor_recipe",
      supersededAt: "2026-08-01T01:00:00.000Z",
      reason: "New version"
    }
  });
  const projection = projected(source);
  assert.equal(projection.state, "Superseded");
  assert.deepEqual(projection.supersession, source.supersession);
});

test("missing and ambiguous Profiles remain distinct typed failures", () => {
  assertFailure(
    new RecipeCanonicalProjectionService(
      new IngredientMeasurementNormalizationService(
        new ProfileRepository([]),
        new MeasurementUnitResolver(),
        measurement
      ),
      measurement
    ).project(snapshot()),
    "MISSING_INGREDIENT_MEASUREMENT_PROFILE"
  );
  const duplicate = profile(
    INGREDIENT_MASS,
    "mass",
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
  );
  assertFailure(
    new RecipeCanonicalProjectionService(
      new IngredientMeasurementNormalizationService(
        new ProfileRepository([profiles[0]!, duplicate]),
        new MeasurementUnitResolver(),
        measurement
      ),
      measurement
    ).project(snapshot()),
    "AMBIGUOUS_INGREDIENT_MEASUREMENT_PROFILE"
  );
});

test("invalid canonical Ingredient identity fails with line position", () => {
  const result = service().project(snapshot([
    line("ingredient-by-name", "1", 0, "g", "mass")
  ]));
  assertFailure(result, "INVALID_CANONICAL_INGREDIENT_ID");
  if (result.status === "failed") {
    assert.equal(result.failure.linePosition, 0);
  }
});

test("invalid Profile Version reference fails closed", () => {
  const fake: IngredientMeasurementNormalizationContractV1 = {
    normalizeAt(request): IngredientNormalizationResultV1 {
      const actual = normalization.normalizeAt(request);
      assert.equal(actual.status, "normalized");
      if (actual.status !== "normalized") {
        return actual;
      }
      return {
        status: "normalized",
        evidence: {
          ...actual.evidence,
          profileVersionId: ""
        }
      };
    }
  };
  assertFailure(
    service(fake).project(snapshot()),
    "INVALID_PROFILE_VERSION_REFERENCE"
  );
});

test("compatibility dimension mismatch never becomes authority", () => {
  const fake: IngredientMeasurementNormalizationContractV1 = {
    normalizeAt(request): IngredientNormalizationResultV1 {
      const actual = normalization.normalizeAt(request);
      assert.equal(actual.status, "normalized");
      if (actual.status !== "normalized") {
        return actual;
      }
      return {
        status: "normalized",
        evidence: {
          ...actual.evidence,
          measurementEvidence: {
            ...actual.evidence.measurementEvidence,
            dimension: "volume",
            canonicalUnitCode: "ml"
          }
        }
      };
    }
  };
  assertFailure(
    service(fake).project(snapshot()),
    "MEASUREMENT_DIMENSION_MISMATCH"
  );
});

test("normalization failure is typed and no partial Projection is returned", () => {
  let calls = 0;
  const fake: IngredientMeasurementNormalizationContractV1 = {
    normalizeAt(request) {
      calls += 1;
      if (calls === 2) {
        return {
          status: "failed",
          failure: {
            code: "UNIT_NOT_ALLOWED_BY_PROFILE",
            message: "Not allowed."
          }
        };
      }
      return normalization.normalizeAt(request);
    }
  };
  const result = service(fake).project(snapshot([
    line(INGREDIENT_MASS, "1", 0, "g", "mass"),
    line(INGREDIENT_VOLUME, "1", 0, "ml", "volume")
  ]));
  assertFailure(result, "INGREDIENT_NORMALIZATION_FAILED");
  assert.equal("projection" in result, false);
});

test("thrown normalization failure cannot cross the typed result boundary", () => {
  const throwing: IngredientMeasurementNormalizationContractV1 = {
    normalizeAt() {
      throw new Error("technical detail");
    }
  };
  const result = service(throwing).project(snapshot());
  assertFailure(result, "INGREDIENT_NORMALIZATION_FAILED");
  if (result.status === "failed") {
    assert.doesNotMatch(result.failure.message, /technical detail/);
  }
});

test("Standard Output and Yield normalization failures are distinct", () => {
  const source = snapshot();
  const invalidOutput: PublishedRecipeSnapshot = {
    ...source,
    standardOutput: {
      ...source.standardOutput,
      unit: { code: "unknown", dimension: "mass" }
    }
  };
  assertFailure(
    service().project(invalidOutput),
    "STANDARD_OUTPUT_NORMALIZATION_FAILED"
  );
  const invalidYield: PublishedRecipeSnapshot = {
    ...source,
    standardYield: {
      ...source.standardYield,
      unit: { code: "unknown", dimension: "count" }
    }
  };
  assertFailure(
    service().project(invalidYield),
    "STANDARD_YIELD_NORMALIZATION_FAILED"
  );
});

test("identical facts produce deeply equal deterministic Projection", () => {
  const source = snapshot();
  assert.deepEqual(projected(source), projected(source));
});

test("Projection is deeply immutable and shares no mutable evidence references", () => {
  let suppliedEvidence:
    | Extract<IngredientNormalizationResultV1, { status: "normalized" }>["evidence"]
    | undefined;
  const capturing: IngredientMeasurementNormalizationContractV1 = {
    normalizeAt(request) {
      const result = normalization.normalizeAt(request);
      if (result.status === "normalized") {
        suppliedEvidence = result.evidence;
      }
      return result;
    }
  };
  const result = service(capturing).project(snapshot());
  assert.equal(result.status, "projected");
  if (result.status !== "projected") {
    return;
  }
  const projection = result.projection;
  assert.ok(Object.isFrozen(projection));
  assert.ok(Object.isFrozen(projection.product));
  assert.ok(Object.isFrozen(projection.lines));
  assert.ok(Object.isFrozen(projection.lines[0]));
  assert.ok(Object.isFrozen(projection.lines[0]!.normalizationEvidence));
  assert.ok(Object.isFrozen(
    projection.lines[0]!.normalizationEvidence.measurementEvidence
  ));
  assert.ok(Object.isFrozen(projection.standardOutput));
  assert.notEqual(
    projection.lines[0]!.normalizationEvidence,
    suppliedEvidence
  );
  assert.notEqual(
    projection.lines[0]!.normalizationEvidence.measurementEvidence,
    suppliedEvidence?.measurementEvidence
  );
});

test("Projection carries exact strings and contains no Cost authority", () => {
  const projection = projected();
  assert.equal(
    typeof projection.lines[0]!.normalizationEvidence.measurementEvidence
      .normalizedQuantity.coefficient,
    "string"
  );
  const serialized = JSON.stringify(projection);
  for (const forbidden of [
    "quoteId",
    "currency",
    "price",
    "lineCost",
    "totalCost",
    "costSnapshot"
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("invalid source fails without reading normalization authority", () => {
  let called = false;
  const spy: IngredientMeasurementNormalizationContractV1 = {
    normalizeAt() {
      called = true;
      throw new Error("must not run");
    }
  };
  const result = service(spy).project({
    ...snapshot(),
    lines: []
  });
  assertFailure(result, "INVALID_RECIPE_PROJECTION_SOURCE");
  assert.equal(called, false);
});

test("Measurement contract version remains explicit in every evidence block", () => {
  const projection = projected();
  assert.equal(
    projection.lines[0]!.normalizationEvidence.measurementEvidence.contractVersion,
    MEASUREMENT_FOUNDATION_CONTRACT_VERSION
  );
  assert.equal(
    projection.standardOutput.contractVersion,
    MEASUREMENT_FOUNDATION_CONTRACT_VERSION
  );
  assert.equal(
    projection.standardYield.contractVersion,
    MEASUREMENT_FOUNDATION_CONTRACT_VERSION
  );
});
