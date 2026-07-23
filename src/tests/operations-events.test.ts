import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";
import { OperationsService } from "../domains/operations/application/operations-service.js";
import { OperationsRepository } from "../domains/operations/infrastructure/operations-repository.js";

function fixture() {
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `operations-events-${randomUUID()}.sqlite`) });
  runMigrations(database);
  return { database, service: new OperationsService(new OperationsRepository(database)) };
}
const product = { contractVersion: "2" as const, productId: "prod_1", productVersionId: "pver_1", categoryId: "cat_1", displayCategoryName: "飯類", displayCategorySortOrder: 1, displayName: "東坡肉飯", posName: "東坡", sellingPrice: 180, channels: ["pos"], isActive: true, publishedAt: "2026-07-20T00:00:00.000Z" };

test("an event opens with sellable inventory and exposes remaining product snapshots", () => {
  const { database, service } = fixture();
  const event = service.createEvent({ eventCode: "20260720-night", displayName: "7/20 晚場", date: "2026-07-20", startTime: "17:00", endTime: "22:00" });
  const inventory = service.setSellableInventory(event.eventId, product, { plannedQuantity: 20 });
  assert.equal(inventory.remainingQuantity, 20);
  assert.equal(inventory.safetyBufferQuantity, 0);
  assert.equal(inventory.customerAvailableQuantity, 20);
  const opened = service.openEvent(event.eventId);
  assert.equal(opened.status, "open");
  assert.deepEqual(service.getCurrentProducts(), [{ ...product, remainingQuantity: 20, safetyBufferQuantity: 0, customerAvailableQuantity: 20 }]);
  database.close();
});

test("an OPEN Event retains an active published product snapshot when it is sold out", () => {
  const { database, service } = fixture();
  const event = service.createEvent({ eventCode: "sold-out", displayName: "售完測試", date: "2026-07-20", startTime: "17:00", endTime: "22:00" });
  service.setSellableInventory(event.eventId, product, { plannedQuantity: 1 });
  service.setSellableInventory(event.eventId, { ...product, productId: "prod_sold", productVersionId: "pver_sold", displayName: "售完商品", posName: "售完" }, { plannedQuantity: 0 });
  service.openEvent(event.eventId);
  assert.deepEqual(service.getCurrentProducts().map((item) => ({ productId: item.productId, remainingQuantity: item.remainingQuantity, customerAvailableQuantity: item.customerAvailableQuantity })), [{ productId: "prod_sold", remainingQuantity: 0, customerAvailableQuantity: 0 }, { productId: "prod_1", remainingQuantity: 1, customerAvailableQuantity: 1 }]);
  database.close();
});

test("only one event can be open and an empty event cannot open", () => {
  const { database, service } = fixture();
  const first = service.createEvent({ eventCode: "first", displayName: "第一場", date: "2026-07-20", startTime: "11:00", endTime: "14:00" });
  assert.throws(() => service.openEvent(first.eventId), /sellable product/);
  service.setSellableInventory(first.eventId, product, { plannedQuantity: 1 });
  service.openEvent(first.eventId);
  const second = service.createEvent({ eventCode: "second", displayName: "第二場", date: "2026-07-20", startTime: "17:00", endTime: "22:00" });
  service.setSellableInventory(second.eventId, { ...product, productId: "prod_2", productVersionId: "pver_2" }, { plannedQuantity: 1 });
  assert.throws(() => service.openEvent(second.eventId), /Only one event can be open/);
  database.close();
});
