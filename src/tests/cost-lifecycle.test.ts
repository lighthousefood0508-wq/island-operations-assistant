import assert from "node:assert/strict";
import test from "node:test";
import {
  AmbiguousEffectiveIngredientCostQuote,
  CostPersistenceMapper,
  CostQuoteLifecycleService,
  CostSource,
  CostUnit,
  Currency,
  DuplicateIngredientCostQuote,
  EffectivePeriod,
  ExactDecimal,
  IngredientCostQuote,
  IngredientCostQuoteAlreadySuperseded,
  IngredientCostQuoteEffectivePeriodOverlap,
  IngredientCostQuoteId,
  IngredientCostQuoteIdentityConflict,
  IngredientCostQuoteIngredientMismatch,
  IngredientCostQuoteLifecycleNotFound,
  IngredientCostQuoteRetryConflict,
  IngredientCostQuoteVersionConflict,
  IngredientId,
  InvalidCostQuantity,
  InvalidIngredientCostQuoteReplacement,
  MonetaryAmount,
  selectEffectiveIngredientCostQuote,
  type CostQuoteUnitOfWork,
  type CostRepository,
  type EffectiveIngredientCostQuoteLookup,
  type IngredientCostQuoteRecord,
  type IngredientCostQuoteRow,
  type RecordInitialIngredientCostQuoteCommand,
  type ReplaceEffectiveIngredientCostQuoteCommand
} from "../domains/cost/index.js";

const IDS = {
  ingredient: "11111111-1111-4111-8111-111111111111",
  otherIngredient: "22222222-2222-4222-8222-222222222222",
  quote1: "33333333-3333-4333-8333-333333333333",
  quote2: "44444444-4444-4444-8444-444444444444",
  quote3: "55555555-5555-4555-8555-555555555555",
  quote4: "66666666-6666-4666-8666-666666666666"
} as const;

const T0 = "2026-07-01T00:00:00.000Z";
const T1 = "2026-07-15T00:00:00.000Z";
const T2 = "2026-08-01T00:00:00.000Z";
const T3 = "2026-09-01T00:00:00.000Z";

function input(
  overrides: Partial<RecordInitialIngredientCostQuoteCommand> = {}
): RecordInitialIngredientCostQuoteCommand {
  return {
    quoteId: IngredientCostQuoteId.fromUuid(IDS.quote1),
    ingredientId: IngredientId.fromUuid(IDS.ingredient),
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
    ...overrides
  };
}

function compileTimeVersionAuthorityProof(service: CostQuoteLifecycleService): void {
  service.recordInitialQuote({
    ...input(),
    // @ts-expect-error aggregateVersion is lifecycle-owned
    aggregateVersion: 99
  });
  service.replaceEffectiveQuote({
    oldQuoteId: input().quoteId,
    expectedVersion: 0,
    newQuote: {
      ...input({ quoteId: IngredientCostQuoteId.fromUuid(IDS.quote2) }),
      // @ts-expect-error aggregateVersion is lifecycle-owned
      aggregateVersion: 99
    },
    supersededAt: T0,
    supersededBy: "owner-2"
  });
}
void compileTimeVersionAuthorityProof;

function toRow(record: IngredientCostQuoteRecord): IngredientCostQuoteRow {
  return Object.freeze({
    quote_id: record.quoteId,
    ingredient_id: record.ingredientId,
    amount_coefficient: record.amountCoefficient,
    amount_scale: record.amountScale,
    currency_code: record.currencyCode,
    purchase_quantity_coefficient: record.purchaseQuantityCoefficient,
    purchase_quantity_scale: record.purchaseQuantityScale,
    unit_code: record.unitCode,
    source_type: record.sourceType,
    source_reference_id: record.sourceReferenceId ?? null,
    supplier_id: record.supplierId ?? null,
    effective_from: record.effectiveFrom,
    effective_to: record.effectiveTo ?? null,
    recorded_at: record.recordedAt,
    recorded_by: record.recordedBy,
    superseded_at: record.supersededAt ?? null,
    superseded_by_quote_id: record.supersededByQuoteId ?? null,
    superseded_by_actor: record.supersededByActor ?? null,
    aggregate_version: record.aggregateVersion
  });
}

