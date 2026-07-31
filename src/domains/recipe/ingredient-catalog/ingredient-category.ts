import {
  APPROVED_INGREDIENT_CATEGORY_CODES_V1,
  type ApprovedIngredientCategoryCodeV1
} from "../contracts/canonical-ingredient-contract.js";
import { InvalidIngredientCategory } from "./errors.js";

const APPROVED_CODES = new Set<string>(
  APPROVED_INGREDIENT_CATEGORY_CODES_V1
);

export class IngredientCategory {
  private constructor(readonly code: ApprovedIngredientCategoryCodeV1) {
    Object.freeze(this);
  }

  static parse(code: string): IngredientCategory {
    if (!APPROVED_CODES.has(code)) {
      throw new InvalidIngredientCategory(code);
    }
    return new IngredientCategory(code as ApprovedIngredientCategoryCodeV1);
  }

  equals(other: IngredientCategory): boolean {
    return this.code === other.code;
  }
}
