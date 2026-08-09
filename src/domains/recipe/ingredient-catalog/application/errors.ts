type CanonicalIngredientLifecycleErrorCode =
  | "CANONICAL_INGREDIENT_NOT_FOUND"
  | "CANONICAL_INGREDIENT_VERSION_CONFLICT"
  | "CANONICAL_INGREDIENT_ALREADY_ARCHIVED"
  | "CANONICAL_INGREDIENT_ARCHIVED_RENAME_REJECTED"
  | "INVALID_CANONICAL_INGREDIENT_TRANSITION"
  | "CANONICAL_INGREDIENT_VALIDATION_FAILURE"
  | "CANONICAL_INGREDIENT_PERSISTENCE_FAILURE";

abstract class CanonicalIngredientLifecycleError extends Error {
  abstract readonly code: CanonicalIngredientLifecycleErrorCode;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class CanonicalIngredientLifecycleNotFound
  extends CanonicalIngredientLifecycleError {
  readonly code = "CANONICAL_INGREDIENT_NOT_FOUND" as const;

  constructor() {
    super("Canonical Ingredient was not found.");
  }
}

export class CanonicalIngredientLifecycleVersionConflict
  extends CanonicalIngredientLifecycleError {
  readonly code = "CANONICAL_INGREDIENT_VERSION_CONFLICT" as const;

  constructor() {
    super("Canonical Ingredient version conflict.");
  }
}

export class CanonicalIngredientAlreadyArchived
  extends CanonicalIngredientLifecycleError {
  readonly code = "CANONICAL_INGREDIENT_ALREADY_ARCHIVED" as const;

  constructor() {
    super("Canonical Ingredient is already Archived.");
  }
}

export class CanonicalIngredientArchivedRenameRejected
  extends CanonicalIngredientLifecycleError {
  readonly code = "CANONICAL_INGREDIENT_ARCHIVED_RENAME_REJECTED" as const;

  constructor() {
    super("Archived Canonical Ingredient cannot be renamed.");
  }
}

export class InvalidCanonicalIngredientLifecycleTransition
  extends CanonicalIngredientLifecycleError {
  readonly code = "INVALID_CANONICAL_INGREDIENT_TRANSITION" as const;

  constructor() {
    super("Canonical Ingredient lifecycle transition is invalid.");
  }
}

export class CanonicalIngredientLifecycleValidationFailure
  extends CanonicalIngredientLifecycleError {
  readonly code = "CANONICAL_INGREDIENT_VALIDATION_FAILURE" as const;

  constructor() {
    super("Canonical Ingredient lifecycle command validation failed.");
  }
}

export class CanonicalIngredientLifecyclePersistenceFailure
  extends CanonicalIngredientLifecycleError {
  readonly code = "CANONICAL_INGREDIENT_PERSISTENCE_FAILURE" as const;

  constructor() {
    super("Canonical Ingredient lifecycle persistence failed.");
  }
}
