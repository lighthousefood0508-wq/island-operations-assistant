import type { IngredientReferenceStatus } from "../domain/ingredient-reference.js";
import type { RecipeState } from "../domain/types.js";
import type { MeasurementDimension } from "../domain/unit.js";

export type ExactQuantityRecord = Readonly<{
  coefficient: string;
  scale: number;
  unitCode: string;
  measurementDimension: MeasurementDimension;
}>;

export type RecipeRecord = Readonly<{
  recipeId: string;
  recipeFamilyId: string;
  productId: string | null;
  currentDraftId: string;
  currentRecipeVersionId: string | null;
  aggregateVersion: number;
  state: RecipeState;
}>;

export type RecipeDraftRecord = Readonly<{
  draftId: string;
  recipeId: string;
  recipeFamilyId: string;
  name: string;
  state: RecipeState;
  productId: string | null;
  productVersionId: string | null;
  instructions: string | null;
  standardOutput: ExactQuantityRecord | null;
  standardYield: ExactQuantityRecord | null;
  createdBy: string;
  createdAt: string;
}>;

export type RecipeVersionRecord = Readonly<{
  recipeVersionId: string;
  recipeId: string;
  recipeFamilyId: string;
  sourceDraftId: string;
  versionNumber: number;
  state: "Published" | "Superseded";
  name: string;
  productId: string;
  productVersionId: string;
  instructions: string | null;
  standardOutput: ExactQuantityRecord;
  standardYield: ExactQuantityRecord;
  publishedBy: string;
  publishedAt: string;
}>;

export type RecipeLineRecord = Readonly<{
  ownerType: "draft" | "version";
  ownerId: string;
  position: number;
  recipeLineId: string;
  ingredientReferenceId: string;
  ingredientCanonicalName: string;
  ingredientMeasurementDimension: MeasurementDimension;
  ingredientStatus: IngredientReferenceStatus;
  ingredientCreatedAt: string;
  quantity: ExactQuantityRecord;
  preparationNote: string | null;
}>;

export type RecipeAbandonmentAuditRecord = Readonly<{
  eventKey: string;
  recipeFamilyId: string;
  recipeId: string;
  draftId: string;
  actor: string;
  occurredAt: string;
  reason: string;
  previousAggregateVersion: number;
  resultingAggregateVersion: number;
}>;

export type RecipePublishAuditRecord = Readonly<{
  eventKey: string;
  recipeId: string;
  draftId: string;
  recipeVersionId: string;
  versionNumber: number;
  actor: string;
  occurredAt: string;
}>;

export type RecipeSupersessionAuditRecord = Readonly<{
  eventKey: string;
  recipeId: string;
  supersededRecipeVersionId: string;
  supersededByRecipeVersionId: string;
  actor: string;
  occurredAt: string;
  reason: string;
}>;

export type RecipePersistenceRecords = Readonly<{
  recipe: RecipeRecord;
  draft: RecipeDraftRecord;
  draftLines: readonly RecipeLineRecord[];
  version: RecipeVersionRecord | null;
  versionLines: readonly RecipeLineRecord[];
  publishAudit: RecipePublishAuditRecord | null;
  supersessionAudits: readonly RecipeSupersessionAuditRecord[];
  abandonmentAudit: RecipeAbandonmentAuditRecord | null;
}>;
