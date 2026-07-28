import type { PublishedRecipeSnapshot } from "../domain/published-recipe-snapshot.js";

export const RECIPE_EVENT_TYPES = Object.freeze({
  draftCreated: "recipe.draft-created",
  published: "recipe.published",
  superseded: "recipe.superseded"
} as const);

/**
 * Stable eventType strings never depend on TypeScript class names. A breaking
 * payload change requires a higher positive eventVersion; compatible optional
 * fields may be added without changing an existing v1 consumer requirement.
 */
export const RECIPE_EVENT_VERSION = 1 as const;

export type RecipeEventType =
  typeof RECIPE_EVENT_TYPES[keyof typeof RECIPE_EVENT_TYPES];

/**
 * eventId is the idempotency identity for future consumers. It is derived from
 * the immutable fact identity, never from occurredAt or a payload hash. A
 * producer retry for the same logical fact therefore retains the same eventId.
 */
export type RecipeDomainEventEnvelope<
  TType extends RecipeEventType,
  TPayload
> = Readonly<{
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
}>;

export type RecipeDraftCreatedPayload = Readonly<{
  recipeId: string;
  draftId: string;
  sourceVersionId: string | null;
  createdAt: string;
  createdBy: string;
}>;

export type RecipePublishedPayload = Readonly<{
  recipeId: string;
  draftId: string;
  versionId: string;
  versionNumber: number;
  product: Readonly<{
    productId: string;
    productVersionId: string;
  }>;
  snapshot: PublishedRecipeSnapshot;
  publishedAt: string;
  publishedBy: string;
}>;

export type RecipeSupersededPayload = Readonly<{
  recipeId: string;
  supersededVersionId: string;
  supersedingVersionId: string;
  supersededAt: string;
  supersededBy: string;
  reason: string;
}>;

export type RecipeDraftCreatedV1 = RecipeDomainEventEnvelope<
  typeof RECIPE_EVENT_TYPES.draftCreated,
  RecipeDraftCreatedPayload
>;

export type RecipePublishedV1 = RecipeDomainEventEnvelope<
  typeof RECIPE_EVENT_TYPES.published,
  RecipePublishedPayload
>;

export type RecipeSupersededV1 = RecipeDomainEventEnvelope<
  typeof RECIPE_EVENT_TYPES.superseded,
  RecipeSupersededPayload
>;

export type RecipeDomainEvent =
  | RecipeDraftCreatedV1
  | RecipePublishedV1
  | RecipeSupersededV1;

export type RecipeEventContext = Readonly<{
  correlationId?: string;
  causationId?: string;
}>;
