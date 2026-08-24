import type { CostSnapshotContractV1 } from "./cost-snapshot.js";

export const RECIPE_COST_HISTORY_CONTRACT_NAME = "RecipeCostHistory";
export const RECIPE_COST_HISTORY_CONTRACT_VERSION = 1;

/** A History entry is the complete immutable Snapshot contract, not a revaluation. */
export type RecipeCostHistoryEntryV1 = Readonly<{
  snapshot: CostSnapshotContractV1;
}>;

export type RecipeCostHistoryContractV1 = Readonly<{
  contractName: typeof RECIPE_COST_HISTORY_CONTRACT_NAME;
  contractVersion: typeof RECIPE_COST_HISTORY_CONTRACT_VERSION;
  recipeId: string;
  entries: readonly RecipeCostHistoryEntryV1[];
}>;
