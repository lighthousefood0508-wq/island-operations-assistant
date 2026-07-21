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

test("POS creates a central Order from two cart products and refreshes remaining quantities", async ({ page }) => {
  const { eventId, contracts } = await setupOpenEvent(page, "POSUI", [
    { name: "Rice bowl", posName: "Rice", price: 180, quantity: 5 },
    { name: "Shrimp bowl", posName: "Shrimp", price: 220, quantity: 4 }
  ]);
  await page.goto("/pos");
  await expect(page.locator("#products")).toContainText("Meals");
  await expect(page.locator(`article[data-product-id="${contracts[0]?.productId}"]`)).toContainText("Rice");
  await expect(page.locator(`article[data-product-id="${contracts[1]?.productId}"]`)).toContainText("Shrimp");
  await addToCart(page, contracts[0]?.productId as string);
  await addToCart(page, contracts[1]?.productId as string);
  await expect(page.locator("#cart-items")).toContainText("Rice");
  await expect(page.locator("#cart-items")).toContainText("Shrimp");
  await expect(page.locator("#total")).toContainText("NT$400");
  await page.locator("#create-order").click();
  await expect(page.locator("#notice")).toContainText("POSUI-001");
  await expect(page.locator(`article[data-product-id="${contracts[0]?.productId}"]`)).toContainText("剩餘 4 份");
  await expect(page.locator(`article[data-product-id="${contracts[1]?.productId}"]`)).toContainText("剩餘 3 份");
  await page.reload();
  await expect(page.locator(`article[data-product-id="${contracts[0]?.productId}"]`)).toContainText("剩餘 4 份");
  await expect(page.locator(`article[data-product-id="${contracts[1]?.productId}"]`)).toContainText("剩餘 3 份");
  await closeEvent(page, eventId);
});

test("two POS browser contexts race for the final portion and only one creates an Order", async ({ browser, page }) => {
  const { eventId, contracts } = await setupOpenEvent(page, "RACEUI", [{ name: "Last bowl", posName: "Last", price: 150, quantity: 1 }]);
  const firstContext: BrowserContext = await browser.newContext();
  const secondContext: BrowserContext = await browser.newContext();
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();
  await Promise.all([first.goto("/pos"), second.goto("/pos")]);
  await Promise.all([addToCart(first, contracts[0]?.productId as string), addToCart(second, contracts[0]?.productId as string)]);
  await Promise.all([first.locator("#create-order").click(), second.locator("#create-order").click()]);
  await expect.poll(async () => [await first.locator("#notice").textContent(), await second.locator("#notice").textContent()]).toEqual(expect.arrayContaining([expect.stringContaining("RACEUI-001"), expect.stringContaining("數量不足")]));
  const notices = [await first.locator("#notice").textContent(), await second.locator("#notice").textContent()];
  const failedPage = notices[0]?.includes("RACEUI-001") ? second : first;
  await expect(failedPage.locator("#notice")).toContainText("????");
  await failedPage.locator("[data-dismiss-notice]").click();
  await expect(failedPage.locator("#notice")).toBeEmpty();
  const orders = await api(page, `/api/events/current/products`);
  expect(orders.body.data).toEqual([]);
  await firstContext.close();
  await secondContext.close();
  await closeEvent(page, eventId);
});
