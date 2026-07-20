import { expect, test } from "@playwright/test";

async function api(page: any, path: string, method = "GET", body?: unknown) { const response = await page.request.fetch(path, { method, data: body }); return { status: response.status(), body: await response.json() }; }

test("POS lifecycle UI marks no-show, double-confirms release, and closes the Event", async ({ page }) => {
  const category = await api(page, "/api/admin/categories", "POST", { code: "life-ui", displayName: "Lifecycle", sortOrder: 1 });
  const product = await api(page, "/api/admin/products", "POST", { internalName: "Lifecycle meal", categoryId: category.body.data.categoryId, displayName: "Lifecycle meal", posName: "Life", sellingPrice: 100, channels: ["pos"] });
  const published = await api(page, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
  const event = await api(page, "/api/admin/events", "POST", { eventCode: "LUI", displayName: "Lifecycle UI", date: "2026-07-20", startTime: "17:00", endTime: "22:00" });
  await api(page, `/api/admin/events/${event.body.data.eventId}/sellable-inventory`, "PUT", { productVersionId: published.body.data.contract.productVersionId, plannedQuantity: 1 }); await api(page, `/api/admin/events/${event.body.data.eventId}/open`, "POST", {});
  await api(page, "/api/orders", "POST", { source: "pos", eventId: event.body.data.eventId, idempotencyKey: "lifecycle-ui", items: [{ productId: published.body.data.contract.productId, productVersionId: published.body.data.contract.productVersionId, quantity: 1, notes: null }], customerName: null, notes: null });
  await page.goto("/pos/lifecycle"); await expect(page.locator("#orders")).toContainText("LUI-001");
  await page.locator('button[data-action="no-show"]').click(); await expect(page.locator("#orders")).toContainText("no_show");
  await page.locator('button[data-action="release"]').click(); await expect(page.locator('button[data-action="release"]')).toContainText("再次確認"); await page.locator('button[data-action="release"]').click(); await expect(page.locator("#notice")).toContainText("庫存已釋放");
  await page.locator("#close-event").click(); await expect(page.locator("#close-event")).toContainText("再次確認"); await page.locator("#close-event").click(); await expect(page.locator("#report")).toContainText("noShow");
});
