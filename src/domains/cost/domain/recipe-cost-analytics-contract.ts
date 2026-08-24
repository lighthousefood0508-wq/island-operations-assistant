import type { ExactRationalV1 } from "./recipe-cost-evaluation.js";

export const RECIPE_COST_ANALYTICS_CONTRACT_NAME = "RecipeCostAnalytics";
export const RECIPE_COST_ANALYTICS_CONTRACT_VERSION = 1;

export type CostAnalyticsDirectionV1 = "increase" | "decrease" | "unchanged";

export type CostAnalyticsSupplierVisibilityV1 = Readonly<{
  supplierId: string;
  actualPurchaseLineCount: number;
  acceptedPurchaseIds: readonly string[];
}>;

export type RecipeCostAnalyticsSnapshotV1 = Readonly<{
  costSnapshotId: string;
  recipeVersionId: string;
  valuedAt: string;
  capturedAt: string;
  capturedBy: string;
  valuationPolicy: "VAL-2";
  roundingPolicy: "NONE_EXACT";
  exactStandardBatchCost: ExactRationalV1;
  exactPerStandardYieldCost: ExactRationalV1;
  actualPurchaseLineCount: number;
  quoteFallbackLineCount: number;
  actualPurchaseSuppliers: readonly CostAnalyticsSupplierVisibilityV1[];
}>;

export type ExactCostChangeV1 = Readonly<{
  exactDifference: ExactRationalV1;
  direction: CostAnalyticsDirectionV1;
}>;

export type RecipeCostAnalyticsChangeV1 = Readonly<{
  standardBatchCost: ExactCostChangeV1;
  perStandardYieldCost: ExactCostChangeV1;
}>;

export type RecipeCostAnalyticsContractV1 = Readonly<{
  contractName: typeof RECIPE_COST_ANALYTICS_CONTRACT_NAME;
  contractVersion: typeof RECIPE_COST_ANALYTICS_CONTRACT_VERSION;
  recipeId: string;
  snapshots: readonly RecipeCostAnalyticsSnapshotV1[];
  latest: RecipeCostAnalyticsSnapshotV1 | null;
  previous: RecipeCostAnalyticsSnapshotV1 | null;
  latestMinusPrevious: RecipeCostAnalyticsChangeV1 | null;
}>;
