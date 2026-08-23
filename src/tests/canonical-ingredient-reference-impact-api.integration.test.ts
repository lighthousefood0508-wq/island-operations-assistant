import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRosServer } from "../server/index.js";
import type { DatabaseAdapter } from "../shared/database/database-adapter.js";
import { createDatabase } from "../shared/database/database-provider.js";

const CREATED_AT = "2026-08-01T00:00:00.000Z";

type ApiResponse = Readonly<{
  status: number;
  body: any;
}>;

async function request(
  baseUrl: string,
  pathname: string,
  method = "GET",
  body?: unknown
): Promise<ApiResponse> {
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
  const server = createRosServer({ host: "127.0.0.1", port: 0, databasePath });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function stop(server: ReturnType<typeof createRosServer>): Promise<void> {
  server.close();
  await once(server, "close");
}

function cleanup(databasePath: string): void {
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }
}

async function createIngredient(baseUrl: string, name = "Soy Sauce") {
  const response = await request(
    baseUrl,
    "/api/admin/cost/ingredients",
    "POST",
    {
      name,
      categoryCode: "sauce",
      occurredAt: CREATED_AT,
      actor: "caller-owner"
    }
  );
  assert.equal(response.status, 201);
  return response.body.data as Readonly<{
    ingredientId: string;
    aggregateVersion: number;
  }>;
}

function seedReferences(database: DatabaseAdapter, ingredientId: string): void {
  const recipeId = "recipe_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const familyId = "recipe_family_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const draftId = "recipe_draft_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const versionId = "recipe_version_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const lineId = "recipe_line_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  database.transaction(() => {
    database.execute("PRAGMA defer_foreign_keys = ON");
    database.execute(
      `INSERT INTO recipe_recipes (
         recipe_id, recipe_family_id, product_id, current_draft_id,
         current_recipe_version_id, aggregate_version, state
       ) VALUES (?, ?, 'product_fixture', ?, ?, 1, 'Published')`,
      [recipeId, familyId, draftId, versionId]
    );
    database.execute(
      `INSERT INTO recipe_drafts (
         draft_id, recipe_id, recipe_family_id, name, state,
         product_id, product_version_id, instructions,
         standard_output_coefficient, standard_output_scale,
         standard_output_unit_code, standard_output_dimension,
         standard_yield_coefficient, standard_yield_scale,
         standard_yield_unit_code, standard_yield_dimension,
         created_by, created_at
       ) VALUES (?, ?, ?, 'Fixture Recipe', 'Published', 'product_fixture',
         'product_version_fixture', NULL, '1', 0, 'each', 'count',
         '1', 0, 'each', 'count', 'owner', ?)`,
      [draftId, recipeId, familyId, CREATED_AT]
    );
    database.execute(
      `INSERT INTO recipe_versions (
         recipe_version_id, recipe_id, recipe_family_id, source_draft_id,
         version_number, state, name, product_id, product_version_id,
         instructions, standard_output_coefficient, standard_output_scale,
         standard_output_unit_code, standard_output_dimension,
         standard_yield_coefficient, standard_yield_scale,
         standard_yield_unit_code, standard_yield_dimension,
         published_by, published_at
       ) VALUES (?, ?, ?, ?, 1, 'Published', 'Fixture Recipe',
         'product_fixture', 'product_version_fixture', NULL,
         '1', 0, 'each', 'count', '1', 0, 'each', 'count', 'owner', ?)`,
      [versionId, recipeId, familyId, draftId, CREATED_AT]
    );
    for (const [table, ownerColumn, ownerId] of [
      ["recipe_draft_lines", "draft_id", draftId],
      ["recipe_version_lines", "recipe_version_id", versionId]
    ] as const) {
      database.execute(
        `INSERT INTO ${table} (
           ${ownerColumn}, recipe_line_id, position, ingredient_id,
           ingredient_canonical_name, ingredient_measurement_dimension,
           ingredient_status, ingredient_created_at, quantity_coefficient,
           quantity_scale, quantity_unit_code, quantity_dimension,
           preparation_note
         ) VALUES (?, ?, 0, ?, 'Soy Sauce', 'count', 'active', ?,
           '1', 0, 'each', 'count', NULL)`,
        [ownerId, lineId, ingredientId, CREATED_AT]
      );
    }
  });
  database.execute(
    `INSERT INTO cost_ingredient_cost_quotes (
       quote_id, ingredient_id, amount_coefficient, amount_scale,
       currency_code, purchase_quantity_coefficient,
       purchase_quantity_scale, unit_code, source_type,
       source_reference_id, supplier_id, effective_from, effective_to,
       recorded_at, recorded_by, superseded_at,
       superseded_by_quote_id, superseded_by_actor, aggregate_version
     ) VALUES ('cost_quote_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', ?,
       100, 0, 'TWD', 1, 0, 'each', 'manual', NULL, NULL, ?, NULL, ?,
       'owner', NULL, NULL, NULL, 0)`,
    [ingredientId, CREATED_AT, CREATED_AT]
  );
  database.execute(
    `INSERT INTO cost_ingredient_cost_quotes (
       quote_id, ingredient_id, amount_coefficient, amount_scale,
       currency_code, purchase_quantity_coefficient,
       purchase_quantity_scale, unit_code, source_type,
       source_reference_id, supplier_id, effective_from, effective_to,
       recorded_at, recorded_by, superseded_at,
       superseded_by_quote_id, superseded_by_actor, aggregate_version
     ) VALUES ('cost_quote_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ?,
       90, 0, 'TWD', 1, 0, 'each', 'manual', NULL, NULL, ?, NULL, ?,
       'owner', '2026-08-02T00:00:00.000Z',
       'cost_quote_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'owner', 1)`,
    [ingredientId, CREATED_AT, CREATED_AT]
  );
}

