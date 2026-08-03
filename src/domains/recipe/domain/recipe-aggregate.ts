import {
  InvalidRecipeLineOrder,
  InvalidRecipeState,
  InvalidVersionTransition,
  RecipeAlreadyAbandoned,
  RecipeDraftAbandoned,
  RecipeInvalidTransition,
  RecipeLineIdentityCollision,
  RecipeLineNotFound,
  RecipeProductBindingConflict
} from "./errors.js";
import { IngredientReference } from "./ingredient-reference.js";
import {
  RecipeDraftId,
  RecipeFamilyId,
  RecipeId,
  RecipeLineId,
  RecipeVersionId
} from "./identities.js";
import { Quantity } from "./quantity.js";
import { RecipeLine } from "./recipe-line.js";
import type {
  ProductReference,
  RecipeAbandonment,
  RecipePublication,
  RecipeSnapshot,
  RecipeState,
  RecipeSupersession
} from "./types.js";
import { VersionNumber } from "./version-number.js";

function familyIdFromRecipeId(recipeId: RecipeId): RecipeFamilyId {
  return RecipeFamilyId.fromUuid(recipeId.value.slice("recipe_".length));
}

function legacyLineId(ingredient: IngredientReference): RecipeLineId {
  return RecipeLineId.fromUuid(
    ingredient.ingredientReferenceId.value.slice("ing_".length)
  );
}

function normalizeInstructions(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const instructions = value.trim();
  return instructions || null;
}

export class RecipeAggregate {
  private stateValue: RecipeState = "Draft";
  private nameValue: string;
  private productValue: ProductReference | null = null;
  private linesValue: RecipeLine[] = [];
  private standardOutputValue: Quantity | null = null;
  private standardYieldValue: Quantity | null = null;
  private publicationValue: RecipePublication | null = null;
  private supersessionValue: RecipeSupersession | null = null;
  private abandonmentValue: RecipeAbandonment | null = null;
  private instructionsValue: string | null = null;

  private constructor(
    readonly recipeFamilyId: RecipeFamilyId,
    readonly recipeId: RecipeId,
    readonly draftId: RecipeDraftId,
    name: string,
    readonly createdBy: string,
    readonly createdAt: string
  ) {
    this.nameValue = name;
  }

