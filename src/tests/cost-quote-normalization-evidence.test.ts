import assert from "node:assert/strict";
import test from "node:test";
import {
  INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
  type FormalMeasurementProfileDefinitionContractV1,
  type IngredientMeasurementNormalizationContractV1,
  type IngredientMeasurementProfileRepositoryPortV1,
  type IngredientNormalizationResultV1,
  type MeasurementProfileDefinitionContractV1
} from "../domains/recipe/contracts/ingredient-measurement-profile-contract.js";
import {
  INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_NAME,
  INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_VERSION
} from "../domains/cost/contracts/ingredient-cost-quote-normalization-evidence-contract.js";
import { IngredientCostQuoteNormalizationService } from "../domains/cost/application/ingredient-cost-quote-normalization-service.js";
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
import { IngredientMeasurementNormalizationService } from "../domains/recipe/measurement-profile/ingredient-normalization-service.js";
import { MeasurementNormalizer } from "../domains/recipe/measurement/measurement-normalizer.js";
import { MeasurementUnitResolver } from "../domains/recipe/measurement/measurement-unit-resolver.js";

const INGREDIENT_MASS = "ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INGREDIENT_VOLUME = "ing_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INGREDIENT_COUNT = "ing_cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const QUOTE_ID = "cost_quote_11111111-1111-4111-8111-111111111111";
const REPLACEMENT_ID =
  "cost_quote_22222222-2222-4222-8222-222222222222";
const EFFECTIVE_FROM = "2026-07-01T00:00:00.000Z";
const PROFILE_CHANGE = "2026-08-01T00:00:00.000Z";
const EFFECTIVE_TO = "2026-09-01T00:00:00.000Z";
const EVALUATED_AT = "2026-07-15T00:00:00.000Z";
const AFTER_PROFILE_CHANGE = "2026-08-15T00:00:00.000Z";

type Dimension = "mass" | "volume" | "count";

function profile(
  ingredientId: string,
  dimension: Dimension,
  suffix: string,
  input: Readonly<{
    state?: "Active" | "Superseded";
    effectiveFrom?: string;
    effectiveTo?: string;
  }> = {}
): FormalMeasurementProfileDefinitionContractV1 {
  const canonicalUnitCode = dimension === "mass"
    ? "g"
    : dimension === "volume"
      ? "ml"
      : "each";
  const allowedUnitCodes = dimension === "mass"
    ? ["g", "kg", "tw_catty"] as const
    : dimension === "volume"
      ? ["ml", "l", "cc"] as const
      : ["each", "dozen"] as const;
  const state = input.state ?? "Active";
  return Object.freeze({
    contractVersion: INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
    identity: Object.freeze({
      profileId: `measurement_profile_${suffix}`,
      profileVersionId: `measurement_profile_version_${suffix}`,
      ingredientId
    }),
    state,
    lifecycle: Object.freeze([]),
    dimension,
    canonicalUnitCode,
    allowedUnitCodes: Object.freeze([...allowedUnitCodes]),
    profileAliases: Object.freeze([]),
    source: Object.freeze({
      sourceType: "SYSTEM",
      referenceId: "quote-evidence-test",
      recordedAt: "2026-06-30T00:00:00.000Z",
      recordedBy: "actor_measurement"
    }),
    effectiveFrom: input.effectiveFrom ?? EFFECTIVE_FROM,
    ...(state === "Active"
      ? {}
      : { effectiveTo: input.effectiveTo ?? PROFILE_CHANGE })
  } as FormalMeasurementProfileDefinitionContractV1);
}

class ProfileRepository
implements IngredientMeasurementProfileRepositoryPortV1 {
  constructor(
    private readonly versions: readonly MeasurementProfileDefinitionContractV1[]
  ) {}

  findHistoryByProfileId(
    profileId: string
  ): readonly MeasurementProfileDefinitionContractV1[] {
    return this.versions.filter(
      (version) => version.identity.profileId === profileId
    );
  }

  findActiveProfilesAt(
    ingredientId: string,
    evaluatedAt: string
  ): readonly FormalMeasurementProfileDefinitionContractV1[] {
    return this.versions.filter(
      (version): version is FormalMeasurementProfileDefinitionContractV1 =>
        version.state !== "Draft"
        && version.identity.ingredientId === ingredientId
        && Date.parse(version.effectiveFrom) <= Date.parse(evaluatedAt)
        && (
          version.state === "Active"
          || Date.parse(evaluatedAt) < Date.parse(version.effectiveTo)
        )
    );
  }

  findProfileVersion(
    profileVersionId: string
  ): MeasurementProfileDefinitionContractV1 | undefined {
    return this.versions.find(
      (version) => version.identity.profileVersionId === profileVersionId
    );
  }
}

