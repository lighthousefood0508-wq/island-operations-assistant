import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../config/runtime.js";
import { createDatabase } from "./database-provider.js";
import type { DatabaseAdapter } from "./database-adapter.js";

const sourceDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../migrations");
const compiledDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../migrations");

function migrationDirectory(): string {
  return existsSync(compiledDirectory) ? compiledDirectory : sourceDirectory;
}

export function runMigrations(database: DatabaseAdapter): string[] {
  database.execute("CREATE TABLE IF NOT EXISTS schema_migrations (migration_id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);");
  const applied = new Set(database.queryMany<{ migration_id: string }>("SELECT migration_id FROM schema_migrations").map((row) => row.migration_id));
  const appliedNow: string[] = [];

  for (const filename of readdirSync(migrationDirectory()).filter((name) => name.endsWith(".sql")).sort()) {
    if (applied.has(filename)) continue;
    const sql = readFileSync(path.join(migrationDirectory(), filename), "utf8");
    database.transaction(() => {
      database.execute(sql);
      database.execute("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (?, ?)", [filename, new Date().toISOString()]);
    });
    appliedNow.push(filename);
  }
  return appliedNow;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const database = createDatabase(loadConfig());
  const migrations = runMigrations(database);
  console.log(migrations.length ? `Applied: ${migrations.join(", ")}` : "Database is up to date.");
  database.close();
}
