import assert from "node:assert/strict";
import test from "node:test";
import { CostSnapshot, CostSnapshotId, type RecipeCostEvaluationResultV1 } from "../domains/cost/index.js";

function result(): RecipeCostEvaluationResultV1 { return { contractName:"RecipeCostEvaluationResult",contractVersion:1,basis:"STANDARD_RECIPE",valuationPolicy:"VAL-2",roundingPolicy:"NONE_EXACT",evaluatedAt:"2026-08-23T01:00:00.000Z",currencyCode:"TWD",recipe:{recipeProjection:{recipeId:"recipe_11111111-1111-4111-8111-111111111111",recipeVersionId:"recipe_version_22222222-2222-4222-8222-222222222222",state:"Published"}},lines:[{linePosition:0,ingredientId:"ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",selectedSource:{sourceType:"ActualPurchase",acceptedPurchaseId:"accepted_purchase_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",acceptedPurchaseLineId:"accepted_purchase_line_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},exactLineCost:{numerator:"60",denominator:"1"}}],exactStandardBatchCost:{numerator:"60",denominator:"1"},exactPerStandardYieldCost:{numerator:"20",denominator:"1"} } as unknown as RecipeCostEvaluationResultV1; }

test("immutable Cost Snapshot pins a successful VAL-2 result and source evidence", () => {
  const evaluated = result();
  const snapshot = CostSnapshot.capture({ costSnapshotId: CostSnapshotId.fromUuid("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), result: evaluated, capturedAt: "2026-08-23T02:00:00.000Z", capturedBy: "owner" });
  const contract = snapshot.toContract();
  assert.match(contract.costSnapshotId, /^cost_snapshot_/);
  assert.equal(contract.recipeVersionId, "recipe_version_22222222-2222-4222-8222-222222222222");
  assert.equal(contract.result.lines[0]?.selectedSource.sourceType, "ActualPurchase");
  assert.equal(Object.isFrozen(contract.result), true);
  (evaluated.lines[0] as { selectedSource: { acceptedPurchaseId?: string } }).selectedSource.acceptedPurchaseId = "accepted_purchase_replaced";
  assert.equal((contract.result.lines[0]?.selectedSource as { acceptedPurchaseId?: string }).acceptedPurchaseId, "accepted_purchase_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.throws(() => CostSnapshot.capture({ costSnapshotId: CostSnapshotId.fromUuid("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"), result: { ...result(), valuationPolicy: "VAL-1" } as never, capturedAt: "2026-08-23T02:00:00.000Z", capturedBy: "owner" }));
});

test("immutable Cost Snapshot accepts and pins explicit Quote fallback evidence", () => {
  const evaluated = result();
  (evaluated.lines[0] as { selectedSource: unknown }).selectedSource = { sourceType: "QuoteFallback", quoteNormalizationEvidence: { quoteId: "quote_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } };
  const snapshot = CostSnapshot.capture({ costSnapshotId: CostSnapshotId.fromUuid("cccccccc-cccc-4ccc-8ccc-cccccccccccc"), result: evaluated, capturedAt: "2026-08-23T02:00:00.000Z", capturedBy: "owner" });
  assert.equal(snapshot.toContract().result.lines[0]?.selectedSource.sourceType, "QuoteFallback");
});
