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
  InvalidCostSupplier,
  InvalidCostPurchase,
  InvalidPurchaseIdentity,
  InvalidPurchaseLineIdentity,
  InvalidAcceptedPurchaseIdentity,
  InvalidAcceptedPurchaseLineIdentity,
  InvalidAcceptedPurchase,
  AcceptedPurchaseAlreadyExists,
  CostPurchaseVersionConflict,
  CostPurchaseInvalidState,
  InvalidSupplierIdentity,
  InvalidMonetaryAmount
} from "./domain/errors.js";
export {
  CostItemId,
  IngredientCostItem,
  IngredientCostQuoteId,
  IngredientId,
  SupplierId
} from "./domain/identities.js";
export { PurchaseId, PurchaseLineId, AcceptedPurchaseId, AcceptedPurchaseLineId, CostSnapshotId } from "./domain/identities.js";
export { AcceptedPurchase, type AcceptedPurchaseContractV1, type AcceptedPurchaseLineContractV1 } from "./domain/accepted-purchase.js";
export type { AcceptedPurchaseRepository } from "./domain/accepted-purchase-repository.js";
export { AcceptedPurchaseService, type AcceptPurchaseCommand } from "./application/accepted-purchase-service.js";
export { AcceptedPurchaseValidationFailure, AcceptedPurchaseNotFound, AcceptedPurchaseInvalidStateFailure, AcceptedPurchaseVersionConflictFailure, AcceptedPurchaseMeasurementFailure, AcceptedPurchasePersistenceFailure } from "./application/accepted-purchase-errors.js";
export { SqliteAcceptedPurchaseRepository } from "./infrastructure/sqlite-accepted-purchase-repository.js";
export { CostPurchase, type CostPurchaseContractV1, type CostPurchaseLineContractV1, type CostPurchaseState } from "./domain/purchase.js";
export type { CostPurchaseRepository } from "./domain/purchase-repository.js";
export { CostPurchaseService, type CreateCostPurchaseCommand, type ReviseCostPurchaseCommand, type RecordCostPurchaseCommand } from "./application/cost-purchase-service.js";
export { CostPurchaseValidationFailure, CostPurchaseNotFound, CostPurchaseInvalidStateFailure, CostPurchaseVersionConflictFailure, CostPurchasePersistenceFailure } from "./application/cost-purchase-errors.js";
export { SqliteCostPurchaseRepository } from "./infrastructure/sqlite-cost-purchase-repository.js";
export {
  CostSupplier,
  type CostSupplierContractV1,
  type CreateCostSupplierInput
} from "./domain/supplier.js";
export type { CostSupplierRepository } from "./domain/supplier-repository.js";
export {
  CostSupplierService,
  type CreateCostSupplierCommand
} from "./application/cost-supplier-service.js";
export {
  CostSupplierPersistenceFailure,
  CostSupplierValidationFailure
} from "./application/cost-supplier-errors.js";
export type {
  CostSupplierRecord,
  CostSupplierRow
} from "./persistence/supplier-records.js";
export { SqliteCostSupplierRepository } from "./infrastructure/sqlite-cost-supplier-repository.js";
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
  AcceptedPurchaseValuationEvidenceV1,
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
  type ActualPurchaseCostSourceV1,
  type EvaluateRecipeCostCommand,
  type ExactRationalV1,
  type IngredientCostQuoteNormalizationPort,
  type QuoteFallbackCostSourceV1,
  type RecipeCostEvaluationFailureCodeV1,
  type RecipeCostEvaluationFailureV1,
  type RecipeCostEvaluationLineV1,
  type RecipeCostEvaluationOutcomeV1,
  type RecipeCostEvaluationResultV1
} from "./domain/recipe-cost-evaluation.js";
export { RecipeCostEvaluationError } from "./application/recipe-cost-evaluation-errors.js";
export type {
  CostAcceptedPurchaseReferenceImpactReadModelV1,
  CostIngredientQuoteReferenceImpactReadModelV1,
  CostSnapshotReferenceImpactReadModelV1,
  CostIngredientReferenceImpactReadPort
} from "./domain/ingredient-reference-impact-read-port.js";
export { CostSnapshot, type CostSnapshotContractV1 } from "./domain/cost-snapshot.js";
export type { CostSnapshotRepository } from "./domain/cost-snapshot-repository.js";
export { SqliteCostSnapshotRepository } from "./infrastructure/sqlite-cost-snapshot-repository.js";
export { RecipeCostSnapshotService } from "./application/recipe-cost-snapshot-service.js";
export { RecipeCostSnapshotValidationFailure, RecipeCostSnapshotPersistenceFailure } from "./application/recipe-cost-snapshot-errors.js";
export type { CostEvidenceReadPort } from "./domain/cost-evidence-read-port.js";
export { CostEvidenceReadService } from "./application/cost-evidence-read-service.js";
export {
  CostEvidenceReadNotFound,
  CostEvidenceReadPersistenceFailure,
  CostEvidenceReadValidationFailure
} from "./application/cost-evidence-read-errors.js";
export { SqliteCostEvidenceReadPort } from "./infrastructure/sqlite-cost-evidence-read-port.js";
export {
  RECIPE_COST_HISTORY_CONTRACT_NAME,
  RECIPE_COST_HISTORY_CONTRACT_VERSION,
  type RecipeCostHistoryContractV1,
  type RecipeCostHistoryEntryV1
} from "./domain/recipe-cost-history-read-contract.js";
export { RecipeCostHistoryReadService } from "./application/recipe-cost-history-read-service.js";
export {
  RecipeCostHistoryReadNotFound,
  RecipeCostHistoryReadPersistenceFailure,
  RecipeCostHistoryReadValidationFailure
} from "./application/recipe-cost-history-read-errors.js";
