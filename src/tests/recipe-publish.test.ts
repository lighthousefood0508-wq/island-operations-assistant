import assert from "node:assert/strict";
import test from "node:test";
import {
  DraftCreationFailed,
  InMemoryRecipeRepository,
  IngredientReference,
  IngredientReferenceId,
  InvalidPublishState,
  InvalidRecipeState,
  InvalidSupersession,
  PublishValidationFailed,
  Quantity,
  RecipeAggregate,
  RecipeDraftId,
  RecipeId,
  RecipeLineId,
  RecipePublishService,
  RecipeSnapshotBuilder,
  RecipeSnapshotComparator,
  RecipeVersionId,
  SnapshotImmutableViolation,
  Unit,
  VersionNumber,
  type PublishedRecipeSnapshot
} from "../domains/recipe/index.js";

const UUID = {
  recipe: "11000000-0000-4000-8000-000000000001",
  draft1: "21000000-0000-4000-8000-000000000001",
  draft2: "21000000-0000-4000-8000-000000000002",
  ingredient1: "31000000-0000-4000-8000-000000000001",
  ingredient2: "31000000-0000-4000-8000-000000000002",
  line2: "51000000-0000-4000-8000-000000000002",
  version1: "41000000-0000-4000-8000-000000000001",
  version2: "41000000-0000-4000-8000-000000000002"
} as const;

const createdAt = "2026-07-29T11:00:00.000Z";
const gram = Unit.create("g", "mass");
const serving = Unit.create("serving", "count");

function completeDraft(input: {
  draftUuid?: string;
  ingredientUuid?: string;
  coefficient?: bigint;
} = {}): RecipeAggregate {
  const aggregate = RecipeAggregate.createDraft({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    draftId: RecipeDraftId.fromUuid(input.draftUuid ?? UUID.draft1),
    name: "Dongpo Pork",
    createdBy: "owner",
    createdAt
  });
  aggregate.bindProduct("product_dongpo", "product_version_dongpo_1");
  aggregate.addIngredient(
    IngredientReference.create({
      ingredientReferenceId: IngredientReferenceId.fromUuid(
        input.ingredientUuid ?? UUID.ingredient1
      ),
      canonicalName: "Pork belly",
      measurementDimension: "mass",
      createdAt
    }),
    Quantity.create(input.coefficient ?? 600n, 0, gram)
  );
  aggregate.defineStandardOutput(
    Quantity.create(input.coefficient ?? 600n, 0, gram),
    Quantity.create(3n, 0, serving)
  );
  return aggregate;
}

function publishVersion1(): {
  repository: InMemoryRecipeRepository;
  service: RecipePublishService;
  snapshot: PublishedRecipeSnapshot;
  aggregateVersion: number;
} {
  const repository = new InMemoryRecipeRepository();
  repository.save(completeDraft());
  const service = new RecipePublishService(repository);
  const result = service.publish({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    recipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
    versionNumber: VersionNumber.create(1),
    expectedAggregateVersion: 1,
    publishedBy: "owner",
    publishedAt: "2026-07-29T12:00:00.000Z"
  });
  return { repository, service, ...result };
}

function publishTwoVersions(): {
  repository: InMemoryRecipeRepository;
  service: RecipePublishService;
  aggregateVersion: number;
} {
  const first = publishVersion1();
  const draftResult = first.service.createDraftFromPublished({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    sourceRecipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
    newDraftId: RecipeDraftId.fromUuid(UUID.draft2),
    expectedAggregateVersion: first.aggregateVersion,
    createdBy: "owner",
    createdAt: "2026-07-30T09:00:00.000Z"
  });
  const second = first.service.publish({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    recipeVersionId: RecipeVersionId.fromUuid(UUID.version2),
    versionNumber: VersionNumber.create(2),
    expectedAggregateVersion: draftResult.aggregateVersion,
    publishedBy: "owner",
    publishedAt: "2026-07-30T10:00:00.000Z"
  });
  return {
    repository: first.repository,
    service: first.service,
    aggregateVersion: second.aggregateVersion
  };
}

