import { CostDomainError } from "../domain/errors.js";

export abstract class CostQuoteLifecycleError extends CostDomainError {}

export class IngredientCostQuoteLifecycleNotFound extends CostQuoteLifecycleError {
  readonly code = "INGREDIENT_COST_QUOTE_LIFECYCLE_NOT_FOUND";

  constructor(quoteId: string) {
    super(`Ingredient Cost Quote ${quoteId} was not found for lifecycle processing.`);
  }
}

export class IngredientCostQuoteIdentityConflict extends CostQuoteLifecycleError {
  readonly code = "INGREDIENT_COST_QUOTE_IDENTITY_CONFLICT";

  constructor(quoteId: string) {
    super(`Ingredient Cost Quote identity ${quoteId} is already used by different facts.`);
  }
}

export class IngredientCostQuoteIngredientMismatch extends CostQuoteLifecycleError {
  readonly code = "INGREDIENT_COST_QUOTE_INGREDIENT_MISMATCH";

  constructor(oldQuoteId: string, newQuoteId: string) {
    super(
      `Ingredient Cost Quotes ${oldQuoteId} and ${newQuoteId} reference different Ingredients.`
    );
  }
}

export class IngredientCostQuoteEffectivePeriodOverlap extends CostQuoteLifecycleError {
  readonly code = "INGREDIENT_COST_QUOTE_EFFECTIVE_PERIOD_OVERLAP";
  readonly quoteIds: readonly string[];

  constructor(quoteIds: readonly string[]) {
    const uniqueQuoteIds = [...new Set(quoteIds)].sort();
    super(`Ingredient Cost Quote authority intervals overlap: ${uniqueQuoteIds.join(", ")}.`);
    this.quoteIds = Object.freeze(uniqueQuoteIds);
  }
}

export class InvalidIngredientCostQuoteReplacement extends CostQuoteLifecycleError {
  readonly code = "INVALID_INGREDIENT_COST_QUOTE_REPLACEMENT";

  constructor(message: string) {
    super(message);
  }
}

export class IngredientCostQuoteRetryConflict extends CostQuoteLifecycleError {
  readonly code = "INGREDIENT_COST_QUOTE_RETRY_CONFLICT";

  constructor(message: string) {
    super(message);
  }
}
