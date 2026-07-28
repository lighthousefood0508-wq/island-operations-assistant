export abstract class RecipeDomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class RecipeNotFound extends RecipeDomainError {
  readonly code = "RECIPE_NOT_FOUND";

  constructor(recipeId: string) {
    super(`Recipe ${recipeId} was not found.`);
  }
}

export class InvalidRecipeState extends RecipeDomainError {
  readonly code = "INVALID_RECIPE_STATE";

  constructor(message: string) {
    super(message);
  }
}

export class DuplicateIngredient extends RecipeDomainError {
  readonly code = "DUPLICATE_INGREDIENT";

  constructor(ingredientReferenceId: string) {
    super(`Ingredient ${ingredientReferenceId} already exists in this Recipe Draft.`);
  }
}

export class InvalidVersionTransition extends RecipeDomainError {
  readonly code = "INVALID_VERSION_TRANSITION";

  constructor(from: string, to: string) {
    super(`Recipe Version cannot transition from ${from} to ${to}.`);
  }
}
