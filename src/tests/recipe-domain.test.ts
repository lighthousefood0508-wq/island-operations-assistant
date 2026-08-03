import assert from "node:assert/strict";
import test from "node:test";
import {
  IngredientReference,
  IngredientReferenceId,
  InvalidRecipeState,
  InvalidVersionTransition,
  Quantity,
  RecipeAggregate,
  RecipeAlreadyAbandoned,
  RecipeDraftId,
  RecipeDraftAbandoned,
  RecipeFamilyId,
  RecipeId,
  RecipeInvalidTransition,
  RecipeLineId,
  RecipeLineIdentityCollision,
  RecipeLineNotFound,
  RecipeNotFound,
  RecipePublishValidator,
  RecipeProductBindingConflict,
  RecipeVersionId,
  Unit,
  VersionNumber,
  type RecipeRepository
} from "../domains/recipe/index.js";

const UUIDS = {
  recipe: "11111111-1111-4111-8111-111111111111",
  draft: "22222222-2222-4222-8222-222222222222",
  ingredient: "33333333-3333-4333-8333-333333333333",
  ingredient2: "33333333-3333-4333-8333-333333333334",
  line1: "66666666-6666-4666-8666-666666666661",
  line2: "66666666-6666-4666-8666-666666666662",
  version1: "44444444-4444-4444-8444-444444444444",
  version2: "55555555-5555-4555-8555-555555555555"
} as const;

const timestamp = "2026-07-29T08:00:00.000Z";
const gram = Unit.create("g", "mass");
const kilogram = Unit.create("kg", "mass");
const serving = Unit.create("serving", "count");

function ingredient(): IngredientReference {
  return IngredientReference.create({
    ingredientReferenceId: IngredientReferenceId.fromUuid(UUIDS.ingredient),
    canonicalName: "Pork belly",
    measurementDimension: "mass",
    createdAt: timestamp
  });
}

function secondIngredient(): IngredientReference {
  return IngredientReference.create({
    ingredientReferenceId: IngredientReferenceId.fromUuid(UUIDS.ingredient2),
    canonicalName: "Ginger",
    measurementDimension: "mass",
    createdAt: timestamp
  });
}

function completeDraft(): RecipeAggregate {
  const recipe = RecipeAggregate.createDraft({
    recipeId: RecipeId.fromUuid(UUIDS.recipe),
    draftId: RecipeDraftId.fromUuid(UUIDS.draft),
    name: "Dongpo Pork",
    createdBy: "owner",
    createdAt: timestamp
  });
  recipe.bindProduct("product_dongpo", "product_version_dongpo_1");
  recipe.addIngredient(ingredient(), Quantity.create(600n, 0, gram));
  recipe.defineStandardOutput(
    Quantity.create(600n, 0, gram),
    Quantity.create(3n, 0, serving)
  );
  return recipe;
}

test("Recipe identities require their canonical UUID prefixes", () => {
  assert.equal(RecipeId.fromUuid(UUIDS.recipe).value, `recipe_${UUIDS.recipe}`);
  assert.equal(RecipeDraftId.fromUuid(UUIDS.draft).value, `recipe_draft_${UUIDS.draft}`);
  assert.equal(RecipeVersionId.fromUuid(UUIDS.version1).value, `recipe_version_${UUIDS.version1}`);
  assert.equal(IngredientReferenceId.fromUuid(UUIDS.ingredient).value, `ing_${UUIDS.ingredient}`);

  assert.throws(() => RecipeId.parse(`cost_${UUIDS.recipe}`), InvalidRecipeState);
  assert.throws(() => IngredientReferenceId.parse("Pork belly"), InvalidRecipeState);
});

test("Ingredient identity is stable and independent of its canonical name", () => {
  const referenceId = IngredientReferenceId.fromUuid(UUIDS.ingredient);
  const first = IngredientReference.create({
    ingredientReferenceId: referenceId,
    canonicalName: "Pork belly",
    measurementDimension: "mass",
    createdAt: timestamp
  });
  const renamedProjection = IngredientReference.create({
    ingredientReferenceId: referenceId,
    canonicalName: "Pork belly strip",
    measurementDimension: "mass",
    createdAt: timestamp
  });

  assert.ok(first.ingredientReferenceId.equals(renamedProjection.ingredientReferenceId));
  assert.notEqual(first.canonicalName, renamedProjection.canonicalName);
});

