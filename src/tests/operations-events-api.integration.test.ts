import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { createRosServer } from "../server/index.js";

async function request(baseUrl: string, pathname: string, method = "GET", body?: unknown): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${pathname}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}
async function saveZeroCloseout(baseUrl: string, eventId: string) {
  const statistics = await request(baseUrl, `/api/events/${eventId}/statistics`);
  return request(baseUrl, `/api/events/${eventId}/closeout`, "PUT", { cashReceived: 0, linePayReceived: 0, otherReceived: 0, wasteAmount: 0, notes: "", items: statistics.body.data.inventory.map((item: any) => ({ productVersionId: item.productVersionId, wasteQuantity: 0 })) });
}

test("current event API returns only open event products and empties after close", async () => {
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `operations-api-${randomUUID()}.sqlite`) });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string"); const baseUrl = `http://127.0.0.1:${address.port}`;
  const category = await request(baseUrl, "/api/admin/categories", "POST", { displayName: "飯類", sortOrder: 1 });
  const product = await request(baseUrl, "/api/admin/products", "POST", { internalName: "東坡肉飯", categoryId: category.body.data.categoryId, displayName: "東坡肉飯", posName: "東坡", sellingPrice: 180, channels: ["pos"] });
  await request(baseUrl, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
  const event = await request(baseUrl, "/api/admin/events", "POST", { eventCode: "20260720-night", displayName: "7/20 晚場", date: "2026-07-20", startTime: "17:00", endTime: "22:00" });
  const contract = (await request(baseUrl, "/api/catalog/products/published")).body.data[0];
  const allocation = await request(baseUrl, `/api/admin/events/${event.body.data.eventId}/sellable-inventory`, "PUT", { productVersionId: contract.productVersionId, plannedQuantity: 20, safetyBufferQuantity: 1 });
  assert.equal(allocation.status, 200);
  assert.equal(allocation.body.data.remainingQuantity, 20);
  assert.equal(allocation.body.data.safetyBufferQuantity, 1);
  assert.equal(allocation.body.data.customerAvailableQuantity, 19);
  await request(baseUrl, `/api/admin/events/${event.body.data.eventId}/open`, "POST", {});
  const current = await request(baseUrl, "/api/events/current"); assert.equal(current.body.data.eventCode, "20260720-night");
  const products = await request(baseUrl, "/api/events/current/products"); assert.deepEqual(products.body.data[0].remainingQuantity, 20); assert.equal(products.body.data[0].safetyBufferQuantity, 1); assert.equal(products.body.data[0].customerAvailableQuantity, 19); assert.equal(products.body.data[0].displayCategoryName, "飯類");
  await saveZeroCloseout(baseUrl, event.body.data.eventId);
  await request(baseUrl, `/api/events/${event.body.data.eventId}/close`, "POST", { confirmed: true });
  assert.deepEqual((await request(baseUrl, "/api/events/current/products")).body.data, []);
  server.close(); await once(server, "close");
});

test("OPEN Event keeps its Product Contract v2 snapshot after Catalog republishes", async () => {
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `operations-snapshot-${randomUUID()}.sqlite`) });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string"); const baseUrl = `http://127.0.0.1:${address.port}`;
  const category = await request(baseUrl, "/api/admin/categories", "POST", { displayName: "飯類", sortOrder: 1 });
  const product = await request(baseUrl, "/api/admin/products", "POST", { internalName: "東坡肉飯", categoryId: category.body.data.categoryId, displayName: "東坡肉飯", posName: "東坡", sellingPrice: 180, channels: ["pos"] });
  const firstPublish = await request(baseUrl, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
  const firstEvent = await request(baseUrl, "/api/admin/events", "POST", { eventCode: "first", displayName: "第一場", date: "2026-07-20", startTime: "11:00", endTime: "14:00" });
  await request(baseUrl, `/api/admin/events/${firstEvent.body.data.eventId}/sellable-inventory`, "PUT", { productVersionId: firstPublish.body.data.contract.productVersionId, plannedQuantity: 20 });
  await request(baseUrl, `/api/admin/events/${firstEvent.body.data.eventId}/open`, "POST", {});

  await request(baseUrl, `/api/admin/products/${product.body.data.productId}`, "PATCH", { sellingPrice: 190 });
  const secondPublish = await request(baseUrl, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
  const liveFirstEvent = await request(baseUrl, "/api/events/current/products");
  assert.equal(liveFirstEvent.body.data[0].sellingPrice, 180);
  assert.equal(liveFirstEvent.body.data[0].productVersionId, firstPublish.body.data.contract.productVersionId);

  await saveZeroCloseout(baseUrl, firstEvent.body.data.eventId);
  await request(baseUrl, `/api/events/${firstEvent.body.data.eventId}/close`, "POST", { confirmed: true });
  const secondEvent = await request(baseUrl, "/api/admin/events", "POST", { eventCode: "second", displayName: "第二場", date: "2026-07-20", startTime: "17:00", endTime: "22:00" });
  await request(baseUrl, `/api/admin/events/${secondEvent.body.data.eventId}/sellable-inventory`, "PUT", { productVersionId: secondPublish.body.data.contract.productVersionId, plannedQuantity: 20 });
  await request(baseUrl, `/api/admin/events/${secondEvent.body.data.eventId}/open`, "POST", {});
  const liveSecondEvent = await request(baseUrl, "/api/events/current/products");
  assert.equal(liveSecondEvent.body.data[0].sellingPrice, 190);
  assert.equal(liveSecondEvent.body.data[0].productVersionId, secondPublish.body.data.contract.productVersionId);
  server.close(); await once(server, "close");
});

