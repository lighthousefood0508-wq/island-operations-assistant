import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

type Ingredient = Readonly<{
  ingredientId: string;
  name: string;
  status: "Active" | "Archived";
  aggregateVersion: number;
}>;

async function createIngredient(
  request: APIRequestContext,
  name: string
): Promise<Ingredient> {
  const response = await request.post("/api/admin/cost/ingredients", {
    data: {
      name,
      categoryCode: "other",
      occurredAt: "2026-08-11T00:00:00.000Z",
      actor: "e2e-owner"
    }
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data as Ingredient;
}

async function openIngredient(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: new RegExp(name) }).first().click();
  await expect(page.locator("#detail-name")).toHaveText(name);
}

async function fillRename(
  page: Page,
  values: Readonly<{ name: string; actor: string; occurredAt: string; reason: string }>
): Promise<void> {
  await page.locator("#rename-name").fill(values.name);
  await page.locator("#rename-actor").fill(values.actor);
  await page.locator("#rename-occurred-at").fill(values.occurredAt);
  await page.locator("#rename-reason").fill(values.reason);
}

test("Canonical Ingredient management UI completes Rename, warning and Archive", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const sourceName = `UI source ${suffix}`;
  const duplicateName = `UI duplicate ${suffix}`;
  const source = await createIngredient(page.request, sourceName);
  const duplicateFirst = await createIngredient(page.request, duplicateName);
  const duplicateSecond = await createIngredient(page.request, duplicateName);
  const archivedSeed = await createIngredient(page.request, `UI archived ${suffix}`);
  const archivedResponse = await page.request.post(
    `/api/admin/canonical-ingredients/${archivedSeed.ingredientId}/archive`,
    { data: { expectedVersion: 0, actor: "seed-owner", occurredAt: "2026-08-11T01:00:00.000Z", reason: "E2E archived fixture" } }
  );
  expect(archivedResponse.ok()).toBeTruthy();

  await page.goto("/admin/ingredients");
  await expect(page).toHaveURL(/\/admin\/ingredients$/);
  await expect(page.getByRole("heading", { name: "食材主檔" })).toBeVisible();
  await expect(page.locator('.office-nav a[aria-current="page"]')).toHaveText("食材主檔");
  const navigation = page.locator(".office-nav a");
  await expect(navigation).toHaveText([
    "場次與備貨",
    "商品目錄",
    "食材主檔",
    "成本中心",
    "今日統計",
    "場次分析",
    "系統狀態",
    "裝置連線"
  ]);

  await expect(page.locator("#ingredient-list")).toContainText(sourceName);
  await expect(page.locator("#ingredient-list")).toContainText(`UI archived ${suffix}`);
  await page.locator("#lifecycle-filter").selectOption("archived");
  await expect(page.locator("#ingredient-list")).not.toContainText(sourceName);
  await openIngredient(page, `UI archived ${suffix}`);
  await expect(page.locator("#archive-fact")).toContainText("seed-owner");
  await expect(page.locator("#active-actions")).toBeHidden();
  await page.locator("#lifecycle-filter").selectOption("active");
  await expect(page.locator("#ingredient-list")).toContainText(sourceName);
  await expect(page.locator("#ingredient-list")).not.toContainText(`UI archived ${suffix}`);
  await openIngredient(page, sourceName);
  await expect(page.locator("#detail-id")).toHaveText(source.ingredientId);
  await expect(page.locator("#detail-version")).toHaveText(String(source.aggregateVersion));

  const localOccurredAt = "2026-08-11T14:30";
  const expectedUtc = await page.evaluate(
    (value) => new Date(value).toISOString(),
    localOccurredAt
  );
  const zeroWarningResponse = page.waitForResponse((response) =>
    response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith(`/${source.ingredientId}/rename`)
  );
  await fillRename(page, {
    name: `UI unique renamed ${suffix}`,
    actor: "owner-ui",
    occurredAt: localOccurredAt,
    reason: "確認零候選不顯示提醒"
  });
  await page.locator("#rename-submit").click();
  const zeroWarningBody = await (await zeroWarningResponse).json();
  expect(zeroWarningBody.data.warnings).toEqual([]);
  await expect(page.locator("#duplicate-warning")).toBeHidden();
  await expect(page.locator("#detail-name")).toHaveText(`UI unique renamed ${suffix}`);
  await expect(page.locator("#ingredient-list")).toContainText(`UI unique renamed ${suffix}`);

  const renameResponse = page.waitForResponse((response) =>
    response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith(`/${source.ingredientId}/rename`)
  );
  await fillRename(page, {
    name: duplicateName,
    actor: "owner-ui",
    occurredAt: localOccurredAt,
    reason: "確認重複提醒仍可更名"
  });
  await page.locator("#rename-submit").click();
  const renamedBody = await (await renameResponse).json();
  expect(renamedBody.data.ingredient.renameHistory.at(-1).renamedAt).toBe(expectedUtc);
  await expect(page.locator("#notice")).toHaveText("更名已完成。");
  await expect(page.locator("#duplicate-warning")).toBeVisible();
  await expect(page.locator("#duplicate-warning")).toContainText("名稱相近提醒");
  await expect(page.locator("#duplicate-warning li")).toHaveCount(2);
  const expectedCandidateIds = [duplicateFirst.ingredientId, duplicateSecond.ingredientId].sort();
  expect(await page.locator("#duplicate-warning li").allTextContents()).toEqual([
    `${duplicateName} · 使用中 · ${expectedCandidateIds[0]}`,
    `${duplicateName} · 使用中 · ${expectedCandidateIds[1]}`
  ]);
  await expect(page.locator("#rename-history")).toContainText(sourceName);
  await expect(page.locator("#rename-history")).toContainText(`UI unique renamed ${suffix}`);
  await expect(page.locator("#rename-history")).toContainText("owner-ui");

  await page.locator("#archive-actor").fill("owner-ui");
  await page.locator("#archive-occurred-at").fill("2026-08-11T15:00");
  await page.locator("#archive-reason").fill("停止使用此身分");
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain(duplicateName);
    await dialog.accept();
  });
  await page.locator("#archive-submit").click();
  await expect(page.locator("#notice")).toHaveText("食材已封存。");
  await expect(page.locator("#detail-status")).toHaveText("已封存");
  await expect(page.locator("#active-actions")).toBeHidden();
  await expect(page.locator("#archived-readonly")).toBeVisible();
  await expect(page.locator("#archive-fact")).toContainText("owner-ui");
  await expect(page.locator("#rename-history li")).toHaveCount(2);
  await page.locator("#lifecycle-filter").selectOption("archived");
  await expect(page.locator("#ingredient-list")).toContainText(duplicateName);
  for (const forbidden of ["建立食材", "重新啟用", "刪除", "合併", "Reference Impact"]) {
    await expect(page.getByRole("button", { name: forbidden, exact: true })).toHaveCount(0);
  }
});

