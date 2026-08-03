import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryRecipeRepository,
  IngredientReference,
  IngredientReferenceId,
  InvalidPublishState,
  InvalidRecipeEvent,
  PublishValidationFailed,
  Quantity,
  RECIPE_EVENT_TYPES,
  RECIPE_EVENT_VERSION,
  RecipeDraftId,
  RecipeAggregate,
  RecipeAlreadyAbandoned,
  RecipeEventAlreadyConsumed,
  RecipeEventFactory,
  RecipeId,
  RecipePublishService,
  RecipePublishValidator,
  RecipeSnapshotBuilder,
  RecipeVersionId,
  Unit,
  VersionNumber
} from "../domains/recipe/index.js";

const UUID = {
  recipe: "12000000-0000-4000-8000-000000000001",
  draft1: "22000000-0000-4000-8000-000000000001",
  draft2: "22000000-0000-4000-8000-000000000002",
  ingredient: "32000000-0000-4000-8000-000000000001",
  version1: "42000000-0000-4000-8000-000000000001",
  version2: "42000000-0000-4000-8000-000000000002"
} as const;

const createdAt = "2026-07-29T13:00:00.000Z";
const gram = Unit.create("g", "mass");
const serving = Unit.create("serving", "count");

class RecordingRecipeEventFactory extends RecipeEventFactory {
  publishedCalls = 0;

  override published(
    input: Parameters<RecipeEventFactory["published"]>[0]
  ): ReturnType<RecipeEventFactory["published"]> {
    this.publishedCalls += 1;
    return super.published(input);
  }
}

function prepareCompleteDraft(input: {
  eventFactory?: RecipeEventFactory;
} = {}): {
  repository: InMemoryRecipeRepository;
  service: RecipePublishService;
  aggregateVersion: number;
} {
  const repository = new InMemoryRecipeRepository();
  const service = new RecipePublishService(
    repository,
    new RecipePublishValidator(),
    new RecipeSnapshotBuilder(),
    input.eventFactory
  );
  const created = service.createDraft({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    draftId: RecipeDraftId.fromUuid(UUID.draft1),
    name: "Dongpo Pork",
    createdBy: "owner",
    createdAt
  });
  created.draft.bindProduct("product_dongpo", "product_version_dongpo_1");
  created.draft.addIngredient(
    IngredientReference.create({
      ingredientReferenceId: IngredientReferenceId.fromUuid(UUID.ingredient),
      canonicalName: "Pork belly",
      measurementDimension: "mass",
      createdAt
    }),
    Quantity.create(600n, 0, gram)
  );
  created.draft.defineStandardOutput(
    Quantity.create(600n, 0, gram),
    Quantity.create(3n, 0, serving)
  );
  const aggregateVersion = repository.saveWithExpectedVersion(
    created.draft,
    created.aggregateVersion
  );
  return { repository, service, aggregateVersion };
}

function publishVersion1(input: {
  eventFactory?: RecipeEventFactory;
} = {}) {
  const prepared = prepareCompleteDraft(input);
  const published = prepared.service.publish({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    recipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
    versionNumber: VersionNumber.create(1),
    expectedAggregateVersion: prepared.aggregateVersion,
    publishedBy: "owner",
    publishedAt: "2026-07-29T14:00:00.000Z"
  });
  return { ...prepared, published };
}

function publishTwoVersions() {
  const first = publishVersion1();
  const draft = first.service.createDraftFromPublished({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    sourceRecipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
    newDraftId: RecipeDraftId.fromUuid(UUID.draft2),
    expectedAggregateVersion: first.published.aggregateVersion,
    createdBy: "owner",
    createdAt: "2026-07-30T09:00:00.000Z"
  });
  const second = first.service.publish({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    recipeVersionId: RecipeVersionId.fromUuid(UUID.version2),
    versionNumber: VersionNumber.create(2),
    expectedAggregateVersion: draft.aggregateVersion,
    publishedBy: "owner",
    publishedAt: "2026-07-30T10:00:00.000Z"
  });
  return { ...first, draft, second };
}

test("successful initial Draft creation produces RecipeDraftCreated v1", () => {
  const repository = new InMemoryRecipeRepository();
  const service = new RecipePublishService(repository);
  const result = service.createDraft({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    draftId: RecipeDraftId.fromUuid(UUID.draft1),
    name: "Dongpo Pork",
    createdBy: "owner",
    createdAt,
    eventContext: {
      correlationId: "correlation-order-1",
      causationId: "command-create-draft-1"
    }
  });
  const event = result.events.peek()[0]!;

  assert.equal(event.eventType, RECIPE_EVENT_TYPES.draftCreated);
  assert.equal(event.eventVersion, 1);
  assert.equal(event.payload.recipeId, `recipe_${UUID.recipe}`);
  assert.equal(event.payload.draftId, `recipe_draft_${UUID.draft1}`);
  assert.equal(event.payload.sourceVersionId, null);
  assert.equal(event.actorId, "owner");
  assert.equal(event.occurredAt, createdAt);
});

