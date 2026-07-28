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
