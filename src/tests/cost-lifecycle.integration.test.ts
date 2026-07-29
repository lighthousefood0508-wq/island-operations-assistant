import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  CostPersistenceFailure,
  CostQuoteLifecycleService,
  CostSource,
  CostUnit,
  Currency,
  EffectivePeriod,
  ExactDecimal,
  IngredientCostQuoteId,
  IngredientCostQuoteAlreadySuperseded,
  IngredientCostQuoteRetryConflict,
  IngredientCostQuoteVersionConflict,
  IngredientId,
  MonetaryAmount,
  SqliteCostQuoteUnitOfWork,
  SqliteCostRepository,
  type CostQuoteUnitOfWork,
  type CostRepository,
  type RecordInitialIngredientCostQuoteCommand
} from "../domains/cost/index.js";
import type { DatabaseAdapter } from "../shared/database/database-adapter.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";

const IDS = {
  ingredient: "71111111-1111-4111-8111-111111111111",
  old: "72222222-2222-4222-8222-222222222222",
  nextA: "73333333-3333-4333-8333-333333333333",
  nextB: "74444444-4444-4444-8444-444444444444"
} as const;
const T0 = "2026-07-01T00:00:00.000Z";
const T1 = "2026-07-15T00:00:00.000Z";
const T2 = "2026-08-01T00:00:00.000Z";

type Fixture = Readonly<{
  databasePath: string;
  database: DatabaseAdapter;
  repository: SqliteCostRepository;
  service: CostQuoteLifecycleService;
}>;

function removeDatabaseFiles(databasePath: string): void {
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }
}

function fixture(t: TestContext): Fixture {
  const databasePath = path.resolve("data", `cost-lifecycle-${randomUUID()}.sqlite`);
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath });
  runMigrations(database);
  t.after(() => {
    database.close();
    removeDatabaseFiles(databasePath);
  });
  return {
    databasePath,
    database,
    repository: new SqliteCostRepository(database),
    service: new CostQuoteLifecycleService(new SqliteCostQuoteUnitOfWork(database))
  };
}

function input(
  quoteUuid: string,
  from = T0,
  to: string | undefined = T2,
  amount = "300"
): RecordInitialIngredientCostQuoteCommand {
  return {
    quoteId: IngredientCostQuoteId.fromUuid(quoteUuid),
    ingredientId: IngredientId.fromUuid(IDS.ingredient),
    monetaryAmount: MonetaryAmount.create(amount, 0, Currency.TWD()),
    purchaseQuantity: ExactDecimal.create("5", 0),
    purchaseUnit: CostUnit.create("kg"),
    effectivePeriod: EffectivePeriod.create(from, to),
    source: CostSource.create({ sourceType: "manual", sourceReferenceId: `source-${quoteUuid}` }),
    recordedAt: from,
    recordedBy: "owner-1"
  };
}

function replaceCommand(newQuote: RecordInitialIngredientCostQuoteCommand) {
  return {
    oldQuoteId: IngredientCostQuoteId.fromUuid(IDS.old),
    expectedVersion: 0,
    newQuote,
    supersededAt: T1,
    supersededBy: "owner-2"
  } as const;
}

test("SQLite lifecycle records initial Quote and atomically replaces it", (t) => {
  const { repository, service } = fixture(t);
  assert.equal(Object.hasOwn(input(IDS.old), "aggregateVersion"), false);
  service.recordInitialQuote(input(IDS.old));
  const newQuote = input(IDS.nextA, T1, undefined, "325");
  assert.equal(service.replaceEffectiveQuote(replaceCommand(newQuote)).status, "replaced");

  const old = repository.findByQuoteId(IngredientCostQuoteId.fromUuid(IDS.old));
  const next = repository.findByQuoteId(IngredientCostQuoteId.fromUuid(IDS.nextA));
  assert.ok(old);
  assert.ok(next);
  assert.equal(old.aggregateVersion, 1);
  assert.equal(old.supersession?.supersededByQuoteId.value, next.quoteId.value);
  assert.equal(next.aggregateVersion, 0);
  assert.equal(repository.findEffectiveQuoteAt(old.ingredientId, T1).status, "found");
});

test("SQLite lifecycle exact replacement retry is idempotent across service instances", (t) => {
  const { database, repository, service } = fixture(t);
  service.recordInitialQuote(input(IDS.old));
  const command = replaceCommand(input(IDS.nextA, T1, undefined, "325"));
  service.replaceEffectiveQuote(command);
  const secondService = new CostQuoteLifecycleService(new SqliteCostQuoteUnitOfWork(database));
  assert.equal(secondService.replaceEffectiveQuote(command).status, "already_applied");
  assert.equal(repository.findQuotesByIngredientId(command.newQuote.ingredientId).length, 2);
});

