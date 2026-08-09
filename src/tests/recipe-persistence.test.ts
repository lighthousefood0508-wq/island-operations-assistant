import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryRecipeRepository,
  IngredientReference,
  IngredientReferenceId,
  InvalidRecipePersistenceState,
  Quantity,
  RecipeAggregate,
  RecipeConcurrencyConflict,
  RecipeDraftId,
  RecipeId,
  RecipeLineIdentityCollision,
  RecipePersistenceMapper,
  RecipeRecordNotFound,
  RecipeVersionId,
  Unit,
  VersionNumber,
  type RecipePersistenceRecords
} from "../domains/recipe/index.js";

const UUID = {
  recipe: "10000000-0000-4000-8000-000000000001",
  draft1: "20000000-0000-4000-8000-000000000001",
  draft2: "20000000-0000-4000-8000-000000000002",
  ingredient1: "30000000-0000-4000-8000-000000000001",
  ingredient2: "30000000-0000-4000-8000-000000000002",
  version1: "40000000-0000-4000-8000-000000000001",
  version2: "40000000-0000-4000-8000-000000000002",
  missing: "90000000-0000-4000-8000-000000000001"
} as const;

const createdAt = "2026-07-29T09:00:00.000Z";
const gram = Unit.create("g", "mass");
const serving = Unit.create("serving", "count");
const mapper = new RecipePersistenceMapper();

function draft(input: {
  draftUuid?: string;
  ingredientUuid?: string;
  name?: string;
  coefficient?: bigint;
  scale?: number;
} = {}): RecipeAggregate {
  const aggregate = RecipeAggregate.createDraft({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    draftId: RecipeDraftId.fromUuid(input.draftUuid ?? UUID.draft1),
    name: input.name ?? "Dongpo Pork",
    createdBy: "owner",
    createdAt
  });
  aggregate.bindProduct("product_dongpo", "product_version_dongpo_1");
  aggregate.addIngredient(
    IngredientReference.create({
      ingredientReferenceId: IngredientReferenceId.fromUuid(input.ingredientUuid ?? UUID.ingredient1),
      canonicalName: "Pork belly",
      measurementDimension: "mass",
      createdAt
    }),
    Quantity.create(input.coefficient ?? 600n, input.scale ?? 0, gram)
  );
  aggregate.defineStandardOutput(
    Quantity.create(input.coefficient ?? 600n, input.scale ?? 0, gram),
    Quantity.create(3n, 0, serving)
  );
  return aggregate;
}

function published(input: {
  versionUuid?: string;
  versionNumber?: number;
  draftUuid?: string;
  ingredientUuid?: string;
  coefficient?: bigint;
  scale?: number;
} = {}): RecipeAggregate {
  const aggregate = draft(input);
  aggregate.publish({
    recipeVersionId: RecipeVersionId.fromUuid(input.versionUuid ?? UUID.version1),
    versionNumber: VersionNumber.create(input.versionNumber ?? 1),
    publishedBy: "owner",
    publishedAt: "2026-07-29T10:00:00.000Z"
  });
  return aggregate;
}

test("Draft aggregate round-trips through persistence records", () => {
  const original = draft({ coefficient: 405n, scale: 1 });
  const records = mapper.toRecords(original, 3);
  const restored = mapper.fromRecords(records).snapshot();

  assert.equal(restored.state, "Draft");
  assert.equal(restored.recipeId.value, original.recipeId.value);
  assert.equal(restored.draftId.value, original.draftId.value);
  assert.equal(restored.lines[0]?.quantity.coefficient, 405n);
  assert.equal(records.recipe.aggregateVersion, 3);
});

test("Draft records accept a retained Published pointer while Published records still require an exact pointer", () => {
  const draftRecords = mapper.toRecords(draft(), 3);
  const retainedPointer = Object.freeze({
    ...draftRecords,
    recipe: Object.freeze({
      ...draftRecords.recipe,
      currentRecipeVersionId: `recipe_version_${UUID.version1}`
    })
  });
  assert.equal(mapper.fromRecords(retainedPointer).snapshot().state, "Draft");

  const publishedRecords = mapper.toRecords(published(), 1);
  const mismatchedPointer = Object.freeze({
    ...publishedRecords,
    recipe: Object.freeze({
      ...publishedRecords.recipe,
      currentRecipeVersionId: `recipe_version_${UUID.version2}`
    })
  });
  assert.throws(
    () => mapper.fromRecords(mismatchedPointer),
    InvalidRecipePersistenceState
  );
});

