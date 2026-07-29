import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  AmbiguousEffectiveIngredientCostQuote,
  CostPersistenceFailure,
  CostPersistenceMapper,
  CostSource,
  CostUnit,
  Currency,
  DuplicateIngredientCostQuote,
  EffectivePeriod,
  ExactDecimal,
  ImmutableIngredientCostQuoteViolation,
  IngredientCostQuote,
  IngredientCostQuoteId,
  IngredientCostQuoteVersionConflict,
  IngredientId,
  InvalidCostPersistenceState,
  InvalidIngredientCostQuote,
  MonetaryAmount,
  SqliteCostRepository,
  type IngredientCostQuoteRow,
  type RecordIngredientCostQuoteInput
} from "../domains/cost/index.js";
import type { DatabaseAdapter } from "../shared/database/database-adapter.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";

const UUIDS = {
  ingredient: "11111111-1111-4111-8111-111111111111",
  otherIngredient: "22222222-2222-4222-8222-222222222222",
  quote1: "33333333-3333-4333-8333-333333333333",
  quote2: "44444444-4444-4444-8444-444444444444",
  quote3: "55555555-5555-4555-8555-555555555555"
} as const;

const T0 = "2026-07-01T00:00:00.000Z";
const BEFORE_T0 = "2026-06-30T23:59:59.999Z";
const T1 = "2026-07-15T00:00:00.000Z";
const BEFORE_T1 = "2026-07-14T23:59:59.999Z";
const T2 = "2026-08-01T00:00:00.000Z";
const BEFORE_T2 = "2026-07-31T23:59:59.999Z";
const T3 = "2026-09-01T00:00:00.000Z";

type Fixture = Readonly<{
  database: DatabaseAdapter;
  repository: SqliteCostRepository;
  databasePath: string;
}>;

function removeDatabaseFiles(databasePath: string): void {
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }
}

function fixture(t: TestContext): Fixture {
  const databasePath = path.resolve("data", `cost-persistence-${randomUUID()}.sqlite`);
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  runMigrations(database);
  t.after(() => {
    database.close();
    removeDatabaseFiles(databasePath);
  });
  return {
    database,
    repository: new SqliteCostRepository(database),
    databasePath
  };
}

function quoteInput(
  overrides: Partial<RecordIngredientCostQuoteInput> = {}
): RecordIngredientCostQuoteInput {
  return {
    quoteId: IngredientCostQuoteId.fromUuid(UUIDS.quote1),
    ingredientId: IngredientId.fromUuid(UUIDS.ingredient),
    monetaryAmount: MonetaryAmount.create("300", 0, Currency.TWD()),
    purchaseQuantity: ExactDecimal.create("5", 0),
    purchaseUnit: CostUnit.create("kg"),
    effectivePeriod: EffectivePeriod.create(T0, T2),
    source: CostSource.create({
      sourceType: "supplier",
      sourceReferenceId: "purchase-line-1",
      supplierId: "supplier-1"
    }),
    recordedAt: T0,
    recordedBy: "owner-1",
    aggregateVersion: 0,
    ...overrides
  };
}

function quote(
  overrides: Partial<RecordIngredientCostQuoteInput> = {}
): IngredientCostQuote {
  return IngredientCostQuote.record(quoteInput(overrides));
}

function replacement(
  quoteId = IngredientCostQuoteId.fromUuid(UUIDS.quote2)
): IngredientCostQuote {
  return quote({
    quoteId,
    monetaryAmount: MonetaryAmount.create("320", 0, Currency.TWD()),
    effectivePeriod: EffectivePeriod.create(T1),
    recordedAt: T1
  });
}

function persistSupersession(
  repository: SqliteCostRepository,
  original: IngredientCostQuote,
  next: IngredientCostQuote,
  supersededAt = T1
): void {
  repository.save(original);
  repository.save(next);
  original.supersedeWith(next, { supersededAt, supersededBy: "owner-2" });
  assert.equal(repository.saveWithExpectedVersion(original, 0), 1);
}

