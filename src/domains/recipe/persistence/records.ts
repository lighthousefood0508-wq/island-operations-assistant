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
  currentDraftId: string;
  currentRecipeVersionId: string | null;
  aggregateVersion: number;
  state: RecipeState;
}>;

export type RecipeDraftRecord = Readonly<{
  draftId: string;
  recipeId: string;
  name: string;
  state: RecipeState;
  productId: string | null;
  productVersionId: string | null;
  standardOutput: ExactQuantityRecord | null;
  standardYield: ExactQuantityRecord | null;
  createdBy: string;
  createdAt: string;
}>;

export type RecipeVersionRecord = Readonly<{
  recipeVersionId: string;
  recipeId: string;
  sourceDraftId: string;
  versionNumber: number;
  name: string;
  productId: string;
  productVersionId: string;
  standardOutput: ExactQuantityRecord;
  standardYield: ExactQuantityRecord;
  publishedBy: string;
  publishedAt: string;
}>;

export type RecipeLineRecord = Readonly<{
  ownerType: "draft" | "version";
  ownerId: string;
  position: number;
  ingredientReferenceId: string;
  ingredientCanonicalName: string;
  ingredientMeasurementDimension: MeasurementDimension;
  ingredientStatus: IngredientReferenceStatus;
  ingredientCreatedAt: string;
  quantity: ExactQuantityRecord;
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
}>;
