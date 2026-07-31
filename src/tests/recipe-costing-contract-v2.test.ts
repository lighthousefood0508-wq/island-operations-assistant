import assert from "node:assert/strict";
import test from "node:test";
import {
  RECIPE_CANONICAL_PROJECTION_CONTRACT_NAME,
  RECIPE_CANONICAL_PROJECTION_CONTRACT_VERSION,
  type RecipeCanonicalProjectionV1
} from "../domains/recipe/contracts/recipe-canonical-projection-contract.js";
import {
  RECIPE_COSTING_CONTRACT_BASIS,
  RECIPE_COSTING_CONTRACT_NAME,
  RECIPE_COSTING_CONTRACT_VERSION
} from "../domains/recipe/contracts/recipe-costing-contract-v2.js";
import { RecipeCostingContractV2Service } from "../domains/recipe/application/recipe-costing-contract-v2-service.js";

const PUBLISHED_AT = "2026-07-31T01:00:00.000Z";
const INGREDIENT_ID = "ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function measurementEvidence(
  rawCoefficient = "2",
  normalizedCoefficient = "2000"
) {
  return {
    contractVersion: 1 as const,
    dimension: "mass" as const,
    rawQuantity: {
      coefficient: rawCoefficient,
      scale: 0
    },
    rawUnitCode: "kg" as const,
    conversionId: "measurement-conversion:kg:g",
    conversionVersion: 1,
    conversionRatio: {
      numerator: "1000",
      denominator: "1"
    },
    normalizedQuantity: {
      coefficient: normalizedCoefficient,
      scale: 0
    },
    canonicalUnitCode: "g" as const
  };
}

function ingredientEvidence(
  ingredientId: string,
  profileVersionId: string,
  rawCoefficient = "2",
  normalizedCoefficient = "2000"
) {
  return {
    contractVersion: 1 as const,
    ingredientId,
    profileId: `profile_${ingredientId}`,
    profileVersionId,
    evaluatedAt: PUBLISHED_AT,
    rawUnitValue: "kg",
    source: {
      sourceType: "SYSTEM" as const,
      referenceId: "recipe-costing-contract-v2-test",
      recordedAt: "2026-07-30T01:00:00.000Z",
      recordedBy: "actor_measurement"
    },
    measurementEvidence: measurementEvidence(
      rawCoefficient,
      normalizedCoefficient
    )
  };
}

function projection(
  state: "Published" | "Superseded" = "Published"
): RecipeCanonicalProjectionV1 {
  return {
    contractName: RECIPE_CANONICAL_PROJECTION_CONTRACT_NAME,
    contractVersion: RECIPE_CANONICAL_PROJECTION_CONTRACT_VERSION,
    basis: "PUBLISHED_RECIPE_VERSION",
    recipeId: "recipe_11111111-1111-4111-8111-111111111111",
    recipeVersionId:
      "recipe_version_22222222-2222-4222-8222-222222222222",
    versionNumber: 3,
    state,
    product: {
      productId: "prod_33333333-3333-4333-8333-333333333333",
      productVersionId: "pver_44444444-4444-4444-8444-444444444444"
    },
    lines: [
      {
        linePosition: 0,
        ingredientId: INGREDIENT_ID,
        normalizationEvidence: ingredientEvidence(
          INGREDIENT_ID,
          "profile_version_recipe_time_a"
        )
      },
      {
        linePosition: 1,
        ingredientId: INGREDIENT_ID,
        normalizationEvidence: ingredientEvidence(
          INGREDIENT_ID,
          "profile_version_recipe_time_b",
          "1",
          "1000"
        )
      }
    ],
    standardOutput: measurementEvidence("500", "500"),
    standardYield: {
      contractVersion: 1,
      dimension: "count",
      rawQuantity: {
        coefficient: "10",
        scale: 0
      },
      rawUnitCode: "each",
      conversionId: "measurement-conversion:each:each",
      conversionVersion: 1,
      conversionRatio: {
        numerator: "1",
        denominator: "1"
      },
      normalizedQuantity: {
        coefficient: "10",
        scale: 0
      },
      canonicalUnitCode: "each"
    },
    publication: {
      publishedAt: PUBLISHED_AT,
      publishedBy: "actor_recipe"
    },
    supersession: state === "Published"
      ? null
      : {
        supersededByRecipeVersionId:
          "recipe_version_55555555-5555-4555-8555-555555555555",
        supersededAt: "2026-08-01T01:00:00.000Z",
        supersededBy: "actor_recipe",
        reason: "Owner-approved replacement"
      }
  };
}

