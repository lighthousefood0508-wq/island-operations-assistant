import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { CanonicalIngredient } from "../domains/recipe/ingredient-catalog/canonical-ingredient.js";
import {
  CanonicalIngredientVersionConflict
} from "../domains/recipe/ingredient-catalog/errors.js";
import { CanonicalIngredientId } from "../domains/recipe/ingredient-catalog/identities.js";
import { IngredientCategory } from "../domains/recipe/ingredient-catalog/ingredient-category.js";
import { SqliteCanonicalIngredientRepository } from "../domains/recipe/ingredient-catalog/infrastructure/sqlite-canonical-ingredient-repository.js";
import {
  CanonicalIngredientPersistenceMapper
} from "../domains/recipe/ingredient-catalog/persistence/canonical-ingredient-persistence-mapper.js";
import {
  DuplicateCanonicalIngredient,
  InvalidCanonicalIngredientPersistenceState
} from "../domains/recipe/ingredient-catalog/persistence/errors.js";
import type {
  DatabaseAdapter,
  ExecuteResult,
  SqlParameters
} from "../shared/database/database-adapter.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";

const IDS = {
  first: "ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  second: "ing_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  third: "ing_cccccccc-cccc-4ccc-8ccc-cccccccccccc"
} as const;
const CREATED_AT = "2026-07-31T01:00:00.000Z";
const RENAMED_AT = "2026-07-31T02:00:00.000Z";
const ARCHIVED_AT = "2026-07-31T03:00:00.000Z";

type Fixture = Readonly<{
  database: DatabaseAdapter;
  databasePath: string;
  repository: SqliteCanonicalIngredientRepository;
}>;

function removeDatabaseFiles(databasePath: string): void {
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }
}

function fixture(t: TestContext): Fixture {
  const databasePath = path.resolve(
    "data",
    `canonical-ingredient-persistence-${randomUUID()}.sqlite`
  );
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  runMigrations(database);
  t.after(() => {
    database.close();
    removeDatabaseFiles(databasePath);
  });
  return {
    database,
    databasePath,
    repository: new SqliteCanonicalIngredientRepository(database)
  };
}

function ingredient(
  ingredientId: string = IDS.first,
  name = "Soy Sauce"
): CanonicalIngredient {
  return CanonicalIngredient.create({
    ingredientId: CanonicalIngredientId.parse(ingredientId),
    name,
    category: IngredientCategory.parse("sauce"),
    createdAt: CREATED_AT,
    createdBy: "owner"
  });
}

function renamed(
  source = ingredient(),
  name = "Taiwan Soy Sauce"
): CanonicalIngredient {
  return source.rename(name, {
    occurredAt: RENAMED_AT,
    actorId: "editor",
    reason: "Clarify the same Ingredient concept."
  });
}

function archived(source = renamed()): CanonicalIngredient {
  return source.archive({
    occurredAt: ARCHIVED_AT,
    actorId: "owner",
    reason: "No longer selected for future use."
  });
}

test("migration creates only Canonical Ingredient tables and approved indexes", (t) => {
  const { database } = fixture(t);
  const tables = database.queryMany<{ name: string }>(
    `SELECT name FROM sqlite_master
      WHERE type = 'table'
        AND name LIKE 'recipe_canonical_ingredient%'
      ORDER BY name`
  ).map((row) => row.name);
  assert.deepEqual(tables, [
    "recipe_canonical_ingredient_renames",
    "recipe_canonical_ingredients"
  ]);
  const ingredientCount = database.queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM recipe_canonical_ingredients"
  );
  assert.equal(ingredientCount?.count, 0);
  const indexes = database.queryMany<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'index'"
  ).map((row) => row.name);
  assert.ok(indexes.includes("recipe_canonical_ingredients_active_name"));
  const renamePrimaryKey = database.queryMany<{ name: string; pk: number }>(
    "PRAGMA table_info(recipe_canonical_ingredient_renames)"
  ).filter((column) => column.pk > 0).map((column) => column.name);
  assert.deepEqual(renamePrimaryKey, ["ingredient_id", "transition_version"]);
});

test("Active Ingredient round-trips through the existing Aggregate authority", (t) => {
  const { repository } = fixture(t);
  const original = ingredient();
  repository.saveNew(original);
  const hydrated = repository.findById(original.ingredientId);
  assert.ok(hydrated);
  assert.deepEqual(hydrated.toContract(), original.toContract());
  assert.equal(Object.isFrozen(hydrated), true);
});

