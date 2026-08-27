import { expect, test } from "@playwright/test";

test("Back Office uses reloadable Catalog and Cost workspaces instead of anchor pseudo-tabs", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin/catalog/products");

  const primary = page.getByRole("navigation", { name: "後台主軸" });
  await expect(primary.locator(":scope > a")).toHaveText(["商品目錄", "場次", "成本"]);
  await expect(primary.getByRole("link", { name: "商品目錄", exact: true })).toHaveAttribute("aria-current", "page");
  const catalog = page.getByRole("navigation", { name: "目前主軸功能" });
  await expect(catalog.getByRole("link", { name: "分類管理", exact: true })).toHaveAttribute("href", "/admin/catalog/categories");
  await expect(catalog.getByRole("link", { name: "商品管理", exact: true })).toHaveAttribute("href", "/admin/catalog/products");
  await expect(page.locator("#category-form")).toHaveCount(0);
  await expect(page.locator("#product-form")).toBeVisible();

  await page.getByRole("link", { name: "分類管理", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/catalog\/categories$/);
  await expect(page.locator("#category-form")).toBeVisible();
  await expect(page.locator("#product-form")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#category-form")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/catalog\/products$/);

  await primary.getByRole("link", { name: "成本", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/cost$/);
  await expect(page.locator("h1")).toHaveText("成本總覽");
  await expect(page.locator("#cost-overview")).toBeVisible();
  await expect(page.locator("#ingredient-form")).not.toBeVisible();
  const groups = page.getByRole("navigation", { name: "成本工作區" });
  await expect(groups.getByRole("link", { name: "食材主檔", exact: true })).toHaveAttribute("href", "/admin/ingredients");
  await groups.getByRole("link", { name: "食材主檔", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/ingredients$/);
  await expect(page.getByRole("link", { name: "新增正式食材", exact: false })).toHaveAttribute("href", "/admin/ingredients/new");
  await expect(page.locator(".office-workspace-group a[aria-current=page]")).toHaveText("食材主檔");
  await page.getByRole("link", { name: "新增正式食材", exact: false }).click();
  await expect(page).toHaveURL(/\/admin\/ingredients\/new$/);
  await expect(page.locator("#ingredient-form")).toBeVisible();
  await page.reload();
  await expect(page.locator("#ingredient-form")).toBeVisible();
  await page.goto("/admin/cost/ingredients");
  await expect(page).toHaveURL(/\/admin\/ingredients\/new$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/ingredients\/new$/);
  await page.goto("/admin/ingredients");
  await expect(page).toHaveURL(/\/admin\/ingredients$/);
  await page.getByRole("link", { name: "新增正式食材", exact: false }).click();
  await expect(page).toHaveURL(/\/admin\/ingredients\/new$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/ingredients$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/admin\/ingredients\/new$/);
  await page.goto("/admin/cost");
  await expect(groups.getByRole("link", { name: "採購與驗收", exact: true })).toHaveAttribute("href", "/admin/cost/purchases");
  await groups.getByRole("link", { name: "採購與驗收", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/cost\/purchases$/);
  await expect(page.locator("#purchase-form")).toBeVisible();
  await expect(page.locator("#supplier-form")).not.toBeVisible();
  await page.reload();
  await expect(page.locator("#purchase-form")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/cost$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/admin\/cost\/purchases$/);
  await expect(page.locator(".office-workspace-group a[aria-current=page]")).toHaveText("採購與驗收");
});

test("Back Office navigation remains touch-sized and active on tablet workspace routes", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1280 });
  await page.goto("/admin/cost/analytics");
  const cost = page.getByRole("navigation", { name: "後台主軸" }).getByRole("link", { name: "成本", exact: true });
  await expect(cost).toHaveAttribute("aria-current", "page");
  await cost.focus();
  await expect(cost).toBeFocused();
  const box = await cost.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator(".office-workspace-group a[aria-current=page]")).toHaveText("成本分析");
  await expect(page.locator(".office-system summary")).toBeVisible();
});
