import { expect, test } from "@playwright/test";

async function api(page: any, path: string, method = "GET", body?: unknown) {
  const response = await page.request.fetch(path, { method, data: body });
  return { status: response.status(), body: await response.json() };
}

async function closeEvent(page: any, eventId: string) {
  const orders = await api(page, `/api/events/${eventId}/orders`);
  for (const order of orders.body.data) {
    if (order.orderStatus === "confirmed") {
      await api(page, `/api/orders/${order.orderId}/no-show`, "POST", {});
      await api(page, `/api/orders/${order.orderId}/release-inventory`, "POST", { confirmed: true });
    }
  }
  const result = await api(page, `/api/events/${eventId}/close`, "POST", { confirmed: true });
  if (result.status < 200 || result.status >= 300) throw new Error(`Realtime Event cleanup failed: status=${result.status}; eventId=${eventId}; body=${JSON.stringify(result.body)}`);
}

test("realtime clients refresh central state after order and Kitchen changes without reload", async ({ browser }) => {
  const setupContext = await browser.newContext();
  const contexts: any[] = [setupContext];
  const setup = await setupContext.newPage();
  let eventId: string | null = null;
  let eventOpened = false;

  try {
    const category = await api(setup, "/api/admin/categories", "POST", { code: "realtime", displayName: "Realtime", sortOrder: 1 });
    const product = await api(setup, "/api/admin/products", "POST", { internalName: "Realtime Meal", categoryId: category.body.data.categoryId, displayName: "Realtime Meal", posName: "Realtime", sellingPrice: 120, channels: ["pos"] });
    const published = await api(setup, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
    const event = await api(setup, "/api/admin/events", "POST", { eventCode: "SYNC", displayName: "Sync Run", date: "2026-07-26", startTime: "17:00", endTime: "22:00" });
    eventId = event.body.data.eventId;
    await api(setup, `/api/admin/events/${eventId}/sellable-inventory`, "PUT", { productVersionId: published.body.data.contract.productVersionId, plannedQuantity: 3 });
    const opened = await api(setup, `/api/admin/events/${eventId}/open`, "POST", {});
    if (opened.status < 200 || opened.status >= 300) throw new Error(`Realtime Event open failed: status=${opened.status}; eventId=${eventId}; eventCode=SYNC; body=${JSON.stringify(opened.body)}`);
    eventOpened = true;

    const [contextA, contextB, contextC, contextD, monitorContext] = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext(), browser.newContext(), browser.newContext()]);
    contexts.push(contextA, contextB, contextC, contextD, monitorContext);
    const [posA, posB, kitchen, statistics, monitor] = await Promise.all([contextA.newPage(), contextB.newPage(), contextC.newPage(), contextD.newPage(), monitorContext.newPage()]);
    await Promise.all([posA.goto("/pos?device=POS-A&debug=1"), posB.goto("/pos?device=POS-B&debug=1"), kitchen.goto("/kitchen?device=Kitchen-A&debug=1"), statistics.goto("/pos/statistics?device=Statistics&debug=1")]);

    for (const page of [posA, posB, kitchen, statistics]) await expect(page.locator("#connection-status")).toContainText("Connected");
    await expect(posA.locator("#sync-debug-device")).toHaveText("POS-A");
    await expect(kitchen.locator("#sync-debug-device")).toHaveText("Kitchen-A");
    await expect(statistics.locator("#sync-debug-device")).toHaveText("Statistics");
    await monitor.goto("/debug/devices");
    for (const device of ["POS-A", "POS-B", "Kitchen-A", "Statistics"]) await expect(monitor.locator("#devices")).toContainText(device);

    await posA.locator(`[data-add="${published.body.data.contract.productId}"]`).click();
    await posA.locator("#payment-method").selectOption("CASH");
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
    await expect(posA.locator("#served-orders")).toContainText("已出餐");
    await expect(posB.locator("#served-orders")).toContainText("已出餐");

    await posB.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(posB.locator("#sync-last-sync")).not.toHaveText("-");
    await expect(posB.locator("#sync-event")).toHaveText(eventId);
  } finally {
    try {
      if (eventOpened && eventId) {
        await closeEvent(setup, eventId);
        const current = await api(setup, "/api/events/current");
        if (current.status !== 200 || current.body.data !== null) throw new Error(`Realtime Event cleanup left an OPEN Event: body=${JSON.stringify(current.body)}`);
      }
    } finally {
      await Promise.all(contexts.map(context => context.close()));
    }
  }
});
