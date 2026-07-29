import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AmbiguousEffectiveIngredientCostQuote,
  COST_SOURCE_TYPES,
  CostItemId,
  CostSource,
  CostUnit,
  Currency,
  CurrencyMismatch,
  EffectivePeriod,
  ExactDecimal,
  IngredientCostItem,
  IngredientCostQuote,
  IngredientCostQuoteAlreadySuperseded,
  IngredientCostQuoteId,
  IngredientCostQuoteVersionConflict,
  IngredientId,
  InvalidCostItemIdentity,
  InvalidCostQuantity,
  InvalidCostSource,
  InvalidCostUnit,
  InvalidCurrency,
  InvalidEffectivePeriod,
  InvalidIngredientCostQuote,
  InvalidIngredientCostQuoteIdentity,
  InvalidIngredientCostQuoteSupersession,
  InvalidIngredientIdentity,
  InvalidMonetaryAmount,
  MonetaryAmount,
  selectEffectiveIngredientCostQuote,
  type CostRepository,
  type RecordIngredientCostQuoteInput
} from "../domains/cost/index.js";

const UUIDS = {
  costItem: "11111111-1111-4111-8111-111111111111",
  ingredient: "22222222-2222-4222-8222-222222222222",
  otherIngredient: "33333333-3333-4333-8333-333333333333",
  quote1: "44444444-4444-4444-8444-444444444444",
  quote2: "55555555-5555-4555-8555-555555555555",
  quote3: "66666666-6666-4666-8666-666666666666"
} as const;

const T0 = "2026-07-01T00:00:00.000Z";
const T1 = "2026-07-15T00:00:00.000Z";
const T2 = "2026-08-01T00:00:00.000Z";
const T3 = "2026-09-01T00:00:00.000Z";

