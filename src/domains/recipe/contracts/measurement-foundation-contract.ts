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
