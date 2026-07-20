import { expect, test } from "@playwright/test";

async function api(page: any, path: string, method = "GET", body?: unknown) {
  const response = await page.request.fetch(path, { method, data: body });
  return { status: response.status(), body: await response.json() };
}

test("realtime clients refresh central state after order and Kitchen changes without reload", async ({ browser }) => {
  const setupContext = await browser.newContext();
  const setup = await setupContext.newPage();
  const category = await api(setup, "/api/admin/categories", "POST", { code: "realtime", displayName: "Realtime", sortOrder: 1 });
  const product = await api(setup, "/api/admin/products", "POST", { internalName: "Realtime Meal", categoryId: category.body.data.categoryId, displayName: "Realtime Meal", posName: "Realtime", sellingPrice: 120, channels: ["pos"] });
  const published = await api(setup, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
  const event = await api(setup, "/api/admin/events", "POST", { eventCode: "SYNC", displayName: "Sync Run", date: "2026-07-26", startTime: "17:00", endTime: "22:00" });
  await api(setup, `/api/admin/events/${event.body.data.eventId}/sellable-inventory`, "PUT", { productVersionId: published.body.data.contract.productVersionId, plannedQuantity: 3 });
  await api(setup, `/api/admin/events/${event.body.data.eventId}/open`, "POST", {});

  const [contextA, contextB, contextC, contextD] = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext(), browser.newContext()]);
  const [posA, posB, kitchen, statistics] = await Promise.all([contextA.newPage(), contextB.newPage(), contextC.newPage(), contextD.newPage()]);
  await Promise.all([posA.goto("/pos?device=POS-A&debug=1"), posB.goto("/pos?device=POS-B&debug=1"), kitchen.goto("/kitchen?device=Kitchen-A&debug=1"), statistics.goto("/pos/statistics?device=Statistics&debug=1")]);

  for (const page of [posA, posB, kitchen, statistics]) await expect(page.locator("#connection-status")).toContainText("Connected");
  await expect(posA.locator("#sync-debug-device")).toHaveText("POS-A");
  await expect(kitchen.locator("#sync-debug-device")).toHaveText("Kitchen-A");
  await expect(statistics.locator("#sync-debug-device")).toHaveText("Statistics");

  await posA.locator(`[data-add="${published.body.data.contract.productId}"]`).click();
  await posA.locator("#create-order").click();
  await expect(posA.locator("#notice")).toContainText("SYNC-001");
  await expect(posB.locator("#orders")).toContainText("SYNC-001");
  await expect(kitchen.locator("#pending")).toContainText("SYNC-001");
  await expect(statistics.locator("#summary")).toContainText("中央訂單");
  await expect(statistics.locator("#summary")).toContainText("1");
  await expect(posB.locator("#sync-last-event")).toHaveText(/order\.created|inventory\.changed/);

  await kitchen.locator('[data-status="preparing"]').click();
  await expect(posA.locator("#orders")).toContainText("製作中");
  await expect(posB.locator("#orders")).toContainText("製作中");
  await expect(statistics.locator("#sync-last-event")).toHaveText(/order\.production_changed/);
  await kitchen.locator('[data-status="ready"]').click();
  await expect(posA.locator("#orders")).toContainText("可取餐");
  await expect(posB.locator("#orders")).toContainText("可取餐");
  await kitchen.locator('[data-status="served"]').click();
  await expect(posA.locator("#orders")).toContainText("已出餐");
  await expect(posB.locator("#orders")).toContainText("已出餐");

  await posB.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(posB.locator("#sync-last-sync")).not.toHaveText("-");
  await expect(posB.locator("#sync-event")).toHaveText(event.body.data.eventId);
  await Promise.all([contextA.close(), contextB.close(), contextC.close(), contextD.close(), setupContext.close()]);
});
