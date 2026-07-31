import type {
  RecipeCostEvaluationFailureCodeV1
} from "../domain/recipe-cost-evaluation.js";

export class RecipeCostEvaluationError extends Error {
  constructor(
    readonly code: RecipeCostEvaluationFailureCodeV1,
    message: string,
    readonly details: Readonly<{
      ingredientId?: string;
      linePosition?: number;
      quoteIds?: readonly string[];
      sourceFailureCode?: string;
    }> = {}
  ) {
    super(message);
    this.name = new.target.name;
    Object.freeze(this.details);
  }
}