test("migration creates the Cost Quote table and approved indexes", (t) => {
  const { database } = fixture(t);
  const columns = database.queryMany<{ name: string; type: string; notnull: number }>(
    "PRAGMA table_info(cost_ingredient_cost_quotes)"
  );
  assert.ok(columns.some((column) => column.name === "amount_coefficient" && column.type === "INTEGER"));
  assert.ok(columns.some((column) => column.name === "effective_to" && column.notnull === 0));
  assert.equal(columns.some((column) => column.type === "REAL"), false);
  assert.equal(columns.some((column) => column.name.includes("normalized")), false);

  const indexes = database.queryMany<{ name: string }>(
    "PRAGMA index_list(cost_ingredient_cost_quotes)"
  ).map((row) => row.name);
  assert.ok(indexes.includes("cost_ingredient_cost_quotes_ingredient_effective_period"));
  assert.ok(indexes.includes("cost_ingredient_cost_quotes_superseded_at"));
  assert.ok(indexes.includes("cost_ingredient_cost_quotes_superseding_quote"));
});

test("Recorded Quote saves and hydrates every authoritative field", (t) => {
  const { repository } = fixture(t);
  const recorded = quote();
  repository.save(recorded);

  const hydrated = repository.findByQuoteId(recorded.quoteId);
  assert.ok(hydrated);
  assert.deepEqual(
    CostPersistenceMapper.toRecord(hydrated),
    CostPersistenceMapper.toRecord(recorded)
  );
});

test("coefficient INTEGER storage round-trips through text without unsafe Number", (t) => {
  const { database, repository } = fixture(t);
  const maximum = "9223372036854775807";
  const recorded = quote({
    monetaryAmount: MonetaryAmount.create(maximum, 0, Currency.TWD()),
    purchaseQuantity: ExactDecimal.create(maximum, 0)
  });
  repository.save(recorded);

  const storage = database.queryOne<{
    amount_type: string;
    quantity_type: string;
    amount_text: string;
    quantity_text: string;
  }>(
    `SELECT typeof(amount_coefficient) AS amount_type,
            typeof(purchase_quantity_coefficient) AS quantity_type,
            CAST(amount_coefficient AS TEXT) AS amount_text,
            CAST(purchase_quantity_coefficient AS TEXT) AS quantity_text
     FROM cost_ingredient_cost_quotes WHERE quote_id = ?`,
    [recorded.quoteId.value]
  );
  assert.deepEqual(storage, {
    amount_type: "integer",
    quantity_type: "integer",
    amount_text: maximum,
    quantity_text: maximum
  });
  assert.equal(repository.findByQuoteId(recorded.quoteId)?.monetaryAmount.coefficient, maximum);
  assert.equal(repository.findByQuoteId(recorded.quoteId)?.purchaseQuantity.coefficient, maximum);
});

test("minimum allowed zero amount and scales 0 and 6 round-trip exactly", (t) => {
  const { repository } = fixture(t);
  const recorded = quote({
    monetaryAmount: MonetaryAmount.create("0", 0, Currency.TWD()),
    purchaseQuantity: ExactDecimal.create("1", 6)
  });
  repository.save(recorded);
  const hydrated = repository.findByQuoteId(recorded.quoteId);
  assert.equal(hydrated?.monetaryAmount.coefficient, "0");
  assert.equal(hydrated?.monetaryAmount.scale, 0);
  assert.equal(hydrated?.purchaseQuantity.coefficient, "1");
  assert.equal(hydrated?.purchaseQuantity.scale, 6);
});

test("distinct canonical scales and Currency survive persistence", (t) => {
  const { repository } = fixture(t);
  const recorded = quote({
    monetaryAmount: MonetaryAmount.create("12345", 2, Currency.create("USD")),
    purchaseQuantity: ExactDecimal.create("6789", 3)
  });
  repository.save(recorded);
  const hydrated = repository.findByQuoteId(recorded.quoteId);
  assert.equal(hydrated?.monetaryAmount.scale, 2);
  assert.equal(hydrated?.monetaryAmount.currency.code, "USD");
  assert.equal(hydrated?.purchaseQuantity.scale, 3);
});

