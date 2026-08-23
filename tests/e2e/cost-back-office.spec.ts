import { expect, test } from "@playwright/test";

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

  await page.goto("/admin/cost");
  await expect(page.getByRole("heading", { name: "成本中心" })).toBeVisible();
  await page.locator("#ingredient-name").fill("豬五花");
  await page.locator("#ingredient-form button[type=submit]").click();
  await expect(page.locator("#ingredient-list")).toContainText("豬五花");

  await page.locator("#profile-ingredient").selectOption({ label: "豬五花" });
  await page.locator("#profile-form button[type=submit]").click();
  await expect(page.locator("#profile-list")).toContainText("mass → g");

  await page.locator("#recipe-name").fill("滷肉飯標準配方");
  await page.locator("#recipe-product").selectOption({ index: 1 });
  await page.locator("#recipe-ingredient").selectOption({ label: "豬五花" });
  await page.locator("#recipe-quantity").fill("100");
  await page.locator("#recipe-form button[type=submit]").click();
  await expect(page.locator("#recipe-list")).toContainText("滷肉飯標準配方");
  await expect(page.locator("#recipe-list")).toContainText("Published");

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

  await page.reload();
  await expect(page.locator("#ingredient-list")).toContainText("豬五花");
  await expect(page.locator("#recipe-list")).toContainText("滷肉飯標準配方");
});

test("Cost Back Office is responsive and exposes the exact-value policy", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/cost");
  await expect(page.locator(".exact-note")).toContainText("分子 / 分母");
  await expect(page.getByRole("button", { name: "建立正式食材" }))
    .toBeVisible();
  const cards = page.locator(".layout > .card");
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(second!.y).toBeGreaterThan(first!.y + first!.height - 2);
});

test("Cost Back Office keeps CanonicalIngredientCreation on its existing facade", async ({ page }) => {
  await page.goto("/admin/cost");
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
  await page.goto("/admin/cost");
  await page.locator("#ingredient-name").fill("003G facade ingredient");
  await page.locator("#ingredient-form button[type=submit]").click();
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
