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

function managementRecord(
  ingredient: Ingredient,
  name: string = ingredient.name,
  status: "Active" | "Archived" = ingredient.status,
  aggregateVersion: number = ingredient.aggregateVersion
) {
  return {
    contractVersion: 1,
    ingredientId: ingredient.ingredientId,
    name,
    categoryCode: "other",
    status,
    aggregateVersion,
    createdAt: "2026-08-11T00:00:00.000Z",
    createdBy: "e2e-owner",
    renameHistory: [],
    ...(status === "Archived" ? {
      archiveFact: {
        archivedAt: "2026-08-11T03:00:00.000Z",
        archivedBy: "conflict-owner",
        reason: "Concurrent archive"
      }
    } : {})
  };
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

  await page.goto("/admin/catalog");
  await page.getByRole("link", { name: "食材主檔", exact: true }).click();
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
      body: JSON.stringify({
        ok: false,
        error: {
          code: "CANONICAL_INGREDIENT_VALIDATION_FAILURE",
          message: "輸入資料無效。",
          details: { newName: "名稱格式錯誤" }
        }
      })
    });
  }, { times: 1 });
  await fillRename(page, { name: "invalid", actor: "owner", occurredAt: "2026-08-11T14:30", reason: "驗證" });
  await page.locator("#rename-submit").click();
  await expect(page.locator("#notice")).toContainText("輸入資料無效。");
  await expect(page.locator("#notice .validation-details")).toContainText("newName: 名稱格式錯誤");

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
  await expect(page.locator("#detail-status")).toHaveText("使用中");
  await expect(page.locator("#active-actions")).toBeVisible();

  for (const scenario of [
    {
      code: "CANONICAL_INGREDIENT_ALREADY_ARCHIVED",
      message: "此食材已封存，已重新載入唯讀資料。",
      status: "Archived" as const
    },
    {
      code: "CANONICAL_INGREDIENT_ARCHIVED_RENAME_REJECTED",
      message: "已封存食材不能更名，已重新載入唯讀資料。",
      status: "Archived" as const
    },
    {
      code: "INVALID_CANONICAL_INGREDIENT_TRANSITION",
      message: "目前狀態不允許更名，請重新檢視最新資料。",
      status: "Active" as const
    }
  ]) {
    await page.reload();
    await openIngredient(page, name);
    await fillRename(page, { name: "invalid", actor: "owner", occurredAt: "2026-08-11T14:30", reason: "驗證" });
    await page.route(`**/api/admin/canonical-ingredients/${ingredient.ingredientId}/rename`, async (route) => {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: { code: scenario.code, message: "Server conflict." } })
      });
    }, { times: 1 });
    await page.route(`**/api/admin/canonical-ingredients/${ingredient.ingredientId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: managementRecord(ingredient, name, scenario.status, 1) })
      });
    }, { times: 1 });
    await page.locator("#rename-submit").click();
    await expect(page.locator("#notice")).toHaveText(scenario.message);
    await expect(page.locator("#detail-status")).toHaveText(scenario.status === "Archived" ? "已封存" : "使用中");
    if (scenario.status === "Archived") {
      await expect(page.locator("#active-actions")).toBeHidden();
      await expect(page.locator("#archived-readonly")).toBeVisible();
    } else {
      await expect(page.locator("#active-actions")).toBeVisible();
    }
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
  await fillRename(page, { name: "invalid", actor: "owner", occurredAt: "2026-08-11T14:30", reason: "驗證" });

  await page.route(`**/api/admin/canonical-ingredients/${ingredient.ingredientId}/rename`, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: { code: "CANONICAL_INGREDIENT_PERSISTENCE_FAILURE", message: "Safe persistence failure." } })
    });
  }, { times: 1 });
  await page.locator("#rename-submit").click();
  await expect(page.locator("#notice")).toHaveText("資料暫時無法儲存，輸入內容已保留，請稍後明確重試。");
  await expect(page.locator("#notice")).not.toContainText("Safe persistence failure");

  await page.route(`**/api/admin/canonical-ingredients/${ingredient.ingredientId}/rename`, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: { code: "internal_error", message: "Raw unexpected detail." } })
    });
  }, { times: 1 });
  await page.locator("#rename-submit").click();
  await expect(page.locator("#notice")).toHaveText("服務發生未預期錯誤，輸入內容已保留，請明確重試。");
  await expect(page.locator("#notice")).not.toContainText("Raw unexpected detail");

  await page.route(`**/api/admin/canonical-ingredients/${ingredient.ingredientId}/rename`, (route) => route.abort(), { times: 1 });
  await page.locator("#rename-submit").click();
  await expect(page.locator("#notice")).toContainText("無法連線");
  await expect(page.locator("#rename-name")).toHaveValue("invalid");
  await expect(page.locator("#rename-submit")).toBeEnabled();
});

test("Canonical Ingredient management UI reconciles filtered selection and lifecycle empty states", async ({ page }) => {
  const ingredient: Ingredient = {
    ingredientId: "ing_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Filter selection",
    status: "Active",
    aggregateVersion: 4
  };
  const record = managementRecord(ingredient);
  await page.route("**/api/admin/canonical-ingredients?lifecycle=all", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data: [record] })
  }));
  await page.route("**/api/admin/canonical-ingredients?lifecycle=active", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data: [] })
  }));
  await page.route("**/api/admin/canonical-ingredients?lifecycle=archived", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data: [] })
  }));
  await page.route(`**/api/admin/canonical-ingredients/${ingredient.ingredientId}`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data: record })
  }));

  await page.goto("/admin/ingredients");
  await openIngredient(page, ingredient.name);
  await page.locator("#rename-name").fill("unsent filter input");
  await page.locator("#lifecycle-filter").selectOption("active");
  await expect(page.locator("#ingredient-list")).toHaveText("目前沒有使用中的食材。");
  await expect(page.locator("#detail-empty")).toBeVisible();
  await expect(page.locator("#detail")).toBeHidden();
  await expect(page.locator("#rename-name")).toHaveValue("");
  await expect(page.locator('.ingredient-row[aria-current="true"]')).toHaveCount(0);

  await page.locator("#lifecycle-filter").selectOption("archived");
  await expect(page.locator("#ingredient-list")).toHaveText("目前沒有已封存的食材。");

  await page.unroute("**/api/admin/canonical-ingredients?lifecycle=all");
  await page.route("**/api/admin/canonical-ingredients?lifecycle=all", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data: [] })
  }));
  await page.locator("#lifecycle-filter").selectOption("all");
  await expect(page.locator("#ingredient-list")).toHaveText("目前沒有任何食材。");
});

test("Canonical Ingredient management UI keeps command responses bound to their immutable identity", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const ingredientA = await createIngredient(page.request, `Race A ${suffix}`);
  const ingredientB = await createIngredient(page.request, `Race B ${suffix}`);
  await page.goto("/admin/ingredients");
  await openIngredient(page, ingredientA.name);
  await fillRename(page, {
    name: `Race A renamed ${suffix}`,
    actor: "race-owner",
    occurredAt: "2026-08-11T17:00",
    reason: "deferred response"
  });

  let releaseA!: () => void;
  const aGate = new Promise<void>((resolve) => { releaseA = resolve; });
  let aPosts = 0;
  let aPayload: unknown;
  let aMethod = "";
  let aPath = "";
  await page.route(`**/api/admin/canonical-ingredients/${ingredientA.ingredientId}/rename`, async (route) => {
    aPosts += 1;
    aMethod = route.request().method();
    aPath = new URL(route.request().url()).pathname;
    aPayload = route.request().postDataJSON();
    await aGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          ingredient: managementRecord(ingredientA, `Race A renamed ${suffix}`, "Active", 1),
          warnings: []
        }
      })
    });
  }, { times: 1 });

  await page.locator("#rename-submit").click();
  await expect.poll(() => aPosts).toBe(1);
  await expect(page.locator("#rename-submit")).toBeDisabled();
  await openIngredient(page, ingredientB.name);
  releaseA();
  await expect(page.locator("#notice")).toHaveText("更名已完成。");
  await expect(page.locator("#detail-id")).toHaveText(ingredientB.ingredientId);
  await expect(page.locator("#detail-name")).toHaveText(ingredientB.name);
  await expect(page.getByRole("button", { name: new RegExp(ingredientB.name) })).toHaveAttribute("aria-current", "true");
  expect(aPosts).toBe(1);
  expect(aMethod).toBe("POST");
  expect(aPath).toBe(`/api/admin/canonical-ingredients/${encodeURIComponent(ingredientA.ingredientId)}/rename`);
  expect(aPayload).toEqual({
    newName: `Race A renamed ${suffix}`,
    expectedVersion: ingredientA.aggregateVersion,
    actor: "race-owner",
    occurredAt: new Date("2026-08-11T17:00").toISOString(),
    reason: "deferred response"
  });
  expect(aPayload).not.toHaveProperty("ingredientId");
  await expect(page.locator("#rename-submit")).toBeEnabled();

  const backgroundConflictScenarios = [
    { code: "CANONICAL_INGREDIENT_VERSION_CONFLICT", operation: "rename", failure: "offline" },
    { code: "CANONICAL_INGREDIENT_ALREADY_ARCHIVED", operation: "archive", failure: "http" },
    { code: "CANONICAL_INGREDIENT_ARCHIVED_RENAME_REJECTED", operation: "rename", failure: "json" },
    { code: "INVALID_CANONICAL_INGREDIENT_TRANSITION", operation: "rename", failure: "unusable" }
  ] as const;

  for (const scenario of backgroundConflictScenarios) {
    await openIngredient(page, ingredientA.name);
    if (scenario.operation === "rename") {
      await fillRename(page, {
        name: `Race A conflict ${scenario.code} ${suffix}`,
        actor: "race-owner",
        occurredAt: "2026-08-11T17:05",
        reason: "deferred conflict"
      });
    } else {
      await page.locator("#archive-actor").fill("race-owner");
      await page.locator("#archive-occurred-at").fill("2026-08-11T17:05");
      await page.locator("#archive-reason").fill("deferred conflict");
    }

    let releaseConflict!: () => void;
    const conflictGate = new Promise<void>((resolve) => { releaseConflict = resolve; });
    let conflictPosts = 0;
    let conflictMethod = "";
    let conflictPath = "";
    let originalIdentityRefreshes = 0;
    let refreshMethod = "";
    let refreshPath = "";
    const operationPath = `/api/admin/canonical-ingredients/${ingredientA.ingredientId}/${scenario.operation}`;
    await page.route(`**${operationPath}`, async (route) => {
      conflictPosts += 1;
      conflictMethod = route.request().method();
      conflictPath = new URL(route.request().url()).pathname;
      await conflictGate;
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: { code: scenario.code, message: "Conflict." } })
      });
    }, { times: 1 });
    await page.route(`**/api/admin/canonical-ingredients/${ingredientA.ingredientId}`, async (route) => {
      originalIdentityRefreshes += 1;
      refreshMethod = route.request().method();
      refreshPath = new URL(route.request().url()).pathname;
      if (scenario.failure === "offline") {
        await route.abort("failed");
      } else if (scenario.failure === "http") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: { code: "CANONICAL_INGREDIENT_PERSISTENCE_FAILURE", message: "Unavailable." } })
        });
      } else if (scenario.failure === "json") {
        await route.fulfill({ status: 200, contentType: "application/json", body: "{" });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: {} }) });
      }
    }, { times: 1 });

    if (scenario.operation === "rename") {
      await page.locator("#rename-submit").click();
    } else {
      page.once("dialog", (dialog) => dialog.accept());
      await page.locator("#archive-submit").click();
    }
    await expect.poll(() => conflictPosts).toBe(1);
    await openIngredient(page, ingredientB.name);
    releaseConflict();

    await expect(page.locator("#notice")).toContainText("原操作發生衝突");
    await expect(page.locator("#notice")).toContainText("目前檢視未受影響");
    await expect(page.locator("#notice")).not.toContainText("最新資料載入失敗");
    await expect.poll(() => originalIdentityRefreshes).toBe(1);
    expect(conflictPosts).toBe(1);
    expect(conflictMethod).toBe("POST");
    expect(conflictPath).toBe(operationPath);
    expect(refreshMethod).toBe("GET");
    expect(refreshPath).toBe(`/api/admin/canonical-ingredients/${encodeURIComponent(ingredientA.ingredientId)}`);
    await expect(page.getByRole("button", { name: new RegExp(ingredientB.name) }).first()).toHaveAttribute("aria-current", "true");
    await expect(page.locator("#detail-id")).toHaveText(ingredientB.ingredientId);
    await expect(page.locator("#detail-name")).toHaveText(ingredientB.name);
    await expect(page.locator("#detail-version")).toHaveText(String(ingredientB.aggregateVersion));
    await expect(page.locator("#detail-status")).toHaveText("使用中");
    await expect(page.locator("#active-actions")).toBeVisible();
    await expect(page.locator("#rename-submit")).toBeVisible();
    await expect(page.locator("#rename-submit")).toBeEnabled();
    await expect(page.locator("#archive-submit")).toBeVisible();
    await expect(page.locator("#archive-submit")).toBeEnabled();

    let bValidationPosts = 0;
    let bValidationPayload: unknown;
    await page.route(`**/api/admin/canonical-ingredients/${ingredientB.ingredientId}/rename`, async (route) => {
      bValidationPosts += 1;
      bValidationPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: { code: "CANONICAL_INGREDIENT_VALIDATION_FAILURE", message: "Evidence only." } })
      });
    }, { times: 1 });
    await fillRename(page, {
      name: `B evidence ${scenario.code}`,
      actor: "race-owner",
      occurredAt: "2026-08-11T17:06",
      reason: "version evidence"
    });
    await page.locator("#rename-submit").click();
    await expect.poll(() => bValidationPosts).toBe(1);
    expect(bValidationPayload).toMatchObject({ expectedVersion: ingredientB.aggregateVersion });
    expect(conflictPosts).toBe(1);
  }

  await fillRename(page, {
    name: `Race B renamed ${suffix}`,
    actor: "race-owner",
    occurredAt: "2026-08-11T17:10",
    reason: "single rename post"
  });
  let releaseB!: () => void;
  const bGate = new Promise<void>((resolve) => { releaseB = resolve; });
  let bRenamePosts = 0;
  await page.route(`**/api/admin/canonical-ingredients/${ingredientB.ingredientId}/rename`, async (route) => {
    bRenamePosts += 1;
    await bGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          ingredient: managementRecord(ingredientB, `Race B renamed ${suffix}`, "Active", 1),
          warnings: []
        }
      })
    });
  }, { times: 1 });
  await page.locator("#rename-form").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect.poll(() => bRenamePosts).toBe(1);
  releaseB();
  await expect(page.locator("#notice")).toHaveText("更名已完成。");
  expect(bRenamePosts).toBe(1);

  await page.locator("#archive-actor").fill("race-owner");
  await page.locator("#archive-occurred-at").fill("2026-08-11T17:20");
  await page.locator("#archive-reason").fill("single archive post");
  let releaseArchive!: () => void;
  const archiveGate = new Promise<void>((resolve) => { releaseArchive = resolve; });
  let archivePosts = 0;
  let archivePayload: unknown;
  let archiveMethod = "";
  let archivePath = "";
  await page.route(`**/api/admin/canonical-ingredients/${ingredientB.ingredientId}/archive`, async (route) => {
    archivePosts += 1;
    archiveMethod = route.request().method();
    archivePath = new URL(route.request().url()).pathname;
    archivePayload = route.request().postDataJSON();
    await archiveGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { ingredient: managementRecord(ingredientB, `Race B renamed ${suffix}`, "Archived", 2) } })
    });
  }, { times: 1 });
  page.on("dialog", (dialog) => dialog.accept());
  await page.locator("#archive-form").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect.poll(() => archivePosts).toBe(1);
  releaseArchive();
  await expect(page.locator("#notice")).toHaveText("食材已封存。");
  expect(archivePosts).toBe(1);
  expect(archiveMethod).toBe("POST");
  expect(archivePath).toBe(`/api/admin/canonical-ingredients/${encodeURIComponent(ingredientB.ingredientId)}/archive`);
  expect(archivePayload).toEqual({
    expectedVersion: 1,
    actor: "race-owner",
    occurredAt: new Date("2026-08-11T17:20").toISOString(),
    reason: "single archive post"
  });
  expect(archivePayload).not.toHaveProperty("ingredientId");
});

test("Canonical Ingredient conflict refresh failures fail closed without retrying mutations", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const ingredient = await createIngredient(page.request, `Refresh failure ${suffix}`);
  const scenarios = [
    { code: "CANONICAL_INGREDIENT_VERSION_CONFLICT", operation: "rename", failure: "offline" },
    { code: "CANONICAL_INGREDIENT_ALREADY_ARCHIVED", operation: "archive", failure: "http" },
    { code: "CANONICAL_INGREDIENT_ARCHIVED_RENAME_REJECTED", operation: "rename", failure: "json" },
    { code: "INVALID_CANONICAL_INGREDIENT_TRANSITION", operation: "rename", failure: "unusable" }
  ] as const;

  for (const scenario of scenarios) {
    await page.goto("/admin/ingredients");
    await openIngredient(page, ingredient.name);
    let mutationPosts = 0;
    let originalIdentityRefreshes = 0;
    const operationPath = `/api/admin/canonical-ingredients/${ingredient.ingredientId}/${scenario.operation}`;
    await page.route(`**${operationPath}`, async (route) => {
      mutationPosts += 1;
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: { code: scenario.code, message: "Conflict." } })
      });
    }, { times: 1 });
    await page.route(`**/api/admin/canonical-ingredients/${ingredient.ingredientId}`, async (route) => {
      originalIdentityRefreshes += 1;
      if (scenario.failure === "offline") {
        await route.abort("failed");
      } else if (scenario.failure === "http") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: { code: "CANONICAL_INGREDIENT_PERSISTENCE_FAILURE", message: "Unavailable." } })
        });
      } else if (scenario.failure === "json") {
        await route.fulfill({ status: 200, contentType: "application/json", body: "{" });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: {} }) });
      }
    }, { times: 1 });

    if (scenario.operation === "rename") {
      await fillRename(page, {
        name: `Rejected ${scenario.code}`,
        actor: "refresh-owner",
        occurredAt: "2026-08-11T18:00",
        reason: "refresh failure"
      });
      await page.locator("#rename-submit").click();
    } else {
      await page.locator("#archive-actor").fill("refresh-owner");
      await page.locator("#archive-occurred-at").fill("2026-08-11T18:05");
      await page.locator("#archive-reason").fill("refresh failure");
      page.once("dialog", (dialog) => dialog.accept());
      await page.locator("#archive-submit").click();
    }

    await expect(page.locator("#notice")).toContainText("最新資料載入失敗");
    await expect(page.locator("#notice")).not.toContainText("已重新載入");
    await expect.poll(() => originalIdentityRefreshes).toBe(1);
    expect(mutationPosts).toBe(1);
    await expect(page.locator("#detail")).toBeHidden();
    await expect(page.locator("#active-actions")).toBeHidden();
    const selectedRow = page.getByRole("button", { name: new RegExp(ingredient.name) }).first();
    await expect(selectedRow).toHaveAttribute("aria-current", "true");

    await selectedRow.click();
    await expect(page.locator("#detail-id")).toHaveText(ingredient.ingredientId);
    await expect(page.locator("#detail-version")).toHaveText(String(ingredient.aggregateVersion));
    await expect(page.locator("#active-actions")).toBeVisible();
    expect(mutationPosts).toBe(1);
  }
});

test("Canonical Ingredient management UI treats initial offline and unusable responses as retryable failures", async ({ page }) => {
  const collectionUrl = "**/api/admin/canonical-ingredients?lifecycle=all";
  let offlineRequests = 0;
  await page.route(collectionUrl, async (route) => {
    offlineRequests += 1;
    if (offlineRequests === 1) await route.abort();
    else await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) });
  });
  await page.goto("/admin/ingredients");
  await expect(page.locator("#notice")).toContainText("無法連線");
  await expect(page.locator("#notice")).not.toContainText("已載入");
  await page.locator("#refresh-list").click();
  await expect(page.locator("#notice")).toHaveText("食材主檔已重新整理。");
  await expect(page.locator("#ingredient-list")).toHaveText("目前沒有任何食材。");

  await page.unroute(collectionUrl);
  let unusableRequests = 0;
  await page.route(collectionUrl, async (route) => {
    unusableRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: unusableRequests === 1 ? { malformed: true } : [] })
    });
  });
  await page.reload();
  await expect(page.locator("#notice")).toContainText("回應格式無法使用");
  await expect(page.locator("#notice")).not.toContainText("已載入");
  await page.locator("#refresh-list").click();
  await expect(page.locator("#notice")).toHaveText("食材主檔已重新整理。");
  await expect(page.locator("#ingredient-list")).toHaveText("目前沒有任何食材。");

  const detailIngredient: Ingredient = {
    ingredientId: "ing_cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    name: "Unusable detail",
    status: "Active",
    aggregateVersion: 0
  };
  await page.unroute(collectionUrl);
  await page.route(collectionUrl, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data: [managementRecord(detailIngredient)] })
  }));
  await page.route(`**/api/admin/canonical-ingredients/${detailIngredient.ingredientId}`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data: { malformed: true } })
  }));
  await page.reload();
  await page.getByRole("button", { name: new RegExp(detailIngredient.name) }).click();
  await expect(page.locator("#notice")).toContainText("回應格式無法使用");
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
