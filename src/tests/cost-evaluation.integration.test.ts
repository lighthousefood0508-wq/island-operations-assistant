import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import type {
  IngredientCostQuoteNormalizationPort
} from "../domains/cost/domain/recipe-cost-evaluation.js";
import { RecipeCostEvaluationService } from "../domains/cost/application/recipe-cost-evaluation-service.js";
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
import { SqliteCostEvaluationReadUnitOfWork } from "../domains/cost/infrastructure/sqlite-cost-evaluation-read-unit-of-work.js";
import { SqliteCostRepository } from "../domains/cost/infrastructure/sqlite-cost-repository.js";
import type { DatabaseAdapter } from "../shared/database/database-adapter.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";

const EVALUATED_AT = "2026-07-31T01:00:00.000Z";
const INGREDIENT_A = "ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INGREDIENT_B = "ing_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function removeDatabaseFiles(databasePath: string): void {
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }
}

function databases(t: TestContext) {
  const databasePath = path.resolve(
    "data",
    `cost-evaluation-${randomUUID()}.sqlite`
  );
  const databaseA = createDatabase({
    host: "127.0.0.1",
    port: 0,
    databasePath
  });
  runMigrations(databaseA);
  const databaseB = createDatabase({
    host: "127.0.0.1",
    port: 0,
    databasePath
  });
  t.after(() => {
    databaseA.close();
    databaseB.close();
    removeDatabaseFiles(databasePath);
  });
  return { databaseA, databaseB };
}

function quote(
  ingredientId: string,
  quoteUuid: string,
  amount = "800",
  quantity = "2400",
  effectiveFrom = "2026-07-01T00:00:00.000Z",
  effectiveTo?: string
): IngredientCostQuote {
  return IngredientCostQuote.record({
    quoteId: IngredientCostQuoteId.fromUuid(quoteUuid),
    ingredientId: IngredientId.parse(ingredientId),
    monetaryAmount: MonetaryAmount.create(amount, 0, Currency.TWD()),
    purchaseQuantity: ExactDecimal.create(quantity, 0),
    purchaseUnit: CostUnit.create("g"),
    effectivePeriod: EffectivePeriod.create(effectiveFrom, effectiveTo),
    source: CostSource.create({ sourceType: "manual" }),
    recordedAt: "2026-07-01T00:00:00.000Z",
    recordedBy: "cost-owner"
  });
}

function recipe() {
  const measurement = {
    contractVersion: 1 as const,
    dimension: "mass" as const,
    rawQuantity: { coefficient: "600", scale: 0 },
    rawUnitCode: "g" as const,
    conversionId: "measurement-conversion:g:g",
    conversionVersion: 1,
    conversionRatio: { numerator: "1", denominator: "1" },
    normalizedQuantity: { coefficient: "600", scale: 0 },
    canonicalUnitCode: "g" as const
  };
  return {
    contractName: "RecipeCostingContract" as const,
    contractVersion: 2 as const,
    basis: "RECIPE_CANONICAL_PROJECTION" as const,
    sourceProjectionContractName: "RecipeCanonicalProjection" as const,
    sourceProjectionContractVersion: 1 as const,
    recipeProjection: {
      contractName: "RecipeCanonicalProjection" as const,
      contractVersion: 1 as const,
      basis: "PUBLISHED_RECIPE_VERSION" as const,
      recipeId: "recipe_11111111-1111-4111-8111-111111111111",
      recipeVersionId:
        "recipe_version_22222222-2222-4222-8222-222222222222",
      versionNumber: 1,
      state: "Published" as const,
      product: {
        productId: "prod_33333333-3333-4333-8333-333333333333",
        productVersionId:
          "pver_44444444-4444-4444-8444-444444444444"
      },
      lines: [{
        linePosition: 0,
        ingredientId: INGREDIENT_A,
        normalizationEvidence: {
          contractVersion: 1 as const,
          ingredientId: INGREDIENT_A,
          profileId: "profile_recipe",
          profileVersionId: "profile_version_recipe",
          evaluatedAt: "2026-07-01T01:00:00.000Z",
          rawUnitValue: "g",
          source: {
            sourceType: "SYSTEM" as const,
            recordedAt: "2026-07-01T00:00:00.000Z",
            recordedBy: "measurement-owner"
          },
          measurementEvidence: measurement
        }
      }],
      standardOutput: measurement,
      standardYield: {
        ...measurement,
        dimension: "count" as const,
        rawQuantity: { coefficient: "3", scale: 0 },
        rawUnitCode: "each" as const,
        conversionId: "measurement-conversion:each:each",
        normalizedQuantity: { coefficient: "3", scale: 0 },
        canonicalUnitCode: "each" as const
      },
      publication: {
        publishedAt: "2026-07-01T01:00:00.000Z",
        publishedBy: "recipe-owner"
      },
      supersession: null
    }
  };
}