test("Rename appends history and round-trips current state", (t) => {
  const { database, repository } = fixture(t);
  const original = ingredient();
  repository.saveNew(original);
  const changed = renamed(original);
  assert.equal(repository.saveWithExpectedVersion(changed, 0), 1);

  const hydrated = repository.findById(original.ingredientId);
  assert.ok(hydrated);
  assert.deepEqual(hydrated.toContract(), changed.toContract());
  const facts = database.queryMany<{
    transition_version: number;
    previous_name: string;
    new_name: string;
  }>(
    `SELECT transition_version, previous_name, new_name
       FROM recipe_canonical_ingredient_renames
      WHERE ingredient_id = ?`,
    [IDS.first]
  );
  assert.deepEqual(facts, [{
    transition_version: 1,
    previous_name: "Soy Sauce",
    new_name: "Taiwan Soy Sauce"
  }]);
});

test("Archive preserves history and remains resolvable by identity", (t) => {
  const { repository } = fixture(t);
  const original = ingredient();
  repository.saveNew(original);
  const changed = renamed(original);
  repository.saveWithExpectedVersion(changed, 0);
  const inactive = archived(changed);
  repository.saveWithExpectedVersion(inactive, 1);

  const hydrated = repository.findById(original.ingredientId);
  assert.ok(hydrated);
  assert.deepEqual(hydrated.toContract(), inactive.toContract());
  assert.equal(hydrated.renameHistory.length, 1);
  assert.equal(hydrated.status, "Archived");
});

test("saveNew is insert-only and duplicate identity never overwrites", (t) => {
  const { repository } = fixture(t);
  const original = ingredient();
  repository.saveNew(original);
  assert.throws(
    () => repository.saveNew(ingredient(IDS.first, "Different Name")),
    DuplicateCanonicalIngredient
  );
  assert.deepEqual(
    repository.findById(original.ingredientId)?.toContract(),
    original.toContract()
  );
});

test("saveNew rejects an Aggregate that already contains lifecycle history", (t) => {
  const { repository } = fixture(t);
  assert.throws(
    () => repository.saveNew(renamed()),
    InvalidCanonicalIngredientPersistenceState
  );
});

test("expectedVersion rejects stale writers without changing persisted state", (t) => {
  const { repository } = fixture(t);
  const original = ingredient();
  repository.saveNew(original);
  const firstWriter = renamed(original, "First Writer Name");
  const staleWriter = renamed(original, "Stale Writer Name");
  repository.saveWithExpectedVersion(firstWriter, 0);
  assert.throws(
    () => repository.saveWithExpectedVersion(staleWriter, 0),
    CanonicalIngredientVersionConflict
  );
  assert.deepEqual(
    repository.findById(original.ingredientId)?.toContract(),
    firstWriter.toContract()
  );
});

test("two repository instances allow only one writer for one expected version", (t) => {
  const primary = fixture(t);
  const secondDatabase = createDatabase({
    host: "127.0.0.1",
    port: 0,
    databasePath: primary.databasePath
  });
  const secondRepository = new SqliteCanonicalIngredientRepository(secondDatabase);

  try {
    const original = ingredient();
    primary.repository.saveNew(original);
    primary.repository.saveWithExpectedVersion(
      renamed(original, "Primary Writer"),
      0
    );
    assert.throws(
      () => secondRepository.saveWithExpectedVersion(
        renamed(original, "Second Writer"),
        0
      ),
      CanonicalIngredientVersionConflict
    );
  } finally {
    secondDatabase.close();
  }
});

class FailingUpdateAdapter implements DatabaseAdapter {
  constructor(private readonly delegate: DatabaseAdapter) {}

  execute(sql: string, parameters?: SqlParameters): ExecuteResult {
    if (sql.includes("UPDATE recipe_canonical_ingredients")) {
      throw new Error("injected update failure");
    }
    return this.delegate.execute(sql, parameters);
  }

  queryOne<T>(sql: string, parameters?: SqlParameters): T | undefined {
    return this.delegate.queryOne<T>(sql, parameters);
  }

  queryMany<T>(sql: string, parameters?: SqlParameters): T[] {
    return this.delegate.queryMany<T>(sql, parameters);
  }

  transaction<T>(work: () => T): T {
    return this.delegate.transaction(work);
  }

  transactionImmediate<T>(work: () => T): T {
    return this.delegate.transactionImmediate(work);
  }

  close(): void {
    this.delegate.close();
  }
}

test("failed current-state update rolls back the appended Rename fact", (t) => {
  const { database, repository } = fixture(t);
  const original = ingredient();
  repository.saveNew(original);
  const failingRepository = new SqliteCanonicalIngredientRepository(
    new FailingUpdateAdapter(database)
  );
  assert.throws(
    () => failingRepository.saveWithExpectedVersion(renamed(original), 0)
  );
  assert.equal(
    database.queryOne<{ count: number }>(
      "SELECT COUNT(*) AS count FROM recipe_canonical_ingredient_renames"
    )?.count,
    0
  );
  assert.deepEqual(
    repository.findById(original.ingredientId)?.toContract(),
    original.toContract()
  );
});

