import type { PublishedRecipeSnapshot } from "../domain/published-recipe-snapshot.js";
import { InvalidRecipeEvent } from "./errors.js";
import {
  RECIPE_EVENT_TYPES,
  RECIPE_EVENT_VERSION,
  type RecipeDraftCreatedPayload,
  type RecipeDraftCreatedV1,
  type RecipeEventContext,
  type RecipePublishedPayload,
  type RecipePublishedV1,
  type RecipeSupersededPayload,
  type RecipeSupersededV1
} from "./recipe-domain-events.js";

function optionalIdentity(value: string | undefined, label: string): string | null {
  if (value === undefined) return null;
  if (!value.trim()) {
    throw new InvalidRecipeEvent(`${label} cannot be empty when supplied.`);
  }
  return value;
}

function assertFactMetadata(
  aggregateId: string,
  aggregateVersion: number,
  occurredAt: string,
  actorId: string
): void {
  if (
    !aggregateId.trim() ||
    !Number.isSafeInteger(aggregateVersion) ||
    aggregateVersion < 1 ||
    !occurredAt.trim() ||
    !actorId.trim()
  ) {
    throw new InvalidRecipeEvent(
      "Recipe event requires aggregate identity/version, occurredAt, and actorId."
    );
  }
}

function envelope<TType extends RecipeDraftCreatedV1["eventType"] | RecipePublishedV1["eventType"] | RecipeSupersededV1["eventType"], TPayload>(
  input: {
    eventId: string;
    eventType: TType;
    aggregateId: string;
    aggregateVersion: number;
    occurredAt: string;
    actorId: string;
    context?: RecipeEventContext;
    payload: Readonly<TPayload>;
  }
): Readonly<{
  eventId: string;
  eventType: TType;
  eventVersion: typeof RECIPE_EVENT_VERSION;
  aggregateId: string;
  aggregateVersion: number;
  occurredAt: string;
  actorId: string;
  correlationId: string | null;
  causationId: string | null;
  payload: Readonly<TPayload>;
}> {
  assertFactMetadata(
    input.aggregateId,
    input.aggregateVersion,
    input.occurredAt,
    input.actorId
  );
  if (!input.eventId.trim()) {
    throw new InvalidRecipeEvent("Recipe eventId is required.");
  }
  return Object.freeze({
    eventId: input.eventId,
    eventType: input.eventType,
    eventVersion: RECIPE_EVENT_VERSION,
    aggregateId: input.aggregateId,
    aggregateVersion: input.aggregateVersion,
    occurredAt: input.occurredAt,
    actorId: input.actorId,
    correlationId: optionalIdentity(input.context?.correlationId, "correlationId"),
    causationId: optionalIdentity(input.context?.causationId, "causationId"),
    payload: input.payload
  });
}

export class RecipeEventFactory {
  validateContext(context?: RecipeEventContext): void {
    optionalIdentity(context?.correlationId, "correlationId");
    optionalIdentity(context?.causationId, "causationId");
  }

  draftCreated(input: {
    recipeId: string;
    draftId: string;
    sourceVersionId: string | null;
    aggregateVersion: number;
    createdAt: string;
    createdBy: string;
    context?: RecipeEventContext;
  }): RecipeDraftCreatedV1 {
    const payload: RecipeDraftCreatedPayload = Object.freeze({
      recipeId: input.recipeId,
      draftId: input.draftId,
      sourceVersionId: input.sourceVersionId,
      createdAt: input.createdAt,
      createdBy: input.createdBy
    });
    return envelope({
      eventId: `recipe-event:draft-created:${input.draftId}`,
      eventType: RECIPE_EVENT_TYPES.draftCreated,
      aggregateId: input.recipeId,
      aggregateVersion: input.aggregateVersion,
      occurredAt: input.createdAt,
      actorId: input.createdBy,
      context: input.context,
      payload
    });
  }

  published(input: {
    snapshot: PublishedRecipeSnapshot;
    aggregateVersion: number;
    context?: RecipeEventContext;
  }): RecipePublishedV1 {
    const payload: RecipePublishedPayload = Object.freeze({
      recipeId: input.snapshot.recipeId,
      draftId: input.snapshot.sourceDraftId,
      versionId: input.snapshot.recipeVersionId,
      versionNumber: input.snapshot.versionNumber,
      product: input.snapshot.product,
      snapshot: input.snapshot,
      publishedAt: input.snapshot.publishedAt,
      publishedBy: input.snapshot.publishedBy
    });
    return envelope({
      eventId: `recipe-event:published:${input.snapshot.recipeVersionId}`,
      eventType: RECIPE_EVENT_TYPES.published,
      aggregateId: input.snapshot.recipeId,
      aggregateVersion: input.aggregateVersion,
      occurredAt: input.snapshot.publishedAt,
      actorId: input.snapshot.publishedBy,
      context: input.context,
      payload
    });
  }

  superseded(input: {
    recipeId: string;
    supersededVersionId: string;
    supersedingVersionId: string;
    aggregateVersion: number;
    supersededAt: string;
    supersededBy: string;
    reason: string;
    context?: RecipeEventContext;
  }): RecipeSupersededV1 {
    const payload: RecipeSupersededPayload = Object.freeze({
      recipeId: input.recipeId,
      supersededVersionId: input.supersededVersionId,
      supersedingVersionId: input.supersedingVersionId,
      supersededAt: input.supersededAt,
      supersededBy: input.supersededBy,
      reason: input.reason
    });
    return envelope({
      eventId: `recipe-event:superseded:${input.supersededVersionId}:${input.supersedingVersionId}`,
      eventType: RECIPE_EVENT_TYPES.superseded,
      aggregateId: input.recipeId,
      aggregateVersion: input.aggregateVersion,
      occurredAt: input.supersededAt,
      actorId: input.supersededBy,
      context: input.context,
      payload
    });
  }
}
