export class RecipeCostAnalyticsValidationFailure extends Error {
  constructor() {
    super("Recipe Cost Analytics identity is invalid.");
    this.name = "RecipeCostAnalyticsValidationFailure";
  }
}

export class RecipeCostAnalyticsReadFailure extends Error {
  constructor() {
    super("Recipe Cost Analytics could not be read.");
    this.name = "RecipeCostAnalyticsReadFailure";
  }
}
