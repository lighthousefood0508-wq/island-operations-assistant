import type {
  IngredientNormalizationFailureCodeV1
} from "../contracts/ingredient-measurement-profile-contract.js";

export abstract class IngredientMeasurementProfileError extends Error {
  abstract readonly code: IngredientNormalizationFailureCodeV1;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidIngredientMeasurementProfileIdentity
  extends IngredientMeasurementProfileError {
  readonly code = "INVALID_MEASUREMENT_PROFILE_IDENTITY" as const;

  constructor(expectedPrefix: string) {
    super(`Measurement Profile identity must use ${expectedPrefix}<uuid> format.`);
  }
}

export class MissingIngredientMeasurementSourceEvidence
  extends IngredientMeasurementProfileError {
  readonly code = "MISSING_SOURCE_EVIDENCE" as const;

  constructor(message: string) {
    super(message);
  }
}

export class InvalidIngredientMeasurementProfileDefinition
  extends IngredientMeasurementProfileError {
  readonly code = "INVALID_MEASUREMENT_PROFILE_DEFINITION" as const;

  constructor(message: string) {
    super(message);
  }
}

export class InvalidIngredientMeasurementProfileTransition
  extends IngredientMeasurementProfileError {
  readonly code = "INVALID_MEASUREMENT_PROFILE_TRANSITION" as const;

  constructor(from: string, transition: string) {
    super(`Measurement Profile cannot apply ${transition} from ${from}.`);
  }
}

export class ImmutableActiveMeasurementProfileViolation
  extends IngredientMeasurementProfileError {
  readonly code = "IMMUTABLE_ACTIVE_PROFILE_VIOLATION" as const;

  constructor() {
    super("An Active Measurement Profile Version cannot be revised in place.");
  }
}

export class AmbiguousIngredientMeasurementAlias
  extends IngredientMeasurementProfileError {
  readonly code = "AMBIGUOUS_UNIT_ALIAS" as const;

  constructor(rawValue: string) {
    super(`Measurement alias ${rawValue} resolves to multiple unit codes.`);
  }
}

export class IngredientMeasurementUnitNotAllowed
  extends IngredientMeasurementProfileError {
  readonly code = "UNIT_NOT_ALLOWED_BY_PROFILE" as const;

  constructor(unitCode: string) {
    super(`Measurement unit ${unitCode} is not allowed by this Ingredient Profile.`);
  }
}
