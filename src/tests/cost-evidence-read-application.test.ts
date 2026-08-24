import assert from "node:assert/strict";
import test from "node:test";
import {
  CostEvidenceReadNotFound,
  CostEvidenceReadPersistenceFailure,
  CostEvidenceReadService,
  CostEvidenceReadValidationFailure,
  type CostEvidenceReadPort
} from "../domains/cost/index.js";

const SUPPLIER_ID = "sup_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PURCHASE_ID = "pur_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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

test("Cost Evidence Read coordinates existing evidence contracts without write authority", () => {
  const service = new CostEvidenceReadService(reads({
    findSupplier: (supplierId) => supplierId === SUPPLIER_ID
      ? Object.freeze({ supplierId, displayName: "Supplier", createdAt: "2026-08-24T00:00:00.000Z", createdBy: "owner", aggregateVersion: 0 })
      : undefined,
    findPurchase: (purchaseId) => purchaseId === PURCHASE_ID
      ? Object.freeze({ purchaseId, supplierId: SUPPLIER_ID, state: "Recorded", lines: Object.freeze([]), createdAt: "2026-08-24T00:00:00.000Z", createdBy: "owner", changedAt: "2026-08-24T00:00:00.000Z", changedBy: "owner", recordedAt: "2026-08-24T00:00:00.000Z", recordedBy: "owner", aggregateVersion: 1 })
      : undefined
  }));
  assert.equal(service.getSupplier(SUPPLIER_ID).displayName, "Supplier");
  assert.equal(service.getPurchase(PURCHASE_ID).state, "Recorded");
  assert.deepEqual(service.listAcceptedPurchasesForPurchase(PURCHASE_ID), []);
});

test("Cost Evidence Read distinguishes invalid identity, absence, and technical failures", () => {
  const missing = new CostEvidenceReadService(reads());
  assert.throws(() => missing.getSupplier("not-a-supplier"), CostEvidenceReadValidationFailure);
  assert.throws(() => missing.getSupplier(SUPPLIER_ID), CostEvidenceReadNotFound);
  const failed = new CostEvidenceReadService(reads({
    listSuppliers: () => { throw new Error("raw SQLite table detail"); }
  }));
  assert.throws(() => failed.listSuppliers(), CostEvidenceReadPersistenceFailure);
});