test("open-ended Effective Period round-trips without a fabricated end", (t) => {
  const { database, repository } = fixture(t);
  const recorded = quote({ effectivePeriod: EffectivePeriod.create(T0) });
  repository.save(recorded);
  assert.equal(repository.findByQuoteId(recorded.quoteId)?.effectivePeriod.effectiveTo, undefined);
  assert.equal(
    database.queryOne<{ effective_to: string | null }>(
      "SELECT effective_to FROM cost_ingredient_cost_quotes WHERE quote_id = ?",
      [recorded.quoteId.value]
    )?.effective_to,
    null
  );
});

test("negative purchase amount remains rejected by Domain before persistence", (t) => {
  const { database } = fixture(t);
  assert.throws(
    () => quote({ monetaryAmount: MonetaryAmount.create("-1", 0, Currency.TWD()) }),
    InvalidIngredientCostQuote
  );
  assert.equal(
    database.queryOne<{ count: number }>(
      "SELECT COUNT(*) AS count FROM cost_ingredient_cost_quotes"
    )?.count,
    0
  );
});

test("findByQuoteId returns found and explicit absence", (t) => {
  const { repository } = fixture(t);
  const recorded = quote();
  repository.save(recorded);
  assert.equal(repository.findByQuoteId(recorded.quoteId)?.quoteId.value, recorded.quoteId.value);
  assert.equal(
    repository.findByQuoteId(IngredientCostQuoteId.fromUuid(UUIDS.quote2)),
    undefined
  );
});

test("findQuotesByIngredientId returns complete history without another Ingredient", (t) => {
  const { repository } = fixture(t);
  const first = quote();
  const second = replacement();
  const other = quote({
    quoteId: IngredientCostQuoteId.fromUuid(UUIDS.quote3),
    ingredientId: IngredientId.fromUuid(UUIDS.otherIngredient)
  });
  repository.save(first);
  repository.save(second);
  repository.save(other);

  const history = repository.findQuotesByIngredientId(first.ingredientId);
  assert.deepEqual(
    new Set(history.map((entry) => entry.quoteId.value)),
    new Set([first.quoteId.value, second.quoteId.value])
  );
  assert.ok(Object.isFrozen(history));
});

test("effectiveFrom is inclusive and the instant before it is excluded", (t) => {
  const { repository } = fixture(t);
  const recorded = quote();
  repository.save(recorded);
  assert.equal(repository.findEffectiveQuoteAt(recorded.ingredientId, T0).status, "found");
  assert.equal(
    repository.findEffectiveQuoteAt(recorded.ingredientId, BEFORE_T0).status,
    "not_found"
  );
});

test("effectiveTo is exclusive while the preceding instant remains effective", (t) => {
  const { repository } = fixture(t);
  const recorded = quote();
  repository.save(recorded);
  assert.equal(
    repository.findEffectiveQuoteAt(recorded.ingredientId, BEFORE_T2).status,
    "found"
  );
  assert.equal(
    repository.findEffectiveQuoteAt(recorded.ingredientId, T2).status,
    "not_found"
  );
});

test("open-ended Quote remains effective and Ingredients do not mix", (t) => {
  const { repository } = fixture(t);
  const recorded = quote({ effectivePeriod: EffectivePeriod.create(T0) });
  repository.save(recorded);
  assert.equal(repository.findEffectiveQuoteAt(recorded.ingredientId, T3).status, "found");
  assert.equal(
    repository.findEffectiveQuoteAt(IngredientId.fromUuid(UUIDS.otherIngredient), T3).status,
    "not_found"
  );
});

test("Supersession round-trips with version and preserves both historical rows", (t) => {
  const { database, repository } = fixture(t);
  const original = quote();
  const next = replacement();
  persistSupersession(repository, original, next);

  const hydrated = repository.findByQuoteId(original.quoteId);
  assert.equal(hydrated?.state, "Superseded");
  assert.equal(hydrated?.aggregateVersion, 1);
  assert.equal(hydrated?.supersession?.supersededAt, T1);
  assert.equal(hydrated?.supersession?.supersededByQuoteId.value, next.quoteId.value);
  assert.equal(
    database.queryOne<{ count: number }>(
      "SELECT COUNT(*) AS count FROM cost_ingredient_cost_quotes"
    )?.count,
    2
  );
  assert.equal(repository.findQuotesByIngredientId(original.ingredientId).length, 2);
});

