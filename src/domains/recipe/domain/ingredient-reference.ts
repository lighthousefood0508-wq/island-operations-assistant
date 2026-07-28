import { InvalidRecipeState } from "./errors.js";
import { IngredientReferenceId } from "./identities.js";
import type { MeasurementDimension } from "./unit.js";

export type IngredientReferenceStatus = "active" | "inactive";

export class IngredientReference {
  private constructor(
    readonly ingredientReferenceId: IngredientReferenceId,
    readonly canonicalName: string,
    readonly measurementDimension: MeasurementDimension,
    readonly status: IngredientReferenceStatus,
    readonly createdAt: string
  ) {
    Object.freeze(this);
  }

  static create(input: {
    ingredientReferenceId: IngredientReferenceId;
    canonicalName: string;
    measurementDimension: MeasurementDimension;
    status?: IngredientReferenceStatus;
    createdAt: string;
  }): IngredientReference {
    const canonicalName = input.canonicalName.trim();
    if (!canonicalName) {
      throw new InvalidRecipeState("Ingredient canonical name is required.");
    }
    if (!input.createdAt.trim()) {
      throw new InvalidRecipeState("Ingredient creation timestamp is required.");
    }
    return new IngredientReference(
      input.ingredientReferenceId,
      canonicalName,
      input.measurementDimension,
      input.status ?? "active",
      input.createdAt
    );
  }
}
