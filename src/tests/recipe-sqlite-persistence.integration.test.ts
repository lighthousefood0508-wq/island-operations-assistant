import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { CanonicalIngredient } from "../domains/recipe/ingredient-catalog/canonical-ingredient.js";
import { CanonicalIngredientId } from "../domains/recipe/ingredient-catalog/identities.js";
import { IngredientCategory } from "../domains/recipe/ingredient-catalog/ingredient-category.js";
import { SqliteCanonicalIngredientRepository } from "../domains/recipe/ingredient-catalog/infrastructure/sqlite-canonical-ingredient-repository.js";
import {
  RecipeDraftId,
  RecipeId,
  RecipeVersionId
} from "../domains/recipe/domain/identities.js";
import { IngredientReference } from "../domains/recipe/domain/ingredient-reference.js";
import { Quantity } from "../domains/recipe/domain/quantity.js";
import { RecipeAggregate } from "../domains/recipe/domain/recipe-aggregate.js";
import { Unit } from "../domains/recipe/domain/unit.js";
import { VersionNumber } from "../domains/recipe/domain/version-number.js";
import { SqliteRecipeRepository } from "../domains/recipe/infrastructure/sqlite-recipe-repository.js";
import {
  InvalidRecipePersistenceState,
  RecipeConcurrencyConflict
} from "../domains/recipe/persistence/errors.js";
import type { DatabaseAdapter } from "../shared/database/database-adapter.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";

const UUIDS = {
  recipe: "10000000-0000-4000-8000-000000000001",
  draft1: "20000000-0000-4000-8000-000000000001",
  draft2: "20000000-0000-4000-8000-000000000002",
  ingredient: "30000000-0000-4000-8000-000000000001",
  version1: "40000000-0000-4000-8000-000000000001",
  version2: "40000000-0000-4000-8000-000000000002"
} as const;
const T0 = "2026-07-31T01:00:00.000Z";
const T1 = "2026-07-31T02:00:00.000Z";
const T2 = "2026-08-01T02:00:00.000Z";
const recipeId = RecipeId.fromUuid(UUIDS.recipe);

type Fixture = Readonly<{
  database: DatabaseAdapter;
  databasePath: string;
  repository: SqliteRecipeRepository;
}>;

function cleanup(databasePath: string): void {
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }
}

function fixture(t: TestContext): Fixture {
  const databasePath = path.resolve(
    "data",
    `recipe-sqlite-persistence-${randomUUID()}.sqlite`
  );
  const database = createDatabase({
    host: "127.0.0.1",
    port: 0,
    databasePath
  });
  runMigrations(database);
  new SqliteCanonicalIngredientRepository(database).saveNew(
    CanonicalIngredient.create({
      ingredientId: CanonicalIngredientId.fromUuid(UUIDS.ingredient),
      name: "Pork belly",
      category: IngredientCategory.parse("meat"),
      createdAt: T0,
      createdBy: "owner"
    })
  );
  t.after(() => {
    database.close();
    cleanup(databasePath);
  });
  return {
    database,
    databasePath,
    repository: new SqliteRecipeRepository(database)
  };
}

function draft(
  draftUuid: string = UUIDS.draft1,
  quantity = 600n
): RecipeAggregate {
  const aggregate = RecipeAggregate.createDraft({
    recipeId,
    draftId: RecipeDraftId.fromUuid(draftUuid),
    name: "Braised pork",
    createdBy: "owner",
    createdAt: T0
  });
  aggregate.bindProduct("product_braised_pork", "product_version_1");
  aggregate.addIngredient(
    IngredientReference.create({
      ingredientReferenceId:
        CanonicalIngredientId.fromUuid(UUIDS.ingredient),
      canonicalName: "Pork belly",
      measurementDimension: "mass",
      createdAt: T0
    }),
    Quantity.create(quantity, 0, Unit.create("g", "mass"))
  );
  aggregate.defineStandardOutput(
    Quantity.create(quantity, 0, Unit.create("g", "mass")),
    Quantity.create(3n, 0, Unit.create("each", "count"))
  );
  return aggregate;
}

