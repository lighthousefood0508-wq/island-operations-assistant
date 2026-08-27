import { expect, test } from "@playwright/test";

test("Back Office groups existing routes under operational axes without breaking deep links", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin/catalog");

  const primary = page.getByRole("navigation", { name: "後台主軸" });
  await expect(primary.locator(":scope > a")).toHaveText(["商品目錄", "場次", "成本"]);
  await expect(primary.getByRole("link", { name: "商品目錄", exact: true })).toHaveAttribute("aria-current", "page");
  const catalogSecondary = page.getByRole("navigation", { name: "目前主軸功能" });
  for (const label of ["商品分類", "商品資料", "售價與通路", "正式發布"]) {
    await expect(catalogSecondary.getByRole("link", { name: label, exact: true })).toBeVisible();
  }

  await page.getByRole("link", { name: "商品分類", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/catalog#catalog-categories$/);

  await primary.getByRole("link", { name: "場次", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "場次", exact: true })).toBeVisible();
  const operationsSecondary = page.getByRole("navigation", { name: "目前主軸功能" });
  for (const label of ["場次管理", "商品與備貨", "今日營運", "今日統計", "場次分析"]) {
    await expect(operationsSecondary.getByRole("link", { name: label, exact: true })).toBeVisible();
  }

  await page.getByRole("link", { name: "今日統計", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/statistics$/);
  await expect(page.locator('.office-primary a[aria-current="page"]')).toHaveText("場次");
  await expect(page.locator('.office-secondary a[aria-current="page"]')).toHaveText("今日統計");
  await page.goBack();
  await expect(page).toHaveURL(/\/admin$/);

  await primary.getByRole("link", { name: "成本", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/cost$/);
  await expect(page.getByRole("heading", { name: "成本總覽" })).toBeVisible();
  await page.getByRole("link", { name: "採購與驗收", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/cost#cost-purchases$/);
  await expect(page.locator('.office-secondary a[aria-current="page"]')).toHaveText("採購與驗收");

  const systemMenu = page.locator(".office-system");
  await systemMenu.locator("summary").click();
  await expect(systemMenu.getByRole("link", { name: "系統狀態", exact: true })).toBeVisible();
  await systemMenu.getByRole("link", { name: "系統狀態", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/health$/);
  await expect(page.locator(".office-system")).toHaveAttribute("open", "");
  await expect(page.locator('.office-secondary a[aria-current="page"]')).toHaveText("系統狀態");
});

test("Back Office navigation remains touch-sized, focused, and active on tablet deep links", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1280 });
  await page.goto("/admin/ingredients");

  const cost = page.getByRole("navigation", { name: "後台主軸" }).getByRole("link", { name: "成本", exact: true });
  await expect(cost).toHaveAttribute("aria-current", "page");
  await cost.focus();
  await expect(cost).toBeFocused();
  const box = await cost.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.office-secondary a[aria-current="page"]')).toHaveText("食材主檔");
  await expect(page.locator(".office-system summary")).toBeVisible();
});