test("old Quote is effective before supersededAt and excluded at and after it", (t) => {
  const { repository } = fixture(t);
  const original = quote();
  const next = replacement();
  persistSupersession(repository, original, next);

  const before = repository.findEffectiveQuoteAt(original.ingredientId, BEFORE_T1);
  assert.equal(before.status, "found");
  if (before.status === "found") {
    assert.equal(before.quote.quoteId.value, original.quoteId.value);
  }
  const at = repository.findEffectiveQuoteAt(original.ingredientId, T1);
  assert.equal(at.status, "found");
  if (at.status === "found") {
    assert.equal(at.quote.quoteId.value, next.quoteId.value);
  }
  assert.equal(repository.findEffectiveQuoteAt(original.ingredientId, T2).status, "found");
});

test("overlapping effective Quotes report ambiguity without hidden tie-breakers", (t) => {
  const { repository } = fixture(t);
  const first = quote({ recordedAt: T1, aggregateVersion: 0 });
  const second = quote({
    quoteId: IngredientCostQuoteId.fromUuid(UUIDS.quote3),
    recordedAt: T0,
    aggregateVersion: 0
  });
  repository.save(second);
  repository.save(first);

  assert.throws(
    () => repository.findEffectiveQuoteAt(first.ingredientId, T1),
    (error: unknown) => {
      assert.ok(error instanceof AmbiguousEffectiveIngredientCostQuote);
      assert.deepEqual(
        new Set(error.quoteIds),
        new Set([first.quoteId.value, second.quoteId.value])
      );
      return true;
    }
  );
});

test("expectedVersion update atomically appends Supersession and increments version", (t) => {
  const { repository } = fixture(t);
  const original = quote();
  const next = replacement();
  repository.save(original);
  repository.save(next);
  original.supersedeWith(next, { supersededAt: T1, supersededBy: "owner-2" });
  assert.equal(repository.saveWithExpectedVersion(original, 0), 1);
  assert.equal(repository.findByQuoteId(original.quoteId)?.aggregateVersion, 1);
});

test("stale expectedVersion is rejected without overwriting persisted evidence", (t) => {
  const { repository } = fixture(t);
  const original = quote();
  const next = replacement();
  persistSupersession(repository, original, next);
  const before = CostPersistenceMapper.toRecord(repository.findByQuoteId(original.quoteId)!);

  assert.throws(
    () => repository.saveWithExpectedVersion(original, 0),
    IngredientCostQuoteVersionConflict
  );
  assert.deepEqual(
    CostPersistenceMapper.toRecord(repository.findByQuoteId(original.quoteId)!),
    before
  );
});

test("two repository instances allow only one stale writer and exact retry succeeds", (t) => {
  const databasePath = path.resolve("data", `cost-concurrency-${randomUUID()}.sqlite`);
  const databaseA = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  runMigrations(databaseA);
  const databaseB = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  t.after(() => {
    databaseA.close();
    databaseB.close();
    removeDatabaseFiles(databasePath);
  });
  const repositoryA = new SqliteCostRepository(databaseA);
  const repositoryB = new SqliteCostRepository(databaseB);
  const original = quote();
  const nextA = replacement();
  const nextB = replacement(IngredientCostQuoteId.fromUuid(UUIDS.quote3));
  repositoryA.save(original);
  repositoryA.save(nextA);
  repositoryA.save(nextB);

  const writerA = repositoryA.findByQuoteId(original.quoteId)!;
  const writerB = repositoryB.findByQuoteId(original.quoteId)!;
  writerA.supersedeWith(nextA, { supersededAt: T1, supersededBy: "owner-a" });
  writerB.supersedeWith(nextB, { supersededAt: T1, supersededBy: "owner-b" });

  assert.equal(repositoryA.saveWithExpectedVersion(writerA, 0), 1);
  assert.throws(
    () => repositoryB.saveWithExpectedVersion(writerB, 0),
    IngredientCostQuoteVersionConflict
  );
  assert.equal(
    repositoryB.findByQuoteId(original.quoteId)?.supersession?.supersededByQuoteId.value,
    nextA.quoteId.value
  );
  assert.equal(repositoryA.saveWithExpectedVersion(writerA, 1), 1);
});