function quoteInput(overrides: Partial<RecordIngredientCostQuoteInput> = {}): RecordIngredientCostQuoteInput {
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

function quote(overrides: Partial<RecordIngredientCostQuoteInput> = {}): IngredientCostQuote {
  return IngredientCostQuote.record(quoteInput(overrides));
}

test("Cost Item identity uses a stable prefixed UUID", () => {
  assert.equal(CostItemId.fromUuid(UUIDS.costItem).value, `cost_item_${UUIDS.costItem}`);
});

test("invalid Cost Item identity is rejected", () => {
  assert.throws(() => CostItemId.parse("pork-belly"), InvalidCostItemIdentity);
});

test("Ingredient identity is only an ing_<uuid> reference", () => {
  assert.equal(IngredientId.fromUuid(UUIDS.ingredient).value, `ing_${UUIDS.ingredient}`);
  assert.throws(() => IngredientId.parse("Pork belly"), InvalidIngredientIdentity);
});

test("Ingredient Cost Quote identity uses its Cost-owned prefix", () => {
  assert.equal(
    IngredientCostQuoteId.fromUuid(UUIDS.quote1).value,
    `cost_quote_${UUIDS.quote1}`
  );
  assert.throws(() => IngredientCostQuoteId.parse(`quote_${UUIDS.quote1}`), InvalidIngredientCostQuoteIdentity);
});

test("Ingredient Cost Item combines stable identities without a name authority", () => {
  const item = IngredientCostItem.create(
    CostItemId.fromUuid(UUIDS.costItem),
    IngredientId.fromUuid(UUIDS.ingredient)
  );
  assert.equal(item.kind, "ingredient");
  assert.deepEqual(Object.keys(item).sort(), ["costItemId", "ingredientId", "kind"]);
});

test("TWD is a valid stable ISO-style Currency", () => {
  assert.equal(Currency.TWD().code, "TWD");
  assert.ok(Currency.create("TWD").equals(Currency.TWD()));
});

test("invalid Currency code is rejected", () => {
  assert.throws(() => Currency.create("$"), InvalidCurrency);
  assert.throws(() => Currency.create("twd"), InvalidCurrency);
});

test("Exact Monetary Amount preserves coefficient, scale, and Currency", () => {
  const amount = MonetaryAmount.create("12551", 2, Currency.TWD());
  assert.equal(amount.coefficient, "12551");
  assert.equal(amount.scale, 2);
  assert.equal(amount.currency.code, "TWD");
});

test("Monetary coefficient and scale are canonicalized exactly", () => {
  const amount = MonetaryAmount.create("0012550", 2, Currency.TWD());
  assert.equal(amount.coefficient, "1255");
  assert.equal(amount.scale, 1);
});

test("zero Monetary Amount is canonical and supported", () => {
  const zero = MonetaryAmount.create("-000", 6, Currency.TWD());
  assert.equal(zero.coefficient, "0");
  assert.equal(zero.scale, 0);
  assert.equal(zero.isZero, true);
});

test("invalid Monetary coefficient is rejected", () => {
  assert.throws(() => MonetaryAmount.create("1.25", 2, Currency.TWD()), InvalidMonetaryAmount);
  assert.throws(() => MonetaryAmount.create("1e2", 0, Currency.TWD()), InvalidMonetaryAmount);
});

test("negative or unsupported Monetary scale is rejected", () => {
  assert.throws(() => MonetaryAmount.create("1", -1, Currency.TWD()), InvalidMonetaryAmount);
  assert.throws(() => MonetaryAmount.create("1", 7, Currency.TWD()), InvalidMonetaryAmount);
});

test("authoritative decimal rejects signed 64-bit overflow", () => {
  assert.throws(
    () => MonetaryAmount.create("9223372036854775808", 0, Currency.TWD()),
    InvalidMonetaryAmount
  );
});

test("generic Monetary Amount can represent a negative value", () => {
  assert.equal(MonetaryAmount.create("-1", 0, Currency.TWD()).isNegative, true);
});

test("Monetary equality compares canonical value and Currency", () => {
  assert.ok(
    MonetaryAmount.create("12550", 2, Currency.TWD())
      .equals(MonetaryAmount.create("1255", 1, Currency.TWD()))
  );
  assert.equal(
    MonetaryAmount.create("1255", 1, Currency.TWD())
      .equals(MonetaryAmount.create("1255", 1, Currency.create("USD"))),
    false
  );
});

test("different Currencies cannot be directly ordered", () => {
  assert.throws(
    () => MonetaryAmount.create("1", 0, Currency.TWD())
      .compareTo(MonetaryAmount.create("1", 0, Currency.create("USD"))),
    CurrencyMismatch
  );
});

test("Cost Source exposes only stable approved source types", () => {
  assert.deepEqual(
    COST_SOURCE_TYPES,
    ["supplier", "manual", "invoice", "receipt", "contract", "system"]
  );
});

test("Cost Source preserves optional source and Supplier identity references", () => {
  const source = CostSource.create({
    sourceType: "invoice",
    sourceReferenceId: "invoice-42",
    supplierId: "supplier-7"
  });
  assert.equal(source.sourceReferenceId, "invoice-42");
  assert.equal(source.supplierId, "supplier-7");
});

test("blank Cost Source reference is rejected", () => {
  assert.throws(
    () => CostSource.create({ sourceType: "receipt", sourceReferenceId: "  " }),
    InvalidCostSource
  );
});

test("blank Supplier identity reference is rejected", () => {
  assert.throws(
    () => CostSource.create({ sourceType: "supplier", supplierId: "" }),
    InvalidCostSource
  );
});

test("unsupported Cost Source type is rejected at runtime", () => {
  assert.throws(
    () => CostSource.create({ sourceType: "photo" as "manual" }),
    InvalidCostSource
  );
});

test("Effective Period includes its start", () => {
  assert.equal(EffectivePeriod.create(T0, T2).contains(T0), true);
});

test("Effective Period excludes its end", () => {
  assert.equal(EffectivePeriod.create(T0, T2).contains(T2), false);
});

test("open-ended Effective Period remains valid after its start", () => {
  assert.equal(EffectivePeriod.create(T0).contains(T3), true);
});

test("effectiveTo must be later than effectiveFrom", () => {
  assert.throws(() => EffectivePeriod.create(T1, T1), InvalidEffectivePeriod);
  assert.throws(() => EffectivePeriod.create(T1, T0), InvalidEffectivePeriod);
});

test("Effective Period accepts only caller-provided canonical instants", () => {
  assert.throws(() => EffectivePeriod.create("2026-07-01"), InvalidEffectivePeriod);
  assert.throws(() => EffectivePeriod.create("not-a-date"), InvalidEffectivePeriod);
});

test("Cost Unit canonicalizes a stable unit code", () => {
  assert.equal(CostUnit.create(" KG ").code, "kg");
});

test("invalid Cost Unit is rejected", () => {
  assert.throws(() => CostUnit.create("$kg"), InvalidCostUnit);
});

test("a valid Ingredient Cost Quote records authoritative purchase facts", () => {
  const recorded = quote();
  assert.equal(recorded.state, "Recorded");
  assert.equal(recorded.monetaryAmount.coefficient, "300");
  assert.equal(recorded.purchaseQuantity.coefficient, "5");
  assert.equal(recorded.purchaseUnit.code, "kg");
  assert.equal(recorded.source.sourceType, "supplier");
  assert.equal(recorded.effectivePeriod.effectiveFrom, T0);
});

test("zero purchase quantity is rejected", () => {
  assert.throws(
    () => quote({ purchaseQuantity: ExactDecimal.create("0", 0) }),
    InvalidCostQuantity
  );
});

test("negative purchase quantity is rejected", () => {
  assert.throws(
    () => quote({ purchaseQuantity: ExactDecimal.create("-5", 0) }),
    InvalidCostQuantity
  );
});

test("negative purchase amount is rejected even though Money can represent it", () => {
  assert.throws(
    () => quote({ monetaryAmount: MonetaryAmount.create("-1", 0, Currency.TWD()) }),
    InvalidIngredientCostQuote
  );
});

test("purchase quantity remains exact and never becomes a float", () => {
  const recorded = quote({ purchaseQuantity: ExactDecimal.create("12345", 3) });
  assert.equal(recorded.purchaseQuantity.coefficient, "12345");
  assert.equal(recorded.purchaseQuantity.scale, 3);
  assert.equal(typeof recorded.purchaseQuantity.coefficient, "string");
});

test("Quote has no persisted normalized unit cost convenience value", () => {
  const recorded = quote();
  assert.equal("normalizedUnitCost" in recorded, false);
  assert.equal("unitCost" in recorded, false);
});

test("Quote records no mutable Ingredient or Recipe aggregate reference", () => {
  assert.deepEqual(Object.keys(quote()), []);
});

test("aggregateVersion must be a non-negative safe integer", () => {
  assert.throws(() => quote({ aggregateVersion: -1 }), InvalidIngredientCostQuote);
  assert.throws(() => quote({ aggregateVersion: 1.5 }), InvalidIngredientCostQuote);
});

test("expectedVersion conflict is an explicit Domain failure", () => {
  assert.throws(() => quote().assertExpectedVersion(1), IngredientCostQuoteVersionConflict);
  assert.doesNotThrow(() => quote().assertExpectedVersion(0));
});

test("supersession appends facts and preserves the old Quote purchase evidence", () => {
  const original = quote();
  const replacement = quote({
    quoteId: IngredientCostQuoteId.fromUuid(UUIDS.quote2),
    monetaryAmount: MonetaryAmount.create("320", 0, Currency.TWD()),
    recordedAt: T1
  });
  original.supersedeWith(replacement, { supersededAt: T1, supersededBy: "owner-2" });

  assert.equal(original.state, "Superseded");
  assert.equal(original.aggregateVersion, 1);
  assert.equal(original.monetaryAmount.coefficient, "300");
  assert.equal(original.purchaseQuantity.coefficient, "5");
  assert.equal(original.supersession?.supersededByQuoteId.value, replacement.quoteId.value);
  assert.ok(Object.isFrozen(original.supersession));
});

test("Quote cannot supersede itself", () => {
  const original = quote();
  assert.throws(
    () => original.supersedeWith(original, { supersededAt: T1, supersededBy: "owner" }),
    InvalidIngredientCostQuoteSupersession
  );
});

test("Quote cannot be superseded by a Quote for another Ingredient", () => {
  const original = quote();
  const other = quote({
    quoteId: IngredientCostQuoteId.fromUuid(UUIDS.quote2),
    ingredientId: IngredientId.fromUuid(UUIDS.otherIngredient)
  });
  assert.throws(
    () => original.supersedeWith(other, { supersededAt: T1, supersededBy: "owner" }),
    InvalidIngredientCostQuoteSupersession
  );
});

test("Quote cannot be superseded more than once", () => {
  const original = quote();
  const second = quote({ quoteId: IngredientCostQuoteId.fromUuid(UUIDS.quote2) });
  const third = quote({ quoteId: IngredientCostQuoteId.fromUuid(UUIDS.quote3) });
  original.supersedeWith(second, { supersededAt: T1, supersededBy: "owner" });
  assert.throws(
    () => original.supersedeWith(third, { supersededAt: T2, supersededBy: "owner" }),
    IngredientCostQuoteAlreadySuperseded
  );
});

test("a future Quote is not authoritative early", () => {
  assert.equal(quote({ effectivePeriod: EffectivePeriod.create(T2) }).isAuthoritativeAt(T1), false);
});

test("an expired Quote is not authoritative later", () => {
  assert.equal(quote({ effectivePeriod: EffectivePeriod.create(T0, T1) }).isAuthoritativeAt(T2), false);
});

test("a Quote stops being authoritative exactly at supersededAt", () => {
  const original = quote();
  const replacement = quote({ quoteId: IngredientCostQuoteId.fromUuid(UUIDS.quote2) });
  original.supersedeWith(replacement, { supersededAt: T1, supersededBy: "owner" });
  assert.equal(original.isAuthoritativeAt(T0), true);
  assert.equal(original.isAuthoritativeAt(T1), false);
});

test("effective Quote selection returns an explicit not-found result", () => {
  assert.deepEqual(
    selectEffectiveIngredientCostQuote([], IngredientId.fromUuid(UUIDS.ingredient), T1),
    { status: "not_found" }
  );
});

test("effective Quote selection returns the only authority", () => {
  const recorded = quote();
  const result = selectEffectiveIngredientCostQuote(
    [recorded],
    IngredientId.fromUuid(UUIDS.ingredient),
    T1
  );
  assert.equal(result.status, "found");
  if (result.status === "found") {
    assert.equal(result.quote, recorded);
  }
});

test("overlapping authoritative Quotes produce an ambiguity failure", () => {
  const first = quote();
  const second = quote({ quoteId: IngredientCostQuoteId.fromUuid(UUIDS.quote2) });
  assert.throws(
    () => selectEffectiveIngredientCostQuote(
      [first, second],
      IngredientId.fromUuid(UUIDS.ingredient),
      T1
    ),
    AmbiguousEffectiveIngredientCostQuote
  );
});

test("Cost Repository Port expresses versioned save and effective-at lookup", () => {
  class ContractOnlyRepository implements CostRepository {
    readonly quotes = new Map<string, IngredientCostQuote>();

    save(recorded: IngredientCostQuote): void {
      this.quotes.set(recorded.quoteId.value, recorded);
    }

    saveWithExpectedVersion(recorded: IngredientCostQuote, expectedVersion: number): number {
      recorded.assertExpectedVersion(expectedVersion);
      this.save(recorded);
      return recorded.aggregateVersion;
    }

    findByQuoteId(quoteId: IngredientCostQuoteId): IngredientCostQuote | undefined {
      return this.quotes.get(quoteId.value);
    }

    findQuotesByIngredientId(ingredientId: IngredientId): readonly IngredientCostQuote[] {
      return Object.freeze(
        [...this.quotes.values()].filter((candidate) => candidate.ingredientId.equals(ingredientId))
      );
    }

    findEffectiveQuoteAt(ingredientId: IngredientId, instant: string) {
      return selectEffectiveIngredientCostQuote([...this.quotes.values()], ingredientId, instant);
    }
  }

  const repository = new ContractOnlyRepository();
  const recorded = quote();
  repository.saveWithExpectedVersion(recorded, 0);
  assert.equal(repository.findByQuoteId(recorded.quoteId), recorded);
  assert.equal(repository.findEffectiveQuoteAt(recorded.ingredientId, T1).status, "found");
  assert.ok(Object.isFrozen(repository.findQuotesByIngredientId(recorded.ingredientId)));
});

test("Superseded Quote remains readable by Quote identity", () => {
  const original = quote();
  const replacement = quote({ quoteId: IngredientCostQuoteId.fromUuid(UUIDS.quote2) });
  const byId = new Map<string, IngredientCostQuote>([[original.quoteId.value, original]]);
  original.supersedeWith(replacement, { supersededAt: T1, supersededBy: "owner" });
  assert.equal(byId.get(original.quoteId.value)?.state, "Superseded");
});

test("Cost Domain source has no Database, API, UI, Recipe, or Runtime dependency", () => {
  const files = [
    "src/domains/cost/domain/identities.ts",
    "src/domains/cost/domain/currency.ts",
    "src/domains/cost/domain/exact-decimal.ts",
    "src/domains/cost/domain/monetary-amount.ts",
    "src/domains/cost/domain/cost-source.ts",
    "src/domains/cost/domain/effective-period.ts",
    "src/domains/cost/domain/cost-unit.ts",
    "src/domains/cost/domain/ingredient-cost-quote.ts",
    "src/domains/cost/domain/cost-repository.ts"
  ];
  const source = files.map((file) => readFileSync(file, "utf8")).join("\n").toLowerCase();
  for (const forbidden of [
    "better-sqlite3",
    "postgres",
    "express",
    "react",
    "domains/recipe",
    "domains/operations",
    "date.now(",
    "parsefloat("
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
