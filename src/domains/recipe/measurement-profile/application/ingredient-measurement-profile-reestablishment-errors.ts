type ReestablishmentErrorCode =
  | "INGREDIENT_MEASUREMENT_PROFILE_REESTABLISHMENT_INVALID"
  | "INGREDIENT_MEASUREMENT_PROFILE_REESTABLISHMENT_NOT_FOUND"
  | "INGREDIENT_MEASUREMENT_PROFILE_REESTABLISHMENT_INGREDIENT_INACTIVE"
  | "INGREDIENT_MEASUREMENT_PROFILE_REESTABLISHMENT_EXPECTED_VERSION_CONFLICT"
  | "INGREDIENT_MEASUREMENT_PROFILE_REESTABLISHMENT_MEASUREMENT_FAILURE"
  | "INGREDIENT_MEASUREMENT_PROFILE_REESTABLISHMENT_PERSISTENCE_FAILURE";

abstract class IngredientMeasurementProfileReestablishmentError extends Error {
  abstract readonly code: ReestablishmentErrorCode;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class IngredientMeasurementProfileReestablishmentValidationFailure
extends IngredientMeasurementProfileReestablishmentError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_REESTABLISHMENT_INVALID" as const;
  constructor() { super("Measurement Profile re-establishment command is not valid for the current Profile state."); }
}

export class IngredientMeasurementProfileReestablishmentNotFound
extends IngredientMeasurementProfileReestablishmentError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_REESTABLISHMENT_NOT_FOUND" as const;
  constructor() { super("Ingredient Measurement Profile or Draft Version was not found."); }
}

export class IngredientMeasurementProfileReestablishmentIngredientInactive
extends IngredientMeasurementProfileReestablishmentError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_REESTABLISHMENT_INGREDIENT_INACTIVE" as const;
  constructor() { super("Canonical Ingredient must be Active to re-establish its Measurement Profile."); }
}

export class IngredientMeasurementProfileReestablishmentExpectedVersionConflict
extends IngredientMeasurementProfileReestablishmentError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_REESTABLISHMENT_EXPECTED_VERSION_CONFLICT" as const;
  constructor() { super("Measurement Profile changed before re-establishment could be persisted."); }
}

export class IngredientMeasurementProfileReestablishmentMeasurementFailure
extends IngredientMeasurementProfileReestablishmentError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_REESTABLISHMENT_MEASUREMENT_FAILURE" as const;
  constructor() { super("Measurement Profile facts could not be resolved."); }
}

export class IngredientMeasurementProfileReestablishmentPersistenceFailure
extends IngredientMeasurementProfileReestablishmentError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_REESTABLISHMENT_PERSISTENCE_FAILURE" as const;
  constructor() { super("Measurement Profile re-establishment could not be persisted."); }
}
