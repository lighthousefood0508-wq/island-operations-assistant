import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { createRosServer } from "../server/index.js";

async function request(baseUrl: string, pathName: string, method = "GET", body?: unknown): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${pathName}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}
async function setup(quantity = 2) {
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `lifecycle-${randomUUID()}.sqlite`) }); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string"); const baseUrl = `http://127.0.0.1:${address.port}`;
  const category = await request(baseUrl, "/api/admin/categories", "POST", { displayName: "Meal", sortOrder: 1 });
  const product = await request(baseUrl, "/api/admin/products", "POST", { internalName: "Meal", categoryId: category.body.data.categoryId, displayName: "Meal", posName: "Meal", sellingPrice: 100, channels: ["pos"] });
  const published = await request(baseUrl, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
  const event = await request(baseUrl, "/api/admin/events", "POST", { eventCode: "LIFE", displayName: "Lifecycle", date: "2026-07-20", startTime: "17:00", endTime: "22:00" });
  await request(baseUrl, `/api/admin/events/${event.body.data.eventId}/sellable-inventory`, "PUT", { productVersionId: published.body.data.contract.productVersionId, plannedQuantity: quantity });
  await request(baseUrl, `/api/admin/events/${event.body.data.eventId}/open`, "POST", {});
  return { server, baseUrl, eventId: event.body.data.eventId, product: published.body.data.contract };
}
async function createOrder(baseUrl: string, eventId: string, product: any, key: string, customerName: string | null = null) { return request(baseUrl, "/api/orders", "POST", { source: "pos", eventId, idempotencyKey: key, items: [{ productId: product.productId, productVersionId: product.productVersionId, quantity: 1, notes: null }], customerName, customerPhoneTail: customerName ? "1234" : null, paymentMethod: "LINE_PAY", notes: null }); }
async function saveZeroCloseout(baseUrl: string, eventId: string) {
  const statistics = await request(baseUrl, `/api/events/${eventId}/statistics`);
  return request(baseUrl, `/api/events/${eventId}/closeout`, "PUT", { cashReceived: 0, linePayReceived: 0, otherReceived: 0, wasteAmount: 0, notes: "", items: statistics.body.data.inventory.map((item: any) => ({ productVersionId: item.productVersionId, wasteQuantity: 0 })) });
}

test("lifecycle keeps Order, Payment, and Production states separate", async () => {
  const { server, baseUrl, eventId, product } = await setup(); const created = await createOrder(baseUrl, eventId, product, "life-a", "Miles"); const id = created.body.data.orderId;
  assert.equal(created.body.data.orderStatus, "confirmed"); assert.equal(created.body.data.paymentStatus, "unpaid"); assert.equal(created.body.data.productionStatus, "not_started");
  const list = await request(baseUrl, `/api/events/${eventId}/orders`);
  assert.equal(list.body.data[0].customerName, "Miles");
  assert.equal(list.body.data[0].customerPhoneTail, "1234");
  assert.equal(list.body.data[0].paymentMethod, "LINE_PAY");
  assert.equal((await request(baseUrl, `/api/orders/${id}/status`, "PATCH", { status: "ready" })).status, 409);
  assert.equal((await request(baseUrl, `/api/orders/${id}/status`, "PATCH", { status: "preparing" })).body.data.productionStatus, "preparing");
  assert.equal((await request(baseUrl, `/api/orders/${id}/status`, "PATCH", { status: "ready" })).body.data.productionStatus, "ready");
  const served = await request(baseUrl, `/api/orders/${id}/status`, "PATCH", { status: "served" });
  assert.equal(served.body.data.productionStatus, "served");
  assert.match(served.body.data.servedAt, /^20/);
  assert.match((await request(baseUrl, `/api/events/${eventId}/orders`)).body.data[0].servedAt, /^20/);
  const incomplete = await request(baseUrl, `/api/orders/${id}/status`, "PATCH", { status: "completed" }); assert.equal(incomplete.status, 409); assert.equal(incomplete.body.error.code, "ORDER_COMPLETION_REQUIREMENTS_NOT_MET");
  server.close(); await once(server, "close");
});

