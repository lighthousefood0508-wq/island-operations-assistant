import type {
  MeasurementDimensionV1,
  MeasurementExactQuantityV1,
  MeasurementNormalizationEvidenceV1,
  StableMeasurementUnitCodeV1
} from "./measurement-foundation-contract.js";

export const INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION = 1 as const;

export type CanonicalIngredientIdV1 = string;
export type IngredientMeasurementProfileId = string;
export type IngredientMeasurementProfileVersionId = string;
export type IngredientMeasurementProfileStatus =
  | "Draft"
  | "Active"
  | "Deprecated"
  | "Superseded";
export type IngredientMeasurementAliasScope = "GLOBAL" | "LOCALE" | "PROFILE";
export type IngredientMeasurementSourceType =
  | "SYSTEM"
  | "MANUAL"
  | "SUPPLIER"
  | "LEGACY";

export type IngredientMeasurementProfileIdentityV1 = Readonly<{
  profileId: IngredientMeasurementProfileId;
  profileVersionId: IngredientMeasurementProfileVersionId;
  ingredientId: CanonicalIngredientIdV1;
}>;

export type IngredientMeasurementSourceReferenceV1 = Readonly<{
  sourceType: IngredientMeasurementSourceType;
  referenceId?: string;
  recordedAt: string;
  recordedBy: string;
}>;

export type IngredientMeasurementProfileAliasV1 = Readonly<{
  rawValue: string;
  scope: "PROFILE";
  resolvedUnitCode: StableMeasurementUnitCodeV1;
}>;

export type IngredientMeasurementLifecycleFactV1 = Readonly<{
  transition: "CREATED" | "ACTIVATED" | "DEPRECATED" | "SUPERSEDED" | "DRAFT_REVISED";
  occurredAt: string;
  actorId: string;
  reason?: string;
  supersedingProfileVersionId?: IngredientMeasurementProfileVersionId;
}>;

export type CompleteMeasurementProfileFactsV1 = Readonly<{
  dimension: MeasurementDimensionV1;
  canonicalUnitCode: "g" | "ml" | "each";
  allowedUnitCodes: readonly StableMeasurementUnitCodeV1[];
  profileAliases: readonly IngredientMeasurementProfileAliasV1[];
  source: IngredientMeasurementSourceReferenceV1;
}>;

type MeasurementProfileBaseV1 = Readonly<{
  contractVersion: typeof INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION;
  identity: IngredientMeasurementProfileIdentityV1;
  state: IngredientMeasurementProfileStatus;
  lifecycle: readonly IngredientMeasurementLifecycleFactV1[];
}>;

export type DraftMeasurementProfileDefinitionContractV1 =
  MeasurementProfileBaseV1
  & Readonly<{
    state: "Draft";
    definition?: Partial<CompleteMeasurementProfileFactsV1>;
  }>;

export type ActiveMeasurementProfileDefinitionContractV1 =
  MeasurementProfileBaseV1
  & CompleteMeasurementProfileFactsV1
  & Readonly<{
    state: "Active";
    effectiveFrom: string;
  }>;

export type DeprecatedMeasurementProfileDefinitionContractV1 =
  MeasurementProfileBaseV1
  & CompleteMeasurementProfileFactsV1
  & Readonly<{
    state: "Deprecated";
    effectiveFrom: string;
    effectiveTo: string;
  }>;

export type SupersededMeasurementProfileDefinitionContractV1 =
  MeasurementProfileBaseV1
  & CompleteMeasurementProfileFactsV1
  & Readonly<{
    state: "Superseded";
    effectiveFrom: string;
    effectiveTo: string;
    supersedingProfileVersionId: IngredientMeasurementProfileVersionId;
  }>;

export type FormalMeasurementProfileDefinitionContractV1 =
  | ActiveMeasurementProfileDefinitionContractV1
  | DeprecatedMeasurementProfileDefinitionContractV1
  | SupersededMeasurementProfileDefinitionContractV1;