test("Canonical Ingredient management UI separates validation, conflicts and network failures", async ({ page }) => {
  const name = `UI errors ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const ingredient = await createIngredient(page.request, name);
  await page.goto("/admin/ingredients");
  await openIngredient(page, name);

  await page.route(`**/api/admin/canonical-ingredients/${ingredient.ingredientId}/rename`, async (route) => {
    await route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: { code: "CANONICAL_INGREDIENT_VALIDATION_FAILURE", message: "輸入資料無效。" } })
    });
  }, { times: 1 });
  await fillRename(page, { name: "invalid", actor: "owner", occurredAt: "2026-08-11T14:30", reason: "驗證" });
  await page.locator("#rename-submit").click();
  await expect(page.locator("#notice")).toHaveText("輸入資料無效。");

  let versionConflictPosts = 0;
  await page.route(`**/api/admin/canonical-ingredients/${ingredient.ingredientId}/rename`, async (route) => {
    versionConflictPosts += 1;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: { code: "CANONICAL_INGREDIENT_VERSION_CONFLICT", message: "Version conflict." } })
    });
  }, { times: 1 });
  await page.locator("#rename-submit").click();
  await expect(page.locator("#notice")).toContainText("版本已變更");
  expect(versionConflictPosts).toBe(1);
  await expect(page.locator("#rename-name")).toHaveValue("invalid");

  for (const scenario of [
    {
      code: "CANONICAL_INGREDIENT_ALREADY_ARCHIVED",
      message: "此食材已封存，已重新載入唯讀資料。"
    },
    {
      code: "CANONICAL_INGREDIENT_ARCHIVED_RENAME_REJECTED",
      message: "已封存食材不能更名，已重新載入唯讀資料。"
    },
    {
      code: "INVALID_CANONICAL_INGREDIENT_TRANSITION",
      message: "目前狀態不允許更名，請重新檢視最新資料。"
    }
  ]) {
    await page.route(`**/api/admin/canonical-ingredients/${ingredient.ingredientId}/rename`, async (route) => {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: { code: scenario.code, message: "Server conflict." } })
      });
    }, { times: 1 });
    await page.locator("#rename-submit").click();
    await expect(page.locator("#notice")).toHaveText(scenario.message);
  }

  await page.route(`**/api/admin/canonical-ingredients/${ingredient.ingredientId}`, async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: { code: "CANONICAL_INGREDIENT_NOT_FOUND", message: "Not found." } })
    });
  }, { times: 1 });
  await page.getByRole("button", { name: new RegExp(name) }).first().click();
  await expect(page.locator("#notice")).toContainText("食材已不存在");
  await expect(page.locator("#detail-empty")).toBeVisible();
  await openIngredient(page, name);

  await page.route(`**/api/admin/canonical-ingredients/${ingredient.ingredientId}/rename`, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: { code: "CANONICAL_INGREDIENT_PERSISTENCE_FAILURE", message: "Safe persistence failure." } })
    });
  }, { times: 1 });
  await page.locator("#rename-submit").click();
  await expect(page.locator("#notice")).toHaveText("服務暫時無法完成操作，輸入內容已保留。");
  await expect(page.locator("#notice")).not.toContainText("Safe persistence failure");

  await page.route(`**/api/admin/canonical-ingredients/${ingredient.ingredientId}/rename`, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: { code: "internal_error", message: "Raw unexpected detail." } })
    });
  }, { times: 1 });
  await page.locator("#rename-submit").click();
  await expect(page.locator("#notice")).toHaveText("服務暫時無法完成操作，輸入內容已保留。");
  await expect(page.locator("#notice")).not.toContainText("Raw unexpected detail");

  await page.route(`**/api/admin/canonical-ingredients/${ingredient.ingredientId}/rename`, (route) => route.abort(), { times: 1 });
  await page.locator("#rename-submit").click();
  await expect(page.locator("#notice")).toContainText("無法連線");
  await expect(page.locator("#rename-name")).toHaveValue("invalid");
  await expect(page.locator("#rename-submit")).toBeEnabled();
});

test("Canonical Ingredient management UI presents an empty collection without inventing records", async ({ page }) => {
  await page.route("**/api/admin/canonical-ingredients?lifecycle=all", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data: [] })
  }));
  await page.goto("/admin/ingredients");
  await expect(page.locator("#ingredient-list")).toHaveText("目前篩選條件沒有食材。");
  await expect(page.locator("#detail-empty")).toBeVisible();
});

test("Canonical Ingredient management UI renders remote text without executable markup", async ({ page }) => {
  const maliciousName = '<img src=x onerror="window.__unsafe=true">';
  const ingredientId = "ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const record = {
    contractVersion: 1,
    ingredientId,
    name: maliciousName,
    categoryCode: "other",
    status: "Active",
    aggregateVersion: 0,
    createdAt: "2026-08-11T00:00:00.000Z",
    createdBy: "<script>unsafe</script>",
    renameHistory: []
  };
  await page.route("**/api/admin/canonical-ingredients?lifecycle=all", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data: [record] })
  }));
  await page.route(`**/api/admin/canonical-ingredients/${ingredientId}`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data: record })
  }));
  await page.goto("/admin/ingredients");
  await expect(page.locator("#ingredient-list")).toContainText(maliciousName);
  await openIngredient(page, maliciousName);
  await expect(page.locator("#detail-name")).toHaveText(maliciousName);
  await expect(page.locator("#detail img")).toHaveCount(0);
  await expect(page.locator("#detail script")).toHaveCount(0);
  expect(await page.evaluate(() => (window as typeof window & { __unsafe?: boolean }).__unsafe)).not.toBe(true);
});

test("Canonical Ingredient management UI remains operable on a representative mobile viewport", async ({ page }) => {
  const name = `UI mobile long ingredient name ${Date.now()} ${"測試".repeat(12)}`;
  const ingredient = await createIngredient(page.request, name);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/ingredients");
  await expect(page.getByRole("heading", { name: "食材主檔" })).toBeVisible();
  await expect(page.locator("#lifecycle-filter")).toBeVisible();
  expect(await page.locator(".office-nav").evaluate((node) => {
    const value = node as HTMLElement;
    return getComputedStyle(value).overflowX === "auto" && value.scrollWidth >= value.clientWidth;
  })).toBe(true);
  await openIngredient(page, name);
  await expect(page.locator("#rename-form")).toBeVisible();
  const collection = await page.locator(".layout > section").nth(0).boundingBox();
  const detail = await page.locator(".layout > section").nth(1).boundingBox();
  expect(collection).not.toBeNull();
  expect(detail).not.toBeNull();
  expect(detail!.y).toBeGreaterThan(collection!.y + collection!.height - 2);
  await fillRename(page, {
    name: `UI mobile renamed ${Date.now()}`,
    actor: "mobile-owner",
    occurredAt: "2026-08-11T16:30",
    reason: "行動裝置代表性操作"
  });
  await page.locator("#rename-submit").click();
  await expect(page.locator("#notice")).toHaveText("更名已完成。");

  const safeLongError = `欄位驗證失敗：${"請檢查輸入內容".repeat(12)}`;
  await page.route(`**/api/admin/canonical-ingredients/${ingredient.ingredientId}/rename`, (route) => route.fulfill({
    status: 422,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, error: { code: "CANONICAL_INGREDIENT_VALIDATION_FAILURE", message: safeLongError } })
  }), { times: 1 });
  await page.locator("#rename-submit").click();
  await expect(page.locator("#notice")).toHaveText(safeLongError);
  await expect(page.locator("#rename-submit")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