test("scheduled POS order is projected to lifecycle and statistics read models", async () => {
  const { server, baseUrl, eventId, product } = await setup();
  try {
    const created = await request(baseUrl, "/api/orders", "POST", {
      source: "pos",
      eventId,
      idempotencyKey: "scheduled-life-a",
      items: [{ productId: product.productId, productVersionId: product.productVersionId, quantity: 1, notes: null }],
      pickupTime: "18:30",
      customerName: "Miles",
      customerPhoneTail: "1234",
      paymentMethod: "CASH",
      notes: null
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.source, "pos");
    assert.equal(created.body.data.scheduledPickupAt, "2026-07-20T18:30:00+08:00");

    const list = await request(baseUrl, `/api/events/${eventId}/orders`);
    assert.equal(list.body.data[0].scheduledPickupAt, "2026-07-20T18:30:00+08:00");

    const statistics = await request(baseUrl, `/api/events/${eventId}/statistics`);
    assert.equal(statistics.body.data.orderCount, 1);
    assert.equal(statistics.body.data.scheduledOrderCount, 1);
    assert.equal(statistics.body.data.inventory[0].remainingQuantity, 1);
  } finally {
    server.close();
    await once(server, "close");
  }
});
test("manual no-show release is confirmed, idempotent, and restores inventory once", async () => {
  const { server, baseUrl, eventId, product } = await setup(1); const order = await createOrder(baseUrl, eventId, product, "no-show"); const id = order.body.data.orderId;
  const noShow = await request(baseUrl, `/api/orders/${id}/no-show`, "POST", {}); assert.equal(noShow.body.data.orderStatus, "cancelled"); assert.equal(noShow.body.data.cancellationReason, "no_show");
  assert.equal((await request(baseUrl, `/api/orders/${id}/release-inventory`, "POST", {})).status, 400);
  const [left, right] = await Promise.all([request(baseUrl, `/api/orders/${id}/release-inventory`, "POST", { confirmed: true }), request(baseUrl, `/api/orders/${id}/release-inventory`, "POST", { confirmed: true })]);
  assert.deepEqual([left.body.data.released, right.body.data.released].sort(), [false, true]);
  const products = await request(baseUrl, "/api/events/current/products"); assert.equal(products.body.data[0].remainingQuantity, 1);
  server.close(); await once(server, "close");
});

test("Event Close blocks unresolved orders, creates an idempotent daily report, and locks Event", async () => {
  const { server, baseUrl, eventId, product } = await setup(); const order = await createOrder(baseUrl, eventId, product, "close"); const id = order.body.data.orderId;
  const blocked = await request(baseUrl, `/api/events/${eventId}/close`, "POST", { confirmed: true }); assert.equal(blocked.status, 409); assert.equal(blocked.body.error.code, "EVENT_CLOSE_BLOCKED");
  await request(baseUrl, `/api/orders/${id}/no-show`, "POST", {});
  assert.equal((await saveZeroCloseout(baseUrl, eventId)).status, 200);
  const [left, right] = await Promise.all([request(baseUrl, `/api/events/${eventId}/close`, "POST", { confirmed: true }), request(baseUrl, `/api/events/${eventId}/close`, "POST", { confirmed: true })]);
  assert.equal(left.status, 200); assert.equal(right.status, 200); assert.deepEqual(left.body.data.report, right.body.data.report);
  const report = await request(baseUrl, `/api/events/${eventId}/daily-report`); assert.equal(report.body.data.orders.noShow, 1);
  const locked = await createOrder(baseUrl, eventId, product, "after-close"); assert.equal(locked.status, 409); assert.equal(locked.body.error.code, "EVENT_NOT_OPEN");
  server.close(); await once(server, "close");
});
