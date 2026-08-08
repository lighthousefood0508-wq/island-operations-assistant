import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  DatabaseAdapterUnsafe,
  DatabaseTransactionFailure,
  type DatabaseAdapter,
  type ExecuteResult,
  type SqlParameters
} from "./database-adapter.js";

export class BetterSqlite3Adapter implements DatabaseAdapter {
  private readonly database: Database.Database;
  private unsafe = false;

  get transactionSafety(): "safe" | "unsafe" {
    return this.unsafe ? "unsafe" : "safe";
  }

  constructor(databasePath: string) {
    mkdirSync(path.dirname(databasePath), { recursive: true });
    this.database = new Database(databasePath);
    this.database.pragma("foreign_keys = ON");
    this.database.pragma("journal_mode = WAL");
    this.database.pragma("busy_timeout = 5000");
  }

  execute(sql: string, parameters?: SqlParameters): ExecuteResult {
    this.assertSafe();
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
    this.assertSafe();
    const statement = this.database.prepare(sql);
    return (parameters === undefined
      ? statement.get()
      : Array.isArray(parameters)
        ? statement.get(...parameters)
        : statement.get(parameters)) as T | undefined;
  }

  queryMany<T>(sql: string, parameters?: SqlParameters): T[] {
    this.assertSafe();
    const statement = this.database.prepare(sql);
    return (parameters === undefined
      ? statement.all()
      : Array.isArray(parameters)
        ? statement.all(...parameters)
        : statement.all(parameters)) as T[];
  }

  transaction<T>(work: () => T): T {
    return this.runTransaction("BEGIN", work);
  }

  transactionImmediate<T>(work: () => T): T {
    return this.runTransaction("BEGIN IMMEDIATE", work);
  }

  close(): void {
    this.database.close();
  }

  private assertSafe(): void {
    if (this.unsafe) throw new DatabaseAdapterUnsafe();
  }

  private runTransaction<T>(begin: "BEGIN" | "BEGIN IMMEDIATE", work: () => T): T {
    this.assertSafe();
    this.database.exec(begin);
    let result: T;
    try {
      result = work();
    } catch (operationFailure) {
      const rollbackFailure = this.tryRollback();
      if (rollbackFailure !== null) {
        this.unsafe = true;
        throw new DatabaseTransactionFailure(
          "operation",
          operationFailure,
          rollbackFailure,
          true
        );
      }
      throw operationFailure;
    }

    try {
      this.database.exec("COMMIT");
      return result;
    } catch (commitFailure) {
      const rollbackFailure = this.tryRollback();
      if (rollbackFailure !== null) this.unsafe = true;
      throw new DatabaseTransactionFailure(
        "commit",
        commitFailure,
        rollbackFailure,
        this.unsafe
      );
    }
  }

  private tryRollback(): unknown | null {
    try {
      this.database.exec("ROLLBACK");
      return null;
    } catch (rollbackFailure) {
      return rollbackFailure;
    }
  }
}
