import type {
  IngredientNormalizationFailureCodeV1
} from "../../recipe/contracts/ingredient-measurement-profile-contract.js";
import type {
  IngredientCostQuoteNormalizationFailureCodeV1
} from "../contracts/ingredient-cost-quote-normalization-evidence-contract.js";

export class IngredientCostQuoteNormalizationError extends Error {
  readonly name = "IngredientCostQuoteNormalizationError";

  constructor(
    readonly code: IngredientCostQuoteNormalizationFailureCodeV1,
    message: string,
    readonly sourceFailureCode?: IngredientNormalizationFailureCodeV1
  ) {
    super(message);
  }
}
