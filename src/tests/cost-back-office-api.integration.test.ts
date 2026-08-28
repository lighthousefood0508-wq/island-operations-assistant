import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  IngredientMeasurementProfileDeprecationPersistenceFailure,
  IngredientMeasurementProfileDeprecationService
} from "../domains/recipe/index.js";
import { createRosServer } from "../server/index.js";

const AT = "2026-07-31T01:00:00.000Z";
const REPLACEMENT_AT = "2026-08-01T01:00:00.000Z";

async function request(
  baseUrl: string,
  pathname: string,
  method = "GET",
  body?: unknown
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: body === undefined
      ? undefined
      : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

async function start(databasePath: string) {
  const server = createRosServer({
    host: "127.0.0.1",
    port: 0,
    databasePath
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function stop(server: ReturnType<typeof createRosServer>) {
  server.close();
  await once(server, "close");
}

test("Cost Supplier API creates formal Supplier identities and lists them deterministically without Purchase authority", async () => {
  const databasePath = path.resolve("data", `cost-supplier-api-${randomUUID()}.sqlite`);
  const running = await start(databasePath);
  try {
    const invalid = await request(running.baseUrl, "/api/admin/cost/suppliers", "POST", {
      displayName: " ", occurredAt: AT, actor: "owner"
    });
    assert.equal(invalid.status, 422);
    assert.equal(invalid.body.error.code, "COST_SUPPLIER_VALIDATION_FAILURE");
    assert.doesNotMatch(JSON.stringify(invalid.body), /sqlite|stack|cause|table/i);

    const first = await request(running.baseUrl, "/api/admin/cost/suppliers", "POST", {
      displayName: "Northern Ingredients", occurredAt: AT, actor: "owner"
    });
    const second = await request(running.baseUrl, "/api/admin/cost/suppliers", "POST", {
      displayName: "Northern Ingredients", occurredAt: AT, actor: "owner"
    });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.match(first.body.data.supplierId, /^sup_[0-9a-f-]{36}$/);
    assert.notEqual(first.body.data.supplierId, second.body.data.supplierId);
    assert.equal("status" in first.body.data, false);

    const listed = await request(running.baseUrl, "/api/admin/cost/suppliers");
    assert.equal(listed.status, 200);
    assert.deepEqual(
      listed.body.data.map((supplier: { supplierId: string }) => supplier.supplierId),
      [...listed.body.data.map((supplier: { supplierId: string }) => supplier.supplierId)].sort()
    );
  } finally {
    await stop(running.server);
    cleanup(databasePath);
  }
});

test("Cost Evidence Read exposes governed Supplier and Purchase contracts with safe failures", async () => {
  const databasePath = path.resolve("data", `cost-evidence-read-api-${randomUUID()}.sqlite`);
  const running = await start(databasePath);
  try {
    const supplier = await request(running.baseUrl, "/api/admin/cost/suppliers", "POST", {
      displayName: "Evidence supplier", occurredAt: AT, actor: "owner"
    });
    const supplierId = supplier.body.data.supplierId as string;
    const supplierRead = await request(running.baseUrl, `/api/admin/cost/suppliers/${encodeURIComponent(supplierId)}`);
    assert.equal(supplierRead.status, 200);
    assert.equal(supplierRead.body.data.supplierId, supplierId);
    const purchase = await request(running.baseUrl, "/api/admin/cost/purchases", "POST", {
      supplierId,
      lines: [{ ingredientId: "ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", quantityCoefficient: "1", quantityScale: 0, unitCode: "kg" }],
      occurredAt: AT,
      actor: "owner"
    });
    const purchaseRead = await request(running.baseUrl, `/api/admin/cost/purchases/${encodeURIComponent(purchase.body.data.purchaseId)}`);
    assert.equal(purchaseRead.status, 200);
    assert.equal(purchaseRead.body.data.state, "Draft");
    const emptyAccepted = await request(running.baseUrl, `/api/admin/cost/purchases/${encodeURIComponent(purchase.body.data.purchaseId)}/accepted-purchases`);
    assert.equal(emptyAccepted.status, 200);
    assert.deepEqual(emptyAccepted.body.data, []);
    const invalid = await request(running.baseUrl, "/api/admin/cost/suppliers/not-a-supplier");
    assert.equal(invalid.status, 422);
    assert.equal(invalid.body.error.code, "cost_evidence_read_invalid");
    const missing = await request(running.baseUrl, "/api/admin/cost/snapshots/cost_snapshot_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, "cost_evidence_not_found");
    assert.doesNotMatch(JSON.stringify({ invalid: invalid.body, missing: missing.body }), /sqlite|database|table|stack|cause/i);
  } finally {
    await stop(running.server);
    cleanup(databasePath);
  }
});

test("Cost Purchase API records an unaccepted Supplier-backed document without actual-price authority", async () => {
  const databasePath = path.resolve("data", `cost-purchase-api-${randomUUID()}.sqlite`);
  const running = await start(databasePath);
  try {
    const supplier = await request(running.baseUrl, "/api/admin/cost/suppliers", "POST", { displayName: "Supplier", occurredAt: AT, actor: "owner" });
    const body = { supplierId: supplier.body.data.supplierId, lines: [{ ingredientId: "ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", quantityCoefficient: "2", quantityScale: 0, unitCode: "kg" }], occurredAt: AT, actor: "owner" };
    const created = await request(running.baseUrl, "/api/admin/cost/purchases", "POST", body);
    assert.equal(created.status, 201); assert.equal(created.body.data.state, "Draft"); assert.equal("amount" in created.body.data, false);
    const recorded = await request(running.baseUrl, `/api/admin/cost/purchases/${created.body.data.purchaseId}/records`, "POST", { expectedVersion: 0, recordedAt: REPLACEMENT_AT, recordedBy: "owner" });
    assert.equal(recorded.status, 200); assert.equal(recorded.body.data.state, "Recorded");
  } finally { await stop(running.server); cleanup(databasePath); }
});

test("Cost Back Office accepts a Recorded Purchase as immutable actual-price evidence", async () => {
  const databasePath = path.resolve("data", `accepted-purchase-api-${randomUUID()}.sqlite`);
  const running = await start(databasePath);
  try {
    const ingredient = await request(running.baseUrl,"/api/admin/cost/ingredients","POST",{name:"Accepted salt",categoryCode:"other",occurredAt:AT,actor:"owner"});
    const profile = await request(running.baseUrl,"/api/admin/cost/profiles","POST",{ingredientId:ingredient.body.data.ingredientId,dimension:"mass",canonicalUnitCode:"g",allowedUnitCodes:["g","kg"],occurredAt:AT,actor:"owner"});
    assert.equal(profile.status,201);
    const supplier=await request(running.baseUrl,"/api/admin/cost/suppliers","POST",{displayName:"Accepted supplier",occurredAt:AT,actor:"owner"});
    const created=await request(running.baseUrl,"/api/admin/cost/purchases","POST",{supplierId:supplier.body.data.supplierId,lines:[{ingredientId:ingredient.body.data.ingredientId,quantityCoefficient:"2",quantityScale:0,unitCode:"kg"}],occurredAt:AT,actor:"owner"});
    const recorded=await request(running.baseUrl,`/api/admin/cost/purchases/${encodeURIComponent(created.body.data.purchaseId)}/records`,"POST",{expectedVersion:0,recordedAt:REPLACEMENT_AT,recordedBy:"owner"});
    assert.equal(recorded.status,200);
    const accepted=await request(running.baseUrl,`/api/admin/cost/purchases/${encodeURIComponent(created.body.data.purchaseId)}/acceptances`,"POST",{expectedVersion:1,currencyCode:"TWD",lines:[{sourcePurchaseLineId:created.body.data.lines[0].lineId,amountCoefficient:"80",amountScale:0}],acceptedAt:"2026-08-02T00:00:00.000Z",acceptedBy:"owner"});
    assert.equal(accepted.status,201);assert.match(accepted.body.data.acceptedPurchaseId,/^accepted_purchase_/);assert.equal(accepted.body.data.lines[0].normalizedQuantityCoefficient,"2000");assert.equal(accepted.body.data.lines[0].profileId,profile.body.data.profileId);
    const duplicate=await request(running.baseUrl,`/api/admin/cost/purchases/${encodeURIComponent(created.body.data.purchaseId)}/acceptances`,"POST",{expectedVersion:1,currencyCode:"TWD",lines:[{sourcePurchaseLineId:created.body.data.lines[0].lineId,amountCoefficient:"80",amountScale:0}],acceptedAt:"2026-08-02T00:00:00.000Z",acceptedBy:"owner"});
    assert.equal(duplicate.status,409);assert.equal(duplicate.body.error.code,"accepted_purchase_invalid_state");assert.doesNotMatch(JSON.stringify(duplicate.body),/sqlite|database|table|stack|cause/i);
  } finally { await stop(running.server);cleanup(databasePath); }
});

function cleanup(databasePath: string): void {
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }
}

test("fresh database completes Ingredient to exact Cost Evaluation and survives restart", async () => {
  const databasePath = path.resolve(
    "data",
    `cost-back-office-api-${randomUUID()}.sqlite`
  );
  let running = await start(databasePath);
  try {
    const category = await request(
      running.baseUrl,
      "/api/admin/categories",
      "POST",
      { displayName: "Costed meals", sortOrder: 1 }
    );
    assert.equal(category.status, 201);
    const product = await request(
      running.baseUrl,
      "/api/admin/products",
      "POST",
      {
        internalName: "Braised pork rice",
        categoryId: category.body.data.categoryId,
        displayName: "Braised pork rice",
        posName: "Pork rice",
        sellingPrice: 180,
        channels: ["pos"]
      }
    );
    assert.equal(product.status, 201);
    const publishedProduct = await request(
      running.baseUrl,
      `/api/admin/products/${product.body.data.productId}/publish`,
      "POST",
      {}
    );
    assert.equal(publishedProduct.status, 200);

    const ingredient = await request(
      running.baseUrl,
      "/api/admin/cost/ingredients",
      "POST",
      {
        name: "Pork belly",
        categoryCode: "meat",
        occurredAt: AT,
        actor: "owner"
      }
    );
    assert.equal(ingredient.status, 201);
    const ingredientId = ingredient.body.data.ingredientId as string;

    const profile = await request(
      running.baseUrl,
      "/api/admin/cost/profiles",
      "POST",
      {
        ingredientId,
        dimension: "mass",
        canonicalUnitCode: "g",
        allowedUnitCodes: ["g", "kg", "tw_catty"],
        occurredAt: AT,
        actor: "owner"
      }
    );
    assert.equal(profile.status, 201);
    assert.equal(profile.body.data.versions[0].state, "Active");

    const recipe = await request(
      running.baseUrl,
      "/api/admin/cost/recipes",
      "POST",
      {
        name: "Braised pork",
        productId: product.body.data.productId,
        productVersionId:
          publishedProduct.body.data.version.productVersionId,
        lines: [{
          ingredientId,
          coefficient: "100",
          scale: 0,
          unitCode: "g",
          dimension: "mass"
        }],
        standardOutput: {
          coefficient: "2",
          scale: 0,
          unitCode: "each",
          dimension: "count"
        },
        standardYield: {
          coefficient: "2",
          scale: 0,
          unitCode: "each",
          dimension: "count"
        },
        occurredAt: AT,
        actor: "owner"
      }
    );
    assert.equal(recipe.status, 201);
    assert.equal(recipe.body.data.state, "Published");

    const quote = await request(
      running.baseUrl,
      "/api/admin/cost/quotes",
      "POST",
      {
        ingredientId,
        amountCoefficient: "300",
        amountScale: 0,
        quantityCoefficient: "1",
        quantityScale: 0,
        unitCode: "kg",
        effectiveFrom: AT,
        recordedAt: AT,
        actor: "owner",
        sourceReferenceId: "manual-test"
      }
    );
    assert.equal(quote.status, 201);
    const initialQuoteId = quote.body.data.quoteId as string;
    const initialQuoteVersion = quote.body.data.aggregateVersion as number;

    const evaluated = await request(
      running.baseUrl,
      "/api/admin/cost/evaluations",
      "POST",
      { recipeId: recipe.body.data.recipeId, evaluatedAt: AT }
    );
    assert.equal(evaluated.status, 200);
    assert.equal(evaluated.body.data.status, "evaluated");
    assert.equal(
      evaluated.body.data.result.lines[0].selectedSource.sourceType,
      "QuoteFallback"
    );
    assert.deepEqual(
      evaluated.body.data.result.exactStandardBatchCost,
      { numerator: "30", denominator: "1" }
    );
    assert.deepEqual(
      evaluated.body.data.result.exactPerStandardYieldCost,
      { numerator: "15", denominator: "1" }
    );
    assert.equal(
      evaluated.body.data.result.lines[0].selectedSource
        .quoteNormalizationEvidence.quoteId,
      initialQuoteId
    );

    const staleReplacement = await request(
      running.baseUrl,
      `/api/admin/cost/quotes/${initialQuoteId}/replacements`,
      "POST",
      {
        ingredientId,
        expectedVersion: initialQuoteVersion + 1,
        amountCoefficient: "450",
        amountScale: 0,
        quantityCoefficient: "1",
        quantityScale: 0,
        unitCode: "kg",
        supersededAt: REPLACEMENT_AT,
        recordedAt: REPLACEMENT_AT,
        actor: "owner",
        sourceReferenceId: "manual-replacement"
      }
    );
    assert.equal(staleReplacement.status, 409);
    assert.equal(
      staleReplacement.body.error.code,
      "INGREDIENT_COST_QUOTE_VERSION_CONFLICT"
    );

    const replacement = await request(
      running.baseUrl,
      `/api/admin/cost/quotes/${initialQuoteId}/replacements`,
      "POST",
      {
        ingredientId,
        expectedVersion: initialQuoteVersion,
        amountCoefficient: "450",
        amountScale: 0,
        quantityCoefficient: "1",
        quantityScale: 0,
        unitCode: "kg",
        supersededAt: REPLACEMENT_AT,
        recordedAt: REPLACEMENT_AT,
        actor: "owner",
        sourceReferenceId: "manual-replacement"
      }
    );
    assert.equal(replacement.status, 201);
    assert.equal(replacement.body.data.oldQuoteId, initialQuoteId);
    const replacementQuoteId = replacement.body.data.newQuoteId as string;

    const quoteHistory = await request(
      running.baseUrl,
      `/api/admin/cost/quotes?ingredientId=${encodeURIComponent(ingredientId)}`
    );
    const oldQuote = quoteHistory.body.data.find(
      (candidate: any) => candidate.quoteId === initialQuoteId
    );
    const newQuote = quoteHistory.body.data.find(
      (candidate: any) => candidate.quoteId === replacementQuoteId
    );
    assert.equal(oldQuote.state, "Superseded");
    assert.equal(oldQuote.supersession.supersededByQuoteId, replacementQuoteId);
    assert.equal(newQuote.state, "Recorded");

    const replacementEvaluation = await request(
      running.baseUrl,
      "/api/admin/cost/evaluations",
      "POST",
      { recipeId: recipe.body.data.recipeId, evaluatedAt: REPLACEMENT_AT }
    );
    assert.equal(replacementEvaluation.body.data.status, "evaluated");
    assert.deepEqual(
      replacementEvaluation.body.data.result.exactStandardBatchCost,
      { numerator: "45", denominator: "1" }
    );
    assert.equal(
      replacementEvaluation.body.data.result.lines[0].selectedSource
        .quoteNormalizationEvidence.quoteId,
      replacementQuoteId
    );
    assert.notEqual(
      replacementEvaluation.body.data.result.lines[0].selectedSource
        .quoteNormalizationEvidence.quoteId,
      initialQuoteId
    );

    const historicalEvaluation = await request(
      running.baseUrl,
      "/api/admin/cost/evaluations",
      "POST",
      { recipeId: recipe.body.data.recipeId, evaluatedAt: AT }
    );
    assert.equal(
      historicalEvaluation.body.data.result.lines[0].selectedSource
        .quoteNormalizationEvidence.quoteId,
      initialQuoteId
    );

    await stop(running.server);
    running = await start(databasePath);
    const setup = await request(
      running.baseUrl,
      "/api/admin/cost/setup"
    );
    assert.equal(setup.body.data.ingredients.length, 1);
    assert.equal(setup.body.data.profiles.length, 1);
    assert.equal(setup.body.data.recipes.length, 1);
    const repeated = await request(
      running.baseUrl,
      "/api/admin/cost/evaluations",
      "POST",
      { recipeId: recipe.body.data.recipeId, evaluatedAt: REPLACEMENT_AT }
    );
    assert.deepEqual(
      repeated.body.data.result.exactPerStandardYieldCost,
      { numerator: "45", denominator: "2" }
    );
    assert.equal(
      repeated.body.data.result.lines[0].selectedSource
        .quoteNormalizationEvidence.quoteId,
      replacementQuoteId
    );

    const supplier = await request(
      running.baseUrl,
      "/api/admin/cost/suppliers",
      "POST",
      { displayName: "Actual-price supplier", occurredAt: "2026-09-01T00:00:00.000Z", actor: "owner" }
    );
    assert.equal(supplier.status, 201);
    const purchase = await request(
      running.baseUrl,
      "/api/admin/cost/purchases",
      "POST",
      {
        supplierId: supplier.body.data.supplierId,
        lines: [{ ingredientId, quantityCoefficient: "1", quantityScale: 0, unitCode: "kg" }],
        occurredAt: "2026-09-01T00:00:00.000Z",
        actor: "owner"
      }
    );
    assert.equal(purchase.status, 201);
    const recordedPurchase = await request(
      running.baseUrl,
      `/api/admin/cost/purchases/${encodeURIComponent(purchase.body.data.purchaseId)}/records`,
      "POST",
      { expectedVersion: 0, recordedAt: "2026-09-01T00:00:00.000Z", recordedBy: "owner" }
    );
    assert.equal(recordedPurchase.status, 200);
    const acceptedPurchase = await request(
      running.baseUrl,
      `/api/admin/cost/purchases/${encodeURIComponent(purchase.body.data.purchaseId)}/acceptances`,
      "POST",
      {
        expectedVersion: 1,
        currencyCode: "TWD",
        lines: [{ sourcePurchaseLineId: purchase.body.data.lines[0].lineId, amountCoefficient: "400", amountScale: 0 }],
        acceptedAt: "2026-09-01T00:00:00.000Z",
        acceptedBy: "owner"
      }
    );
    assert.equal(acceptedPurchase.status, 201);
    const actualEvaluation = await request(
      running.baseUrl,
      "/api/admin/cost/evaluations",
      "POST",
      { recipeId: recipe.body.data.recipeId, evaluatedAt: "2026-09-01T00:00:00.000Z" }
    );
    assert.equal(actualEvaluation.status, 200);
    assert.equal(
      actualEvaluation.body.data.result.lines[0].selectedSource.sourceType,
      "ActualPurchase"
    );
    assert.equal(
      actualEvaluation.body.data.result.lines[0].selectedSource.acceptedPurchaseId,
      acceptedPurchase.body.data.acceptedPurchaseId
    );
    assert.deepEqual(actualEvaluation.body.data.result.exactStandardBatchCost, {
      numerator: "40",
      denominator: "1"
    });
    const snapshot = await request(
      running.baseUrl,
      `/api/admin/cost/recipes/${encodeURIComponent(recipe.body.data.recipeId)}/snapshots`,
      "POST",
      { valuedAt: "2026-09-01T00:00:00.000Z", capturedAt: "2026-09-01T01:00:00.000Z", capturedBy: "owner" }
    );
    assert.equal(snapshot.status, 201);
    assert.match(snapshot.body.data.costSnapshotId, /^cost_snapshot_/);
    assert.equal(snapshot.body.data.result.lines[0].selectedSource.acceptedPurchaseId, acceptedPurchase.body.data.acceptedPurchaseId);
    const historyPath = `/api/admin/cost/recipes/${encodeURIComponent(recipe.body.data.recipeId)}/cost-history`;
    const history = await request(running.baseUrl, historyPath);
    assert.equal(history.status, 200);
    assert.equal(history.body.data.contractName, "RecipeCostHistory");
    assert.equal(history.body.data.entries.length, 1);
    assert.equal(history.body.data.entries[0].snapshot.costSnapshotId, snapshot.body.data.costSnapshotId);
    assert.equal(history.body.data.entries[0].snapshot.result.lines[0].selectedSource.acceptedPurchaseId, acceptedPurchase.body.data.acceptedPurchaseId);
    const latestHistory = await request(running.baseUrl, `${historyPath}/latest`);
    assert.equal(latestHistory.status, 200);
    assert.equal(latestHistory.body.data.snapshot.costSnapshotId, snapshot.body.data.costSnapshotId);
    const historyIdentity = await request(running.baseUrl, `${historyPath}/${encodeURIComponent(snapshot.body.data.costSnapshotId)}`);
    assert.equal(historyIdentity.status, 200);
    assert.equal(historyIdentity.body.data.snapshot.recipeVersionId, snapshot.body.data.recipeVersionId);
    const analytics = await request(running.baseUrl, `/api/admin/cost/recipes/${encodeURIComponent(recipe.body.data.recipeId)}/analytics`);
    assert.equal(analytics.status, 200);
    assert.equal(analytics.body.data.contractName, "RecipeCostAnalytics");
    assert.equal(analytics.body.data.latest.costSnapshotId, snapshot.body.data.costSnapshotId);
    assert.equal(analytics.body.data.previous, null);
    assert.equal(analytics.body.data.latestMinusPrevious, null);
    assert.equal(analytics.body.data.latest.actualPurchaseLineCount, 1);
    assert.equal(analytics.body.data.latest.quoteFallbackLineCount, 0);
    assert.equal(analytics.body.data.latest.actualPurchaseSuppliers[0].supplierId, supplier.body.data.supplierId);
    const foreignHistory = await request(running.baseUrl, `/api/admin/cost/recipes/recipe_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cost-history/${encodeURIComponent(snapshot.body.data.costSnapshotId)}`);
    assert.equal(foreignHistory.status, 404);
    assert.equal(foreignHistory.body.error.code, "recipe_cost_history_not_found");
    assert.doesNotMatch(JSON.stringify({ history: history.body, analytics: analytics.body, foreignHistory: foreignHistory.body }), /sqlite|database|table|stack|cause/i);
    const invalidSnapshot = await request(running.baseUrl, `/api/admin/cost/recipes/${encodeURIComponent(recipe.body.data.recipeId)}/snapshots`, "POST", { valuedAt: "invalid", capturedAt: "2026-09-01T01:00:00.000Z", capturedBy: "owner" });
    assert.equal(invalidSnapshot.status, 422);
    assert.equal(invalidSnapshot.body.error.code, "recipe_cost_snapshot_validation_failure");
    assert.doesNotMatch(JSON.stringify(invalidSnapshot.body), /sqlite|database|table|stack|cause/i);
  } finally {
    if (running.server.listening) await stop(running.server);
    cleanup(databasePath);
  }
});

test("Cost Back Office API keeps Profile creation on its existing facade and rejects invalid cross-dimension input", async () => {
  const databasePath = path.resolve(
    "data",
    `cost-back-office-invalid-${randomUUID()}.sqlite`
  );
  const running = await start(databasePath);
  try {
    const ingredient = await request(
      running.baseUrl,
      "/api/admin/cost/ingredients",
      "POST",
      {
        name: "Soy sauce",
        categoryCode: "sauce",
        occurredAt: AT,
        actor: "owner"
      }
    );
    const accepted = await request(
      running.baseUrl,
      "/api/admin/cost/profiles",
      "POST",
      {
        ingredientId: ingredient.body.data.ingredientId,
        dimension: "mass",
        canonicalUnitCode: "g",
        allowedUnitCodes: ["g", "kg"],
        occurredAt: AT,
        actor: "owner"
      }
    );
    assert.equal(accepted.status, 201);
    assert.equal(accepted.body.data.versions[0].state, "Active");
    const response = await request(
      running.baseUrl,
      "/api/admin/cost/profiles",
      "POST",
      {
        ingredientId: ingredient.body.data.ingredientId,
        dimension: "mass",
        canonicalUnitCode: "ml",
        allowedUnitCodes: ["ml"],
        occurredAt: AT,
        actor: "owner"
      }
    );
    assert.equal(response.status, 422);
    assert.equal(response.body.error.code, "measurement_profile_invalid");
  } finally {
    await stop(running.server);
    cleanup(databasePath);
  }
});

test("Cost Back Office supersedes an Active Profile through its delegated facade", async () => {
  const databasePath = path.resolve(
    "data",
    `cost-back-office-profile-supersession-${randomUUID()}.sqlite`
  );
  const running = await start(databasePath);
  try {
    const ingredient = await request(running.baseUrl, "/api/admin/cost/ingredients", "POST", {
      name: "Superseded sesame oil", categoryCode: "sauce", occurredAt: AT, actor: "owner"
    });
    const created = await request(running.baseUrl, "/api/admin/cost/profiles", "POST", {
      ingredientId: ingredient.body.data.ingredientId,
      dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g", "kg"], occurredAt: AT, actor: "owner"
    });
    assert.equal(created.status, 201);
    const profileId = created.body.data.profileId;
    const replacement = await request(
      running.baseUrl,
      `/api/admin/cost/profiles/${encodeURIComponent(profileId)}/supersessions`,
      "POST",
      {
        expectedVersion: 0, dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g"],
        occurredAt: REPLACEMENT_AT, actor: "owner", reason: "remove kilogram"
      }
    );
    assert.equal(replacement.status, 201);
    const oldVersion = replacement.body.data.versions.find((version: any) => version.state === "Superseded");
    const activeVersion = replacement.body.data.versions.find((version: any) => version.state === "Active");
    assert.equal(oldVersion.effectiveTo, REPLACEMENT_AT);
    assert.equal(activeVersion.effectiveFrom, REPLACEMENT_AT);

    const stale = await request(
      running.baseUrl,
      `/api/admin/cost/profiles/${encodeURIComponent(profileId)}/supersessions`,
      "POST",
      {
        expectedVersion: 0, dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g"],
        occurredAt: "2026-08-02T01:00:00.000Z", actor: "owner"
      }
    );
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.code, "measurement_profile_expected_version_conflict");

    const missing = await request(running.baseUrl, "/api/admin/cost/profiles/measurement_profile_123e4567-e89b-42d3-a456-426614174999/supersessions", "POST", {
      expectedVersion: 0, dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g"], occurredAt: REPLACEMENT_AT, actor: "owner"
    });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, "measurement_profile_not_found");

    const invalid = await request(
      running.baseUrl,
      `/api/admin/cost/profiles/${encodeURIComponent(profileId)}/supersessions`,
      "POST",
      { expectedVersion: "stale", dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g"], occurredAt: REPLACEMENT_AT, actor: "owner" }
    );
    assert.equal(invalid.status, 422);
    assert.equal(invalid.body.error.code, "measurement_profile_supersession_invalid");
  } finally {
    await stop(running.server);
    cleanup(databasePath);
  }
});

test("Cost Back Office exposes correction impact, permits unreferenced basis correction and blocks referenced correction", async () => {
  const databasePath = path.resolve("data", `cost-back-office-profile-correction-${randomUUID()}.sqlite`);
  const running = await start(databasePath);
  try {
    const ingredient = await request(running.baseUrl, "/api/admin/cost/ingredients", "POST", { name: "Correction rice wine", categoryCode: "alcohol", occurredAt: AT, actor: "owner" });
    const created = await request(running.baseUrl, "/api/admin/cost/profiles", "POST", { ingredientId: ingredient.body.data.ingredientId, dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g"], occurredAt: AT, actor: "owner" });
    const profileId = created.body.data.profileId;
    const impact = await request(running.baseUrl, `/api/admin/cost/profiles/${encodeURIComponent(profileId)}/correction-impact`);
    assert.equal(impact.status, 200);
    assert.equal(impact.body.data.expectedVersion, 0);
    assert.equal(impact.body.data.crossBasisCorrectionAllowed, true);
    assert.equal(impact.body.data.activeVersion.canonicalUnitCode, "g");
    const corrected = await request(running.baseUrl, `/api/admin/cost/profiles/${encodeURIComponent(profileId)}/supersessions`, "POST", { expectedVersion: 0, dimension: "volume", canonicalUnitCode: "ml", allowedUnitCodes: ["ml", "cc"], occurredAt: REPLACEMENT_AT, actor: "owner", reason: "Correct mistaken mass basis" });
    assert.equal(corrected.status, 201);
    assert.equal(corrected.body.data.versions.find((version: any) => version.state === "Active").canonicalUnitCode, "ml");

    const referencedIngredient = await request(running.baseUrl, "/api/admin/cost/ingredients", "POST", { name: "Referenced cooking wine", categoryCode: "alcohol", occurredAt: AT, actor: "owner" });
    const referencedProfile = await request(running.baseUrl, "/api/admin/cost/profiles", "POST", { ingredientId: referencedIngredient.body.data.ingredientId, dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g"], occurredAt: AT, actor: "owner" });
    const supplier = await request(running.baseUrl, "/api/admin/cost/suppliers", "POST", { displayName: "Correction supplier", occurredAt: AT, actor: "owner" });
    const purchase = await request(running.baseUrl, "/api/admin/cost/purchases", "POST", { supplierId: supplier.body.data.supplierId, lines: [{ ingredientId: referencedIngredient.body.data.ingredientId, quantityCoefficient: "1", quantityScale: 0, unitCode: "g" }], occurredAt: AT, actor: "owner" });
    assert.equal(purchase.status, 201);
    const blockedImpact = await request(running.baseUrl, `/api/admin/cost/profiles/${encodeURIComponent(referencedProfile.body.data.profileId)}/correction-impact`);
    assert.equal(blockedImpact.status, 200);
    assert.equal(blockedImpact.body.data.crossBasisCorrectionAllowed, false);
    assert.deepEqual(blockedImpact.body.data.references.purchases.purchaseIds, [purchase.body.data.purchaseId]);
    const blocked = await request(running.baseUrl, `/api/admin/cost/profiles/${encodeURIComponent(referencedProfile.body.data.profileId)}/supersessions`, "POST", { expectedVersion: 0, dimension: "volume", canonicalUnitCode: "ml", allowedUnitCodes: ["ml"], occurredAt: REPLACEMENT_AT, actor: "owner", reason: "Attempt referenced correction" });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.error.code, "measurement_profile_correction_referenced");
    assert.doesNotMatch(JSON.stringify(blocked.body), /sqlite|database|table|stack|cause/i);
    const setup = await request(running.baseUrl, "/api/admin/cost/setup");
    const unchanged = setup.body.data.profiles.find((profile: any) => profile.profileId === referencedProfile.body.data.profileId);
    assert.equal(unchanged.versions.length, 1);
    assert.equal(unchanged.versions[0].canonicalUnitCode, "g");
  } finally {
    await stop(running.server);
    cleanup(databasePath);
  }
});

test("Cost Back Office deprecates an Active Profile through its delegated facade", async () => {
  const databasePath = path.resolve(
    "data",
    `cost-back-office-profile-deprecation-${randomUUID()}.sqlite`
  );
  const running = await start(databasePath);
  try {
    const ingredient = await request(running.baseUrl, "/api/admin/cost/ingredients", "POST", {
      name: "Deprecated sesame oil", categoryCode: "sauce", occurredAt: AT, actor: "owner"
    });
    const created = await request(running.baseUrl, "/api/admin/cost/profiles", "POST", {
      ingredientId: ingredient.body.data.ingredientId,
      dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g", "kg"], occurredAt: AT, actor: "owner"
    });
    const profileId = created.body.data.profileId;
    const deprecated = await request(
      running.baseUrl,
      `/api/admin/cost/profiles/${encodeURIComponent(profileId)}/deprecations`,
      "POST",
      { expectedVersion: 0, occurredAt: REPLACEMENT_AT, actor: "owner", reason: "retired profile" }
    );
    assert.equal(deprecated.status, 200);
    assert.equal(deprecated.body.data.versions.length, 1);
    assert.equal(deprecated.body.data.versions[0].state, "Deprecated");
    assert.equal(deprecated.body.data.versions[0].effectiveTo, REPLACEMENT_AT);

    const stale = await request(
      running.baseUrl,
      `/api/admin/cost/profiles/${encodeURIComponent(profileId)}/deprecations`,
      "POST",
      { expectedVersion: 0, occurredAt: "2026-08-02T01:00:00.000Z", actor: "owner" }
    );
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.code, "measurement_profile_expected_version_conflict");

    const missing = await request(running.baseUrl, "/api/admin/cost/profiles/measurement_profile_123e4567-e89b-42d3-a456-426614174999/deprecations", "POST", {
      expectedVersion: 0, occurredAt: REPLACEMENT_AT, actor: "owner"
    });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, "measurement_profile_not_found");

    const invalid = await request(
      running.baseUrl,
      `/api/admin/cost/profiles/${encodeURIComponent(profileId)}/deprecations`,
      "POST",
      { expectedVersion: "stale", occurredAt: REPLACEMENT_AT, actor: "owner" }
    );
    assert.equal(invalid.status, 422);
    assert.equal(invalid.body.error.code, "measurement_profile_deprecation_invalid");
  } finally {
    await stop(running.server);
    cleanup(databasePath);
  }
});

test("Cost Back Office re-establishes a Deprecated Profile through Draft-first commands", async () => {
  const databasePath = path.resolve("data", `cost-back-office-profile-reestablishment-${randomUUID()}.sqlite`);
  const running = await start(databasePath);
  try {
    const ingredient = await request(running.baseUrl, "/api/admin/cost/ingredients", "POST", { name: "Re-established salt", categoryCode: "sauce", occurredAt: AT, actor: "owner" });
    const created = await request(running.baseUrl, "/api/admin/cost/profiles", "POST", { ingredientId: ingredient.body.data.ingredientId, dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g", "kg"], occurredAt: AT, actor: "owner" });
    const profileId = created.body.data.profileId;
    const deprecated = await request(running.baseUrl, `/api/admin/cost/profiles/${encodeURIComponent(profileId)}/deprecations`, "POST", { expectedVersion: 0, occurredAt: REPLACEMENT_AT, actor: "owner" });
    assert.equal(deprecated.status, 200);
    const draft = await request(running.baseUrl, `/api/admin/cost/profiles/${encodeURIComponent(profileId)}/re-establishment-drafts`, "POST", { expectedVersion: 1, dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g", "kg"], occurredAt: REPLACEMENT_AT, actor: "owner" });
    assert.equal(draft.status, 201);
    const draftVersionId = draft.body.data.versions.at(-1).identity.profileVersionId;
    const activated = await request(running.baseUrl, `/api/admin/cost/profiles/${encodeURIComponent(profileId)}/drafts/${encodeURIComponent(draftVersionId)}/activations`, "POST", { expectedVersion: 2, occurredAt: "2026-08-03T01:00:00.000Z", actor: "owner" });
    assert.equal(activated.status, 200);
    assert.equal(activated.body.data.versions.at(-1).state, "Active");
    const invalid = await request(running.baseUrl, `/api/admin/cost/profiles/${encodeURIComponent(profileId)}/re-establishment-drafts`, "POST", { expectedVersion: 3, dimension: "volume", canonicalUnitCode: "ml", allowedUnitCodes: ["ml"], occurredAt: "2026-08-03T01:00:00.000Z", actor: "owner" });
    assert.equal(invalid.status, 422);
    assert.equal(invalid.body.error.code, "measurement_profile_reestablishment_invalid");
  } finally { await stop(running.server); cleanup(databasePath); }
});

test("Cost Back Office maps Profile deprecation lookup failures to a safe persistence response", async () => {
  const databasePath = path.resolve(
    "data",
    `cost-back-office-profile-deprecation-failure-${randomUUID()}.sqlite`
  );
  const running = await start(databasePath);
  try {
    const ingredient = await request(running.baseUrl, "/api/admin/cost/ingredients", "POST", {
      name: "Deprecation failure probe", categoryCode: "sauce", occurredAt: AT, actor: "owner"
    });
    const created = await request(running.baseUrl, "/api/admin/cost/profiles", "POST", {
      ingredientId: ingredient.body.data.ingredientId,
      dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g", "kg"], occurredAt: AT, actor: "owner"
    });
    const originalDeprecate = IngredientMeasurementProfileDeprecationService.prototype.deprecate;
    let response: Awaited<ReturnType<typeof request>>;
    try {
      IngredientMeasurementProfileDeprecationService.prototype.deprecate = () => {
        throw new IngredientMeasurementProfileDeprecationPersistenceFailure();
      };
      response = await request(
        running.baseUrl,
        `/api/admin/cost/profiles/${encodeURIComponent(created.body.data.profileId)}/deprecations`,
        "POST",
        { expectedVersion: 0, occurredAt: REPLACEMENT_AT, actor: "owner" }
      );
    } finally {
      IngredientMeasurementProfileDeprecationService.prototype.deprecate = originalDeprecate;
    }
    assert.equal(response!.status, 500);
    assert.equal(response!.body.error.code, "measurement_profile_deprecation_persistence_failed");
    assert.doesNotMatch(
      JSON.stringify(response!.body),
      /sqlite|database|no such table|recipe_ingredient_measurement_profiles|stack|cause/i
    );
  } finally {
    await stop(running.server);
    cleanup(databasePath);
  }
});

test("Cost Canonical Ingredient creation keeps the existing facade and safe validation response", async () => {
  const databasePath = path.resolve(
    "data",
    `cost-back-office-creation-${randomUUID()}.sqlite`
  );
  const running = await start(databasePath);
  try {
    const invalid = await request(
      running.baseUrl,
      "/api/admin/cost/ingredients",
      "POST",
      {
        name: "  ",
        categoryCode: "sauce",
        occurredAt: AT,
        actor: "owner"
      }
    );
    assert.equal(invalid.status, 422);
    assert.equal(invalid.body.error.code, "invalid_cost_input");
    assert.doesNotMatch(
      invalid.body.error.message,
      /sqlite|database|repository|stack|cause/i
    );

    const created = await request(
      running.baseUrl,
      "/api/admin/cost/ingredients",
      "POST",
      {
        name: "Duplicate permitted",
        categoryCode: "sauce",
        occurredAt: AT,
        actor: "owner"
      }
    );
    assert.equal(created.status, 201);
    assert.match(created.body.data.ingredientId, /^ing_[0-9a-f-]{36}$/);
    assert.equal(created.body.data.status, "Active");

    const noManagementCreate = await request(
      running.baseUrl,
      "/api/admin/canonical-ingredients",
      "POST",
      {
        name: "Must not create",
        categoryCode: "sauce",
        occurredAt: AT,
        actor: "owner"
      }
    );
    assert.equal(noManagementCreate.status, 404);
  } finally {
    await stop(running.server);
    cleanup(databasePath);
  }
});
