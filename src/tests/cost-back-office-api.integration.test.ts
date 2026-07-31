import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRosServer } from "../server/index.js";

const AT = "2026-07-31T01:00:00.000Z";

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
        productId: "prod_11111111-1111-4111-8111-111111111111",
        productVersionId:
          "pver_22222222-2222-4222-8222-222222222222",
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
      { recipeId: recipe.body.data.recipeId, evaluatedAt: AT }
    );
    assert.deepEqual(
      repeated.body.data.result.exactPerStandardYieldCost,
      { numerator: "15", denominator: "1" }
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
    assert.equal(response.body.error.code, "invalid_cost_input");
  } finally {
    await stop(running.server);
    cleanup(databasePath);
  }
});
