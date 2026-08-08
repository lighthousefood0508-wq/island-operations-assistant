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

export class RecipeIdempotencyConflict extends RecipePersistenceError {
  readonly code = "RECIPE_IDEMPOTENCY_CONFLICT";

  constructor(operation: string, scopeId: string) {
    super(`Recipe ${operation} idempotency key is already committed with different request evidence for ${scopeId}.`);
  }
}

export class InvalidRecipeReceiptEvidence extends RecipePersistenceError {
  readonly code = "INVALID_RECIPE_RECEIPT_EVIDENCE";

  constructor(message: string) {
    super(message);
  }
}

export class RecipeLineIdentityPersistenceCollision extends RecipePersistenceError {
  readonly code = "RECIPE_LINE_IDENTITY_COLLISION";

  constructor(ownerId: string, recipeLineId: string, cause?: unknown) {
    super(
      `Recipe Line identity ${recipeLineId} is duplicated within ${ownerId}.`,
      cause === undefined ? undefined : { cause }
    );
  }
}

export class RecipePersistenceTransactionFailure extends RecipePersistenceError {
  readonly code = "RECIPE_PERSISTENCE_TRANSACTION_FAILURE";

  constructor(
    readonly phase: "operation" | "commit",
    readonly rollbackFailure: unknown | null,
    readonly adapterUnsafe: boolean,
    cause: unknown
  ) {
    super(`Recipe persistence transaction ${phase} failed.`, { cause });
  }
}
