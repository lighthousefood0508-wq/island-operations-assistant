import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type {
  RecipeCostingContractV2
} from "../domains/recipe/contracts/recipe-costing-contract-v2.js";
import type {
  IngredientCostQuoteNormalizationEvidenceV1,
  IngredientCostQuoteNormalizationResultV1
} from "../domains/cost/contracts/ingredient-cost-quote-normalization-evidence-contract.js";
import { RecipeCostEvaluationService } from "../domains/cost/application/recipe-cost-evaluation-service.js";
import type {
  AcceptedPurchaseValuationEvidenceV1,
  CostEvaluationQuoteReader,
  CostEvaluationReadUnitOfWork
} from "../domains/cost/domain/cost-evaluation-read-unit-of-work.js";
import {
  AmbiguousEffectiveIngredientCostQuote
} from "../domains/cost/domain/errors.js";
import { ExactRational } from "../domains/cost/domain/exact-rational.js";
import { CostSource } from "../domains/cost/domain/cost-source.js";
import { CostUnit } from "../domains/cost/domain/cost-unit.js";
import { Currency } from "../domains/cost/domain/currency.js";
import { EffectivePeriod } from "../domains/cost/domain/effective-period.js";
import { ExactDecimal } from "../domains/cost/domain/exact-decimal.js";
import { IngredientCostQuote } from "../domains/cost/domain/ingredient-cost-quote.js";
import {
  IngredientCostQuoteId,
  IngredientId
} from "../domains/cost/domain/identities.js";
import { MonetaryAmount } from "../domains/cost/domain/monetary-amount.js";
import type {
  IngredientCostQuoteNormalizationPort
} from "../domains/cost/domain/recipe-cost-evaluation.js";

const EVALUATED_AT = "2026-07-31T01:00:00.000Z";
const INGREDIENT_A = "ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INGREDIENT_B = "ing_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INGREDIENT_C = "ing_cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type Dimension = "mass" | "volume" | "count";
type CanonicalUnit = "g" | "ml" | "each";

function measurementEvidence(
  dimension: Dimension,
  canonicalUnitCode: CanonicalUnit,
  coefficient: string,
  scale = 0
) {
  return {
    contractVersion: 1 as const,
    dimension,
    rawQuantity: { coefficient, scale },
    rawUnitCode: canonicalUnitCode,
    conversionId: `measurement-conversion:${canonicalUnitCode}:${canonicalUnitCode}`,
    conversionVersion: 1,
    conversionRatio: { numerator: "1", denominator: "1" },
    normalizedQuantity: { coefficient, scale },
    canonicalUnitCode
  };
}

function ingredientEvidence(
  ingredientId: string,
  dimension: Dimension,
  canonicalUnitCode: CanonicalUnit,
  coefficient: string,
  profileVersionId = `profile_version_${ingredientId}`
) {
  return {
    contractVersion: 1 as const,
    ingredientId,
    profileId: `profile_${ingredientId}`,
    profileVersionId,
    evaluatedAt: "2026-07-01T01:00:00.000Z",
    rawUnitValue: canonicalUnitCode,
    source: {
      sourceType: "SYSTEM" as const,
      recordedAt: "2026-07-01T00:00:00.000Z",
      recordedBy: "measurement-owner"
    },
    measurementEvidence: measurementEvidence(
      dimension,
      canonicalUnitCode,
      coefficient
    )
  };
}

type LineInput = Readonly<{
  ingredientId: string;
  dimension: Dimension;
  unit: CanonicalUnit;
  coefficient: string;
  profileVersionId?: string;
}>;

