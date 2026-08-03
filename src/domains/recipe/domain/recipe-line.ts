import { InvalidRecipeLine } from "./errors.js";
import { IngredientReference } from "./ingredient-reference.js";
import { RecipeLineId } from "./identities.js";
import { Quantity } from "./quantity.js";

export class RecipeLine {
  private constructor(
    readonly recipeLineId: RecipeLineId,
    readonly linePosition: number,
    readonly ingredient: IngredientReference,
    readonly quantity: Quantity,
    readonly preparationNote: string | null
  ) {
    Object.freeze(this);
  }

  static create(input: {
    recipeLineId: RecipeLineId;
    linePosition: number;
    ingredient: IngredientReference;
    quantity: Quantity;
    preparationNote?: string | null;
  }): RecipeLine {
    if (!Number.isSafeInteger(input.linePosition) || input.linePosition < 0) {
      throw new InvalidRecipeLine("Recipe Line position must be a non-negative safe integer.");
    }
    const preparationNote = RecipeLine.normalizeNote(input.preparationNote);
    RecipeLine.validateFacts(input.ingredient, input.quantity);
    return new RecipeLine(
      input.recipeLineId,
      input.linePosition,
      input.ingredient,
      input.quantity,
      preparationNote
    );
  }

  update(input: {
    ingredient?: IngredientReference;
    quantity?: Quantity;
    preparationNote?: string | null;
  }): RecipeLine {
    const ingredient = input.ingredient ?? this.ingredient;
    const quantity = input.quantity ?? this.quantity;
    RecipeLine.validateFacts(ingredient, quantity);
    return new RecipeLine(
      this.recipeLineId,
      this.linePosition,
      ingredient,
      quantity,
      input.preparationNote === undefined
        ? this.preparationNote
        : RecipeLine.normalizeNote(input.preparationNote)
    );
  }

  moveTo(linePosition: number): RecipeLine {
    if (!Number.isSafeInteger(linePosition) || linePosition < 0) {
      throw new InvalidRecipeLine("Recipe Line position must be a non-negative safe integer.");
    }
    return new RecipeLine(
      this.recipeLineId,
      linePosition,
      this.ingredient,
      this.quantity,
      this.preparationNote
    );
  }

  private static validateFacts(
    ingredient: IngredientReference,
    quantity: Quantity
  ): void {
    if (ingredient.status !== "active") {
      throw new InvalidRecipeLine("Inactive Ingredient References cannot be added to a Recipe Draft.");
    }
    if (ingredient.measurementDimension !== quantity.unit.dimension) {
      throw new InvalidRecipeLine("Ingredient and Quantity measurement dimensions must match.");
    }
  }

  private static normalizeNote(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const note = value.trim();
    return note || null;
  }
}
