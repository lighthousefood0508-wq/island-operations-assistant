import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { OrderService } from "../domains/operations/application/order-service.js";
import { OperationsService } from "../domains/operations/application/operations-service.js";
import { OrderRepository } from "../domains/operations/infrastructure/order-repository.js";
import { OperationsRepository } from "../domains/operations/infrastructure/operations-repository.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";

const product = { contractVersion: "2" as const, productId: "prod_rice", productVersionId: "pver_rice", categoryId: "cat_rice", displayCategoryName: "Rice", displayCategorySortOrder: 1, displayName: "Braised Rice", posName: "Rice", sellingPrice: 180, channels: ["pos"], isActive: true, publishedAt: "2026-07-20T00:00:00.000Z" };

function fixture(quantity = 2) {
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `order-core-${randomUUID()}.sqlite`) });
  runMigrations(database);
  const operations = new OperationsService(new OperationsRepository(database));
  const orders = new OrderService(new OrderRepository(database));
  const event = operations.createEvent({ eventCode: "YONG", displayName: "Night market", date: "2026-07-20", startTime: "17:00", endTime: "22:00" });
  operations.setSellableInventory(event.eventId, product, { plannedQuantity: quantity });
  operations.openEvent(event.eventId);
  return { database, event, orders, inventory: new OrderRepository(database) };
}

function payload(eventId: string, key: string, quantity = 1) {
  return { source: "pos", eventId, idempotencyKey: key, items: [{ productId: product.productId, productVersionId: product.productVersionId, quantity, notes: "less sauce" }], customerName: null, notes: "counter" };
}

test("POS order atomically creates frozen snapshots and decrements sellable quantity", () => {
  const { database, event, orders, inventory } = fixture(2);
  const result = orders.createPosOrder(payload(event.eventId, "terminal-a-1"));
  assert.equal(result.replayed, false);
  assert.equal(result.order.orderNumber, "YONG-001");
  assert.equal(result.order.orderStatus, "confirmed");
  assert.equal(result.order.paymentStatus, "unpaid");
  assert.equal(result.order.productionStatus, "not_started");
  assert.equal(result.order.grandTotal, 180);
  assert.deepEqual(result.order.items[0], { orderItemId: result.order.items[0]?.orderItemId, productId: product.productId, productVersionId: product.productVersionId, displayNameSnapshot: "Braised Rice", posNameSnapshot: "Rice", displayCategoryNameSnapshot: "Rice", unitListPrice: 180, unitSellingPrice: 180, quantity: 1, lineDiscount: 0, lineTotal: 180, notes: "less sauce", costStatus: "unavailable" });
  assert.deepEqual(inventory.getInventoryState(event.eventId, product.productVersionId), { soldQuantity: 1, remainingQuantity: 1 });
  assert.equal(database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'order_created' AND entity_id = ?", [result.order.orderId])?.count, 1);
  database.close();
});

test("idempotent replay returns the original order without a second deduction or audit record", () => {
  const { database, event, orders, inventory } = fixture(2);
  const first = orders.createPosOrder(payload(event.eventId, "terminal-a-1"));
  const replay = orders.createPosOrder(payload(event.eventId, "terminal-a-1"));
  assert.equal(replay.replayed, true);
  assert.equal(replay.order.orderId, first.order.orderId);
  assert.deepEqual(inventory.getInventoryState(event.eventId, product.productVersionId), { soldQuantity: 1, remainingQuantity: 1 });
  assert.equal(database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'order_created'")?.count, 1);
  assert.throws(() => orders.createPosOrder(payload(event.eventId, "terminal-a-1", 2)), (error: unknown) => (error as { code?: string }).code === "IDEMPOTENCY_CONFLICT");
  database.close();
});

test("the same idempotency key is independently scoped to another Event", () => {
  const { database, event, orders } = fixture(2);
  orders.createPosOrder(payload(event.eventId, "shared-terminal-key"));
  database.execute("UPDATE operations_events SET status = 'closed' WHERE event_id = ?", [event.eventId]);
  const operations = new OperationsService(new OperationsRepository(database));
  const second = operations.createEvent({ eventCode: "YONG2", displayName: "Later market", date: "2026-07-21", startTime: "17:00", endTime: "22:00" });
  operations.setSellableInventory(second.eventId, product, { plannedQuantity: 1 });
  operations.openEvent(second.eventId);
  const result = orders.createPosOrder(payload(second.eventId, "shared-terminal-key"));
  assert.equal(result.order.orderNumber, "YONG2-001");
  database.close();
});

test("insufficient multi-item request rolls back all quantity and does not consume an order number", () => {
  const { database, event, orders, inventory } = fixture(1);
  assert.throws(() => orders.createPosOrder({ ...payload(event.eventId, "too-many"), items: [{ productId: product.productId, productVersionId: product.productVersionId, quantity: 1, notes: null }, { productId: product.productId, productVersionId: product.productVersionId, quantity: 1, notes: "extra" }] }), (error: unknown) => (error as { code?: string }).code === "INSUFFICIENT_QUANTITY");
  assert.deepEqual(inventory.getInventoryState(event.eventId, product.productVersionId), { soldQuantity: 0, remainingQuantity: 1 });
  const result = orders.createPosOrder(payload(event.eventId, "after-rollback"));
  assert.equal(result.order.orderNumber, "YONG-001");
  database.close();
});

test("order validation rejects closed events, wrong Event snapshots, unsupported sources, and invalid quantities", () => {
  const { database, event, orders } = fixture(2);
  assert.throws(() => orders.createPosOrder({ ...payload(event.eventId, "source"), source: "kiosk" }), (error: unknown) => (error as { code?: string }).code === "UNSUPPORTED_ORDER_SOURCE");
  assert.throws(() => orders.createPosOrder({ ...payload(event.eventId, "qty"), items: [{ productId: product.productId, productVersionId: product.productVersionId, quantity: 0, notes: null }] }), (error: unknown) => (error as { code?: string }).code === "INVALID_QUANTITY");
  assert.throws(() => orders.createPosOrder({ ...payload(event.eventId, "version"), items: [{ productId: product.productId, productVersionId: "pver_other", quantity: 1, notes: null }] }), (error: unknown) => (error as { code?: string }).code === "PRODUCT_VERSION_MISMATCH");
  assert.throws(() => orders.createPosOrder({ ...payload(event.eventId, "missing"), items: [{ productId: "prod_missing", productVersionId: "pver_missing", quantity: 1, notes: null }] }), (error: unknown) => (error as { code?: string }).code === "PRODUCT_NOT_IN_EVENT");
  database.execute("UPDATE operations_events SET status = 'closed' WHERE event_id = ?", [event.eventId]);
  assert.throws(() => orders.createPosOrder(payload(event.eventId, "closed")), (error: unknown) => (error as { code?: string }).code === "EVENT_NOT_OPEN");
  database.close();
});