function recipe(
  lines: readonly LineInput[] = [
    {
      ingredientId: INGREDIENT_A,
      dimension: "mass",
      unit: "g",
      coefficient: "600"
    }
  ],
  yieldCoefficient = "3"
): RecipeCostingContractV2 {
  return {
    contractName: "RecipeCostingContract",
    contractVersion: 2,
    basis: "RECIPE_CANONICAL_PROJECTION",
    sourceProjectionContractName: "RecipeCanonicalProjection",
    sourceProjectionContractVersion: 1,
    recipeProjection: {
      contractName: "RecipeCanonicalProjection",
      contractVersion: 1,
      basis: "PUBLISHED_RECIPE_VERSION",
      recipeId: "recipe_11111111-1111-4111-8111-111111111111",
      recipeVersionId:
        "recipe_version_22222222-2222-4222-8222-222222222222",
      versionNumber: 1,
      state: "Published",
      product: {
        productId: "prod_33333333-3333-4333-8333-333333333333",
        productVersionId:
          "pver_44444444-4444-4444-8444-444444444444"
      },
      lines: lines.map((line, linePosition) => ({
        linePosition,
        ingredientId: line.ingredientId,
        normalizationEvidence: ingredientEvidence(
          line.ingredientId,
          line.dimension,
          line.unit,
          line.coefficient,
          line.profileVersionId
        )
      })),
      standardOutput: measurementEvidence("mass", "g", "600"),
      standardYield: measurementEvidence(
        "count",
        "each",
        yieldCoefficient
      ),
      publication: {
        publishedAt: "2026-07-01T01:00:00.000Z",
        publishedBy: "recipe-owner"
      },
      supersession: null
    }
  };
}

function quote(
  ingredientId: string,
  input: Readonly<{
    amount?: string;
    amountScale?: number;
    currency?: string;
    quantity?: string;
    quantityScale?: number;
    unit?: string;
    quoteUuid?: string;
  }> = {}
): IngredientCostQuote {
  return IngredientCostQuote.record({
    quoteId: IngredientCostQuoteId.fromUuid(
      input.quoteUuid ?? "11111111-1111-4111-8111-111111111111"
    ),
    ingredientId: IngredientId.parse(ingredientId),
    monetaryAmount: MonetaryAmount.create(
      input.amount ?? "800",
      input.amountScale ?? 0,
      Currency.create(input.currency ?? "TWD")
    ),
    purchaseQuantity: ExactDecimal.create(
      input.quantity ?? "2400",
      input.quantityScale ?? 0
    ),
    purchaseUnit: CostUnit.create(input.unit ?? "g"),
    effectivePeriod: EffectivePeriod.create(
      "2026-07-01T00:00:00.000Z"
    ),
    source: CostSource.create({ sourceType: "manual" }),
    recordedAt: "2026-07-01T00:00:00.000Z",
    recordedBy: "cost-owner"
  });
}

function acceptedPurchaseEvidence(
  ingredientId: string,
  input: Partial<AcceptedPurchaseValuationEvidenceV1> = {}
): AcceptedPurchaseValuationEvidenceV1 {
  return Object.freeze({
    acceptedPurchaseId:
      "accepted_purchase_11111111-1111-4111-8111-111111111111",
    acceptedPurchaseLineId:
      "accepted_purchase_line_11111111-1111-4111-8111-111111111111",
    sourcePurchaseId: "purchase_11111111-1111-4111-8111-111111111111",
    sourcePurchaseVersion: 1,
    supplierId: "supplier_11111111-1111-4111-8111-111111111111",
    acceptedAt: "2026-07-30T01:00:00.000Z",
    currencyCode: "TWD",
    amountCoefficient: "900",
    amountScale: 0,
    normalizedQuantityCoefficient: "3000",
    normalizedQuantityScale: 0,
    dimension: "mass",
    canonicalUnitCode: "g",
    profileId: `profile_${ingredientId}`,
    profileVersionId: `profile_version_${ingredientId}`,
    ...input
  });
}

type NormalizedFacts = Readonly<{
  dimension: Dimension;
  unit: CanonicalUnit;
  quantity: string;
  profileVersionId?: string;
}>;

class FakeReader implements CostEvaluationQuoteReader {
  readonly calls: string[] = [];

  constructor(
    private readonly quotes: ReadonlyMap<string, IngredientCostQuote>,
    private readonly ambiguous = new Set<string>(),
    private readonly acceptedPurchaseLines:
      ReadonlyMap<string, readonly AcceptedPurchaseValuationEvidenceV1[]> = new Map()
  ) {}

  findEligibleAcceptedPurchaseLines(
    ingredientId: IngredientId
  ): readonly AcceptedPurchaseValuationEvidenceV1[] {
    return this.acceptedPurchaseLines.get(ingredientId.value) ?? [];
  }

  findEffectiveQuoteAt(ingredientId: IngredientId) {
    this.calls.push(ingredientId.value);
    if (this.ambiguous.has(ingredientId.value)) {
      throw new AmbiguousEffectiveIngredientCostQuote([
        "cost_quote_11111111-1111-4111-8111-111111111111",
        "cost_quote_22222222-2222-4222-8222-222222222222"
      ]);
    }
    const found = this.quotes.get(ingredientId.value);
    return found === undefined
      ? Object.freeze({ status: "not_found" as const })
      : Object.freeze({ status: "found" as const, quote: found });
  }
}

