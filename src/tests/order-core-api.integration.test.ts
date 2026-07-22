import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import path from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { createRosServer } from "../server/index.js";

async function request(baseUrl: string, pathname: string, method = "GET", body?: unknown): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${pathname}`, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), connection: "close" }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}

async function closeServer(server: Server): Promise<void> {
  const closed = once(server, "close");
  server.close();
  server.closeAllConnections();
  await closed;
}

async function setup(quantity = 2) {
  const databasePath = path.resolve("data", `order-api-${randomUUID()}.sqlite`);
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string"); const baseUrl = `http://127.0.0.1:${address.port}`;
  const category = await request(baseUrl, "/api/admin/categories", "POST", { displayName: "Rice", sortOrder: 1 });
  const product = await request(baseUrl, "/api/admin/products", "POST", { internalName: "Braised Rice", categoryId: category.body.data.categoryId, displayName: "Braised Rice", posName: "Rice", sellingPrice: 180, channels: ["pos"] });
  const published = await request(baseUrl, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
  const event = await request(baseUrl, "/api/admin/events", "POST", { eventCode: "YONG", displayName: "Night market", date: "2026-07-20", startTime: "17:00", endTime: "22:00" });
  await request(baseUrl, `/api/admin/events/${event.body.data.eventId}/sellable-inventory`, "PUT", { productVersionId: published.body.data.contract.productVersionId, plannedQuantity: quantity });
  await request(baseUrl, `/api/admin/events/${event.body.data.eventId}/open`, "POST", {});
  return { server, baseUrl, databasePath, eventId: event.body.data.eventId, product: published.body.data.contract };
}

function payload(eventId: string, product: any, key: string) {
  return { source: "pos", eventId, idempotencyKey: key, items: [{ productId: product.productId, productVersionId: product.productVersionId, quantity: 1, notes: null }], customerName: "Miles", customerPhoneTail: "1234", paymentMethod: "CASH", notes: null };
}

function readAuditCount(databasePath: string): number {
  const database = new Database(databasePath, { readonly: true });
  try {
    const row = database.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'order_created'").get() as { count: number };
    return row.count;
  } finally {
    database.close();
  }
}

test("Order API creates, replays, retrieves public snapshots, and never exposes request fingerprints", async () => {
  const { server, baseUrl, eventId, product } = await setup(2);
  try {
    const first = await request(baseUrl, "/api/orders", "POST", payload(eventId, product, "pos-one"));
    assert.equal(first.status, 201); assert.equal(first.body.data.orderNumber, "YONG-001");
    assert.equal(first.body.data.customerName, "Miles");
    assert.equal(first.body.data.customerPhoneTail, "1234");
    assert.equal(first.body.data.paymentMethod, "CASH");
    assert.equal(first.body.data.servedAt, null);
    assert.equal(JSON.stringify(first.body.data).includes("requestFingerprint"), false);
    const replay = await request(baseUrl, "/api/orders", "POST", payload(eventId, product, "pos-one"));
    assert.equal(replay.status, 200); assert.equal(replay.body.data.orderId, first.body.data.orderId);
    const get = await request(baseUrl, `/api/orders/${first.body.data.orderId}`);
    assert.equal(get.status, 200); assert.equal(get.body.data.items[0].unitSellingPrice, 180);
    assert.equal((await request(baseUrl, "/api/orders/does-not-exist")).status, 404);
  } finally {
    await closeServer(server);
  }
});

test("two POS requests for the final sellable portion produce one success and one insufficient response", async () => {
  const { server, baseUrl, databasePath, eventId, product } = await setup(1);
  try {
    const [left, right] = await Promise.all([request(baseUrl, "/api/orders", "POST", payload(eventId, product, "race-left")), request(baseUrl, "/api/orders", "POST", payload(eventId, product, "race-right"))]);
    assert.deepEqual([left.status, right.status].sort(), [201, 409]);
    const success = left.status === 201 ? left : right;
    const failure = left.status === 409 ? left : right;
    assert.equal(success.body.data.orderNumber, "YONG-001");
    assert.equal(failure.body.error.code, "INSUFFICIENT_QUANTITY");
    const products = await request(baseUrl, "/api/events/current/products");
    assert.equal(products.body.data.length, 1);
    assert.equal(products.body.data[0].productId, product.productId);
    assert.equal(products.body.data[0].productVersionId, product.productVersionId);
    assert.equal(products.body.data[0].remainingQuantity, 0);
    const inventory = await request(baseUrl, `/api/admin/events/${eventId}/sellable-inventory`);
    assert.equal(inventory.body.data[0].soldQuantity, 1);
    assert.equal(inventory.body.data[0].reservedQuantity, 0);
    assert.equal(inventory.body.data[0].remainingQuantity, 0);
    const orders = await request(baseUrl, `/api/events/${eventId}/orders`);
    assert.equal(orders.body.data.length, 1);
    assert.equal(orders.body.data[0].orderNumber, "YONG-001");
    assert.equal(orders.body.data[0].customerPhoneTail, "1234");
    assert.equal(orders.body.data[0].paymentMethod, "CASH");
    assert.equal(readAuditCount(databasePath), 1);
  } finally {
    await closeServer(server);
  }
});