test("Draft created from Published Version preserves sourceVersionId", () => {
  const first = publishVersion1();
  const result = first.service.createDraftFromPublished({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    sourceRecipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
    newDraftId: RecipeDraftId.fromUuid(UUID.draft2),
    expectedAggregateVersion: first.published.aggregateVersion,
    createdBy: "owner",
    createdAt: "2026-07-30T09:00:00.000Z"
  });
  const event = result.events.peek()[0]!;

  assert.equal(event.eventType, RECIPE_EVENT_TYPES.draftCreated);
  if (event.eventType !== RECIPE_EVENT_TYPES.draftCreated) {
    throw new Error("Expected RecipeDraftCreated.");
  }
  assert.equal(event.payload.sourceVersionId, `recipe_version_${UUID.version1}`);
});

test("successful Publish produces RecipePublished v1", () => {
  const result = publishVersion1().published;
  const event = result.events.peek()[0]!;

  assert.equal(event.eventType, RECIPE_EVENT_TYPES.published);
  assert.equal(event.eventVersion, RECIPE_EVENT_VERSION);
  assert.equal(event.aggregateVersion, result.aggregateVersion);
  assert.equal(event.aggregateId, `recipe_${UUID.recipe}`);
});

test("RecipePublished payload uses the approved immutable Published Snapshot", () => {
  const result = publishVersion1().published;
  const event = result.events.peek()[0]!;
  if (event.eventType !== RECIPE_EVENT_TYPES.published) {
    throw new Error("Expected RecipePublished.");
  }

  assert.equal(event.payload.snapshot, result.snapshot);
  assert.equal(event.payload.versionId, result.snapshot.recipeVersionId);
  assert.equal(event.payload.product, result.snapshot.product);
  assert.equal(event.payload.publishedAt, result.snapshot.publishedAt);
});

test("Publish validation failure produces no RecipePublished event", () => {
  const factory = new RecordingRecipeEventFactory();
  const repository = new InMemoryRecipeRepository();
  const service = new RecipePublishService(
    repository,
    new RecipePublishValidator(),
    new RecipeSnapshotBuilder(),
    factory
  );
  const created = service.createDraft({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    draftId: RecipeDraftId.fromUuid(UUID.draft1),
    name: "Incomplete",
    createdBy: "owner",
    createdAt
  });

  assert.throws(
    () => service.publish({
      recipeId: RecipeId.fromUuid(UUID.recipe),
      recipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
      versionNumber: VersionNumber.create(1),
      expectedAggregateVersion: created.aggregateVersion,
      publishedBy: "owner",
      publishedAt: createdAt
    }),
    PublishValidationFailed
  );
  assert.equal(factory.publishedCalls, 0);
  assert.equal(repository.findPublishedVersion(RecipeId.fromUuid(UUID.recipe)), undefined);
});

test("persistence concurrency failure does not claim a RecipePublished event", () => {
  const factory = new RecordingRecipeEventFactory();
  const prepared = prepareCompleteDraft({ eventFactory: factory });

  assert.throws(() => prepared.service.publish({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    recipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
    versionNumber: VersionNumber.create(1),
    expectedAggregateVersion: prepared.aggregateVersion - 1,
    publishedBy: "owner",
    publishedAt: createdAt
  }));
  assert.equal(factory.publishedCalls, 0);
  assert.equal(
    prepared.repository.findWithVersion(RecipeId.fromUuid(UUID.recipe))?.aggregate.state,
    "Draft"
  );
});

test("successful Supersede produces RecipeSuperseded v1", () => {
  const setup = publishTwoVersions();
  const result = setup.service.supersede({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    supersededRecipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
    supersededByRecipeVersionId: RecipeVersionId.fromUuid(UUID.version2),
    expectedAggregateVersion: setup.second.aggregateVersion,
    actor: "owner",
    occurredAt: "2026-07-30T11:00:00.000Z",
    reason: "Version 2 published"
  });
  const event = result.events.peek()[0]!;

  assert.equal(event.eventType, RECIPE_EVENT_TYPES.superseded);
  if (event.eventType !== RECIPE_EVENT_TYPES.superseded) {
    throw new Error("Expected RecipeSuperseded.");
  }
  assert.equal(event.payload.supersededVersionId, `recipe_version_${UUID.version1}`);
  assert.equal(event.payload.supersedingVersionId, `recipe_version_${UUID.version2}`);
  assert.equal(event.payload.reason, "Version 2 published");
});

