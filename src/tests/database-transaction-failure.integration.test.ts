import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { BetterSqlite3Adapter } from "../shared/database/better-sqlite3-adapter.js";
import { DatabaseAdapterUnsafe, DatabaseTransactionFailure } from "../shared/database/database-adapter.js";

type NativeDatabase = { exec(sql: string): unknown };

function fixture(run: (adapter: BetterSqlite3Adapter, native: NativeDatabase) => void): void {
  const directory = mkdtempSync(path.join(tmpdir(), "database-failure-"));
  const adapter = new BetterSqlite3Adapter(path.join(directory, "test.sqlite"));
  const native = (adapter as unknown as { database: NativeDatabase }).database;
  try {
    adapter.execute("CREATE TABLE evidence (value TEXT NOT NULL)");
    run(adapter, native);
  } finally {
    try { adapter.close(); } finally { rmSync(directory, { recursive: true, force: true }); }
  }
}

test("operation failure remains primary when rollback succeeds", () => fixture((adapter) => {
  const operationFailure = new Error("operation failed");
  assert.throws(
    () => adapter.transactionImmediate(() => {
      adapter.execute("INSERT INTO evidence VALUES ('partial')");
      throw operationFailure;
    }),
    (error: unknown) => error === operationFailure
  );
  assert.equal(adapter.queryOne<{ count: number }>("SELECT count(*) AS count FROM evidence")?.count, 0);
  assert.equal(adapter.transactionSafety, "safe");
}));

test("rollback failure is secondary evidence and marks the adapter unsafe", () => fixture((adapter, native) => {
  const originalExec = native.exec.bind(native);
  native.exec = (sql: string) => {
    if (sql === "ROLLBACK") throw new Error("rollback failed");
    return originalExec(sql);
  };
  const operationFailure = new Error("operation failed");
  assert.throws(
    () => adapter.transactionImmediate(() => { throw operationFailure; }),
    (error: unknown) => error instanceof DatabaseTransactionFailure
      && error.phase === "operation"
      && error.primaryCause === operationFailure
      && error.rollbackFailure instanceof Error
      && error.adapterUnsafe
  );
  assert.equal(adapter.transactionSafety, "unsafe");
  assert.throws(() => adapter.queryMany("SELECT * FROM evidence"), DatabaseAdapterUnsafe);
}));

test("commit failure never returns success and records commit as the primary phase", () => fixture((adapter, native) => {
  const originalExec = native.exec.bind(native);
  let failed = false;
  native.exec = (sql: string) => {
    if (sql === "COMMIT" && !failed) {
      failed = true;
      throw new Error("commit failed");
    }
    return originalExec(sql);
  };
  assert.throws(
    () => adapter.transactionImmediate(() => {
      adapter.execute("INSERT INTO evidence VALUES ('not committed')");
      return "success";
    }),
    (error: unknown) => error instanceof DatabaseTransactionFailure
      && error.phase === "commit"
      && error.rollbackFailure === null
      && !error.adapterUnsafe
  );
  assert.equal(adapter.queryOne<{ count: number }>("SELECT count(*) AS count FROM evidence")?.count, 0);
}));