class IntegrationNormalizer
implements IngredientCostQuoteNormalizationPort {
  normalize(request: Readonly<{
    quote: IngredientCostQuote;
    evaluatedAt: string;
  }>) {
    return {
      status: "normalized" as const,
      evidence: {
        contractName:
          "IngredientCostQuoteNormalizationEvidence" as const,
        contractVersion: 1 as const,
        basis: "INGREDIENT_COST_QUOTE" as const,
        quoteId: request.quote.quoteId.value,
        ingredientId: request.quote.ingredientId.value,
        evaluatedAt: request.evaluatedAt,
        quoteState: request.quote.state,
        monetaryAmount: {
          coefficient: request.quote.monetaryAmount.coefficient,
          scale: request.quote.monetaryAmount.scale,
          currencyCode: request.quote.monetaryAmount.currency.code
        },
        purchase: {
          rawQuantity: {
            coefficient: request.quote.purchaseQuantity.coefficient,
            scale: request.quote.purchaseQuantity.scale
          },
          rawUnitCode: request.quote.purchaseUnit.code
        },
        effectivePeriod: {
          effectiveFrom: request.quote.effectivePeriod.effectiveFrom,
          ...(request.quote.effectivePeriod.effectiveTo === undefined
            ? {}
            : { effectiveTo: request.quote.effectivePeriod.effectiveTo })
        },
        source: { sourceType: "manual" as const },
        recording: {
          recordedAt: request.quote.recordedAt,
          recordedBy: request.quote.recordedBy
        },
        supersession: request.quote.supersession === undefined
          ? null
          : {
            supersededByQuoteId:
              request.quote.supersession.supersededByQuoteId.value,
            supersededAt: request.quote.supersession.supersededAt,
            supersededBy: request.quote.supersession.supersededBy
          },
        normalizationEvidence: {
          contractVersion: 1 as const,
          ingredientId: request.quote.ingredientId.value,
          profileId: "profile_quote",
          profileVersionId: "profile_version_quote",
          evaluatedAt: request.evaluatedAt,
          rawUnitValue: "g",
          source: {
            sourceType: "SYSTEM" as const,
            recordedAt: "2026-07-01T00:00:00.000Z",
            recordedBy: "measurement-owner"
          },
          measurementEvidence: {
            contractVersion: 1 as const,
            dimension: "mass" as const,
            rawQuantity: {
              coefficient: request.quote.purchaseQuantity.coefficient,
              scale: request.quote.purchaseQuantity.scale
            },
            rawUnitCode: "g" as const,
            conversionId: "measurement-conversion:g:g",
            conversionVersion: 1,
            conversionRatio: { numerator: "1", denominator: "1" },
            normalizedQuantity: {
              coefficient: request.quote.purchaseQuantity.coefficient,
              scale: request.quote.purchaseQuantity.scale
            },
            canonicalUnitCode: "g" as const
          }
        }
      }
    };
  }
}

test("SQLite read UoW exposes only the narrow frozen Quote reader", (t) => {
  const { databaseA } = databases(t);
  const uow = new SqliteCostEvaluationReadUnitOfWork(databaseA);
  uow.execute((reader) => {
    assert.deepEqual(Object.keys(reader), ["findEffectiveQuoteAt"]);
    assert.ok(Object.isFrozen(reader));
    assert.equal("save" in reader, false);
    assert.equal("saveWithExpectedVersion" in reader, false);
    assert.equal("transactionImmediate" in reader, false);
  });
});

test("two connections prove one deferred SQLite read snapshot without a write lock", (t) => {
  const { databaseA, databaseB } = databases(t);
  const repositoryA = new SqliteCostRepository(databaseA);
  const repositoryB = new SqliteCostRepository(databaseB);
  repositoryA.save(quote(
    INGREDIENT_A,
    "11111111-1111-4111-8111-111111111111"
  ));
  const uow = new SqliteCostEvaluationReadUnitOfWork(databaseA);

  uow.execute((reader) => {
    assert.equal(
      reader.findEffectiveQuoteAt(
        IngredientId.parse(INGREDIENT_A),
        EVALUATED_AT
      ).status,
      "found"
    );

    repositoryB.save(quote(
      INGREDIENT_B,
      "22222222-2222-4222-8222-222222222222"
    ));

    assert.equal(
      reader.findEffectiveQuoteAt(
        IngredientId.parse(INGREDIENT_B),
        EVALUATED_AT
      ).status,
      "not_found"
    );
  });

  assert.equal(
    repositoryA.findEffectiveQuoteAt(
      IngredientId.parse(INGREDIENT_B),
      EVALUATED_AT
    ).status,
    "found"
  );
});

