export abstract class RecipePersistenceError extends Error {
  abstract readonly code: string;

  protected constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class RecipeRecordNotFound extends RecipePersistenceError {
  readonly code = "RECIPE_RECORD_NOT_FOUND";

  constructor(identity: string) {
    super(`Recipe persistence record ${identity} was not found.`);
  }
}

export class RecipeConcurrencyConflict extends RecipePersistenceError {
  readonly code = "RECIPE_CONCURRENCY_CONFLICT";

  constructor(recipeId: string, expected: number, actual: number) {
    super(`Recipe ${recipeId} expected aggregate version ${expected}, but current version is ${actual}.`);
  }
}

export class InvalidRecipePersistenceState extends RecipePersistenceError {
  readonly code = "INVALID_RECIPE_PERSISTENCE_STATE";

  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
  }
}
