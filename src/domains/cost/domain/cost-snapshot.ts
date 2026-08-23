import { assertIsoInstant } from "./effective-period.js";
import { InvalidCostSnapshot } from "./errors.js";
import { CostSnapshotId } from "./identities.js";
import {
  COST_ROUNDING_POLICY,
  COST_VALUATION_POLICY,
  RECIPE_COST_EVALUATION_RESULT_CONTRACT_NAME,
  RECIPE_COST_EVALUATION_RESULT_CONTRACT_VERSION,
  type RecipeCostEvaluationResultV1
} from "./recipe-cost-evaluation.js";

type JsonRecord = Record<string, unknown>;
function clone<T>(value: T): T { if (Array.isArray(value)) return Object.freeze(value.map(clone)) as T; if (value !== null && typeof value === "object") { const out: JsonRecord = {}; for (const [key, item] of Object.entries(value as JsonRecord)) out[key] = clone(item); return Object.freeze(out) as T; } return value; }
function text(value: string, field: string): string { if (typeof value !== "string" || value.trim().length === 0) throw new InvalidCostSnapshot(`${field} is required.`); return value.trim(); }

export type CostSnapshotContractV1 = Readonly<{
  costSnapshotId: string;
  recipeId: string;
  recipeVersionId: string;
  valuedAt: string;
  capturedAt: string;
  capturedBy: string;
  result: RecipeCostEvaluationResultV1;
}>;

export class CostSnapshot {
  readonly result: RecipeCostEvaluationResultV1;
  readonly valuedAt: string;
  readonly capturedAt: string;
  readonly capturedBy: string;

  private constructor(readonly costSnapshotId: CostSnapshotId, result: RecipeCostEvaluationResultV1, capturedAt: string, capturedBy: string) {
    if (result.contractName !== RECIPE_COST_EVALUATION_RESULT_CONTRACT_NAME || result.contractVersion !== RECIPE_COST_EVALUATION_RESULT_CONTRACT_VERSION || result.valuationPolicy !== COST_VALUATION_POLICY || result.roundingPolicy !== COST_ROUNDING_POLICY || result.recipe.recipeProjection.state !== "Published" || result.lines.length === 0) throw new InvalidCostSnapshot("Snapshot requires a successful VAL-2 published Recipe evaluation.");
    this.valuedAt = assertIsoInstant(result.evaluatedAt, "valuedAt");
    this.capturedAt = assertIsoInstant(capturedAt, "capturedAt");
    this.capturedBy = text(capturedBy, "capturedBy");
    for (const [position, line] of result.lines.entries()) {
      if (line.linePosition !== position || (line.selectedSource.sourceType === "ActualPurchase" && (!line.selectedSource.acceptedPurchaseId || !line.selectedSource.acceptedPurchaseLineId)) || (line.selectedSource.sourceType === "QuoteFallback" && !line.selectedSource.quoteNormalizationEvidence.quoteId)) throw new InvalidCostSnapshot("Snapshot line evidence is incomplete.");
    }
    this.result = clone(result);
    Object.freeze(this);
  }

  static capture(input: Readonly<{ costSnapshotId: CostSnapshotId; result: RecipeCostEvaluationResultV1; capturedAt: string; capturedBy: string }>): CostSnapshot { return new CostSnapshot(input.costSnapshotId, input.result, input.capturedAt, input.capturedBy); }
  toContract(): CostSnapshotContractV1 { return Object.freeze({ costSnapshotId: this.costSnapshotId.value, recipeId: this.result.recipe.recipeProjection.recipeId, recipeVersionId: this.result.recipe.recipeProjection.recipeVersionId, valuedAt: this.valuedAt, capturedAt: this.capturedAt, capturedBy: this.capturedBy, result: this.result }); }
}