  static createDraft(input: {
    recipeFamilyId?: RecipeFamilyId;
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
    return new RecipeAggregate(
      input.recipeFamilyId ?? familyIdFromRecipeId(input.recipeId),
      input.recipeId,
      input.draftId,
      name,
      input.createdBy,
      input.createdAt
    );
  }

  get state(): RecipeState {
    return this.stateValue;
  }

  rename(name: string): void {
    this.assertEditableDraft();
    const canonicalName = name.trim();
    if (!canonicalName) {
      throw new InvalidRecipeState("Recipe name is required.");
    }
    this.nameValue = canonicalName;
  }

  bindProduct(productId: string, productVersionId: string): void {
    this.assertEditableDraft();
    const canonicalProductId = productId.trim();
    const canonicalProductVersionId = productVersionId.trim();
    if (!canonicalProductId || !canonicalProductVersionId) {
      throw new InvalidRecipeState("Product and Product Version references are required.");
    }
    if (this.productValue && this.productValue.productId !== canonicalProductId) {
      throw new RecipeProductBindingConflict(
        this.productValue.productId,
        canonicalProductId
      );
    }
    this.productValue = Object.freeze({
      productId: canonicalProductId,
      productVersionId: canonicalProductVersionId
    });
  }

  addLine(input: {
    recipeLineId: RecipeLineId;
    ingredient: IngredientReference;
    quantity: Quantity;
    preparationNote?: string | null;
  }): RecipeLineId {
    this.assertEditableDraft();
    if (this.lineIndex(input.recipeLineId) >= 0) {
      throw new RecipeLineIdentityCollision(input.recipeLineId.value);
    }
    this.linesValue.push(RecipeLine.create({
      recipeLineId: input.recipeLineId,
      linePosition: this.linesValue.length,
      ingredient: input.ingredient,
      quantity: input.quantity,
      preparationNote: input.preparationNote
    }));
    return input.recipeLineId;
  }

  /**
   * Compatibility entry point for existing pre-001A Application/Persistence
   * code. New commands must call addLine with an Application-issued Line ID.
   */
  addIngredient(
    ingredient: IngredientReference,
    quantity: Quantity,
    recipeLineId: RecipeLineId = legacyLineId(ingredient)
  ): RecipeLineId {
    this.assertEditableDraft();
    return this.addLine({ recipeLineId, ingredient, quantity });
  }

  updateLine(input: {
    recipeLineId: RecipeLineId;
    ingredient?: IngredientReference;
    quantity?: Quantity;
    preparationNote?: string | null;
  }): void {
    this.assertEditableDraft();
    const index = this.requireLineIndex(input.recipeLineId);
    this.linesValue[index] = this.linesValue[index]!.update(input);
  }

  removeLine(recipeLineId: RecipeLineId): void {
    this.assertEditableDraft();
    const index = this.requireLineIndex(recipeLineId);
    const next = this.linesValue.filter((_, current) => current !== index);
    this.linesValue = next.map((line, position) => line.moveTo(position));
  }

  moveLine(recipeLineId: RecipeLineId, newPosition: number): void {
    this.assertEditableDraft();
    if (
      !Number.isSafeInteger(newPosition) ||
      newPosition < 0 ||
      newPosition >= this.linesValue.length
    ) {
      throw new InvalidRecipeLineOrder("Recipe Line target position is outside the Draft.");
    }
    const order = this.linesValue.map((line) => line.recipeLineId);
    const currentPosition = this.requireLineIndex(recipeLineId);
    order.splice(currentPosition, 1);
    order.splice(newPosition, 0, recipeLineId);
    this.reorderLines(order);
  }

  reorderLines(recipeLineIds: readonly RecipeLineId[]): void {
    this.assertEditableDraft();
    if (recipeLineIds.length !== this.linesValue.length) {
      throw new InvalidRecipeLineOrder("Reorder must contain every Recipe Line exactly once.");
    }
    const requested = new Set(recipeLineIds.map((id) => id.value));
    if (requested.size !== recipeLineIds.length) {
      throw new InvalidRecipeLineOrder("Reorder contains a duplicate Recipe Line identity.");
    }
    const byId = new Map(this.linesValue.map((line) => [line.recipeLineId.value, line]));
    if (recipeLineIds.some((id) => !byId.has(id.value))) {
      throw new InvalidRecipeLineOrder("Reorder contains a foreign Recipe Line identity.");
    }
    this.linesValue = recipeLineIds.map((id, position) =>
      byId.get(id.value)!.moveTo(position)
    );
  }

  setInstructions(instructions: string | null): void {
    this.assertEditableDraft();
    this.instructionsValue = normalizeInstructions(instructions);
  }

  defineStandardOutput(standardOutput: Quantity, standardYield: Quantity): void {
    this.assertEditableDraft();
    if (standardYield.unit.dimension !== "count") {
      throw new InvalidRecipeState("Standard Yield must use a count-dimension Unit.");
    }
    this.standardOutputValue = standardOutput;
    this.standardYieldValue = standardYield;
  }

  abandon(input: {
    actor: string;
    occurredAt: string;
    reason: string;
    previousAggregateVersion: number;
  }): RecipeAbandonment {
    if (this.stateValue === "Abandoned") {
      throw new RecipeAlreadyAbandoned(this.draftId.value);
    }
    if (this.stateValue !== "Draft") {
      throw new RecipeInvalidTransition(this.stateValue, "Abandoned");
    }
    const actor = input.actor.trim();
    const occurredAt = input.occurredAt.trim();
    const reason = input.reason.trim();
    if (
      !actor ||
      !occurredAt ||
      !reason ||
      !Number.isSafeInteger(input.previousAggregateVersion) ||
      input.previousAggregateVersion < 0
    ) {
      throw new InvalidRecipeState(
        "Abandonment requires actor, occurredAt, reason, and non-negative Aggregate version."
      );
    }
    this.abandonmentValue = Object.freeze({
      recipeFamilyId: this.recipeFamilyId,
      recipeId: this.recipeId,
      draftId: this.draftId,
      resultingState: "Abandoned",
      actor,
      occurredAt,
      reason,
      previousAggregateVersion: input.previousAggregateVersion,
      resultingAggregateVersion: input.previousAggregateVersion + 1
    });
    this.stateValue = "Abandoned";
    return this.abandonmentValue;
  }

  publish(input: {
    recipeVersionId: RecipeVersionId;
    versionNumber: VersionNumber;
    publishedBy: string;
    publishedAt: string;
  }): void {
    if (this.stateValue === "Abandoned") {
      throw new RecipeDraftAbandoned(this.draftId.value);
    }
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
      recipeFamilyId: this.recipeFamilyId,
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
      abandonment: this.abandonmentValue,
      instructions: this.instructionsValue,
      createdBy: this.createdBy,
      createdAt: this.createdAt
    });
  }

  private lineIndex(recipeLineId: RecipeLineId): number {
    return this.linesValue.findIndex((line) => line.recipeLineId.equals(recipeLineId));
  }

  private requireLineIndex(recipeLineId: RecipeLineId): number {
    const index = this.lineIndex(recipeLineId);
    if (index < 0) {
      throw new RecipeLineNotFound(recipeLineId.value);
    }
    return index;
  }

  private assertEditableDraft(): void {
    if (this.stateValue === "Abandoned") {
      throw new RecipeDraftAbandoned(this.draftId.value);
    }
    if (this.stateValue !== "Draft") {
      throw new InvalidRecipeState(
        `Recipe ${this.recipeId.value} is ${this.stateValue} and cannot be edited.`
      );
    }
  }
}
