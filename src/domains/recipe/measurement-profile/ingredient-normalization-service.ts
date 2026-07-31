import {
  INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
  type FormalMeasurementProfileDefinitionContractV1,
  type IngredientMeasurementNormalizationContractV1,
  type IngredientMeasurementProfileAliasV1,
  type IngredientMeasurementProfileRepositoryPortV1,
  type IngredientNormalizationEvidenceV1,
  type IngredientNormalizationFailureCodeV1,
  type IngredientNormalizationRequestV1,
  type IngredientNormalizationResolvedAliasV1,
  type IngredientNormalizationResultV1,
  type PinnedIngredientNormalizationRequestV1
} from "../contracts/ingredient-measurement-profile-contract.js";
import {
  MEASUREMENT_FOUNDATION_CONTRACT_VERSION,
  type MeasurementFoundationContractV1,
  type MeasurementFoundationFailureCodeV1,
  type MeasurementUnitResolutionContractV1,
  type MeasurementUnitResolutionResultV1,
  type StableMeasurementUnitCodeV1
} from "../contracts/measurement-foundation-contract.js";
import { assertProfileInstant } from "./profile-validator.js";

type Failure = Readonly<{
  code: IngredientNormalizationFailureCodeV1;
  message: string;
}>;

type ResolvedUnit = Readonly<{
  unitCode: StableMeasurementUnitCodeV1;
  alias?: IngredientNormalizationResolvedAliasV1;
}>;

function freezeFailure(
  code: IngredientNormalizationFailureCodeV1,
  message: string
): IngredientNormalizationResultV1 {
  return Object.freeze({
    status: "failed",
    failure: Object.freeze({ code, message })
  });
}

