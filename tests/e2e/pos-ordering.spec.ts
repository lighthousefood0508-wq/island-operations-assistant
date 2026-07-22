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
  const category = await api(page, "/api/admin/categories", "POST", { code: `cat-${eventCode.toLowerCase()}`, displayName: "Meals", sortOrder: 1 });
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
      await api(page, `/api/orders/${order.orderId}/release-inventory`, "POST", { confirmed: true });
    }
  }
  await api(page, `/api/events/${eventId}/close`, "POST", { confirmed: true });
}

async function addToCart(page: Page, productId: string) {
  await page.locator(`button[data-action="add"][data-product-id="${productId}"]`).click();
}

test("POS keeps front-office tabs, creates a central Order, and protects cart navigation", async ({ page, browser }) => {
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
    for (const tab of ["現場點餐", "待出餐", "預約單", "客人訂單"]) await expect(page.getByRole("button", { name: tab })).toBeVisible();
    await expect(page.getByRole("button", { name: "備貨／商品" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "今日統計" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Kitchen" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back Office" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("帳面總額");
    await expect(page.locator("body")).not.toContainText("實收差額");
    await expect(page.locator("body")).not.toContainText("毛利");

    await expect(page.locator("#category-tabs")).toContainText("Meals");
    await expect(page.locator(`article[data-product-id="${contracts[0]?.productId}"]`)).toContainText("Rice");
    await expect(page.locator(`article[data-product-id="${contracts[1]?.productId}"]`)).toContainText("Shrimp");
    await expect(page.locator(`article[data-product-id="${contracts[2]?.productId}"]`)).toHaveClass(/sold-out/);
    await expect(page.locator(`article[data-product-id="${contracts[2]?.productId}"]`)).toContainText("售完");
    await expect(page.locator(`article[data-product-id="${contracts[2]?.productId}"] button`)).toBeDisabled();

    await page.getByRole("button", { name: "預約單" }).click();
    await expect(page.locator('[data-pane="preorder"]')).toContainText("尚未啟用");
    await page.getByRole("button", { name: "客人訂單" }).click();
    await expect(page.locator('[data-pane="customer"]')).toContainText("尚未啟用");
    await page.getByRole("button", { name: "現場點餐" }).click();

    await addToCart(page, contracts[0]?.productId as string);
    await page.once("dialog", async (dialog) => { expect(dialog.message()).toContain("購物車尚未送出"); await dialog.dismiss(); });
    await page.getByRole("link", { name: "Kitchen" }).click();
    await expect(page).toHaveURL(/\/pos/);
    await page.locator("#clear-cart").click();
    await expect(page.locator("#cart-items")).toContainText("點商品即可加入訂單");

    await addToCart(page, contracts[0]?.productId as string);
    await addToCart(page, contracts[0]?.productId as string);
    await page.locator(`[data-adjust="-1"][data-product-id="${contracts[0]?.productId}"]`).click();
    await addToCart(page, contracts[1]?.productId as string);
    await page.locator(`input[data-note="${contracts[0]?.productId}"]`).fill("less sauce");
    await page.locator("#customer-name").fill("Miles");
    await page.locator("#customer-phone-tail").fill("1234");
    await page.locator("#payment-method").selectOption("CASH");
    await page.locator("#order-notes").fill("counter pickup");
    await expect(page.locator("#cart-items")).toContainText("Rice");
    await expect(page.locator("#cart-items")).toContainText("Shrimp");
    await expect(page.locator("#total")).toContainText("NT$400");
    await expect(page.locator(".stat")).toHaveCount(4);

    await page.locator("#create-order").click();
    await expect(page.locator("#notice")).toContainText("POSUI-001");
    await expect(page.locator(`article[data-product-id="${contracts[0]?.productId}"]`)).toContainText("剩 4 份");
    await expect(page.locator(`article[data-product-id="${contracts[1]?.productId}"]`)).toContainText("剩 3 份");
    const orders = await api(page, `/api/events/${eventId}/orders`);
    expect(orders.body.data[0]?.customerName).toBe("Miles");
    expect(orders.body.data[0]?.customerPhoneTail).toBe("1234");
    expect(orders.body.data[0]?.paymentMethod).toBe("CASH");
    expect(orders.body.data[0]?.notes).toBe("counter pickup");

    await page.getByRole("button", { name: "待出餐" }).click();
    await expect(page.locator("#orders")).toContainText("POSUI-001");
    await expect(page.locator("#orders")).toContainText("Miles");
    await expect(page.locator("#orders")).toContainText("1234");
    await expect(page.locator("#orders")).toContainText("現金");
    await expect(page.locator("#orders")).toContainText("訂單：confirmed");
    await expect(page.locator("#orders")).toContainText("付款：unpaid");
    await expect(page.locator("#orders")).toContainText("製作：not_started");
    await expect(kitchen.locator("#pending")).toContainText("Miles");
    await expect(kitchen.getByRole("link", { name: "POS" })).toBeVisible();
    await expect(kitchen.getByRole("link", { name: "Back Office" })).toBeVisible();

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