class MemoryCostRepository implements CostRepository {
  records = new Map<string, IngredientCostQuoteRecord>();
  failVersionedSave = false;

  save(quote: IngredientCostQuote): void {
    if (this.records.has(quote.quoteId.value)) {
      throw new DuplicateIngredientCostQuote(quote.quoteId.value);
    }
    this.records.set(quote.quoteId.value, CostPersistenceMapper.toRecord(quote));
  }

  saveWithExpectedVersion(quote: IngredientCostQuote, expectedVersion: number): number {
    if (this.failVersionedSave) {
      throw new Error("injected versioned save failure");
    }
    const existing = this.records.get(quote.quoteId.value);
    const actual = existing?.aggregateVersion ?? -1;
    if (actual !== expectedVersion) {
      throw new IngredientCostQuoteVersionConflict(expectedVersion, actual);
    }
    this.records.set(quote.quoteId.value, CostPersistenceMapper.toRecord(quote));
    return quote.aggregateVersion;
  }

  findByQuoteId(quoteId: IngredientCostQuoteId): IngredientCostQuote | undefined {
    return this.hydrate(quoteId.value, new Set());
  }

  findQuotesByIngredientId(ingredientId: IngredientId): readonly IngredientCostQuote[] {
    return Object.freeze(
      [...this.records.values()]
        .filter((record) => record.ingredientId === ingredientId.value)
        .map((record) => this.hydrate(record.quoteId, new Set())!)
    );
  }

  findEffectiveQuoteAt(
    ingredientId: IngredientId,
    instant: string
  ): EffectiveIngredientCostQuoteLookup {
    return selectEffectiveIngredientCostQuote(
      this.findQuotesByIngredientId(ingredientId),
      ingredientId,
      instant
    );
  }

  private hydrate(quoteId: string, lineage: ReadonlySet<string>): IngredientCostQuote | undefined {
    const record = this.records.get(quoteId);
    if (record === undefined) {
      return undefined;
    }
    assert.equal(lineage.has(quoteId), false);
    const nextLineage = new Set(lineage);
    nextLineage.add(quoteId);
    return CostPersistenceMapper.fromRow(toRow(record), (nextId) => {
      const next = this.hydrate(nextId.value, nextLineage);
      assert.ok(next);
      return next;
    });
  }
}

class MemoryCostUnitOfWork implements CostQuoteUnitOfWork {
  constructor(readonly repository = new MemoryCostRepository()) {}

  execute<T>(work: (repository: CostRepository) => T): T {
    const snapshot = new Map(this.repository.records);
    try {
      return work(this.repository);
    } catch (error) {
      this.repository.records = snapshot;
      throw error;
    }
  }
}

function setup(): Readonly<{
  repository: MemoryCostRepository;
  service: CostQuoteLifecycleService;
}> {
  const unitOfWork = new MemoryCostUnitOfWork();
  return {
    repository: unitOfWork.repository,
    service: new CostQuoteLifecycleService(unitOfWork)
  };
}

test("record initial Quote persists complete caller evidence in Recorded version 0", () => {
  const { repository, service } = setup();
  assert.equal(Object.hasOwn(input(), "aggregateVersion"), false);
  const result = service.recordInitialQuote(input());
  assert.deepEqual(
    { status: result.status, version: result.aggregateVersion },
    { status: "recorded", version: 0 }
  );
  const persisted = repository.findByQuoteId(result.quoteId);
  assert.ok(persisted);
  assert.equal(persisted.recordedAt, T0);
  assert.equal(persisted.recordedBy, "owner-1");
  assert.equal(persisted.state, "Recorded");
});

test("record initial exact retry returns already_applied without another row", () => {
  const { repository, service } = setup();
  service.recordInitialQuote(input());
  assert.equal(service.recordInitialQuote(input()).status, "already_applied");
  assert.equal(repository.records.size, 1);
});

