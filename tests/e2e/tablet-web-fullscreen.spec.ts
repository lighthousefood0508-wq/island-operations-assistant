import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let active = false;
    Object.defineProperty(Document.prototype, "fullscreenElement", {
      configurable: true,
      get: () => active ? document.documentElement : null
    });
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: async () => { active = true; document.dispatchEvent(new Event("fullscreenchange")); }
    });
    Object.defineProperty(Document.prototype, "exitFullscreen", {
      configurable: true,
      value: async () => { active = false; document.dispatchEvent(new Event("fullscreenchange")); }
    });
  });
});

async function openSystemMenu(page: import("@playwright/test").Page): Promise<void> {
  const summary = page.locator("details.system-menu summary, details.office-system summary").last();
  await summary.click();
  await expect(page.getByRole("button", { name: "進入全螢幕", exact: true })).toBeVisible();
}

test("POS, Kitchen and Back Office expose one-tap tablet display controls", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1280 });

  for (const path of ["/pos", "/kitchen", "/admin/cost"]) {
    await page.goto(path);
    await openSystemMenu(page);
    const toggle = page.getByRole("button", { name: "進入全螢幕", exact: true });
    const box = await toggle.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await toggle.click();
    await expect(page.getByRole("button", { name: "退出全螢幕", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "退出全螢幕", exact: true }).click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("tablet users can display the current changing public URL", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/pos?device=Tablet-POS");
  await openSystemMenu(page);
  await page.getByRole("button", { name: "顯示目前網址", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "目前網頁網址" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "目前網頁網址" })).toHaveValue(page.url());
  await expect(dialog.getByRole("button", { name: "複製網址", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "關閉", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test("unsupported fullscreen fails closed with a Chinese tablet hint", async ({ page }) => {
  await page.goto("/kitchen");
  await openSystemMenu(page);
  await page.evaluate(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", { configurable: true, value: undefined });
    Object.defineProperty(Element.prototype, "webkitRequestFullscreen", { configurable: true, value: undefined });
    Object.defineProperty(Document.prototype, "exitFullscreen", { configurable: true, value: undefined });
    Object.defineProperty(Document.prototype, "webkitExitFullscreen", { configurable: true, value: undefined });
  });
  await page.getByRole("button", { name: "進入全螢幕", exact: true }).click();
  await expect(page.locator("[data-display-mode-notice]")).toContainText("此平板瀏覽器不支援網頁全螢幕");
});
