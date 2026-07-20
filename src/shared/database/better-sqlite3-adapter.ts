import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { DatabaseAdapter, ExecuteResult, SqlParameters } from "./database-adapter.js";

export class BetterSqlite3Adapter implements DatabaseAdapter {
  private readonly database: Database.Database;

  constructor(databasePath: string) {
    mkdirSync(path.dirname(databasePath), { recursive: true });
    this.database = new Database(databasePath);
    this.database.pragma("foreign_keys = ON");
    this.database.pragma("journal_mode = WAL");
    this.database.pragma("busy_timeout = 5000");
  }

  execute(sql: string, parameters?: SqlParameters): ExecuteResult {
    if (parameters === undefined) {
      this.database.exec(sql);
      return { changes: 0 };
    }
    const result = Array.isArray(parameters)
      ? this.database.prepare(sql).run(...parameters)
      : this.database.prepare(sql).run(parameters);
    return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  }

  queryOne<T>(sql: string, parameters?: SqlParameters): T | undefined {
    const statement = this.database.prepare(sql);
    return (parameters === undefined
      ? statement.get()
      : Array.isArray(parameters)
        ? statement.get(...parameters)
        : statement.get(parameters)) as T | undefined;
  }

  queryMany<T>(sql: string, parameters?: SqlParameters): T[] {
    const statement = this.database.prepare(sql);
    return (parameters === undefined
      ? statement.all()
      : Array.isArray(parameters)
        ? statement.all(...parameters)
        : statement.all(parameters)) as T[];
  }

  transaction<T>(work: () => T): T {
    return this.database.transaction(work)();
  }

  close(): void {
    this.database.close();
  }
}
