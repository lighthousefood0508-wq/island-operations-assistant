import type {
  CanonicalIngredientManagementRecordV1
} from "../../contracts/canonical-ingredient-management-contract.js";
import type { CanonicalIngredient } from "../canonical-ingredient.js";
import type {
  CanonicalIngredientRepository
} from "../canonical-ingredient-repository.js";
import { CanonicalIngredientId } from "../identities.js";
import {
  CanonicalIngredientLifecycleNotFound,
  CanonicalIngredientLifecyclePersistenceFailure,
  CanonicalIngredientLifecycleValidationFailure
} from "./errors.js";

type CanonicalIngredientManagementReadRepository = Pick<
  CanonicalIngredientRepository,
  | "findById"
  | "listActiveForManagement"
  | "listArchivedForManagement"
>;

function validationFailure(): never {
  throw new CanonicalIngredientLifecycleValidationFailure();
}

function parseIngredientId(value: string): CanonicalIngredientId {
  try {
    return CanonicalIngredientId.parse(value);
  } catch {
    return validationFailure();
  }
}

function toManagementRecord(
  ingredient: CanonicalIngredient
): CanonicalIngredientManagementRecordV1 {
  return ingredient.toContract();
}

export class CanonicalIngredientManagementReadService {
  constructor(
    private readonly repository: CanonicalIngredientManagementReadRepository
  ) {}

  list(
    lifecycle: string = "all"
  ): readonly CanonicalIngredientManagementRecordV1[] {
    if (
      lifecycle !== "all"
      && lifecycle !== "active"
      && lifecycle !== "archived"
    ) {
      validationFailure();
    }

    try {
      if (lifecycle === "active") {
        return this.repository
          .listActiveForManagement()
          .map(toManagementRecord);
      }
      if (lifecycle === "archived") {
        return this.repository
          .listArchivedForManagement()
          .map(toManagementRecord);
      }
      return [
        ...this.repository.listActiveForManagement().map(toManagementRecord),
        ...this.repository.listArchivedForManagement().map(toManagementRecord)
      ];
    } catch {
      throw new CanonicalIngredientLifecyclePersistenceFailure();
    }
  }

  getById(
    ingredientId: string
  ): CanonicalIngredientManagementRecordV1 {
    const identity = parseIngredientId(ingredientId);
    let ingredient: CanonicalIngredient | undefined;
    try {
      ingredient = this.repository.findById(identity);
    } catch {
      throw new CanonicalIngredientLifecyclePersistenceFailure();
    }
    if (ingredient === undefined) {
      throw new CanonicalIngredientLifecycleNotFound();
    }
    return ingredient.toContract();
  }
}
