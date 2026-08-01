import { expect, test } from "@playwright/test";

async function api(page: any, path: string, method = "GET", body?: unknown) {
  const response = await page.request.fetch(path, { method, data: body });
  return { status: response.status(), body: await response.json() };
}

function assertApiSuccess(result: { status: number; body: unknown }, label: string): void {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${label} failed: status=${result.status}; body=${JSON.stringify(result.body)}`);
  }
}

async function closeEvent(page: any, eventId: string) {
  const orders = await api(page, `/api/events/${eventId}/orders`);
  assertApiSuccess(orders, `Realtime Event orders eventId=${eventId}`);
  for (const order of orders.body.data) {
    if (order.orderStatus === "confirmed") {
      const noShow = await api(page, `/api/orders/${order.orderId}/no-show`, "POST", {});
      assertApiSuccess(noShow, `Realtime Event no-show orderId=${order.orderId}`);
      if (order.productionStatus === "not_started") {
        const released = await api(page, `/api/orders/${order.orderId}/release-inventory`, "POST", { confirmed: true });
        assertApiSuccess(released, `Realtime Event release orderId=${order.orderId}`);
      }
    }
  }
  const statistics = await api(page, `/api/events/${eventId}/statistics`);
  assertApiSuccess(statistics, `Realtime Event statistics eventId=${eventId}`);
  const currentCloseout = statistics.body.data.closeout;
  const closeout = await api(page, `/api/events/${eventId}/closeout`, "PUT", {
    cashReceived: currentCloseout?.cashReceived ?? 0,
    linePayReceived: currentCloseout?.linePayReceived ?? 0,
    otherReceived: currentCloseout?.otherReceived ?? 0,
    wasteAmount: currentCloseout?.wasteAmount ?? 0,
    notes: currentCloseout?.notes ?? "",
    operator: "e2e",
    items: statistics.body.data.inventory.map((item: any) => ({
      productVersionId: item.productVersionId,
      wasteQuantity: 0
    }))
  });
  assertApiSuccess(closeout, `Realtime Event closeout eventId=${eventId}`);
  const result = await api(page, `/api/events/${eventId}/close`, "POST", { confirmed: true });
  assertApiSuccess(result, `Realtime Event close eventId=${eventId}`);
}

test("realtime clients refresh central state after order and Kitchen changes without reload", async ({ browser }) => {
  test.setTimeout(60_000);
  const setupContext = await browser.newContext();
  const contexts: any[] = [setupContext];
  const setup = await setupContext.newPage();
  let eventId: string | null = null;
  let eventOpened = false;
  let testError: unknown;

  try {
    const category = await api(setup, "/api/admin/categories", "POST", { displayName: "Realtime", sortOrder: 1 });
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
    await posA.locator('[data-payment-method="CASH"]').click();
    await posA.locator("#toggle-preorder").click();
    await posA.locator("#pickup-time").selectOption("18:00");
    await posA.locator("#create-order").click();
    await expect(posA.locator("#notice")).toContainText("SYNC-001");
    await expect(posB.locator("#preorder-orders")).toContainText("SYNC-001");
    await expect(kitchen.locator("#pending")).toContainText("SYNC-001");
    await kitchen.locator('[data-order-id]').first().evaluate((element) => {
      (window as unknown as { __stableKitchenCard: Element }).__stableKitchenCard = element;
    });
    const stableRefresh = kitchen.waitForResponse(response =>
      response.request().method() === "GET"
      && response.url().includes(`/api/events/${eventId}/orders`)
    );
    await kitchen.evaluate(() => (window as unknown as { __rosRealtime: { refresh(): void } }).__rosRealtime.refresh());
    await stableRefresh;
    expect(await kitchen.locator('[data-order-id]').first().evaluate((element) =>
      element === (window as unknown as { __stableKitchenCard: Element }).__stableKitchenCard
    )).toBe(true);
    await expect(statistics.locator("#summary")).toContainText("中央訂單");
    await expect(statistics.locator("#summary")).toContainText("1");
    await expect(posB.locator("#sync-last-event")).toHaveText(/order\.created|inventory\.changed/);
    const lastBusinessEvent = await posB.locator("#sync-last-event").textContent();
    expect(lastBusinessEvent).toBeTruthy();
    await posB.waitForTimeout(16_000);
    await expect(posB.locator("#sync-last-event")).toHaveText(lastBusinessEvent!);

    await kitchen.locator('[data-status="preparing"]').click();
    await expect(posA.locator("#preorder-orders")).toContainText("製作中");
    await expect(posB.locator("#preorder-orders")).toContainText("製作中");
    await expect(statistics.locator("#sync-last-event")).toHaveText(/order\.production_changed/);
    await kitchen.locator('[data-status="ready"]').click();
    await expect(posA.locator("#preorder-orders")).toContainText("可取餐");
    await expect(posB.locator("#preorder-orders")).toContainText("可取餐");
    const statisticsBeforeServed = await api(setup, `/api/events/${eventId}/statistics`);
    assertApiSuccess(statisticsBeforeServed, `Realtime statistics before served eventId=${eventId}`);
    await kitchen.locator('[data-status="served"]').click();
    await expect(posA.locator("#served-orders")).toContainText("已出餐");
    await expect(posB.locator("#served-orders")).toContainText("已出餐");
    await kitchen.locator('[data-kitchen-tab="served"]').click();
    await expect(kitchen.locator("#served")).toContainText("SYNC-001");

    kitchen.once("dialog", dialog => dialog.accept());
    await kitchen.locator('[data-revert-production]').click();
    await expect(posA.locator("#preorder-orders")).toContainText("可取餐");
    await expect(posB.locator("#preorder-orders")).toContainText("可取餐");
    await expect(kitchen.locator("#ready")).toContainText("SYNC-001");
    await expect(kitchen.locator("#served")).not.toContainText("SYNC-001");
    const statisticsAfterReversal = await api(setup, `/api/events/${eventId}/statistics`);
    assertApiSuccess(statisticsAfterReversal, `Realtime statistics after reversal eventId=${eventId}`);
    expect(statisticsAfterReversal.body.data.ledgerAmount).toBe(statisticsBeforeServed.body.data.ledgerAmount);
    expect(statisticsAfterReversal.body.data.products).toEqual(statisticsBeforeServed.body.data.products);
    expect(statisticsAfterReversal.body.data.inventory).toEqual(statisticsBeforeServed.body.data.inventory);
    await kitchen.locator('[data-kitchen-tab="upcoming"]').click();
    await kitchen.locator('[data-status="served"]').click();
    await expect(posA.locator("#served-orders")).toContainText("已出餐");
    await expect(posB.locator("#served-orders")).toContainText("已出餐");
    await posA.locator('button[data-tab="served"]').click();
    await posA.locator('#served-orders [data-collection-method="CASH"]').click();
    await posA.locator("#served-orders [data-confirm-payment]").click();
    await expect(posB.locator("#served-orders")).toContainText("completed");
    await expect(posB.locator("#served-orders")).toContainText("paid");
    await expect(statistics.locator("#sync-last-event")).toHaveText(/payment\.confirmed|order\.completed/);

    await posB.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(posB.locator("#sync-last-sync")).not.toHaveText("-");
    await expect(posB.locator("#sync-event")).toHaveText(eventId);
  } catch (error) {
    testError = error;
    throw error;
  } finally {
    const cleanupErrors: unknown[] = [];
    try {
      if (eventOpened && eventId) {
        await closeEvent(setup, eventId);
        const current = await api(setup, "/api/events/current");
        if (current.status !== 200 || current.body.data !== null) throw new Error(`Realtime Event cleanup left an OPEN Event: body=${JSON.stringify(current.body)}`);
      }
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      await Promise.all(contexts.map(context => context.close()));
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (cleanupErrors.length > 0) {
      if (testError) throw new AggregateError([testError, ...cleanupErrors], "Realtime test and cleanup both failed.");
      throw new AggregateError(cleanupErrors, "Realtime cleanup failed.");
    }
  }
});