class FakeReadUnitOfWork implements CostEvaluationReadUnitOfWork {
  executions = 0;

  constructor(readonly reader: CostEvaluationQuoteReader) {}

  execute<T>(work: (reader: CostEvaluationQuoteReader) => T): T {
    this.executions += 1;
    return work(this.reader);
  }
}

class FakeNormalizer implements IngredientCostQuoteNormalizationPort {
  readonly calls: string[] = [];

  constructor(
    private readonly facts: ReadonlyMap<string, NormalizedFacts>,
    private readonly failureCode?: string,
    private readonly evidenceIdentityOverride:
      Readonly<Record<string, unknown>> | undefined = undefined
  ) {}

  normalize(request: Readonly<{
    quote: IngredientCostQuote;
    evaluatedAt: string;
  }>): IngredientCostQuoteNormalizationResultV1 {
    this.calls.push(request.quote.ingredientId.value);
    if (this.failureCode !== undefined) {
      return Object.freeze({
        status: "failed",
        failure: Object.freeze({
          code: "UNKNOWN_PURCHASE_UNIT",
          message: "Quote unit is unsupported."
        })
      });
    }
    const facts = this.facts.get(request.quote.ingredientId.value);
    if (facts === undefined) {
      throw new Error("Missing fake normalization facts.");
    }
    const measurement = measurementEvidence(
      facts.dimension,
      facts.unit,
      facts.quantity
    );
    const evidence: IngredientCostQuoteNormalizationEvidenceV1 =
      Object.freeze({
        contractName: "IngredientCostQuoteNormalizationEvidence",
        contractVersion: 1,
        basis: "INGREDIENT_COST_QUOTE",
        quoteId: request.quote.quoteId.value,
        ingredientId: request.quote.ingredientId.value,
        evaluatedAt: request.evaluatedAt,
        quoteState: request.quote.state,
        monetaryAmount: Object.freeze({
          coefficient: request.quote.monetaryAmount.coefficient,
          scale: request.quote.monetaryAmount.scale,
          currencyCode: request.quote.monetaryAmount.currency.code
        }),
        purchase: Object.freeze({
          rawQuantity: Object.freeze({
            coefficient: request.quote.purchaseQuantity.coefficient,
            scale: request.quote.purchaseQuantity.scale
          }),
          rawUnitCode: request.quote.purchaseUnit.code
        }),
        effectivePeriod: Object.freeze({
          effectiveFrom: request.quote.effectivePeriod.effectiveFrom
        }),
        source: Object.freeze({ sourceType: "manual" }),
        recording: Object.freeze({
          recordedAt: request.quote.recordedAt,
          recordedBy: request.quote.recordedBy
        }),
        supersession: null,
        normalizationEvidence: Object.freeze({
          contractVersion: 1,
          ingredientId: request.quote.ingredientId.value,
          profileId: `profile_${request.quote.ingredientId.value}`,
          profileVersionId:
            facts.profileVersionId
            ?? `quote_profile_version_${request.quote.ingredientId.value}`,
          evaluatedAt: request.evaluatedAt,
          rawUnitValue: request.quote.purchaseUnit.code,
          source: Object.freeze({
            sourceType: "SYSTEM",
            recordedAt: "2026-07-01T00:00:00.000Z",
            recordedBy: "measurement-owner"
          }),
          measurementEvidence: Object.freeze(measurement)
        })
      });
    const exposedEvidence = this.evidenceIdentityOverride === undefined
      ? evidence
      : Object.freeze({
        ...evidence,
        ...this.evidenceIdentityOverride
      }) as unknown as IngredientCostQuoteNormalizationEvidenceV1;
    return Object.freeze({
      status: "normalized",
      evidence: exposedEvidence
    });
  }
}