test("record initial reused identity with changed facts is a typed conflict", () => {
  const { service } = setup();
  service.recordInitialQuote(input());
  assert.throws(
    () => service.recordInitialQuote(input({
      monetaryAmount: MonetaryAmount.create("301", 0, Currency.TWD())
    })),
    IngredientCostQuoteIdentityConflict
  );
});

test("record initial rejects invalid numeric evidence through the Aggregate", () => {
  const { service } = setup();
  assert.throws(
    () => service.recordInitialQuote(input({ purchaseQuantity: ExactDecimal.create("0", 0) })),
    InvalidCostQuantity
  );
});

test("record initial allows adjacent authority intervals", () => {
  const { repository, service } = setup();
  service.recordInitialQuote(input());
  const result = service.recordInitialQuote(input({
    quoteId: IngredientCostQuoteId.fromUuid(IDS.quote2),
    effectivePeriod: EffectivePeriod.create(T2, T3),
    recordedAt: T2
  }));
  assert.equal(result.status, "recorded");
  assert.equal(repository.records.size, 2);
});

for (const [name, period] of [
  ["partial", EffectivePeriod.create(T1, T3)],
  ["full", EffectivePeriod.create("2026-06-01T00:00:00.000Z", T3)],
  ["nested", EffectivePeriod.create(T1, "2026-07-20T00:00:00.000Z")],
  ["open-ended", EffectivePeriod.create(T1)]
] as const) {
  test(`record initial rejects ${name} interval overlap`, () => {
    const { service } = setup();
    service.recordInitialQuote(input());
    assert.throws(
      () => service.recordInitialQuote(input({
        quoteId: IngredientCostQuoteId.fromUuid(IDS.quote2),
        effectivePeriod: period,
        recordedAt: T1
      })),
      IngredientCostQuoteEffectivePeriodOverlap
    );
  });
}

test("two open-ended initial Quotes overlap", () => {
  const { service } = setup();
  service.recordInitialQuote(input({ effectivePeriod: EffectivePeriod.create(T0) }));
  assert.throws(
    () => service.recordInitialQuote(input({
      quoteId: IngredientCostQuoteId.fromUuid(IDS.quote2),
      effectivePeriod: EffectivePeriod.create(T2),
      recordedAt: T2
    })),
    IngredientCostQuoteEffectivePeriodOverlap
  );
});

test("past and future initial periods do not depend on a hidden current clock", () => {
  const { service } = setup();
  assert.equal(service.recordInitialQuote(input({
    effectivePeriod: EffectivePeriod.create("2000-01-01T00:00:00.000Z", "2001-01-01T00:00:00.000Z"),
    recordedAt: "1999-12-01T00:00:00.000Z"
  })).status, "recorded");
  assert.equal(service.recordInitialQuote(input({
    quoteId: IngredientCostQuoteId.fromUuid(IDS.quote2),
    effectivePeriod: EffectivePeriod.create("2099-01-01T00:00:00.000Z"),
    recordedAt: "2098-12-01T00:00:00.000Z"
  })).status, "recorded");
});

test("ambiguous pre-existing history is rejected rather than assigned a winner", () => {
  const { repository, service } = setup();
  repository.save(IngredientCostQuote.record(input()));
  repository.save(IngredientCostQuote.record(input({
    quoteId: IngredientCostQuoteId.fromUuid(IDS.quote2),
    effectivePeriod: EffectivePeriod.create(T1, T3),
    recordedAt: T1
  })));
  assert.throws(
    () => service.recordInitialQuote(input({
      quoteId: IngredientCostQuoteId.fromUuid(IDS.quote3),
      effectivePeriod: EffectivePeriod.create(T3),
      recordedAt: T3
    })),
    AmbiguousEffectiveIngredientCostQuote
  );
});

function initialAndReplacement() {
  const fixture = setup();
  fixture.service.recordInitialQuote(input());
  const newQuote = input({
    quoteId: IngredientCostQuoteId.fromUuid(IDS.quote2),
    monetaryAmount: MonetaryAmount.create("325", 0, Currency.TWD()),
    effectivePeriod: EffectivePeriod.create(T1, T3),
    recordedAt: T1,
    recordedBy: "owner-2"
  });
  return { ...fixture, newQuote };
}