test("Reference Impact API reports exact Active and Archived historical impact", async () => {
  const databasePath = path.resolve(
    "data",
    `canonical-ingredient-reference-impact-api-${randomUUID()}.sqlite`
  );
  const running = await start(databasePath);
  try {
    const ingredient = await createIngredient(running.baseUrl);
    const listed = await request(
      running.baseUrl,
      "/api/admin/canonical-ingredients"
    );
    assert.equal(listed.status, 200);
    assert.equal(
      listed.body.data.some(
        (candidate: { ingredientId: string }) =>
          candidate.ingredientId === ingredient.ingredientId
      ),
      true
    );
    const detail = await request(
      running.baseUrl,
      `/api/admin/canonical-ingredients/${ingredient.ingredientId}`
    );
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.ingredientId, ingredient.ingredientId);

    const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
    try {
      seedReferences(database, ingredient.ingredientId);
    } finally {
      database.close();
    }
    const encodedId = ingredient.ingredientId.replace("_", "%5F");
    const response = await request(
      running.baseUrl,
      `/api/admin/canonical-ingredients/${encodedId}/reference-impact`
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.data.ingredientId, ingredient.ingredientId);
    assert.equal(response.body.data.recipeDrafts.uniqueRecipeCount, 1);
    assert.equal(response.body.data.recipeDrafts.draftCount, 1);
    assert.equal(response.body.data.recipeDrafts.lineOccurrenceCount, 1);
    assert.equal(response.body.data.recipePublishedVersions.uniqueRecipeCount, 1);
    assert.equal(response.body.data.recipePublishedVersions.publishedVersionCount, 1);
    assert.equal(response.body.data.recipePublishedVersions.lineOccurrenceCount, 1);
    assert.deepEqual(response.body.data.costQuotes.quoteIds, [
      "cost_quote_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "cost_quote_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    ]);
    assert.deepEqual(response.body.data.acceptedPurchases, {
      availability: "Available", acceptedPurchaseCount: 0, acceptedPurchaseIds: []
    });
    assert.deepEqual(response.body.data.costSnapshots, {
      availability: "Unavailable"
    });
    assert.deepEqual(response.body.data.deletionEligibility, {
      status: "Indeterminate",
      blocked: true
    });

    const renamed = await request(
      running.baseUrl,
      `/api/admin/canonical-ingredients/${ingredient.ingredientId}/rename`,
      "POST",
      {
        newName: "Soy Sauce Prime",
        expectedVersion: ingredient.aggregateVersion,
        actor: "caller-owner",
        occurredAt: "2026-08-02T00:00:00.000Z",
        reason: "Existing lifecycle route regression"
      }
    );
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.data.ingredient.name, "Soy Sauce Prime");

    const archived = await request(
      running.baseUrl,
      `/api/admin/canonical-ingredients/${ingredient.ingredientId}/archive`,
      "POST",
      {
        expectedVersion: renamed.body.data.ingredient.aggregateVersion,
        actor: "caller-owner",
        occurredAt: "2026-08-03T00:00:00.000Z",
        reason: "Retain historical references"
      }
    );
    assert.equal(archived.status, 200);
    const archivedImpact = await request(
      running.baseUrl,
      `/api/admin/canonical-ingredients/${ingredient.ingredientId}/reference-impact`
    );
    assert.equal(archivedImpact.status, 200);
    assert.deepEqual(archivedImpact.body.data, response.body.data);

    const page = await fetch(`${running.baseUrl}/admin/ingredients`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await page.text(), /食材主檔/);
  } finally {
    if (running.server.listening) await stop(running.server);
    cleanup(databasePath);
  }
});

