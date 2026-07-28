import type {
  PublishedExactQuantity,
  PublishedRecipeSnapshot
} from "./published-recipe-snapshot.js";

export type RecipeSnapshotDifferenceKind =
  | "ingredient_added"
  | "ingredient_removed"
  | "quantity_changed"
  | "unit_changed"
  | "standard_yield_changed"
  | "standard_output_changed";

export type RecipeSnapshotDifference = Readonly<{
  kind: RecipeSnapshotDifferenceKind;
  ingredientReferenceId: string | null;
  before: string | null;
  after: string | null;
}>;

export type RecipeSnapshotDifferenceReport = Readonly<{
  equal: boolean;
  differences: readonly RecipeSnapshotDifference[];
}>;

function quantityValue(quantity: PublishedExactQuantity): string {
  return `${quantity.coefficient}e-${quantity.scale}`;
}

function unitValue(quantity: PublishedExactQuantity): string {
  return `${quantity.unit.code}:${quantity.unit.dimension}`;
}

function sameQuantity(left: PublishedExactQuantity, right: PublishedExactQuantity): boolean {
  return quantityValue(left) === quantityValue(right);
}

function sameUnit(left: PublishedExactQuantity, right: PublishedExactQuantity): boolean {
  return unitValue(left) === unitValue(right);
}

export class RecipeSnapshotComparator {
  compare(
    left: PublishedRecipeSnapshot,
    right: PublishedRecipeSnapshot
  ): RecipeSnapshotDifferenceReport {
    const differences: RecipeSnapshotDifference[] = [];
    const leftLines = new Map(left.lines.map((line) => [line.ingredient.ingredientReferenceId, line]));
    const rightLines = new Map(right.lines.map((line) => [line.ingredient.ingredientReferenceId, line]));
    const ingredientIds = [...new Set([...leftLines.keys(), ...rightLines.keys()])].sort();

    for (const ingredientReferenceId of ingredientIds) {
      const before = leftLines.get(ingredientReferenceId);
      const after = rightLines.get(ingredientReferenceId);
      if (!before) {
        differences.push(Object.freeze({
          kind: "ingredient_added",
          ingredientReferenceId,
          before: null,
          after: ingredientReferenceId
        }));
        continue;
      }
      if (!after) {
        differences.push(Object.freeze({
          kind: "ingredient_removed",
          ingredientReferenceId,
          before: ingredientReferenceId,
          after: null
        }));
        continue;
      }
      if (!sameQuantity(before.quantity, after.quantity)) {
        differences.push(Object.freeze({
          kind: "quantity_changed",
          ingredientReferenceId,
          before: quantityValue(before.quantity),
          after: quantityValue(after.quantity)
        }));
      }
      if (!sameUnit(before.quantity, after.quantity)) {
        differences.push(Object.freeze({
          kind: "unit_changed",
          ingredientReferenceId,
          before: unitValue(before.quantity),
          after: unitValue(after.quantity)
        }));
      }
    }

    if (
      !sameQuantity(left.standardYield, right.standardYield) ||
      !sameUnit(left.standardYield, right.standardYield)
    ) {
      differences.push(Object.freeze({
        kind: "standard_yield_changed",
        ingredientReferenceId: null,
        before: `${quantityValue(left.standardYield)}:${unitValue(left.standardYield)}`,
        after: `${quantityValue(right.standardYield)}:${unitValue(right.standardYield)}`
      }));
    }
    if (
      !sameQuantity(left.standardOutput, right.standardOutput) ||
      !sameUnit(left.standardOutput, right.standardOutput)
    ) {
      differences.push(Object.freeze({
        kind: "standard_output_changed",
        ingredientReferenceId: null,
        before: `${quantityValue(left.standardOutput)}:${unitValue(left.standardOutput)}`,
        after: `${quantityValue(right.standardOutput)}:${unitValue(right.standardOutput)}`
      }));
    }

    return Object.freeze({
      equal: differences.length === 0,
      differences: Object.freeze(differences)
    });
  }
}