const baseProfiles = [
  profile(INGREDIENT_MASS, "mass", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
  profile(
    INGREDIENT_VOLUME,
    "volume",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  ),
  profile(INGREDIENT_COUNT, "count", "cccccccc-cccc-4ccc-8ccc-cccccccccccc")
];

function normalization(
  profiles: readonly MeasurementProfileDefinitionContractV1[] = baseProfiles
): IngredientMeasurementNormalizationService {
  return new IngredientMeasurementNormalizationService(
    new ProfileRepository(profiles),
    new MeasurementUnitResolver(),
    new MeasurementNormalizer()
  );
}

function quote(input: Readonly<{
  quoteId?: string;
  ingredientId?: string;
  amountCoefficient?: string;
  amountScale?: number;
  quantityCoefficient?: string;
  quantityScale?: number;
  unitCode?: string;
  effectiveTo?: string | null;
}> = {}): IngredientCostQuote {
  return IngredientCostQuote.record({
    quoteId: IngredientCostQuoteId.parse(input.quoteId ?? QUOTE_ID),
    ingredientId: IngredientId.parse(input.ingredientId ?? INGREDIENT_MASS),
    monetaryAmount: MonetaryAmount.create(
      input.amountCoefficient ?? "1255",
      input.amountScale ?? 1,
      Currency.TWD()
    ),
    purchaseQuantity: ExactDecimal.create(
      input.quantityCoefficient ?? "2",
      input.quantityScale ?? 0
    ),
    purchaseUnit: CostUnit.create(input.unitCode ?? "kg"),
    effectivePeriod: EffectivePeriod.create(
      EFFECTIVE_FROM,
      input.effectiveTo === null
        ? undefined
        : input.effectiveTo ?? EFFECTIVE_TO
    ),
    source: CostSource.create({
      sourceType: "supplier",
      sourceReferenceId: "supplier-quote-001",
      supplierId: "supplier-001"
    }),
    recordedAt: "2026-06-30T01:00:00.000Z",
    recordedBy: "actor_cost"
  });
}

function service(
  authority: IngredientMeasurementNormalizationContractV1 = normalization()
): IngredientCostQuoteNormalizationService {
  return new IngredientCostQuoteNormalizationService(authority);
}

function normalized(
  source: IngredientCostQuote = quote(),
  evaluatedAt = EVALUATED_AT,
  authority?: IngredientMeasurementNormalizationContractV1
) {
  const result = service(authority).normalize({
    quote: source,
    evaluatedAt
  });
  assert.equal(result.status, "normalized");
  if (result.status !== "normalized") {
    throw new Error("Expected normalized Quote evidence.");
  }
  return result.evidence;
}

function assertFailure(
  result: ReturnType<IngredientCostQuoteNormalizationService["normalize"]>,
  code: string
): void {
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.failure.code, code);
    assert.equal("evidence" in result, false);
  }
}

test("publishes stable Contract identity and complete Quote facts", () => {
  const evidence = normalized();
  assert.equal(
    evidence.contractName,
    INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_NAME
  );
  assert.equal(
    evidence.contractVersion,
    INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_VERSION
  );
  assert.equal(evidence.quoteId, QUOTE_ID);
  assert.equal(evidence.ingredientId, INGREDIENT_MASS);
  assert.equal(evidence.evaluatedAt, EVALUATED_AT);
  assert.deepEqual(evidence.monetaryAmount, {
    coefficient: "1255",
    scale: 1,
    currencyCode: "TWD"
  });
  assert.deepEqual(evidence.purchase, {
    rawQuantity: { coefficient: "2", scale: 0 },
    rawUnitCode: "kg"
  });
  assert.deepEqual(evidence.effectivePeriod, {
    effectiveFrom: EFFECTIVE_FROM,
    effectiveTo: EFFECTIVE_TO
  });
  assert.deepEqual(evidence.source, {
    sourceType: "supplier",
    sourceReferenceId: "supplier-quote-001",
    supplierId: "supplier-001"
  });
  assert.deepEqual(evidence.recording, {
    recordedAt: "2026-06-30T01:00:00.000Z",
    recordedBy: "actor_cost"
  });
});

