import type {
  PublishedExactQuantity,
  PublishedRecipeSnapshot
} from "./published-recipe-snapshot.js";

export type RecipeSnapshotDifferenceKind =
  | "ingredient_added"
  | "ingredient_removed"
  | "ingredient_changed"
  | "quantity_changed"
  | "unit_changed"
  | "line_position_changed"
  | "preparation_note_changed"
  | "instructions_changed"
  | "standard_yield_changed"
  | "standard_output_changed";

export type RecipeSnapshotDifference = Readonly<{
  kind: RecipeSnapshotDifferenceKind;
  recipeLineId: string | null;
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
    const leftLines = new Map(left.lines.map((line) => [line.recipeLineId, line]));
    const rightLines = new Map(right.lines.map((line) => [line.recipeLineId, line]));
    const recipeLineIds = [...new Set([...leftLines.keys(), ...rightLines.keys()])].sort();

    for (const recipeLineId of recipeLineIds) {
      const before = leftLines.get(recipeLineId);
      const after = rightLines.get(recipeLineId);
      if (!before) {
        differences.push(Object.freeze({
          kind: "ingredient_added",
          recipeLineId,
          ingredientReferenceId: after!.ingredient.ingredientReferenceId,
          before: null,
          after: after!.ingredient.ingredientReferenceId
        }));
        continue;
      }
      if (!after) {
        differences.push(Object.freeze({
          kind: "ingredient_removed",
          recipeLineId,
          ingredientReferenceId: before.ingredient.ingredientReferenceId,
          before: before.ingredient.ingredientReferenceId,
          after: null
        }));
        continue;
      }
      const ingredientReferenceId = after.ingredient.ingredientReferenceId;
      if (before.ingredient.ingredientReferenceId !== ingredientReferenceId) {
        differences.push(Object.freeze({
          kind: "ingredient_changed",
          recipeLineId,
          ingredientReferenceId,
          before: before.ingredient.ingredientReferenceId,
          after: ingredientReferenceId
        }));
      }
      if (!sameQuantity(before.quantity, after.quantity)) {
        differences.push(Object.freeze({
          kind: "quantity_changed",
          recipeLineId,
          ingredientReferenceId,
          before: quantityValue(before.quantity),
          after: quantityValue(after.quantity)
        }));
      }
      if (!sameUnit(before.quantity, after.quantity)) {
        differences.push(Object.freeze({
          kind: "unit_changed",
          recipeLineId,
          ingredientReferenceId,
          before: unitValue(before.quantity),
          after: unitValue(after.quantity)
        }));
      }
      if (before.linePosition !== after.linePosition) {
        differences.push(Object.freeze({
          kind: "line_position_changed",
          recipeLineId,
          ingredientReferenceId,
          before: before.linePosition.toString(),
          after: after.linePosition.toString()
        }));
      }
      if (before.preparationNote !== after.preparationNote) {
        differences.push(Object.freeze({
          kind: "preparation_note_changed",
          recipeLineId,
          ingredientReferenceId,
          before: before.preparationNote,
          after: after.preparationNote
        }));
      }
    }

    if (left.instructions !== right.instructions) {
      differences.push(Object.freeze({
        kind: "instructions_changed",
        recipeLineId: null,
        ingredientReferenceId: null,
        before: left.instructions,
        after: right.instructions
      }));
    }

    if (
      !sameQuantity(left.standardYield, right.standardYield) ||
      !sameUnit(left.standardYield, right.standardYield)
    ) {
      differences.push(Object.freeze({
        kind: "standard_yield_changed",
        recipeLineId: null,
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
        recipeLineId: null,
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