test("Quantity preserves exact coefficient and scale without floating point", () => {
  const exact = Quantity.create(405n, 1, gram);

  assert.equal(exact.coefficient, 405n);
  assert.equal(exact.scale, 1);
  assert.equal(exact.unit.code, "g");
  assert.throws(() => Quantity.create(4050n, 2, gram), InvalidRecipeState);
  assert.throws(() => Quantity.create(1n, 7, gram), InvalidRecipeState);
});

test("Recipe Draft accepts repeated Ingredient Lines with distinct stable Line identities", () => {
  const recipe = RecipeAggregate.createDraft({
    recipeId: RecipeId.fromUuid(UUIDS.recipe),
    draftId: RecipeDraftId.fromUuid(UUIDS.draft),
    name: "Dongpo Pork",
    createdBy: "owner",
    createdAt: timestamp
  });
  const pork = ingredient();
  const line1 = RecipeLineId.fromUuid(UUIDS.line1);
  const line2 = RecipeLineId.fromUuid(UUIDS.line2);
  recipe.addLine({ recipeLineId: line1, ingredient: pork, quantity: Quantity.create(600n, 0, gram) });
  recipe.addLine({ recipeLineId: line2, ingredient: pork, quantity: Quantity.create(200n, 0, gram), preparationNote: "finish" });

  assert.deepEqual(recipe.snapshot().lines.map((line) => line.recipeLineId.value), [line1.value, line2.value]);
  assert.throws(
    () => recipe.addLine({ recipeLineId: line1, ingredient: pork, quantity: Quantity.create(1n, 0, gram) }),
    RecipeLineIdentityCollision
  );
  assert.throws(
    () => RecipeAggregate.createDraft({
      recipeId: RecipeId.fromUuid(UUIDS.recipe),
      draftId: RecipeDraftId.fromUuid(UUIDS.draft),
      name: "Invalid",
      createdBy: "owner",
      createdAt: timestamp
    }).addLine({ recipeLineId: line1, ingredient: pork, quantity: Quantity.create(1n, 0, serving) }),
    /dimension/
  );
});

test("Recipe Family identity is stable and Product binding cannot move to another Product", () => {
  const familyId = RecipeFamilyId.fromUuid(UUIDS.recipe);
  const recipe = RecipeAggregate.createDraft({
    recipeFamilyId: familyId,
    recipeId: RecipeId.fromUuid(UUIDS.recipe),
    draftId: RecipeDraftId.fromUuid(UUIDS.draft),
    name: "Dongpo Pork",
    createdBy: "owner",
    createdAt: timestamp
  });
  recipe.bindProduct("product_dongpo", "product_version_1");
  recipe.bindProduct("product_dongpo", "product_version_2");
  assert.equal(recipe.snapshot().recipeFamilyId.value, familyId.value);
  assert.equal(recipe.snapshot().product?.productVersionId, "product_version_2");
  assert.throws(
    () => recipe.bindProduct("product_other", "product_version_1"),
    RecipeProductBindingConflict
  );
});

