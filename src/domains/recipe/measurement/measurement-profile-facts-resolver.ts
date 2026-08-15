import type {
  MeasurementDimensionV1,
  MeasurementProfileFactsResolutionContractV1,
  MeasurementProfileFactsResolutionFailureCodeV1,
  MeasurementProfileFactsResolutionRequestV1,
  MeasurementProfileFactsResolutionResultV1,
  MeasurementUnitResolutionContractV1,
  ResolvedMeasurementUnitV1,
  StableMeasurementUnitCodeV1
} from "../contracts/measurement-foundation-contract.js";

function failed(
  code: MeasurementProfileFactsResolutionFailureCodeV1
): MeasurementProfileFactsResolutionResultV1 {
  return Object.freeze({ status: "failed", code });
}

function resolveDimension(rawValue: unknown): MeasurementDimensionV1 | undefined {
  if (typeof rawValue !== "string") return undefined;
  switch (rawValue.trim()) {
    case "mass":
      return "mass";
    case "volume":
      return "volume";
    case "count":
      return "count";
    default:
      return undefined;
  }
}

function nonEmptyText(rawValue: unknown): string | undefined {
  return typeof rawValue === "string" && rawValue.trim() !== ""
    ? rawValue.trim()
    : undefined;
}

function resolveUnit(
  unitResolver: MeasurementUnitResolutionContractV1,
  rawValue: string
): ResolvedMeasurementUnitV1 | undefined {
  try {
    const result = unitResolver.resolveUnit({ rawValue });
    return result.status === "resolved" ? result : undefined;
  } catch {
    return undefined;
  }
}

function freezeFacts(input: {
  dimension: MeasurementDimensionV1;
  canonicalUnitCode: StableMeasurementUnitCodeV1;
  allowedUnitCodes: readonly StableMeasurementUnitCodeV1[];
}): MeasurementProfileFactsResolutionResultV1 {
  return Object.freeze({
    status: "resolved",
    facts: Object.freeze({
      dimension: input.dimension,
      canonicalUnitCode: input.canonicalUnitCode,
      allowedUnitCodes: Object.freeze([...input.allowedUnitCodes])
    })
  });
}

/**
 * Measurement-owned resolver for raw Profile definition values. It deliberately
 * returns no Profile lifecycle or persistence facts.
 */
export class MeasurementProfileFactsResolver
  implements MeasurementProfileFactsResolutionContractV1 {
  constructor(
    private readonly unitResolver: MeasurementUnitResolutionContractV1
  ) {}

  resolveProfileFacts(
    request: MeasurementProfileFactsResolutionRequestV1
  ): MeasurementProfileFactsResolutionResultV1 {
    if (
      request === null
      || typeof request !== "object"
      || !Array.isArray(request.rawAllowedUnitValues)
    ) {
      return failed("INVALID_MEASUREMENT_PROFILE_FACTS_REQUEST");
    }

    const dimension = resolveDimension(request.rawDimension);
    if (dimension === undefined) return failed("UNSUPPORTED_MEASUREMENT_DIMENSION");

    const rawCanonicalUnit = nonEmptyText(request.rawCanonicalUnit);
    if (rawCanonicalUnit === undefined) {
      return failed("UNRESOLVED_CANONICAL_MEASUREMENT_UNIT");
    }
    const canonical = resolveUnit(this.unitResolver, rawCanonicalUnit);
    if (canonical === undefined) return failed("UNRESOLVED_CANONICAL_MEASUREMENT_UNIT");
    if (canonical.dimension !== dimension) {
      return failed("CANONICAL_MEASUREMENT_UNIT_DIMENSION_MISMATCH");
    }
    if (canonical.unitCode !== canonical.canonicalUnitCode) {
      return failed("INCOMPATIBLE_MEASUREMENT_PROFILE_FACTS");
    }

    if (request.rawAllowedUnitValues.length === 0) {
      return failed("INCOMPATIBLE_MEASUREMENT_PROFILE_FACTS");
    }

    const allowedUnitCodes: StableMeasurementUnitCodeV1[] = [];
    for (const rawAllowedUnit of request.rawAllowedUnitValues) {
      const rawValue = nonEmptyText(rawAllowedUnit);
      if (rawValue === undefined) return failed("UNRESOLVED_ALLOWED_MEASUREMENT_UNIT");
      const resolved = resolveUnit(this.unitResolver, rawValue);
      if (resolved === undefined) return failed("UNRESOLVED_ALLOWED_MEASUREMENT_UNIT");
      if (
        resolved.dimension !== dimension
        || resolved.canonicalUnitCode !== canonical.unitCode
      ) {
        return failed("ALLOWED_MEASUREMENT_UNIT_DIMENSION_MISMATCH");
      }
      if (allowedUnitCodes.includes(resolved.unitCode)) {
        return failed("DUPLICATE_ALLOWED_MEASUREMENT_UNIT");
      }
      allowedUnitCodes.push(resolved.unitCode);
    }

    if (!allowedUnitCodes.includes(canonical.unitCode)) {
      return failed("INCOMPATIBLE_MEASUREMENT_PROFILE_FACTS");
    }
    return freezeFacts({
      dimension,
      canonicalUnitCode: canonical.unitCode,
      allowedUnitCodes
    });
  }
}
