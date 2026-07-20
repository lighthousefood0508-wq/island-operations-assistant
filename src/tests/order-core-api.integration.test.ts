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

async function setup(quantity = 2) {
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `order-api-${randomUUID()}.sqlite`) });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string"); const baseUrl = `http://127.0.0.1:${address.port}`;
  const category = await request(baseUrl, "/api/admin/categories", "POST", { code: "rice", displayName: "Rice", sortOrder: 1 });
  const product = await request(baseUrl, "/api/admin/products", "POST", { internalName: "Braised Rice", categoryId: category.body.data.categoryId, displayName: "Braised Rice", posName: "Rice", sellingPrice: 180, channels: ["pos"] });
  const published = await request(baseUrl, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
  const event = await request(baseUrl, "/api/admin/events", "POST", { eventCode: "YONG", displayName: "Night market", date: "2026-07-20", startTime: "17:00", endTime: "22:00" });
  await request(baseUrl, `/api/admin/events/${event.body.data.eventId}/sellable-inventory`, "PUT", { productVersionId: published.body.data.contract.productVersionId, plannedQuantity: quantity });
  await request(baseUrl, `/api/admin/events/${event.body.data.eventId}/open`, "POST", {});
  return { server, baseUrl, eventId: event.body.data.eventId, product: published.body.data.contract };
}

function payload(eventId: string, product: any, key: string) {
  return { source: "pos", eventId, idempotencyKey: key, items: [{ productId: product.productId, productVersionId: product.productVersionId, quantity: 1, notes: null }], customerName: null, notes: null };
}

test("Order API creates, replays, retrieves public snapshots, and never exposes request fingerprints", async () => {
  const { server, baseUrl, eventId, product } = await setup(2);
  const first = await request(baseUrl, "/api/orders", "POST", payload(eventId, product, "pos-one"));
  assert.equal(first.status, 201); assert.equal(first.body.data.orderNumber, "YONG-001");
  assert.equal(JSON.stringify(first.body.data).includes("requestFingerprint"), false);
  const replay = await request(baseUrl, "/api/orders", "POST", payload(eventId, product, "pos-one"));
  assert.equal(replay.status, 200); assert.equal(replay.body.data.orderId, first.body.data.orderId);
  const get = await request(baseUrl, `/api/orders/${first.body.data.orderId}`);
  assert.equal(get.status, 200); assert.equal(get.body.data.items[0].unitSellingPrice, 180);
  assert.equal((await request(baseUrl, "/api/orders/does-not-exist")).status, 404);
  server.close(); await once(server, "close");
});

test("two POS requests for the final sellable portion produce one success and one insufficient response", async () => {
  const { server, baseUrl, eventId, product } = await setup(1);
  const [left, right] = await Promise.all([request(baseUrl, "/api/orders", "POST", payload(eventId, product, "race-left")), request(baseUrl, "/api/orders", "POST", payload(eventId, product, "race-right"))]);
  assert.deepEqual([left.status, right.status].sort(), [201, 409]);
  const failure = left.status === 409 ? left : right;
  assert.equal(failure.body.error.code, "INSUFFICIENT_QUANTITY");
  const products = await request(baseUrl, "/api/events/current/products");
  assert.deepEqual(products.body.data, []);
  server.close(); await once(server, "close");
});