function setup(input: Readonly<{
  lines?: readonly LineInput[];
  quotes?: ReadonlyMap<string, IngredientCostQuote>;
  normalized?: ReadonlyMap<string, NormalizedFacts>;
  ambiguous?: ReadonlySet<string>;
  acceptedPurchaseLines?: ReadonlyMap<
    string,
    readonly AcceptedPurchaseValuationEvidenceV1[]
  >;
  yieldCoefficient?: string;
  failureCode?: string;
  evidenceIdentityOverride?: Readonly<Record<string, unknown>>;
}> = {}) {
  const lines = input.lines ?? [{
    ingredientId: INGREDIENT_A,
    dimension: "mass" as const,
    unit: "g" as const,
    coefficient: "600"
  }];
  const quotes = input.quotes ?? new Map([
    [INGREDIENT_A, quote(INGREDIENT_A)]
  ]);
  const normalized = input.normalized ?? new Map([
    [INGREDIENT_A, {
      dimension: "mass" as const,
      unit: "g" as const,
      quantity: "2400"
    }]
  ]);
  const reader = new FakeReader(
    quotes,
    new Set(input.ambiguous),
    input.acceptedPurchaseLines
  );
  const uow = new FakeReadUnitOfWork(reader);
  const normalizer = new FakeNormalizer(
    normalized,
    input.failureCode,
    input.evidenceIdentityOverride
  );
  const service = new RecipeCostEvaluationService(uow, normalizer);
  return {
    service,
    uow,
    reader,
    normalizer,
    command: {
      recipe: recipe(lines, input.yieldCoefficient),
      evaluatedAt: EVALUATED_AT
    }
  };
}

function evaluated(setupResult = setup()) {
  const outcome = setupResult.service.evaluate(setupResult.command);
  if (outcome.status !== "evaluated") {
    throw new Error(`Expected Evaluation, got ${outcome.failure.code}.`);
  }
  assert.equal(outcome.status, "evaluated");
  return outcome.result;
}

test("ExactRational is canonical for equivalent, signed, and zero values", () => {
  assert.deepEqual({ ...ExactRational.create("4", "8") }, {
    numerator: "1",
    denominator: "2"
  });
  assert.deepEqual({ ...ExactRational.create("2", "-4") }, {
    numerator: "-1",
    denominator: "2"
  });
  assert.deepEqual({ ...ExactRational.create("0", "99") }, {
    numerator: "0",
    denominator: "1"
  });
});

test("ExactRational uses arbitrary precision bigint without lossy conversion", () => {
  const maximum = ExactRational.create("9223372036854775807", "1");
  assert.deepEqual({ ...maximum.multiply(maximum) }, {
    numerator: "85070591730234615847396907784232501249",
    denominator: "1"
  });
});

test("source ExactDecimal remains signed-64-bit while Rational results are unbounded", () => {
  assert.throws(
    () => ExactRational.fromExactDecimal("9223372036854775808", 0),
    /signed 64-bit/
  );
  assert.deepEqual(
    {
      ...ExactRational
        .fromExactDecimal("9223372036854775807", 0)
        .multiply(ExactRational.create("2", "1"))
    },
    {
      numerator: "18446744073709551614",
      denominator: "1"
    }
  );
});

test("calculates TWD 800 / 2400g * 600g and exact yield cost", () => {
  const result = evaluated();
  assert.deepEqual(result.lines[0]?.exactLineCost, {
    numerator: "200",
    denominator: "1"
  });
  assert.deepEqual(result.exactStandardBatchCost, {
    numerator: "200",
    denominator: "1"
  });
  assert.deepEqual(result.exactPerStandardYieldCost, {
    numerator: "200",
    denominator: "3"
  });
  assert.equal(result.valuationPolicy, "VAL-2");
  assert.equal(result.roundingPolicy, "NONE_EXACT");
});

test("selects the latest eligible Accepted Purchase as actual-price evidence", () => {
  const context = setup({
    acceptedPurchaseLines: new Map([[INGREDIENT_A, [
      acceptedPurchaseEvidence(INGREDIENT_A, {
        acceptedPurchaseId:
          "accepted_purchase_11111111-1111-4111-8111-111111111111",
        amountCoefficient: "900",
        normalizedQuantityCoefficient: "3000"
      })
    ]]])
  });
  const result = evaluated(context);
  assert.equal(context.normalizer.calls.length, 0);
  assert.equal(result.lines[0]?.selectedSource.sourceType, "ActualPurchase");
  if (result.lines[0]?.selectedSource.sourceType === "ActualPurchase") {
    assert.equal(
      result.lines[0].selectedSource.acceptedPurchaseId,
      "accepted_purchase_11111111-1111-4111-8111-111111111111"
    );
  }
  assert.deepEqual(result.lines[0]?.exactLineCost, {
    numerator: "180",
    denominator: "1"
  });
});

