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
  const allocation = await request(baseUrl, `/api/admin/events/${event.body.data.eventId}/sellable-inventory`, "PUT", { productVersionId: contract.productVersionId, plannedQuantity: 20 });
  assert.equal(allocation.status, 200);
  await request(baseUrl, `/api/admin/events/${event.body.data.eventId}/open`, "POST", {});
  const current = await request(baseUrl, "/api/events/current"); assert.equal(current.body.data.eventCode, "20260720-night");
  const products = await request(baseUrl, "/api/events/current/products"); assert.deepEqual(products.body.data[0].remainingQuantity, 20); assert.equal(products.body.data[0].displayCategoryName, "飯類");
  await request(baseUrl, `/api/admin/events/${event.body.data.eventId}/close`, "POST", {});
  assert.deepEqual((await request(baseUrl, "/api/events/current/products")).body.data, []);
  server.close(); await once(server, "close");
});
