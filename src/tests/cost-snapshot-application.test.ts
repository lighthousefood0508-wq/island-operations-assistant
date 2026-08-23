import assert from "node:assert/strict";
import test from "node:test";
import { RecipeCostSnapshotPersistenceFailure, RecipeCostSnapshotService, type CostSnapshotRepository, type RecipeCostEvaluationResultV1 } from "../domains/cost/index.js";
function result(): RecipeCostEvaluationResultV1 { return { contractName:"RecipeCostEvaluationResult",contractVersion:1,basis:"STANDARD_RECIPE",valuationPolicy:"VAL-2",roundingPolicy:"NONE_EXACT",evaluatedAt:"2026-08-23T01:00:00.000Z",currencyCode:"TWD",recipe:{recipeProjection:{recipeId:"recipe_11111111-1111-4111-8111-111111111111",recipeVersionId:"recipe_version_22222222-2222-4222-8222-822222222222",state:"Published"}},lines:[{linePosition:0,ingredientId:"ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",selectedSource:{sourceType:"ActualPurchase",acceptedPurchaseId:"accepted_purchase_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",acceptedPurchaseLineId:"accepted_purchase_line_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},exactLineCost:{numerator:"60",denominator:"1"}}],exactStandardBatchCost:{numerator:"60",denominator:"1"},exactPerStandardYieldCost:{numerator:"20",denominator:"1"} } as unknown as RecipeCostEvaluationResultV1; }

test("Snapshot application creates one immutable append-only evidence record", () => {
  const saved: unknown[] = [];
  const service = new RecipeCostSnapshotService({ saveNew(snapshot) { saved.push(snapshot.toContract()); } } satisfies CostSnapshotRepository);
  const captured = service.capture({ result: result(), capturedAt: "2026-08-23T02:00:00.000Z", capturedBy: "owner" });
  assert.match(captured.costSnapshotId, /^cost_snapshot_/);
  assert.equal(saved.length, 1);
  assert.equal(captured.result.lines[0]?.selectedSource.sourceType, "ActualPurchase");
});

test("Snapshot application turns a technical save failure into a typed safe failure", () => {
  const service = new RecipeCostSnapshotService({ saveNew() { throw new Error("raw SQLite table detail"); } } satisfies CostSnapshotRepository);
  assert.throws(() => service.capture({ result: result(), capturedAt: "2026-08-23T02:00:00.000Z", capturedBy: "owner" }), RecipeCostSnapshotPersistenceFailure);
});