test("normalizes kg and tw_catty to exact grams", () => {
  assert.deepEqual(
    normalized().normalizationEvidence.measurementEvidence.normalizedQuantity,
    { coefficient: "2000", scale: 0 }
  );
  const catty = normalized(quote({
    quantityCoefficient: "5",
    unitCode: "tw_catty"
  }));
  assert.deepEqual(
    catty.normalizationEvidence.measurementEvidence.normalizedQuantity,
    { coefficient: "3000", scale: 0 }
  );
  assert.deepEqual(
    catty.normalizationEvidence.measurementEvidence.conversionRatio,
    { numerator: "600", denominator: "1" }
  );
});

test("normalizes L and cc to exact millilitres", () => {
  const litres = normalized(quote({
    ingredientId: INGREDIENT_VOLUME,
    quantityCoefficient: "2",
    unitCode: "l"
  }));
  assert.deepEqual(
    litres.normalizationEvidence.measurementEvidence.normalizedQuantity,
    { coefficient: "2000", scale: 0 }
  );
  const cc = normalized(quote({
    ingredientId: INGREDIENT_VOLUME,
    quantityCoefficient: "125",
    unitCode: "cc"
  }));
  assert.deepEqual(
    cc.normalizationEvidence.measurementEvidence.normalizedQuantity,
    { coefficient: "125", scale: 0 }
  );
});

test("normalizes dozen to exact each", () => {
  const evidence = normalized(quote({
    ingredientId: INGREDIENT_COUNT,
    quantityCoefficient: "3",
    unitCode: "dozen"
  }));
  assert.deepEqual(
    evidence.normalizationEvidence.measurementEvidence.normalizedQuantity,
    { coefficient: "36", scale: 0 }
  );
});

test("zero Monetary Amount remains authoritative", () => {
  const evidence = normalized(quote({
    amountCoefficient: "0",
    amountScale: 6
  }));
  assert.deepEqual(evidence.monetaryAmount, {
    coefficient: "0",
    scale: 0,
    currencyCode: "TWD"
  });
});

test("signed-64-bit maximum and scale six round-trip without float conversion", () => {
  const maximum = normalized(quote({
    amountCoefficient: "9223372036854775807",
    amountScale: 0,
    quantityCoefficient: "9223372036854775807",
    quantityScale: 0,
    unitCode: "g"
  }));
  assert.equal(
    maximum.monetaryAmount.coefficient,
    "9223372036854775807"
  );
  assert.equal(
    maximum.normalizationEvidence.measurementEvidence.normalizedQuantity
      .coefficient,
    "9223372036854775807"
  );

  const scaleSix = normalized(quote({
    quantityCoefficient: "1",
    quantityScale: 6,
    unitCode: "g"
  }));
  assert.deepEqual(scaleSix.purchase.rawQuantity, {
    coefficient: "1",
    scale: 6
  });
  assert.deepEqual(
    scaleSix.normalizationEvidence.measurementEvidence.normalizedQuantity,
    { coefficient: "1", scale: 6 }
  );
});

test("effectiveFrom is inclusive and effectiveTo is exclusive", () => {
  assert.equal(
    service().normalize({
      quote: quote(),
      evaluatedAt: EFFECTIVE_FROM
    }).status,
    "normalized"
  );
  assertFailure(
    service().normalize({
      quote: quote(),
      evaluatedAt: EFFECTIVE_TO
    }),
    "QUOTE_NOT_AUTHORITATIVE_AT_INSTANT"
  );
});

test("open-ended Quote remains authoritative", () => {
  assert.equal(
    service().normalize({
      quote: quote({ effectiveTo: null }),
      evaluatedAt: "2030-01-01T00:00:00.000Z"
    }).status,
    "normalized"
  );
});

