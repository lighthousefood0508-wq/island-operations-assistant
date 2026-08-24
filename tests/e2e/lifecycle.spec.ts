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

test("PaymentCloseoutReconciliationBoundary exposes receipt differences and requires an explicit exception", async ({ page }) => {
  let eventId: string | null = null;
  let eventOpened = false;
  let testError: unknown;
  try {
    const category = await api(page, "/api/admin/categories", "POST", { displayName: "Reconcile", sortOrder: 1 });
    const product = await api(page, "/api/admin/products", "POST", { internalName: "Reconcile meal", categoryId: category.body.data.categoryId, displayName: "Reconcile meal", posName: "Reconcile", sellingPrice: 100, channels: ["pos"] });
    const published = await api(page, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
    const event = await api(page, "/api/admin/events", "POST", { eventCode: "REC", displayName: "Reconciliation", date: "2026-07-21", startTime: "17:00", endTime: "22:00" });
    eventId = event.body.data.eventId;
    await api(page, `/api/admin/events/${eventId}/sellable-inventory`, "PUT", { productVersionId: published.body.data.contract.productVersionId, plannedQuantity: 1 });
    assertApiSuccess(await api(page, `/api/admin/events/${eventId}/open`, "POST", {}), "Payment reconciliation Event open");
    eventOpened = true;
    const order = await api(page, "/api/orders", "POST", { source: "pos", eventId, idempotencyKey: "reconciliation-ui", items: [{ productId: published.body.data.contract.productId, productVersionId: published.body.data.contract.productVersionId, quantity: 1, notes: null }], customerName: null, notes: null });
    for (const status of ["preparing", "ready", "served"]) assertApiSuccess(await api(page, `/api/orders/${order.body.data.orderId}/status`, "PATCH", { status }), `Payment reconciliation ${status}`);
    assertApiSuccess(await api(page, `/api/orders/${order.body.data.orderId}/payment/confirm`, "POST", { confirmed: true, paymentMethod: "CASH", expectedAmount: 100, idempotencyKey: "reconciliation-ui-payment", operator: "e2e", deviceId: "POS-A" }), "Payment reconciliation payment");

    await page.goto(`/pos/statistics?eventId=${eventId}`);
    await expect(page.locator("#cash-reconciliation")).toContainText("NT$100／NT$0／NT$-100");
    await expect(page.locator("#payment-reconciliation-status")).toContainText("需要明確差額例外");
    await page.locator("#close").click();
    await expect(page.locator("#notice")).toContainText("Cash 或 LINE Pay 差額必須");
    await page.locator("#reconciliation-exception-confirmed").check();
    await page.locator("#reconciliation-exception-reason").fill("Cash count pending");
    await expect(page.locator("#reconciliation-exception-confirmed")).toBeChecked();
    await expect(page.locator("#reconciliation-exception-reason")).toHaveValue("Cash count pending");
    await page.locator("#close").click();
    await expect.poll(async () => (await api(page, `/api/events/${eventId}/daily-report`)).status).toBe(200);
    const report = await api(page, `/api/events/${eventId}/daily-report`);
    assertApiSuccess(report, "Payment reconciliation Daily Report");
    expect(report.body.data.paymentReconciliation).toMatchObject({ outcome: "exception_accepted", exception: { reason: "Cash count pending", actor: "Owner" } });
    eventOpened = false;
  } catch (error) {
    testError = error;
    throw error;
  } finally {
    if (eventOpened && eventId) {
      try {
        await cleanupIfCurrent(page, eventId);
      } catch (cleanupError) {
        if (testError) throw new AggregateError([testError, cleanupError], "Payment reconciliation test and cleanup both failed.");
        throw cleanupError;
      }
    }
  }
});