test("uses Quote only as an explicit fallback when no Accepted Purchase is eligible", () => {
  const result = evaluated();
  assert.equal(result.lines[0]?.selectedSource.sourceType, "QuoteFallback");
});

test("equally-ranked Accepted Purchases fail closed instead of silently choosing", () => {
  const context = setup({
    acceptedPurchaseLines: new Map([[INGREDIENT_A, [
      acceptedPurchaseEvidence(INGREDIENT_A, {
        acceptedPurchaseId:
          "accepted_purchase_22222222-2222-4222-8222-222222222222"
      }),
      acceptedPurchaseEvidence(INGREDIENT_A, {
        acceptedPurchaseId:
          "accepted_purchase_11111111-1111-4111-8111-111111111111",
        acceptedPurchaseLineId:
          "accepted_purchase_line_22222222-2222-4222-8222-222222222222"
      })
    ]]])
  });
  const outcome = context.service.evaluate(context.command);
  assert.equal(outcome.status, "failed");
  if (outcome.status === "failed") {
    assert.equal(outcome.failure.code, "AMBIGUOUS_ACCEPTED_PURCHASE_COST");
  }
  assert.deepEqual(context.normalizer.calls, []);
});

test("invalid Accepted Purchase measurement evidence fails without Quote fallback", () => {
  const context = setup({
    acceptedPurchaseLines: new Map([[INGREDIENT_A, [
      acceptedPurchaseEvidence(INGREDIENT_A, {
        dimension: "volume",
        canonicalUnitCode: "ml"
      })
    ]]])
  });
  const outcome = context.service.evaluate(context.command);
  assert.equal(outcome.status, "failed");
  if (outcome.status === "failed") {
    assert.equal(outcome.failure.code, "MEASUREMENT_INCOMPATIBILITY");
  }
  assert.deepEqual(context.normalizer.calls, []);
});

test("repeated Ingredient Lines reuse one Quote and normalization with independent trace", () => {
  const context = setup({
    lines: [
      { ingredientId: INGREDIENT_A, dimension: "mass", unit: "g", coefficient: "600" },
      {
        ingredientId: INGREDIENT_A,
        dimension: "mass",
        unit: "g",
        coefficient: "300",
        profileVersionId: "recipe_profile_different"
      }
    ],
    yieldCoefficient: "1"
  });
  const result = evaluated(context);
  assert.deepEqual(context.reader.calls, [INGREDIENT_A]);
  assert.deepEqual(context.normalizer.calls, [INGREDIENT_A]);
  assert.deepEqual(
    result.lines.map((line) => line.exactLineCost),
    [
      { numerator: "200", denominator: "1" },
      { numerator: "100", denominator: "1" }
    ]
  );
  assert.deepEqual(result.lines.map((line) => line.linePosition), [0, 1]);
});

test("different valid Recipe and Quote Profile Versions do not trigger re-normalization", () => {
  const context = setup({
    lines: [{
      ingredientId: INGREDIENT_A,
      dimension: "mass",
      unit: "g",
      coefficient: "600",
      profileVersionId: "recipe_profile_version"
    }],
    normalized: new Map([
      [INGREDIENT_A, {
        dimension: "mass",
        unit: "g",
        quantity: "2400",
        profileVersionId: "quote_profile_version"
      }]
    ])
  });
  const result = evaluated(context);
  assert.equal(
    result.lines[0]?.recipeNormalizationEvidence.profileVersionId,
    "recipe_profile_version"
  );
  assert.equal(result.lines[0]?.selectedSource.sourceType, "QuoteFallback");
  if (result.lines[0]?.selectedSource.sourceType === "QuoteFallback") {
    assert.equal(
      result.lines[0].selectedSource.quoteNormalizationEvidence
        .normalizationEvidence.profileVersionId,
      "quote_profile_version"
    );
  }
});

