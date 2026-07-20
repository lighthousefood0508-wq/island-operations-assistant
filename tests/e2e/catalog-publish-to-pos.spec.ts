import { expect, test, type Page } from "@playwright/test";

async function createCategory(page: Page, code: string, displayName: string, isActive = true) {
  await page.goto("/admin");
  await page.locator("#category-code").fill(code);
  await page.locator("#category-name").fill(displayName);
  await page.locator("#category-sort").fill("10");
  await page.locator("#category-active").selectOption(String(isActive));
  await page.locator("#category-form button[type=submit]").click();
  await expect(page.locator("#notice")).toContainText("分類已儲存");
}

async function createProductDraft(page: Page, input: { internalName: string; categoryName: string; displayName?: string; posName?: string; price?: string; channels?: string[] }) {
  await page.locator("#internal-name").fill(input.internalName);
  await page.locator("#product-category").selectOption({ label: input.categoryName });
  if (input.displayName !== undefined) await page.locator("#display-name").fill(input.displayName);
  if (input.posName !== undefined) await page.locator("#pos-name").fill(input.posName);
  if (input.price !== undefined) await page.locator("#selling-price").fill(input.price);
  for (const channel of input.channels ?? []) await page.locator(`.channels input[value="${channel}"]`).check();
  await page.locator("#product-form button[type=submit]").click();
  await expect(page.locator("#notice")).toContainText("商品草稿已儲存");
}

async function publish(page: Page) {
  await page.locator("#publish").click();
}

test.describe.configure({ mode: "serial" });

test("Admin publishes a product and POS reads Product Contract from central SQLite", async ({ page, browser }) => {
  await createCategory(page, "bento", "便當");
  await createProductDraft(page, { internalName: "一曲東坡肉", categoryName: "便當", displayName: "一曲東坡肉", posName: "東坡", price: "180", channels: ["pos"] });
  await publish(page);
  await expect(page.locator("#notice")).toContainText("已發布 v1");
  await expect(page.locator("#products")).toContainText("一曲東坡肉");
  await expect(page.locator("#products")).toContainText("v1");

  const response = await page.request.get("/api/catalog/products/published?channel=pos");
  const body = await response.json();
  expect(body.ok).toBe(true);
  expect(body.data).toHaveLength(1);
  expect(body.data[0]).toMatchObject({ displayName: "一曲東坡肉", posName: "東坡", sellingPrice: 180 });

  await page.goto("/pos");
  await expect(page.locator("#products")).toContainText("一曲東坡肉");
  await expect(page.locator("#products")).toContainText("東坡");
  await expect(page.locator("#products")).toContainText("180 元");
  await expect(page.locator("#products")).toContainText("分類：");
  await page.reload();
  await expect(page.locator("#products")).toContainText("一曲東坡肉");
  expect(await page.evaluate(() => window.localStorage.length)).toBe(0);

  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();
  await freshPage.goto("/pos");
  await expect(freshPage.locator("#products")).toContainText("一曲東坡肉");
  expect(await freshPage.evaluate(() => window.localStorage.length)).toBe(0);
  await freshContext.close();
});

test("publish rejects a draft without POS short name", async ({ page }) => {
  await createCategory(page, "negative-pos", "缺短名分類");
  await createProductDraft(page, { internalName: "缺短名商品", categoryName: "缺短名分類", displayName: "缺短名商品", price: "180", channels: ["pos"] });
  await publish(page);
  await expect(page.locator("#notice")).toContainText("posName is required");
});

test("publish rejects a draft without a price or enabled channel", async ({ page }) => {
  await createCategory(page, "negative-price", "缺價格分類");
  await createProductDraft(page, { internalName: "缺價格商品", categoryName: "缺價格分類", displayName: "缺價格商品", posName: "缺價格", channels: ["pos"] });
  await publish(page);
  await expect(page.locator("#notice")).toContainText("sellingPrice must be a non-negative integer");

  await page.goto("/admin");
  await createProductDraft(page, { internalName: "缺通路商品", categoryName: "缺價格分類", displayName: "缺通路商品", posName: "缺通路", price: "180" });
  await publish(page);
  await expect(page.locator("#notice")).toContainText("At least one channel is required");
});

test("inactive category and non-POS products stay out of POS", async ({ page }) => {
  await createCategory(page, "inactive-cat", "停用分類");
  await createProductDraft(page, { internalName: "停用分類商品", categoryName: "停用分類", displayName: "停用分類商品", posName: "停用", price: "180", channels: ["pos"] });
  await page.locator('#categories .item', { hasText: "停用分類" }).getByRole("button", { name: "編輯" }).click();
  await page.locator("#category-active").selectOption("false");
  await page.locator("#category-form button[type=submit]").click();
  await expect(page.locator("#notice")).toContainText("分類已儲存");
  await publish(page);
  await expect(page.locator("#notice")).toContainText("inactive category");

  await createCategory(page, "kiosk-cat", "Kiosk 分類");
  await createProductDraft(page, { internalName: "未發布商品", categoryName: "Kiosk 分類", displayName: "未發布商品", posName: "未發布", price: "120", channels: ["pos"] });
  await page.goto("/pos");
  await expect(page.locator("#products")).not.toContainText("未發布商品");

  await page.goto("/admin");
  await createProductDraft(page, { internalName: "Kiosk 商品", categoryName: "Kiosk 分類", displayName: "Kiosk 商品", posName: "Kiosk", price: "130", channels: ["kiosk"] });
  await publish(page);
  await expect(page.locator("#notice")).toContainText("已發布 v1");
  await page.goto("/pos");
  await expect(page.locator("#products")).not.toContainText("Kiosk 商品");
});
