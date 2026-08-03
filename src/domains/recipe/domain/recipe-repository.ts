import type { RecipeAggregate } from "./recipe-aggregate.js";
import type { RecipeDraftId, RecipeId, RecipeVersionId } from "./identities.js";
import type { RecipeState } from "./types.js";

export interface RecipeRepository {
  findById(recipeId: RecipeId): RecipeAggregate | undefined;
  save(recipe: RecipeAggregate): void;
}

export type VersionedRecipeAggregate = Readonly<{
  aggregate: RecipeAggregate;
  aggregateVersion: number;
}>;

export type RecipeBackOfficeListItem = Readonly<{
  recipeId: string;
  currentDraftId: string;
  currentRecipeVersionId: string | null;
  aggregateVersion: number;
  state: RecipeState;
  name: string;
  versionNumber: number | null;
}>;

export interface VersionedRecipeRepository extends RecipeRepository {
  findWithVersion(recipeId: RecipeId): VersionedRecipeAggregate | undefined;
  findByDraftId(draftId: RecipeDraftId): VersionedRecipeAggregate | undefined;
  findPublishedVersion(recipeId: RecipeId, recipeVersionId?: RecipeVersionId): VersionedRecipeAggregate | undefined;
  saveWithExpectedVersion(recipe: RecipeAggregate, expectedAggregateVersion: number): number;
}

export interface RecipeBackOfficeRepository extends VersionedRecipeRepository {
  listRecipes(): readonly RecipeBackOfficeListItem[];
}
