import {
  DuplicateIngredient,
  InvalidRecipeState,
  InvalidVersionTransition
} from "./errors.js";
import { IngredientReference } from "./ingredient-reference.js";
import {
  RecipeDraftId,
  RecipeId,
  RecipeVersionId
} from "./identities.js";
import { Quantity } from "./quantity.js";
import { RecipeLine } from "./recipe-line.js";
import type {
  ProductReference,
  RecipePublication,
  RecipeSnapshot,
  RecipeState,
  RecipeSupersession
} from "./types.js";
import { VersionNumber } from "./version-number.js";

export class RecipeAggregate {
  private stateValue: RecipeState = "Draft";
  private nameValue: string;
  private productValue: ProductReference | null = null;
  private readonly linesValue: RecipeLine[] = [];
  private standardOutputValue: Quantity | null = null;
  private standardYieldValue: Quantity | null = null;
  private publicationValue: RecipePublication | null = null;
  private supersessionValue: RecipeSupersession | null = null;

  private constructor(
    readonly recipeId: RecipeId,
    readonly draftId: RecipeDraftId,
    name: string,
    readonly createdBy: string,
    readonly createdAt: string
  ) {
    this.nameValue = name;
  }

  static createDraft(input: {
    recipeId: RecipeId;
    draftId: RecipeDraftId;
    name: string;
    createdBy: string;
    createdAt: string;
  }): RecipeAggregate {
    const name = input.name.trim();
    if (!name || !input.createdBy.trim() || !input.createdAt.trim()) {
      throw new InvalidRecipeState("Recipe Draft requires name, creator, and creation timestamp.");
    }
    return new RecipeAggregate(input.recipeId, input.draftId, name, input.createdBy, input.createdAt);
  }

  get state(): RecipeState {
    return this.stateValue;
  }

  rename(name: string): void {
    this.assertDraft();
    const canonicalName = name.trim();
    if (!canonicalName) {
      throw new InvalidRecipeState("Recipe name is required.");
    }
    this.nameValue = canonicalName;
  }

  bindProduct(productId: string, productVersionId: string): void {
    this.assertDraft();
    if (!productId.trim() || !productVersionId.trim()) {
      throw new InvalidRecipeState("Product and Product Version references are required.");
    }
    this.productValue = Object.freeze({ productId, productVersionId });
  }

  addIngredient(ingredient: IngredientReference, quantity: Quantity): void {
    this.assertDraft();
    if (this.linesValue.some((line) => line.ingredient.ingredientReferenceId.equals(ingredient.ingredientReferenceId))) {
      throw new DuplicateIngredient(ingredient.ingredientReferenceId.value);
    }
    this.linesValue.push(RecipeLine.create(ingredient, quantity));
  }

  defineStandardOutput(standardOutput: Quantity, standardYield: Quantity): void {
    this.assertDraft();
    if (standardYield.unit.dimension !== "count") {
      throw new InvalidRecipeState("Standard Yield must use a count-dimension Unit.");
    }
    this.standardOutputValue = standardOutput;
    this.standardYieldValue = standardYield;
  }

  publish(input: {
    recipeVersionId: RecipeVersionId;
    versionNumber: VersionNumber;
    publishedBy: string;
    publishedAt: string;
  }): void {
    if (this.stateValue !== "Draft") {
      throw new InvalidVersionTransition(this.stateValue, "Published");
    }
    if (!this.productValue) {
      throw new InvalidRecipeState("A Recipe Draft must be bound to Product and Product Version before publication.");
    }
    if (this.linesValue.length === 0) {
      throw new InvalidRecipeState("A Recipe Draft requires at least one Ingredient Line before publication.");
    }
    if (!this.standardOutputValue || !this.standardYieldValue) {
      throw new InvalidRecipeState("Standard Output and Standard Yield are required before publication.");
    }
    if (!input.publishedBy.trim() || !input.publishedAt.trim()) {
      throw new InvalidRecipeState("Publication actor and timestamp are required.");
    }
    this.publicationValue = Object.freeze({ ...input });
    this.stateValue = "Published";
  }

  supersede(input: {
    supersededByRecipeVersionId: RecipeVersionId;
    supersededBy: string;
    supersededAt: string;
    reason: string;
  }): void {
    if (this.stateValue !== "Published") {
      throw new InvalidVersionTransition(this.stateValue, "Superseded");
    }
    if (
      input.supersededByRecipeVersionId.equals(this.publicationValue!.recipeVersionId) ||
      !input.supersededBy.trim() ||
      !input.supersededAt.trim() ||
      !input.reason.trim()
    ) {
      throw new InvalidRecipeState("Supersession requires a different Version, actor, timestamp, and reason.");
    }
    this.supersessionValue = Object.freeze({ ...input });
    this.stateValue = "Superseded";
  }

  snapshot(): RecipeSnapshot {
    return Object.freeze({
      recipeId: this.recipeId,
      draftId: this.draftId,
      name: this.nameValue,
      state: this.stateValue,
      product: this.productValue,
      lines: Object.freeze([...this.linesValue]),
      standardOutput: this.standardOutputValue,
      standardYield: this.standardYieldValue,
      publication: this.publicationValue,
      supersession: this.supersessionValue,
      createdBy: this.createdBy,
      createdAt: this.createdAt
    });
  }

  private assertDraft(): void {
    if (this.stateValue !== "Draft") {
      throw new InvalidRecipeState(`Recipe ${this.recipeId.value} is ${this.stateValue} and cannot be edited.`);
    }
  }
}
