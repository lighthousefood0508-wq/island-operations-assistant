export class IngredientMeasurementProfilePersistenceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "IngredientMeasurementProfilePersistenceError";
  }
}

export class InvalidIngredientMeasurementProfilePersistenceState
extends IngredientMeasurementProfilePersistenceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "InvalidIngredientMeasurementProfilePersistenceState";
  }
}

export class DuplicateIngredientMeasurementProfile
extends IngredientMeasurementProfilePersistenceError {
  constructor(readonly profileId: string, cause?: unknown) {
    super(
      `Ingredient Measurement Profile ${profileId} already exists.`,
      cause === undefined ? undefined : { cause }
    );
    this.name = "DuplicateIngredientMeasurementProfile";
  }
}

export class IngredientMeasurementProfileVersionConflict
extends IngredientMeasurementProfilePersistenceError {
  constructor(
    readonly expectedVersion: number,
    readonly actualVersion: number
  ) {
    super(
      `Ingredient Measurement Profile version conflict: expected ${expectedVersion}, actual ${actualVersion}.`
    );
    this.name = "IngredientMeasurementProfileVersionConflict";
  }
}

export class IngredientMeasurementProfilePersistenceFailure
extends IngredientMeasurementProfilePersistenceError {
  constructor(operation: string, cause: unknown) {
    super(`Failed to ${operation}.`, { cause });
    this.name = "IngredientMeasurementProfilePersistenceFailure";
  }
}
