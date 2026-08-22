import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { BetterSqlite3Adapter } from "../shared/database/better-sqlite3-adapter.js";
import { runMigrations } from "../shared/database/migrate.js";

const migrationDirectory = path.resolve("migrations");
const through016 = readdirSync(migrationDirectory).filter((name) => name.endsWith(".sql") && name <= "016_recipe_recipes.sql").sort();
const recipeId = "recipe_10000000-0000-4000-8000-000000000001";
const draftId = "recipe_draft_20000000-0000-4000-8000-000000000001";
const versionId = "recipe_version_30000000-0000-4000-8000-000000000001";
const ingredientId = "ing_40000000-0000-4000-8000-000000000001";

function withDatabase(run: (database: BetterSqlite3Adapter, databasePath: string) => void): void {
  const directory = mkdtempSync(path.join(tmpdir(), "recipe-017-"));
  const databasePath = path.join(directory, "test.sqlite");
  const database = new BetterSqlite3Adapter(databasePath);
  try { run(database, databasePath); } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function migrateThrough016(database: BetterSqlite3Adapter): void {
  database.execute("CREATE TABLE schema_migrations (migration_id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (const filename of through016) database.transaction(() => {
    database.execute(readFileSync(path.join(migrationDirectory, filename), "utf8"));
    database.execute("INSERT INTO schema_migrations VALUES (?, ?)", [filename, "2026-08-08T00:00:00.000Z"]);
  });
}

function seedLegacy(database: BetterSqlite3Adapter, mismatchedVersion = false): void {
  database.transaction(() => {
    database.execute("INSERT INTO recipe_canonical_ingredients (ingredient_id, name, category_code, status, aggregate_version, created_at, created_by) VALUES (?, 'Pork', 'meat', 'Active', 0, ?, 'owner')", [ingredientId, "2026-08-08T00:00:00.000Z"]);
    database.execute("INSERT INTO recipe_recipes VALUES (?, ?, NULL, 2, 'Published')", [recipeId, draftId]);
    database.execute("INSERT INTO recipe_drafts VALUES (?, ?, 'Pork', 'Published', 'product_1', 'product_version_1', '100', 0, 'g', 'mass', '1', 0, 'each', 'count', 'owner', ?)", [draftId, recipeId, "2026-08-08T00:00:00.000Z"]);
    database.execute("INSERT INTO recipe_draft_lines VALUES (?, 0, ?, 'Pork', 'mass', 'active', ?, '100', 0, 'g', 'mass')", [draftId, ingredientId, "2026-08-08T00:00:00.000Z"]);
    database.execute("INSERT INTO recipe_versions VALUES (?, ?, ?, 1, 'Pork', 'product_1', 'product_version_1', '100', 0, 'g', 'mass', '1', 0, 'each', 'count', 'owner', ?)", [versionId, recipeId, draftId, "2026-08-08T01:00:00.000Z"]);
    database.execute("INSERT INTO recipe_version_lines VALUES (?, 0, ?, 'Pork', 'mass', 'active', ?, ?, 0, 'g', 'mass')", [versionId, ingredientId, "2026-08-08T00:00:00.000Z", mismatchedVersion ? "101" : "100"]);
    database.execute("INSERT INTO recipe_publish_audits VALUES ('publish_1', ?, ?, ?, 1, 'owner', ?)", [recipeId, draftId, versionId, "2026-08-08T01:00:00.000Z"]);
    database.execute("UPDATE recipe_recipes SET current_recipe_version_id = ? WHERE recipe_id = ?", [versionId, recipeId]);
  });
}

test("Migration 017 deterministically backfills Family and shared Draft/Version Line identity", () => withDatabase((database) => {
  migrateThrough016(database);
  seedLegacy(database);
  assert.deepEqual(runMigrations(database), [
    "017_recipe_persistence_line_identity_and_publication_uow.sql",
    "018_canonical_ingredient_lifecycle_events.sql",
    "019_cost_suppliers.sql",
    "020_cost_purchases.sql"
  ]);
  const draftLine = database.queryOne<{ recipe_line_id: string }>("SELECT recipe_line_id FROM recipe_draft_lines WHERE draft_id = ?", [draftId])!;
  const versionLine = database.queryOne<{ recipe_line_id: string }>("SELECT recipe_line_id FROM recipe_version_lines WHERE recipe_version_id = ?", [versionId])!;
  assert.equal(draftLine.recipe_line_id, "recipe_line_ae596fda-45ea-5523-bc4d-6d63a7e97dfd");
  assert.equal(versionLine.recipe_line_id, draftLine.recipe_line_id);
  assert.equal(database.queryOne<{ recipe_family_id: string }>("SELECT recipe_family_id FROM recipe_recipes WHERE recipe_id = ?", [recipeId])?.recipe_family_id, "recipe_family_10000000-0000-4000-8000-000000000001");
  assert.deepEqual(database.queryMany("PRAGMA foreign_key_check"), []);
  assert.equal(database.queryOne<{ integrity_check: string }>("PRAGMA integrity_check")?.integrity_check, "ok");
  assert.deepEqual(runMigrations(database), []);
}));

test("Migration 017 fails closed and leaves Migration 016 data intact when Published evidence is ambiguous", () => withDatabase((database) => {
  migrateThrough016(database);
  seedLegacy(database, true);
  assert.throws(() => runMigrations(database), /ambiguous Line evidence/);
  assert.equal(database.queryOne<{ count: number }>("SELECT count(*) AS count FROM schema_migrations WHERE migration_id LIKE '017_%'")?.count, 0);
  assert.equal(database.queryOne<{ quantity_coefficient: string }>("SELECT quantity_coefficient FROM recipe_version_lines WHERE recipe_version_id = ?", [versionId])?.quantity_coefficient, "101");
  assert.equal(database.queryOne<{ count: number }>("SELECT count(*) AS count FROM sqlite_master WHERE name LIKE 'recipe_%_017'")?.count, 0);
}));
