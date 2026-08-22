export abstract class CostDomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidCostItemIdentity extends CostDomainError {
  readonly code = "INVALID_COST_ITEM_IDENTITY";

  constructor() {
    super("Cost Item identity must use cost_item_<uuid> format.");
  }
}

export class InvalidIngredientIdentity extends CostDomainError {
  readonly code = "INVALID_INGREDIENT_IDENTITY";

  constructor() {
    super("Ingredient identity reference must use ing_<uuid> format.");
  }
}

export class InvalidIngredientCostQuoteIdentity extends CostDomainError {
  readonly code = "INVALID_INGREDIENT_COST_QUOTE_IDENTITY";

  constructor() {
    super("Ingredient Cost Quote identity must use cost_quote_<uuid> format.");
  }
}

export class InvalidSupplierIdentity extends CostDomainError {
  readonly code = "INVALID_SUPPLIER_IDENTITY";

  constructor() {
    super("Supplier identity must use sup_<uuid> format.");
  }
}

export class InvalidCostSupplier extends CostDomainError {
  readonly code = "INVALID_COST_SUPPLIER";

  constructor(message: string) {
    super(message);
  }
}

export class InvalidCurrency extends CostDomainError {
  readonly code = "INVALID_CURRENCY";

  constructor(code: string) {
    super(`Currency ${code} is not supported.`);
  }
}

export class InvalidExactDecimal extends CostDomainError {
  readonly code = "INVALID_EXACT_DECIMAL";

  constructor(message: string) {
    super(message);
  }
}

export class InvalidMonetaryAmount extends CostDomainError {
  readonly code = "INVALID_MONETARY_AMOUNT";

  constructor(message: string) {
    super(message);
  }
}

export class CurrencyMismatch extends CostDomainError {
  readonly code = "CURRENCY_MISMATCH";

  constructor(left: string, right: string) {
    super(`Money in ${left} cannot be compared with money in ${right}.`);
  }
}

export class InvalidCostQuantity extends CostDomainError {
  readonly code = "INVALID_COST_QUANTITY";

  constructor() {
    super("Purchase quantity must be greater than zero.");
  }
}

export class InvalidCostUnit extends CostDomainError {
  readonly code = "INVALID_COST_UNIT";

  constructor() {
    super("Cost unit must be a canonical lowercase identifier.");
  }
}

export class InvalidCostSource extends CostDomainError {
  readonly code = "INVALID_COST_SOURCE";

  constructor(message: string) {
    super(message);
  }
}

export class InvalidEffectivePeriod extends CostDomainError {
  readonly code = "INVALID_EFFECTIVE_PERIOD";

  constructor(message: string) {
    super(message);
  }
}

export class InvalidIngredientCostQuote extends CostDomainError {
  readonly code = "INVALID_INGREDIENT_COST_QUOTE";

  constructor(message: string) {
    super(message);
  }
}

export class IngredientCostQuoteVersionConflict extends CostDomainError {
  readonly code = "INGREDIENT_COST_QUOTE_VERSION_CONFLICT";

  constructor(expected: number, actual: number) {
    super(`Expected Ingredient Cost Quote version ${expected}, but found ${actual}.`);
  }
}

export class AmbiguousEffectiveIngredientCostQuote extends CostDomainError {
  readonly code = "AMBIGUOUS_EFFECTIVE_INGREDIENT_COST_QUOTE";
  readonly quoteIds: readonly string[];

  constructor(quoteIds: readonly string[]) {
    super(`Multiple Ingredient Cost Quotes are authoritative: ${quoteIds.join(", ")}.`);
    this.quoteIds = Object.freeze([...quoteIds]);
  }
}

export class IngredientCostQuoteAlreadySuperseded extends CostDomainError {
  readonly code = "INGREDIENT_COST_QUOTE_ALREADY_SUPERSEDED";

  constructor(quoteId: string) {
    super(`Ingredient Cost Quote ${quoteId} has already been superseded.`);
  }
}

export class InvalidIngredientCostQuoteSupersession extends CostDomainError {
  readonly code = "INVALID_INGREDIENT_COST_QUOTE_SUPERSESSION";

  constructor(message: string) {
    super(message);
  }
}
