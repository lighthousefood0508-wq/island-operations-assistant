import type { RecipeAggregate } from "./recipe-aggregate.js";
import type { RecipeId } from "./identities.js";

export interface RecipeRepository {
  findById(recipeId: RecipeId): RecipeAggregate | undefined;
  save(recipe: RecipeAggregate): void;
}