test("SQLite lifecycle stale replacement leaves no orphan new Quote", (t) => {
  const { repository, service } = fixture(t);
  service.recordInitialQuote(input(IDS.old));
  const command = {
    ...replaceCommand(input(IDS.nextA, T1, undefined, "325")),
    expectedVersion: 1
  };
  assert.throws(() => service.replaceEffectiveQuote(command), IngredientCostQuoteVersionConflict);
  assert.equal(repository.findByQuoteId(command.newQuote.quoteId), undefined);
  assert.equal(repository.findByQuoteId(command.oldQuoteId)?.state, "Recorded");
});

test("two SQLite connections replacing one old Quote allow only one successor", (t) => {
  const primary = fixture(t);
  primary.service.recordInitialQuote(input(IDS.old));
  const secondDatabase = createDatabase({
    host: "127.0.0.1",
    port: 0,
    databasePath: primary.databasePath
  });
  try {
    const secondService = new CostQuoteLifecycleService(
      new SqliteCostQuoteUnitOfWork(secondDatabase)
    );

    primary.service.replaceEffectiveQuote(
      replaceCommand(input(IDS.nextA, T1, undefined, "325"))
    );
    assert.throws(
    () => secondService.replaceEffectiveQuote(
      replaceCommand(input(IDS.nextB, T1, undefined, "350"))
    ),
      IngredientCostQuoteAlreadySuperseded
    );
    assert.equal(
      primary.repository.findByQuoteId(IngredientCostQuoteId.fromUuid(IDS.nextB)),
      undefined
    );
    assert.equal(
      primary.repository.findQuotesByIngredientId(IngredientId.fromUuid(IDS.ingredient)).length,
      2
    );
  } finally {
    secondDatabase.close();
  }
});

class FailingVersionedRepository implements CostRepository {
  constructor(private readonly delegate: CostRepository) {}

  save(quote: Parameters<CostRepository["save"]>[0]): void {
    this.delegate.save(quote);
  }

  findByQuoteId(
    quoteId: Parameters<CostRepository["findByQuoteId"]>[0]
  ): ReturnType<CostRepository["findByQuoteId"]> {
    return this.delegate.findByQuoteId(quoteId);
  }

  findQuotesByIngredientId(
    ingredientId: Parameters<CostRepository["findQuotesByIngredientId"]>[0]
  ): ReturnType<CostRepository["findQuotesByIngredientId"]> {
    return this.delegate.findQuotesByIngredientId(ingredientId);
  }

  findEffectiveQuoteAt(
    ingredientId: Parameters<CostRepository["findEffectiveQuoteAt"]>[0],
    instant: Parameters<CostRepository["findEffectiveQuoteAt"]>[1]
  ): ReturnType<CostRepository["findEffectiveQuoteAt"]> {
    return this.delegate.findEffectiveQuoteAt(ingredientId, instant);
  }

  saveWithExpectedVersion(): number {
    throw new Error("injected technical failure");
  }
}

class FailingSqliteUnitOfWork implements CostQuoteUnitOfWork {
  constructor(private readonly database: DatabaseAdapter) {}

  execute<T>(work: (repository: CostRepository) => T): T {
    return this.database.transactionImmediate(() => work(
      new FailingVersionedRepository(new SqliteCostRepository(this.database))
    ));
  }
}

test("SQLite outer transaction rolls back inserted successor after technical failure", (t) => {
  const { database, repository, service } = fixture(t);
  service.recordInitialQuote(input(IDS.old));
  const failingService = new CostQuoteLifecycleService(new FailingSqliteUnitOfWork(database));
  const command = replaceCommand(input(IDS.nextA, T1, undefined, "325"));
  assert.throws(() => failingService.replaceEffectiveQuote(command), /injected technical failure/);
  assert.equal(repository.findByQuoteId(command.newQuote.quoteId), undefined);
  assert.equal(repository.findByQuoteId(command.oldQuoteId)?.state, "Recorded");
});

test("Sqlite Cost Unit of Work wraps raw transaction failures", (t) => {
  const { database, service } = fixture(t);
  database.close();
  assert.throws(
    () => service.recordInitialQuote(input(IDS.old)),
    CostPersistenceFailure
  );
});

test("SQLite exact initial retry does not create a duplicate row", (t) => {
  const { repository, service } = fixture(t);
  assert.equal(service.recordInitialQuote(input(IDS.old)).status, "recorded");
  assert.equal(service.recordInitialQuote(input(IDS.old)).status, "already_applied");
  assert.equal(
    repository.findQuotesByIngredientId(IngredientId.fromUuid(IDS.ingredient)).length,
    1
  );
});