test("Evaluation composes the real SQLite Quote reader inside one read UoW", (t) => {
  const { databaseA } = databases(t);
  new SqliteCostRepository(databaseA).save(quote(
    INGREDIENT_A,
    "11111111-1111-4111-8111-111111111111"
  ));
  const service = new RecipeCostEvaluationService(
    new SqliteCostEvaluationReadUnitOfWork(databaseA),
    new IntegrationNormalizer()
  );
  const outcome = service.evaluate({
    recipe: recipe(),
    evaluatedAt: EVALUATED_AT
  });
  assert.equal(outcome.status, "evaluated");
  if (outcome.status === "evaluated") {
    assert.deepEqual(outcome.result.exactStandardBatchCost, {
      numerator: "200",
      denominator: "1"
    });
    assert.deepEqual(outcome.result.exactPerStandardYieldCost, {
      numerator: "200",
      denominator: "3"
    });
  }
});

test("Evaluation honors effective start, exclusive end, open end, and supersession time", (t) => {
  const { databaseA } = databases(t);
  const repository = new SqliteCostRepository(databaseA);
  const original = quote(
    INGREDIENT_A,
    "11111111-1111-4111-8111-111111111111",
    "800",
    "2400"
  );
  const replacement = quote(
    INGREDIENT_A,
    "22222222-2222-4222-8222-222222222222",
    "400",
    "2400",
    "2026-08-01T00:00:00.000Z"
  );
  repository.save(original);
  repository.save(replacement);
  original.supersedeWith(replacement, {
    supersededAt: "2026-08-01T00:00:00.000Z",
    supersededBy: "cost-owner"
  });
  repository.saveWithExpectedVersion(original, 0);

  const service = new RecipeCostEvaluationService(
    new SqliteCostEvaluationReadUnitOfWork(databaseA),
    new IntegrationNormalizer()
  );
  const before = service.evaluate({
    recipe: recipe(),
    evaluatedAt: EVALUATED_AT
  });
  assert.equal(before.status, "evaluated");
  if (before.status === "evaluated") {
    assert.deepEqual(before.result.exactStandardBatchCost, {
      numerator: "200",
      denominator: "1"
    });
  }

  const atSupersession = service.evaluate({
    recipe: recipe(),
    evaluatedAt: "2026-08-01T00:00:00.000Z"
  });
  assert.equal(atSupersession.status, "evaluated");
  if (atSupersession.status === "evaluated") {
    assert.deepEqual(atSupersession.result.exactStandardBatchCost, {
      numerator: "100",
      denominator: "1"
    });
  }

  const openEndedLater = service.evaluate({
    recipe: recipe(),
    evaluatedAt: "2027-01-01T00:00:00.000Z"
  });
  assert.equal(openEndedLater.status, "evaluated");
});

test("Evaluation excludes a Quote exactly at its effectiveTo", (t) => {
  const { databaseA } = databases(t);
  new SqliteCostRepository(databaseA).save(quote(
    INGREDIENT_A,
    "11111111-1111-4111-8111-111111111111",
    "800",
    "2400",
    "2026-07-01T00:00:00.000Z",
    EVALUATED_AT
  ));
  const service = new RecipeCostEvaluationService(
    new SqliteCostEvaluationReadUnitOfWork(databaseA),
    new IntegrationNormalizer()
  );
  const atStart = service.evaluate({
    recipe: recipe(),
    evaluatedAt: "2026-07-01T00:00:00.000Z"
  });
  assert.equal(atStart.status, "evaluated");

  const outcome = service.evaluate({
    recipe: recipe(),
    evaluatedAt: EVALUATED_AT
  });
  assert.equal(outcome.status, "failed");
  if (outcome.status === "failed") {
    assert.equal(outcome.failure.code, "MISSING_INGREDIENT_COST");
  }
});

test("SQLite Cost Evaluation UoW uses transaction() and never transactionImmediate()", () => {
  const source = readFileSync(
    "src/domains/cost/infrastructure/sqlite-cost-evaluation-read-unit-of-work.ts",
    "utf8"
  );
  assert.match(source, /database\.transaction\(/);
  assert.doesNotMatch(source, /transactionImmediate|BEGIN IMMEDIATE/i);
});

test("read transaction technical failures return typed failure through the service", () => {
  const database: DatabaseAdapter = {
    execute() {
      throw new Error("not available");
    },
    queryOne() {
      throw new Error("not available");
    },
    queryMany() {
      throw new Error("not available");
    },
    transaction() {
      throw new Error("read transaction failed");
    },
    transactionImmediate() {
      throw new Error("not available");
    },
    close() {}
  };
  const service = new RecipeCostEvaluationService(
    new SqliteCostEvaluationReadUnitOfWork(database),
    new IntegrationNormalizer()
  );
  const outcome = service.evaluate({
    recipe: recipe(),
    evaluatedAt: EVALUATED_AT
  });
  assert.equal(outcome.status, "failed");
  if (outcome.status === "failed") {
    assert.equal(outcome.failure.code, "READ_TRANSACTION_FAILED");
  }
});
