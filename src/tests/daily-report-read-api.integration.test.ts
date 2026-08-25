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

test("Daily Report read APIs expose only stored closed evidence with safe failures", async () => {
  const databasePath = path.resolve("data", `daily-report-api-${randomUUID()}.sqlite`);
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string"); const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const category = await request(baseUrl, "/api/admin/categories", "POST", { displayName: "Daily API category", sortOrder: 1 });
    const product = await request(baseUrl, "/api/admin/products", "POST", { internalName: "Daily API product", categoryId: category.body.data.categoryId, displayName: "Daily API product", posName: "DRAPI", sellingPrice: 100, channels: ["pos"] });
    const published = await request(baseUrl, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
    const event = await request(baseUrl, "/api/admin/events", "POST", { eventCode: "DRAPI", displayName: "Daily API", date: "2026-08-25", startTime: "10:00", endTime: "12:00" });
    assert.equal(event.status, 201, JSON.stringify(event.body));
    const eventId = event.body.data.eventId;
    assert.equal((await request(baseUrl, `/api/admin/events/${eventId}/sellable-inventory`, "PUT", { productVersionId: published.body.data.contract.productVersionId, plannedQuantity: 1 })).status, 200);
    assert.equal((await request(baseUrl, `/api/admin/events/${eventId}/open`, "POST", {})).status, 200);
    const statistics = await request(baseUrl, `/api/events/${eventId}/statistics`);
    const closeout = await request(baseUrl, `/api/events/${eventId}/closeout`, "PUT", { cashReceived: 0, linePayReceived: 0, otherReceived: 0, wasteAmount: 0, notes: "", items: statistics.body.data.inventory.map((item: any) => ({ productVersionId: item.productVersionId, wasteQuantity: 0 })) });
    assert.equal(closeout.status, 200, JSON.stringify(closeout.body));
    assert.equal((await request(baseUrl, `/api/events/${eventId}/close`, "POST", { confirmed: true })).status, 200);
    const list = await request(baseUrl, "/api/admin/operations/daily-reports");
    assert.equal(list.status, 200); assert.equal(list.body.data[0].event.eventId, eventId); assert.equal(list.body.data[0].paymentReconciliation.outcome, "matched");
    const byAdmin = await request(baseUrl, `/api/admin/operations/daily-reports/${eventId}`);
    const legacy = await request(baseUrl, `/api/events/${eventId}/daily-report`);
    assert.equal(byAdmin.status, 200); assert.deepEqual(byAdmin.body.data, legacy.body.data);
    const missing = await request(baseUrl, "/api/admin/operations/daily-reports/event-missing");
    assert.equal(missing.status, 404); assert.equal(missing.body.error.code, "daily_report_not_found");
    const invalid = await request(baseUrl, "/api/admin/operations/daily-reports/%E0%A4%A");
    assert.equal(invalid.status, 422); assert.equal(invalid.body.error.code, "daily_report_identity_invalid");
  } finally { server.close(); await once(server, "close"); }
});