test("Supersession event does not delete or rewrite the old Published Snapshot", () => {
  const setup = publishTwoVersions();
  const originalSnapshot = setup.published.snapshot;
  setup.service.supersede({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    supersededRecipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
    supersededByRecipeVersionId: RecipeVersionId.fromUuid(UUID.version2),
    expectedAggregateVersion: setup.second.aggregateVersion,
    actor: "owner",
    occurredAt: "2026-07-30T11:00:00.000Z",
    reason: "Version 2 published"
  });

  assert.equal(originalSnapshot.state, "Published");
  assert.equal(originalSnapshot.supersession, null);
  assert.equal(originalSnapshot.recipeVersionId, `recipe_version_${UUID.version1}`);
  assert.ok(Object.isFrozen(originalSnapshot));
});

test("eventType values are stable constants independent of class names", () => {
  const event = publishVersion1().published.events.peek()[0]!;

  assert.equal(RECIPE_EVENT_TYPES.draftCreated, "recipe.draft-created");
  assert.equal(RECIPE_EVENT_TYPES.draftAbandoned, "recipe.draft-abandoned");
  assert.equal(RECIPE_EVENT_TYPES.published, "recipe.published");
  assert.equal(RECIPE_EVENT_TYPES.superseded, "recipe.superseded");
  assert.notEqual(event.eventType, event.constructor.name);
});

test("Draft abandonment produces one stable event with explicit evidence", () => {
  const draft = RecipeAggregate.createDraft({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    draftId: RecipeDraftId.fromUuid(UUID.draft1),
    name: "Duplicate draft",
    createdBy: "owner",
    createdAt
  });
  const abandonment = draft.abandon({
    actor: "owner",
    occurredAt: "2026-07-29T13:30:00.000Z",
    reason: "Duplicate draft",
    previousAggregateVersion: 2
  });
  const factory = new RecipeEventFactory();
  type DraftAbandonedInput = Parameters<RecipeEventFactory["draftAbandoned"]>[0];
  type DuplicateEvidenceKeys = Extract<
    keyof DraftAbandonedInput,
    "recipeId" | "recipeFamilyId" | "draftId" | "aggregateVersion"
  >;
  const callerCanSupplyDuplicateEvidence: DuplicateEvidenceKeys extends never
    ? false
    : true = false;
  const event = factory.draftAbandoned({ abandonment });
  const retry = factory.draftAbandoned({ abandonment });

  assert.equal(callerCanSupplyDuplicateEvidence, false);
  assert.equal(event.eventType, RECIPE_EVENT_TYPES.draftAbandoned);
  assert.equal(event.eventId, retry.eventId);
  assert.equal(event.eventId, `recipe-event:draft-abandoned:${abandonment.draftId.value}`);
  assert.equal(event.aggregateId, abandonment.recipeId.value);
  assert.equal(event.aggregateVersion, abandonment.resultingAggregateVersion);
  assert.equal(event.payload.recipeId, abandonment.recipeId.value);
  assert.equal(event.payload.recipeFamilyId, abandonment.recipeFamilyId.value);
  assert.equal(event.payload.draftId, abandonment.draftId.value);
  assert.equal(event.payload.resultingState, "Abandoned");
  assert.equal(event.payload.reason, "Duplicate draft");
  assert.equal(event.payload.previousAggregateVersion, 2);
  assert.throws(() => draft.abandon({
    actor: "owner",
    occurredAt: createdAt,
    reason: "again",
    previousAggregateVersion: 3
  }), RecipeAlreadyAbandoned);
});

test("every Recipe event declares explicit positive eventVersion 1", () => {
  const setup = publishTwoVersions();
  const draftEvent = setup.draft.events.peek()[0]!;
  const publishEvent = setup.second.events.peek()[0]!;
  const supersede = setup.service.supersede({
    recipeId: RecipeId.fromUuid(UUID.recipe),
    supersededRecipeVersionId: RecipeVersionId.fromUuid(UUID.version1),
    supersededByRecipeVersionId: RecipeVersionId.fromUuid(UUID.version2),
    expectedAggregateVersion: setup.second.aggregateVersion,
    actor: "owner",
    occurredAt: "2026-07-30T11:00:00.000Z",
    reason: "Version 2 published"
  }).events.peek()[0]!;

  assert.deepEqual(
    [draftEvent.eventVersion, publishEvent.eventVersion, supersede.eventVersion],
    [1, 1, 1]
  );
});

