export const MEASUREMENT_FOUNDATION_CONTRACT_VERSION = 1 as const;

export type MeasurementDimensionV1 = "mass" | "volume" | "count";

export type StableMeasurementUnitCodeV1 =
  | "g"
  | "kg"
  | "tw_catty"
  | "ml"
  | "l"
  | "cc"
  | "each"
  | "dozen";

export type MeasurementExactQuantityV1 = Readonly<{
  coefficient: string;
  scale: number;
}>;

export type MeasurementConversionRatioEvidenceV1 = Readonly<{
  numerator: string;
  denominator: string;
}>;

export type MeasurementNormalizationRequestV1 = Readonly<{
  contractVersion: typeof MEASUREMENT_FOUNDATION_CONTRACT_VERSION;
  dimension: MeasurementDimensionV1;
  rawQuantity: MeasurementExactQuantityV1;
  rawUnitCode: string;
}>;

export type MeasurementNormalizationEvidenceV1 = Readonly<{
  contractVersion: typeof MEASUREMENT_FOUNDATION_CONTRACT_VERSION;
  dimension: MeasurementDimensionV1;
  rawQuantity: MeasurementExactQuantityV1;
  rawUnitCode: StableMeasurementUnitCodeV1;
  conversionId: string;
  conversionVersion: number;
  conversionRatio: MeasurementConversionRatioEvidenceV1;
  normalizedQuantity: MeasurementExactQuantityV1;
  canonicalUnitCode: "g" | "ml" | "each";
}>;

export interface MeasurementFoundationContractV1 {
  normalize(request: MeasurementNormalizationRequestV1): MeasurementNormalizationEvidenceV1;
}

export type MeasurementFoundationFailureCodeV1 =
  | "UNSUPPORTED_MEASUREMENT_CONTRACT_VERSION"
  | "INVALID_MEASUREMENT_QUANTITY"
  | "UNKNOWN_MEASUREMENT_UNIT"
  | "MEASUREMENT_DIMENSION_MISMATCH"
  | "INVALID_MEASUREMENT_CONVERSION"
  | "UNSUPPORTED_MEASUREMENT_SCALE"
  | "NON_EXACT_MEASUREMENT_NORMALIZATION"
  | "MEASUREMENT_NORMALIZATION_OVERFLOW"
  | "INVALID_MEASUREMENT_UNIT_RESOLUTION";

export type MeasurementUnitResolutionScopeV1 = "EXPLICIT" | "GLOBAL" | "LOCALE";

export type MeasurementUnitResolutionRequestV1 = Readonly<{
  rawValue: string;
  locale?: string;
}>;

export type ResolvedMeasurementUnitV1 = Readonly<{
  status: "resolved";
  scope: MeasurementUnitResolutionScopeV1;
  rawValue: string;
  locale?: string;
  unitCode: StableMeasurementUnitCodeV1;
  dimension: MeasurementDimensionV1;
  canonicalUnitCode: "g" | "ml" | "each";
}>;

export type MeasurementUnitResolutionResultV1 =
  | ResolvedMeasurementUnitV1
  | Readonly<{ status: "unknown"; rawValue: string }>
  | Readonly<{ status: "ambiguous"; rawValue: string; candidates: readonly StableMeasurementUnitCodeV1[] }>
  | Readonly<{ status: "locale_required"; rawValue: string }>
  | Readonly<{ status: "unsupported_locale_alias"; rawValue: string; locale: string }>
  | Readonly<{ status: "unsupported_taiwan_unit"; rawValue: string }>
  | Readonly<{ status: "package_specification_required"; rawValue: string }>;

export interface MeasurementUnitResolutionContractV1 {
  resolveUnit(
    request: MeasurementUnitResolutionRequestV1
  ): MeasurementUnitResolutionResultV1;
}

export type MeasurementProfileFactsResolutionRequestV1 = Readonly<{
  rawDimension: unknown;
  rawCanonicalUnit: unknown;
  rawAllowedUnitValues: readonly unknown[];
}>;

export type ResolvedMeasurementProfileFactsV1 = Readonly<{
  dimension: MeasurementDimensionV1;
  canonicalUnitCode: "g" | "ml" | "each";
  allowedUnitCodes: readonly StableMeasurementUnitCodeV1[];
}>;

export type MeasurementProfileFactsResolutionFailureCodeV1 =
  | "INVALID_MEASUREMENT_PROFILE_FACTS_REQUEST"
  | "UNSUPPORTED_MEASUREMENT_DIMENSION"
  | "UNRESOLVED_CANONICAL_MEASUREMENT_UNIT"
  | "UNRESOLVED_ALLOWED_MEASUREMENT_UNIT"
  | "CANONICAL_MEASUREMENT_UNIT_DIMENSION_MISMATCH"
  | "ALLOWED_MEASUREMENT_UNIT_DIMENSION_MISMATCH"
  | "INCOMPATIBLE_MEASUREMENT_PROFILE_FACTS"
  | "DUPLICATE_ALLOWED_MEASUREMENT_UNIT";

export type MeasurementProfileFactsResolutionResultV1 =
  | Readonly<{ status: "resolved"; facts: ResolvedMeasurementProfileFactsV1 }>
  | Readonly<{
    status: "failed";
    code: MeasurementProfileFactsResolutionFailureCodeV1;
  }>;

export interface MeasurementProfileFactsResolutionContractV1 {
  resolveProfileFacts(
    request: MeasurementProfileFactsResolutionRequestV1
  ): MeasurementProfileFactsResolutionResultV1;
}
