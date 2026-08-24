import type { CostEvidenceReadPort } from "../domain/cost-evidence-read-port.js";
import type { CostSnapshotContractV1 } from "../domain/cost-snapshot.js";
import { CostSnapshotId } from "../domain/identities.js";
import {
  RECIPE_COST_HISTORY_CONTRACT_NAME,
  RECIPE_COST_HISTORY_CONTRACT_VERSION,
  type RecipeCostHistoryContractV1,
  type RecipeCostHistoryEntryV1
} from "../domain/recipe-cost-history-read-contract.js";
import {
  RecipeCostHistoryReadNotFound,
  RecipeCostHistoryReadPersistenceFailure,
  RecipeCostHistoryReadValidationFailure
} from "./recipe-cost-history-read-errors.js";

function recipeIdentity(recipeId: string): string {
  if (typeof recipeId !== "string" || recipeId.trim().length === 0) {
    throw new RecipeCostHistoryReadValidationFailure();
  }
  return recipeId.trim();
}

function snapshotIdentity(costSnapshotId: string): string {
  try {
    return CostSnapshotId.parse(costSnapshotId).value;
  } catch {
    throw new RecipeCostHistoryReadValidationFailure();
  }
}

function entry(snapshot: CostSnapshotContractV1): RecipeCostHistoryEntryV1 {
  return Object.freeze({ snapshot });
}

/** Builds History only from the governed immutable Snapshot read contract. */
export class RecipeCostHistoryReadService {
  constructor(
    private readonly evidenceReads: Pick<
      CostEvidenceReadPort,
      "findSnapshot" | "listSnapshotsForRecipe"
    >
  ) {}

  list(recipeId: string): RecipeCostHistoryContractV1 {
    const governedRecipeId = recipeIdentity(recipeId);
    return this.timeline(
      governedRecipeId,
      this.read(() => this.evidenceReads.listSnapshotsForRecipe(governedRecipeId))
    );
  }

  latest(recipeId: string): RecipeCostHistoryEntryV1 {
    const entries = this.list(recipeId).entries;
    const result = entries.at(-1);
    if (result === undefined) throw new RecipeCostHistoryReadNotFound();
    return result;
  }

  get(recipeId: string, costSnapshotId: string): RecipeCostHistoryEntryV1 {
    const governedRecipeId = recipeIdentity(recipeId);
    const governedSnapshotId = snapshotIdentity(costSnapshotId);
    const snapshot = this.read(() => this.evidenceReads.findSnapshot(governedSnapshotId));
    if (snapshot === undefined || snapshot.recipeId !== governedRecipeId) {
      throw new RecipeCostHistoryReadNotFound();
    }
    return entry(snapshot);
  }

  private timeline(
    recipeId: string,
    snapshots: readonly CostSnapshotContractV1[]
  ): RecipeCostHistoryContractV1 {
    const ordered = [...snapshots].sort((left, right) =>
      left.capturedAt.localeCompare(right.capturedAt)
      || left.costSnapshotId.localeCompare(right.costSnapshotId)
    );
    return Object.freeze({
      contractName: RECIPE_COST_HISTORY_CONTRACT_NAME,
      contractVersion: RECIPE_COST_HISTORY_CONTRACT_VERSION,
      recipeId,
      entries: Object.freeze(ordered.map(entry))
    });
  }

  private read<T>(read: () => T): T {
    try {
      return read();
    } catch (error) {
      if (
        error instanceof RecipeCostHistoryReadValidationFailure
        || error instanceof RecipeCostHistoryReadNotFound
      ) {
        throw error;
      }
      throw new RecipeCostHistoryReadPersistenceFailure();
    }
  }
}
