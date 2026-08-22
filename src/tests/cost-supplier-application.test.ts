import assert from "node:assert/strict";
import test from "node:test";
import {
  CostSupplier,
  CostSupplierPersistenceFailure,
  CostSupplierService,
  CostSupplierValidationFailure,
  SupplierId
} from "../domains/cost/index.js";

class RepositoryFixture {
  readonly saved: CostSupplier[] = [];
  failure: unknown = undefined;

  saveNew(supplier: CostSupplier): void {
    if (this.failure !== undefined) throw this.failure;
    this.saved.push(supplier);
  }

  list(): readonly CostSupplier[] {
    if (this.failure !== undefined) throw this.failure;
    return Object.freeze([...this.saved]);
  }
}

function command(overrides: Partial<{
  displayName: string;
  occurredAt: string;
  actor: string;
}> = {}) {
  return {
    displayName: "Northern Ingredients",
    occurredAt: "2026-08-22T00:00:00.000Z",
    actor: "owner",
    ...overrides
  };
}

test("Cost Supplier Service owns identity generation, Aggregate construction, and deterministic read contracts", () => {
  const repository = new RepositoryFixture();
  const service = new CostSupplierService(repository);

  const first = service.create(command());
  const second = service.create(command({ displayName: "Northern Ingredients" }));

  assert.match(first.supplierId, /^sup_[0-9a-f-]{36}$/);
  assert.notEqual(first.supplierId, second.supplierId);
  assert.equal(first.aggregateVersion, 0);
  assert.equal(repository.saved.length, 2);
  repository.saved.reverse();
  assert.deepEqual(
    service.list().map((supplier) => supplier.supplierId),
    [first.supplierId, second.supplierId].sort()
  );
});

test("Cost Supplier Service validates all command fields before writing", () => {
  for (const invalid of [
    command({ displayName: "" }),
    command({ actor: " " }),
    command({ occurredAt: "2026-08-22T00:00:00Z" })
  ]) {
    const repository = new RepositoryFixture();
    const service = new CostSupplierService(repository);
    assert.throws(() => service.create(invalid), CostSupplierValidationFailure);
    assert.equal(repository.saved.length, 0);
  }
});

test("Cost Supplier Service maps write and read technical failures through one safe typed boundary", () => {
  const repository = new RepositoryFixture();
  repository.failure = new Error("SQLITE_CONSTRAINT: cost_suppliers internal detail");
  const service = new CostSupplierService(repository);

  for (const operation of [() => service.create(command()), () => service.list()]) {
    let caught: unknown;
    try { operation(); } catch (error) { caught = error; }
    assert.ok(caught instanceof CostSupplierPersistenceFailure);
    assert.equal(caught.code, "COST_SUPPLIER_PERSISTENCE_FAILURE");
    assert.doesNotMatch(caught.message, /SQLITE|table|internal|cause|stack/i);
  }
  assert.equal(repository.saved.length, 0);
});

test("Application Service has no hidden Supplier lifecycle or identity-resolution input", () => {
  const service = new CostSupplierService(new RepositoryFixture());
  const created = service.create(command());
  assert.equal("status" in created, false);
  assert.equal("aliases" in created, false);
  assert.throws(() => SupplierId.parse("vendor-name"));
});
