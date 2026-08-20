import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { BetterSqlite3Adapter } from "../shared/database/better-sqlite3-adapter.js";
import { runMigrations } from "../shared/database/migrate.js";

const migrations = path.resolve("migrations");
const id = "ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const activeId = "ing_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("Migration 018 turns legacy Rename and Archive evidence into the sole lifecycle ledger", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "recipe-018-"));
  const database = new BetterSqlite3Adapter(path.join(directory, "test.sqlite"));
  try {
    database.execute("CREATE TABLE schema_migrations (migration_id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
    database.execute(readFileSync(path.join(migrations, "014_recipe_canonical_ingredients.sql"), "utf8"));
    for (const filename of readdirSync(migrations).filter((name) => name <= "017_recipe_persistence_line_identity_and_publication_uow.sql" && name.endsWith(".sql"))) {
      database.execute("INSERT OR IGNORE INTO schema_migrations VALUES (?, ?)", [filename, "2026-08-19T00:00:00.000Z"]);
    }
    database.execute("INSERT INTO recipe_canonical_ingredients VALUES (?, 'Old pork', 'meat', 'Archived', 2, ?, 'owner', ?, 'archiver', 'retired')", [id, "2026-08-01T00:00:00.000Z", "2026-08-02T00:00:00.000Z"]);
    database.execute("INSERT INTO recipe_canonical_ingredients VALUES (?, 'Fresh pork', 'meat', 'Active', 0, ?, 'owner', NULL, NULL, NULL)", [activeId, "2026-08-01T00:00:00.000Z"]);
    database.execute("INSERT INTO recipe_canonical_ingredient_renames VALUES (?, 1, 'Pork', 'Old pork', ?, 'owner', 'rename')", [id, "2026-08-01T01:00:00.000Z"]);
    assert.deepEqual(runMigrations(database), ["018_canonical_ingredient_lifecycle_events.sql"]);
    assert.deepEqual(database.queryMany<{ event_type: string; aggregate_version: number }>("SELECT event_type, aggregate_version FROM recipe_canonical_ingredient_lifecycle_events WHERE ingredient_id = ? ORDER BY aggregate_version", [id]), [
      { event_type: "RENAMED", aggregate_version: 1 }, { event_type: "ARCHIVED", aggregate_version: 2 }
    ]);
    assert.equal(database.queryOne<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'recipe_canonical_ingredient_renames'")?.name, undefined);
    assert.deepEqual(database.queryOne<{ status: string; aggregate_version: number; archived_at: string | null }>(
      "SELECT status, aggregate_version, archived_at FROM recipe_canonical_ingredients WHERE ingredient_id = ?",
      [activeId]
    ), { status: "Active", aggregate_version: 0, archived_at: null });
    assert.equal(database.queryOne<{ count: number }>(
      "SELECT count(*) AS count FROM recipe_canonical_ingredient_lifecycle_events WHERE ingredient_id = ?",
      [activeId]
    )?.count, 0);
    assert.deepEqual(runMigrations(database), []);
  } finally { database.close(); rmSync(directory, { recursive: true, force: true }); }
});
