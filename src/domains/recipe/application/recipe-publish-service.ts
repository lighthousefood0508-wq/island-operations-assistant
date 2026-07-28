import {
  DraftCreationFailed,
  InvalidPublishState,
  InvalidSupersession,
  RecipeNotFound
} from "../domain/errors.js";
import { IngredientReference } from "../domain/ingredient-reference.js";
import {
  IngredientReferenceId,
  RecipeDraftId,
  RecipeId,
  RecipeVersionId
} from "../domain/identities.js";
import {
  RecipeSnapshotBuilder,
  type PublishedRecipeSnapshot
} from "../domain/published-recipe-snapshot.js";
import { Quantity } from "../domain/quantity.js";
import { RecipeAggregate } from "../domain/recipe-aggregate.js";
import { RecipePublishValidator } from "../domain/recipe-publish-validator.js";
import type {
  VersionedRecipeAggregate,
  VersionedRecipeRepository
} from "../domain/recipe-repository.js";
import { Unit } from "../domain/unit.js";
import { VersionNumber } from "../domain/version-number.js";
import { RecipeEventCollection } from "../events/recipe-event-collection.js";
import { RecipeEventFactory } from "../events/recipe-event-factory.js";
import type { RecipeEventContext } from "../events/recipe-domain-events.js";

export type RecipePublishResult = Readonly<{
  snapshot: PublishedRecipeSnapshot;
  aggregateVersion: number;
  events: RecipeEventCollection;
}>;

export type RecipeDraftCreationResult = Readonly<{
  draft: RecipeAggregate;
  aggregateVersion: number;
  events: RecipeEventCollection;
}>;

export type RecipeSupersessionResult = Readonly<{
  supersededSnapshot: PublishedRecipeSnapshot;
  currentPublishedSnapshot: PublishedRecipeSnapshot;
  aggregateVersion: number;
  events: RecipeEventCollection;
}>;

export class RecipePublishService {
  constructor(
    private readonly repository: VersionedRecipeRepository,
    private readonly validator = new RecipePublishValidator(),
    private readonly snapshotBuilder = new RecipeSnapshotBuilder(),
    private readonly eventFactory = new RecipeEventFactory()
  ) {}

  createDraft(input: {
    recipeId: RecipeId;
    draftId: RecipeDraftId;
    name: string;
    createdBy: string;
    createdAt: string;
    eventContext?: RecipeEventContext;
  }): RecipeDraftCreationResult {
    this.eventFactory.validateContext(input.eventContext);
    const draft = RecipeAggregate.createDraft({
      recipeId: input.recipeId,
      draftId: input.draftId,
      name: input.name,
      createdBy: input.createdBy,
      createdAt: input.createdAt
    });
    this.repository.save(draft);
    const aggregateVersion = this.requireRecipe(input.recipeId).aggregateVersion;
    const event = this.eventFactory.draftCreated({
      recipeId: input.recipeId.value,
      draftId: input.draftId.value,
      sourceVersionId: null,
      aggregateVersion,
      createdAt: input.createdAt,
      createdBy: input.createdBy,
      context: input.eventContext
    });
    return Object.freeze({
      draft,
      aggregateVersion,
      events: RecipeEventCollection.create([event])
    });
  }

  publish(input: {
    recipeId: RecipeId;
    recipeVersionId: RecipeVersionId;
    versionNumber: VersionNumber;
    expectedAggregateVersion: number;
    publishedBy: string;
    publishedAt: string;
    eventContext?: RecipeEventContext;
  }): RecipePublishResult {
    this.eventFactory.validateContext(input.eventContext);
    const stored = this.requireRecipe(input.recipeId);
    if (stored.aggregate.state !== "Draft") {
      throw new InvalidPublishState(stored.aggregate.state);
    }
    const latest = this.repository.findPublishedVersion(input.recipeId);
    if (
      latest?.aggregate.snapshot().publication &&
      !input.versionNumber.isAfter(latest.aggregate.snapshot().publication!.versionNumber)
    ) {
      throw new InvalidPublishState(
        `Version ${input.versionNumber.value} is not after the current published version`
      );
    }
    this.validator.validate(stored.aggregate, input.versionNumber);
    stored.aggregate.publish({
      recipeVersionId: input.recipeVersionId,
      versionNumber: input.versionNumber,
      publishedBy: input.publishedBy,
      publishedAt: input.publishedAt
    });
    const snapshot = this.snapshotBuilder.build(stored.aggregate);
    const aggregateVersion = this.repository.saveWithExpectedVersion(
      stored.aggregate,
      input.expectedAggregateVersion
    );
    const event = this.eventFactory.published({
      snapshot,
      aggregateVersion,
      context: input.eventContext
    });
    return Object.freeze({
      snapshot,
      aggregateVersion,
      events: RecipeEventCollection.create([event])
    });
  }