test("replace effective Quote atomically supersedes old and records new", () => {
  const { repository, service, newQuote } = initialAndReplacement();
  assert.equal(Object.hasOwn(newQuote, "aggregateVersion"), false);
  const result = service.replaceEffectiveQuote({
    oldQuoteId: input().quoteId,
    expectedVersion: 0,
    newQuote,
    supersededAt: T1,
    supersededBy: "owner-2"
  });
  assert.deepEqual(
    {
      status: result.status,
      oldVersion: result.oldAggregateVersion,
      newVersion: result.newAggregateVersion
    },
    { status: "replaced", oldVersion: 1, newVersion: 0 }
  );
  const old = repository.findByQuoteId(input().quoteId);
  assert.ok(old);
  assert.equal(old.state, "Superseded");
  assert.equal(old.supersession?.supersededAt, T1);
  assert.equal(old.supersession?.supersededBy, "owner-2");
  assert.equal(old.monetaryAmount.coefficient, "300");
  assert.equal(repository.findEffectiveQuoteAt(input().ingredientId, T1).status, "found");
});

test("replacement exact retry returns already_applied", () => {
  const { service, newQuote } = initialAndReplacement();
  const command = {
    oldQuoteId: input().quoteId,
    expectedVersion: 0,
    newQuote,
    supersededAt: T1,
    supersededBy: "owner-2"
  } as const;
  service.replaceEffectiveQuote(command);
  assert.equal(service.replaceEffectiveQuote(command).status, "already_applied");
});

test("replacement retry with changed actor is rejected", () => {
  const { service, newQuote } = initialAndReplacement();
  service.replaceEffectiveQuote({
    oldQuoteId: input().quoteId,
    expectedVersion: 0,
    newQuote,
    supersededAt: T1,
    supersededBy: "owner-2"
  });
  assert.throws(
    () => service.replaceEffectiveQuote({
      oldQuoteId: input().quoteId,
      expectedVersion: 0,
      newQuote,
      supersededAt: T1,
      supersededBy: "owner-3"
    }),
    IngredientCostQuoteRetryConflict
  );
});

test("replacement missing old Quote is typed not-found", () => {
  const { service } = setup();
  assert.throws(
    () => service.replaceEffectiveQuote({
      oldQuoteId: input().quoteId,
      expectedVersion: 0,
      newQuote: input({ quoteId: IngredientCostQuoteId.fromUuid(IDS.quote2) }),
      supersededAt: T0,
      supersededBy: "owner-2"
    }),
    IngredientCostQuoteLifecycleNotFound
  );
});

test("replacement requires matching Ingredient identity", () => {
  const { service, newQuote } = initialAndReplacement();
  assert.throws(
    () => service.replaceEffectiveQuote({
      oldQuoteId: input().quoteId,
      expectedVersion: 0,
      newQuote: {
        ...newQuote,
        ingredientId: IngredientId.fromUuid(IDS.otherIngredient)
      },
      supersededAt: T1,
      supersededBy: "owner-2"
    }),
    IngredientCostQuoteIngredientMismatch
  );
});

test("replacement rejects reuse of old Quote identity", () => {
  const { service } = initialAndReplacement();
  assert.throws(
    () => service.replaceEffectiveQuote({
      oldQuoteId: input().quoteId,
      expectedVersion: 0,
      newQuote: input({ effectivePeriod: EffectivePeriod.create(T1) }),
      supersededAt: T1,
      supersededBy: "owner-2"
    }),
    IngredientCostQuoteIdentityConflict
  );
});

test("replacement requires new effectiveFrom to equal supersededAt", () => {
  const { service, newQuote } = initialAndReplacement();
  assert.throws(
    () => service.replaceEffectiveQuote({
      oldQuoteId: input().quoteId,
      expectedVersion: 0,
      newQuote,
      supersededAt: "2026-07-16T00:00:00.000Z",
      supersededBy: "owner-2"
    }),
    InvalidIngredientCostQuoteReplacement
  );
});