test("Published aggregate round-trips with Version and Publish Audit facts", () => {
  const original = published();
  const records = mapper.toRecords(original, 1);
  const restored = mapper.fromRecords(records).snapshot();

  assert.equal(restored.state, "Published");
  assert.equal(restored.publication?.recipeVersionId.value, `recipe_version_${UUID.version1}`);
  assert.equal(records.version?.versionNumber, 1);
  assert.equal(records.publishAudit?.actor, "owner");
  assert.equal(records.versionLines.length, 1);
});

test("Superseded aggregate round-trips with appendable supersession fact", () => {
  const original = published();
  original.supersede({
    supersededByRecipeVersionId: RecipeVersionId.fromUuid(UUID.version2),
    supersededBy: "owner",
    supersededAt: "2026-07-30T10:00:00.000Z",
    reason: "Recipe revision"
  });
  const records = mapper.toRecords(original, 2);
  const restored = mapper.fromRecords(records).snapshot();

  assert.equal(restored.state, "Superseded");
  assert.equal(restored.supersession?.supersededByRecipeVersionId.value, `recipe_version_${UUID.version2}`);
  assert.equal(records.supersessionAudits.length, 1);
});

test("canonical Ingredient identity and exact numeric representation are preserved", () => {
  const records = mapper.toRecords(draft({ coefficient: 2667n, scale: 4 }), 1);
  const line = records.draftLines[0]!;

  assert.equal(line.ingredientReferenceId, `ing_${UUID.ingredient1}`);
  assert.equal(line.quantity.coefficient, "2667");
  assert.equal(line.quantity.scale, 4);
  assert.equal(typeof line.quantity.coefficient, "string");
  assert.equal(mapper.fromRecords(records).snapshot().lines[0]?.quantity.coefficient, 2667n);
});

test("repeated Ingredient Lines round-trip while duplicate Line identity fails", () => {
  const valid = mapper.toRecords(draft(), 1);
  const first = valid.draftLines[0]!;
  const repeatedIngredient: RecipePersistenceRecords = {
    ...valid,
    draftLines: [
      first,
      {
        ...first,
        recipeLineId: `recipe_line_${UUID.ingredient2}`,
        position: 1
      }
    ]
  };

  assert.equal(mapper.fromRecords(repeatedIngredient).snapshot().lines.length, 2);

  const duplicateLineIdentity: RecipePersistenceRecords = {
    ...valid,
    draftLines: [first, { ...first, position: 1 }]
  };

  assert.throws(
    () => mapper.fromRecords(duplicateLineIdentity),
    (error: unknown) =>
      error instanceof InvalidRecipePersistenceState &&
      error.cause instanceof RecipeLineIdentityCollision
  );
});

test("invalid persisted identity, state, and exact numeric data are rejected", () => {
  const valid = mapper.toRecords(draft(), 1);
  const invalidIdentity: RecipePersistenceRecords = {
    ...valid,
    recipe: { ...valid.recipe, recipeId: `cost_${UUID.recipe}` },
    draft: { ...valid.draft, recipeId: `cost_${UUID.recipe}` }
  };
  const invalidQuantity: RecipePersistenceRecords = {
    ...valid,
    draftLines: valid.draftLines.map((line) => ({
      ...line,
      quantity: { ...line.quantity, coefficient: "600.0" }
    }))
  };

  assert.throws(() => mapper.fromRecords(invalidIdentity), InvalidRecipePersistenceState);
  assert.throws(() => mapper.fromRecords(invalidQuantity), InvalidRecipePersistenceState);
});

test("Repository replaces Draft only with expected aggregate version", () => {
  const repository = new InMemoryRecipeRepository();
  const original = draft();
  repository.save(original);

  const loaded = repository.findWithVersion(original.recipeId)!;
  loaded.aggregate.rename("Dongpo Pork v2 Draft");
  const nextVersion = repository.saveWithExpectedVersion(
    loaded.aggregate,
    loaded.aggregateVersion
  );

  assert.equal(nextVersion, 2);
  assert.equal(repository.findById(original.recipeId)?.snapshot().name, "Dongpo Pork v2 Draft");
  assert.equal(repository.findByDraftId(original.draftId)?.aggregateVersion, 2);
});

test("in-memory repository propagates Abandoned evidence and terminal state", () => {
  const repository = new InMemoryRecipeRepository();
  repository.save(draft());
  const loaded = repository.findWithVersion(RecipeId.fromUuid(UUID.recipe))!;
  loaded.aggregate.abandon({
    actor: "owner",
    occurredAt: "2026-07-29T11:00:00.000Z",
    reason: "Draft no longer applies",
    previousAggregateVersion: loaded.aggregateVersion
  });
  repository.saveWithExpectedVersion(loaded.aggregate, loaded.aggregateVersion);

  const restored = repository.findWithVersion(RecipeId.fromUuid(UUID.recipe))!;
  assert.equal(restored.aggregate.snapshot().state, "Abandoned");
  assert.equal(restored.aggregate.snapshot().abandonment?.reason, "Draft no longer applies");
  assert.equal(restored.aggregateVersion, 2);
});

