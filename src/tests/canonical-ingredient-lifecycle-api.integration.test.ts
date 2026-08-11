import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  CanonicalIngredientLifecycleService,
  InvalidCanonicalIngredientLifecycleTransition
} from "../domains/recipe/index.js";
import { createRosServer } from "../server/index.js";
import { createDatabase } from "../shared/database/database-provider.js";

const CREATED_AT = "2026-08-01T01:00:00.000Z";
const RENAMED_AT = "2026-08-02T01:00:00.000Z";
const ARCHIVED_AT = "2026-08-03T01:00:00.000Z";
const LATER_AT = "2026-08-04T01:00:00.000Z";

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

async function requestText(
  baseUrl: string,
  pathname: string
): Promise<Readonly<{ status: number; contentType: string; body: string }>> {
  const response = await fetch(`${baseUrl}${pathname}`);
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    body: await response.text()
  };
}

async function malformedJsonRequest(
  baseUrl: string,
  pathname: string
): Promise<ApiResponse> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{"
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

async function stop(server: ReturnType<typeof createRosServer>): Promise<void> {
  server.close();
  await once(server, "close");
}

function cleanup(databasePath: string): void {
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }
}

async function createIngredient(baseUrl: string, name: string) {
  const response = await request(
    baseUrl,
    "/api/admin/cost/ingredients",
    "POST",
    {
      name,
      categoryCode: "other",
      occurredAt: CREATED_AT,
      actor: "caller-owner"
    }
  );
  assert.equal(response.status, 201);
  return response.body.data;
}

function byNameThenId(
  left: Readonly<{ name: string; ingredientId: string }>,
  right: Readonly<{ name: string; ingredientId: string }>
): number {
  if (left.name !== right.name) return left.name < right.name ? -1 : 1;
  if (left.ingredientId === right.ingredientId) return 0;
  return left.ingredientId < right.ingredientId ? -1 : 1;
}

