import assert from "node:assert/strict";
import test from "node:test";
import { parseProductContract } from "../shared/contracts/product-contract.js";
import { parseSalesContract } from "../shared/contracts/sales-contract.js";

test("Product Contract v1 accepts published product fields only", () => {
  const contract = parseProductContract({
    contractVersion: "1",
    productId: "product-1",
    productVersionId: "product-version-1",
    categoryId: "category-1",
    displayName: "Sample Meal",
    posName: "Meal",
    sellingPrice: 120,
    channels: ["pos", "preorder"],
    isActive: true,
    publishedAt: "2026-07-20T00:00:00.000Z"
  });
  assert.equal(contract.sellingPrice, 120);
  assert.throws(() => parseProductContract({ ...contract, bom: [] }), /unsupported field/i);
});

test("Sales Contract v1 accepts completed sales facts without cost internals", () => {
  const contract = parseSalesContract({
    contractVersion: "1",
    salesEventId: "sale-event-1",
    orderId: "order-1",
    eventId: "event-1",
    completedAt: "2026-07-20T00:00:00.000Z",
    items: [{ productId: "product-1", productVersionId: "product-version-1", quantity: 2, unitPrice: 120 }],
    channel: "pos"
  });
  assert.equal(contract.items[0]?.quantity, 2);
  assert.throws(() => parseSalesContract({ ...contract, inventoryResult: {} }), /unsupported field/i);
});
