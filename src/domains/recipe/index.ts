export {
  DraftCreationFailed,
  DuplicateIngredient,
  InvalidPublishState,
  InvalidRecipeState,
  InvalidSupersession,
  InvalidVersionTransition,
  PublishValidationFailed,
  RecipeDomainError,
  RecipeAlreadyAbandoned,
  RecipeDraftAbandoned,
  RecipeInvalidTransition,
  RecipeLineIdentityCollision,
  RecipeLineNotFound,
  RecipeProductBindingConflict,
  InvalidRecipeLine,
  InvalidRecipeLineOrder,
  RecipeNotFound,
  SnapshotImmutableViolation
} from "./domain/errors.js";
export {
  IngredientReferenceId,
  RecipeDraftId,
  RecipeFamilyId,
  RecipeId,
  RecipeLineId,
  RecipeVersionId
} from "./domain/identities.js";
export {
  IngredientReference,
  type IngredientReferenceStatus
} from "./domain/ingredient-reference.js";
export { Quantity } from "./domain/quantity.js";
export {
  RecipeSnapshotBuilder,
  type PublishedExactQuantity,
  type PublishedRecipeLineSnapshot,
  type PublishedRecipeSnapshot
} from "./domain/published-recipe-snapshot.js";
export { RecipeAggregate } from "./domain/recipe-aggregate.js";
export { RecipeLine } from "./domain/recipe-line.js";
export { RecipePublishValidator } from "./domain/recipe-publish-validator.js";
export type {
  RecipeRepository,
  VersionedRecipeAggregate,
  VersionedRecipeRepository
} from "./domain/recipe-repository.js";
export type {
  ProductReference,
  RecipeAbandonment,
  RecipePublication,
  RecipeSnapshot,
  RecipeState,
  RecipeSupersession
} from "./domain/types.js";
export { Unit, type MeasurementDimension } from "./domain/unit.js";
export { VersionNumber } from "./domain/version-number.js";
export {
  RecipeSnapshotComparator,
  type RecipeSnapshotDifference,
  type RecipeSnapshotDifferenceKind,
  type RecipeSnapshotDifferenceReport
} from "./domain/recipe-snapshot-comparator.js";
export {
  RecipePublishService,
  type RecipeDraftCreationResult,
  type RecipePublishResult,
  type RecipeSupersessionResult
} from "./application/recipe-publish-service.js";
export { InMemoryRecipeRepository } from "./infrastructure/in-memory-recipe-repository.js";
export {
  InvalidRecipeReceiptEvidence,
  InvalidRecipePersistenceState,
  RecipeIdempotencyConflict,
  RecipeLineIdentityPersistenceCollision,
  RecipeConcurrencyConflict,
  RecipePersistenceError,
  RecipePersistenceTransactionFailure,
  RecipeRecordNotFound
} from "./persistence/errors.js";
export { RecipePersistenceMapper } from "./persistence/recipe-persistence-mapper.js";
export type {
  ExactQuantityRecord,
  RecipeDraftRecord,
  RecipeLineRecord,
  RecipePersistenceRecords,
  RecipePublishAuditRecord,
  RecipeRecord,
  RecipeSupersessionAuditRecord,
  RecipeVersionRecord
} from "./persistence/records.js";
export {
  RECIPE_RECEIPT_FINGERPRINT_ALGORITHM,
  RECIPE_RECEIPT_INPUT_VERSION,
  expectedRecipeReceiptFingerprint,
  familyCreationContentDigest,
  publicationContentDigest,
  type DraftAbandonmentEvidence,
  type DraftAbandonmentPersistenceInput,
  type DraftAbandonmentPersistenceResult,
  type FamilyCreationPersistenceInput,
  type FamilyCreationPersistenceResult,
  type PublishedVersionPersistenceSnapshot,
  type ReceiptRequestEvidence,
  type RecipeCreationAuditRecord,
  type RecipePersistenceUnitOfWork,
  type RecipePublicationAuditRecord,
  type RecipePublicationPersistenceInput,
  type RecipePublicationPersistenceResult
} from "./persistence/recipe-persistence-unit-of-work.js";
export { SqliteRecipePersistenceUnitOfWork } from "./infrastructure/sqlite-recipe-persistence-unit-of-work.js";
export {
  InvalidRecipeEvent,
  RecipeEventAlreadyConsumed
} from "./events/errors.js";
export {
  RECIPE_EVENT_TYPES,
  RECIPE_EVENT_VERSION,
  type RecipeDomainEvent,
  type RecipeDomainEventEnvelope,
  type RecipeDraftCreatedPayload,
  type RecipeDraftCreatedV1,
  type RecipeDraftAbandonedPayload,
  type RecipeDraftAbandonedV1,
  type RecipeEventContext,
  type RecipeEventType,
  type RecipePublishedPayload,
  type RecipePublishedV1,
  type RecipeSupersededPayload,
  type RecipeSupersededV1
} from "./events/recipe-domain-events.js";
export { RecipeEventCollection } from "./events/recipe-event-collection.js";
export { RecipeEventFactory } from "./events/recipe-event-factory.js";
export {
  MEASUREMENT_FOUNDATION_CONTRACT_VERSION,
  type MeasurementConversionRatioEvidenceV1,
  type MeasurementDimensionV1,
  type MeasurementExactQuantityV1,
  type MeasurementFoundationFailureCodeV1,
  type MeasurementFoundationContractV1,
  type MeasurementNormalizationEvidenceV1,
  type MeasurementNormalizationRequestV1,
  type MeasurementUnitResolutionContractV1,
  type MeasurementUnitResolutionRequestV1,
  type MeasurementUnitResolutionResultV1,
  type MeasurementUnitResolutionScopeV1,
  type ResolvedMeasurementUnitV1,
  type StableMeasurementUnitCodeV1
} from "./contracts/measurement-foundation-contract.js";
export {
  INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
  type ActiveMeasurementProfileDefinitionContractV1,
  type CompleteMeasurementProfileFactsV1,
  type DeprecatedMeasurementProfileDefinitionContractV1,
  type DraftMeasurementProfileDefinitionContractV1,
  type FormalMeasurementProfileDefinitionContractV1,
  type IngredientMeasurementAliasScope,
  type IngredientMeasurementLifecycleFactV1,
  type IngredientMeasurementProfileAliasV1,
  type IngredientMeasurementProfileContractV1,
  type IngredientMeasurementProfileId,
  type IngredientMeasurementProfileIdentityV1,
  type IngredientMeasurementNormalizationContractV1,
  type IngredientMeasurementProfileRepositoryPortV1,
  type IngredientMeasurementProfileStatus,
  type IngredientMeasurementProfileVersionId,
  type IngredientMeasurementSourceReferenceV1,
  type IngredientMeasurementSourceType,
  type IngredientNormalizationEvidenceV1,
  type IngredientNormalizationFailureCodeV1,
  type IngredientNormalizationRequestV1,
  type IngredientNormalizationResolvedAliasV1,
  type IngredientNormalizationResultV1,
  type MeasurementProfileDefinitionContractV1,
  type PinnedIngredientNormalizationRequestV1,
  type SupersededMeasurementProfileDefinitionContractV1
} from "./contracts/ingredient-measurement-profile-contract.js";
export {
  RECIPE_CANONICAL_PROJECTION_CONTRACT_NAME,
  RECIPE_CANONICAL_PROJECTION_CONTRACT_VERSION,
  type RecipeCanonicalProjectionFailureCodeV1,
  type RecipeCanonicalProjectionFailureV1,
  type RecipeCanonicalProjectionLineV1,
  type RecipeCanonicalProjectionResultV1,
  type RecipeCanonicalProjectionV1
} from "./contracts/recipe-canonical-projection-contract.js";
export {
  RECIPE_COSTING_CONTRACT_BASIS,
  RECIPE_COSTING_CONTRACT_NAME,
  RECIPE_COSTING_CONTRACT_VERSION,
  type RecipeCostingContractFailureCodeV2,
  type RecipeCostingContractFailureV2,
  type RecipeCostingContractResultV2,
  type RecipeCostingContractV2
} from "./contracts/recipe-costing-contract-v2.js";
export {
  APPROVED_INGREDIENT_CATEGORY_CODES_V1,
  CANONICAL_INGREDIENT_CONTRACT_VERSION,
  type ApprovedIngredientCategoryCodeV1,
  type CanonicalIngredientArchiveFactV1,
  type CanonicalIngredientContractV1,
  type CanonicalIngredientIdV1,
  type CanonicalIngredientRenameFactV1,
  type CanonicalIngredientStatusV1,
  type IngredientCategoryCodeV1
} from "./contracts/canonical-ingredient-contract.js";
export {
  InvalidMeasurementConversion,
  InvalidMeasurementQuantity,
  MeasurementDimensionMismatch,
  MeasurementFoundationError,
  MeasurementNormalizationOverflow,
  NonExactMeasurementNormalization,
  UnknownMeasurementUnit,
  UnsupportedMeasurementScale,
  UnsupportedMeasurementContractVersion
} from "./measurement/errors.js";
export type {
  ArchiveCanonicalIngredientCommandV1,
  ArchiveCanonicalIngredientResultV1,
  CanonicalIngredientDuplicateCandidateV1,
  CanonicalIngredientDuplicateWarningV1,
  CanonicalIngredientManagementRecordV1,
  RenameCanonicalIngredientCommandV1,
  RenameCanonicalIngredientResultV1
} from "./contracts/canonical-ingredient-management-contract.js";
export {
  CanonicalIngredientAlreadyArchived,
  CanonicalIngredientArchivedRenameRejected,
  CanonicalIngredientLifecycleNotFound,
  CanonicalIngredientLifecyclePersistenceFailure,
  CanonicalIngredientLifecycleValidationFailure,
  CanonicalIngredientLifecycleVersionConflict,
  InvalidCanonicalIngredientLifecycleTransition
} from "./ingredient-catalog/application/errors.js";
export {
  CanonicalIngredientLifecycleService
} from "./ingredient-catalog/application/canonical-ingredient-lifecycle-service.js";
export {
  CanonicalIngredientManagementReadService
} from "./ingredient-catalog/application/canonical-ingredient-management-read-service.js";
export {
  CanonicalIngredientCreationPersistenceFailure,
  CanonicalIngredientCreationValidationFailure
} from "./ingredient-catalog/application/canonical-ingredient-creation-errors.js";
export {
  CanonicalIngredientCreationService,
  type CanonicalIngredientCreationCommand
} from "./ingredient-catalog/application/canonical-ingredient-creation-service.js";
export type {
  RecipeDraftIngredientReferenceV1,
  RecipeIngredientReferenceImpactReadModelV1,
  RecipeIngredientReferenceImpactReadPort,
  RecipePublishedIngredientReferenceV1
} from "./domain/ingredient-reference-impact-read-port.js";
export type {
  MeasurementProfileFactsResolutionContractV1,
  MeasurementProfileFactsResolutionFailureCodeV1,
  MeasurementProfileFactsResolutionRequestV1,
  MeasurementProfileFactsResolutionResultV1,
  ResolvedMeasurementProfileFactsV1
} from "./contracts/measurement-foundation-contract.js";
export { MeasurementProfileFactsResolver } from "./measurement/measurement-profile-facts-resolver.js";
export {
  IngredientMeasurementProfileCreationIngredientInactive,
  IngredientMeasurementProfileCreationIngredientNotFound,
  IngredientMeasurementProfileCreationMeasurementFailure,
  IngredientMeasurementProfileCreationPersistenceFailure,
  IngredientMeasurementProfileCreationValidationFailure
} from "./measurement-profile/application/ingredient-measurement-profile-creation-errors.js";
export {
  IngredientMeasurementProfileCreationService,
  type IngredientMeasurementProfileCreationCommand
} from "./measurement-profile/application/ingredient-measurement-profile-creation-service.js";
export {
  IngredientMeasurementProfileSupersessionExpectedVersionConflict,
  IngredientMeasurementProfileSupersessionIngredientInactive,
  IngredientMeasurementProfileSupersessionMeasurementFailure,
  IngredientMeasurementProfileSupersessionNotFound,
  IngredientMeasurementProfileSupersessionPersistenceFailure,
  IngredientMeasurementProfileSupersessionValidationFailure
} from "./measurement-profile/application/ingredient-measurement-profile-supersession-errors.js";
export {
  IngredientMeasurementProfileSupersessionService,
  type IngredientMeasurementProfileSupersessionCommand
} from "./measurement-profile/application/ingredient-measurement-profile-supersession-service.js";
