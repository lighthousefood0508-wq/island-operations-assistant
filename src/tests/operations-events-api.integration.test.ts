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

test("current event API returns only open event products and empties after close", async () => {
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `operations-api-${randomUUID()}.sqlite`) });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string"); const baseUrl = `http://127.0.0.1:${address.port}`;
  const category = await request(baseUrl, "/api/admin/categories", "POST", { code: "rice", displayName: "飯類", sortOrder: 1 });
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
  await request(baseUrl, `/api/events/${event.body.data.eventId}/close`, "POST", { confirmed: true });
  assert.deepEqual((await request(baseUrl, "/api/events/current/products")).body.data, []);
  server.close(); await once(server, "close");
});

test("OPEN Event keeps its Product Contract v2 snapshot after Catalog republishes", async () => {
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `operations-snapshot-${randomUUID()}.sqlite`) });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string"); const baseUrl = `http://127.0.0.1:${address.port}`;
  const category = await request(baseUrl, "/api/admin/categories", "POST", { code: "rice", displayName: "飯類", sortOrder: 1 });
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

  await request(baseUrl, `/api/events/${firstEvent.body.data.eventId}/close`, "POST", { confirmed: true });
  const secondEvent = await request(baseUrl, "/api/admin/events", "POST", { eventCode: "second", displayName: "第二場", date: "2026-07-20", startTime: "17:00", endTime: "22:00" });
  await request(baseUrl, `/api/admin/events/${secondEvent.body.data.eventId}/sellable-inventory`, "PUT", { productVersionId: secondPublish.body.data.contract.productVersionId, plannedQuantity: 20 });
  await request(baseUrl, `/api/admin/events/${secondEvent.body.data.eventId}/open`, "POST", {});
  const liveSecondEvent = await request(baseUrl, "/api/events/current/products");
  assert.equal(liveSecondEvent.body.data[0].sellingPrice, 190);
  assert.equal(liveSecondEvent.body.data[0].productVersionId, secondPublish.body.data.contract.productVersionId);
  server.close(); await once(server, "close");
});