test("Line update, removal, and reorder preserve identity and contiguous positions", () => {
  const recipe = completeDraft();
  const first = recipe.snapshot().lines[0]!.recipeLineId;
  const second = RecipeLineId.fromUuid(UUIDS.line2);
  recipe.addLine({
    recipeLineId: second,
    ingredient: ingredient(),
    quantity: Quantity.create(20n, 0, gram)
  });
  recipe.updateLine({
    recipeLineId: first,
    ingredient: secondIngredient(),
    quantity: Quantity.create(1n, 0, kilogram),
    preparationNote: "trimmed"
  });
  recipe.moveLine(second, 0);
  assert.deepEqual(recipe.snapshot().lines.map((line) => [line.recipeLineId.value, line.linePosition]), [
    [second.value, 0],
    [first.value, 1]
  ]);
  assert.equal(recipe.snapshot().lines[1]?.preparationNote, "trimmed");
  assert.equal(recipe.snapshot().lines[1]?.ingredient.canonicalName, "Ginger");
  assert.equal(recipe.snapshot().lines[1]?.quantity.unit.code, "kg");
  recipe.removeLine(second);
  assert.equal(recipe.snapshot().lines[0]?.recipeLineId.value, first.value);
  assert.equal(recipe.snapshot().lines[0]?.linePosition, 0);
  assert.throws(() => recipe.removeLine(second), RecipeLineNotFound);
});

test("Invalid reorder is atomic", () => {
  const recipe = completeDraft();
  const first = recipe.snapshot().lines[0]!.recipeLineId;
  const second = RecipeLineId.fromUuid(UUIDS.line2);
  recipe.addLine({ recipeLineId: second, ingredient: secondIngredient(), quantity: Quantity.create(20n, 0, gram) });
  const before = recipe.snapshot().lines.map((line) => line.recipeLineId.value);
  assert.throws(() => recipe.reorderLines([first, first]));
  assert.throws(() => recipe.reorderLines([first]));
  assert.throws(() => recipe.reorderLines([
    first,
    RecipeLineId.fromUuid("77777777-7777-4777-8777-777777777777")
  ]));
  assert.deepEqual(recipe.snapshot().lines.map((line) => line.recipeLineId.value), before);
});

test("Abandoned Draft is terminal and retains explicit audit evidence", () => {
  const recipe = completeDraft();
  const evidence = recipe.abandon({
    actor: "owner",
    occurredAt: "2026-07-29T09:00:00.000Z",
    reason: "Duplicate draft",
    previousAggregateVersion: 4
  });
  assert.equal(recipe.state, "Abandoned");
  assert.equal(evidence.resultingAggregateVersion, 5);
  assert.equal(recipe.snapshot().abandonment, evidence);
  assert.throws(() => new RecipePublishValidator().validate(recipe, VersionNumber.create(1)), RecipeDraftAbandoned);
  assert.throws(() => recipe.rename("Changed"), RecipeDraftAbandoned);
  assert.throws(() => recipe.publish({
    recipeVersionId: RecipeVersionId.fromUuid(UUIDS.version1),
    versionNumber: VersionNumber.create(1),
    publishedBy: "owner",
    publishedAt: timestamp
  }), RecipeDraftAbandoned);
  assert.throws(() => recipe.abandon({
    actor: "owner",
    occurredAt: timestamp,
    reason: "again",
    previousAggregateVersion: 5
  }), RecipeAlreadyAbandoned);
});

test("Published and Superseded Recipes cannot transition to Abandoned", () => {
  const recipe = completeDraft();
  recipe.publish({
    recipeVersionId: RecipeVersionId.fromUuid(UUIDS.version1),
    versionNumber: VersionNumber.create(1),
    publishedBy: "owner",
    publishedAt: timestamp
  });
  assert.throws(() => recipe.abandon({
    actor: "owner",
    occurredAt: timestamp,
    reason: "invalid",
    previousAggregateVersion: 1
  }), RecipeInvalidTransition);
  recipe.supersede({
    supersededByRecipeVersionId: RecipeVersionId.fromUuid(UUIDS.version2),
    supersededBy: "owner",
    supersededAt: timestamp,
    reason: "new revision"
  });
  assert.throws(() => recipe.abandon({
    actor: "owner",
    occurredAt: timestamp,
    reason: "invalid",
    previousAggregateVersion: 2
  }), RecipeInvalidTransition);
});

test("Draft instructions are optional plain text and become immutable after publication", () => {
  const recipe = completeDraft();
  recipe.setInstructions("  Cook slowly.  ");
  assert.equal(recipe.snapshot().instructions, "Cook slowly.");
  recipe.setInstructions(null);
  assert.equal(recipe.snapshot().instructions, null);
  recipe.publish({
    recipeVersionId: RecipeVersionId.fromUuid(UUIDS.version1),
    versionNumber: VersionNumber.create(1),
    publishedBy: "owner",
    publishedAt: timestamp
  });
  assert.throws(() => recipe.setInstructions("Changed"), InvalidRecipeState);
});

