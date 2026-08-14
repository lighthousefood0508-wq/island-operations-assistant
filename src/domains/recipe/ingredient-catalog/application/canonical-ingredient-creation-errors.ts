type CanonicalIngredientCreationErrorCode =
  | "CANONICAL_INGREDIENT_CREATION_VALIDATION_FAILURE"
  | "CANONICAL_INGREDIENT_CREATION_PERSISTENCE_FAILURE";

abstract class CanonicalIngredientCreationError extends Error {
  abstract readonly code: CanonicalIngredientCreationErrorCode;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class CanonicalIngredientCreationValidationFailure
  extends CanonicalIngredientCreationError {
  readonly code = "CANONICAL_INGREDIENT_CREATION_VALIDATION_FAILURE" as const;

  constructor() {
    super("Canonical Ingredient creation command validation failed.");
  }
}

export class CanonicalIngredientCreationPersistenceFailure
  extends CanonicalIngredientCreationError {
  readonly code = "CANONICAL_INGREDIENT_CREATION_PERSISTENCE_FAILURE" as const;

  constructor() {
    super("Canonical Ingredient creation persistence failed.");
  }
}
