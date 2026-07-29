export abstract class CostPersistenceError extends Error {
  abstract readonly code: string;
  readonly cause: unknown;

  protected constructor(message: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.cause = cause;
  }
}

export class DuplicateIngredientCostQuote extends CostPersistenceError {
  readonly code = "DUPLICATE_INGREDIENT_COST_QUOTE";

  constructor(quoteId: string, cause?: unknown) {
    super(`Ingredient Cost Quote ${quoteId} already exists.`, cause);
  }
}

export class IngredientCostQuotePersistenceNotFound extends CostPersistenceError {
  readonly code = "INGREDIENT_COST_QUOTE_PERSISTENCE_NOT_FOUND";

  constructor(quoteId: string) {
    super(`Ingredient Cost Quote ${quoteId} does not exist in persistence.`);
  }
}

export class InvalidCostPersistenceState extends CostPersistenceError {
  readonly code = "INVALID_COST_PERSISTENCE_STATE";

  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

export class ImmutableIngredientCostQuoteViolation extends CostPersistenceError {
  readonly code = "IMMUTABLE_INGREDIENT_COST_QUOTE_VIOLATION";

  constructor(quoteId: string) {
    super(`Ingredient Cost Quote ${quoteId} attempted to overwrite immutable purchase evidence.`);
  }
}

export class CostPersistenceFailure extends CostPersistenceError {
  readonly code = "COST_PERSISTENCE_FAILURE";

  constructor(operation: string, cause: unknown) {
    super(`Cost persistence operation failed: ${operation}.`, cause);
  }
}