test("superseded Quote remains historical before supersededAt only", () => {
  const oldQuote = quote();
  const replacement = quote({
    quoteId: REPLACEMENT_ID,
    effectiveTo: null
  });
  oldQuote.supersedeWith(replacement, {
    supersededAt: PROFILE_CHANGE,
    supersededBy: "actor_cost"
  });
  const before = normalized(oldQuote, EVALUATED_AT);
  assert.equal(before.quoteState, "Superseded");
  assert.deepEqual(before.supersession, {
    supersededByQuoteId: REPLACEMENT_ID,
    supersededAt: PROFILE_CHANGE,
    supersededBy: "actor_cost"
  });
  assertFailure(
    service().normalize({
      quote: oldQuote,
      evaluatedAt: PROFILE_CHANGE
    }),
    "QUOTE_NOT_AUTHORITATIVE_AT_INSTANT"
  );
});

test("same Quote resolves the Profile effective at each evaluatedAt", () => {
  const history = [
    profile(
      INGREDIENT_MASS,
      "mass",
      "11111111-1111-4111-8111-111111111111",
      { state: "Superseded", effectiveTo: PROFILE_CHANGE }
    ),
    profile(
      INGREDIENT_MASS,
      "mass",
      "22222222-2222-4222-8222-222222222222",
      { effectiveFrom: PROFILE_CHANGE }
    )
  ];
  const authority = normalization(history);
  const before = normalized(quote(), EVALUATED_AT, authority);
  const after = normalized(quote(), AFTER_PROFILE_CHANGE, authority);
  assert.notEqual(
    before.normalizationEvidence.profileVersionId,
    after.normalizationEvidence.profileVersionId
  );
  assert.equal(before.evaluatedAt, EVALUATED_AT);
  assert.equal(after.evaluatedAt, AFTER_PROFILE_CHANGE);
});

test("invalid or timezone-offset evaluatedAt fails closed", () => {
  assertFailure(
    service().normalize({ quote: quote(), evaluatedAt: "not-a-time" }),
    "INVALID_QUOTE_NORMALIZATION_REQUEST"
  );
  assertFailure(
    service().normalize({
      quote: quote(),
      evaluatedAt: "2026-07-15T08:00:00.000+08:00"
    }),
    "INVALID_QUOTE_NORMALIZATION_REQUEST"
  );
});

test("missing and ambiguous Profiles retain typed classification", () => {
  assertFailure(
    service(normalization([])).normalize({
      quote: quote(),
      evaluatedAt: EVALUATED_AT
    }),
    "MISSING_INGREDIENT_MEASUREMENT_PROFILE"
  );
  assertFailure(
    service(normalization([baseProfiles[0]!, baseProfiles[0]!])).normalize({
      quote: quote(),
      evaluatedAt: EVALUATED_AT
    }),
    "AMBIGUOUS_INGREDIENT_MEASUREMENT_PROFILE"
  );
});

test("unknown legal Cost Unit codes remain UNKNOWN_PURCHASE_UNIT", () => {
  assertFailure(
    service().normalize({
      quote: quote({ unitCode: "stone" }),
      evaluatedAt: EVALUATED_AT
    }),
    "UNKNOWN_PURCHASE_UNIT"
  );
  assertFailure(
    service().normalize({
      quote: quote({ unitCode: "bag" }),
      evaluatedAt: EVALUATED_AT
    }),
    "UNKNOWN_PURCHASE_UNIT"
  );
  assertFailure(
    service().normalize({
      quote: quote({ unitCode: "jin" }),
      evaluatedAt: EVALUATED_AT
    }),
    "UNKNOWN_PURCHASE_UNIT"
  );
});