function publish(
  aggregate: RecipeAggregate,
  versionUuid: string = UUIDS.version1,
  versionNumber = 1,
  at = T1
): RecipeAggregate {
  aggregate.publish({
    recipeVersionId: RecipeVersionId.fromUuid(versionUuid),
    versionNumber: VersionNumber.create(versionNumber),
    publishedBy: "owner",
    publishedAt: at
  });
  return aggregate;
}

test("migration creates empty Recipe history tables and indexes", (t) => {
  const { database } = fixture(t);
  const tables = database.queryMany<{ name: string }>(
    `SELECT name FROM sqlite_master
      WHERE type = 'table'
        AND (
          name = 'recipe_recipes'
          OR name LIKE 'recipe_draft%'
          OR name LIKE 'recipe_version%'
          OR name LIKE 'recipe_publish%'
          OR name LIKE 'recipe_supersession%'
        )
      ORDER BY name`
  ).map((row) => row.name);
  assert.deepEqual(tables, [
    "recipe_draft_lines",
    "recipe_drafts",
    "recipe_publish_audits",
    "recipe_recipes",
    "recipe_supersession_audits",
    "recipe_version_lines",
    "recipe_versions"
  ]);
  assert.equal(
    database.queryOne<{ count: number }>(
      "SELECT COUNT(*) AS count FROM recipe_recipes"
    )?.count,
    0
  );
});

test("Draft and Published Recipe round-trip through SQLite", (t) => {
  const { repository } = fixture(t);
  const original = draft();
  repository.save(original);
  const storedDraft = repository.findWithVersion(recipeId);
  assert.ok(storedDraft);
  assert.equal(storedDraft.aggregateVersion, 1);
  assert.equal(storedDraft.aggregate.snapshot().state, "Draft");

  publish(storedDraft.aggregate);
  assert.equal(
    repository.saveWithExpectedVersion(
      storedDraft.aggregate,
      storedDraft.aggregateVersion
    ),
    2
  );
  const stored = repository.findPublishedVersion(recipeId);
  assert.ok(stored);
  assert.equal(stored.aggregate.snapshot().publication?.versionNumber.value, 1);
  assert.equal(
    stored.aggregate.snapshot().lines[0]?.quantity.coefficient,
    600n
  );
  assert.deepEqual(repository.listRecipes()[0], {
    recipeId: recipeId.value,
    currentDraftId: RecipeDraftId.fromUuid(UUIDS.draft1).value,
    currentRecipeVersionId:
      RecipeVersionId.fromUuid(UUIDS.version1).value,
    aggregateVersion: 2,
    state: "Published",
    name: "Braised pork",
    versionNumber: 1
  });
});

test("Recipe authority survives closing and reopening SQLite", (t) => {
  const { database, databasePath, repository } = fixture(t);
  repository.save(publish(draft()));
  database.close();

  const reopened = createDatabase({
    host: "127.0.0.1",
    port: 0,
    databasePath
  });
  const stored = new SqliteRecipeRepository(reopened)
    .findPublishedVersion(recipeId);
  assert.equal(stored?.aggregate.snapshot().name, "Braised pork");
  assert.equal(stored?.aggregate.snapshot().state, "Published");
  reopened.close();
});

test("Draft reads fail closed when the retained pointer targets a same-Family non-Published Version", (t) => {
  const { database, repository } = fixture(t);
  repository.save(publish(draft()));
  assert.equal(repository.saveWithExpectedVersion(draft(UUIDS.draft2), 1), 2);
  assert.equal(repository.findWithVersion(recipeId)?.aggregate.snapshot().state, "Draft");
  assert.equal(
    repository.listRecipes()[0]?.currentRecipeVersionId,
    RecipeVersionId.fromUuid(UUIDS.version1).value
  );

  database.execute(
    "UPDATE recipe_versions SET state = 'Superseded' WHERE recipe_version_id = ?",
    [RecipeVersionId.fromUuid(UUIDS.version1).value]
  );
  assert.equal(database.queryMany("PRAGMA foreign_key_check").length, 0);
  assert.equal(
    database.queryOne<{ integrity_check: string }>("PRAGMA integrity_check")?.integrity_check,
    "ok"
  );
  assert.throws(
    () => repository.findWithVersion(recipeId),
    InvalidRecipePersistenceState
  );
  assert.throws(
    () => repository.listRecipes(),
    InvalidRecipePersistenceState
  );
});

