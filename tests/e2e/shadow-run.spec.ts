import { expect, test } from "@playwright/test";

async function api(page: any, path: string, method = "GET", body?: unknown) { const response = await page.request.fetch(path, { method, data: body }); return { status: response.status(), body: await response.json() }; }

test("shadow run syncs POS A, POS B, Kitchen, inventory, and closeout through central SQLite", async ({ browser }) => {
  const setupContext = await browser.newContext();
  const setup = await setupContext.newPage();
  const category = await api(setup, "/api/admin/categories", "POST", { code: "shadow", displayName: "Shadow", sortOrder: 1 });
  const product = await api(setup, "/api/admin/products", "POST", { internalName: "Shadow Meal", categoryId: category.body.data.categoryId, displayName: "Shadow Meal", posName: "Shadow", sellingPrice: 100, channels: ["pos"] });
  const published = await api(setup, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
  const event = await api(setup, "/api/admin/events", "POST", { eventCode: "SHADOW", displayName: "Shadow Run", date: "2026-07-26", startTime: "17:00", endTime: "22:00" });
  await api(setup, `/api/admin/events/${event.body.data.eventId}/sellable-inventory`, "PUT", { productVersionId: published.body.data.contract.productVersionId, plannedQuantity: 2 });
  await api(setup, `/api/admin/events/${event.body.data.eventId}/open`, "POST", {});
  const contextA = await browser.newContext(), contextB = await browser.newContext(), contextC = await browser.newContext();
  const posA = await contextA.newPage(), posB = await contextB.newPage(), kitchen = await contextC.newPage();
  await Promise.all([posA.goto("/pos"), posB.goto("/pos"), kitchen.goto("/kitchen")]);
  await posA.locator(`[data-add="${published.body.data.contract.productId}"]`).click(); await posA.locator('#create-order').click();
  await expect(posA.locator('#notice')).toContainText("SHADOW-001");
  await expect(posB.locator('#orders')).toContainText("SHADOW-001");
  await expect(kitchen.locator('#pending')).toContainText("SHADOW-001");
  await kitchen.locator('[data-status="preparing"]').click(); await expect(posA.locator('#orders')).toContainText("製作中");
  await kitchen.locator('[data-status="ready"]').click(); await expect(posB.locator('#orders')).toContainText("可取餐");
  await kitchen.locator('[data-status="served"]').click(); await expect(posA.locator('#orders')).toContainText("已出餐");
  await kitchen.reload();
  await expect(kitchen.locator('#ready')).toContainText("SHADOW-001");
  const raceA = api(posA, "/api/orders", "POST", { source: "pos", eventId: event.body.data.eventId, idempotencyKey: "race-a", items: [{ productId: published.body.data.contract.productId, productVersionId: published.body.data.contract.productVersionId, quantity: 1, notes: null }], customerName: null, notes: null });
  const raceB = api(posB, "/api/orders", "POST", { source: "pos", eventId: event.body.data.eventId, idempotencyKey: "race-b", items: [{ productId: published.body.data.contract.productId, productVersionId: published.body.data.contract.productVersionId, quantity: 1, notes: null }], customerName: null, notes: null });
  const race = await Promise.all([raceA, raceB]); expect(race.map(x => x.status).sort()).toEqual([201, 409]);
  const statistics = await api(posA, `/api/events/${event.body.data.eventId}/statistics`); expect(statistics.body.data.orderCount).toBe(2);
  await api(posA, `/api/events/${event.body.data.eventId}/closeout`, "PUT", { cashReceived: 200, linePayReceived: 0, otherReceived: 0, wasteAmount: 0, notes: "shadow" });
  const secondStatistics = await api(posB, `/api/events/${event.body.data.eventId}/statistics`); expect(secondStatistics.body.data.closeout.cashReceived).toBe(200);
  await Promise.all([contextA.close(), contextB.close(), contextC.close(), setupContext.close()]);
});
