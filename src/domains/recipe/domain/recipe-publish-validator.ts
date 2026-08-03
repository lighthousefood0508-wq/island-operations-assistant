import {
  InvalidPublishState,
  PublishValidationFailed,
  RecipeDraftAbandoned
} from "./errors.js";
import type { RecipeAggregate } from "./recipe-aggregate.js";
import type { VersionNumber } from "./version-number.js";

const UNIT_CODE_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;

export class RecipePublishValidator {
  validate(aggregate: RecipeAggregate, versionNumber: VersionNumber): void {
    const snapshot = aggregate.snapshot();
    if (snapshot.state === "Abandoned") {
      throw new RecipeDraftAbandoned(snapshot.draftId.value);
    }
    if (snapshot.state !== "Draft") {
      throw new InvalidPublishState(snapshot.state);
    }

    const issues: string[] = [];
    if (!snapshot.product?.productId || !snapshot.product.productVersionId) {
      issues.push("Product and Product Version are required");
    }
    if (snapshot.lines.length === 0) {
      issues.push("at least one Ingredient Line is required");
    }

    for (const line of snapshot.lines) {
      const ingredientId = line.ingredient.ingredientReferenceId.value;
      if (line.ingredient.status !== "active") {
        issues.push(`Ingredient ${ingredientId} is inactive`);
      }
      if (
        line.quantity.coefficient <= 0n ||
        !Number.isInteger(line.quantity.scale) ||
        line.quantity.scale < 0 ||
        line.quantity.scale > 6
      ) {
        issues.push(`Ingredient ${ingredientId} Quantity is invalid`);
      }
      if (
        !UNIT_CODE_PATTERN.test(line.quantity.unit.code) ||
        line.quantity.unit.dimension !== line.ingredient.measurementDimension
      ) {
        issues.push(`Ingredient ${ingredientId} Unit is invalid`);
      }
    }

    if (!snapshot.standardOutput || snapshot.standardOutput.coefficient <= 0n) {
      issues.push("Standard Output is required and must be positive");
    }
    if (
      !snapshot.standardYield ||
      snapshot.standardYield.coefficient <= 0n ||
      snapshot.standardYield.unit.dimension !== "count"
    ) {
      issues.push("Standard Yield is required, positive, and count-based");
    }
    if (!Number.isSafeInteger(versionNumber.value) || versionNumber.value < 1) {
      issues.push("Version Number must be a positive safe integer");
    }

    if (issues.length > 0) {
      throw new PublishValidationFailed(issues);
    }
  }
}