test("stale write and unversioned overwrite are rejected", () => {
  const repository = new InMemoryRecipeRepository();
  const original = draft();
  repository.save(original);
  const firstRead = repository.findWithVersion(original.recipeId)!;
  const staleRead = repository.findWithVersion(original.recipeId)!;
  firstRead.aggregate.rename("First writer");
  repository.saveWithExpectedVersion(firstRead.aggregate, firstRead.aggregateVersion);

  staleRead.aggregate.rename("Stale writer");
  assert.throws(
    () => repository.saveWithExpectedVersion(staleRead.aggregate, staleRead.aggregateVersion),
    RecipeConcurrencyConflict
  );
  assert.throws(() => repository.save(staleRead.aggregate), RecipeConcurrencyConflict);
});

test("Published Version content cannot be overwritten in place", () => {
  const repository = new InMemoryRecipeRepository();
  const original = published();
  repository.save(original);
  const alteredSameVersion = published({ coefficient: 700n });

  assert.throws(
    () => repository.saveWithExpectedVersion(alteredSameVersion, 1),
    InvalidRecipePersistenceState
  );
  assert.equal(
    repository.findPublishedVersion(
      original.recipeId,
      RecipeVersionId.fromUuid(UUID.version1)
    )?.aggregate.snapshot().lines[0]?.quantity.coefficient,
    600n
  );
});

test("Published Versions and Supersession history are append-first", () => {
  const repository = new InMemoryRecipeRepository();
  const version1 = published();
  repository.save(version1);

  const version2 = published({
    versionUuid: UUID.version2,
    versionNumber: 2,
    draftUuid: UUID.draft2,
    ingredientUuid: UUID.ingredient2,
    coefficient: 550n
  });
  repository.saveWithExpectedVersion(version2, 1);

  const nonMonotonicVersion = published({
    versionUuid: UUID.missing,
    versionNumber: 1,
    draftUuid: UUID.missing,
    ingredientUuid: UUID.ingredient1
  });
  assert.throws(
    () => repository.saveWithExpectedVersion(nonMonotonicVersion, 2),
    InvalidRecipePersistenceState
  );

  const historical = repository.findPublishedVersion(
    version1.recipeId,
    RecipeVersionId.fromUuid(UUID.version1)
  )!;
  historical.aggregate.supersede({
    supersededByRecipeVersionId: RecipeVersionId.fromUuid(UUID.version2),
    supersededBy: "owner",
    supersededAt: "2026-07-30T10:00:00.000Z",
    reason: "Version 2 published"
  });
  repository.saveWithExpectedVersion(historical.aggregate, historical.aggregateVersion);

  assert.equal(
    repository.findPublishedVersion(version1.recipeId, RecipeVersionId.fromUuid(UUID.version1))
      ?.aggregate.snapshot().state,
    "Superseded"
  );
  assert.equal(
    repository.findPublishedVersion(version1.recipeId, RecipeVersionId.fromUuid(UUID.version2))
      ?.aggregate.snapshot().state,
    "Published"
  );
  assert.equal(
    repository.findById(version1.recipeId)?.snapshot().publication?.versionNumber.value,
    2
  );
});

test("missing records return undefined and expose a specific not-found error type", () => {
  const repository = new InMemoryRecipeRepository();
  const missingRecipeId = RecipeId.fromUuid(UUID.missing);

  assert.equal(repository.findById(missingRecipeId), undefined);
  assert.equal(repository.findWithVersion(missingRecipeId), undefined);
  assert.equal(
    repository.findPublishedVersion(missingRecipeId, RecipeVersionId.fromUuid(UUID.version1)),
    undefined
  );
  assert.throws(() => {
    throw new RecipeRecordNotFound(missingRecipeId.value);
  }, RecipeRecordNotFound);
});

test("multiple reads return independent Aggregate instances", () => {
  const repository = new InMemoryRecipeRepository();
  const original = draft();
  repository.save(original);

  const first = repository.findById(original.recipeId)!;
  const second = repository.findById(original.recipeId)!;
  first.rename("Caller-local mutation");

  assert.notEqual(first, second);
  assert.equal(second.snapshot().name, "Dongpo Pork");
  assert.equal(repository.findById(original.recipeId)?.snapshot().name, "Dongpo Pork");
});
