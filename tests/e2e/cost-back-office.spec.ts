import { expect, test } from "@playwright/test";

test("Cost Back Office offers 酒類 as a governed formal Ingredient category", async ({ page }) => {
  await page.goto("/admin/ingredients/new");
  await expect(page.locator("#ingredient-category option[value=alcohol]")).toHaveText("酒類");
  await page.locator("#ingredient-name").fill("料理米酒");
  await page.locator("#ingredient-category").selectOption("alcohol");
  const created = page.waitForResponse((response) =>
    response.request().method() === "POST"
      && new URL(response.url()).pathname === "/api/admin/cost/ingredients"
  );
  await page.locator("#ingredient-form button[type=submit]").click();
  expect((await (await created).json()).data.categoryCode).toBe("alcohol");
});

test("Measurement settings explain their purpose and create an impact-confirmed correction version", async ({ page }) => {
  const instant = "2026-08-27T00:00:00.000Z";
  const ingredientName = `量測更正米酒-${Date.now()}`;
  const ingredient = await page.request.post("/api/admin/cost/ingredients", { data: { name: ingredientName, categoryCode: "alcohol", occurredAt: instant, actor: "owner" } });
  const ingredientId = (await ingredient.json()).data.ingredientId as string;
  const profile = await page.request.post("/api/admin/cost/profiles", { data: { ingredientId, dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g", "kg"], occurredAt: instant, actor: "owner" } });
  expect(profile.status()).toBe(201);
  await page.goto("/admin/cost/measurements");
  await expect(page.locator("#cost-measurement")).toContainText("請定義該食材在配方與採購中使用的單位");
  await page.locator("#profile-ingredient").selectOption({ label: ingredientName });
  await expect(page.locator("#profile-current")).toContainText("mass → g");
  await expect(page.locator("#profile-impact")).toContainText("目前沒有引用");
  await expect(page.locator("#profile-change-status")).toContainText("請先修改量綱、基準單位或允許單位");
  await expect(page.locator("#profile-submit")).toBeDisabled();
  await page.locator("#profile-reason").fill("只改更正原因不構成量測變更");
  await expect(page.locator("#profile-submit")).toBeDisabled();
  await page.locator("#profile-units").fill("kg, g");
  await expect(page.locator("#profile-submit")).toBeDisabled();
  await page.locator("#profile-units").fill("g, kg, g");
  await expect(page.locator("#profile-submit")).toBeDisabled();
  await page.locator("#profile-dimension").selectOption("volume");
  await page.locator("#profile-reason").fill("建檔時誤選重量，實際以量杯使用");
  await expect(page.locator("#profile-submit")).toBeEnabled();
  await expect(page.locator("#profile-change-status")).toContainText("量綱：重量 → 容量");
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("原設定：重量 / g");
    expect(dialog.message()).toContain("新設定：容量 / ml");
    expect(dialog.message()).toContain("實際變更項目");
    expect(dialog.message()).toContain("量綱：重量 → 容量");
    await dialog.accept();
  });
  const corrected = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/supersessions"));
  await page.locator("#profile-submit").click();
  const correctedResponse = await corrected;
  expect(correctedResponse.status(), JSON.stringify(await correctedResponse.json())).toBe(201);
  await expect(page.locator("#notice")).toContainText("舊版歷史已保留");
  await expect(page.locator("#profile-current")).toContainText("volume → ml");
  await expect(page.locator("#profile-impact")).toContainText("目前沒有引用");
  await expect(page.locator("#profile-list")).toContainText("volume → ml");
});

test("Recipe Owner workflow previews and atomically publishes a seven-ingredient batch", async ({ page }) => {
  const instant = "2026-08-28T00:00:00.000Z";
  const suffix = Date.now();
  const category = await page.request.post("/api/admin/categories", {
    data: { displayName: `Recipe workflow ${suffix}`, sortOrder: 2 }
  });
  const product = await page.request.post("/api/admin/products", {
    data: {
      internalName: `Owner batch ${suffix}`,
      categoryId: (await category.json()).data.categoryId,
      displayName: `一曲東坡肉 ${suffix}`,
      posName: `東坡肉 ${suffix}`,
      sellingPrice: 200,
      channels: ["pos"]
    }
  });
  const productId = (await product.json()).data.productId as string;
  expect((await page.request.post(`/api/admin/products/${productId}/publish`, { data: {} })).ok()).toBeTruthy();
  const ingredientNames = ["豬五花", "花雕酒", "醬油", "冰糖", "老薑", "青蔥", "八角", "未設定單位食材"].map(name => `${name}-${suffix}`);
  for (let index = 0; index < ingredientNames.length; index += 1) {
    const ingredient = await page.request.post("/api/admin/cost/ingredients", {
      data: { name: ingredientNames[index], categoryCode: index === 1 ? "alcohol" : "other", occurredAt: instant, actor: "owner" }
    });
    if (index < 7) {
      const ingredientId = (await ingredient.json()).data.ingredientId as string;
      const dimension = index === 2 ? "volume" : "mass";
      expect((await page.request.post("/api/admin/cost/profiles", {
        data: {
          ingredientId,
          dimension,
          canonicalUnitCode: dimension === "volume" ? "ml" : "g",
          allowedUnitCodes: dimension === "volume" ? ["ml", "l", "cc"] : ["g", "kg", "tw_catty"],
          occurredAt: instant,
          actor: "owner"
        }
      })).status()).toBe(201);
    }
  }

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/admin/cost/recipes");
  await expect(page.getByRole("heading", { name: "建立商品配方" })).toBeVisible();
  await expect(page.locator("#cost-recipes")).toContainText("一份代表實際販售給客人的一個商品單位");
  await page.locator("#recipe-name").fill(`一曲東坡肉標準配方-${suffix}`);
  await page.locator("#recipe-product").selectOption({ label: `一曲東坡肉 ${suffix} · v1` });
  await page.locator("#recipe-yield").fill("15");

  const firstIngredient = page.locator('[data-recipe-line="0"][data-recipe-field="ingredientId"]');
  await firstIngredient.selectOption({ label: ingredientNames[7] });
  await expect(page.locator(".recipe-line-note.error")).toContainText("此食材尚未設定配方使用單位");
  await expect(page.locator(".recipe-line-note.error a")).toHaveAttribute("href", /\/admin\/cost\/measurements\?ingredientId=/);
  await page.locator('[data-recipe-line="0"][data-recipe-field="quantity"]').fill("1");
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#notice")).toContainText("此食材尚未設定配方使用單位");
  await firstIngredient.selectOption({ label: ingredientNames[0] });

  for (let index = 1; index < 7; index += 1) await page.locator("#recipe-add-line").click();
  for (let index = 0; index < 7; index += 1) {
    await page.locator(`[data-recipe-line="${index}"][data-recipe-field="ingredientId"]`).selectOption({ label: ingredientNames[index] });
    await page.locator(`[data-recipe-line="${index}"][data-recipe-field="quantity"]`).fill(index === 0 ? "3000" : index === 1 ? "300" : "15");
  }
  await expect(page.locator('[data-recipe-line="1"][data-recipe-field="unitCode"] option')).toHaveText(["公克（g）", "公斤（kg）", "台斤"]);
  await expect(page.locator('[data-recipe-line="2"][data-recipe-field="unitCode"] option')).toContainText(["毫升（ml）", "公升（L）", "毫升（cc）"]);

  await page.locator("#recipe-yield").fill("0");
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#notice")).toContainText("必須是大於 0 的整數");
  await page.locator("#recipe-yield").fill("15");
  await page.locator('[data-recipe-line="0"][data-recipe-field="quantity"]').fill("-1");
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#notice")).toContainText("第 1 列使用量必須是大於 0 的數值");
  await page.locator('[data-recipe-line="0"][data-recipe-field="quantity"]').fill("3000");

  await page.locator('[data-recipe-line="6"][data-recipe-field="ingredientId"]').selectOption({ label: ingredientNames[0] });
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#notice")).toContainText("同一食材不得重複加入配方");
  await expect(page.locator("#recipe-form")).toBeVisible();
  await page.locator('[data-recipe-line="6"][data-recipe-field="ingredientId"]').selectOption({ label: ingredientNames[6] });
  await page.locator('[data-recipe-line="6"][data-recipe-field="quantity"]').fill("15");

  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#recipe-review")).toContainText("本批產量");
  await expect(page.locator("#recipe-review")).toContainText("15 份");
  await expect(page.locator("#recipe-review")).toContainText("7 項");
  await expect(page.locator("#recipe-review")).toContainText("3000 公克（g）");
  await expect(page.locator("#recipe-review")).toContainText("200 公克（g）");
  await page.locator("#recipe-review-back").click();
  await expect(page.locator("#recipe-form")).toBeVisible();
  await expect(page.locator("#recipe-name")).toHaveValue(`一曲東坡肉標準配方-${suffix}`);
  await page.locator("#recipe-form button[type=submit]").click();
  const publishedRecipe = page.waitForResponse(response =>
    response.request().method() === "POST" && new URL(response.url()).pathname === "/api/admin/cost/recipes"
  );
  await page.locator("#recipe-publish").click();
  expect((await publishedRecipe).status()).toBe(201);
  await expect(page.locator("#recipe-list")).toContainText(`一曲東坡肉標準配方-${suffix}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
});

test("Cost Back Office renders QuoteFallback in the guided exact-cost workflow", async ({ page }) => {
  const category = await page.request.post("/api/admin/categories", {
    data: { displayName: "Costed meals", sortOrder: 1 }
  });
  expect(category.ok()).toBeTruthy();
  const categoryId = (await category.json()).data.categoryId;
  const product = await page.request.post("/api/admin/products", {
    data: {
      internalName: "Braised pork rice",
      categoryId,
      displayName: "Braised pork rice",
      posName: "Pork rice",
      sellingPrice: 180,
      channels: ["pos"]
    }
  });
  expect(product.ok()).toBeTruthy();
  const productId = (await product.json()).data.productId;
  const published = await page.request.post(
    `/api/admin/products/${productId}/publish`,
    { data: {} }
  );
  expect(published.ok()).toBeTruthy();

  await page.goto("/admin/ingredients/new");
  await expect(page.getByRole("heading", { name: "正式食材建立" })).toBeVisible();
  await page.locator("#ingredient-name").fill("豬五花");
  await page.locator("#ingredient-form button[type=submit]").click();
  await expect(page.locator("#ingredient-list")).toContainText("豬五花");

  await page.goto("/admin/cost/measurements");
  await page.locator("#profile-ingredient").selectOption({ label: "豬五花" });
  await page.locator("#profile-form button[type=submit]").click();
  await expect(page.locator("#profile-list")).toContainText("mass → g");

  await page.goto("/admin/cost/recipes");
  await page.locator("#recipe-name").fill("滷肉飯標準配方");
  await page.locator("#recipe-product").selectOption({ index: 1 });
  await page.locator('[data-recipe-line="0"][data-recipe-field="ingredientId"]').selectOption({ label: "豬五花" });
  await page.locator('[data-recipe-line="0"][data-recipe-field="quantity"]').fill("100");
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#recipe-review")).toContainText("每份約用量");
  await page.locator("#recipe-publish").click();
  await expect(page.locator("#recipe-list")).toContainText("滷肉飯標準配方");
  await expect(page.locator("#recipe-list")).toContainText("Published");

  await page.goto("/admin/cost/valuation");
  const evaluationInstant = "2099-01-01T00:00:00.000Z";
  await page.locator("#quote-ingredient").selectOption({ label: "豬五花" });
  await page.locator("#quote-amount").fill("300");
  await page.locator("#quote-quantity").fill("1");
  await page.locator("#quote-unit").fill("kg");
  await page.locator("#quote-effective").fill(evaluationInstant);
  const initialQuoteResponse = page.waitForResponse((response) =>
    response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/admin/cost/quotes"
  );
  await page.locator("#quote-form button[type=submit]").click();
  const initialQuoteId = (await (await initialQuoteResponse).json())
    .data.quoteId as string;
  await expect(page.locator("#quote-list")).toContainText("300");
  await expect(page.locator("#quote-list")).toContainText("kg");

  await page.locator("#evaluation-recipe").selectOption({
    label: "滷肉飯標準配方 · v1"
  });
  await page.locator("#evaluation-time").fill(evaluationInstant);
  await page.locator("#evaluation-form button[type=submit]").click();
  await expect(page.locator("#evaluation-result")).toContainText("30 / 1");
  await expect(page.locator(".trace")).toContainText("豬五花");
  await expect(page.locator(".trace")).toContainText(initialQuoteId);
  await expect(page.locator(".trace")).toContainText("預期報價");

  const replacementInstant = "2099-01-02T00:00:00.000Z";
  await page.locator("#quote-replacement-old").selectOption(initialQuoteId);
  await page.locator("#quote-replacement-amount").fill("450");
  await page.locator("#quote-replacement-at").fill(replacementInstant);
  const replacementResponse = page.waitForResponse((response) =>
    response.request().method() === "POST"
    && new URL(response.url()).pathname.endsWith("/replacements")
  );
  await page.locator("#quote-replacement-form button[type=submit]").click();
  const replacementQuoteId = (await (await replacementResponse).json())
    .data.newQuoteId as string;

  await page.locator("#evaluation-time").fill(replacementInstant);
  await page.locator("#evaluation-form button[type=submit]").click();
  await expect(page.locator("#evaluation-result")).toContainText("45 / 1");
  await expect(page.locator(".trace")).toContainText(replacementQuoteId);
  await expect(page.locator(".trace")).not.toContainText(initialQuoteId);

  await page.goto("/admin/ingredients/new");
  await expect(page.locator("#ingredient-list")).toContainText("豬五花");
  await page.goto("/admin/cost/recipes");
  await expect(page.locator("#recipe-list")).toContainText("滷肉飯標準配方");
});

test("Cost Back Office is responsive and exposes the exact-value policy", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/cost/valuation");
  await expect(page.locator(".exact-note")).toContainText("分子 / 分母");
  await page.goto("/admin/ingredients/new");
  await expect(page.getByRole("button", { name: "建立正式食材" }))
    .toBeVisible();
  const cards = page.locator(".office-workspace-groups .office-workspace-group");
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(second!.y).toBeGreaterThan(first!.y + first!.height - 2);
});

test("Cost Evidence Read remains an API-only operational bridge without a new Cost UI", async ({ page }) => {
  const created = await page.request.post("/api/admin/cost/suppliers", {
    data: { displayName: "Read bridge supplier", occurredAt: "2026-08-24T00:00:00.000Z", actor: "owner" }
  });
  expect(created.status()).toBe(201);
  const supplierId = (await created.json()).data.supplierId as string;
  const read = await page.request.get(`/api/admin/cost/suppliers/${encodeURIComponent(supplierId)}`);
  expect(read.status()).toBe(200);
  expect((await read.json()).data.displayName).toBe("Read bridge supplier");
  await page.goto("/admin/cost");
  await expect(page.locator("h1")).toHaveText("成本總覽");
});

test("Recipe Cost History remains an API-only immutable Snapshot timeline", async ({ page }) => {
  const response = await page.request.get(
    "/api/admin/cost/recipes/recipe_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cost-history"
  );
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.data.contractName).toBe("RecipeCostHistory");
  expect(body.data.entries).toEqual([]);
  await page.goto("/admin/cost");
  await expect(page.locator("h1")).toHaveText("成本總覽");
});

test("Cost Analytics remains an API-only projection of immutable Recipe History", async ({ page }) => {
  const response = await page.request.get(
    "/api/admin/cost/recipes/recipe_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/analytics"
  );
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.data.contractName).toBe("RecipeCostAnalytics");
  expect(body.data.snapshots).toEqual([]);
  expect(body.data.latest).toBeNull();
  await page.goto("/admin/cost");
  await expect(page.locator("h1")).toHaveText("成本總覽");
});

test("CostEvidenceBackOfficeBridge lets an operator create accepted evidence and read immutable snapshot history", async ({ page }) => {
  const category = await page.request.post("/api/admin/categories", { data: { displayName: "Evidence bridge meals", sortOrder: 1 } });
  const categoryId = (await category.json()).data.categoryId as string;
  const product = await page.request.post("/api/admin/products", { data: { internalName: "Evidence bridge meal", categoryId, displayName: "Evidence bridge meal", posName: "Bridge meal", sellingPrice: 180, channels: ["pos"] } });
  const productId = (await product.json()).data.productId as string;
  await page.request.post(`/api/admin/products/${productId}/publish`, { data: {} });
  const instant = "2099-02-01T00:00:00.000Z";
  const ingredient = await page.request.post("/api/admin/cost/ingredients", { data: { name: "Bridge pork", categoryCode: "meat", occurredAt: instant, actor: "owner" } });
  const ingredientId = (await ingredient.json()).data.ingredientId as string;
  const profile = await page.request.post("/api/admin/cost/profiles", { data: { ingredientId, dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g", "kg"], occurredAt: instant, actor: "owner" } });
  expect(profile.status()).toBe(201);
  const recipe = await page.request.post("/api/admin/cost/recipes", { data: { name: "Evidence bridge recipe", productId, productVersionId: (await (await page.request.get(`/api/admin/products/${productId}`)).json()).data.versions[0].productVersionId, lines: [{ ingredientId, coefficient: "100", scale: 0, unitCode: "g", dimension: "mass" }], standardOutput: { coefficient: "1", scale: 0, unitCode: "each", dimension: "count" }, standardYield: { coefficient: "1", scale: 0, unitCode: "each", dimension: "count" }, occurredAt: instant, actor: "owner" } });
  expect(recipe.status()).toBe(201);

  await page.goto("/admin/cost/suppliers");
  await page.locator("#supplier-name").fill("Bridge supplier");
  await page.locator("#supplier-form button[type=submit]").click();
  await expect(page.locator("#supplier-list")).toContainText("Bridge supplier");
  await page.goto("/admin/cost/purchases");
  await page.locator("#purchase-supplier").selectOption({ label: "Bridge supplier" });
  await page.locator("#purchase-line-list select").selectOption({ label: "Bridge pork" });
  await page.locator("#purchase-line-list input[data-purchase-field=quantityCoefficient]").fill("1");
  await page.locator("#purchase-line-list input[data-purchase-field=unitCode]").fill("kg");
  await page.locator("#purchase-form button[type=submit]").click();
  await expect(page.locator("#purchase-current")).toContainText("Draft");
  await page.locator("#purchase-record").click();
  await expect(page.locator("#purchase-current")).toContainText("Recorded");
  await page.locator("#purchase-accept-lines input").fill("480");
  await page.locator("#purchase-accepted-at").fill(instant);
  await page.locator("#purchase-accept-form button[type=submit]").click();
  await expect(page.locator("#accepted-purchase-result")).toContainText("不可變實際採購證據");

  await page.goto("/admin/cost/snapshots");
  await page.locator("#cost-evidence-recipe").selectOption({ label: "Evidence bridge recipe · v1" });
  await page.locator("#snapshot-valued-at").fill(instant);
  await page.locator("#snapshot-captured-at").fill(instant);
  await page.locator("#cost-evidence-form button[type=submit]").click();
  await expect(page.locator("#cost-evidence-result")).toContainText("不可變成本快照");
  await expect(page.locator("#cost-evidence-result")).toContainText("實際採購明細：1");
  await expect(page.locator("#cost-evidence-result")).toContainText("預期報價 fallback：0");
});

test("Cost Back Office keeps CanonicalIngredientCreation on its existing facade", async ({ page }) => {
  await page.goto("/admin/ingredients/new");
  const creationResponse = page.waitForResponse((response) =>
    response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/admin/cost/ingredients"
  );
  await page.locator("#ingredient-name").fill("003F facade ingredient");
  await page.locator("#ingredient-form button[type=submit]").click();
  const response = await creationResponse;
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.data.ingredientId).toMatch(/^ing_[0-9a-f-]{36}$/);
  expect(body.data.status).toBe("Active");
  await expect(page.locator("#ingredient-list")).toContainText("003F facade ingredient");
});

test("Cost Back Office delegates Draft-first Profile re-establishment without UI expansion", async ({ page }) => {
  const ingredient = await page.request.post("/api/admin/cost/ingredients", { data: { name: "003J re-establishment", categoryCode: "sauce", occurredAt: "2026-08-01T00:00:00.000Z", actor: "owner" } });
  const ingredientId = (await ingredient.json()).data.ingredientId;
  const profile = await page.request.post("/api/admin/cost/profiles", { data: { ingredientId, dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g", "kg"], occurredAt: "2026-08-01T00:00:00.000Z", actor: "owner" } });
  const profileId = (await profile.json()).data.profileId;
  const deprecated = await page.request.post(`/api/admin/cost/profiles/${encodeURIComponent(profileId)}/deprecations`, { data: { expectedVersion: 0, occurredAt: "2026-08-02T00:00:00.000Z", actor: "owner" } });
  expect(deprecated.status()).toBe(200);
  const draft = await page.request.post(`/api/admin/cost/profiles/${encodeURIComponent(profileId)}/re-establishment-drafts`, { data: { expectedVersion: 1, dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g", "kg"], occurredAt: "2026-08-02T00:00:00.000Z", actor: "owner" } });
  expect(draft.status()).toBe(201);
  const draftBody = await draft.json();
  const draftVersionId = draftBody.data.versions.at(-1).identity.profileVersionId;
  const active = await page.request.post(`/api/admin/cost/profiles/${encodeURIComponent(profileId)}/drafts/${encodeURIComponent(draftVersionId)}/activations`, { data: { expectedVersion: 2, occurredAt: "2026-08-03T00:00:00.000Z", actor: "owner" } });
  expect(active.status()).toBe(200);
  expect((await active.json()).data.versions.at(-1).state).toBe("Active");
});

test("Cost Back Office keeps IngredientMeasurementProfileCreation on its existing facade", async ({ page }) => {
  await page.goto("/admin/ingredients/new");
  await page.locator("#ingredient-name").fill("003G facade ingredient");
  await page.locator("#ingredient-form button[type=submit]").click();
  await page.goto("/admin/cost/measurements");
  await page.locator("#profile-ingredient").selectOption({ label: "003G facade ingredient" });
  const creationResponse = page.waitForResponse((response) =>
    response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/admin/cost/profiles"
  );
  await page.locator("#profile-form button[type=submit]").click();
  const response = await creationResponse;
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.data.versions[0].state).toBe("Active");
  await expect(page.locator("#profile-list")).toContainText("mass → g");
});

test("Cost Back Office delegates Active Profile supersession without UI expansion", async ({ page }) => {
  const ingredient = await page.request.post("/api/admin/cost/ingredients", {
    data: { name: "003H facade ingredient", categoryCode: "sauce", occurredAt: "2026-08-17T01:00:00.000Z", actor: "owner" }
  });
  const ingredientId = (await ingredient.json()).data.ingredientId;
  const created = await page.request.post("/api/admin/cost/profiles", {
    data: { ingredientId, dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g", "kg"], occurredAt: "2026-08-17T01:00:00.000Z", actor: "owner" }
  });
  const profileId = (await created.json()).data.profileId as string;
  const response = await page.request.post(
    `/api/admin/cost/profiles/${encodeURIComponent(profileId)}/supersessions`,
    { data: { expectedVersion: 0, dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g"], occurredAt: "2026-08-18T01:00:00.000Z", actor: "owner" } }
  );
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.data.versions.find((version: { state: string }) => version.state === "Superseded").effectiveTo).toBe("2026-08-18T01:00:00.000Z");
  expect(body.data.versions.find((version: { state: string }) => version.state === "Active").effectiveFrom).toBe("2026-08-18T01:00:00.000Z");
});

test("Cost Back Office delegates Active Profile deprecation without UI expansion", async ({ page }) => {
  const ingredient = await page.request.post("/api/admin/cost/ingredients", {
    data: { name: "003I facade ingredient", categoryCode: "sauce", occurredAt: "2026-08-17T01:00:00.000Z", actor: "owner" }
  });
  const ingredientId = (await ingredient.json()).data.ingredientId;
  const created = await page.request.post("/api/admin/cost/profiles", {
    data: { ingredientId, dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g", "kg"], occurredAt: "2026-08-17T01:00:00.000Z", actor: "owner" }
  });
  const profileId = (await created.json()).data.profileId as string;
  const response = await page.request.post(
    `/api/admin/cost/profiles/${encodeURIComponent(profileId)}/deprecations`,
    { data: { expectedVersion: 0, occurredAt: "2026-08-18T01:00:00.000Z", actor: "owner" } }
  );
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.data.versions).toHaveLength(1);
  expect(body.data.versions[0].state).toBe("Deprecated");
  expect(body.data.versions[0].effectiveTo).toBe("2026-08-18T01:00:00.000Z");
});
