import type { IngredientReferenceId } from "./identities.js";

export type RecipeDraftIngredientReferenceV1 = Readonly<{
  recipeId: string;
  draftId: string;
  recipeLineId: string;
}>;

export type RecipePublishedIngredientReferenceV1 = Readonly<{
  recipeId: string;
  recipeVersionId: string;
  recipeLineId: string;
}>;

export type RecipeIngredientReferenceImpactReadModelV1 = Readonly<{
  contractName: "RecipeIngredientReferenceImpact";
  contractVersion: 1;
  draftReferences: readonly RecipeDraftIngredientReferenceV1[];
  publishedReferences: readonly RecipePublishedIngredientReferenceV1[];
}>;

export interface RecipeIngredientReferenceImpactReadPort {
  findIngredientReferences(
    ingredientId: IngredientReferenceId
  ): RecipeIngredientReferenceImpactReadModelV1;
}
