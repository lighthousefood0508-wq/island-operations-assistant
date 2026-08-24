export class RecipeCostHistoryReadValidationFailure extends Error {
  constructor() {
    super("Recipe Cost History identity is invalid.");
    this.name = "RecipeCostHistoryReadValidationFailure";
  }
}

export class RecipeCostHistoryReadNotFound extends Error {
  constructor() {
    super("Recipe Cost History evidence was not found.");
    this.name = "RecipeCostHistoryReadNotFound";
  }
}

export class RecipeCostHistoryReadPersistenceFailure extends Error {
  constructor() {
    super("Recipe Cost History could not be read.");
    this.name = "RecipeCostHistoryReadPersistenceFailure";
  }
}
