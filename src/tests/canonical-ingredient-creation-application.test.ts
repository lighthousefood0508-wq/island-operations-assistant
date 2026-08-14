import assert from "node:assert/strict";
import test from "node:test";
import {
  CanonicalIngredientCreationPersistenceFailure,
  CanonicalIngredientCreationService,
  CanonicalIngredientCreationValidationFailure
} from "../domains/recipe/index.js";
import type { CanonicalIngredient } from "../domains/recipe/ingredient-catalog/canonical-ingredient.js";

class RepositoryFixture {
  readonly saved: CanonicalIngredient[] = [];
  failure: unknown = undefined;

  saveNew(ingredient: CanonicalIngredient): void {
    if (this.failure !== undefined) throw this.failure;
    this.saved.push(ingredient);
  }
}

function command(overrides: Partial<{
  name: string;
  categoryCode: string;
  actor: string;
  occurredAt: string;
}> = {}) {
  return {
    name: "Soy sauce",
    categoryCode: "sauce",
    actor: "owner",
    occurredAt: "2026-08-14T01:00:00.000Z",
    ...overrides
  };
}

test("Creation Service creates one Active immutable Canonical Ingredient", () => {
  const repository = new RepositoryFixture();
  const service = new CanonicalIngredientCreationService(repository);

  const result = service.create(command());

  assert.match(result.ingredientId, /^ing_[0-9a-f-]{36}$/);
  assert.equal(result.name, "Soy sauce");
  assert.equal(result.categoryCode, "sauce");
  assert.equal(result.status, "Active");
  assert.equal(result.aggregateVersion, 0);
  assert.equal(result.createdAt, "2026-08-14T01:00:00.000Z");
  assert.equal(result.createdBy, "owner");
  assert.equal(repository.saved.length, 1);
  assert.equal(repository.saved[0]?.toContract().ingredientId, result.ingredientId);
});

test("Creation Service validates every command field before writing", () => {
  for (const invalid of [
    command({ name: "   " }),
    command({ categoryCode: "not-approved" }),
    command({ actor: "" }),
    command({ occurredAt: "2026-08-14T01:00:00Z" })
  ]) {
    const repository = new RepositoryFixture();
    const service = new CanonicalIngredientCreationService(repository);
    assert.throws(
      () => service.create(invalid),
      CanonicalIngredientCreationValidationFailure
    );
    assert.equal(repository.saved.length, 0);
  }
});

test("Creation Service permits equal and normalized duplicate names without identity resolution", () => {
  const repository = new RepositoryFixture();
  const service = new CanonicalIngredientCreationService(repository);

  const first = service.create(command({ name: "  Soy sauce  " }));
  const second = service.create(command({ name: "Soy sauce" }));

  assert.equal(first.name, "Soy sauce");
  assert.equal(second.name, "Soy sauce");
  assert.notEqual(first.ingredientId, second.ingredientId);
  assert.equal(repository.saved.length, 2);
});

test("Creation Service converts recognized and unexpected persistence failures to one safe boundary", () => {
  for (const failure of [
    new Error("SQLITE_CONSTRAINT: private implementation detail"),
    { cause: "private repository cause", stack: "private stack" }
  ]) {
    const repository = new RepositoryFixture();
    repository.failure = failure;
    const service = new CanonicalIngredientCreationService(repository);

    let error: unknown;
    try {
      service.create(command());
      assert.fail("Expected Creation Service to fail.");
    } catch (caught) {
      error = caught;
    }
    assert.ok(error instanceof CanonicalIngredientCreationPersistenceFailure);
    assert.equal(error.code, "CANONICAL_INGREDIENT_CREATION_PERSISTENCE_FAILURE");
    assert.doesNotMatch(error.message, /SQLITE|private|stack|cause/i);
    assert.equal("cause" in error, false);
  }
});
