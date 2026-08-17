type IngredientMeasurementProfileDeprecationErrorCode =
  | "INGREDIENT_MEASUREMENT_PROFILE_DEPRECATION_INVALID"
  | "INGREDIENT_MEASUREMENT_PROFILE_DEPRECATION_NOT_FOUND"
  | "INGREDIENT_MEASUREMENT_PROFILE_DEPRECATION_INGREDIENT_INACTIVE"
  | "INGREDIENT_MEASUREMENT_PROFILE_DEPRECATION_EXPECTED_VERSION_CONFLICT"
  | "INGREDIENT_MEASUREMENT_PROFILE_DEPRECATION_PERSISTENCE_FAILURE";

abstract class IngredientMeasurementProfileDeprecationError extends Error {
  abstract readonly code: IngredientMeasurementProfileDeprecationErrorCode;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class IngredientMeasurementProfileDeprecationValidationFailure
extends IngredientMeasurementProfileDeprecationError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_DEPRECATION_INVALID" as const;

  constructor() {
    super("Measurement Profile deprecation command is not valid for the current Profile state.");
  }
}

export class IngredientMeasurementProfileDeprecationNotFound
extends IngredientMeasurementProfileDeprecationError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_DEPRECATION_NOT_FOUND" as const;

  constructor() {
    super("Ingredient Measurement Profile was not found.");
  }
}

export class IngredientMeasurementProfileDeprecationIngredientInactive
extends IngredientMeasurementProfileDeprecationError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_DEPRECATION_INGREDIENT_INACTIVE" as const;

  constructor() {
    super("Canonical Ingredient must be Active to deprecate its Measurement Profile.");
  }
}

export class IngredientMeasurementProfileDeprecationExpectedVersionConflict
extends IngredientMeasurementProfileDeprecationError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_DEPRECATION_EXPECTED_VERSION_CONFLICT" as const;

  constructor() {
    super("Measurement Profile changed before deprecation could be persisted.");
  }
}

export class IngredientMeasurementProfileDeprecationPersistenceFailure
extends IngredientMeasurementProfileDeprecationError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_DEPRECATION_PERSISTENCE_FAILURE" as const;

  constructor() {
    super("Measurement Profile deprecation could not be persisted.");
  }
}
