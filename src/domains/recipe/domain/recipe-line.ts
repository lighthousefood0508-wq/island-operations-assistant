import { InvalidRecipeState } from "./errors.js";
import { IngredientReference } from "./ingredient-reference.js";
import { Quantity } from "./quantity.js";

export class RecipeLine {
  private constructor(
    readonly ingredient: IngredientReference,
    readonly quantity: Quantity
  ) {
    Object.freeze(this);
  }

  static create(ingredient: IngredientReference, quantity: Quantity): RecipeLine {
    if (ingredient.status !== "active") {
      throw new InvalidRecipeState("Inactive Ingredient References cannot be added to a Recipe Draft.");
    }
    if (ingredient.measurementDimension !== quantity.unit.dimension) {
      throw new InvalidRecipeState("Ingredient and Quantity measurement dimensions must match.");
    }
    return new RecipeLine(ingredient, quantity);
  }
}
