import { expect, test, type Page } from "@playwright/test";

async function api(page: Page, path: string, method = "GET", body?: unknown) {
  const response = await page.request.fetch(path, { method, data: body });
  return { status: response.status(), body: await response.json() };
}

function assertApiSuccess(result: { status: number; body: unknown }, label: string): void {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${label} failed: status=${result.status}; body=${JSON.stringify(result.body)}`);
  }
}

async function saveZeroCloseout(page: Page, eventId: string): Promise<void> {
  const statistics = await api(page, `/api/events/${eventId}/statistics`);
  assertApiSuccess(statistics, `Lifecycle Event statistics eventId=${eventId}`);
  const closeout = statistics.body.data.closeout;
  const result = await api(page, `/api/events/${eventId}/closeout`, "PUT", {
    cashReceived: closeout?.cashReceived ?? 0,
    linePayReceived: closeout?.linePayReceived ?? 0,
    otherReceived: closeout?.otherReceived ?? 0,
    wasteAmount: closeout?.wasteAmount ?? 0,
    notes: closeout?.notes ?? "",
    operator: "e2e",
    items: statistics.body.data.inventory.map((item: any) => ({
      productVersionId: item.productVersionId,
      wasteQuantity: 0
    }))
  });
  assertApiSuccess(result, `Lifecycle Event closeout eventId=${eventId}`);
}

async function closeEvent(page: Page, eventId: string): Promise<void> {
  const orders = await api(page, `/api/events/${eventId}/orders`);
  assertApiSuccess(orders, `Lifecycle Event orders eventId=${eventId}`);
  for (const order of orders.body.data) {
    if (order.orderStatus !== "confirmed") continue;
    const noShow = await api(page, `/api/orders/${order.orderId}/no-show`, "POST", {});
    assertApiSuccess(noShow, `Lifecycle Event no-show orderId=${order.orderId}`);
    if (order.productionStatus === "not_started") {
      const released = await api(page, `/api/orders/${order.orderId}/release-inventory`, "POST", { confirmed: true });
      assertApiSuccess(released, `Lifecycle Event release orderId=${order.orderId}`);
    }
  }
  await saveZeroCloseout(page, eventId);
  const closed = await api(page, `/api/events/${eventId}/close`, "POST", { confirmed: true });
  assertApiSuccess(closed, `Lifecycle Event close eventId=${eventId}`);
}

async function cleanupIfCurrent(page: Page, eventId: string): Promise<void> {
  const current = await api(page, "/api/events/current");
  assertApiSuccess(current, "Lifecycle current Event");
  if (current.body.data?.eventId === eventId) await closeEvent(page, eventId);
}

test("POS lifecycle UI marks no-show, double-confirms release, and closes the Event", async ({ page }) => {
  let eventId: string | null = null;
  let eventOpened = false;
  let testError: unknown;
  try {
    const category = await api(page, "/api/admin/categories", "POST", { displayName: "Lifecycle", sortOrder: 1 });
    const product = await api(page, "/api/admin/products", "POST", { internalName: "Lifecycle meal", categoryId: category.body.data.categoryId, displayName: "Lifecycle meal", posName: "Life", sellingPrice: 100, channels: ["pos"] });
    const published = await api(page, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
    const event = await api(page, "/api/admin/events", "POST", { eventCode: "LUI", displayName: "Lifecycle UI", date: "2026-07-20", startTime: "17:00", endTime: "22:00" });
    eventId = event.body.data.eventId;
    await api(page, `/api/admin/events/${eventId}/sellable-inventory`, "PUT", { productVersionId: published.body.data.contract.productVersionId, plannedQuantity: 1 });
    const opened = await api(page, `/api/admin/events/${eventId}/open`, "POST", {});
    assertApiSuccess(opened, `Lifecycle Event open eventId=${eventId}; eventCode=LUI`);
    eventOpened = true;
    await api(page, "/api/orders", "POST", { source: "pos", eventId, idempotencyKey: "lifecycle-ui", items: [{ productId: published.body.data.contract.productId, productVersionId: published.body.data.contract.productVersionId, quantity: 1, notes: null }], customerName: null, notes: null });
    await page.goto("/pos/lifecycle");
    await expect(page.locator("#orders")).toContainText("LUI-001");
    await page.locator('button[data-action="no-show"]').click();
    await expect(page.locator("#orders")).toContainText("cancelled");
    await expect(page.locator("#orders")).toContainText("no_show");
    await page.locator('button[data-action="release"]').click();
    await expect(page.locator('button[data-action="release"]')).toContainText("再次確認");
    await page.locator('button[data-action="release"]').click();
    await expect(page.locator("#notice")).toContainText("庫存已釋放");
    await saveZeroCloseout(page, eventId);
    await page.locator("#close-event").click();
    await expect(page.locator("#close-event")).toContainText("再次確認");
    await page.locator("#close-event").click();
    await expect(page.locator("#report")).toContainText("noShow");
  } catch (error) {
    testError = error;
    throw error;
  } finally {
    if (eventOpened && eventId) {
      try {
        await cleanupIfCurrent(page, eventId);
      } catch (cleanupError) {
        if (testError) throw new AggregateError([testError, cleanupError], "Lifecycle test and cleanup both failed.");
        throw cleanupError;
      }
    }
  }
});
