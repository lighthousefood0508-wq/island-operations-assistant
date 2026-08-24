import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CostSnapshot,
  CostSnapshotId,
  RecipeCostHistoryReadService,
  SqliteCostEvidenceReadPort,
  SqliteCostSnapshotRepository,
  type RecipeCostEvaluationResultV1
} from "../domains/cost/index.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";

const RECIPE_ID = "recipe_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FIRST_ID = "cost_snapshot_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SECOND_ID = "cost_snapshot_cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function result(): RecipeCostEvaluationResultV1 {
  return {
    contractName: "RecipeCostEvaluationResult", contractVersion: 1,
    basis: "STANDARD_RECIPE", valuationPolicy: "VAL-2", roundingPolicy: "NONE_EXACT",
    evaluatedAt: "2026-08-24T00:00:00.000Z", currencyCode: "TWD",
    recipe: { recipeProjection: { recipeId: RECIPE_ID, recipeVersionId: "recipe_version_dddddddd-dddd-4ddd-8ddd-dddddddddddd", state: "Published", standardOutput: { coefficient: "1", scale: 0 }, standardYield: { coefficient: "1", scale: 0 } } },
    lines: [{ linePosition: 0, ingredientId: "ing_eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", recipeNormalizationEvidence: { ingredientId: "ing_eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }, selectedSource: { sourceType: "ActualPurchase", acceptedPurchaseId: "accepted_purchase_ffffffff-ffff-4fff-8fff-ffffffffffff", acceptedPurchaseLineId: "accepted_purchase_line_ffffffff-ffff-4fff-8fff-ffffffffffff" }, exactLineCost: { numerator: "80", denominator: "1" } }],
    standardOutput: { coefficient: "1", scale: 0 }, standardYield: { coefficient: "1", scale: 0 },
    exactStandardBatchCost: { numerator: "80", denominator: "1" }, exactPerStandardYieldCost: { numerator: "80", denominator: "1" }
  } as unknown as RecipeCostEvaluationResultV1;
}

test("Recipe Cost History replays only stored immutable Snapshot contracts in deterministic order", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "recipe-cost-history-"));
  const database = createDatabase({ databasePath: path.join(dir, "x.sqlite"), host: "127.0.0.1", port: 0 });
  try {
    runMigrations(database);
    const snapshots = new SqliteCostSnapshotRepository(database);
    snapshots.saveNew(CostSnapshot.capture({ costSnapshotId: CostSnapshotId.parse(SECOND_ID), result: result(), capturedAt: "2026-08-24T02:00:00.000Z", capturedBy: "owner" }));
    snapshots.saveNew(CostSnapshot.capture({ costSnapshotId: CostSnapshotId.parse(FIRST_ID), result: result(), capturedAt: "2026-08-24T01:00:00.000Z", capturedBy: "owner" }));

    const history = new RecipeCostHistoryReadService(new SqliteCostEvidenceReadPort(database));
    const timeline = history.list(RECIPE_ID);
    assert.deepEqual(timeline.entries.map((entry) => entry.snapshot.costSnapshotId), [FIRST_ID, SECOND_ID]);
    assert.equal(history.latest(RECIPE_ID).snapshot.costSnapshotId, SECOND_ID);
    const selectedSource = history.get(RECIPE_ID, FIRST_ID).snapshot.result.lines[0]?.selectedSource;
    assert.ok(selectedSource && selectedSource.sourceType === "ActualPurchase");
    assert.equal(selectedSource.acceptedPurchaseId, "accepted_purchase_ffffffff-ffff-4fff-8fff-ffffffffffff");
    assert.equal(database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM cost_recipe_snapshots")?.count, 2);
  } finally {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