test("mass, volume, and count use their independent canonical quantities", () => {
  const lines = [
    { ingredientId: INGREDIENT_A, dimension: "mass" as const, unit: "g" as const, coefficient: "500" },
    { ingredientId: INGREDIENT_B, dimension: "volume" as const, unit: "ml" as const, coefficient: "250" },
    { ingredientId: INGREDIENT_C, dimension: "count" as const, unit: "each" as const, coefficient: "2" }
  ];
  const context = setup({
    lines,
    yieldCoefficient: "1",
    quotes: new Map([
      [INGREDIENT_A, quote(INGREDIENT_A, { amount: "100", quantity: "1000" })],
      [INGREDIENT_B, quote(INGREDIENT_B, { amount: "80", quantity: "1000", quoteUuid: "22222222-2222-4222-8222-222222222222" })],
      [INGREDIENT_C, quote(INGREDIENT_C, { amount: "120", quantity: "12", quoteUuid: "33333333-3333-4333-8333-333333333333" })]
    ]),
    normalized: new Map([
      [INGREDIENT_A, { dimension: "mass", unit: "g", quantity: "1000" }],
      [INGREDIENT_B, { dimension: "volume", unit: "ml", quantity: "1000" }],
      [INGREDIENT_C, { dimension: "count", unit: "each", quantity: "12" }]
    ])
  });
  assert.deepEqual(evaluated(context).exactStandardBatchCost, {
    numerator: "90",
    denominator: "1"
  });
});

test("zero-price Quote remains a valid exact zero Evaluation", () => {
  const context = setup({
    quotes: new Map([[INGREDIENT_A, quote(INGREDIENT_A, { amount: "0" })]])
  });
  assert.deepEqual(evaluated(context).exactStandardBatchCost, {
    numerator: "0",
    denominator: "1"
  });
});

test("missing Quote fails typed without producing a partial result", () => {
  const context = setup({ quotes: new Map() });
  const outcome = context.service.evaluate(context.command);
  assert.deepEqual(outcome, {
    status: "failed",
    failure: {
      code: "MISSING_INGREDIENT_COST",
      message: "No authoritative Ingredient Cost Quote exists at evaluatedAt.",
      ingredientId: INGREDIENT_A
    }
  });
});

test("ambiguous Quote fails closed without a hidden winner", () => {
  const context = setup({ ambiguous: new Set([INGREDIENT_A]) });
  const outcome = context.service.evaluate(context.command);
  assert.equal(outcome.status, "failed");
  if (outcome.status === "failed") {
    assert.equal(outcome.failure.code, "AMBIGUOUS_INGREDIENT_COST");
    assert.equal(outcome.failure.quoteIds?.length, 2);
  }
  assert.deepEqual(context.normalizer.calls, []);
});

test("Quote normalization failure remains typed and carries stable source code", () => {
  const context = setup({ failureCode: "UNKNOWN_PURCHASE_UNIT" });
  const outcome = context.service.evaluate(context.command);
  assert.equal(outcome.status, "failed");
  if (outcome.status === "failed") {
    assert.equal(outcome.failure.code, "QUOTE_NORMALIZATION_FAILED");
    assert.equal(outcome.failure.sourceFailureCode, "UNKNOWN_PURCHASE_UNIT");
  }
});

test("forged Quote Evidence contract identity and selected quoteId fail closed", () => {
  const corruptions: ReadonlyArray<Readonly<{
    field: string;
    value: unknown;
  }>> = [
    { field: "contractName", value: "OtherQuoteEvidence" },
    { field: "contractVersion", value: 2 },
    { field: "basis", value: "OTHER_BASIS" },
    {
      field: "quoteId",
      value: "cost_quote_99999999-9999-4999-8999-999999999999"
    }
  ];

  for (const corruption of corruptions) {
    const context = setup({
      evidenceIdentityOverride: {
        [corruption.field]: corruption.value
      }
    });
    const outcome = context.service.evaluate(context.command);
    assert.equal(outcome.status, "failed", corruption.field);
    if (outcome.status === "failed") {
      assert.equal(
        outcome.failure.code,
        "QUOTE_NORMALIZATION_FAILED",
        corruption.field
      );
      assert.equal(
        outcome.failure.sourceFailureCode,
        "INVALID_NORMALIZATION_EVIDENCE",
        corruption.field
      );
    }
  }
});

test("dimension and canonical Unit mismatch fails without modifying evidence", () => {
  const context = setup({
    normalized: new Map([
      [INGREDIENT_A, {
        dimension: "volume",
        unit: "ml",
        quantity: "2400"
      }]
    ])
  });
  const source = structuredClone(context.command.recipe);
  const outcome = context.service.evaluate(context.command);
  assert.equal(outcome.status, "failed");
  if (outcome.status === "failed") {
    assert.equal(outcome.failure.code, "MEASUREMENT_INCOMPATIBILITY");
  }
  assert.deepEqual(context.command.recipe, source);
});

