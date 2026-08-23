import assert from "node:assert/strict";
import test from "node:test";
import {
  CanonicalIngredientReferenceImpactNotFound,
  CanonicalIngredientReferenceImpactReadFailure,
  CanonicalIngredientReferenceImpactService,
  CanonicalIngredientReferenceImpactValidationFailure
} from "../application/canonical-ingredient-reference-impact-service.js";
import type {
  CostIngredientReferenceImpactReadPort
} from "../domains/cost/index.js";
import {
  CanonicalIngredientLifecycleNotFound,
  CanonicalIngredientLifecyclePersistenceFailure,
  CanonicalIngredientLifecycleValidationFailure,
  type CanonicalIngredientManagementReadService,
  type CanonicalIngredientManagementRecordV1,
  type RecipeIngredientReferenceImpactReadPort
} from "../domains/recipe/index.js";

const INGREDIENT_ID = "ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function ingredient(
  status: "Active" | "Archived" = "Active"
): CanonicalIngredientManagementRecordV1 {
  return {
    contractVersion: 1,
    ingredientId: INGREDIENT_ID,
    name: "Soy Sauce",
    categoryCode: "sauce",
    status,
    aggregateVersion: status === "Active" ? 0 : 1,
    createdAt: "2026-08-01T00:00:00.000Z",
    createdBy: "owner",
    renameHistory: [],
    ...(status === "Archived"
      ? {
        archiveFact: {
          archivedAt: "2026-08-02T00:00:00.000Z",
          archivedBy: "owner",
          reason: "Historical only"
        }
      }
      : {})
  };
}

type Counters = {
  ingredient: number;
  recipe: number;
  cost: number;
};

function fixture(options: Readonly<{
  status?: "Active" | "Archived";
  ingredientFailure?: Error;
  recipeFailure?: Error;
  costFailure?: Error;
  recipe?: ReturnType<RecipeIngredientReferenceImpactReadPort["findIngredientReferences"]>;
  cost?: ReturnType<CostIngredientReferenceImpactReadPort["findIngredientQuoteReferences"]>;
  accepted?: ReturnType<CostIngredientReferenceImpactReadPort["findIngredientAcceptedPurchaseReferences"]>;
  snapshots?: ReturnType<CostIngredientReferenceImpactReadPort["findIngredientCostSnapshotReferences"]>;
}> = {}) {
  const counters: Counters = { ingredient: 0, recipe: 0, cost: 0 };
  const ingredientReader: Pick<
    CanonicalIngredientManagementReadService,
    "getById"
  > = {
    getById() {
      counters.ingredient += 1;
      if (options.ingredientFailure) throw options.ingredientFailure;
      return ingredient(options.status);
    }
  };
  const recipeReader: RecipeIngredientReferenceImpactReadPort = {
    findIngredientReferences() {
      counters.recipe += 1;
      if (options.recipeFailure) throw options.recipeFailure;
      return options.recipe ?? {
        contractName: "RecipeIngredientReferenceImpact",
        contractVersion: 1,
        draftReferences: [],
        publishedReferences: []
      };
    }
  };
  const costReader: CostIngredientReferenceImpactReadPort = {
    findIngredientQuoteReferences() {
      counters.cost += 1;
      if (options.costFailure) throw options.costFailure;
      return options.cost ?? {
        contractName: "CostIngredientQuoteReferenceImpact",
        contractVersion: 1,
        quoteIds: []
      };
    },
    findIngredientAcceptedPurchaseReferences() {
      counters.cost += 1;
      if (options.costFailure) throw options.costFailure;
      return options.accepted ?? { contractName: "CostAcceptedPurchaseReferenceImpact", contractVersion: 1, acceptedPurchaseIds: [] };
    },
    findIngredientCostSnapshotReferences() {
      counters.cost += 1;
      if (options.costFailure) throw options.costFailure;
      return options.snapshots ?? { contractName: "CostSnapshotReferenceImpact", contractVersion: 1, costSnapshotIds: [] };
    }
  };
  return {
    counters,
    service: new CanonicalIngredientReferenceImpactService(
      ingredientReader,
      recipeReader,
      costReader
    )
  };
}

