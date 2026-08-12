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
export type { CostQuoteUnitOfWork } from "./domain/cost-unit-of-work.js";
export {
  CostQuoteLifecycleError,
  IngredientCostQuoteEffectivePeriodOverlap,
  IngredientCostQuoteIdentityConflict,
  IngredientCostQuoteIngredientMismatch,
  IngredientCostQuoteLifecycleNotFound,
  IngredientCostQuoteRetryConflict,
  InvalidIngredientCostQuoteReplacement
} from "./application/errors.js";
export {
  CostQuoteLifecycleService,
  type RecordInitialIngredientCostQuoteCommand,
  type RecordInitialIngredientCostQuoteResult,
  type ReplaceEffectiveIngredientCostQuoteCommand,
  type ReplaceEffectiveIngredientCostQuoteResult
} from "./application/cost-quote-lifecycle-service.js";
export {
  CostPersistenceError,
  CostPersistenceFailure,
  DuplicateIngredientCostQuote,
  ImmutableIngredientCostQuoteViolation,
  IngredientCostQuotePersistenceNotFound,
  InvalidCostPersistenceState
} from "./persistence/errors.js";
export {
  CostPersistenceMapper,
  type SupersedingQuoteResolver
} from "./persistence/cost-persistence-mapper.js";
export type {
  IngredientCostQuoteRecord,
  IngredientCostQuoteRow
} from "./persistence/records.js";
export { SqliteCostRepository } from "./infrastructure/sqlite-cost-repository.js";
export { SqliteCostQuoteUnitOfWork } from "./infrastructure/sqlite-cost-unit-of-work.js";
export {
  INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_NAME,
  INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_VERSION,
  type IngredientCostQuoteNormalizationEvidenceV1,
  type IngredientCostQuoteNormalizationFailureCodeV1,
  type IngredientCostQuoteNormalizationFailureV1,
  type IngredientCostQuoteNormalizationResultV1
} from "./contracts/ingredient-cost-quote-normalization-evidence-contract.js";
export {
  ExactRational,
  ExactRationalError
} from "./domain/exact-rational.js";
export type {
  CostEvaluationEffectiveQuoteLookup,
  CostEvaluationQuoteReader,
  CostEvaluationReadUnitOfWork
} from "./domain/cost-evaluation-read-unit-of-work.js";
export {
  COST_ROUNDING_POLICY,
  COST_VALUATION_POLICY,
  RECIPE_COST_EVALUATION_BASIS,
  RECIPE_COST_EVALUATION_RESULT_CONTRACT_NAME,
  RECIPE_COST_EVALUATION_RESULT_CONTRACT_VERSION,
  type EvaluateRecipeCostCommand,
  type ExactRationalV1,
  type IngredientCostQuoteNormalizationPort,
  type RecipeCostEvaluationFailureCodeV1,
  type RecipeCostEvaluationFailureV1,
  type RecipeCostEvaluationLineV1,
  type RecipeCostEvaluationOutcomeV1,
  type RecipeCostEvaluationResultV1
} from "./domain/recipe-cost-evaluation.js";
export { RecipeCostEvaluationError } from "./application/recipe-cost-evaluation-errors.js";
export type {
  CostIngredientQuoteReferenceImpactReadModelV1,
  CostIngredientReferenceImpactReadPort
} from "./domain/ingredient-reference-impact-read-port.js";
