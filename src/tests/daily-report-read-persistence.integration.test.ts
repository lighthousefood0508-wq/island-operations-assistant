import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { LifecycleRepository } from "../domains/operations/index.js";
import { createRosServer } from "../server/index.js";
import { createDatabase } from "../shared/database/database-provider.js";

async function request(baseUrl: string, pathName: string, method = "GET", body?: unknown): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${pathName}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}

async function closeEvent(baseUrl: string, eventCode: string): Promise<string> {
  const category = await request(baseUrl, "/api/admin/categories", "POST", { displayName: `${eventCode} category`, sortOrder: 1 });
  const product = await request(baseUrl, "/api/admin/products", "POST", { internalName: `${eventCode} product`, categoryId: category.body.data.categoryId, displayName: `${eventCode} product`, posName: eventCode, sellingPrice: 100, channels: ["pos"] });
  const published = await request(baseUrl, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
  const created = await request(baseUrl, "/api/admin/events", "POST", { eventCode, displayName: eventCode, date: "2026-08-25", startTime: "10:00", endTime: "12:00" });
  const eventId = created.body.data.eventId;
  assert.equal((await request(baseUrl, `/api/admin/events/${eventId}/sellable-inventory`, "PUT", { productVersionId: published.body.data.contract.productVersionId, plannedQuantity: 1 })).status, 200);
  assert.equal((await request(baseUrl, `/api/admin/events/${eventId}/open`, "POST", {})).status, 200);
  const statistics = await request(baseUrl, `/api/events/${eventId}/statistics`);
  assert.equal((await request(baseUrl, `/api/events/${eventId}/closeout`, "PUT", { cashReceived: 0, linePayReceived: 0, otherReceived: 0, wasteAmount: 0, notes: "", items: statistics.body.data.inventory.map((item: any) => ({ productVersionId: item.productVersionId, wasteQuantity: 0 })) })).status, 200);
  assert.equal((await request(baseUrl, `/api/events/${eventId}/close`, "POST", { confirmed: true })).status, 200);
  return eventId;
}

test("Daily Report persistence reads stored immutable evidence rather than mutable Event state", async () => {
  const databasePath = path.resolve("data", `daily-report-read-${randomUUID()}.sqlite`);
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string"); const baseUrl = `http://127.0.0.1:${address.port}`;
  const firstId = await closeEvent(baseUrl, "DRA");
  const secondId = await closeEvent(baseUrl, "DRB");
  server.close(); await once(server, "close");
  const database = createDatabase({ databasePath, host: "127.0.0.1", port: 0 });
  try {
    const first = JSON.parse(database.queryOne<{ daily_report_json: string }>("SELECT daily_report_json FROM operations_event_closures WHERE event_id = ?", [firstId])!.daily_report_json);
    first.closedAt = "2026-08-25T10:00:00.000Z";
    delete first.paymentReconciliation;
    database.execute("UPDATE operations_event_closures SET daily_report_json = ? WHERE event_id = ?", [JSON.stringify(first), firstId]);
    const second = JSON.parse(database.queryOne<{ daily_report_json: string }>("SELECT daily_report_json FROM operations_event_closures WHERE event_id = ?", [secondId])!.daily_report_json);
    second.closedAt = "2026-08-25T11:00:00.000Z";
    database.execute("UPDATE operations_event_closures SET daily_report_json = ? WHERE event_id = ?", [JSON.stringify(second), secondId]);
    database.execute("UPDATE operations_events SET display_name = 'MUTATED LIVE EVENT' WHERE event_id = ?", [firstId]);
    const reads = new LifecycleRepository(database);
    assert.deepEqual(reads.listDailyReports().map((item) => item.event.eventId), [secondId, firstId]);
    assert.equal(reads.findDailyReport(firstId)?.event.displayName, "DRA");
    assert.equal(reads.findDailyReport(firstId)?.paymentReconciliation, null);
    database.execute("UPDATE operations_event_closures SET daily_report_json = '{invalid' WHERE event_id = ?", [firstId]);
    assert.throws(() => reads.findDailyReport(firstId));
    database.execute("UPDATE operations_event_closures SET daily_report_json = ? WHERE event_id = ?", [JSON.stringify({ event: {}, orders: {}, products: [], payments: {}, closedAt: "2026-08-25T10:00:00.000Z" }), secondId]);
    assert.throws(() => reads.findDailyReport(secondId));
  } finally { database.close(); }
});