test("reference impact exposes exact cardinalities, identities and ordering", () => {
  const { service, counters } = fixture({
    recipe: {
      contractName: "RecipeIngredientReferenceImpact",
      contractVersion: 1,
      draftReferences: [
        { recipeId: "recipe_b", draftId: "recipe_draft_b", recipeLineId: "recipe_line_c" },
        { recipeId: "recipe_a", draftId: "recipe_draft_a", recipeLineId: "recipe_line_b" },
        { recipeId: "recipe_a", draftId: "recipe_draft_a", recipeLineId: "recipe_line_a" },
        { recipeId: "recipe_a", draftId: "recipe_draft_a", recipeLineId: "recipe_line_a" }
      ],
      publishedReferences: [
        { recipeId: "recipe_b", recipeVersionId: "recipe_version_b", recipeLineId: "recipe_line_a" },
        { recipeId: "recipe_a", recipeVersionId: "recipe_version_b", recipeLineId: "recipe_line_a" },
        { recipeId: "recipe_a", recipeVersionId: "recipe_version_a", recipeLineId: "recipe_line_a" }
      ]
    },
    cost: {
      contractName: "CostIngredientQuoteReferenceImpact",
      contractVersion: 1,
      quoteIds: ["cost_quote_b", "cost_quote_a", "cost_quote_a"]
    },
    snapshots: { contractName: "CostSnapshotReferenceImpact", contractVersion: 1, costSnapshotIds: ["cost_snapshot_b", "cost_snapshot_a", "cost_snapshot_a"] }
  });

  const result = service.getByIngredientId(INGREDIENT_ID);

  assert.equal(result.contractName, "CanonicalIngredientReferenceImpact");
  assert.equal(result.contractVersion, 1);
  assert.equal(result.ingredientId, INGREDIENT_ID);
  assert.deepEqual(result.recipeDrafts, {
    availability: "Available",
    uniqueRecipeCount: 2,
    draftCount: 2,
    lineOccurrenceCount: 3,
    recipeIds: ["recipe_a", "recipe_b"],
    draftIds: ["recipe_draft_a", "recipe_draft_b"],
    references: [
      { recipeId: "recipe_a", draftId: "recipe_draft_a", recipeLineId: "recipe_line_a" },
      { recipeId: "recipe_a", draftId: "recipe_draft_a", recipeLineId: "recipe_line_b" },
      { recipeId: "recipe_b", draftId: "recipe_draft_b", recipeLineId: "recipe_line_c" }
    ]
  });
  assert.equal(result.recipePublishedVersions.uniqueRecipeCount, 2);
  assert.equal(result.recipePublishedVersions.publishedVersionCount, 2);
  assert.equal(result.recipePublishedVersions.lineOccurrenceCount, 3);
  assert.deepEqual(result.recipePublishedVersions.recipeIds, ["recipe_a", "recipe_b"]);
  assert.deepEqual(result.recipePublishedVersions.recipeVersionIds, [
    "recipe_version_a",
    "recipe_version_b"
  ]);
  assert.deepEqual(result.costQuotes, {
    availability: "Available",
    quoteCount: 2,
    quoteIds: ["cost_quote_a", "cost_quote_b"]
  });
  assert.deepEqual(result.acceptedPurchases, { availability: "Available", acceptedPurchaseCount: 0, acceptedPurchaseIds: [] });
  assert.deepEqual(result.costSnapshots, { availability: "Available", costSnapshotCount: 2, costSnapshotIds: ["cost_snapshot_a", "cost_snapshot_b"] });
  assert.deepEqual(result.deletionEligibility, {
    status: "Indeterminate",
    blocked: true
  });
  assert.deepEqual(counters, { ingredient: 1, recipe: 1, cost: 3 });
});

test("available zero-reference categories remain distinct from unavailable authorities", () => {
  const { service } = fixture({ status: "Archived" });
  const result = service.getByIngredientId(INGREDIENT_ID);
  assert.deepEqual(result.recipeDrafts, {
    availability: "Available",
    uniqueRecipeCount: 0,
    draftCount: 0,
    lineOccurrenceCount: 0,
    recipeIds: [],
    draftIds: [],
    references: []
  });
  assert.deepEqual(result.recipePublishedVersions, {
    availability: "Available",
    uniqueRecipeCount: 0,
    publishedVersionCount: 0,
    lineOccurrenceCount: 0,
    recipeIds: [],
    recipeVersionIds: [],
    references: []
  });
  assert.deepEqual(Object.keys(result.acceptedPurchases), ["availability", "acceptedPurchaseCount", "acceptedPurchaseIds"]);
  assert.deepEqual(Object.keys(result.costSnapshots), ["availability", "costSnapshotCount", "costSnapshotIds"]);
});

test("malformed and missing identities stop before Domain impact reads", () => {
  for (const [failure, Expected] of [
    [new CanonicalIngredientLifecycleValidationFailure(), CanonicalIngredientReferenceImpactValidationFailure],
    [new CanonicalIngredientLifecycleNotFound(), CanonicalIngredientReferenceImpactNotFound]
  ] as const) {
    const { service, counters } = fixture({ ingredientFailure: failure });
    assert.throws(() => service.getByIngredientId("bad"), Expected);
    assert.deepEqual(counters, { ingredient: 1, recipe: 0, cost: 0 });
  }
});

test("Canonical Ingredient, Recipe and Cost failures fail the whole request", () => {
  const cases = [
    fixture({
      ingredientFailure: new CanonicalIngredientLifecyclePersistenceFailure()
    }),
    fixture({ recipeFailure: new Error("raw recipe sqlite failure") }),
    fixture({ costFailure: new Error("raw cost sqlite failure") })
  ];
  for (const { service } of cases) {
    let thrown: unknown;
    try {
      service.getByIngredientId(INGREDIENT_ID);
    } catch (error) {
      thrown = error;
    }
    assert.ok(thrown instanceof CanonicalIngredientReferenceImpactReadFailure);
    assert.equal(thrown.code, "CANONICAL_INGREDIENT_REFERENCE_IMPACT_READ_FAILURE");
    assert.equal(thrown.message, "Canonical Ingredient Reference Impact could not be read.");
    assert.equal("cause" in thrown, false);
    assert.doesNotMatch(thrown.message, /sqlite|recipe|cost/i);
    assert.doesNotMatch(thrown.stack ?? "", /raw recipe|raw cost/i);
  }
  assert.deepEqual(cases[1]!.counters, { ingredient: 1, recipe: 1, cost: 0 });
  assert.deepEqual(cases[2]!.counters, { ingredient: 1, recipe: 1, cost: 1 });
});
