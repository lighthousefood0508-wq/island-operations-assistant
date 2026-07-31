import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
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
    assert.deepEqual(
      evaluated.body.data.result.exactStandardBatchCost,
      { numerator: "30", denominator: "1" }
    );
    assert.deepEqual(
      evaluated.body.data.result.exactPerStandardYieldCost,
      { numerator: "15", denominator: "1" }
    );
    assert.equal(
      evaluated.body.data.result.lines[0].quoteNormalizationEvidence.quoteId,
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
      replacementEvaluation.body.data.result.lines[0]
        .quoteNormalizationEvidence.quoteId,
      replacementQuoteId
    );
    assert.notEqual(
      replacementEvaluation.body.data.result.lines[0]
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
      historicalEvaluation.body.data.result.lines[0]
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
      repeated.body.data.result.lines[0].quoteNormalizationEvidence.quoteId,
      replacementQuoteId
    );
  } finally {
    if (running.server.listening) await stop(running.server);
    cleanup(databasePath);
  }
});

test("Cost Back Office API rejects invalid cross-dimension Profile input", async () => {
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
