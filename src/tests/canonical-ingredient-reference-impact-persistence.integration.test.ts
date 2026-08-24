import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { IngredientId, SqliteCostRepository } from "../domains/cost/index.js";
import { CostPersistenceFailure } from "../domains/cost/persistence/errors.js";
import {
  IngredientReferenceId
} from "../domains/recipe/index.js";
import { SqliteRecipeRepository } from "../domains/recipe/infrastructure/sqlite-recipe-repository.js";
import { InvalidRecipePersistenceState } from "../domains/recipe/persistence/errors.js";
import type {
  DatabaseAdapter,
  ExecuteResult,
  SqlParameters
} from "../shared/database/database-adapter.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";

const INGREDIENT_ID = "ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_INGREDIENT_ID = "ing_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CREATED_AT = "2026-08-01T00:00:00.000Z";

function removeDatabaseFiles(databasePath: string): void {
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }
}

class CountingAdapter implements DatabaseAdapter {
  readonly queries: Array<Readonly<{
    sql: string;
    parameters: SqlParameters | undefined;
  }>> = [];

  constructor(private readonly delegate: DatabaseAdapter) {}

  get transactionSafety(): "safe" | "unsafe" | undefined {
    return this.delegate.transactionSafety;
  }

  execute(sql: string, parameters?: SqlParameters): ExecuteResult {
    return this.delegate.execute(sql, parameters);
  }

  queryOne<T>(sql: string, parameters?: SqlParameters): T | undefined {
    return this.delegate.queryOne<T>(sql, parameters);
  }

  queryMany<T>(sql: string, parameters?: SqlParameters): T[] {
    this.queries.push({ sql, parameters });
    return this.delegate.queryMany<T>(sql, parameters);
  }

  transaction<T>(work: () => T): T {
    return this.delegate.transaction(work);
  }

  transactionImmediate<T>(work: () => T): T {
    return this.delegate.transactionImmediate(work);
  }

  close(): void {
    this.delegate.close();
  }
}

class FailingReadAdapter implements DatabaseAdapter {
  execute(): ExecuteResult {
    return { changes: 0 };
  }

  queryOne<T>(): T | undefined {
    throw new Error("raw queryOne failure");
  }

  queryMany<T>(): T[] {
    throw new Error("raw queryMany failure");
  }

  transaction<T>(work: () => T): T {
    return work();
  }

  transactionImmediate<T>(work: () => T): T {
    return work();
  }

  close(): void {}
}

function fixture(t: TestContext): Readonly<{
  databasePath: string;
  database: DatabaseAdapter;
}> {
  const databasePath = path.resolve(
    "data",
    `canonical-ingredient-reference-impact-${randomUUID()}.sqlite`
  );
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  runMigrations(database);
  t.after(() => {
    database.close();
    removeDatabaseFiles(databasePath);
  });
  seed(database);
  return { databasePath, database };
}

