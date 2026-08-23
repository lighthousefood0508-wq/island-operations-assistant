import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import type { CostSnapshotRepository } from "../domain/cost-snapshot-repository.js";
import type { CostSnapshot } from "../domain/cost-snapshot.js";
import { CostPersistenceFailure } from "../persistence/errors.js";

export class SqliteCostSnapshotRepository implements CostSnapshotRepository {
  constructor(private readonly database: DatabaseAdapter) {}
  saveNew(snapshot: CostSnapshot): void {
    try { this.database.transactionImmediate(() => { const value=snapshot.toContract(); this.database.execute(`INSERT INTO cost_recipe_snapshots VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[value.costSnapshotId,value.recipeId,value.recipeVersionId,value.result.valuationPolicy,value.result.roundingPolicy,value.valuedAt,value.capturedAt,value.capturedBy,value.result.currencyCode,value.result.exactStandardBatchCost.numerator,value.result.exactStandardBatchCost.denominator,value.result.exactPerStandardYieldCost.numerator,value.result.exactPerStandardYieldCost.denominator,JSON.stringify(value.result.recipe)]); value.result.lines.forEach((line)=>{const sourceId=line.selectedSource.sourceType==="ActualPurchase"?line.selectedSource.acceptedPurchaseId:line.selectedSource.quoteNormalizationEvidence.quoteId;this.database.execute(`INSERT INTO cost_recipe_snapshot_lines VALUES (?,?,?,?,?,?,?,?,?)`,[value.costSnapshotId,line.linePosition,line.ingredientId,line.selectedSource.sourceType,sourceId,line.exactLineCost.numerator,line.exactLineCost.denominator,JSON.stringify({ingredientId:line.ingredientId,linePosition:line.linePosition,recipeNormalizationEvidence:line.recipeNormalizationEvidence}),JSON.stringify(line.selectedSource)]);}); }); } catch(error) { throw new CostPersistenceFailure("save immutable Recipe Cost Snapshot",error); }
  }
}
