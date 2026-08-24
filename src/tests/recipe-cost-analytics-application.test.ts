import assert from "node:assert/strict";
import test from "node:test";
import {
  RecipeCostAnalyticsReadFailure,
  RecipeCostAnalyticsService,
  RecipeCostAnalyticsValidationFailure,
  RecipeCostHistoryReadPersistenceFailure,
  RecipeCostHistoryReadValidationFailure,
  type RecipeCostHistoryContractV1,
  type RecipeCostHistoryEntryV1
} from "../domains/cost/index.js";

const RECIPE_ID = "recipe_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function historyEntry(
  id: string,
  capturedAt: string,
  batch: string,
  perYield: string,
  sources: readonly unknown[]
): RecipeCostHistoryEntryV1 {
  return Object.freeze({
    snapshot: Object.freeze({
      costSnapshotId: id,
      recipeId: RECIPE_ID,
      recipeVersionId: "recipe_version_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      valuedAt: "2026-08-24T00:00:00.000Z",
      capturedAt,
      capturedBy: "owner",
      result: Object.freeze({
        valuationPolicy: "VAL-2",
        roundingPolicy: "NONE_EXACT",
        exactStandardBatchCost: Object.freeze({ numerator: batch, denominator: "1" }),
        exactPerStandardYieldCost: Object.freeze({ numerator: perYield, denominator: "1" }),
        lines: Object.freeze(sources.map((selectedSource) => Object.freeze({ selectedSource })))
      })
    })
  }) as unknown as RecipeCostHistoryEntryV1;
}

function timeline(entries: readonly RecipeCostHistoryEntryV1[]): RecipeCostHistoryContractV1 {
  return Object.freeze({ contractName: "RecipeCostHistory", contractVersion: 1, recipeId: RECIPE_ID, entries: Object.freeze(entries) });
}

test("Cost Analytics projects exact Snapshot trend and keeps actual-price distinct from Quote fallback", () => {
  const first = historyEntry("cost_snapshot_cccccccc-cccc-4ccc-8ccc-cccccccccccc", "2026-08-24T01:00:00.000Z", "10", "5", [
    Object.freeze({ sourceType: "ActualPurchase", supplierId: "sup_b", acceptedPurchaseId: "accepted_purchase_b" })
  ]);
  const second = historyEntry("cost_snapshot_dddddddd-dddd-4ddd-8ddd-dddddddddddd", "2026-08-24T02:00:00.000Z", "15", "7", [
    Object.freeze({ sourceType: "ActualPurchase", supplierId: "sup_b", acceptedPurchaseId: "accepted_purchase_b" }),
    Object.freeze({ sourceType: "ActualPurchase", supplierId: "sup_a", acceptedPurchaseId: "accepted_purchase_a" }),
    Object.freeze({ sourceType: "QuoteFallback", quoteNormalizationEvidence: Object.freeze({ quoteId: "quote_a" }) })
  ]);
  const service = new RecipeCostAnalyticsService({ list: () => timeline([first, second]) });

  const analytics = service.get(RECIPE_ID);
  assert.equal(analytics.contractName, "RecipeCostAnalytics");
  assert.equal(analytics.latest?.costSnapshotId, second.snapshot.costSnapshotId);
  assert.equal(analytics.previous?.costSnapshotId, first.snapshot.costSnapshotId);
  assert.deepEqual(analytics.latestMinusPrevious?.standardBatchCost, { exactDifference: { numerator: "5", denominator: "1" }, direction: "increase" });
  assert.deepEqual(analytics.latestMinusPrevious?.perStandardYieldCost, { exactDifference: { numerator: "2", denominator: "1" }, direction: "increase" });
  assert.equal(analytics.latest?.actualPurchaseLineCount, 2);
  assert.equal(analytics.latest?.quoteFallbackLineCount, 1);
  assert.deepEqual(analytics.latest?.actualPurchaseSuppliers, [
    { supplierId: "sup_a", actualPurchaseLineCount: 1, acceptedPurchaseIds: ["accepted_purchase_a"] },
    { supplierId: "sup_b", actualPurchaseLineCount: 1, acceptedPurchaseIds: ["accepted_purchase_b"] }
  ]);
});

test("Cost Analytics keeps empty/single History safe and maps History failures without persistence detail", () => {
  const empty = new RecipeCostAnalyticsService({ list: () => timeline([]) });
  assert.equal(empty.get(RECIPE_ID).latest, null);
  assert.equal(empty.get(RECIPE_ID).latestMinusPrevious, null);
  const invalid = new RecipeCostAnalyticsService({ list: () => { throw new RecipeCostHistoryReadValidationFailure(); } });
  assert.throws(() => invalid.get(RECIPE_ID), RecipeCostAnalyticsValidationFailure);
  const failed = new RecipeCostAnalyticsService({ list: () => { throw new RecipeCostHistoryReadPersistenceFailure(); } });
  assert.throws(() => failed.get(RECIPE_ID), RecipeCostAnalyticsReadFailure);
});