function lineId(value: number): string {
  return `recipe_line_00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
}

function seedIngredient(database: DatabaseAdapter, ingredientId: string): void {
  database.execute(
    `INSERT INTO recipe_canonical_ingredients (
       ingredient_id, name, category_code, status, aggregate_version,
       created_at, created_by, archived_at, archived_by, archive_reason
     ) VALUES (?, ?, 'other', 'Active', 0, ?, 'owner', NULL, NULL, NULL)`,
    [ingredientId, ingredientId === INGREDIENT_ID ? "Soy Sauce" : "Other", CREATED_AT]
  );
}

function insertRecipe(
  database: DatabaseAdapter,
  input: Readonly<{
    recipeId: string;
    familyId: string;
    currentDraftId: string;
    currentVersionId: string;
  }>
): void {
  database.execute(
    `INSERT INTO recipe_recipes (
       recipe_id, recipe_family_id, product_id, current_draft_id,
       current_recipe_version_id, aggregate_version, state
     ) VALUES (?, ?, ?, ?, ?, 1, 'Published')`,
    [
      input.recipeId,
      input.familyId,
      `product_${input.recipeId}`,
      input.currentDraftId,
      input.currentVersionId
    ]
  );
}

function insertDraft(
  database: DatabaseAdapter,
  recipeId: string,
  familyId: string,
  draftId: string,
  state: "Draft" | "Published" | "Superseded"
): void {
  database.execute(
    `INSERT INTO recipe_drafts (
       draft_id, recipe_id, recipe_family_id, name, state,
       product_id, product_version_id, instructions,
       standard_output_coefficient, standard_output_scale,
       standard_output_unit_code, standard_output_dimension,
       standard_yield_coefficient, standard_yield_scale,
       standard_yield_unit_code, standard_yield_dimension,
       created_by, created_at
     ) VALUES (?, ?, ?, 'Fixture Recipe', ?, ?,
       ?, NULL, '1', 0, 'each', 'count',
       '1', 0, 'each', 'count', 'owner', ?)`,
    [
      draftId,
      recipeId,
      familyId,
      state,
      `product_${recipeId}`,
      `product_version_${recipeId}`,
      CREATED_AT
    ]
  );
}

function insertVersion(
  database: DatabaseAdapter,
  recipeId: string,
  familyId: string,
  draftId: string,
  versionId: string,
  versionNumber: number,
  state: "Published" | "Superseded"
): void {
  database.execute(
    `INSERT INTO recipe_versions (
       recipe_version_id, recipe_id, recipe_family_id, source_draft_id,
       version_number, state, name, product_id, product_version_id,
       instructions, standard_output_coefficient, standard_output_scale,
       standard_output_unit_code, standard_output_dimension,
       standard_yield_coefficient, standard_yield_scale,
       standard_yield_unit_code, standard_yield_dimension,
       published_by, published_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'Fixture Recipe', ?,
       ?, NULL, '1', 0, 'each', 'count',
       '1', 0, 'each', 'count', 'owner', ?)`,
    [
      versionId,
      recipeId,
      familyId,
      draftId,
      versionNumber,
      state,
      `product_${recipeId}`,
      `product_version_${recipeId}`,
      CREATED_AT
    ]
  );
}

function insertDraftLine(
  database: DatabaseAdapter,
  draftId: string,
  recipeLineId: string,
  position: number,
  ingredientId: string
): void {
  database.execute(
    `INSERT INTO recipe_draft_lines (
       draft_id, recipe_line_id, position, ingredient_id,
       ingredient_canonical_name, ingredient_measurement_dimension,
       ingredient_status, ingredient_created_at, quantity_coefficient,
       quantity_scale, quantity_unit_code, quantity_dimension, preparation_note
     ) VALUES (?, ?, ?, ?, 'Soy Sauce', 'count', 'active', ?,
       '1', 0, 'each', 'count', NULL)`,
    [draftId, recipeLineId, position, ingredientId, CREATED_AT]
  );
}

function insertVersionLine(
  database: DatabaseAdapter,
  versionId: string,
  recipeLineId: string,
  position: number,
  ingredientId: string
): void {
  database.execute(
    `INSERT INTO recipe_version_lines (
       recipe_version_id, recipe_line_id, position, ingredient_id,
       ingredient_canonical_name, ingredient_measurement_dimension,
       ingredient_status, ingredient_created_at, quantity_coefficient,
       quantity_scale, quantity_unit_code, quantity_dimension, preparation_note
     ) VALUES (?, ?, ?, ?, 'Soy Sauce', 'count', 'active', ?,
       '1', 0, 'each', 'count', NULL)`,
    [versionId, recipeLineId, position, ingredientId, CREATED_AT]
  );
}

function insertQuote(
  database: DatabaseAdapter,
  quoteId: string,
  ingredientId: string,
  supersededByQuoteId?: string
): void {
  database.execute(
    `INSERT INTO cost_ingredient_cost_quotes (
       quote_id, ingredient_id, amount_coefficient, amount_scale,
       currency_code, purchase_quantity_coefficient,
       purchase_quantity_scale, unit_code, source_type,
       source_reference_id, supplier_id, effective_from, effective_to,
       recorded_at, recorded_by, superseded_at,
       superseded_by_quote_id, superseded_by_actor, aggregate_version
     ) VALUES (?, ?, 100, 0, 'TWD', 1, 0, 'each', 'manual', NULL, NULL,
       ?, NULL, ?, 'owner', ?, ?, ?, ?)`,
    [
      quoteId,
      ingredientId,
      CREATED_AT,
      CREATED_AT,
      supersededByQuoteId ? "2026-08-02T00:00:00.000Z" : null,
      supersededByQuoteId ?? null,
      supersededByQuoteId ? "owner" : null,
      supersededByQuoteId ? 1 : 0
    ]
  );
}

function seed(database: DatabaseAdapter): void {
  seedIngredient(database, INGREDIENT_ID);
  seedIngredient(database, OTHER_INGREDIENT_ID);
  database.transaction(() => {
    database.execute("PRAGMA defer_foreign_keys = ON");
    insertRecipe(database, {
      recipeId: "recipe_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      familyId: "recipe_family_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      currentDraftId: "recipe_draft_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      currentVersionId: "recipe_version_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    });
    insertRecipe(database, {
      recipeId: "recipe_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      familyId: "recipe_family_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      currentDraftId: "recipe_draft_cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      currentVersionId: "recipe_version_cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    });
    insertDraft(
      database,
      "recipe_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "recipe_family_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "recipe_draft_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "Published"
    );
    insertDraft(
      database,
      "recipe_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "recipe_family_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "recipe_draft_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "Superseded"
    );
    insertDraft(
      database,
      "recipe_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "recipe_family_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "recipe_draft_cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "Published"
    );
    insertVersion(
      database,
      "recipe_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "recipe_family_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "recipe_draft_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "recipe_version_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      1,
      "Superseded"
    );
    insertVersion(
      database,
      "recipe_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "recipe_family_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "recipe_draft_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "recipe_version_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      2,
      "Published"
    );
    insertVersion(
      database,
      "recipe_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "recipe_family_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "recipe_draft_cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "recipe_version_cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      1,
      "Published"
    );
    insertDraftLine(database, "recipe_draft_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", lineId(1), 0, INGREDIENT_ID);
    insertDraftLine(database, "recipe_draft_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", lineId(2), 1, INGREDIENT_ID);
    insertDraftLine(database, "recipe_draft_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", lineId(3), 0, INGREDIENT_ID);
    insertDraftLine(database, "recipe_draft_cccccccc-cccc-4ccc-8ccc-cccccccccccc", lineId(4), 0, INGREDIENT_ID);
    insertDraftLine(database, "recipe_draft_cccccccc-cccc-4ccc-8ccc-cccccccccccc", lineId(5), 1, OTHER_INGREDIENT_ID);
    insertVersionLine(database, "recipe_version_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", lineId(6), 0, INGREDIENT_ID);
    insertVersionLine(database, "recipe_version_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", lineId(6), 0, INGREDIENT_ID);
    insertVersionLine(database, "recipe_version_cccccccc-cccc-4ccc-8ccc-cccccccccccc", lineId(7), 0, INGREDIENT_ID);
  });
  insertQuote(database, "cost_quote_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", INGREDIENT_ID);
  insertQuote(database, "cost_quote_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", INGREDIENT_ID, "cost_quote_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  insertQuote(database, "cost_quote_cccccccc-cccc-4ccc-8ccc-cccccccccccc", OTHER_INGREDIENT_ID);
}

test("Domain-owned readers preserve exact Recipe and Cost history with four set-based reads", (t) => {
  const { database } = fixture(t);
  const counted = new CountingAdapter(database);
  const recipe = new SqliteRecipeRepository(counted).findIngredientReferences(
    IngredientReferenceId.parse(INGREDIENT_ID)
  );
  const cost = new SqliteCostRepository(counted).findIngredientQuoteReferences(
    IngredientId.parse(INGREDIENT_ID)
  );
  const accepted = new SqliteCostRepository(counted).findIngredientAcceptedPurchaseReferences(
    IngredientId.parse(INGREDIENT_ID)
  );

  assert.equal(counted.queries.length, 4);
  assert.equal(recipe.draftReferences.length, 4);
  assert.deepEqual(
    [...new Set(recipe.draftReferences.map((reference) => reference.recipeId))],
    [
      "recipe_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "recipe_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    ]
  );
  assert.equal(recipe.publishedReferences.length, 3);
  assert.deepEqual(
    recipe.publishedReferences.map((reference) => reference.recipeVersionId),
    [
      "recipe_version_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "recipe_version_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "recipe_version_cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    ]
  );
  assert.deepEqual(cost.quoteIds, [
    "cost_quote_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "cost_quote_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  ]);
  assert.deepEqual(accepted.acceptedPurchaseIds, []);
  assert.equal(counted.queries.some((query) => /cost_purchases|cost_purchase_items/.test(query.sql)), false);

  const plans = counted.queries.map((query) => ({
    sql: query.sql,
    details: database.queryMany<{ detail: string }>(
      `EXPLAIN QUERY PLAN ${query.sql}`,
      query.parameters
    ).map((row) => row.detail)
  }));
  t.diagnostic(`Reference Impact query count: ${counted.queries.length}`);
  t.diagnostic(
    `Reference Impact representative rows: Draft=${recipe.draftReferences.length}, Published=${recipe.publishedReferences.length}, CostQuote=${cost.quoteIds.length}, AcceptedPurchase=${accepted.acceptedPurchaseIds.length}`
  );
  plans.forEach((plan, index) => {
    t.diagnostic(
      `Reference Impact query ${index + 1} SQL: ${plan.sql.replace(/\s+/g, " ").trim()}`
    );
    t.diagnostic(
      `Reference Impact query ${index + 1} plan: ${plan.details.join(" | ")}`
    );
  });
  assert.equal(plans.length, 4);
  assert.equal(
    plans.slice(0, 2).every((plan) =>
      plan.details.some((detail) => /SCAN l/.test(detail))
    ),
    true,
    "Recipe v1 must report its Owner-accepted controlled line-table scans."
  );
  assert.equal(
    plans[2]!.details.some((detail) =>
      /cost_ingredient_cost_quotes_ingredient_effective_period/.test(detail)
    ),
    true,
    "Cost Quote impact must use the existing Ingredient Quote index."
  );
  assert.equal(plans[3]!.details.some((detail) => /cost_accepted_purchase_lines_ingredient_reference/.test(detail)), true);
});

test("Reference Impact survives database close and reopen without schema changes", (t) => {
  const databasePath = path.resolve(
    "data",
    `canonical-ingredient-reference-impact-reopen-${randomUUID()}.sqlite`
  );
  let database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  runMigrations(database);
  seed(database);
  const before = {
    recipe: new SqliteRecipeRepository(database).findIngredientReferences(
      IngredientReferenceId.parse(INGREDIENT_ID)
    ),
    cost: new SqliteCostRepository(database).findIngredientQuoteReferences(
      IngredientId.parse(INGREDIENT_ID)
    )
  };
  database.close();
  database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  t.after(() => {
    database.close();
    removeDatabaseFiles(databasePath);
  });
  const after = {
    recipe: new SqliteRecipeRepository(database).findIngredientReferences(
      IngredientReferenceId.parse(INGREDIENT_ID)
    ),
    cost: new SqliteCostRepository(database).findIngredientQuoteReferences(
      IngredientId.parse(INGREDIENT_ID)
    )
  };
  assert.deepEqual(after, before);
  assert.deepEqual(database.queryMany("PRAGMA foreign_key_check"), []);
  assert.equal(
    database.queryOne<{ count: number }>(
      "SELECT COUNT(*) AS count FROM schema_migrations"
    )?.count,
    22
  );
});

test("Cost Snapshot reference read authority is deterministic and Cost-owned", (t) => {
  const { database } = fixture(t);
  database.execute("INSERT INTO cost_recipe_snapshots VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", ["cost_snapshot_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "recipe_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "recipe_version_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "VAL-2", "NONE_EXACT", CREATED_AT, CREATED_AT, "owner", "TWD", "1", "1", "1", "1", "{}"]);
  database.execute("INSERT INTO cost_recipe_snapshot_lines VALUES (?,?,?,?,?,?,?,?,?)", ["cost_snapshot_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", 0, INGREDIENT_ID, "QuoteFallback", "cost_quote_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "1", "1", "{}", "{}"]);
  const snapshots = new SqliteCostRepository(database).findIngredientCostSnapshotReferences(IngredientId.parse(INGREDIENT_ID));
  assert.deepEqual(snapshots, { contractName: "CostSnapshotReferenceImpact", contractVersion: 1, costSnapshotIds: ["cost_snapshot_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"] });
});

test("Domain readers preserve typed technical failures", () => {
  const failing = new FailingReadAdapter();
  assert.throws(
    () => new SqliteRecipeRepository(failing).findIngredientReferences(
      IngredientReferenceId.parse(INGREDIENT_ID)
    ),
    InvalidRecipePersistenceState
  );
  assert.throws(
    () => new SqliteCostRepository(failing).findIngredientQuoteReferences(
      IngredientId.parse(INGREDIENT_ID)
    ),
    CostPersistenceFailure
  );
});
