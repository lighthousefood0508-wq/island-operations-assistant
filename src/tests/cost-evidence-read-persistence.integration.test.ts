import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CostSnapshot,
  CostSnapshotId,
  PurchaseId,
  SqliteCostEvidenceReadPort,
  SqliteCostSnapshotRepository,
  type RecipeCostEvaluationResultV1
} from "../domains/cost/index.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";

const SUPPLIER_ID = "sup_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PURCHASE_ID = "pur_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ACCEPTED_ID = "accepted_purchase_cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SNAPSHOT_ID = "cost_snapshot_dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const RECIPE_ID = "recipe_eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function result(): RecipeCostEvaluationResultV1 {
  return {
    contractName: "RecipeCostEvaluationResult", contractVersion: 1,
    basis: "STANDARD_RECIPE", valuationPolicy: "VAL-2", roundingPolicy: "NONE_EXACT",
    evaluatedAt: "2026-08-24T01:00:00.000Z", currencyCode: "TWD",
    recipe: { recipeProjection: { recipeId: RECIPE_ID, recipeVersionId: "recipe_version_eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", state: "Published", standardOutput: { coefficient: "1", scale: 0 }, standardYield: { coefficient: "1", scale: 0 } } },
    lines: [{ linePosition: 0, ingredientId: "ing_ffffffff-ffff-4fff-8fff-ffffffffffff", recipeNormalizationEvidence: { ingredientId: "ing_ffffffff-ffff-4fff-8fff-ffffffffffff" }, selectedSource: { sourceType: "ActualPurchase", acceptedPurchaseId: ACCEPTED_ID, acceptedPurchaseLineId: "accepted_purchase_line_cccccccc-cccc-4ccc-8ccc-cccccccccccc" }, exactLineCost: { numerator: "80", denominator: "1" } }],
    standardOutput: { coefficient: "1", scale: 0 }, standardYield: { coefficient: "1", scale: 0 },
    exactStandardBatchCost: { numerator: "80", denominator: "1" }, exactPerStandardYieldCost: { numerator: "80", denominator: "1" }
  } as unknown as RecipeCostEvaluationResultV1;
}

test("Cost Evidence Read returns existing Supplier, Purchase, Accepted Purchase, and immutable Snapshot evidence", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cost-evidence-read-"));
  const database = createDatabase({ databasePath: path.join(dir, "x.sqlite"), host: "127.0.0.1", port: 0 });
  try {
    runMigrations(database);
    database.execute("INSERT INTO cost_suppliers VALUES (?,?,?,?,?)", [SUPPLIER_ID, "Supplier", "2026-08-24T00:00:00.000Z", "owner", 0]);
    database.execute("INSERT INTO cost_purchase_aggregates VALUES (?,?,?,?,?,?,?,?,?,?)", [PURCHASE_ID, SUPPLIER_ID, "Recorded", "2026-08-24T00:00:00.000Z", "owner", "2026-08-24T01:00:00.000Z", "owner", "2026-08-24T01:00:00.000Z", "owner", 1]);
    database.execute("INSERT INTO cost_purchase_lines VALUES (?,?,?,?,?,?,?)", ["pur_line_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", PURCHASE_ID, 0, "ing_ffffffff-ffff-4fff-8fff-ffffffffffff", "2", 0, "kg"]);
    database.execute("INSERT INTO cost_accepted_purchases VALUES (?,?,?,?,?,?,?)", [ACCEPTED_ID, PURCHASE_ID, 1, SUPPLIER_ID, "TWD", "2026-08-24T02:00:00.000Z", "owner"]);
    database.execute("INSERT INTO cost_accepted_purchase_lines VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", ["accepted_purchase_line_cccccccc-cccc-4ccc-8ccc-cccccccccccc", ACCEPTED_ID, "pur_line_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", 0, "ing_ffffffff-ffff-4fff-8fff-ffffffffffff", "2", 0, "kg", "80", 0, "2000", 0, "mass", "g", "profile_ffffffff-ffff-4fff-8fff-ffffffffffff", "profile_version_ffffffff-ffff-4fff-8fff-ffffffffffff"]);
    new SqliteCostSnapshotRepository(database).saveNew(CostSnapshot.capture({ costSnapshotId: CostSnapshotId.parse(SNAPSHOT_ID), result: result(), capturedAt: "2026-08-24T03:00:00.000Z", capturedBy: "owner" }));
    const reads = new SqliteCostEvidenceReadPort(database);
    assert.equal(reads.findSupplier(SUPPLIER_ID)?.displayName, "Supplier");
    assert.equal(reads.findPurchase(PURCHASE_ID)?.state, "Recorded");
    assert.equal(reads.listAcceptedPurchasesForPurchase(PurchaseId.parse(PURCHASE_ID)).at(0)?.acceptedPurchaseId, ACCEPTED_ID);
    assert.equal(reads.findAcceptedPurchase(ACCEPTED_ID)?.lines[0]?.profileVersionId, "profile_version_ffffffff-ffff-4fff-8fff-ffffffffffff");
    assert.equal(reads.listSnapshotsForRecipe(RECIPE_ID).at(0)?.costSnapshotId, SNAPSHOT_ID);
    assert.equal(reads.findSnapshot(SNAPSHOT_ID)?.result.lines[0]?.selectedSource.sourceType, "ActualPurchase");
  } finally {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