test("complete Draft publishes through the single Publish Service path", () => {
  const result = publishVersion1();

  assert.equal(result.snapshot.state, "Published");
  assert.equal(result.snapshot.recipeId, `recipe_${UUID.recipe}`);
  assert.equal(result.snapshot.recipeVersionId, `recipe_version_${UUID.version1}`);
  assert.equal(result.snapshot.versionNumber, 1);
  assert.equal(result.snapshot.lines.length, 1);
  assert.equal(result.aggregateVersion, 2);
});

test("Publish Validation rejects an incomplete Draft without persisting a Version", () => {
  const repository = new InMemoryRecipeRepository();
  const incomplete = RecipeAggregate.createDraft({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    draftId: RecipeDraftId.fromUuid(UUID.draft1),
    name: "Incomplete",
    createdBy: "owner",
    createdAt
  });
  repository.save(incomplete);
  const service = new RecipePublishService(repository);

  assert.throws(
    () => service.publish({
      recipeId: incomplete.recipeId,
      recipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
      versionNumber: VersionNumber.create(1),
      expectedAggregateVersion: 1,
      publishedBy: "owner",
      publishedAt: createdAt
    }),
    PublishValidationFailed
  );
  assert.equal(repository.findPublishedVersion(incomplete.recipeId), undefined);
  assert.equal(repository.findWithVersion(incomplete.recipeId)?.aggregateVersion, 1);
});

test("Published Aggregate content remains immutable", () => {
  const result = publishVersion1();
  const published = result.repository.findPublishedVersion(
    RecipeId.fromUuid(UUID.recipe),
    RecipeVersionId.fromUuid(UUID.version1)
  )!.aggregate;

  assert.throws(() => published.rename("Changed"), InvalidRecipeState);
  assert.throws(
    () => published.defineStandardOutput(
      Quantity.create(700n, 0, gram),
      Quantity.create(3n, 0, serving)
    ),
    InvalidRecipeState
  );
});

test("Create Draft From Published copies frozen content into a new editable Draft", () => {
  const result = publishVersion1();
  assert.throws(
    () => result.service.createDraftFromPublished({
      recipeId: RecipeId.fromUuid(UUID.recipe),
      sourceRecipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
      newDraftId: RecipeDraftId.fromUuid(UUID.draft1),
      expectedAggregateVersion: result.aggregateVersion,
      createdBy: "owner",
      createdAt
    }),
    DraftCreationFailed
  );

  const created = result.service.createDraftFromPublished({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    sourceRecipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
    newDraftId: RecipeDraftId.fromUuid(UUID.draft2),
    expectedAggregateVersion: result.aggregateVersion,
    createdBy: "owner",
    createdAt: "2026-07-30T09:00:00.000Z"
  });
  created.draft.rename("Editable Recipe Draft");

  assert.equal(created.draft.state, "Draft");
  assert.equal(created.draft.recipeFamilyId.value, result.snapshot.recipeFamilyId);
  assert.equal(created.draft.snapshot().lines[0]?.quantity.coefficient, 600n);
  assert.equal(created.draft.snapshot().name, "Editable Recipe Draft");
  assert.equal(
    result.repository.findPublishedVersion(
      RecipeId.fromUuid(UUID.recipe),
      RecipeVersionId.fromUuid(UUID.version1)
    )?.aggregate.snapshot().name,
    "Dongpo Pork"
  );
});

test("Published Snapshot is deeply immutable", () => {
  const result = publishVersion1();
  const builder = new RecipeSnapshotBuilder();

  assert.ok(Object.isFrozen(result.snapshot));
  assert.ok(Object.isFrozen(result.snapshot.lines));
  assert.ok(Object.isFrozen(result.snapshot.lines[0]));
  assert.ok(Object.isFrozen(result.snapshot.lines[0]?.ingredient));
  assert.ok(Object.isFrozen(result.snapshot.lines[0]?.quantity));
  assert.ok(Object.isFrozen(result.snapshot.standardYield.unit));
  assert.throws(
    () => builder.assertImmutable({ ...result.snapshot }),
    SnapshotImmutableViolation
  );
});