test("a PAUSED Event keeps Kitchen-readable snapshots while batch inventory saves remain atomic", async () => {
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `operations-paused-${randomUUID()}.sqlite`) });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string"); const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const category = await request(baseUrl, "/api/admin/categories", "POST", { displayName: "Meals", sortOrder: 1 });
    const product = await request(baseUrl, "/api/admin/products", "POST", { internalName: "Meal", categoryId: category.body.data.categoryId, displayName: "Meal", posName: "Meal", sellingPrice: 100, channels: ["pos"] });
    const published = await request(baseUrl, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
    const event = await request(baseUrl, "/api/admin/events", "POST", { displayName: "Lunch", date: "2026-07-30", startTime: "11:00", endTime: "14:00" });
    const eventId = event.body.data.eventId;
    const batch = { idempotencyKey: "draft-batch", operator: "Owner", items: [{ productVersionId: published.body.data.contract.productVersionId, plannedQuantity: 4, safetyBufferQuantity: 1, isEnabled: true }] };
    assert.equal((await request(baseUrl, `/api/admin/events/${eventId}/sellable-inventory`, "PUT", batch)).status, 200);
    await request(baseUrl, `/api/admin/events/${eventId}/open`, "POST", {});
    assert.equal((await request(baseUrl, `/api/admin/events/${eventId}/pause`, "POST", {})).body.data.status, "paused");
    assert.equal((await request(baseUrl, "/api/events/current")).body.data.status, "paused");
    assert.equal((await request(baseUrl, "/api/events/current/products")).body.data.length, 1);
    const blockedOrder = await request(baseUrl, "/api/orders", "POST", { source: "pos", eventId, idempotencyKey: "paused-order", items: [{ productId: published.body.data.contract.productId, productVersionId: published.body.data.contract.productVersionId, quantity: 1, notes: null }], customerName: null, customerPhoneTail: null, paymentMethod: "CASH", notes: null });
    assert.equal(blockedOrder.status, 409); assert.equal(blockedOrder.body.error.code, "EVENT_NOT_OPEN");
    const pausedBatch = { ...batch, idempotencyKey: "paused-batch", items: [{ ...batch.items[0], plannedQuantity: 5, safetyBufferQuantity: 2 }] };
    const saved = await request(baseUrl, `/api/admin/events/${eventId}/sellable-inventory`, "PUT", pausedBatch);
    assert.equal(saved.status, 200); assert.equal(saved.body.data.inventory[0].plannedQuantity, 5); assert.equal(saved.body.data.inventory[0].customerAvailableQuantity, 3);
    const replay = await request(baseUrl, `/api/admin/events/${eventId}/sellable-inventory`, "PUT", pausedBatch); assert.equal(replay.body.data.replayed, true);
    await request(baseUrl, `/api/admin/events/${eventId}/resume`, "POST", {});
    const locked = await request(baseUrl, `/api/admin/events/${eventId}/sellable-inventory`, "PUT", { ...pausedBatch, idempotencyKey: "open-batch" }); assert.equal(locked.status, 422); assert.equal(locked.body.error.code, "event_inventory_locked");
    await request(baseUrl, `/api/admin/events/${eventId}/pause`, "POST", {});
    assert.equal((await saveZeroCloseout(baseUrl, eventId)).status, 200);
    assert.equal((await request(baseUrl, `/api/events/${eventId}/close`, "POST", { confirmed: true })).status, 200);
  } finally { server.close(); await once(server, "close"); }
});

test("events can omit eventCode and receive a same-day sequence", async () => {
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `operations-event-code-${randomUUID()}.sqlite`) });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string"); const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const first = await request(baseUrl, "/api/admin/events", "POST", { displayName: "Lunch", date: "2026-07-26", startTime: "11:00", endTime: "14:00" });
    const second = await request(baseUrl, "/api/admin/events", "POST", { displayName: "Dinner", date: "2026-07-26", startTime: "17:00", endTime: "21:00" });
    const otherDate = await request(baseUrl, "/api/admin/events", "POST", { displayName: "Next Day", date: "2026-07-27", startTime: "11:00", endTime: "14:00" });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(otherDate.status, 201);
    assert.equal(first.body.data.eventCode, "20260726-01");
    assert.equal(second.body.data.eventCode, "20260726-02");
    assert.equal(otherDate.body.data.eventCode, "20260727-01");
  } finally {
    server.close(); await once(server, "close");
  }
});
