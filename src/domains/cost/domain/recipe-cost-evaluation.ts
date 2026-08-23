import type {
  MeasurementNormalizationEvidenceV1
} from "../../recipe/contracts/measurement-foundation-contract.js";
import type {
  RecipeCostingContractV2
} from "../../recipe/contracts/recipe-costing-contract-v2.js";
import type {
  IngredientCostQuoteNormalizationEvidenceV1,
  IngredientCostQuoteNormalizationResultV1
} from "../contracts/ingredient-cost-quote-normalization-evidence-contract.js";
import type { IngredientCostQuote } from "./ingredient-cost-quote.js";

export const RECIPE_COST_EVALUATION_RESULT_CONTRACT_NAME =
  "RecipeCostEvaluationResult" as const;
export const RECIPE_COST_EVALUATION_RESULT_CONTRACT_VERSION = 1 as const;
export const RECIPE_COST_EVALUATION_BASIS = "STANDARD_RECIPE" as const;
export const COST_VALUATION_POLICY = "VAL-2" as const;
export const COST_ROUNDING_POLICY = "NONE_EXACT" as const;

export type ExactRationalV1 = Readonly<{
  numerator: string;
  denominator: string;
}>;

export type EvaluateRecipeCostCommand = Readonly<{
  recipe: RecipeCostingContractV2;
  evaluatedAt: string;
}>;

export interface IngredientCostQuoteNormalizationPort {
  normalize(request: Readonly<{
    quote: IngredientCostQuote;
    evaluatedAt: string;
  }>): IngredientCostQuoteNormalizationResultV1;
}

export type ActualPurchaseCostSourceV1 = Readonly<{
  sourceType: "ActualPurchase";
  acceptedPurchaseId: string;
  acceptedPurchaseLineId: string;
  sourcePurchaseId: string;
  sourcePurchaseVersion: number;
  supplierId: string;
  acceptedAt: string;
  currencyCode: string;
  amount: ExactRationalV1;
  normalizedQuantity: ExactRationalV1;
  dimension: string;
  canonicalUnitCode: string;
  profileId: string;
  profileVersionId: string;
}>;

export type QuoteFallbackCostSourceV1 = Readonly<{
  sourceType: "QuoteFallback";
  quoteNormalizationEvidence: IngredientCostQuoteNormalizationEvidenceV1;
}>;

export type RecipeCostEvaluationLineV1 = Readonly<{
  linePosition: number;
  ingredientId: string;
  recipeNormalizationEvidence:
    RecipeCostingContractV2["recipeProjection"]["lines"][number]["normalizationEvidence"];
  selectedSource: ActualPurchaseCostSourceV1 | QuoteFallbackCostSourceV1;
  exactLineCost: ExactRationalV1;
}>;

export type RecipeCostEvaluationResultV1 = Readonly<{
  contractName: typeof RECIPE_COST_EVALUATION_RESULT_CONTRACT_NAME;
  contractVersion: typeof RECIPE_COST_EVALUATION_RESULT_CONTRACT_VERSION;
  basis: typeof RECIPE_COST_EVALUATION_BASIS;
  valuationPolicy: typeof COST_VALUATION_POLICY;
  roundingPolicy: typeof COST_ROUNDING_POLICY;
  evaluatedAt: string;
  currencyCode: "TWD";
  recipe: RecipeCostingContractV2;
  lines: readonly RecipeCostEvaluationLineV1[];
  standardOutput: MeasurementNormalizationEvidenceV1;
  standardYield: MeasurementNormalizationEvidenceV1;
  exactStandardBatchCost: ExactRationalV1;
  exactPerStandardYieldCost: ExactRationalV1;
}>;

export type RecipeCostEvaluationFailureCodeV1 =
  | "INVALID_RECIPE_COSTING_CONTRACT"
  | "INVALID_COST_EVALUATION_REQUEST"
  | "MISSING_INGREDIENT_COST"
  | "AMBIGUOUS_INGREDIENT_COST"
  | "AMBIGUOUS_ACCEPTED_PURCHASE_COST"
  | "ACCEPTED_PURCHASE_EVIDENCE_INVALID"
  | "QUOTE_NORMALIZATION_FAILED"
  | "MEASUREMENT_INCOMPATIBILITY"
  | "CURRENCY_MISMATCH"
  | "UNSUPPORTED_CURRENCY"
  | "ARITHMETIC_FAILURE"
  | "READ_TRANSACTION_FAILED";

export type RecipeCostEvaluationFailureV1 = Readonly<{
  code: RecipeCostEvaluationFailureCodeV1;
  message: string;
  ingredientId?: string;
  linePosition?: number;
  quoteIds?: readonly string[];
  sourceFailureCode?: string;
}>;

export type RecipeCostEvaluationOutcomeV1 =
  | Readonly<{
    status: "evaluated";
    result: RecipeCostEvaluationResultV1;
  }>
  | Readonly<{
    status: "failed";
    failure: RecipeCostEvaluationFailureV1;
  }>;
