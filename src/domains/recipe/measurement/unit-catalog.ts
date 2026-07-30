import type {
  MeasurementDimensionV1,
  StableMeasurementUnitCodeV1
} from "../contracts/measurement-foundation-contract.js";
import { UnknownMeasurementUnit } from "./errors.js";
import { MeasurementConversionRatio } from "./measurement-conversion-ratio.js";

export type CanonicalMeasurementUnitCode = "g" | "ml" | "each";

export type MeasurementUnitDefinition = Readonly<{
  code: StableMeasurementUnitCodeV1;
  dimension: MeasurementDimensionV1;
  canonicalUnitCode: CanonicalMeasurementUnitCode;
  conversionId: string;
  conversionVersion: 1;
  ratio: MeasurementConversionRatio;
}>;

function definition(input: {
  code: StableMeasurementUnitCodeV1;
  dimension: MeasurementDimensionV1;
  canonicalUnitCode: CanonicalMeasurementUnitCode;
  conversionId: string;
  numerator: string;
  denominator: string;
}): MeasurementUnitDefinition {
  return Object.freeze({
    code: input.code,
    dimension: input.dimension,
    canonicalUnitCode: input.canonicalUnitCode,
    conversionId: input.conversionId,
    conversionVersion: 1,
    ratio: MeasurementConversionRatio.create(input.numerator, input.denominator)
  });
}

const UNIT_DEFINITIONS: readonly MeasurementUnitDefinition[] = Object.freeze([
  definition({
    code: "g",
    dimension: "mass",
    canonicalUnitCode: "g",
    conversionId: "measurement.mass.g-to-g",
    numerator: "1",
    denominator: "1"
  }),
  definition({
    code: "kg",
    dimension: "mass",
    canonicalUnitCode: "g",
    conversionId: "measurement.mass.kg-to-g",
    numerator: "1000",
    denominator: "1"
  }),
  definition({
    code: "tw_catty",
    dimension: "mass",
    canonicalUnitCode: "g",
    conversionId: "measurement.mass.tw-catty-to-g",
    numerator: "600",
    denominator: "1"
  }),
  definition({
    code: "ml",
    dimension: "volume",
    canonicalUnitCode: "ml",
    conversionId: "measurement.volume.ml-to-ml",
    numerator: "1",
    denominator: "1"
  }),
  definition({
    code: "l",
    dimension: "volume",
    canonicalUnitCode: "ml",
    conversionId: "measurement.volume.l-to-ml",
    numerator: "1000",
    denominator: "1"
  }),
  definition({
    code: "cc",
    dimension: "volume",
    canonicalUnitCode: "ml",
    conversionId: "measurement.volume.cc-to-ml",
    numerator: "1",
    denominator: "1"
  }),
  definition({
    code: "each",
    dimension: "count",
    canonicalUnitCode: "each",
    conversionId: "measurement.count.each-to-each",
    numerator: "1",
    denominator: "1"
  }),
  definition({
    code: "dozen",
    dimension: "count",
    canonicalUnitCode: "each",
    conversionId: "measurement.count.dozen-to-each",
    numerator: "12",
    denominator: "1"
  })
]);

const UNIT_CATALOG = new Map<string, MeasurementUnitDefinition>(
  UNIT_DEFINITIONS.map((unit) => [unit.code, unit])
);

export function resolveMeasurementUnit(unitCode: unknown): MeasurementUnitDefinition {
  if (typeof unitCode !== "string") {
    throw new UnknownMeasurementUnit(unitCode);
  }
  const unit = UNIT_CATALOG.get(unitCode);
  if (!unit) {
    throw new UnknownMeasurementUnit(unitCode);
  }
  return unit;
}
