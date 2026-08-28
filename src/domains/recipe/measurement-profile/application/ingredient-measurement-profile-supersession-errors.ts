type IngredientMeasurementProfileSupersessionErrorCode =
  | "INGREDIENT_MEASUREMENT_PROFILE_SUPERSESSION_INVALID"
  | "INGREDIENT_MEASUREMENT_PROFILE_SUPERSESSION_NOT_FOUND"
  | "INGREDIENT_MEASUREMENT_PROFILE_SUPERSESSION_INGREDIENT_INACTIVE"
  | "INGREDIENT_MEASUREMENT_PROFILE_SUPERSESSION_EXPECTED_VERSION_CONFLICT"
  | "INGREDIENT_MEASUREMENT_PROFILE_SUPERSESSION_MEASUREMENT_FAILURE"
  | "INGREDIENT_MEASUREMENT_PROFILE_SUPERSESSION_NO_CHANGE"
  | "INGREDIENT_MEASUREMENT_PROFILE_SUPERSESSION_REFERENCED"
  | "INGREDIENT_MEASUREMENT_PROFILE_SUPERSESSION_PERSISTENCE_FAILURE";

abstract class IngredientMeasurementProfileSupersessionError extends Error {
  abstract readonly code: IngredientMeasurementProfileSupersessionErrorCode;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class IngredientMeasurementProfileSupersessionValidationFailure
extends IngredientMeasurementProfileSupersessionError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_SUPERSESSION_INVALID" as const;

  constructor() {
    super("Measurement Profile supersession command is not valid for the current Profile state.");
  }
}

export class IngredientMeasurementProfileSupersessionNotFound
extends IngredientMeasurementProfileSupersessionError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_SUPERSESSION_NOT_FOUND" as const;

  constructor() {
    super("Ingredient Measurement Profile was not found.");
  }
}

export class IngredientMeasurementProfileSupersessionIngredientInactive
extends IngredientMeasurementProfileSupersessionError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_SUPERSESSION_INGREDIENT_INACTIVE" as const;

  constructor() {
    super("Canonical Ingredient must be Active to supersede its Measurement Profile.");
  }
}

export class IngredientMeasurementProfileSupersessionExpectedVersionConflict
extends IngredientMeasurementProfileSupersessionError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_SUPERSESSION_EXPECTED_VERSION_CONFLICT" as const;

  constructor() {
    super("Measurement Profile changed before supersession could be persisted.");
  }
}

export class IngredientMeasurementProfileSupersessionMeasurementFailure
extends IngredientMeasurementProfileSupersessionError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_SUPERSESSION_MEASUREMENT_FAILURE" as const;

  constructor() {
    super("Replacement Measurement Profile facts could not be resolved.");
  }
}

export class IngredientMeasurementProfileSupersessionNoChange
extends IngredientMeasurementProfileSupersessionError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_SUPERSESSION_NO_CHANGE" as const;

  constructor() {
    super("量測設定沒有變更，未建立新版本。");
  }
}

export class IngredientMeasurementProfileSupersessionReferenced
extends IngredientMeasurementProfileSupersessionError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_SUPERSESSION_REFERENCED" as const;

  constructor() {
    super("Measurement basis cannot be changed while the Ingredient is referenced.");
  }
}

export class IngredientMeasurementProfileSupersessionPersistenceFailure
extends IngredientMeasurementProfileSupersessionError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_SUPERSESSION_PERSISTENCE_FAILURE" as const;

  constructor() {
    super("Measurement Profile supersession could not be persisted.");
  }
}
