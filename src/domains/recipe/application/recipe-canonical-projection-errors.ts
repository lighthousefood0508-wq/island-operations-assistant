import type {
  IngredientNormalizationFailureCodeV1
} from "../contracts/ingredient-measurement-profile-contract.js";
import type {
  RecipeCanonicalProjectionFailureCodeV1
} from "../contracts/recipe-canonical-projection-contract.js";

export class RecipeCanonicalProjectionError extends Error {
  constructor(
    readonly code: RecipeCanonicalProjectionFailureCodeV1,
    message: string,
    readonly linePosition?: number,
    readonly sourceFailureCode?: IngredientNormalizationFailureCodeV1
  ) {
    super(message);
    this.name = "RecipeCanonicalProjectionError";
  }
}