function create(source: RecipeCanonicalProjectionV1 = projection()) {
  return new RecipeCostingContractV2Service().create(source);
}

function created(source: RecipeCanonicalProjectionV1 = projection()) {
  const result = create(source);
  assert.equal(result.status, "created");
  if (result.status !== "created") {
    throw new Error("Expected Recipe Costing Contract v2.");
  }
  return result.contract;
}

function assertFailure(
  source: RecipeCanonicalProjectionV1,
  code: string
): void {
  const result = create(source);
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.failure.code, code);
  }
}

function mutableRecord(source: RecipeCanonicalProjectionV1) {
  return source as unknown as Record<string, unknown>;
}

test("publishes stable v2 identity around the canonical Projection", () => {
  const contract = created();
  assert.equal(contract.contractName, RECIPE_COSTING_CONTRACT_NAME);
  assert.equal(contract.contractVersion, RECIPE_COSTING_CONTRACT_VERSION);
  assert.equal(contract.basis, RECIPE_COSTING_CONTRACT_BASIS);
  assert.equal(
    contract.sourceProjectionContractName,
    RECIPE_CANONICAL_PROJECTION_CONTRACT_NAME
  );
  assert.equal(
    contract.sourceProjectionContractVersion,
    RECIPE_CANONICAL_PROJECTION_CONTRACT_VERSION
  );
});

test("preserves complete Recipe facts and exact canonical evidence", () => {
  const source = projection();
  const contract = created(source);
  assert.deepEqual(contract.recipeProjection, source);
  assert.equal(
    contract.recipeProjection.lines[0]?.normalizationEvidence
      .measurementEvidence.normalizedQuantity.coefficient,
    "2000"
  );
  assert.deepEqual(
    contract.recipeProjection.standardYield.normalizedQuantity,
    { coefficient: "10", scale: 0 }
  );
});

test("Published and historical Superseded Projections are accepted", () => {
  assert.equal(create(projection("Published")).status, "created");
  const contract = created(projection("Superseded"));
  assert.equal(contract.recipeProjection.state, "Superseded");
  assert.equal(
    contract.recipeProjection.supersession?.reason,
    "Owner-approved replacement"
  );
});

test("repeated Ingredient Lines retain zero-based order and distinct quantities", () => {
  const lines = created().recipeProjection.lines;
  assert.deepEqual(lines.map((line) => line.linePosition), [0, 1]);
  assert.deepEqual(lines.map(
    (line) =>
      line.normalizationEvidence.measurementEvidence.normalizedQuantity
        .coefficient
  ), ["2000", "1000"]);
});

test("different Profile Versions remain valid evidence without re-normalization", () => {
  const lines = created().recipeProjection.lines;
  assert.deepEqual(lines.map(
    (line) => line.normalizationEvidence.profileVersionId
  ), [
    "profile_version_recipe_time_a",
    "profile_version_recipe_time_b"
  ]);
});

test("wrong source Contract name and basis fail as invalid source", () => {
  for (const [key, value] of [
    ["contractName", "OtherProjection"],
    ["basis", "OTHER_BASIS"]
  ] as const) {
    const source = projection();
    mutableRecord(source)[key] = value;
    assertFailure(
      source,
      "INVALID_RECIPE_COSTING_CONTRACT_SOURCE"
    );
  }
});

