import type {
  RecipeCanonicalProjectionV1
} from "./recipe-canonical-projection-contract.js";

export const RECIPE_COSTING_CONTRACT_NAME =
  "RecipeCostingContract" as const;
export const RECIPE_COSTING_CONTRACT_VERSION = 2 as const;
export const RECIPE_COSTING_CONTRACT_BASIS =
  "RECIPE_CANONICAL_PROJECTION" as const;

export type RecipeCostingContractV2 = Readonly<{
  contractName: typeof RECIPE_COSTING_CONTRACT_NAME;
  contractVersion: typeof RECIPE_COSTING_CONTRACT_VERSION;
  basis: typeof RECIPE_COSTING_CONTRACT_BASIS;
  sourceProjectionContractName: RecipeCanonicalProjectionV1["contractName"];
  sourceProjectionContractVersion:
    RecipeCanonicalProjectionV1["contractVersion"];
  recipeProjection: RecipeCanonicalProjectionV1;
}>;

export type RecipeCostingContractFailureCodeV2 =
  | "INVALID_RECIPE_COSTING_CONTRACT_SOURCE"
  | "UNSUPPORTED_RECIPE_CANONICAL_PROJECTION_VERSION"
  | "INVALID_RECIPE_COSTING_EVIDENCE"
  | "RECIPE_COSTING_CONTRACT_V2_FAILED";

export type RecipeCostingContractFailureV2 = Readonly<{
  code: RecipeCostingContractFailureCodeV2;
  message: string;
}>;

export type RecipeCostingContractResultV2 =
  | Readonly<{
    status: "created";
    contract: RecipeCostingContractV2;
  }>
  | Readonly<{
    status: "failed";
    failure: RecipeCostingContractFailureV2;
  }>;