test("Publish requires a complete Draft and makes its Recipe content immutable", () => {
  const incomplete = RecipeAggregate.createDraft({
    recipeId: RecipeId.fromUuid(UUIDS.recipe),
    draftId: RecipeDraftId.fromUuid(UUIDS.draft),
    name: "Incomplete",
    createdBy: "owner",
    createdAt: timestamp
  });
  assert.throws(
    () => incomplete.publish({
      recipeVersionId: RecipeVersionId.fromUuid(UUIDS.version1),
      versionNumber: VersionNumber.create(1),
      publishedBy: "owner",
      publishedAt: timestamp
    }),
    InvalidRecipeState
  );

  const recipe = completeDraft();
  recipe.publish({
    recipeVersionId: RecipeVersionId.fromUuid(UUIDS.version1),
    versionNumber: VersionNumber.create(1),
    publishedBy: "owner",
    publishedAt: timestamp
  });

  const published = recipe.snapshot();
  assert.equal(published.state, "Published");
  assert.equal(published.publication?.recipeVersionId.value, `recipe_version_${UUIDS.version1}`);
  assert.equal(published.lines.length, 1);
  assert.ok(Object.isFrozen(published.lines));
  assert.throws(() => recipe.rename("Changed"), InvalidRecipeState);
  assert.throws(
    () => recipe.addIngredient(ingredient(), Quantity.create(1n, 0, gram)),
    InvalidRecipeState
  );
  assert.throws(
    () => recipe.publish({
      recipeVersionId: RecipeVersionId.fromUuid(UUIDS.version2),
      versionNumber: VersionNumber.create(2),
      publishedBy: "owner",
      publishedAt: timestamp
    }),
    InvalidVersionTransition
  );
});

test("Published Recipe may only be superseded by a different Version with audit facts", () => {
  const recipe = completeDraft();
  const version1 = RecipeVersionId.fromUuid(UUIDS.version1);
  recipe.publish({
    recipeVersionId: version1,
    versionNumber: VersionNumber.create(1),
    publishedBy: "owner",
    publishedAt: timestamp
  });

  assert.throws(
    () => recipe.supersede({
      supersededByRecipeVersionId: version1,
      supersededBy: "owner",
      supersededAt: timestamp,
      reason: "No change"
    }),
    InvalidRecipeState
  );

  recipe.supersede({
    supersededByRecipeVersionId: RecipeVersionId.fromUuid(UUIDS.version2),
    supersededBy: "owner",
    supersededAt: "2026-07-30T08:00:00.000Z",
    reason: "New published recipe"
  });

  assert.equal(recipe.snapshot().state, "Superseded");
  assert.throws(
    () => recipe.supersede({
      supersededByRecipeVersionId: RecipeVersionId.fromUuid(UUIDS.version1),
      supersededBy: "owner",
      supersededAt: timestamp,
      reason: "Invalid second supersession"
    }),
    InvalidVersionTransition
  );
});

test("Repository is a pure interface and RecipeNotFound is a Domain error", () => {
  class InMemoryRecipeRepository implements RecipeRepository {
    private readonly recipes = new Map<string, RecipeAggregate>();

    findById(recipeId: RecipeId): RecipeAggregate | undefined {
      return this.recipes.get(recipeId.value);
    }

    save(recipe: RecipeAggregate): void {
      this.recipes.set(recipe.recipeId.value, recipe);
    }
  }

  const repository = new InMemoryRecipeRepository();
  const recipe = completeDraft();
  repository.save(recipe);

  assert.equal(repository.findById(recipe.recipeId), recipe);
  assert.throws(() => {
    throw new RecipeNotFound(RecipeId.fromUuid(UUIDS.version2).value);
  }, RecipeNotFound);
});