test("versioned save rejects attempts to rewrite immutable Quote evidence", (t) => {
  const { repository } = fixture(t);
  const original = quote();
  const next = replacement();
  repository.save(original);
  repository.save(next);

  const forged = quote({
    monetaryAmount: MonetaryAmount.create("999", 0, Currency.TWD())
  });
  forged.supersedeWith(next, { supersededAt: T1, supersededBy: "owner" });
  assert.throws(
    () => repository.saveWithExpectedVersion(forged, 0),
    ImmutableIngredientCostQuoteViolation
  );
  assert.equal(repository.findByQuoteId(original.quoteId)?.monetaryAmount.coefficient, "300");
});

test("duplicate Quote identity is mapped to a persistence error", (t) => {
  const { repository } = fixture(t);
  const recorded = quote();
  repository.save(recorded);
  assert.throws(() => repository.save(recorded), DuplicateIngredientCostQuote);
});

test("technical SQLite failures are wrapped without hiding Domain failures", (t) => {
  const databasePath = path.resolve("data", `cost-closed-${randomUUID()}.sqlite`);
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  runMigrations(database);
  const repository = new SqliteCostRepository(database);
  database.close();
  t.after(() => removeDatabaseFiles(databasePath));

  assert.throws(
    () => repository.findByQuoteId(IngredientCostQuoteId.fromUuid(UUIDS.quote1)),
    CostPersistenceFailure
  );
});

test("invalid persisted scale, Currency, period, source, and coefficient fail closed", (t) => {
  const cases: ReadonlyArray<Readonly<{ column: string; value: string | number }>> = [
    { column: "amount_scale", value: 7 },
    { column: "currency_code", value: "bad" },
    { column: "effective_to", value: BEFORE_T0 },
    { column: "source_type", value: "photo" },
    { column: "amount_coefficient", value: "broken" }
  ];

  for (const persistedCase of cases) {
    const { database, repository } = fixture(t);
    const recorded = quote({
      quoteId: IngredientCostQuoteId.fromUuid(randomUUID())
    });
    repository.save(recorded);
    database.execute("PRAGMA ignore_check_constraints = ON");
    database.execute(
      `UPDATE cost_ingredient_cost_quotes SET ${persistedCase.column} = ? WHERE quote_id = ?`,
      [persistedCase.value, recorded.quoteId.value]
    );
    database.execute("PRAGMA ignore_check_constraints = OFF");
    assert.throws(
      () => repository.findByQuoteId(recorded.quoteId),
      InvalidCostPersistenceState,
      persistedCase.column
    );
  }
});

test("missing required persisted field is never defaulted during hydration", () => {
  const row = {
    quote_id: `cost_quote_${UUIDS.quote1}`,
    ingredient_id: `ing_${UUIDS.ingredient}`,
    amount_coefficient: "300",
    amount_scale: 0,
    currency_code: "TWD",
    purchase_quantity_coefficient: "5",
    purchase_quantity_scale: 0,
    unit_code: "kg",
    source_type: "manual",
    source_reference_id: null,
    supplier_id: null,
    effective_from: T0,
    effective_to: null,
    recorded_at: T0,
    recorded_by: undefined,
    superseded_at: null,
    superseded_by_quote_id: null,
    superseded_by_actor: null,
    aggregate_version: 0
  } as unknown as IngredientCostQuoteRow;

  assert.throws(
    () => CostPersistenceMapper.fromRow(row, () => {
      throw new Error("Resolver must not be called.");
    }),
    InvalidCostPersistenceState
  );
});

test("Persistence source contains no float conversion, current time, delete, or current flag", () => {
  const files = [
    "src/domains/cost/persistence/cost-persistence-mapper.ts",
    "src/domains/cost/infrastructure/sqlite-cost-repository.ts",
    "migrations/013_cost_ingredient_cost_quotes.sql"
  ];
  const source = files.map((file) => readFileSync(file, "utf8")).join("\n").toLowerCase();
  for (const forbidden of [
    "parsefloat(",
    "number(",
    "date.now(",
    "current_timestamp",
    " is_current",
    "delete from",
    " real",
    "normalized_unit_cost"
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
