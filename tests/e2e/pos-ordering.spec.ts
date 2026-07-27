import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function api(page: Page, path: string, method = "GET", body?: unknown): Promise<any> {
  const response = await page.request.fetch(path, { method, data: body });
  const payload = await response.json();
  return { status: response.status(), body: payload };
}

async function addProduct(page: Page, categoryId: string, input: { name: string; posName: string; price: number }) {
  const product = await api(page, "/api/admin/products", "POST", { internalName: input.name, categoryId, displayName: input.name, posName: input.posName, sellingPrice: input.price, channels: ["pos"] });
  const published = await api(page, `/api/admin/products/${product.body.data.productId}/publish`, "POST", {});
  return published.body.data.contract;
}

async function setupOpenEvent(page: Page, eventCode: string, products: readonly { name: string; posName: string; price: number; quantity: number }[]) {
  const category = await api(page, "/api/admin/categories", "POST", { displayName: "Meals", sortOrder: 1 });
  const contracts = [];
  for (const product of products) contracts.push(await addProduct(page, category.body.data.categoryId, product));
  const event = await api(page, "/api/admin/events", "POST", { eventCode, displayName: `${eventCode} market`, date: "2026-07-20", startTime: "17:00", endTime: "22:00" });
  for (let index = 0; index < contracts.length; index += 1) await api(page, `/api/admin/events/${event.body.data.eventId}/sellable-inventory`, "PUT", { productVersionId: contracts[index]?.productVersionId, plannedQuantity: products[index]?.quantity });
  await api(page, `/api/admin/events/${event.body.data.eventId}/open`, "POST", {});
  return { eventId: event.body.data.eventId, contracts };
}

async function closeEvent(page: Page, eventId: string) {
  const orders = await api(page, `/api/events/${eventId}/orders`);
  for (const order of orders.body.data) {
    if (order.orderStatus === "confirmed") {
      await api(page, `/api/orders/${order.orderId}/no-show`, "POST", {});
      if (order.productionStatus === "not_started") await api(page, `/api/orders/${order.orderId}/release-inventory`, "POST", { confirmed: true });
    }
  }
  await api(page, `/api/events/${eventId}/close`, "POST", { confirmed: true });
}

async function addToCart(page: Page, productId: string) {
  await page.locator(`button[data-action="add"][data-product-id="${productId}"]`).click();
}