test("duplicate identity and stale writer fail without overwrite", (t) => {
  const { repository } = fixture(t);
  repository.save(draft());
  assert.throws(() => repository.save(draft()), RecipeConcurrencyConflict);
  const first = repository.findWithVersion(recipeId)!;
  const stale = repository.findWithVersion(recipeId)!;
  first.aggregate.rename("First writer");
  repository.saveWithExpectedVersion(first.aggregate, first.aggregateVersion);
  stale.aggregate.rename("Stale writer");
  assert.throws(
    () => repository.saveWithExpectedVersion(
      stale.aggregate,
      stale.aggregateVersion
    ),
    RecipeConcurrencyConflict
  );
  assert.equal(
    repository.findById(recipeId)?.snapshot().name,
    "First writer"
  );
});

test("Published Versions append and historical supersession remains readable", (t) => {
  const { database, repository } = fixture(t);
  repository.save(publish(draft()));
  const first = repository.findPublishedVersion(
    recipeId,
    RecipeVersionId.fromUuid(UUIDS.version1)
  )!;
  const nextDraft = draft(UUIDS.draft2, 550n);
  repository.saveWithExpectedVersion(nextDraft, first.aggregateVersion);
  const draftVersion = repository.findWithVersion(recipeId)!;
  publish(draftVersion.aggregate, UUIDS.version2, 2, T2);
  repository.saveWithExpectedVersion(
    draftVersion.aggregate,
    draftVersion.aggregateVersion
  );

  const old = repository.findPublishedVersion(
    recipeId,
    RecipeVersionId.fromUuid(UUIDS.version1)
  )!;
  old.aggregate.supersede({
    supersededByRecipeVersionId:
      RecipeVersionId.fromUuid(UUIDS.version2),
    supersededBy: "owner",
    supersededAt: T2,
    reason: "Recipe revision"
  });
  const currentVersion =
    repository.findWithVersion(recipeId)!.aggregateVersion;
  repository.saveWithExpectedVersion(old.aggregate, currentVersion);

  assert.equal(
    repository.findPublishedVersion(
      recipeId,
      RecipeVersionId.fromUuid(UUIDS.version1)
    )?.aggregate.snapshot().state,
    "Superseded"
  );
  assert.equal(
    repository.findPublishedVersion(recipeId)?.aggregate.snapshot()
      .publication?.versionNumber.value,
    2
  );
  assert.equal(repository.listRecipes()[0]?.aggregateVersion, 4);

  database.execute(
    "UPDATE recipe_recipes SET current_recipe_version_id = ? WHERE recipe_id = ?",
    [RecipeVersionId.fromUuid(UUIDS.version1).value, recipeId.value]
  );
  assert.equal(database.queryMany("PRAGMA foreign_key_check").length, 0);
  assert.equal(
    database.queryOne<{ integrity_check: string }>("PRAGMA integrity_check")?.integrity_check,
    "ok"
  );
  assert.throws(
    () => repository.findWithVersion(recipeId),
    InvalidRecipePersistenceState
  );
  assert.throws(
    () => repository.listRecipes(),
    InvalidRecipePersistenceState
  );
});

test("non-monotonic Version number and Version overwrite fail closed", (t) => {
  const { repository } = fixture(t);
  repository.save(publish(draft(), UUIDS.version1, 2));
  const published = repository.findWithVersion(recipeId)!;
  const oldNumber = publish(
    draft(UUIDS.draft2),
    UUIDS.version2,
    1,
    T2
  );
  assert.throws(
    () => repository.saveWithExpectedVersion(
      oldNumber,
      published.aggregateVersion
    ),
    InvalidRecipePersistenceState
  );
  assert.equal(repository.listRecipes()[0]?.versionNumber, 2);
});

test("Published Recipe Line mutation is rejected before historical hydration can drift", (t) => {
  const { database, repository } = fixture(t);
  repository.save(publish(draft()));
  assert.throws(
    () => database.execute(
      `UPDATE recipe_version_lines
          SET quantity_coefficient = '600.0'
        WHERE recipe_version_id = ?`,
      [RecipeVersionId.fromUuid(UUIDS.version1).value]
    )
  );
  assert.equal(
    repository.findPublishedVersion(recipeId)?.aggregate.snapshot().lines[0]?.quantity.coefficient,
    600n
  );
});