test("Snapshot Compare reports Ingredient, Quantity, Unit, Yield, and Output differences", () => {
  const first = publishVersion1().snapshot;
  const changed = completeDraft({ coefficient: 700n });
  changed.addIngredient(
    IngredientReference.create({
      ingredientReferenceId: IngredientReferenceId.fromUuid(UUID.ingredient2),
      canonicalName: "Ginger",
      measurementDimension: "mass",
      createdAt
    }),
    Quantity.create(50n, 0, gram)
  );
  changed.publish({
    recipeVersionId: RecipeVersionId.fromUuid(UUID.version2),
    versionNumber: VersionNumber.create(2),
    publishedBy: "owner",
    publishedAt: "2026-07-30T10:00:00.000Z"
  });
  const second = new RecipeSnapshotBuilder().build(changed);
  const comparator = new RecipeSnapshotComparator();

  assert.equal(comparator.compare(first, first).equal, true);
  const report = comparator.compare(first, second);
  assert.equal(report.equal, false);
  assert.ok(report.differences.some((item) => item.kind === "ingredient_added"));
  assert.ok(report.differences.some((item) => item.kind === "quantity_changed"));
  assert.ok(report.differences.some((item) => item.kind === "standard_output_changed"));
  assert.ok(Object.isFrozen(report.differences));
});

test("Supersede succeeds only after the replacement Version is Published", () => {
  const setup = publishTwoVersions();
  const result = setup.service.supersede({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    supersededRecipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
    supersededByRecipeVersionId: RecipeVersionId.fromUuid(UUID.version2),
    expectedAggregateVersion: setup.aggregateVersion,
    actor: "owner",
    occurredAt: "2026-07-30T11:00:00.000Z",
    reason: "Version 2 published"
  });

  assert.equal(result.supersededSnapshot.state, "Superseded");
  assert.equal(result.currentPublishedSnapshot.state, "Published");
  assert.equal(
    result.supersededSnapshot.supersession?.supersededByRecipeVersionId,
    `recipe_version_${UUID.version2}`
  );
});

test("Publish and Supersede require increasing Version Numbers", () => {
  const first = publishVersion1();
  const draftResult = first.service.createDraftFromPublished({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    sourceRecipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
    newDraftId: RecipeDraftId.fromUuid(UUID.draft2),
    expectedAggregateVersion: first.aggregateVersion,
    createdBy: "owner",
    createdAt
  });

  assert.throws(
    () => first.service.publish({
      recipeId: RecipeId.fromUuid(UUID.recipe),
      recipeVersionId: RecipeVersionId.fromUuid(UUID.version2),
      versionNumber: VersionNumber.create(1),
      expectedAggregateVersion: draftResult.aggregateVersion,
      publishedBy: "owner",
      publishedAt: createdAt
    }),
    InvalidPublishState
  );
  assert.throws(() => VersionNumber.create(0), InvalidRecipeState);
});

test("Historical Published Version remains available after Supersession", () => {
  const setup = publishTwoVersions();
  setup.service.supersede({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    supersededRecipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
    supersededByRecipeVersionId: RecipeVersionId.fromUuid(UUID.version2),
    expectedAggregateVersion: setup.aggregateVersion,
    actor: "owner",
    occurredAt: "2026-07-30T11:00:00.000Z",
    reason: "Version 2 published"
  });

  const oldVersion = setup.repository.findPublishedVersion(
    RecipeId.fromUuid(UUID.recipe),
    RecipeVersionId.fromUuid(UUID.version1)
  );
  const currentVersion = setup.repository.findPublishedVersion(
    RecipeId.fromUuid(UUID.recipe),
    RecipeVersionId.fromUuid(UUID.version2)
  );
  assert.equal(oldVersion?.aggregate.snapshot().publication?.versionNumber.value, 1);
  assert.equal(oldVersion?.aggregate.state, "Superseded");
  assert.equal(currentVersion?.aggregate.snapshot().publication?.versionNumber.value, 2);
  assert.equal(currentVersion?.aggregate.state, "Published");
});