test("POS keeps front-office tabs, creates a central Order, and completes the active order loop", async ({ page, browser }) => {
  const { eventId, contracts } = await setupOpenEvent(page, "POSUI", [
    { name: "Rice bowl", posName: "Rice", price: 180, quantity: 5 },
    { name: "Shrimp bowl", posName: "Shrimp", price: 220, quantity: 4 },
    { name: "Sold out bowl", posName: "Sold out", price: 99, quantity: 0 }
  ]);
  const kitchenContext = await browser.newContext();
  const kitchen = await kitchenContext.newPage();
  try {
    await page.goto("/pos");
    await kitchen.goto("/kitchen");
    for (const tab of ["onsite", "pending", "served"]) await expect(page.locator(`button[data-tab="${tab}"]`)).toBeVisible();
    await expect(page.locator('button[data-tab="preorder"]')).toHaveCount(0);
    await expect(page.locator('button[data-tab="customer"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "庫存設定" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "今日統計" })).toHaveCount(0);
    await page.locator(".system-menu summary").click();
    await expect(page.locator(".system-links .current")).toBeVisible();
    await expect(page.locator('.system-links a[href="/kitchen"]')).toBeVisible();
    await expect(page.locator('.system-links a[href="/admin"]')).toBeVisible();
    await expect(page.locator('.system-links a[href="/admin/devices"]')).toHaveCount(0);
    await expect(page.locator(".system-links .future")).toHaveCount(0);
    await page.locator(".system-menu summary").click();
    await expect(page.locator("body")).not.toContainText("今日收入");
    await expect(page.locator("body")).not.toContainText("毛利");
    await expect(page.locator("body")).not.toContainText("成本");
    await expect(page.locator("#header-operator")).toContainText("Owner");
    await expect(page.locator("#header-event")).toContainText("POSUI market");
    await expect(page.locator("#header-status")).toContainText("OPEN");

    await expect(page.locator("#category-tabs")).toContainText("Meals");
    await expect(page.locator(`article[data-product-id="${contracts[0]?.productId}"]`)).toContainText("Rice");
    await expect(page.locator(`article[data-product-id="${contracts[1]?.productId}"]`)).toContainText("Shrimp");
    await expect(page.locator(`article[data-product-id="${contracts[2]?.productId}"]`)).toHaveClass(/sold-out/);
    await expect(page.locator(`article[data-product-id="${contracts[2]?.productId}"] button`)).toBeDisabled();

    await page.locator('button[data-tab="served"]').click();
    await expect(page.locator('[data-pane="served"]')).toBeVisible();
    await expect(page.locator('[data-pane="served"]')).toContainText("今日已出餐");
    await page.locator('button[data-tab="onsite"]').click();

    await addToCart(page, contracts[0]?.productId as string);
    await addToCart(page, contracts[0]?.productId as string);
    await page.locator(`[data-adjust="-1"][data-product-id="${contracts[0]?.productId}"]`).click();
    await addToCart(page, contracts[1]?.productId as string);
    await page.locator(`input[data-note="${contracts[0]?.productId}"]`).fill("less sauce");
    await page.locator("#customer-name").fill("Miles");
    await page.locator("#customer-phone-tail").fill("123");
    await page.locator("#payment-method").selectOption("CASH");
    await page.locator("#order-notes").fill("counter pickup");
    await expect(page.locator("#cart-items")).toContainText("Rice");
    await expect(page.locator("#cart-items")).toContainText("Shrimp");
    await expect(page.locator("#total")).toContainText("NT$400");
    await expect(page.locator(".stat")).toHaveCount(4);

    await page.locator("#create-order").click();
    await expect(page.locator("#notice")).toContainText("POSUI-001");
    await expect(page.locator(`article[data-product-id="${contracts[0]?.productId}"]`)).toContainText("4");
    await expect(page.locator(`article[data-product-id="${contracts[1]?.productId}"]`)).toContainText("3");
    const orders = await api(page, `/api/events/${eventId}/orders`);
    expect(orders.body.data[0]?.customerName).toBe("Miles");
    expect(orders.body.data[0]?.customerPhoneTail).toBe("123");
    expect(orders.body.data[0]?.paymentMethod).toBe("CASH");
    expect(orders.body.data[0]?.notes).toBe("counter pickup");

    await page.locator('button[data-tab="pending"]').click();
    await expect(page.locator("#orders")).toContainText("POSUI-001");
    await expect(page.locator("#orders")).toContainText("Miles");
    await expect(page.locator("#orders")).toContainText("123");
    await expect(page.locator("#orders")).toContainText("等待");
    await expect(page.locator("#orders")).toContainText("less sauce");
    await expect(page.locator("#orders")).toContainText("counter pickup");
    await expect(page.locator('#orders [data-order-action="start"]')).toBeVisible();
    await expect(page.locator("#orders button:disabled")).toBeVisible();
    await page.locator("#orders [data-view-order]").click();
    await expect(page.locator("#orders")).toContainText("confirmed");
    await expect(kitchen.locator("#pending")).toContainText("Miles");
    await kitchen.locator(".system-menu summary").click();
    await expect(kitchen.locator('.system-links a[href="/pos"]')).toBeVisible();
    await expect(kitchen.locator('.system-links a[href="/admin"]')).toBeVisible();

    await page.locator('#orders [data-order-action="start"]').click();
    await expect.poll(async () => (await api(page, `/api/events/${eventId}/orders`)).body.data[0]?.productionStatus).toBe("preparing");
    await page.locator('#orders [data-order-action="served"]').click();
    await page.locator('button[data-tab="served"]').click();
    await expect(page.locator("#served-orders")).toContainText("POSUI-001");
    await expect(page.locator("#served-orders")).toContainText("Miles");
    await expect(page.locator("#served-orders")).toContainText("123");
    await page.locator("#served-search").fill("Miles");
    await expect(page.locator("#served-orders")).toContainText("POSUI-001");
    await page.locator("#served-search").fill("123");
    await expect(page.locator("#served-orders")).toContainText("POSUI-001");
    await page.locator("#served-search").fill("POSUI-001");
    await expect(page.locator("#served-orders")).toContainText("Miles");

    await page.goto("/pos?debug=1");
    await expect(page.locator("#sync-debug")).toBeVisible();
  } finally {
    await kitchenContext.close();
    await closeEvent(page, eventId);
  }
});

test("two POS browser contexts race for the final portion and only one creates an Order", async ({ browser, page }) => {
  const { eventId, contracts } = await setupOpenEvent(page, "RACEUI", [{ name: "Last bowl", posName: "Last", price: 150, quantity: 1 }]);
  const firstContext: BrowserContext = await browser.newContext();
  const secondContext: BrowserContext = await browser.newContext();
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();
  try {
    await Promise.all([first.goto("/pos"), second.goto("/pos")]);
    await Promise.all([addToCart(first, contracts[0]?.productId as string), addToCart(second, contracts[0]?.productId as string)]);
    await Promise.all([first.locator("#payment-method").selectOption("CASH"), second.locator("#payment-method").selectOption("CASH")]);
    const firstSubmit = first.locator("#create-order");
    const secondSubmit = second.locator("#create-order");
    await Promise.all([expect(firstSubmit).toBeVisible(), expect(secondSubmit).toBeVisible()]);
    await Promise.all([expect(firstSubmit).toBeEnabled(), expect(secondSubmit).toBeEnabled()]);
    await Promise.all([firstSubmit.dispatchEvent("click"), secondSubmit.dispatchEvent("click")]);
    await expect.poll(async () => [await first.locator("#notice").textContent(), await second.locator("#notice").textContent()]).toEqual(expect.arrayContaining([expect.stringContaining("RACEUI-001"), expect.stringContaining("商品已售完或剩餘數量不足")]));
    const notices = [await first.locator("#notice").textContent(), await second.locator("#notice").textContent()];
    const failedPage = notices[0]?.includes("RACEUI-001") ? second : first;
    await expect(failedPage.locator("#notice")).toContainText("商品已售完或剩餘數量不足");
    await failedPage.locator("[data-dismiss-notice]").click();
    await expect(failedPage.locator("#notice")).toBeEmpty();
    const products = await api(page, `/api/events/current/products`);
    expect(products.body.data).toHaveLength(1);
    expect(products.body.data[0]).toMatchObject({ productId: contracts[0]?.productId, remainingQuantity: 0 });
    const orders = await api(page, `/api/events/${eventId}/orders`);
    expect(orders.body.data).toHaveLength(1);
    expect(orders.body.data[0]?.orderNumber).toBe("RACEUI-001");
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
    await closeEvent(page, eventId);
    const current = await api(page, "/api/events/current");
    expect(current.status).toBe(200);
    expect(current.body.data).toBeNull();
  }
});
