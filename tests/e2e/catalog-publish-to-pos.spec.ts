import { expect, test, type Page } from "@playwright/test";

async function createCategory(page: Page, displayName: string, active = true) {
  await page.goto("/admin");
  await page.locator("#category-name").fill(displayName);
  await page.locator("#category-sort").fill("10");
  await page.locator("#category-active").selectOption(String(active));
  await page.locator("#category-form button[type=submit]").click();
}

async function createDraft(page: Page, input: { internalName: string; categoryName: string; displayName?: string; posName?: string; price?: string; channels?: string[] }) {
  for (const checkbox of await page.locator(".channels input:checked").all()) await checkbox.uncheck();
  await page.locator("#internal-name").fill(input.internalName);
  await expect(page.locator("#product-category")).toContainText(input.categoryName);
  await page.locator("#product-category").selectOption({ label: input.categoryName });
  if (input.displayName !== undefined) await page.locator("#display-name").fill(input.displayName);
  if (input.posName !== undefined) await page.locator("#pos-name").fill(input.posName);
  if (input.price !== undefined) await page.locator("#selling-price").fill(input.price);
  for (const channel of input.channels ?? []) await page.locator(`.channels input[value="${channel}"]`).check();
  await page.locator("#product-form button[type=submit]").click();
}

async function publish(page: Page) { await page.locator("#publish").click(); }

test.describe.configure({ mode: "serial" });

test("Admin publication flows through Event inventory to the POS short-name display", async ({ page, browser }) => {
  await createCategory(page, "Bento");
  await createDraft(page, { internalName: "Braised rice", categoryName: "Bento", displayName: "Braised rice", posName: "Rice", price: "180", channels: ["pos"] });
  await publish(page);
  await expect(page.locator("#products")).toContainText("v1");
  const contract = (await (await page.request.get("/api/catalog/products/published?channel=pos")).json()).data[0];
  expect(contract).toMatchObject({ displayName: "Braised rice", posName: "Rice", sellingPrice: 180 });

  await page.goto("/admin/events");
  await page.locator("#event-code").fill("e2e-night");
  await page.locator("#event-name").fill("E2E market");
  await page.locator("#event-date").fill("2026-07-20");
  await page.locator("#event-start").fill("17:00");
  await page.locator("#event-end").fill("22:00");
  await page.locator("#event-form button[type=submit]").click();
  await page.locator("#inventory-product").selectOption({ index: 1 });
  await page.locator("#planned-quantity").fill("20");
  await page.locator("#inventory-form button[type=submit]").click();
  const openResponsePromise = page.waitForResponse(response => response.url().includes("/api/admin/events/") && response.url().endsWith("/open") && response.request().method() === "POST");
  await page.locator("#open-event").click();
  const openResponse = await openResponsePromise;
  expect(openResponse.ok()).toBeTruthy();

  await page.goto("/pos");
  await expect(page.locator("#products")).toContainText("Rice");
  await expect(page.locator("#products")).toContainText("NT$180");
  await expect(page.locator("#products")).toContainText("20");
  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();
  await freshPage.goto("/pos");
  await expect(freshPage.locator("#products")).toContainText("Rice");
  expect(await freshPage.evaluate(() => window.localStorage.length)).toBe(0);
  await freshContext.close();

  await page.request.post(`/api/events/${(await (await page.request.get("/api/events/current")).json()).data.eventId}/close`, { data: { confirmed: true } });
  await page.goto("/pos");
  await expect(page.locator("#empty")).not.toBeEmpty();
});

test("Catalog Admin keeps the selected product, draft, and published version in sync", async ({ page }) => {
  await createCategory(page, "Catalog Sync");
  await expect(page.locator("#product-id")).toHaveValue("");
  await page.locator("#internal-name").fill("Sync meal");
  await page.locator("#product-category").selectOption({ label: "Catalog Sync" });
  await page.locator("#display-name").fill("Sync meal");
  await page.locator("#pos-name").fill("Sync");
  await page.locator("#selling-price").fill("180");
  await page.locator('.channels input[value="pos"]').check();
  await page.locator("#product-status").selectOption("published");
  await page.locator("#product-form button[type=submit]").click();
  await expect(page.locator("#product-id")).not.toHaveValue("");
  const productId = await page.locator("#product-id").inputValue();
  await expect(page.locator("#publication-status")).toContainText("尚未發布");
  await expect(page.locator("#notice")).toContainText("草稿已儲存");
  let products = (await (await page.request.get("/api/admin/products")).json()).data;
  expect(products.find((product: any) => product.productId === productId)).toMatchObject({ status: "draft", versions: [] });

  await publish(page);
  await expect(page.locator("#products")).toContainText("published");
  await expect(page.locator("#products")).toContainText("v1");
  await page.reload();
  await page.locator(`[data-product="${productId}"]`).click();
  await expect(page.locator("#product-id")).toHaveValue(productId);
  await expect(page.locator("#publication-status")).toContainText("已發布 v1");
  await page.locator("#selling-price").fill("190");
  await page.locator("#product-form button[type=submit]").click();
  await expect(page.locator("#notice")).toContainText("商品草稿已儲存");
  await publish(page);
  await expect(page.locator("#products")).toContainText("v2");
  await expect(page.locator("#notice")).toContainText("已發布 v2");
  products = (await (await page.request.get("/api/admin/products")).json()).data;
  expect(products.find((product: any) => product.productId === productId)?.versions).toHaveLength(2);
});

test("publish rejects a draft without POS short name", async ({ page }) => {
  await createCategory(page, "Missing POS");
  await createDraft(page, { internalName: "No short name", categoryName: "Missing POS", displayName: "No short name", price: "180", channels: ["pos"] });
  await publish(page);
  await expect(page.locator("#notice")).toContainText("posName is required");
});

test("publish rejects a draft without a price or enabled channel", async ({ page }) => {
  await createCategory(page, "Missing price");
  await createDraft(page, { internalName: "No price", categoryName: "Missing price", displayName: "No price", posName: "NoPrice", channels: ["pos"] });
  await publish(page);
  await expect(page.locator("#notice")).toContainText("sellingPrice must be a non-negative integer");
  await createDraft(page, { internalName: "No channel", categoryName: "Missing price", displayName: "No channel", posName: "NoChannel", price: "180" });
  await publish(page);
  await expect(page.locator("#notice")).toContainText("At least one channel is required");
});

test("inactive categories and kiosk-only products stay out of POS", async ({ page }) => {
  await createCategory(page, "Inactive", false);
  await expect(page.locator("#product-category")).not.toContainText("Inactive");
  await createCategory(page, "Kiosk");
  await createDraft(page, { internalName: "Kiosk item", categoryName: "Kiosk", displayName: "Kiosk item", posName: "Kiosk", price: "130", channels: ["kiosk"] });
  await publish(page);
  await page.goto("/pos");
  await expect(page.locator("#products")).not.toContainText("Kiosk");
});
