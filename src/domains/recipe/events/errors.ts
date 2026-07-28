export class InvalidRecipeEvent extends Error {
  readonly code = "INVALID_RECIPE_EVENT";

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class RecipeEventAlreadyConsumed extends Error {
  readonly code = "RECIPE_EVENT_ALREADY_CONSUMED";

  constructor() {
    super("Recipe Domain Events have already been drained.");
    this.name = new.target.name;
  }
}
