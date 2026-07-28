import {
  InvalidPublishState,
  SnapshotImmutableViolation
} from "./errors.js";
import type { IngredientReferenceStatus } from "./ingredient-reference.js";
import type { RecipeAggregate } from "./recipe-aggregate.js";
import type { MeasurementDimension } from "./unit.js";

export type PublishedExactQuantity = Readonly<{
  coefficient: string;
  scale: number;
  unit: Readonly<{
    code: string;
    dimension: MeasurementDimension;
  }>;
}>;

export type PublishedRecipeLineSnapshot = Readonly<{
  ingredient: Readonly<{
    ingredientReferenceId: string;
    canonicalName: string;
    measurementDimension: MeasurementDimension;
    status: IngredientReferenceStatus;
    createdAt: string;
  }>;
  quantity: PublishedExactQuantity;
}>;

export type PublishedRecipeSnapshot = Readonly<{
  recipeId: string;
  sourceDraftId: string;
  recipeVersionId: string;
  versionNumber: number;
  state: "Published" | "Superseded";
  name: string;
  product: Readonly<{
    productId: string;
    productVersionId: string;
  }>;
  lines: readonly PublishedRecipeLineSnapshot[];
  standardOutput: PublishedExactQuantity;
  standardYield: PublishedExactQuantity;
  publishedBy: string;
  publishedAt: string;
  supersession: Readonly<{
    supersededByRecipeVersionId: string;
    supersededBy: string;
    supersededAt: string;
    reason: string;
  }> | null;
}>;

function freezeQuantity(
  quantity: ReturnType<RecipeAggregate["snapshot"]>["standardOutput"] & object
): PublishedExactQuantity {
  const value = quantity as NonNullable<ReturnType<RecipeAggregate["snapshot"]>["standardOutput"]>;
  return Object.freeze({
    coefficient: value.coefficient.toString(),
    scale: value.scale,
    unit: Object.freeze({
      code: value.unit.code,
      dimension: value.unit.dimension
    })
  });
}

function isQuantityFrozen(quantity: PublishedExactQuantity): boolean {
  return Object.isFrozen(quantity) && Object.isFrozen(quantity.unit);
}

export class RecipeSnapshotBuilder {
  build(aggregate: RecipeAggregate): PublishedRecipeSnapshot {
    const source = aggregate.snapshot();
    if (
      (source.state !== "Published" && source.state !== "Superseded") ||
      !source.product ||
      !source.publication ||
      !source.standardOutput ||
      !source.standardYield
    ) {
      throw new InvalidPublishState(source.state);
    }

    const lines = source.lines.map((line) => Object.freeze({
      ingredient: Object.freeze({
        ingredientReferenceId: line.ingredient.ingredientReferenceId.value,
        canonicalName: line.ingredient.canonicalName,
        measurementDimension: line.ingredient.measurementDimension,
        status: line.ingredient.status,
        createdAt: line.ingredient.createdAt
      }),
      quantity: freezeQuantity(line.quantity)
    }));

    const snapshot: PublishedRecipeSnapshot = Object.freeze({
      recipeId: source.recipeId.value,
      sourceDraftId: source.draftId.value,
      recipeVersionId: source.publication.recipeVersionId.value,
      versionNumber: source.publication.versionNumber.value,
      state: source.state,
      name: source.name,
      product: Object.freeze({ ...source.product }),
      lines: Object.freeze(lines),
      standardOutput: freezeQuantity(source.standardOutput),
      standardYield: freezeQuantity(source.standardYield),
      publishedBy: source.publication.publishedBy,
      publishedAt: source.publication.publishedAt,
      supersession: source.supersession
        ? Object.freeze({
            supersededByRecipeVersionId: source.supersession.supersededByRecipeVersionId.value,
            supersededBy: source.supersession.supersededBy,
            supersededAt: source.supersession.supersededAt,
            reason: source.supersession.reason
          })
        : null
    });
    this.assertImmutable(snapshot);
    return snapshot;
  }

  assertImmutable(snapshot: PublishedRecipeSnapshot): void {
    const immutable =
      Object.isFrozen(snapshot) &&
      Object.isFrozen(snapshot.product) &&
      Object.isFrozen(snapshot.lines) &&
      snapshot.lines.every((line) =>
        Object.isFrozen(line) &&
        Object.isFrozen(line.ingredient) &&
        isQuantityFrozen(line.quantity)
      ) &&
      isQuantityFrozen(snapshot.standardOutput) &&
      isQuantityFrozen(snapshot.standardYield) &&
      (snapshot.supersession === null || Object.isFrozen(snapshot.supersession));
    if (!immutable) {
      throw new SnapshotImmutableViolation();
    }
  }
}
