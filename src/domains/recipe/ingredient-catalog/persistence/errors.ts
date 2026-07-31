export abstract class CanonicalIngredientPersistenceError extends Error {
  abstract readonly code: string;
  readonly cause: unknown;

  protected constructor(message: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.cause = cause;
  }
}

export class DuplicateCanonicalIngredient
  extends CanonicalIngredientPersistenceError {
  readonly code = "DUPLICATE_CANONICAL_INGREDIENT";

  constructor(ingredientId: string, cause?: unknown) {
    super(`Canonical Ingredient ${ingredientId} already exists.`, cause);
  }
}

export class CanonicalIngredientPersistenceNotFound
  extends CanonicalIngredientPersistenceError {
  readonly code = "CANONICAL_INGREDIENT_PERSISTENCE_NOT_FOUND";

  constructor(ingredientId: string) {
    super(`Canonical Ingredient ${ingredientId} does not exist in persistence.`);
  }
}

export class InvalidCanonicalIngredientPersistenceState
  extends CanonicalIngredientPersistenceError {
  readonly code = "INVALID_CANONICAL_INGREDIENT_PERSISTENCE_STATE";

  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

export class CanonicalIngredientPersistenceFailure
  extends CanonicalIngredientPersistenceError {
  readonly code = "CANONICAL_INGREDIENT_PERSISTENCE_FAILURE";

  constructor(operation: string, cause: unknown) {
    super(`Canonical Ingredient persistence operation failed: ${operation}.`, cause);
  }
}