test("four registrations provide six management API behaviors and survive restart", async () => {
  const databasePath = path.resolve(
    "data",
    `canonical-ingredient-management-api-${randomUUID()}.sqlite`
  );
  let running = await start(databasePath);
  try {
    const empty = await request(
      running.baseUrl,
      "/api/admin/canonical-ingredients"
    );
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.data, []);

    const activeAlpha = await createIngredient(running.baseUrl, "Alpha");
    const activeBeta = await createIngredient(running.baseUrl, "Beta");
    const renameSource = await createIngredient(running.baseUrl, "Gamma");
    const archiveFirst = await createIngredient(
      running.baseUrl,
      "Aardvark archived"
    );
    const archiveLast = await createIngredient(
      running.baseUrl,
      "Zulu archived"
    );

    const renamed = await request(
      running.baseUrl,
      `/api/admin/canonical-ingredients/${renameSource.ingredientId}/rename`,
      "POST",
      {
        newName: "Beta",
        expectedVersion: renameSource.aggregateVersion,
        actor: "caller-editor",
        occurredAt: RENAMED_AT,
        reason: "Align display name"
      }
    );
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.data.ingredient.ingredientId, renameSource.ingredientId);
    assert.equal(renamed.body.data.ingredient.aggregateVersion, 1);
    assert.equal(renamed.body.data.warnings.length, 1);
    assert.equal(
      renamed.body.data.warnings[0].code,
      "DUPLICATE_NAME_WARNING"
    );
    assert.deepEqual(
      renamed.body.data.warnings[0].candidates.map(
        (candidate: any) => candidate.ingredientId
      ),
      [activeBeta.ingredientId]
    );

    for (const ingredient of [archiveFirst, archiveLast]) {
      const archived = await request(
        running.baseUrl,
        `/api/admin/canonical-ingredients/${ingredient.ingredientId}/archive`,
        "POST",
        {
          expectedVersion: ingredient.aggregateVersion,
          actor: "caller-archiver",
          occurredAt: ARCHIVED_AT,
          reason: "Retire identity"
        }
      );
      assert.equal(archived.status, 200);
      assert.equal(archived.body.data.ingredient.status, "Archived");
      assert.equal(archived.body.data.ingredient.aggregateVersion, 1);
    }

    const active = await request(
      running.baseUrl,
      "/api/admin/canonical-ingredients?lifecycle=active"
    );
    const archived = await request(
      running.baseUrl,
      "/api/admin/canonical-ingredients?lifecycle=archived"
    );
    const defaultAll = await request(
      running.baseUrl,
      "/api/admin/canonical-ingredients"
    );
    const explicitAll = await request(
      running.baseUrl,
      "/api/admin/canonical-ingredients?lifecycle=all"
    );
    for (const response of [active, archived, defaultAll, explicitAll]) {
      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
    }
    assert.ok(active.body.data.every((item: any) => item.status === "Active"));
    assert.ok(
      archived.body.data.every((item: any) => item.status === "Archived")
    );
    assert.deepEqual(
      active.body.data,
      [...active.body.data].sort(byNameThenId)
    );
    assert.deepEqual(
      archived.body.data,
      [...archived.body.data].sort(byNameThenId)
    );
    assert.deepEqual(
      defaultAll.body.data,
      [...active.body.data, ...archived.body.data]
    );
    assert.deepEqual(explicitAll.body.data, defaultAll.body.data);
    assert.deepEqual(
      active.body.data
        .filter((item: any) => item.name === "Beta")
        .map((item: any) => item.ingredientId),
      [activeBeta.ingredientId, renameSource.ingredientId].sort()
    );
    assert.equal(active.body.data[0].ingredientId, activeAlpha.ingredientId);
    assert.equal(archived.body.data[0].ingredientId, archiveFirst.ingredientId);

    const activeDetail = await request(
      running.baseUrl,
      `/api/admin/canonical-ingredients/${activeAlpha.ingredientId}`
    );
    assert.equal(activeDetail.status, 200);
    assert.equal(activeDetail.body.data.status, "Active");

    const archivedDetail = await request(
      running.baseUrl,
      `/api/admin/canonical-ingredients/${archiveFirst.ingredientId}`
    );
    assert.equal(archivedDetail.status, 200);
    assert.equal(archivedDetail.body.data.status, "Archived");
    assert.deepEqual(archivedDetail.body.data.archiveFact, {
      archivedAt: ARCHIVED_AT,
      archivedBy: "caller-archiver",
      reason: "Retire identity"
    });

    const invalidFilter = await request(
      running.baseUrl,
      "/api/admin/canonical-ingredients?lifecycle=deleted"
    );
    assert.equal(invalidFilter.status, 422);
    assert.equal(
      invalidFilter.body.error.code,
      "CANONICAL_INGREDIENT_VALIDATION_FAILURE"
    );
    const invalidId = await request(
      running.baseUrl,
      "/api/admin/canonical-ingredients/not-an-ingredient"
    );
    assert.equal(invalidId.status, 422);
    const missing = await request(
      running.baseUrl,
      `/api/admin/canonical-ingredients/ing_${randomUUID()}`
    );
    assert.equal(missing.status, 404);
    assert.equal(
      missing.body.error.code,
      "CANONICAL_INGREDIENT_NOT_FOUND"
    );

    const invalidCommandBodies = [
      {
        newName: "Alpha Prime",
        expectedVersion: activeAlpha.aggregateVersion,
        occurredAt: LATER_AT,
        reason: "Missing actor"
      },
      {
        newName: "Alpha Prime",
        expectedVersion: activeAlpha.aggregateVersion,
        actor: "caller-editor",
        reason: "Missing occurrence time"
      },
      {
        newName: "Alpha Prime",
        expectedVersion: activeAlpha.aggregateVersion,
        actor: "caller-editor",
        occurredAt: LATER_AT
      }
    ];
    for (const body of invalidCommandBodies) {
      const invalidCommand = await request(
        running.baseUrl,
        `/api/admin/canonical-ingredients/${activeAlpha.ingredientId}/rename`,
        "POST",
        body
      );
      assert.equal(invalidCommand.status, 422);
      assert.equal(
        invalidCommand.body.error.code,
        "CANONICAL_INGREDIENT_VALIDATION_FAILURE"
      );
    }

    const invalidArchiveBodies = [
      {
        expectedVersion: activeAlpha.aggregateVersion,
        occurredAt: LATER_AT,
        reason: "Missing actor"
      },
      {
        expectedVersion: activeAlpha.aggregateVersion,
        actor: "caller-archiver",
        reason: "Missing occurrence time"
      },
      {
        expectedVersion: activeAlpha.aggregateVersion,
        actor: "caller-archiver",
        occurredAt: LATER_AT
      }
    ];
    for (const body of invalidArchiveBodies) {
      const invalidArchive = await request(
        running.baseUrl,
        `/api/admin/canonical-ingredients/${activeAlpha.ingredientId}/archive`,
        "POST",
        body
      );
      assert.equal(invalidArchive.status, 422);
      assert.equal(invalidArchive.body.ok, false);
      assert.equal(
        invalidArchive.body.error.code,
        "CANONICAL_INGREDIENT_VALIDATION_FAILURE"
      );
    }

    const malformedJson = await malformedJsonRequest(
      running.baseUrl,
      `/api/admin/canonical-ingredients/${activeAlpha.ingredientId}/rename`
    );
    assert.equal(malformedJson.status, 400);
    assert.equal(malformedJson.body.error.code, "invalid_json");
    assert.equal(
      malformedJson.body.error.message,
      "Request body must be a JSON object."
    );

    const malformedCostJson = await malformedJsonRequest(
      running.baseUrl,
      "/api/admin/cost/ingredients"
    );
    assert.equal(malformedCostJson.status, 400);
    assert.equal(malformedCostJson.body.error.code, "invalid_json");
    assert.equal(
      malformedCostJson.body.error.message,
      "Request body must be a JSON object."
    );

    for (const existingCostInvalidShape of [[], null]) {
      const invalidCostShape = await request(
        running.baseUrl,
        "/api/admin/cost/ingredients",
        "POST",
        existingCostInvalidShape
      );
      assert.equal(invalidCostShape.status, 400);
      assert.equal(invalidCostShape.body.error.code, "invalid_json");
      assert.equal(
        invalidCostShape.body.error.message,
        "Request body must be a JSON object."
      );
    }

    for (const validJsonWithInvalidShape of [[], null, "text", 42]) {
      const invalidShape = await request(
        running.baseUrl,
        `/api/admin/canonical-ingredients/${activeAlpha.ingredientId}/rename`,
        "POST",
        validJsonWithInvalidShape
      );
      assert.equal(invalidShape.status, 422);
      assert.equal(invalidShape.body.ok, false);
      assert.equal(
        invalidShape.body.error.code,
        "CANONICAL_INGREDIENT_VALIDATION_FAILURE"
      );
      assert.deepEqual(
        Object.keys(invalidShape.body).sort(),
        ["error", "ok"]
      );
    }

    const staleArchived = await request(
      running.baseUrl,
      `/api/admin/canonical-ingredients/${archiveFirst.ingredientId}/archive`,
      "POST",
      {
        expectedVersion: 0,
        occurredAt: LATER_AT,
        reason: "Stale repeat"
      }
    );
    assert.equal(staleArchived.status, 409);
    assert.equal(
      staleArchived.body.error.code,
      "CANONICAL_INGREDIENT_VERSION_CONFLICT"
    );

    const alreadyArchived = await request(
      running.baseUrl,
      `/api/admin/canonical-ingredients/${archiveFirst.ingredientId}/archive`,
      "POST",
      {
        expectedVersion: 1
      }
    );
    assert.equal(alreadyArchived.status, 409);
    assert.equal(
      alreadyArchived.body.error.code,
      "CANONICAL_INGREDIENT_ALREADY_ARCHIVED"
    );

    const archivedRename = await request(
      running.baseUrl,
      `/api/admin/canonical-ingredients/${archiveFirst.ingredientId}/rename`,
      "POST",
      {
        expectedVersion: 1
      }
    );
    assert.equal(archivedRename.status, 409);
    assert.equal(
      archivedRename.body.error.code,
      "CANONICAL_INGREDIENT_ARCHIVED_RENAME_REJECTED"
    );

    const missingPrecedesMalformedVersion = await request(
      running.baseUrl,
      `/api/admin/canonical-ingredients/ing_${randomUUID()}/archive`,
      "POST",
      { expectedVersion: -1 }
    );
    assert.equal(missingPrecedesMalformedVersion.status, 404);
    assert.equal(
      missingPrecedesMalformedVersion.body.error.code,
      "CANONICAL_INGREDIENT_NOT_FOUND"
    );

    const noCreateRoute = await request(
      running.baseUrl,
      "/api/admin/canonical-ingredients",
      "POST",
      {}
    );
    assert.equal(noCreateRoute.status, 404);
    const beforeUiRoute = await request(
      running.baseUrl,
      "/api/admin/canonical-ingredients"
    );
    const uiRoute = await requestText(running.baseUrl, "/admin/ingredients");
    assert.equal(uiRoute.status, 200);
    assert.match(uiRoute.contentType, /^text\/html; charset=utf-8$/);
    assert.match(uiRoute.body, /<title>食材主檔 \| 荒島 ROS 後台<\/title>/);
    assert.match(uiRoute.body, /href="\/admin\/ingredients" aria-current="page">食材主檔<\/a>/);
    assert.match(uiRoute.body, /\/api\/admin\/canonical-ingredients/);
    const afterUiRoute = await request(
      running.baseUrl,
      "/api/admin/canonical-ingredients"
    );
    assert.deepEqual(
      afterUiRoute.body.data,
      beforeUiRoute.body.data,
      "Rendering the management UI must not write Canonical Ingredient state."
    );

    const beforeRestart = defaultAll.body.data;
    await stop(running.server);
    running = await start(databasePath);
    const afterRestart = await request(
      running.baseUrl,
      "/api/admin/canonical-ingredients"
    );
    assert.equal(afterRestart.status, 200);
    assert.deepEqual(afterRestart.body.data, beforeRestart);
    const renamedAfterRestart = afterRestart.body.data.find(
      (item: any) => item.ingredientId === renameSource.ingredientId
    );
    assert.equal(renamedAfterRestart.renameHistory.length, 1);
    const archivedAfterRestart = afterRestart.body.data.find(
      (item: any) => item.ingredientId === archiveFirst.ingredientId
    );
    assert.equal(archivedAfterRestart.archiveFact.archivedAt, ARCHIVED_AT);
  } finally {
    if (running.server.listening) await stop(running.server);
    cleanup(databasePath);
  }
});