test("eventId uniquely identifies a fact and remains stable for producer retry", () => {
  const result = publishVersion1().published;
  const event = result.events.peek()[0]!;
  if (event.eventType !== RECIPE_EVENT_TYPES.published) {
    throw new Error("Expected RecipePublished.");
  }
  const factory = new RecipeEventFactory();
  const retryProjection = factory.published({
    snapshot: result.snapshot,
    aggregateVersion: result.aggregateVersion
  });
  const draftEventId = `recipe-event:draft-created:recipe_draft_${UUID.draft1}`;

  assert.equal(retryProjection.eventId, event.eventId);
  assert.notEqual(event.eventId, draftEventId);
  assert.notEqual(event.eventId, event.occurredAt);
});

test("RecipePublished exact numeric remains coefficient plus scale", () => {
  const event = publishVersion1().published.events.peek()[0]!;
  if (event.eventType !== RECIPE_EVENT_TYPES.published) {
    throw new Error("Expected RecipePublished.");
  }
  const quantity = event.payload.snapshot.lines[0]!.quantity;

  assert.equal(quantity.coefficient, "600");
  assert.equal(quantity.scale, 0);
  assert.equal(typeof quantity.coefficient, "string");
  assert.equal(event.payload.snapshot.standardYield.coefficient, "3");
});

test("Event Envelope and Payload are immutable", () => {
  const event = publishVersion1().published.events.peek()[0]!;

  assert.ok(Object.isFrozen(event));
  assert.ok(Object.isFrozen(event.payload));
  assert.throws(() => Object.assign(event, { actorId: "attacker" }));
  assert.throws(() => Object.assign(event.payload, { recipeId: "changed" }));
});

test("nested Published Snapshot does not leak mutable references", () => {
  const event = publishVersion1().published.events.peek()[0]!;
  if (event.eventType !== RECIPE_EVENT_TYPES.published) {
    throw new Error("Expected RecipePublished.");
  }
  const snapshot = event.payload.snapshot;

  assert.ok(Object.isFrozen(snapshot.lines));
  assert.ok(Object.isFrozen(snapshot.lines[0]));
  assert.ok(Object.isFrozen(snapshot.lines[0]!.ingredient));
  assert.ok(Object.isFrozen(snapshot.lines[0]!.quantity.unit));
  assert.throws(() =>
    Object.assign(snapshot.lines[0]!.quantity, { coefficient: "999" })
  );
});

test("Event Collection peek is idempotent and drain succeeds exactly once", () => {
  const events = publishVersion1().published.events;
  const firstPeek = events.peek();
  const secondPeek = events.peek();

  assert.equal(firstPeek, secondPeek);
  assert.equal(events.drain(), firstPeek);
  assert.equal(events.hasBeenDrained, true);
  assert.deepEqual(events.peek(), []);
  assert.throws(() => events.drain(), RecipeEventAlreadyConsumed);
});

test("one successful action produces one event and cannot be repeated", () => {
  const setup = publishVersion1();

  assert.equal(setup.published.events.peek().length, 1);
  assert.throws(
    () => setup.service.publish({
      recipeId: RecipeId.fromUuid(UUID.recipe),
      recipeVersionId: RecipeVersionId.fromUuid(UUID.version2),
      versionNumber: VersionNumber.create(2),
      expectedAggregateVersion: setup.published.aggregateVersion,
      publishedBy: "owner",
      publishedAt: "2026-07-30T10:00:00.000Z"
    }),
    InvalidPublishState
  );
  assert.equal(setup.published.events.peek().length, 1);
});

test("invalid event context fails before persistence and leaves no ghost event", () => {
  const repository = new InMemoryRecipeRepository();
  const service = new RecipePublishService(repository);

  assert.throws(
    () => service.createDraft({
      recipeId: RecipeId.fromUuid(UUID.recipe),
      draftId: RecipeDraftId.fromUuid(UUID.draft1),
      name: "Dongpo Pork",
      createdBy: "owner",
      createdAt,
      eventContext: { correlationId: " " }
    }),
    InvalidRecipeEvent
  );
  assert.equal(repository.findById(RecipeId.fromUuid(UUID.recipe)), undefined);
});

test("Recipe event contract contains no transport or broker metadata", () => {
  const event = publishVersion1().published.events.peek()[0]!;
  const forbidden = [
    "topic",
    "queue",
    "retryCount",
    "deliveryStatus",
    "broker",
    "partition",
    "offset"
  ];

  for (const key of forbidden) {
    assert.equal(key in event, false);
    assert.equal(key in event.payload, false);
  }
});
