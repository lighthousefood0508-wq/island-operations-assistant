import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  CostSupplier,
  SqliteCostSupplierRepository,
  SupplierId
} from "../domains/cost/index.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";

function removeDatabaseFiles(databasePath: string): void {
  for (const suffix of ["", "-shm", "-wal"]) rmSync(`${databasePath}${suffix}`, { force: true });
}

function supplier(uuid: string, displayName = "Northern Ingredients"): CostSupplier {
  return CostSupplier.create({
    supplierId: SupplierId.fromUuid(uuid),
    displayName,
    createdAt: "2026-08-22T00:00:00.000Z",
    createdBy: "owner"
  });
}

function fixture(t: TestContext) {
  const databasePath = path.resolve("data", `cost-supplier-${randomUUID()}.sqlite`);
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  runMigrations(database);
  t.after(() => {
    database.close();
    removeDatabaseFiles(databasePath);
  });
  return { database, repository: new SqliteCostSupplierRepository(database), databasePath };
}

test("Migration 019 creates only the minimal Cost Supplier identity table", (t) => {
  const { database } = fixture(t);
  const columns = database.queryMany<{ name: string; type: string }>("PRAGMA table_info(cost_suppliers)");
  assert.deepEqual(columns.map((column) => column.name), [
    "supplier_id", "display_name", "created_at", "created_by", "aggregate_version"
  ]);
  assert.equal(columns.some((column) => column.type === "REAL"), false);
  assert.equal(database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM sqlite_master WHERE name IN ('accepted_purchases', 'cost_snapshots')")?.count, 0);
});

test("Supplier persistence survives lookup and deterministic identity ordering without legacy purchase access", (t) => {
  const { database, repository } = fixture(t);
  const later = supplier("22222222-2222-4222-8222-222222222222", "Later Supplier");
  const first = supplier("11111111-1111-4111-8111-111111111111", "First Supplier");
  repository.saveNew(later);
  repository.saveNew(first);

  assert.deepEqual(repository.findById(first.supplierId)?.toContract(), first.toContract());
  assert.deepEqual(repository.list().map((entry) => entry.supplierId.value), [
    first.supplierId.value,
    later.supplierId.value
  ]);
  assert.equal(database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM cost_purchases")?.count, 0);
  assert.deepEqual(database.queryMany("PRAGMA foreign_key_check"), []);
});

test("Supplier persistence is insert-only and does not reinterpret duplicate names", (t) => {
  const { repository } = fixture(t);
  const first = supplier("11111111-1111-4111-8111-111111111111", "Northern Ingredients");
  const equalName = supplier("22222222-2222-4222-8222-222222222222", "Northern Ingredients");
  repository.saveNew(first);
  repository.saveNew(equalName);
  assert.equal(repository.list().length, 2);
  assert.throws(() => repository.saveNew(first));
});