test("HTTP maps another recognized lifecycle rejection to 409", async () => {
  const databasePath = path.resolve(
    "data",
    `canonical-ingredient-management-transition-${randomUUID()}.sqlite`
  );
  const originalRename = CanonicalIngredientLifecycleService.prototype.rename;
  CanonicalIngredientLifecycleService.prototype.rename = function (): never {
    throw new InvalidCanonicalIngredientLifecycleTransition();
  };
  const running = await start(databasePath);
  try {
    const response = await request(
      running.baseUrl,
      "/api/admin/canonical-ingredients/ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/rename",
      "POST",
      {
        newName: "Rejected",
        expectedVersion: 0,
        actor: "caller-editor",
        occurredAt: LATER_AT,
        reason: "Rejected transition"
      }
    );
    assert.equal(response.status, 409);
    assert.equal(response.body.ok, false);
    assert.equal(
      response.body.error.code,
      "INVALID_CANONICAL_INGREDIENT_TRANSITION"
    );
    assert.deepEqual(Object.keys(response.body).sort(), ["error", "ok"]);
  } finally {
    CanonicalIngredientLifecycleService.prototype.rename = originalRename;
    if (running.server.listening) await stop(running.server);
    cleanup(databasePath);
  }
});

test("management API contains persistence failures before route fallback", async () => {
  const databasePath = path.resolve(
    "data",
    `canonical-ingredient-management-failure-${randomUUID()}.sqlite`
  );
  const running = await start(databasePath);
  try {
    await createIngredient(running.baseUrl, "Failure Probe");
    const sabotage = createDatabase({
      host: "127.0.0.1",
      port: 0,
      databasePath
    });
    try {
      sabotage.execute("DROP TABLE recipe_canonical_ingredients");
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
        "/api/admin/canonical-ingredients?lifecycle=active"
      );
    } finally {
      console.error = originalConsoleError;
    }
    assert.equal(response.status, 500);
    assert.equal(response.body.ok, false);
    assert.deepEqual(Object.keys(response.body).sort(), ["error", "ok"]);
    assert.equal(
      response.body.error.code,
      "CANONICAL_INGREDIENT_PERSISTENCE_FAILURE"
    );
    assert.equal(
      response.body.error.message,
      "Canonical Ingredient lifecycle persistence failed."
    );
    const serialized = JSON.stringify(response.body);
    assert.doesNotMatch(serialized, /no such table/i);
    assert.doesNotMatch(serialized, /recipe_canonical_ingredients/i);
    assert.doesNotMatch(serialized, /sqlite|stack|cause/i);
    assert.deepEqual(logged, []);
  } finally {
    if (running.server.listening) await stop(running.server);
    cleanup(databasePath);
  }
});
