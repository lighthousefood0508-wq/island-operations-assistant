import type { IngredientCostQuote } from "./ingredient-cost-quote.js";
import type { IngredientId } from "./identities.js";

export type CostEvaluationEffectiveQuoteLookup =
  | Readonly<{ status: "found"; quote: IngredientCostQuote }>
  | Readonly<{ status: "not_found" }>;

export type AcceptedPurchaseValuationEvidenceV1 = Readonly<{
  acceptedPurchaseId: string;
  acceptedPurchaseLineId: string;
  sourcePurchaseId: string;
  sourcePurchaseVersion: number;
  supplierId: string;
  acceptedAt: string;
  currencyCode: string;
  amountCoefficient: string;
  amountScale: number;
  normalizedQuantityCoefficient: string;
  normalizedQuantityScale: number;
  dimension: string;
  canonicalUnitCode: string;
  profileId: string;
  profileVersionId: string;
}>;

export interface CostEvaluationQuoteReader {
  findEffectiveQuoteAt(
    ingredientId: IngredientId,
    evaluatedAt: string
  ): CostEvaluationEffectiveQuoteLookup;
  findEligibleAcceptedPurchaseLines(
    ingredientId: IngredientId,
    valuedAt: string
  ): readonly AcceptedPurchaseValuationEvidenceV1[];
}

export interface CostEvaluationReadUnitOfWork {
  execute<T>(work: (reader: CostEvaluationQuoteReader) => T): T;
}