function errorCode(error: unknown): MeasurementFoundationFailureCodeV1 | undefined {
  if (
    typeof error === "object"
    && error !== null
    && "code" in error
    && typeof error.code === "string"
  ) {
    return error.code as MeasurementFoundationFailureCodeV1;
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Measurement normalization failed.";
}

function mapMeasurementFailure(error: unknown): Failure {
  const code = errorCode(error);
  const message = errorMessage(error);
  if (code === "MEASUREMENT_NORMALIZATION_OVERFLOW") {
    return Object.freeze({ code: "ARITHMETIC_OVERFLOW", message });
  }
  if (code === "MEASUREMENT_DIMENSION_MISMATCH") {
    return Object.freeze({
      code: "INCOMPATIBLE_MEASUREMENT_DIMENSION",
      message
    });
  }
  if (code === "NON_EXACT_MEASUREMENT_NORMALIZATION") {
    return Object.freeze({ code: "NON_EXACT_NORMALIZATION", message });
  }
  if (code === "UNSUPPORTED_MEASUREMENT_SCALE") {
    return Object.freeze({ code: "UNSUPPORTED_EXACT_SCALE", message });
  }
  if (code === "INVALID_MEASUREMENT_QUANTITY") {
    return Object.freeze({ code: "INVALID_MEASUREMENT_QUANTITY", message });
  }
  return Object.freeze({
    code: "INVALID_MEASUREMENT_PROFILE_DEFINITION",
    message
  });
}

function profileAliasResolution(
  rawValue: string,
  lookupValue: string,
  aliases: readonly IngredientMeasurementProfileAliasV1[],
  allowedUnits: readonly StableMeasurementUnitCodeV1[]
): ResolvedUnit | Failure {
  const candidates = aliases.filter((alias) => alias.rawValue === lookupValue);
  if (candidates.length === 0) {
    return Object.freeze({
      code: "UNKNOWN_UNIT_ALIAS",
      message: `Measurement alias ${rawValue} is unknown.`
    });
  }
  const unitCodes = [...new Set(candidates.map((alias) => alias.resolvedUnitCode))];
  if (candidates.length > 1 || unitCodes.length > 1) {
    return Object.freeze({
      code: "AMBIGUOUS_UNIT_ALIAS",
      message: `Measurement alias ${rawValue} is ambiguous.`
    });
  }
  const unitCode = unitCodes[0]!;
  if (!allowedUnits.includes(unitCode)) {
    return Object.freeze({
      code: "UNIT_NOT_ALLOWED_BY_PROFILE",
      message: `Measurement unit ${unitCode} is not allowed by the selected Profile.`
    });
  }
  return Object.freeze({
    unitCode,
    alias: Object.freeze({
      rawValue,
      scope: "PROFILE",
      resolvedUnitCode: unitCode
    })
  });
}

function cloneEvidence(
  evidence: IngredientNormalizationEvidenceV1
): IngredientNormalizationEvidenceV1 {
  return Object.freeze({
    ...evidence,
    source: Object.freeze({ ...evidence.source }),
    ...(evidence.resolvedAlias === undefined
      ? {}
      : { resolvedAlias: Object.freeze({ ...evidence.resolvedAlias }) }),
    measurementEvidence: Object.freeze({
      ...evidence.measurementEvidence,
      rawQuantity: Object.freeze({
        ...evidence.measurementEvidence.rawQuantity
      }),
      conversionRatio: Object.freeze({
        ...evidence.measurementEvidence.conversionRatio
      }),
      normalizedQuantity: Object.freeze({
        ...evidence.measurementEvidence.normalizedQuantity
      })
    })
  });
}

function isProfileEffectiveAt(
  profile: FormalMeasurementProfileDefinitionContractV1,
  evaluatedAt: string
): boolean {
  const instant = Date.parse(evaluatedAt);
  if (instant < Date.parse(profile.effectiveFrom)) {
    return false;
  }
  return profile.state === "Active"
    || instant < Date.parse(profile.effectiveTo);
}

export class IngredientMeasurementNormalizationService
implements IngredientMeasurementNormalizationContractV1 {
  constructor(
    private readonly repository: IngredientMeasurementProfileRepositoryPortV1,
    private readonly unitResolver: MeasurementUnitResolutionContractV1,
    private readonly normalizer: MeasurementFoundationContractV1
  ) {}

  normalizeAt(
    request: IngredientNormalizationRequestV1
  ): IngredientNormalizationResultV1 {
    return this.normalizeCurrent(request);
  }

  normalizeCurrent(
    request: IngredientNormalizationRequestV1
  ): IngredientNormalizationResultV1 {
    const requestFailure = this.validateRequest(request);
    if (requestFailure !== undefined) {
      return freezeFailure(requestFailure.code, requestFailure.message);
    }
    const activeProfiles = this.repository.findActiveProfilesAt(
      request.ingredientId,
      request.evaluatedAt
    );
    if (activeProfiles.length === 0) {
      return freezeFailure(
        "MISSING_ACTIVE_PROFILE",
        `Ingredient ${request.ingredientId} has no Active Measurement Profile.`
      );
    }
    if (activeProfiles.length > 1) {
      return freezeFailure(
        "AMBIGUOUS_ACTIVE_PROFILE",
        `Ingredient ${request.ingredientId} has multiple Active Measurement Profiles.`
      );
    }
    return this.normalizeWithProfile(request, activeProfiles[0]!);
  }

  normalizePinned(
    request: PinnedIngredientNormalizationRequestV1
  ): IngredientNormalizationResultV1 {
    const requestFailure = this.validateRequest(request);
    if (requestFailure !== undefined) {
      return freezeFailure(requestFailure.code, requestFailure.message);
    }
    const profile = this.repository.findProfileVersion(request.profileVersionId);
    if (profile === undefined || profile.state === "Draft") {
      return freezeFailure(
        "MISSING_HISTORICAL_PROFILE_VERSION",
        `Measurement Profile Version ${request.profileVersionId} is not available for historical replay.`
      );
    }
    if (profile.identity.ingredientId !== request.ingredientId) {
      return freezeFailure(
        "INVALID_MEASUREMENT_PROFILE_DEFINITION",
        "Pinned Measurement Profile Version belongs to another Ingredient."
      );
    }
    if (!isProfileEffectiveAt(profile, request.evaluatedAt)) {
      return freezeFailure(
        "INVALID_MEASUREMENT_PROFILE_DEFINITION",
        "Pinned Measurement Profile Version is not effective at evaluatedAt."
      );
    }
    return this.normalizeWithProfile(request, profile);
  }

  private validateRequest(
    request: IngredientNormalizationRequestV1
  ): Failure | undefined {
    if (
      request.contractVersion !==
      INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION
    ) {
      return Object.freeze({
        code: "INVALID_MEASUREMENT_PROFILE_DEFINITION",
        message: `Ingredient Measurement Profile contract version ${String(request.contractVersion)} is unsupported.`
      });
    }
    try {
      assertProfileInstant(request.evaluatedAt, "Normalization evaluatedAt");
    } catch {
      return Object.freeze({
        code: "INVALID_MEASUREMENT_PROFILE_DEFINITION",
        message: "Normalization evaluatedAt must be a valid caller-provided ISO-8601 instant."
      });
    }
    return undefined;
  }

  private normalizeWithProfile(
    request: IngredientNormalizationRequestV1,
    profile: FormalMeasurementProfileDefinitionContractV1
  ): IngredientNormalizationResultV1 {
    let resolution: MeasurementUnitResolutionResultV1;
    try {
      resolution = this.unitResolver.resolveUnit({
        rawValue: request.rawUnitValue,
        ...(request.locale === undefined ? {} : { locale: request.locale })
      });
    } catch (error) {
      const message = errorMessage(error);
      if (errorCode(error) === "INVALID_MEASUREMENT_UNIT_RESOLUTION") {
        return freezeFailure("UNKNOWN_UNIT_ALIAS", message);
      }
      const failure = mapMeasurementFailure(error);
      return freezeFailure(failure.code, failure.message);
    }

    let resolved: ResolvedUnit | Failure;
    if (resolution.status === "resolved") {
      resolved = Object.freeze({
        unitCode: resolution.unitCode,
        ...(resolution.scope === "EXPLICIT"
          ? {}
          : {
            alias: Object.freeze({
              rawValue: resolution.rawValue,
              scope: resolution.scope,
              ...(resolution.locale === undefined
                ? {}
                : { locale: resolution.locale }),
              resolvedUnitCode: resolution.unitCode
            })
          })
      });
    } else if (resolution.status === "unknown") {
      resolved = profileAliasResolution(
        resolution.rawValue,
        resolution.rawValue.trim(),
        profile.profileAliases,
        profile.allowedUnitCodes
      );
    } else if (resolution.status === "ambiguous") {
      resolved = Object.freeze({
        code: "AMBIGUOUS_UNIT_ALIAS",
        message: `Measurement alias ${resolution.rawValue} is ambiguous.`
      });
    } else if (resolution.status === "locale_required") {
      resolved = Object.freeze({
        code: "LOCALE_REQUIRED",
        message: `Measurement alias ${resolution.rawValue} requires an explicit locale.`
      });
    } else if (resolution.status === "unsupported_locale_alias") {
      resolved = Object.freeze({
        code: "UNSUPPORTED_LOCALE_ALIAS",
        message: `Measurement alias ${resolution.rawValue} is unsupported for locale ${resolution.locale}.`
      });
    } else if (resolution.status === "unsupported_taiwan_unit") {
      resolved = Object.freeze({
        code: "UNSUPPORTED_TAIWAN_UNIT",
        message: `Taiwan unit ${resolution.rawValue} is unsupported in v1.`
      });
    } else {
      resolved = Object.freeze({
        code: "PACKAGE_SPECIFICATION_REQUIRED",
        message: `${resolution.rawValue} requires a future Package Specification.`
      });
    }

    if ("code" in resolved) {
      return freezeFailure(resolved.code, resolved.message);
    }
    if (!profile.allowedUnitCodes.includes(resolved.unitCode)) {
      return freezeFailure(
        "UNIT_NOT_ALLOWED_BY_PROFILE",
        `Measurement unit ${resolved.unitCode} is not allowed by the selected Profile.`
      );
    }

    try {
      const measurementEvidence = this.normalizer.normalize({
        contractVersion: MEASUREMENT_FOUNDATION_CONTRACT_VERSION,
        dimension: profile.dimension,
        rawQuantity: request.rawQuantity,
        rawUnitCode: resolved.unitCode
      });
      if (
        measurementEvidence.dimension !== profile.dimension
        || measurementEvidence.canonicalUnitCode !== profile.canonicalUnitCode
      ) {
        return freezeFailure(
          "INCOMPATIBLE_MEASUREMENT_DIMENSION",
          "Measurement normalization does not match the selected Profile."
        );
      }
      const evidence = cloneEvidence({
        contractVersion: INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
        ingredientId: request.ingredientId,
        profileId: profile.identity.profileId,
        profileVersionId: profile.identity.profileVersionId,
        evaluatedAt: request.evaluatedAt,
        rawUnitValue: request.rawUnitValue,
        source: profile.source,
        ...(resolved.alias === undefined ? {} : { resolvedAlias: resolved.alias }),
        measurementEvidence
      });
      return Object.freeze({ status: "normalized", evidence });
    } catch (error) {
      const failure = mapMeasurementFailure(error);
      return freezeFailure(failure.code, failure.message);
    }
  }
}
