type IngredientMeasurementProfileCreationErrorCode =
  | "INGREDIENT_MEASUREMENT_PROFILE_CREATION_VALIDATION_FAILURE"
  | "INGREDIENT_MEASUREMENT_PROFILE_CREATION_INGREDIENT_NOT_FOUND"
  | "INGREDIENT_MEASUREMENT_PROFILE_CREATION_INGREDIENT_INACTIVE"
  | "INGREDIENT_MEASUREMENT_PROFILE_CREATION_MEASUREMENT_FAILURE"
  | "INGREDIENT_MEASUREMENT_PROFILE_CREATION_PERSISTENCE_FAILURE";

abstract class IngredientMeasurementProfileCreationError extends Error {
  abstract readonly code: IngredientMeasurementProfileCreationErrorCode;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class IngredientMeasurementProfileCreationValidationFailure
extends IngredientMeasurementProfileCreationError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_CREATION_VALIDATION_FAILURE" as const;

  constructor() {
    super("Measurement Profile creation command validation failed.");
  }
}

export class IngredientMeasurementProfileCreationIngredientNotFound
extends IngredientMeasurementProfileCreationError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_CREATION_INGREDIENT_NOT_FOUND" as const;

  constructor() {
    super("Canonical Ingredient was not found.");
  }
}

export class IngredientMeasurementProfileCreationIngredientInactive
extends IngredientMeasurementProfileCreationError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_CREATION_INGREDIENT_INACTIVE" as const;

  constructor() {
    super("Canonical Ingredient must be Active.");
  }
}

export class IngredientMeasurementProfileCreationMeasurementFailure
extends IngredientMeasurementProfileCreationError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_CREATION_MEASUREMENT_FAILURE" as const;

  constructor() {
    super("Measurement Profile facts could not be resolved.");
  }
}

export class IngredientMeasurementProfileCreationPersistenceFailure
extends IngredientMeasurementProfileCreationError {
  readonly code = "INGREDIENT_MEASUREMENT_PROFILE_CREATION_PERSISTENCE_FAILURE" as const;

  constructor() {
    super("Measurement Profile creation could not be persisted.");
  }
}