test("candidate searches return Active records only and never hide history by identity", (t) => {
  const { repository } = fixture(t);
  const active = ingredient(IDS.first, "Soy Sauce");
  const toArchive = ingredient(IDS.second, "Dark Soy Sauce");
  repository.saveNew(active);
  repository.saveNew(toArchive);
  const inactive = toArchive.archive({
    occurredAt: ARCHIVED_AT,
    actorId: "owner",
    reason: "Historical record."
  });
  repository.saveWithExpectedVersion(inactive, 0);

  assert.deepEqual(
    repository.searchByName("Soy Sauce").map((item) => item.ingredientId.value),
    [IDS.first]
  );
  assert.deepEqual(
    repository.findDuplicateCandidates("Dark Soy Sauce"),
    []
  );
  assert.equal(repository.findById(toArchive.ingredientId)?.status, "Archived");
});

test("search treats wildcard characters as literal candidate text", (t) => {
  const { repository } = fixture(t);
  const percentName = ingredient(IDS.first, "Sauce 100%");
  const ordinary = ingredient(IDS.second, "Sauce 100X");
  repository.saveNew(percentName);
  repository.saveNew(ordinary);
  assert.deepEqual(
    repository.searchByName("100%").map((item) => item.ingredientId.value),
    [IDS.first]
  );
});

test("duplicate candidates are exact-name candidates and never a uniqueness authority", (t) => {
  const { repository } = fixture(t);
  repository.saveNew(ingredient(IDS.first, "Soy Sauce"));
  repository.saveNew(ingredient(IDS.second, "Soy Sauce"));
  repository.saveNew(ingredient(IDS.third, "Dark Soy Sauce"));
  assert.deepEqual(
    repository.findDuplicateCandidates("Soy Sauce").map(
      (item) => item.ingredientId.value
    ),
    [IDS.first, IDS.second]
  );
});

test("hydration fails closed when current name contradicts replayed history", (t) => {
  const { database, repository } = fixture(t);
  const original = ingredient();
  repository.saveNew(original);
  repository.saveWithExpectedVersion(renamed(original), 0);
  database.execute(
    "UPDATE recipe_canonical_ingredients SET name = ? WHERE ingredient_id = ?",
    ["Contradictory Name", IDS.first]
  );
  assert.throws(
    () => repository.findById(original.ingredientId),
    InvalidCanonicalIngredientPersistenceState
  );
});

test("hydration fails closed when transition versions contain a gap", (t) => {
  const { database, repository } = fixture(t);
  const original = ingredient();
  repository.saveNew(original);
  repository.saveWithExpectedVersion(renamed(original), 0);
  database.execute(
    `UPDATE recipe_canonical_ingredient_renames
        SET transition_version = 2
      WHERE ingredient_id = ?`,
    [IDS.first]
  );
  assert.throws(
    () => repository.findById(original.ingredientId),
    InvalidCanonicalIngredientPersistenceState
  );
});

test("hydration fails closed when aggregateVersion contradicts replayed facts", (t) => {
  const { database, repository } = fixture(t);
  const original = ingredient();
  repository.saveNew(original);
  database.execute(
    `UPDATE recipe_canonical_ingredients
        SET aggregate_version = 7
      WHERE ingredient_id = ?`,
    [IDS.first]
  );
  assert.throws(
    () => repository.findById(original.ingredientId),
    InvalidCanonicalIngredientPersistenceState
  );
});

test("hydration fails closed for a non-canonical persisted timestamp", (t) => {
  const { database, repository } = fixture(t);
  const original = ingredient();
  repository.saveNew(original);
  database.execute(
    `UPDATE recipe_canonical_ingredients
        SET created_at = '2026/07/31 01:00:00'
      WHERE ingredient_id = ?`,
    [IDS.first]
  );
  assert.throws(
    () => repository.findById(original.ingredientId),
    InvalidCanonicalIngredientPersistenceState
  );
});

test("hydration rejects contradictory Archive evidence even if storage is corrupted", (t) => {
  const { database, repository } = fixture(t);
  const original = ingredient();
  repository.saveNew(original);
  database.execute("PRAGMA ignore_check_constraints = ON");
  database.execute(
    `UPDATE recipe_canonical_ingredients
        SET status = 'Archived',
            aggregate_version = 1
      WHERE ingredient_id = ?`,
    [IDS.first]
  );
  assert.throws(
    () => repository.findById(original.ingredientId),
    InvalidCanonicalIngredientPersistenceState
  );
});

test("mapper cross-checks complete replayed state rather than trusting rows", () => {
  const original = ingredient();
  const changed = renamed(original);
  const mapped = CanonicalIngredientPersistenceMapper.toRecord(changed);
  assert.equal(mapped.renames[0]?.transitionVersion, 1);
  assert.equal(mapped.ingredient.name, "Taiwan Soy Sauce");
  assert.equal(mapped.ingredient.aggregateVersion, 1);
});
