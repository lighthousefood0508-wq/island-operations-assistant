import assert from "node:assert/strict";
import test from "node:test";
import {
  CostSnapshotId,
  RecipeCostHistoryReadNotFound,
  RecipeCostHistoryReadPersistenceFailure,
  RecipeCostHistoryReadService,
  RecipeCostHistoryReadValidationFailure,
  type CostEvidenceReadPort,
  type CostSnapshotContractV1
} from "../domains/cost/index.js";

const RECIPE_ID = "recipe_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_RECIPE_ID = "recipe_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FIRST_ID = "cost_snapshot_cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SECOND_ID = "cost_snapshot_dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function snapshot(
  costSnapshotId: string,
  recipeId: string,
  capturedAt: string
): CostSnapshotContractV1 {
  return Object.freeze({
    costSnapshotId,
    recipeId,
    recipeVersionId: "recipe_version_eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    valuedAt: "2026-08-24T00:00:00.000Z",
    capturedAt,
    capturedBy: "owner",
    result: Object.freeze({
      valuationPolicy: "VAL-2",
      exactStandardBatchCost: Object.freeze({ numerator: "10", denominator: "1" }),
      lines: Object.freeze([Object.freeze({ selectedSource: Object.freeze({ sourceType: "ActualPurchase", acceptedPurchaseId: "accepted_purchase_ffffffff-ffff-4fff-8fff-ffffffffffff" }) })])
    })
  }) as unknown as CostSnapshotContractV1;
}

function reads(overrides: Partial<CostEvidenceReadPort> = {}): CostEvidenceReadPort {
  return {
    findSupplier: () => undefined,
    listSuppliers: () => Object.freeze([]),
    findPurchase: () => undefined,
    findAcceptedPurchase: () => undefined,
    listAcceptedPurchasesForPurchase: () => Object.freeze([]),
    findSnapshot: () => undefined,
    listSnapshotsForRecipe: () => Object.freeze([]),
    ...overrides
  };
}

test("Recipe Cost History orders immutable Snapshot evidence and exposes deterministic latest", () => {
  const first = snapshot(FIRST_ID, RECIPE_ID, "2026-08-24T02:00:00.000Z");
  const second = snapshot(SECOND_ID, RECIPE_ID, "2026-08-24T02:00:00.000Z");
  const service = new RecipeCostHistoryReadService(reads({
    listSnapshotsForRecipe: () => Object.freeze([second, first]),
    findSnapshot: (id) => id === FIRST_ID ? first : id === SECOND_ID ? second : undefined
  }));

  const history = service.list(RECIPE_ID);
  assert.equal(history.contractName, "RecipeCostHistory");
  assert.deepEqual(history.entries.map((item) => item.snapshot.costSnapshotId), [FIRST_ID, SECOND_ID]);
  assert.equal(service.latest(RECIPE_ID).snapshot.costSnapshotId, SECOND_ID);
  assert.equal(service.get(RECIPE_ID, FIRST_ID).snapshot.result.lines[0]?.selectedSource.sourceType, "ActualPurchase");
});

test("Recipe Cost History distinguishes empty, foreign, invalid, and technical reads without write authority", () => {
  const empty = new RecipeCostHistoryReadService(reads());
  assert.deepEqual(empty.list(RECIPE_ID).entries, []);
  assert.throws(() => empty.latest(RECIPE_ID), RecipeCostHistoryReadNotFound);
  assert.throws(() => empty.get(RECIPE_ID, FIRST_ID), RecipeCostHistoryReadNotFound);
  assert.throws(() => empty.list(" "), RecipeCostHistoryReadValidationFailure);
  assert.throws(() => empty.get(RECIPE_ID, "not-a-snapshot"), RecipeCostHistoryReadValidationFailure);

  const foreign = snapshot(FIRST_ID, OTHER_RECIPE_ID, "2026-08-24T02:00:00.000Z");
  const foreignService = new RecipeCostHistoryReadService(reads({ findSnapshot: () => foreign }));
  assert.throws(() => foreignService.get(RECIPE_ID, FIRST_ID), RecipeCostHistoryReadNotFound);

  const failed = new RecipeCostHistoryReadService(reads({
    listSnapshotsForRecipe: () => { throw new Error("raw SQLite table detail"); }
  }));
  assert.throws(() => failed.list(RECIPE_ID), RecipeCostHistoryReadPersistenceFailure);
  assert.equal(CostSnapshotId.parse(FIRST_ID).value, FIRST_ID);
});
