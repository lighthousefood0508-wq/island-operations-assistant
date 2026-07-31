import type { IngredientCostQuote } from "./ingredient-cost-quote.js";
import type { IngredientId } from "./identities.js";

export type CostEvaluationEffectiveQuoteLookup =
  | Readonly<{ status: "found"; quote: IngredientCostQuote }>
  | Readonly<{ status: "not_found" }>;

export interface CostEvaluationQuoteReader {
  findEffectiveQuoteAt(
    ingredientId: IngredientId,
    evaluatedAt: string
  ): CostEvaluationEffectiveQuoteLookup;
}

export interface CostEvaluationReadUnitOfWork {
  execute<T>(work: (reader: CostEvaluationQuoteReader) => T): T;
}