test("replacement requires old Quote to be authoritative at cutover", () => {
  const { service } = setup();
  service.recordInitialQuote(input());
  assert.throws(
    () => service.replaceEffectiveQuote({
      oldQuoteId: input().quoteId,
      expectedVersion: 0,
      newQuote: input({
        quoteId: IngredientCostQuoteId.fromUuid(IDS.quote2),
        effectivePeriod: EffectivePeriod.create(T2),
        recordedAt: T2
      }),
      supersededAt: T2,
      supersededBy: "owner-2"
    }),
    InvalidIngredientCostQuoteReplacement
  );
});

test("replacement rejects stale expected version", () => {
  const { service, newQuote } = initialAndReplacement();
  assert.throws(
    () => service.replaceEffectiveQuote({
      oldQuoteId: input().quoteId,
      expectedVersion: 1,
      newQuote,
      supersededAt: T1,
      supersededBy: "owner-2"
    }),
    IngredientCostQuoteVersionConflict
  );
});

test("replacement rejects a different successor after supersession", () => {
  const { service, newQuote } = initialAndReplacement();
  service.replaceEffectiveQuote({
    oldQuoteId: input().quoteId,
    expectedVersion: 0,
    newQuote,
    supersededAt: T1,
    supersededBy: "owner-2"
  });
  assert.throws(
    () => service.replaceEffectiveQuote({
      oldQuoteId: input().quoteId,
      expectedVersion: 0,
      newQuote: input({
        quoteId: IngredientCostQuoteId.fromUuid(IDS.quote3),
        effectivePeriod: EffectivePeriod.create(T1),
        recordedAt: T1
      }),
      supersededAt: T1,
      supersededBy: "owner-2"
    }),
    IngredientCostQuoteAlreadySuperseded
  );
});

test("replacement rejects a duplicate new identity before mutation", () => {
  const { repository, service, newQuote } = initialAndReplacement();
  repository.save(IngredientCostQuote.record(newQuote));
  assert.throws(
    () => service.replaceEffectiveQuote({
      oldQuoteId: input().quoteId,
      expectedVersion: 0,
      newQuote,
      supersededAt: T1,
      supersededBy: "owner-2"
    }),
    IngredientCostQuoteIdentityConflict
  );
  assert.equal(repository.findByQuoteId(input().quoteId)?.state, "Recorded");
});

test("replacement rejects overlap with another authoritative interval", () => {
  const { repository, service, newQuote } = initialAndReplacement();
  repository.save(IngredientCostQuote.record(input({
    quoteId: IngredientCostQuoteId.fromUuid(IDS.quote3),
    effectivePeriod: EffectivePeriod.create(T2, T3),
    recordedAt: T2
  })));
  assert.throws(
    () => service.replaceEffectiveQuote({
      oldQuoteId: input().quoteId,
      expectedVersion: 0,
      newQuote,
      supersededAt: T1,
      supersededBy: "owner-2"
    }),
    IngredientCostQuoteEffectivePeriodOverlap
  );
});

test("replacement transaction rolls back new Quote when old conditional save fails", () => {
  const { repository, service, newQuote } = initialAndReplacement();
  repository.failVersionedSave = true;
  assert.throws(() => service.replaceEffectiveQuote({
    oldQuoteId: input().quoteId,
    expectedVersion: 0,
    newQuote,
    supersededAt: T1,
    supersededBy: "owner-2"
  }));
  assert.equal(repository.findByQuoteId(newQuote.quoteId), undefined);
  assert.equal(repository.findByQuoteId(input().quoteId)?.state, "Recorded");
});

test("replacing an already superseded Quote directly remains prohibited", () => {
  const original = IngredientCostQuote.record(input());
  const next = IngredientCostQuote.record(input({
    quoteId: IngredientCostQuoteId.fromUuid(IDS.quote2),
    effectivePeriod: EffectivePeriod.create(T1),
    recordedAt: T1
  }));
  original.supersedeWith(next, { supersededAt: T1, supersededBy: "owner-2" });
  assert.throws(
    () => original.supersedeWith(next, { supersededAt: T1, supersededBy: "owner-2" }),
    IngredientCostQuoteAlreadySuperseded
  );
});
