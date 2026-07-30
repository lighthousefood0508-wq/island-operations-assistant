import type {
  CompleteMeasurementProfileFactsV1,
  IngredientMeasurementSourceReferenceV1
} from "../contracts/ingredient-measurement-profile-contract.js";
import type {
  MeasurementUnitResolutionContractV1
} from "../contracts/measurement-foundation-contract.js";
import {
  AmbiguousIngredientMeasurementAlias,
  IngredientMeasurementUnitNotAllowed,
  InvalidIngredientMeasurementProfileDefinition,
  MissingIngredientMeasurementSourceEvidence
} from "./errors.js";

const SOURCE_TYPES = new Set(["SYSTEM", "MANUAL", "SUPPLIER", "LEGACY"]);
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function assertProfileText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidIngredientMeasurementProfileDefinition(`${label} is required.`);
  }
  return value.trim();
}

export function assertProfileInstant(value: unknown, label: string): string {
  const instant = assertProfileText(value, label);
  if (!ISO_INSTANT_PATTERN.test(instant) || Number.isNaN(Date.parse(instant))) {
    throw new InvalidIngredientMeasurementProfileDefinition(
      `${label} must be an ISO-8601 instant with an explicit UTC offset.`
    );
  }
  return instant;
}

export function compareProfileInstants(left: string, right: string): number {
  return Date.parse(left) - Date.parse(right);
}

export function freezeProfileSource(
  source: IngredientMeasurementSourceReferenceV1 | undefined
): IngredientMeasurementSourceReferenceV1 {
  if (source === undefined) {
    throw new MissingIngredientMeasurementSourceEvidence(
      "An Active Measurement Profile requires source evidence."
    );
  }
  if (!SOURCE_TYPES.has(source.sourceType)) {
    throw new MissingIngredientMeasurementSourceEvidence(
      "Measurement Profile sourceType is not supported."
    );
  }
  if (source.referenceId !== undefined && source.referenceId.trim() === "") {
    throw new MissingIngredientMeasurementSourceEvidence(
      "Measurement Profile source referenceId cannot be blank."
    );
  }
  if (
    typeof source.recordedAt !== "string"
    || source.recordedAt.trim() === ""
    || Number.isNaN(Date.parse(source.recordedAt))
  ) {
    throw new MissingIngredientMeasurementSourceEvidence(
      "Measurement Profile source recordedAt must be a valid timestamp."
    );
  }
  if (
    typeof source.recordedBy !== "string"
    || source.recordedBy.trim() === ""
  ) {
    throw new MissingIngredientMeasurementSourceEvidence(
      "Measurement Profile source recordedBy is required."
    );
  }
  return Object.freeze({
    sourceType: source.sourceType,
    ...(source.referenceId === undefined
      ? {}
      : { referenceId: source.referenceId.trim() }),
    recordedAt: source.recordedAt.trim(),
    recordedBy: source.recordedBy.trim()
  });
}

export function validateAndFreezeProfileDefinition(
  definition: CompleteMeasurementProfileFactsV1,
  unitResolver: MeasurementUnitResolutionContractV1
): CompleteMeasurementProfileFactsV1 {
  const canonicalResolution = unitResolver.resolveUnit({
    rawValue: definition.canonicalUnitCode
  });
  if (
    canonicalResolution.status !== "resolved"
    || canonicalResolution.scope !== "EXPLICIT"
    || canonicalResolution.unitCode !== definition.canonicalUnitCode
    || canonicalResolution.dimension !== definition.dimension
    || canonicalResolution.canonicalUnitCode !== definition.canonicalUnitCode
  ) {
    throw new InvalidIngredientMeasurementProfileDefinition(
      "Profile canonical dimension and unit must match Measurement Foundation authority."
    );
  }
  if (definition.allowedUnitCodes.length === 0) {
    throw new InvalidIngredientMeasurementProfileDefinition(
      "An Active Measurement Profile requires at least one allowed unit."
    );
  }

  const allowedUnitCodes = [...new Set(definition.allowedUnitCodes)];
  if (allowedUnitCodes.length !== definition.allowedUnitCodes.length) {
    throw new InvalidIngredientMeasurementProfileDefinition(
      "Allowed Measurement unit codes must be unique."
    );
  }
  if (!allowedUnitCodes.includes(definition.canonicalUnitCode)) {
    throw new InvalidIngredientMeasurementProfileDefinition(
      "Allowed Measurement units must include the canonical unit."
    );
  }

  for (const unitCode of allowedUnitCodes) {
    const resolution = unitResolver.resolveUnit({ rawValue: unitCode });
    if (
      resolution.status !== "resolved"
      || resolution.scope !== "EXPLICIT"
      || resolution.dimension !== definition.dimension
      || resolution.canonicalUnitCode !== definition.canonicalUnitCode
    ) {
      throw new InvalidIngredientMeasurementProfileDefinition(
        `Allowed unit ${unitCode} is incompatible with the Profile canonical measurement.`
      );
    }
  }

  const seenAliases = new Map<string, string>();
  const profileAliases = definition.profileAliases.map((alias) => {
    if (alias.scope !== "PROFILE") {
      throw new InvalidIngredientMeasurementProfileDefinition(
        "Ingredient-specific aliases must use PROFILE scope."
      );
    }
    const rawValue = assertProfileText(alias.rawValue, "Profile alias");
    if (!allowedUnitCodes.includes(alias.resolvedUnitCode)) {
      throw new IngredientMeasurementUnitNotAllowed(alias.resolvedUnitCode);
    }
    if (seenAliases.has(rawValue)) {
      throw new AmbiguousIngredientMeasurementAlias(rawValue);
    }
    seenAliases.set(rawValue, alias.resolvedUnitCode);

    const authoritativeResolution = unitResolver.resolveUnit({ rawValue });
    if (authoritativeResolution.status !== "unknown") {
      throw new InvalidIngredientMeasurementProfileDefinition(
        `Profile alias ${rawValue} cannot override or duplicate Measurement authority.`
      );
    }
    return Object.freeze({
      rawValue,
      scope: "PROFILE" as const,
      resolvedUnitCode: alias.resolvedUnitCode
    });
  });

  return Object.freeze({
    dimension: definition.dimension,
    canonicalUnitCode: definition.canonicalUnitCode,
    allowedUnitCodes: Object.freeze(allowedUnitCodes),
    profileAliases: Object.freeze(profileAliases),
    source: freezeProfileSource(definition.source)
  });
}
