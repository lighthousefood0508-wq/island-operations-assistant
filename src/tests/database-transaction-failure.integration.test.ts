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

function evidenceValues(adapter: BetterSqlite3Adapter): string[] {
  return adapter
    .queryMany<{ value: string }>("SELECT value FROM evidence ORDER BY rowid")
    .map(({ value }) => value);
}

function captureCommands(native: NativeDatabase): string[] {
  const commands: string[] = [];
  const originalExec = native.exec.bind(native);
  native.exec = (sql: string) => {
    commands.push(sql);
    return originalExec(sql);
  };
  return commands;
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

test("outer transaction methods preserve their method-specific lock commands", () => fixture((adapter, native) => {
  const commands = captureCommands(native);
  adapter.transaction(() => adapter.execute("INSERT INTO evidence VALUES ('deferred')"));
  adapter.transactionImmediate(() => adapter.execute("INSERT INTO evidence VALUES ('immediate')"));

  assert.deepEqual(commands.filter((sql) => /^(?:BEGIN|BEGIN IMMEDIATE|COMMIT)$/.test(sql)), [
    "BEGIN",
    "COMMIT",
    "BEGIN IMMEDIATE",
    "COMMIT"
  ]);
  assert.deepEqual(evidenceValues(adapter), ["deferred", "immediate"]);
}));

test("nested immediate success uses a savepoint and commits with its deferred outer transaction", () => fixture((adapter, native) => {
  const commands = captureCommands(native);
  adapter.transaction(() => {
    adapter.execute("INSERT INTO evidence VALUES ('outer')");
    adapter.transactionImmediate(() => adapter.execute("INSERT INTO evidence VALUES ('inner')"));
  });

  const savepoint = commands.find((sql) => sql.startsWith("SAVEPOINT "));
  assert.ok(savepoint);
  const identity = savepoint.slice("SAVEPOINT ".length);
  assert.deepEqual(commands.filter((sql) => sql.startsWith("BEGIN")), ["BEGIN"]);
  assert.ok(commands.includes(`RELEASE ${identity}`));
  assert.deepEqual(evidenceValues(adapter), ["outer", "inner"]);
}));

test("caught nested callback failure rolls back only its savepoint and lets the outer transaction continue", () => fixture((adapter, native) => {
  const commands = captureCommands(native);
  const operationFailure = new Error("nested operation failed");

  adapter.transaction(() => {
    adapter.execute("INSERT INTO evidence VALUES ('before')");
    assert.throws(
      () => adapter.transactionImmediate(() => {
        adapter.execute("INSERT INTO evidence VALUES ('nested partial')");
        throw operationFailure;
      }),
      (error: unknown) => error === operationFailure
    );
    adapter.execute("INSERT INTO evidence VALUES ('after')");
  });

  const savepoint = commands.find((sql) => sql.startsWith("SAVEPOINT "));
  assert.ok(savepoint);
  const identity = savepoint.slice("SAVEPOINT ".length);
  assert.ok(commands.includes(`ROLLBACK TO ${identity}`));
  assert.ok(commands.includes(`RELEASE ${identity}`));
  assert.deepEqual(evidenceValues(adapter), ["before", "after"]);
  assert.equal(adapter.transactionSafety, "safe");
}));

test("uncaught nested callback failure rolls back the outer transaction", () => fixture((adapter) => {
  const operationFailure = new Error("uncaught nested failure");
  assert.throws(
    () => adapter.transactionImmediate(() => {
      adapter.execute("INSERT INTO evidence VALUES ('outer partial')");
      adapter.transaction(() => {
        adapter.execute("INSERT INTO evidence VALUES ('inner partial')");
        throw operationFailure;
      });
    }),
    (error: unknown) => error === operationFailure
  );
  assert.deepEqual(evidenceValues(adapter), []);
  assert.equal(adapter.transactionSafety, "safe");
}));

test("outer rollback reverses writes released from a successful nested savepoint", () => fixture((adapter) => {
  const outerFailure = new Error("outer failed");
  assert.throws(
    () => adapter.transactionImmediate(() => {
      adapter.transaction(() => adapter.execute("INSERT INTO evidence VALUES ('released inner')"));
      throw outerFailure;
    }),
    (error: unknown) => error === outerFailure
  );
  assert.deepEqual(evidenceValues(adapter), []);
}));

test("sequential nested transactions use distinct savepoint identities", () => fixture((adapter, native) => {
  const commands = captureCommands(native);
  adapter.transaction(() => {
    adapter.transaction(() => adapter.execute("INSERT INTO evidence VALUES ('first')"));
    adapter.transaction(() => adapter.execute("INSERT INTO evidence VALUES ('second')"));
  });

  const identities = commands
    .filter((sql) => sql.startsWith("SAVEPOINT "))
    .map((sql) => sql.slice("SAVEPOINT ".length));
  assert.equal(identities.length, 2);
  assert.notEqual(identities[0], identities[1]);
  assert.deepEqual(evidenceValues(adapter), ["first", "second"]);
}));

test("multiple active nesting levels use distinct savepoint identities without nested BEGIN", () => fixture((adapter, native) => {
  const commands = captureCommands(native);
  adapter.transactionImmediate(() => {
    adapter.transaction(() => {
      adapter.transactionImmediate(() => adapter.execute("INSERT INTO evidence VALUES ('deep')"));
    });
  });

  const identities = commands
    .filter((sql) => sql.startsWith("SAVEPOINT "))
    .map((sql) => sql.slice("SAVEPOINT ".length));
  assert.equal(new Set(identities).size, 2);
  assert.deepEqual(commands.filter((sql) => sql.startsWith("BEGIN")), ["BEGIN IMMEDIATE"]);
  assert.deepEqual(evidenceValues(adapter), ["deep"]);
}));

test("nested callback plus ROLLBACK TO failure preserves both failures and marks unsafe", () => fixture((adapter, native) => {
  const originalExec = native.exec.bind(native);
  const operationFailure = new Error("nested callback failed");
  const rollbackToFailure = new Error("rollback to failed");
  native.exec = (sql: string) => {
    if (sql.startsWith("ROLLBACK TO ")) throw rollbackToFailure;
    return originalExec(sql);
  };

  assert.throws(
    () => adapter.transaction(() => {
      adapter.transactionImmediate(() => { throw operationFailure; });
    }),
    (error: unknown) => error instanceof DatabaseTransactionFailure
      && error.phase === "operation"
      && error.primaryCause === operationFailure
      && error.rollbackFailure === rollbackToFailure
      && error.adapterUnsafe
  );
  assert.equal(adapter.transactionSafety, "unsafe");
}));

test("nested callback plus final RELEASE failure preserves callback as primary evidence", () => fixture((adapter, native) => {
  const originalExec = native.exec.bind(native);
  const operationFailure = new Error("nested callback failed");
  const releaseFailure = new Error("final release failed");
  let rolledBackToSavepoint = false;
  native.exec = (sql: string) => {
    if (sql.startsWith("ROLLBACK TO ")) rolledBackToSavepoint = true;
    if (rolledBackToSavepoint && sql.startsWith("RELEASE ")) throw releaseFailure;
    return originalExec(sql);
  };

  assert.throws(
    () => adapter.transactionImmediate(() => {
      adapter.transaction(() => { throw operationFailure; });
    }),
    (error: unknown) => error instanceof DatabaseTransactionFailure
      && error.phase === "operation"
      && error.primaryCause === operationFailure
      && error.rollbackFailure === releaseFailure
      && error.adapterUnsafe
  );
  assert.equal(adapter.transactionSafety, "unsafe");
}));

test("nested success plus RELEASE failure is a commit failure and clean cleanup keeps the adapter safe", () => fixture((adapter, native) => {
  const originalExec = native.exec.bind(native);
  const releaseFailure = new Error("nested release failed");
  let failed = false;
  native.exec = (sql: string) => {
    if (sql.startsWith("RELEASE ") && !failed) {
      failed = true;
      throw releaseFailure;
    }
    return originalExec(sql);
  };

  assert.throws(
    () => adapter.transaction(() => {
      adapter.transactionImmediate(() => adapter.execute("INSERT INTO evidence VALUES ('nested')"));
    }),
    (error: unknown) => error instanceof DatabaseTransactionFailure
      && error.phase === "commit"
      && error.primaryCause === releaseFailure
      && error.rollbackFailure === null
      && !error.adapterUnsafe
  );
  assert.equal(adapter.transactionSafety, "safe");
  assert.deepEqual(evidenceValues(adapter), []);
}));

test("outer rollback failure retains a nested cleanup failure as its primary evidence", () => fixture((adapter, native) => {
  const originalExec = native.exec.bind(native);
  const operationFailure = new Error("nested callback failed");
  const nestedCleanupFailure = new Error("nested rollback to failed");
  const outerRollbackFailure = new Error("outer rollback failed");
  native.exec = (sql: string) => {
    if (sql.startsWith("ROLLBACK TO ")) throw nestedCleanupFailure;
    if (sql === "ROLLBACK") throw outerRollbackFailure;
    return originalExec(sql);
  };

  assert.throws(
    () => adapter.transactionImmediate(() => {
      adapter.transaction(() => { throw operationFailure; });
    }),
    (error: unknown) => error instanceof DatabaseTransactionFailure
      && error.phase === "operation"
      && error.rollbackFailure === outerRollbackFailure
      && error.adapterUnsafe
      && error.primaryCause instanceof DatabaseTransactionFailure
      && error.primaryCause.phase === "operation"
      && error.primaryCause.primaryCause === operationFailure
      && error.primaryCause.rollbackFailure === nestedCleanupFailure
      && error.primaryCause.adapterUnsafe
  );
  assert.equal(adapter.transactionSafety, "unsafe");
}));

test("catching an unclean nested failure cannot let the outer transaction report success", () => fixture((adapter, native) => {
  const originalExec = native.exec.bind(native);
  const operationFailure = new Error("nested callback failed");
  const cleanupFailure = new Error("nested cleanup failed");
  native.exec = (sql: string) => {
    if (sql.startsWith("ROLLBACK TO ")) throw cleanupFailure;
    return originalExec(sql);
  };

  assert.throws(
    () => adapter.transaction(() => {
      try {
        adapter.transactionImmediate(() => {
          adapter.execute("INSERT INTO evidence VALUES ('unclean')");
          throw operationFailure;
        });
      } catch (error) {
        assert.ok(error instanceof DatabaseTransactionFailure);
        assert.equal(error.primaryCause, operationFailure);
        assert.equal(error.rollbackFailure, cleanupFailure);
      }
      return "must not commit";
    }),
    (error: unknown) => error instanceof DatabaseTransactionFailure
      && error.phase === "commit"
      && error.primaryCause instanceof DatabaseAdapterUnsafe
      && error.rollbackFailure === null
      && error.adapterUnsafe
  );
  assert.equal(adapter.transactionSafety, "unsafe");
}));
