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
  assertApiSuccess(orders, `Shadow Event orders eventId=${eventId}`);
  for (const order of orders.body.data) {
    if (order.orderStatus === "confirmed") {
      const noShow = await api(page, `/api/orders/${order.orderId}/no-show`, "POST", {});
      assertApiSuccess(noShow, `Shadow Event no-show orderId=${order.orderId}`);
      if (order.productionStatus === "not_started") {
        const released = await api(page, `/api/orders/${order.orderId}/release-inventory`, "POST", { confirmed: true });
        assertApiSuccess(released, `Shadow Event release orderId=${order.orderId}`);
      }
    }
  }
  const statistics = await api(page, `/api/events/${eventId}/statistics`);
  assertApiSuccess(statistics, `Shadow Event statistics eventId=${eventId}`);
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
  assertApiSuccess(closeout, `Shadow Event closeout eventId=${eventId}`);
  const result = await api(page, `/api/events/${eventId}/close`, "POST", { confirmed: true });
  assertApiSuccess(result, `Shadow Event close eventId=${eventId}`);
}

test("shadow run syncs POS A, POS B, Kitchen, inventory, and closeout through central SQLite", async ({ browser }) => {
  const setupContext = await browser.newContext();
  const contexts: any[] = [setupContext];
  const setup = await setupContext.newPage();
  const eventCode = "SHADOW";
  let eventId: string | null = null;
  let eventOpened = false;
  let testError: unknown;

  try {
    const category = await api(setup, "/api/admin/categories", "POST", { displayName: "Shadow", sortOrder: 1 });
    const product = await api(setup, "/api/admin/products", "POST", { internalName: "Shadow Meal", categoryId: category.body.data.categoryId, displayName: "Shadow Meal", posName: "Shadow", sellingPrice: 100, channels: ["pos"] });
    const published = await api(setup, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
    const event = await api(setup, "/api/admin/events", "POST", { eventCode, displayName: "Shadow Run", date: "2026-07-26", startTime: "17:00", endTime: "22:00" });
    eventId = event.body.data.eventId;
    await api(setup, `/api/admin/events/${eventId}/sellable-inventory`, "PUT", { productVersionId: published.body.data.contract.productVersionId, plannedQuantity: 2 });
    const opened = await api(setup, `/api/admin/events/${eventId}/open`, "POST", {});
    if (opened.status < 200 || opened.status >= 300) throw new Error(`Shadow Event open failed: status=${opened.status}; eventId=${eventId}; eventCode=${eventCode}; body=${JSON.stringify(opened.body)}`);
    eventOpened = true;

    const [contextA, contextB, contextC] = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
    contexts.push(contextA, contextB, contextC);
    const [posA, posB, kitchen] = await Promise.all([contextA.newPage(), contextB.newPage(), contextC.newPage()]);
    await Promise.all([posA.goto("/pos"), posB.goto("/pos"), kitchen.goto("/kitchen")]);
    await expect(posA.locator("#connection-status")).toContainText("Connected");
    await expect(kitchen.locator("#connection-status")).toContainText("Connected");
    await posA.locator(`[data-add="${published.body.data.contract.productId}"]`).click();
    await posA.locator('[data-payment-method="CASH"]').click();
    await posA.locator("#create-order").click();
    await expect(posA.locator("#notice")).toContainText("SHADOW-001");
    await expect(posB.locator("#orders")).toContainText("SHADOW-001");
    await expect(kitchen.locator("#pending")).toContainText("SHADOW-001");
    await kitchen.locator('[data-status="preparing"]').click();
    await expect(posA.locator("#orders")).toContainText("製作中");
    await kitchen.locator('[data-status="ready"]').click();
    await expect(posB.locator("#orders")).toContainText("可取餐");
    await kitchen.locator('[data-status="served"]').click();
    await expect(posA.locator("#served-orders")).toContainText("已出餐");
    await kitchen.reload();
    await expect(kitchen.locator("#ready")).toContainText("SHADOW-001");
    const raceA = api(posA, "/api/orders", "POST", { source: "pos", eventId, idempotencyKey: "race-a", items: [{ productId: published.body.data.contract.productId, productVersionId: published.body.data.contract.productVersionId, quantity: 1, notes: null }], customerName: null, notes: null });
    const raceB = api(posB, "/api/orders", "POST", { source: "pos", eventId, idempotencyKey: "race-b", items: [{ productId: published.body.data.contract.productId, productVersionId: published.body.data.contract.productVersionId, quantity: 1, notes: null }], customerName: null, notes: null });
    const race = await Promise.all([raceA, raceB]);
    expect(race.map(x => x.status).sort()).toEqual([201, 409]);
    const statistics = await api(posA, `/api/events/${eventId}/statistics`);
    expect(statistics.body.data.orderCount).toBe(2);
    const closeout = await api(posA, `/api/events/${eventId}/closeout`, "PUT", {
      cashReceived: 200,
      linePayReceived: 0,
      otherReceived: 0,
      wasteAmount: 0,
      notes: "shadow",
      operator: "e2e",
      items: statistics.body.data.inventory.map((item: any) => ({
        productVersionId: item.productVersionId,
        wasteQuantity: 0
      }))
    });
    assertApiSuccess(closeout, `Shadow Event closeout eventId=${eventId}`);
    const secondStatistics = await api(posB, `/api/events/${eventId}/statistics`);
    expect(secondStatistics.body.data.closeout.cashReceived).toBe(200);
    const statisticsPage = await contextA.newPage();
    await statisticsPage.goto("/admin/statistics");
    await expect(statisticsPage.locator("#cash")).toHaveValue("200");
    await statisticsPage.locator("#close").click();
    await expect(statisticsPage.locator("#notice")).toContainText("關場失敗：Resolve all non-terminal Orders first.");
    await expect(statisticsPage.locator("#notice")).toContainText("未完成訂單：2 筆");
    const refreshedCloseout = await api(posB, `/api/events/${eventId}/closeout`, "PUT", closeout.body.data.closeout ? {
      cashReceived: closeout.body.data.closeout.cashReceived,
      linePayReceived: closeout.body.data.closeout.linePayReceived,
      otherReceived: closeout.body.data.closeout.otherReceived,
      wasteAmount: closeout.body.data.closeout.wasteAmount,
      notes: closeout.body.data.closeout.notes,
      operator: "e2e",
      items: closeout.body.data.closeoutItems.map((item: any) => ({
        productVersionId: item.productVersionId,
        wasteQuantity: item.wasteQuantity
      }))
    } : {});
    assertApiSuccess(refreshedCloseout, `Shadow Event closeout refresh eventId=${eventId}`);
    await expect(statisticsPage.locator("#notice")).toContainText("未完成訂單：2 筆");
    await expect(statisticsPage.locator("#cash")).toHaveValue("200");
  } catch (error) {
    testError = error;
    throw error;
  } finally {
    const cleanupErrors: unknown[] = [];
    try {
      if (eventOpened && eventId) {
        await closeEvent(setup, eventId);
        const current = await api(setup, "/api/events/current");
        if (current.status !== 200 || current.body.data !== null) throw new Error(`Shadow Event cleanup left an OPEN Event: body=${JSON.stringify(current.body)}`);
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
      if (testError) throw new AggregateError([testError, ...cleanupErrors], "Shadow test and cleanup both failed.");
      throw new AggregateError(cleanupErrors, "Shadow cleanup failed.");
    }
  }
});
