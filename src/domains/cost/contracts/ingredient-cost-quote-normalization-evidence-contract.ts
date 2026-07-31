import type {
  IngredientNormalizationEvidenceV1,
  IngredientNormalizationFailureCodeV1
} from "../../recipe/contracts/ingredient-measurement-profile-contract.js";
import type { CostSourceType } from "../domain/cost-source.js";

export const INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_NAME =
  "IngredientCostQuoteNormalizationEvidence" as const;
export const INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_VERSION =
  1 as const;

export type IngredientCostQuoteNormalizationFailureCodeV1 =
  | "INVALID_QUOTE_NORMALIZATION_REQUEST"
  | "QUOTE_NOT_AUTHORITATIVE_AT_INSTANT"
  | "MISSING_INGREDIENT_MEASUREMENT_PROFILE"
  | "AMBIGUOUS_INGREDIENT_MEASUREMENT_PROFILE"
  | "INVALID_PROFILE_VERSION_REFERENCE"
  | "UNKNOWN_PURCHASE_UNIT"
  | "PACKAGE_SPECIFICATION_REQUIRED"
  | "MEASUREMENT_DIMENSION_MISMATCH"
  | "INVALID_NORMALIZATION_EVIDENCE"
  | "NON_EXACT_NORMALIZATION"
  | "NORMALIZATION_OVERFLOW"
  | "QUOTE_NORMALIZATION_FAILED";

export type IngredientCostQuoteNormalizationEvidenceV1 = Readonly<{
  contractName:
    typeof INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_NAME;
  contractVersion:
    typeof INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_VERSION;
  basis: "INGREDIENT_COST_QUOTE";
  quoteId: string;
  ingredientId: string;
  evaluatedAt: string;
  quoteState: "Recorded" | "Superseded";
  monetaryAmount: Readonly<{
    coefficient: string;
    scale: number;
    currencyCode: string;
  }>;
  purchase: Readonly<{
    rawQuantity: Readonly<{
      coefficient: string;
      scale: number;
    }>;
    rawUnitCode: string;
  }>;
  effectivePeriod: Readonly<{
    effectiveFrom: string;
    effectiveTo?: string;
  }>;
  source: Readonly<{
    sourceType: CostSourceType;
    sourceReferenceId?: string;
    supplierId?: string;
  }>;
  recording: Readonly<{
    recordedAt: string;
    recordedBy: string;
  }>;
  supersession: Readonly<{
    supersededByQuoteId: string;
    supersededAt: string;
    supersededBy: string;
  }> | null;
  normalizationEvidence: IngredientNormalizationEvidenceV1;
}>;

export type IngredientCostQuoteNormalizationFailureV1 = Readonly<{
  code: IngredientCostQuoteNormalizationFailureCodeV1;
  message: string;
  sourceFailureCode?: IngredientNormalizationFailureCodeV1;
}>;

export type IngredientCostQuoteNormalizationResultV1 =
  | Readonly<{
    status: "normalized";
    evidence: IngredientCostQuoteNormalizationEvidenceV1;
  }>
  | Readonly<{
    status: "failed";
    failure: IngredientCostQuoteNormalizationFailureV1;
  }>;