test("Supersession Audit is append-first and cannot be overwritten", () => {
  const setup = publishTwoVersions();
  const first = setup.service.supersede({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    supersededRecipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
    supersededByRecipeVersionId: RecipeVersionId.fromUuid(UUID.version2),
    expectedAggregateVersion: setup.aggregateVersion,
    actor: "owner",
    occurredAt: "2026-07-30T11:00:00.000Z",
    reason: "Approved revision"
  });

  assert.throws(
    () => setup.service.supersede({
      recipeId: RecipeId.fromUuid(UUID.recipe),
      supersededRecipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
      supersededByRecipeVersionId: RecipeVersionId.fromUuid(UUID.version2),
      expectedAggregateVersion: first.aggregateVersion,
      actor: "another",
      occurredAt: "2026-07-30T12:00:00.000Z",
      reason: "Overwrite attempt"
    }),
    InvalidSupersession
  );
  const archived = setup.repository.findPublishedVersion(
    RecipeId.fromUuid(UUID.recipe),
    RecipeVersionId.fromUuid(UUID.version1)
  )!.aggregate.snapshot();
  assert.equal(archived.supersession?.reason, "Approved revision");
});

test("invalid repeat Publish is rejected", () => {
  const result = publishVersion1();

  assert.throws(
    () => result.service.publish({
      recipeId: RecipeId.fromUuid(UUID.recipe),
      recipeVersionId: RecipeVersionId.fromUuid(UUID.version2),
      versionNumber: VersionNumber.create(2),
      expectedAggregateVersion: result.aggregateVersion,
      publishedBy: "owner",
      publishedAt: createdAt
    }),
    InvalidPublishState
  );
});

test("Published Snapshot retains distinct repeated Ingredient Lines", () => {
  const beforeCandidate = completeDraft();
  beforeCandidate.publish({
    recipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
    versionNumber: VersionNumber.create(1),
    publishedBy: "owner",
    publishedAt: createdAt
  });
  const before = new RecipeSnapshotBuilder().build(beforeCandidate);
  const candidate = completeDraft();
  const duplicate = IngredientReference.create({
    ingredientReferenceId: IngredientReferenceId.fromUuid(UUID.ingredient1),
    canonicalName: "Same identity with another name",
    measurementDimension: "mass",
    createdAt
  });

  candidate.addLine({
    recipeLineId: RecipeLineId.fromUuid(UUID.line2),
    ingredient: duplicate,
    quantity: Quantity.create(1n, 0, gram),
    preparationNote: "finishing line"
  });
  const firstLineId = candidate.snapshot().lines[0]!.recipeLineId;
  candidate.updateLine({ recipeLineId: firstLineId, preparationNote: "base line" });
  candidate.moveLine(RecipeLineId.fromUuid(UUID.line2), 0);
  candidate.setInstructions("Cook slowly.");
  candidate.publish({
    recipeVersionId: RecipeVersionId.fromUuid(UUID.version2),
    versionNumber: VersionNumber.create(2),
    publishedBy: "owner",
    publishedAt: createdAt
  });
  const snapshot = new RecipeSnapshotBuilder().build(candidate);
  assert.equal(snapshot.lines.length, 2);
  assert.equal(new Set(snapshot.lines.map((line) => line.recipeLineId)).size, 2);
  assert.equal(snapshot.lines[0]?.preparationNote, "finishing line");
  assert.equal(snapshot.lines[1]?.preparationNote, "base line");
  assert.equal(snapshot.instructions, "Cook slowly.");
  const comparator = new RecipeSnapshotComparator();
  assert.equal(comparator.compare(snapshot, snapshot).equal, true);
  const report = comparator.compare(before, snapshot);
  assert.ok(report.differences.some((difference) => difference.kind === "ingredient_added"));
  assert.ok(report.differences.some((difference) => difference.kind === "line_position_changed"));
  assert.ok(report.differences.some((difference) => difference.kind === "preparation_note_changed"));
  assert.ok(report.differences.some((difference) => difference.kind === "instructions_changed"));
});
