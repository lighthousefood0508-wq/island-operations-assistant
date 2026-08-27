import { expect, test, type Page } from "@playwright/test";

async function createCategory(page: Page, displayName: string, active = true) {
  await page.goto("/admin/catalog/categories");
  await page.locator("#category-name").fill(displayName);
  await page.locator("#category-sort").fill("10");
  await page.locator("#category-active").selectOption(String(active));
  await page.locator("#category-form button[type=submit]").click();
  await page.goto("/admin/catalog/products");
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

async function saveZeroCloseout(page: Page, eventId: string) {
  const statistics = await (await page.request.get(`/api/events/${eventId}/statistics`)).json();
  const response = await page.request.put(`/api/events/${eventId}/closeout`, {
    data: {
      cashReceived: 0,
      linePayReceived: 0,
      otherReceived: 0,
      wasteAmount: 0,
      notes: "",
      items: statistics.data.inventory.map((item: any) => ({ productVersionId: item.productVersionId, wasteQuantity: 0 }))
    }
  });
  expect(response.ok()).toBeTruthy();
}

test.describe.configure({ mode: "serial" });

test("Admin publication flows through Event inventory to the POS short-name display", async ({ page, browser }) => {
  await createCategory(page, "Bento");
  await createDraft(page, { internalName: "Braised rice", categoryName: "Bento", displayName: "Braised rice", posName: "Rice", price: "180", channels: ["pos"] });
  await publish(page);
  await expect(page.locator("#products")).toContainText("v1");
  const contracts = (await (await page.request.get("/api/catalog/products/published?channel=pos")).json()).data;
  const contract = contracts.find((item: { posName: string }) => item.posName === "Rice");
  expect(contract).toMatchObject({ displayName: "Braised rice", posName: "Rice", sellingPrice: 180 });

  await page.goto("/admin");
  await page.locator("#event-name").fill("E2E market");
  await page.locator("#event-date").fill("2026-07-20");
  await page.locator("#event-start").fill("17:00");
  await page.locator("#event-end").fill("22:00");
  await page.locator("#event-form button[type=submit]").click();
  await expect(page.locator("#event-id")).not.toHaveValue("");
  const eventId = await page.locator("#event-id").inputValue();
  const products = (await (await page.request.get("/api/admin/products")).json()).data;
  const productId = products.find((item: { internalName: string }) => item.internalName === "Braised rice")?.productId;
  expect(productId).toBeTruthy();
  const publishedProduct = (await (await page.request.get(`/api/admin/products/${productId}`)).json()).data;
  await page.locator("#published-product").selectOption(publishedProduct.versions.at(-1).productVersionId);
  await page.locator("#new-planned").fill("20");
  await page.locator("#add-product-form button[type=submit]").click();
  const saveResponsePromise = page.waitForResponse(response =>
    response.request().method() === "PUT"
    && new URL(response.url()).pathname === `/api/admin/events/${eventId}/sellable-inventory`
  );
  await page.locator("#save-all").click();
  const saveResponse = await saveResponsePromise;
  const saveBody = await saveResponse.json();
  if (!saveResponse.ok()) {
    throw new Error(`Catalog Event inventory save failed: status=${saveResponse.status()}; eventId=${eventId}; body=${JSON.stringify(saveBody)}`);
  }
  const openResponsePromise = page.waitForResponse(response => response.url().includes("/api/admin/events/") && response.url().endsWith("/open") && response.request().method() === "POST");
  await page.locator("#open-event").click();
  const openResponse = await openResponsePromise;
  const openBody = await openResponse.json();
  if (!openResponse.ok()) {
    throw new Error(`Catalog Event open failed: status=${openResponse.status()}; eventCode=E2E; body=${JSON.stringify(openBody)}`);
  }

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

  const currentEventId = (await (await page.request.get("/api/events/current")).json()).data.eventId;
  await saveZeroCloseout(page, currentEventId);
  const closeResponse = await page.request.post(`/api/events/${currentEventId}/close`, { data: { confirmed: true } });
  expect(closeResponse.ok()).toBeTruthy();
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

test("Catalog Admin focuses editing, restores inactive products, and deletes only unpublished drafts", async ({ page }) => {
  await createCategory(page, "Catalog actions");
  await createDraft(page, { internalName: "Temporary meal", categoryName: "Catalog actions", displayName: "Temporary meal", posName: "Temporary", price: "90", channels: ["pos"] });
  await expect(page.locator("#product-id")).not.toHaveValue("");
  const productId = await page.locator("#product-id").inputValue();

  await page.locator("#clear-product").click();
  await page.locator(`[data-product="${productId}"]`).click();
  await expect(page.locator("#product-form-title")).toHaveText("編輯品項：Temporary meal");
  await expect(page.locator("#save-product")).toHaveText("儲存修改");
  await expect(page.locator("#clear-product")).toHaveText("取消編輯");
  await expect(page.locator("#internal-name")).toBeFocused();

  page.once("dialog", dialog => dialog.accept());
  await page.locator(`[data-deactivate-product="${productId}"]`).click();
  await expect(page.locator(`[data-restore-product="${productId}"]`)).toBeVisible();
  await page.locator(`[data-restore-product="${productId}"]`).click();
  await expect(page.locator(`[data-deactivate-product="${productId}"]`)).toBeVisible();

  page.once("dialog", dialog => dialog.accept());
  await page.locator(`[data-delete-product="${productId}"]`).click();
  await expect(page.locator(`[data-product="${productId}"]`)).toHaveCount(0);
  await expect(page.locator("#notice")).toContainText("未發布商品已永久刪除");
  await expect(page.locator("#product-id")).toHaveValue("");

  await createDraft(page, { internalName: "Permanent history", categoryName: "Catalog actions", displayName: "Permanent history", posName: "Permanent", price: "100", channels: ["pos"] });
  await expect(page.locator("#product-id")).not.toHaveValue("");
  const publishedId = await page.locator("#product-id").inputValue();
  await publish(page);
  await expect(page.locator(`[data-delete-product="${publishedId}"]`)).toHaveCount(0);
});
