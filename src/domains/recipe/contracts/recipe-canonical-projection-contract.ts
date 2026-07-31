import type {
  IngredientNormalizationEvidenceV1,
  IngredientNormalizationFailureCodeV1
} from "./ingredient-measurement-profile-contract.js";
import type {
  MeasurementNormalizationEvidenceV1
} from "./measurement-foundation-contract.js";
import type {
  CanonicalIngredientIdV1
} from "./canonical-ingredient-contract.js";

export const RECIPE_CANONICAL_PROJECTION_CONTRACT_NAME =
  "RecipeCanonicalProjection" as const;
export const RECIPE_CANONICAL_PROJECTION_CONTRACT_VERSION = 1 as const;

export type RecipeCanonicalProjectionFailureCodeV1 =
  | "INVALID_RECIPE_PROJECTION_SOURCE"
  | "INVALID_CANONICAL_INGREDIENT_ID"
  | "MISSING_INGREDIENT_MEASUREMENT_PROFILE"
  | "AMBIGUOUS_INGREDIENT_MEASUREMENT_PROFILE"
  | "INVALID_PROFILE_VERSION_REFERENCE"
  | "INGREDIENT_NORMALIZATION_FAILED"
  | "MEASUREMENT_DIMENSION_MISMATCH"
  | "STANDARD_OUTPUT_NORMALIZATION_FAILED"
  | "STANDARD_YIELD_NORMALIZATION_FAILED"
  | "INVALID_NORMALIZATION_EVIDENCE"
  | "RECIPE_CANONICAL_PROJECTION_FAILED";

export type RecipeCanonicalProjectionLineV1 = Readonly<{
  linePosition: number;
  ingredientId: CanonicalIngredientIdV1;
  normalizationEvidence: IngredientNormalizationEvidenceV1;
}>;

export type RecipeCanonicalProjectionV1 = Readonly<{
  contractName: typeof RECIPE_CANONICAL_PROJECTION_CONTRACT_NAME;
  contractVersion: typeof RECIPE_CANONICAL_PROJECTION_CONTRACT_VERSION;
  basis: "PUBLISHED_RECIPE_VERSION";
  recipeId: string;
  recipeVersionId: string;
  versionNumber: number;
  state: "Published" | "Superseded";
  product: Readonly<{
    productId: string;
    productVersionId: string;
  }>;
  lines: readonly RecipeCanonicalProjectionLineV1[];
  standardOutput: MeasurementNormalizationEvidenceV1;
  standardYield: MeasurementNormalizationEvidenceV1;
  publication: Readonly<{
    publishedAt: string;
    publishedBy: string;
  }>;
  supersession: Readonly<{
    supersededByRecipeVersionId: string;
    supersededAt: string;
    supersededBy: string;
    reason: string;
  }> | null;
}>;

export type RecipeCanonicalProjectionFailureV1 = Readonly<{
  code: RecipeCanonicalProjectionFailureCodeV1;
  message: string;
  linePosition?: number;
  sourceFailureCode?: IngredientNormalizationFailureCodeV1;
}>;

export type RecipeCanonicalProjectionResultV1 =
  | Readonly<{
    status: "projected";
    projection: RecipeCanonicalProjectionV1;
  }>
  | Readonly<{
    status: "failed";
    failure: RecipeCanonicalProjectionFailureV1;
  }>;
