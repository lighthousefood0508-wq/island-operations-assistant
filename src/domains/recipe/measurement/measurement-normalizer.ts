import {
  MEASUREMENT_FOUNDATION_CONTRACT_VERSION,
  type MeasurementDimensionV1,
  type MeasurementFoundationContractV1,
  type MeasurementNormalizationEvidenceV1,
  type MeasurementNormalizationRequestV1
} from "../contracts/measurement-foundation-contract.js";
import { ExactMeasurementQuantity } from "./exact-measurement-quantity.js";
import {
  MeasurementDimensionMismatch,
  UnsupportedMeasurementContractVersion
} from "./errors.js";
import {
  resolveMeasurementUnit,
  type MeasurementUnitDefinition
} from "./unit-catalog.js";

const DIMENSIONS = new Set<MeasurementDimensionV1>(["mass", "volume", "count"]);

function validateContractVersion(version: unknown): void {
  if (version !== MEASUREMENT_FOUNDATION_CONTRACT_VERSION) {
    throw new UnsupportedMeasurementContractVersion(version);
  }
}

function validateDimension(dimension: unknown): MeasurementDimensionV1 {
  if (typeof dimension !== "string" || !DIMENSIONS.has(dimension as MeasurementDimensionV1)) {
    throw new MeasurementDimensionMismatch(
      "unknown",
      dimension,
      "mass, volume, or count"
    );
  }
  return dimension as MeasurementDimensionV1;
}

function verifyDimension(
  unit: MeasurementUnitDefinition,
  dimension: MeasurementDimensionV1
): void {
  if (unit.dimension !== dimension) {
    throw new MeasurementDimensionMismatch(unit.code, dimension, unit.dimension);
  }
}

function buildEvidence(input: {
  dimension: MeasurementDimensionV1;
  rawQuantity: ExactMeasurementQuantity;
  unit: MeasurementUnitDefinition;
  normalizedQuantity: ExactMeasurementQuantity;
}): MeasurementNormalizationEvidenceV1 {
  return Object.freeze({
    contractVersion: MEASUREMENT_FOUNDATION_CONTRACT_VERSION,
    dimension: input.dimension,
    rawQuantity: input.rawQuantity.toEvidence(),
    rawUnitCode: input.unit.code,
    conversionId: input.unit.conversionId,
    conversionVersion: input.unit.conversionVersion,
    conversionRatio: input.unit.ratio.toEvidence(),
    normalizedQuantity: input.normalizedQuantity.toEvidence(),
    canonicalUnitCode: input.unit.canonicalUnitCode
  });
}

export class MeasurementNormalizer implements MeasurementFoundationContractV1 {
  normalize(request: MeasurementNormalizationRequestV1): MeasurementNormalizationEvidenceV1 {
    validateContractVersion(request.contractVersion);
    const rawQuantity = ExactMeasurementQuantity.create(request.rawQuantity);
    const unit = resolveMeasurementUnit(request.rawUnitCode);
    const dimension = validateDimension(request.dimension);
    verifyDimension(unit, dimension);
    const normalizedQuantity = unit.ratio.apply(rawQuantity);
    return buildEvidence({ dimension, rawQuantity, unit, normalizedQuantity });
  }
}
