/** Cost owns Purchase Evidence, Valuation, Allocation, and Cost Snapshots. It consumes approved contracts and never reads another domain's internals. */
export {
  AmbiguousEffectiveIngredientCostQuote,
  CostDomainError,
  CurrencyMismatch,
  IngredientCostQuoteAlreadySuperseded,
  IngredientCostQuoteVersionConflict,
  InvalidCostItemIdentity,
  InvalidCostQuantity,
  InvalidCostSource,
  InvalidCostUnit,
  InvalidCurrency,
  InvalidEffectivePeriod,
  InvalidExactDecimal,
  InvalidIngredientCostQuote,
  InvalidIngredientCostQuoteIdentity,
  InvalidIngredientCostQuoteSupersession,
  InvalidIngredientIdentity,
  InvalidMonetaryAmount
} from "./domain/errors.js";
export {
  CostItemId,
  IngredientCostItem,
  IngredientCostQuoteId,
  IngredientId
} from "./domain/identities.js";
export { Currency, type CurrencyCode } from "./domain/currency.js";
export { ExactDecimal } from "./domain/exact-decimal.js";
export { MonetaryAmount } from "./domain/monetary-amount.js";
export {
  COST_SOURCE_TYPES,
  CostSource,
  type CostSourceInput,
  type CostSourceType
} from "./domain/cost-source.js";
export { CostUnit } from "./domain/cost-unit.js";
export { EffectivePeriod } from "./domain/effective-period.js";
export {
  IngredientCostQuote,
  type IngredientCostQuoteState,
  type IngredientCostQuoteSupersession,
  type RecordIngredientCostQuoteInput,
  type SupersedeIngredientCostQuoteInput
} from "./domain/ingredient-cost-quote.js";
export {
  selectEffectiveIngredientCostQuote,
  type CostRepository,
  type EffectiveIngredientCostQuoteLookup
} from "./domain/cost-repository.js";
