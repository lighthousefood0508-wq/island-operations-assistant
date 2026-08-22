import assert from "node:assert/strict";
import test from "node:test";
import {
  CostSupplier,
  InvalidCostSupplier,
  InvalidSupplierIdentity,
  SupplierId
} from "../domains/cost/index.js";

const UUID = "11111111-1111-4111-8111-111111111111";
const CREATED_AT = "2026-08-22T00:00:00.000Z";

function supplier(overrides: Partial<{
  supplierId: SupplierId;
  displayName: string;
  createdAt: string;
  createdBy: string;
  aggregateVersion: number;
}> = {}): CostSupplier {
  return CostSupplier.create({
    supplierId: SupplierId.fromUuid(UUID),
    displayName: "Northern Ingredients",
    createdAt: CREATED_AT,
    createdBy: "owner",
    ...overrides
  });
}

test("Cost Supplier has one Cost-owned sup_<uuid> identity and immutable creation facts", () => {
  const result = supplier();
  assert.equal(result.supplierId.value, `sup_${UUID}`);
  assert.deepEqual(result.toContract(), {
    supplierId: `sup_${UUID}`,
    displayName: "Northern Ingredients",
    createdAt: CREATED_AT,
    createdBy: "owner",
    aggregateVersion: 0
  });
});

test("Supplier identity and v1 creation facts fail closed", () => {
  assert.throws(() => SupplierId.parse("supplier-northern"), InvalidSupplierIdentity);
  assert.throws(() => supplier({ displayName: " " }), InvalidCostSupplier);
  assert.throws(() => supplier({ createdAt: "2026-08-22T00:00:00Z" }), InvalidCostSupplier);
  assert.throws(() => supplier({ aggregateVersion: 1 }), InvalidCostSupplier);
});

test("Supplier display names are descriptive and do not create uniqueness or identity-resolution rules", () => {
  const first = supplier();
  const second = supplier({
    supplierId: SupplierId.fromUuid("22222222-2222-4222-8222-222222222222"),
    displayName: " Northern Ingredients "
  });
  assert.equal(first.displayName, second.displayName);
  assert.equal(first.supplierId.equals(second.supplierId), false);
});