test("mixed Currency and consistent non-TWD remain distinct typed failures", () => {
  const lines = [
    { ingredientId: INGREDIENT_A, dimension: "mass" as const, unit: "g" as const, coefficient: "1" },
    { ingredientId: INGREDIENT_B, dimension: "mass" as const, unit: "g" as const, coefficient: "1" }
  ];
  const normalized = new Map([
    [INGREDIENT_A, { dimension: "mass" as const, unit: "g" as const, quantity: "1" }],
    [INGREDIENT_B, { dimension: "mass" as const, unit: "g" as const, quantity: "1" }]
  ]);
  const mixed = setup({
    lines,
    normalized,
    quotes: new Map([
      [INGREDIENT_A, quote(INGREDIENT_A, { amount: "1", quantity: "1" })],
      [INGREDIENT_B, quote(INGREDIENT_B, { amount: "1", quantity: "1", currency: "USD", quoteUuid: "22222222-2222-4222-8222-222222222222" })]
    ])
  }).service.evaluate({ recipe: recipe(lines), evaluatedAt: EVALUATED_AT });
  assert.equal(mixed.status, "failed");
  if (mixed.status === "failed") {
    assert.equal(mixed.failure.code, "CURRENCY_MISMATCH");
  }

  const usd = setup({
    quotes: new Map([[INGREDIENT_A, quote(INGREDIENT_A, { currency: "USD" })]])
  });
  const unsupported = usd.service.evaluate(usd.command);
  assert.equal(unsupported.status, "failed");
  if (unsupported.status === "failed") {
    assert.equal(unsupported.failure.code, "UNSUPPORTED_CURRENCY");
  }
});

test("invalid timestamp and malformed Recipe Contract fail before opening the UoW", () => {
  const invalidTime = setup();
  const timeOutcome = invalidTime.service.evaluate({
    recipe: invalidTime.command.recipe,
    evaluatedAt: "2026/07/31"
  });
  assert.equal(timeOutcome.status, "failed");
  assert.equal(invalidTime.uow.executions, 0);

  const invalidRecipe = setup();
  const forged = structuredClone(invalidRecipe.command.recipe) as unknown as Record<string, unknown>;
  forged.contractVersion = 1;
  const recipeOutcome = invalidRecipe.service.evaluate({
    recipe: forged as unknown as RecipeCostingContractV2,
    evaluatedAt: EVALUATED_AT
  });
  assert.equal(recipeOutcome.status, "failed");
  if (recipeOutcome.status === "failed") {
    assert.equal(recipeOutcome.failure.code, "INVALID_RECIPE_COSTING_CONTRACT");
  }
  assert.equal(invalidRecipe.uow.executions, 0);
});

test("read transaction technical failures do not escape the typed boundary", () => {
  const service = new RecipeCostEvaluationService({
    execute() {
      throw new Error("database unavailable");
    }
  }, new FakeNormalizer(new Map()));
  const outcome = service.evaluate({
    recipe: recipe(),
    evaluatedAt: EVALUATED_AT
  });
  assert.equal(outcome.status, "failed");
  if (outcome.status === "failed") {
    assert.equal(outcome.failure.code, "READ_TRANSACTION_FAILED");
  }
});

test("identical inputs produce deeply equal immutable results", () => {
  const first = evaluated();
  const second = evaluated();
  assert.deepEqual(first, second);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.recipe));
  assert.ok(Object.isFrozen(first.lines));
  assert.ok(Object.isFrozen(first.lines[0]?.selectedSource));
  if (first.lines[0]?.selectedSource.sourceType === "QuoteFallback") {
    assert.ok(Object.isFrozen(
      first.lines[0].selectedSource.quoteNormalizationEvidence
    ));
  }
  assert.ok(Object.isFrozen(first.exactStandardBatchCost));
});

test("Cost Evaluation sources contain no floating point, rounding, hidden time, or Snapshot authority", () => {
  const source = [
    "src/domains/cost/domain/exact-rational.ts",
    "src/domains/cost/domain/recipe-cost-evaluation.ts",
    "src/domains/cost/application/recipe-cost-evaluation-service.ts"
  ].map((file) => readFileSync(file, "utf8").toLowerCase()).join("\n");
  for (const forbidden of [
    "parsefloat(",
    "number(bigint",
    "math.round",
    "date.now",
    "new date(",
    "randomuuid",
    "costsnapshot",
    "insert into",
    "update ",
    "delete from"
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