test("missing and unsupported Projection versions remain distinct", () => {
  const missing = projection();
  mutableRecord(missing).contractVersion = undefined;
  assertFailure(missing, "INVALID_RECIPE_COSTING_CONTRACT_SOURCE");

  const unsupported = projection();
  mutableRecord(unsupported).contractVersion = 2;
  assertFailure(
    unsupported,
    "UNSUPPORTED_RECIPE_CANONICAL_PROJECTION_VERSION"
  );
});

test("incomplete Recipe evidence fails closed without a partial Contract", () => {
  const source = projection();
  mutableRecord(source).lines = [];
  const result = create(source);
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.failure.code, "INVALID_RECIPE_COSTING_EVIDENCE");
  }
  assert.equal("contract" in result, false);
});

test("line position and Ingredient evidence contradictions are rejected", () => {
  const wrongPosition = projection();
  const positionLines = mutableRecord(wrongPosition).lines as
    Array<Record<string, unknown>>;
  positionLines[0]!.linePosition = 9;
  assertFailure(wrongPosition, "INVALID_RECIPE_COSTING_EVIDENCE");

  const wrongIngredient = projection();
  const ingredientLines = mutableRecord(wrongIngredient).lines as
    Array<Record<string, unknown>>;
  const evidence = ingredientLines[0]!.normalizationEvidence as
    Record<string, unknown>;
  evidence.ingredientId =
    "ing_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  assertFailure(wrongIngredient, "INVALID_RECIPE_COSTING_EVIDENCE");
});

test("Recipe evidence remains pinned to publishedAt", () => {
  const source = projection();
  const lines = mutableRecord(source).lines as Array<Record<string, unknown>>;
  const evidence = lines[0]!.normalizationEvidence as Record<string, unknown>;
  evidence.evaluatedAt = "2026-08-02T01:00:00.000Z";
  assertFailure(source, "INVALID_RECIPE_COSTING_EVIDENCE");
});

test("state and supersession evidence must remain consistent", () => {
  const source = projection("Published");
  mutableRecord(source).supersession = {
    supersededByRecipeVersionId: "unexpected",
    supersededAt: PUBLISHED_AT,
    supersededBy: "actor",
    reason: "invalid"
  };
  assertFailure(source, "INVALID_RECIPE_COSTING_EVIDENCE");
});

test("identical source evidence produces deeply equal Contracts", () => {
  assert.deepEqual(created(projection()), created(projection()));
});

test("Contract is deeply immutable and defensively copied", () => {
  const source = projection();
  const contract = created(source);
  assert.notEqual(contract.recipeProjection, source);
  assert.notEqual(contract.recipeProjection.lines, source.lines);
  assert.notEqual(
    contract.recipeProjection.lines[0]?.normalizationEvidence,
    source.lines[0]?.normalizationEvidence
  );
  assert.equal(Object.isFrozen(contract), true);
  assert.equal(Object.isFrozen(contract.recipeProjection), true);
  assert.equal(Object.isFrozen(contract.recipeProjection.lines), true);
  assert.equal(Object.isFrozen(
    contract.recipeProjection.lines[0]?.normalizationEvidence
      .measurementEvidence.normalizedQuantity
  ), true);

  mutableRecord(source).recipeId = "mutated";
  assert.notEqual(contract.recipeProjection.recipeId, "mutated");
  assert.equal(Reflect.set(contract.recipeProjection, "recipeId", "mutated"), false);
});

test("unexpected source access failure maps to the typed technical boundary", () => {
  const source = projection();
  Object.defineProperty(source, "contractName", {
    get() {
      throw new Error("unclassified caller object failure");
    }
  });
  assertFailure(source, "RECIPE_COSTING_CONTRACT_V2_FAILED");
});

test("Contract carries no Quote, Currency, price, or calculated Cost facts", () => {
  const serialized = JSON.stringify(created()).toLowerCase();
  for (const forbidden of [
    "quoteid",
    "currency",
    "purchaseamount",
    "normalizedunitcost",
    "linecost",
    "totalcost",
    "costsnapshot"
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});