export type MeasurementProfileDefinitionContractV1 =
  | DraftMeasurementProfileDefinitionContractV1
  | FormalMeasurementProfileDefinitionContractV1;

export type IngredientMeasurementProfileContractV1 = Readonly<{
  contractVersion: typeof INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION;
  profileId: IngredientMeasurementProfileId;
  ingredientId: CanonicalIngredientIdV1;
  versions: readonly MeasurementProfileDefinitionContractV1[];
}>;

export type IngredientNormalizationRequestV1 = Readonly<{
  contractVersion: typeof INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION;
  ingredientId: CanonicalIngredientIdV1;
  rawQuantity: MeasurementExactQuantityV1;
  rawUnitValue: string;
  locale?: string;
  evaluatedAt: string;
}>;

export type PinnedIngredientNormalizationRequestV1 =
  IngredientNormalizationRequestV1
  & Readonly<{
    profileVersionId: IngredientMeasurementProfileVersionId;
  }>;

export type IngredientNormalizationResolvedAliasV1 = Readonly<{
  rawValue: string;
  scope: IngredientMeasurementAliasScope;
  locale?: string;
  resolvedUnitCode: StableMeasurementUnitCodeV1;
}>;

export type IngredientNormalizationEvidenceV1 = Readonly<{
  contractVersion: typeof INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION;
  ingredientId: CanonicalIngredientIdV1;
  profileId: IngredientMeasurementProfileId;
  profileVersionId: IngredientMeasurementProfileVersionId;
  evaluatedAt: string;
  rawUnitValue: string;
  source: IngredientMeasurementSourceReferenceV1;
  resolvedAlias?: IngredientNormalizationResolvedAliasV1;
  measurementEvidence: MeasurementNormalizationEvidenceV1;
}>;

export type IngredientNormalizationFailureCodeV1 =
  | "MISSING_ACTIVE_PROFILE"
  | "AMBIGUOUS_ACTIVE_PROFILE"
  | "UNKNOWN_UNIT_ALIAS"
  | "AMBIGUOUS_UNIT_ALIAS"
  | "LOCALE_REQUIRED"
  | "UNSUPPORTED_LOCALE_ALIAS"
  | "UNIT_NOT_ALLOWED_BY_PROFILE"
  | "INCOMPATIBLE_MEASUREMENT_DIMENSION"
  | "UNSUPPORTED_TAIWAN_UNIT"
  | "PACKAGE_SPECIFICATION_REQUIRED"
  | "MISSING_SOURCE_EVIDENCE"
  | "INVALID_MEASUREMENT_PROFILE_DEFINITION"
  | "INVALID_MEASUREMENT_PROFILE_TRANSITION"
  | "IMMUTABLE_ACTIVE_PROFILE_VIOLATION"
  | "UNSUPPORTED_EXACT_SCALE"
  | "NON_EXACT_NORMALIZATION"
  | "ARITHMETIC_OVERFLOW"
  | "MISSING_HISTORICAL_PROFILE_VERSION"
  | "INVALID_MEASUREMENT_PROFILE_IDENTITY"
  | "INVALID_MEASUREMENT_QUANTITY";

export type IngredientNormalizationResultV1 =
  | Readonly<{
    status: "normalized";
    evidence: IngredientNormalizationEvidenceV1;
  }>
  | Readonly<{
    status: "failed";
    failure: Readonly<{
      code: IngredientNormalizationFailureCodeV1;
      message: string;
    }>;
  }>;

export interface IngredientMeasurementProfileRepositoryPortV1 {
  findHistoryByProfileId(
    profileId: IngredientMeasurementProfileId
  ): readonly MeasurementProfileDefinitionContractV1[];

  findActiveProfilesAt(
    ingredientId: CanonicalIngredientIdV1,
    evaluatedAt: string
  ): readonly FormalMeasurementProfileDefinitionContractV1[];

  findProfileVersion(
    profileVersionId: IngredientMeasurementProfileVersionId
  ): MeasurementProfileDefinitionContractV1 | undefined;
}
