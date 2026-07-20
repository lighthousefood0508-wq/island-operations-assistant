import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";
import { loadConfig } from "../app/config.js";
import { openDatabase } from "./client.js";

const sourceDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../migrations");
const compiledDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../migrations");

function migrationDirectory(): string {
  return existsSync(compiledDirectory) ? compiledDirectory : sourceDirectory;
}

export function runMigrations(database: DatabaseSync): string[] {
  database.exec("CREATE TABLE IF NOT EXISTS schema_migrations (migration_id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);");
  const applied = new Set(
    database.prepare("SELECT migration_id FROM schema_migrations").all().map((row) => String(row.migration_id))
  );
  const appliedNow: string[] = [];

  for (const filename of readdirSync(migrationDirectory()).filter((name) => name.endsWith(".sql")).sort()) {
    if (applied.has(filename)) continue;
    const sql = readFileSync(path.join(migrationDirectory(), filename), "utf8");
    database.exec("BEGIN");
    try {
      database.exec(sql);
      database.prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (?, ?)")
        .run(filename, new Date().toISOString());
      database.exec("COMMIT");
      appliedNow.push(filename);
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
  return appliedNow;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const database = openDatabase(loadConfig().databasePath);
  const migrations = runMigrations(database);
  console.log(migrations.length ? `Applied: ${migrations.join(", ")}` : "Database is up to date.");
  database.close();
}
