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

export class RecipeProductBindingConflict extends RecipeDomainError {
  readonly code = "RECIPE_PRODUCT_BINDING_CONFLICT";

  constructor(boundProductId: string, requestedProductId: string) {
    super(`Recipe Family is bound to Product ${boundProductId}, not ${requestedProductId}.`);
  }
}

/** @deprecated Pre-001A compatibility error for the legacy addIngredient API. */
export class DuplicateIngredient extends RecipeDomainError {
  readonly code = "DUPLICATE_INGREDIENT";

  constructor(ingredientReferenceId: string) {
    super(`Ingredient ${ingredientReferenceId} already exists in this legacy Recipe Draft path.`);
  }
}

export class RecipeLineNotFound extends RecipeDomainError {
  readonly code = "RECIPE_LINE_NOT_FOUND";

  constructor(recipeLineId: string) {
    super(`Recipe Line ${recipeLineId} was not found.`);
  }
}

export class RecipeLineIdentityCollision extends RecipeDomainError {
  readonly code = "RECIPE_LINE_IDENTITY_COLLISION";

  constructor(recipeLineId: string) {
    super(`Recipe Line identity ${recipeLineId} already exists in this Draft.`);
  }
}

export class InvalidRecipeLineOrder extends RecipeDomainError {
  readonly code = "RECIPE_LINE_ORDER_INVALID";

  constructor(message: string) {
    super(message);
  }
}

export class InvalidRecipeLine extends RecipeDomainError {
  readonly code = "RECIPE_LINE_INVALID";

  constructor(message: string) {
    super(message);
  }
}

export class RecipeAlreadyAbandoned extends RecipeDomainError {
  readonly code = "RECIPE_ALREADY_ABANDONED";

  constructor(draftId: string) {
    super(`Recipe Draft ${draftId} is already abandoned.`);
  }
}

export class RecipeDraftAbandoned extends RecipeDomainError {
  readonly code = "RECIPE_DRAFT_ABANDONED";

  constructor(draftId: string) {
    super(`Recipe Draft ${draftId} is abandoned and cannot be changed or published.`);
  }
}

export class RecipeInvalidTransition extends RecipeDomainError {
  readonly code = "RECIPE_INVALID_TRANSITION";

  constructor(from: string, to: string) {
    super(`Recipe cannot transition from ${from} to ${to}.`);
  }
}

export class InvalidVersionTransition extends RecipeDomainError {
  readonly code = "INVALID_VERSION_TRANSITION";

  constructor(from: string, to: string) {
    super(`Recipe Version cannot transition from ${from} to ${to}.`);
  }
}

export class PublishValidationFailed extends RecipeDomainError {
  readonly code = "PUBLISH_VALIDATION_FAILED";
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Recipe publication validation failed: ${issues.join("; ")}`);
    this.issues = Object.freeze([...issues]);
  }
}

export class SnapshotImmutableViolation extends RecipeDomainError {
  readonly code = "SNAPSHOT_IMMUTABLE_VIOLATION";

  constructor() {
    super("Published Recipe Snapshot must be deeply immutable.");
  }
}

export class InvalidPublishState extends RecipeDomainError {
  readonly code = "INVALID_PUBLISH_STATE";

  constructor(state: string) {
    super(`Recipe in ${state} state cannot be published.`);
  }
}

export class InvalidSupersession extends RecipeDomainError {
  readonly code = "INVALID_SUPERSESSION";

  constructor(message: string) {
    super(message);
  }
}

export class DraftCreationFailed extends RecipeDomainError {
  readonly code = "DRAFT_CREATION_FAILED";

  constructor(message: string) {
    super(message);
  }
}