  createDraftFromPublished(input: {
    recipeId: RecipeId;
    sourceRecipeVersionId: RecipeVersionId;
    newDraftId: RecipeDraftId;
    expectedAggregateVersion: number;
    createdBy: string;
    createdAt: string;
    eventContext?: RecipeEventContext;
  }): RecipeDraftCreationResult {
    this.eventFactory.validateContext(input.eventContext);
    const source = this.repository.findPublishedVersion(
      input.recipeId,
      input.sourceRecipeVersionId
    );
    if (!source) {
      throw new DraftCreationFailed(
        `Published Recipe Version ${input.sourceRecipeVersionId.value} was not found.`
      );
    }
    const sourceState = source.aggregate.snapshot();
    if (!sourceState.publication || !sourceState.product || !sourceState.standardOutput || !sourceState.standardYield) {
      throw new DraftCreationFailed("Source Published Recipe is incomplete.");
    }
    if (sourceState.draftId.equals(input.newDraftId)) {
      throw new DraftCreationFailed("A new Draft must use a new Draft identity.");
    }

    const draft = RecipeAggregate.createDraft({
      recipeId: sourceState.recipeId,
      draftId: input.newDraftId,
      name: sourceState.name,
      createdBy: input.createdBy,
      createdAt: input.createdAt
    });
    draft.bindProduct(sourceState.product.productId, sourceState.product.productVersionId);
    for (const line of sourceState.lines) {
      draft.addIngredient(
        IngredientReference.create({
          ingredientReferenceId: IngredientReferenceId.parse(
            line.ingredient.ingredientReferenceId.value
          ),
          canonicalName: line.ingredient.canonicalName,
          measurementDimension: line.ingredient.measurementDimension,
          status: line.ingredient.status,
          createdAt: line.ingredient.createdAt
        }),
        Quantity.create(
          line.quantity.coefficient,
          line.quantity.scale,
          Unit.create(line.quantity.unit.code, line.quantity.unit.dimension)
        )
      );
    }
    draft.defineStandardOutput(
      Quantity.create(
        sourceState.standardOutput.coefficient,
        sourceState.standardOutput.scale,
        Unit.create(
          sourceState.standardOutput.unit.code,
          sourceState.standardOutput.unit.dimension
        )
      ),
      Quantity.create(
        sourceState.standardYield.coefficient,
        sourceState.standardYield.scale,
        Unit.create(
          sourceState.standardYield.unit.code,
          sourceState.standardYield.unit.dimension
        )
      )
    );
    const aggregateVersion = this.repository.saveWithExpectedVersion(
      draft,
      input.expectedAggregateVersion
    );
    const event = this.eventFactory.draftCreated({
      recipeId: input.recipeId.value,
      draftId: input.newDraftId.value,
      sourceVersionId: input.sourceRecipeVersionId.value,
      aggregateVersion,
      createdAt: input.createdAt,
      createdBy: input.createdBy,
      context: input.eventContext
    });
    return Object.freeze({
      draft,
      aggregateVersion,
      events: RecipeEventCollection.create([event])
    });
  }

  supersede(input: {
    recipeId: RecipeId;
    supersededRecipeVersionId: RecipeVersionId;
    supersededByRecipeVersionId: RecipeVersionId;
    expectedAggregateVersion: number;
    actor: string;
    occurredAt: string;
    reason: string;
    eventContext?: RecipeEventContext;
  }): RecipeSupersessionResult {
    this.eventFactory.validateContext(input.eventContext);
    if (input.supersededRecipeVersionId.equals(input.supersededByRecipeVersionId)) {
      throw new InvalidSupersession("A Recipe Version cannot supersede itself.");
    }
    const previous = this.repository.findPublishedVersion(
      input.recipeId,
      input.supersededRecipeVersionId
    );
    const current = this.repository.findPublishedVersion(
      input.recipeId,
      input.supersededByRecipeVersionId
    );
    if (!previous || !current) {
      throw new InvalidSupersession("Both old and new Published Recipe Versions must exist.");
    }
    const previousState = previous.aggregate.snapshot();
    const currentState = current.aggregate.snapshot();
    if (previousState.state !== "Published" || currentState.state !== "Published") {
      throw new InvalidSupersession("Only a Published Version may be superseded by another Published Version.");
    }
    if (
      !previousState.publication ||
      !currentState.publication ||
      !currentState.publication.versionNumber.isAfter(previousState.publication.versionNumber)
    ) {
      throw new InvalidSupersession("Superseding Recipe Version number must increase.");
    }
    previous.aggregate.supersede({
      supersededByRecipeVersionId: input.supersededByRecipeVersionId,
      supersededBy: input.actor,
      supersededAt: input.occurredAt,
      reason: input.reason
    });
    const supersededSnapshot = this.snapshotBuilder.build(previous.aggregate);
    const currentPublishedSnapshot = this.snapshotBuilder.build(current.aggregate);
    const aggregateVersion = this.repository.saveWithExpectedVersion(
      previous.aggregate,
      input.expectedAggregateVersion
    );
    const event = this.eventFactory.superseded({
      recipeId: input.recipeId.value,
      supersededVersionId: input.supersededRecipeVersionId.value,
      supersedingVersionId: input.supersededByRecipeVersionId.value,
      aggregateVersion,
      supersededAt: input.occurredAt,
      supersededBy: input.actor,
      reason: input.reason,
      context: input.eventContext
    });
    return Object.freeze({
      supersededSnapshot,
      currentPublishedSnapshot,
      aggregateVersion,
      events: RecipeEventCollection.create([event])
    });
  }

  private requireRecipe(recipeId: RecipeId): VersionedRecipeAggregate {
    const stored = this.repository.findWithVersion(recipeId);
    if (!stored) {
      throw new RecipeNotFound(recipeId.value);
    }
    return stored;
  }
}