test("source failure codes map without message parsing", () => {
  const failureAuthority = (
    code: Extract<
      IngredientNormalizationResultV1,
      { status: "failed" }
    >["failure"]["code"]
  ): IngredientMeasurementNormalizationContractV1 => ({
    normalizeAt: () => ({
      status: "failed",
      failure: { code, message: "same diagnostic text" }
    })
  });
  assertFailure(
    service(failureAuthority("INCOMPATIBLE_MEASUREMENT_DIMENSION")).normalize({
      quote: quote(),
      evaluatedAt: EVALUATED_AT
    }),
    "MEASUREMENT_DIMENSION_MISMATCH"
  );
  assertFailure(
    service(failureAuthority("NON_EXACT_NORMALIZATION")).normalize({
      quote: quote(),
      evaluatedAt: EVALUATED_AT
    }),
    "NON_EXACT_NORMALIZATION"
  );
  assertFailure(
    service(failureAuthority("ARITHMETIC_OVERFLOW")).normalize({
      quote: quote(),
      evaluatedAt: EVALUATED_AT
    }),
    "NORMALIZATION_OVERFLOW"
  );
  assertFailure(
    service(failureAuthority("PACKAGE_SPECIFICATION_REQUIRED")).normalize({
      quote: quote(),
      evaluatedAt: EVALUATED_AT
    }),
    "PACKAGE_SPECIFICATION_REQUIRED"
  );
});

test("invalid Profile Version reference fails closed", () => {
  const actual = normalization().normalizeAt({
    contractVersion: INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
    ingredientId: INGREDIENT_MASS,
    rawQuantity: { coefficient: "2", scale: 0 },
    rawUnitValue: "kg",
    evaluatedAt: EVALUATED_AT
  });
  assert.equal(actual.status, "normalized");
  if (actual.status !== "normalized") {
    throw new Error("Expected fixture normalization.");
  }
  const authority: IngredientMeasurementNormalizationContractV1 = {
    normalizeAt: () => ({
      status: "normalized",
      evidence: { ...actual.evidence, profileVersionId: "" }
    })
  };
  assertFailure(
    service(authority).normalize({
      quote: quote(),
      evaluatedAt: EVALUATED_AT
    }),
    "INVALID_PROFILE_VERSION_REFERENCE"
  );
});

test("mismatched returned evidence is rejected", () => {
  const actual = normalization().normalizeAt({
    contractVersion: INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
    ingredientId: INGREDIENT_MASS,
    rawQuantity: { coefficient: "2", scale: 0 },
    rawUnitValue: "kg",
    evaluatedAt: EVALUATED_AT
  });
  assert.equal(actual.status, "normalized");
  if (actual.status !== "normalized") {
    throw new Error("Expected fixture normalization.");
  }
  const authority: IngredientMeasurementNormalizationContractV1 = {
    normalizeAt: () => ({
      status: "normalized",
      evidence: {
        ...actual.evidence,
        measurementEvidence: {
          ...actual.evidence.measurementEvidence,
          rawQuantity: { coefficient: "999", scale: 0 }
        }
      }
    })
  };
  assertFailure(
    service(authority).normalize({
      quote: quote(),
      evaluatedAt: EVALUATED_AT
    }),
    "INVALID_NORMALIZATION_EVIDENCE"
  );
});

test("authority exceptions cannot cross the typed result boundary", () => {
  const authority: IngredientMeasurementNormalizationContractV1 = {
    normalizeAt: () => {
      throw new Error("technical resolver failure");
    }
  };
  assertFailure(
    service(authority).normalize({
      quote: quote(),
      evaluatedAt: EVALUATED_AT
    }),
    "QUOTE_NORMALIZATION_FAILED"
  );
});

test("Evidence is deterministic, deeply immutable, and defensively copied", () => {
  const first = normalized();
  const second = normalized();
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.notEqual(first.normalizationEvidence, second.normalizationEvidence);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.monetaryAmount), true);
  assert.equal(Object.isFrozen(first.purchase), true);
  assert.equal(Object.isFrozen(first.purchase.rawQuantity), true);
  assert.equal(Object.isFrozen(first.effectivePeriod), true);
  assert.equal(Object.isFrozen(first.source), true);
  assert.equal(Object.isFrozen(first.recording), true);
  assert.equal(Object.isFrozen(first.normalizationEvidence), true);
  assert.equal(
    Object.isFrozen(
      first.normalizationEvidence.measurementEvidence.conversionRatio
    ),
    true
  );
});

test("Evidence contains no normalized unit cost or generated identity", () => {
  const evidence = normalized();
  assert.equal("evidenceId" in evidence, false);
  assert.equal("normalizedUnitCost" in evidence, false);
  assert.equal("unitCost" in evidence, false);
  assert.equal("lineCost" in evidence, false);
  assert.equal("totalCost" in evidence, false);
});
