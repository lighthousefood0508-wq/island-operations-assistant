import { randomUUID } from "node:crypto";
import type { CanonicalIngredientContractV1 } from "../../contracts/canonical-ingredient-contract.js";
import { CanonicalIngredient } from "../canonical-ingredient.js";
import type { CanonicalIngredientRepository } from "../canonical-ingredient-repository.js";
import { CanonicalIngredientId } from "../identities.js";
import { IngredientCategory } from "../ingredient-category.js";
import {
  CanonicalIngredientCreationPersistenceFailure,
  CanonicalIngredientCreationValidationFailure
} from "./canonical-ingredient-creation-errors.js";

type CanonicalIngredientCreationRepository = Pick<
  CanonicalIngredientRepository,
  "saveNew"
>;

export type CanonicalIngredientCreationCommand = Readonly<{
  name: string;
  categoryCode: string;
  actor: string;
  occurredAt: string;
}>;

function requireText(value: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CanonicalIngredientCreationValidationFailure();
  }
  return value.trim();
}

function validateOccurredAt(value: string): string {
  const occurredAt = requireText(value);
  const milliseconds = Date.parse(occurredAt);
  if (
    !Number.isFinite(milliseconds)
    || new Date(milliseconds).toISOString() !== occurredAt
  ) {
    throw new CanonicalIngredientCreationValidationFailure();
  }
  return occurredAt;
}

export class CanonicalIngredientCreationService {
  constructor(
    private readonly repository: CanonicalIngredientCreationRepository
  ) {}

  create(
    command: CanonicalIngredientCreationCommand
  ): CanonicalIngredientContractV1 {
    let ingredient: CanonicalIngredient;
    try {
      ingredient = CanonicalIngredient.create({
        ingredientId: CanonicalIngredientId.fromUuid(randomUUID()),
        name: requireText(command.name),
        category: IngredientCategory.parse(requireText(command.categoryCode)),
        createdAt: validateOccurredAt(command.occurredAt),
        createdBy: requireText(command.actor)
      });
    } catch (error) {
      if (error instanceof CanonicalIngredientCreationValidationFailure) {
        throw error;
      }
      throw new CanonicalIngredientCreationValidationFailure();
    }

    try {
      this.repository.saveNew(ingredient);
    } catch {
      throw new CanonicalIngredientCreationPersistenceFailure();
    }

    return ingredient.toContract();
  }
}