test("Reference Impact API maps validation and missing identity without mutation routes", async () => {
  const databasePath = path.resolve(
    "data",
    `canonical-ingredient-reference-impact-errors-${randomUUID()}.sqlite`
  );
  const running = await start(databasePath);
  try {
    const ingredient = await createIngredient(running.baseUrl, "Parser Probe");
    const malformed = await request(
      running.baseUrl,
      "/api/admin/canonical-ingredients/not-an-id/reference-impact"
    );
    assert.equal(malformed.status, 422);
    assert.equal(
      malformed.body.error.code,
      "CANONICAL_INGREDIENT_REFERENCE_IMPACT_VALIDATION_FAILURE"
    );
    const missing = await request(
      running.baseUrl,
      "/api/admin/canonical-ingredients/ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/reference-impact"
    );
    assert.equal(missing.status, 404);
    assert.equal(
      missing.body.error.code,
      "CANONICAL_INGREDIENT_REFERENCE_IMPACT_NOT_FOUND"
    );
    const mutation = await request(
      running.baseUrl,
      "/api/admin/canonical-ingredients/ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/reference-impact",
      "POST",
      {}
    );
    assert.equal(mutation.status, 404);

    for (const pathname of [
      `/api/admin/canonical-ingredients/${ingredient.ingredientId}/rename`,
      "/api/admin/cost/ingredients"
    ]) {
      const malformedJson = await fetch(`${running.baseUrl}${pathname}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{"
      });
      assert.equal(malformedJson.status, 400);
      assert.deepEqual(await malformedJson.json(), {
        ok: false,
        error: {
          code: "invalid_json",
          message: "Request body must be a JSON object."
        }
      });
    }
  } finally {
    if (running.server.listening) await stop(running.server);
    cleanup(databasePath);
  }
});

test("Recipe and Cost failures fail closed without raw leakage or fallback logging", async () => {
  for (const table of [
    "recipe_draft_lines",
    "cost_ingredient_cost_quotes"
  ] as const) {
    const databasePath = path.resolve(
      "data",
      `canonical-ingredient-reference-impact-failure-${randomUUID()}.sqlite`
    );
    const running = await start(databasePath);
    try {
      const ingredient = await createIngredient(
        running.baseUrl,
        `Failure Probe ${table}`
      );
      const sabotage = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
      try {
        sabotage.execute(`DROP TABLE ${table}`);
      } finally {
        sabotage.close();
      }
      const logged: unknown[][] = [];
      const originalConsoleError = console.error;
      let response: ApiResponse;
      try {
        console.error = (...values: unknown[]) => { logged.push(values); };
        response = await request(
          running.baseUrl,
          `/api/admin/canonical-ingredients/${ingredient.ingredientId}/reference-impact`
        );
      } finally {
        console.error = originalConsoleError;
      }
      assert.equal(response.status, 500);
      assert.equal(response.body.ok, false);
      assert.equal(
        response.body.error.code,
        "CANONICAL_INGREDIENT_REFERENCE_IMPACT_READ_FAILURE"
      );
      assert.equal(
        response.body.error.message,
        "Canonical Ingredient Reference Impact could not be read."
      );
      assert.deepEqual(Object.keys(response.body).sort(), ["error", "ok"]);
      assert.doesNotMatch(
        JSON.stringify(response.body),
        /sqlite|no such table|recipe_draft_lines|cost_ingredient_cost_quotes|stack|cause/i
      );
      assert.deepEqual(logged, []);
    } finally {
      if (running.server.listening) await stop(running.server);
      cleanup(databasePath);
    }
  }
});
