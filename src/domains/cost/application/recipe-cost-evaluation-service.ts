import {
  RECIPE_CANONICAL_PROJECTION_CONTRACT_NAME,
  RECIPE_CANONICAL_PROJECTION_CONTRACT_VERSION
} from "../../recipe/contracts/recipe-canonical-projection-contract.js";
import {
  RECIPE_COSTING_CONTRACT_BASIS,
  RECIPE_COSTING_CONTRACT_NAME,
  RECIPE_COSTING_CONTRACT_VERSION
} from "../../recipe/contracts/recipe-costing-contract-v2.js";
import {
  INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_NAME,
  INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_VERSION,
  type IngredientCostQuoteNormalizationEvidenceV1
} from "../contracts/ingredient-cost-quote-normalization-evidence-contract.js";
import type {
  AcceptedPurchaseValuationEvidenceV1,
  CostEvaluationQuoteReader,
  CostEvaluationReadUnitOfWork
} from "../domain/cost-evaluation-read-unit-of-work.js";
import {
  AmbiguousEffectiveIngredientCostQuote
} from "../domain/errors.js";
import {
  ExactRational,
  ExactRationalError
} from "../domain/exact-rational.js";
import { assertIsoInstant } from "../domain/effective-period.js";
import { IngredientId } from "../domain/identities.js";
import {
  COST_ROUNDING_POLICY,
  COST_VALUATION_POLICY,
  RECIPE_COST_EVALUATION_BASIS,
  RECIPE_COST_EVALUATION_RESULT_CONTRACT_NAME,
  RECIPE_COST_EVALUATION_RESULT_CONTRACT_VERSION,
  type EvaluateRecipeCostCommand,
  type ExactRationalV1,
  type IngredientCostQuoteNormalizationPort,
  type RecipeCostEvaluationFailureV1,
  type RecipeCostEvaluationLineV1,
  type RecipeCostEvaluationOutcomeV1,
  type RecipeCostEvaluationResultV1
} from "../domain/recipe-cost-evaluation.js";
import { RecipeCostEvaluationError } from "./recipe-cost-evaluation-errors.js";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneAndFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => cloneAndFreeze(entry))) as T;
  }
  if (isRecord(value)) {
    const clone: UnknownRecord = {};
    for (const [key, entry] of Object.entries(value)) {
      clone[key] = cloneAndFreeze(entry);
    }
    return Object.freeze(clone) as T;
  }
  return value;
}

function rationalEvidence(value: ExactRational): ExactRationalV1 {
  return Object.freeze({
    numerator: value.numerator,
    denominator: value.denominator
  });
}

function fail(error: RecipeCostEvaluationError): RecipeCostEvaluationOutcomeV1 {
  const failure: RecipeCostEvaluationFailureV1 = Object.freeze({
    code: error.code,
    message: error.message,
    ...(error.details.ingredientId === undefined
      ? {}
      : { ingredientId: error.details.ingredientId }),
    ...(error.details.linePosition === undefined
      ? {}
      : { linePosition: error.details.linePosition }),
    ...(error.details.quoteIds === undefined
      ? {}
      : { quoteIds: Object.freeze([...error.details.quoteIds]) }),
    ...(error.details.sourceFailureCode === undefined
      ? {}
      : { sourceFailureCode: error.details.sourceFailureCode })
  });
  return Object.freeze({ status: "failed", failure });
}

function invalidContract(message: string): never {
  throw new RecipeCostEvaluationError(
    "INVALID_RECIPE_COSTING_CONTRACT",
    message
  );
}

function exactQuantity(
  value: unknown,
  field: string,
  requirePositive = false
): ExactRational {
  if (
    !isRecord(value)
    || typeof value.coefficient !== "string"
    || typeof value.scale !== "number"
  ) {
    invalidContract(`${field} exact quantity is incomplete.`);
  }
  try {
    const quantity = ExactRational.fromExactDecimal(
      value.coefficient,
      value.scale
    );
    if (requirePositive && !quantity.isPositive) {
      invalidContract(`${field} must be greater than zero.`);
    }
    return quantity;
  } catch (error) {
    if (error instanceof RecipeCostEvaluationError) {
      throw error;
    }
    invalidContract(`${field} exact quantity is invalid.`);
  }
}

function measurementIdentity(
  evidence: unknown,
  field: string,
  requirePositive = false
): Readonly<{
  dimension: string;
  canonicalUnitCode: string;
  quantity: ExactRational;
}> {
  if (
    !isRecord(evidence)
    || (
      evidence.dimension !== "mass"
      && evidence.dimension !== "volume"
      && evidence.dimension !== "count"
    )
    || (
      evidence.canonicalUnitCode !== "g"
      && evidence.canonicalUnitCode !== "ml"
      && evidence.canonicalUnitCode !== "each"
    )
  ) {
    invalidContract(`${field} Measurement evidence is invalid.`);
  }
  const expectedUnit = evidence.dimension === "mass"
    ? "g"
    : evidence.dimension === "volume"
      ? "ml"
      : "each";
  if (evidence.canonicalUnitCode !== expectedUnit) {
    invalidContract(`${field} dimension and canonical Unit disagree.`);
  }
  return Object.freeze({
    dimension: evidence.dimension,
    canonicalUnitCode: evidence.canonicalUnitCode,
    quantity: exactQuantity(
      evidence.normalizedQuantity,
      `${field}.normalizedQuantity`,
      requirePositive
    )
  });
}

function validateCommand(command: EvaluateRecipeCostCommand): string {
  if (!isRecord(command as unknown)) {
    throw new RecipeCostEvaluationError(
      "INVALID_COST_EVALUATION_REQUEST",
      "Cost Evaluation command is required."
    );
  }
  let evaluatedAt: string;
  try {
    evaluatedAt = assertIsoInstant(command.evaluatedAt, "evaluatedAt");
  } catch {
    throw new RecipeCostEvaluationError(
      "INVALID_COST_EVALUATION_REQUEST",
      "evaluatedAt must be a canonical ISO-8601 UTC instant."
    );
  }
  const recipe = command.recipe as unknown;
  if (!isRecord(recipe)) {
    invalidContract("Recipe Costing Contract v2 is required.");
  }
  if (
    recipe.contractName !== RECIPE_COSTING_CONTRACT_NAME
    || recipe.contractVersion !== RECIPE_COSTING_CONTRACT_VERSION
    || recipe.basis !== RECIPE_COSTING_CONTRACT_BASIS
    || recipe.sourceProjectionContractName
      !== RECIPE_CANONICAL_PROJECTION_CONTRACT_NAME
    || recipe.sourceProjectionContractVersion
      !== RECIPE_CANONICAL_PROJECTION_CONTRACT_VERSION
    || !isRecord(recipe.recipeProjection)
  ) {
    invalidContract("Recipe Costing Contract v2 identity is invalid.");
  }
  const projection = recipe.recipeProjection;
  if (
    projection.contractName !== RECIPE_CANONICAL_PROJECTION_CONTRACT_NAME
    || projection.contractVersion
      !== RECIPE_CANONICAL_PROJECTION_CONTRACT_VERSION
    || projection.basis !== "PUBLISHED_RECIPE_VERSION"
    || !Array.isArray(projection.lines)
    || projection.lines.length === 0
    || !isRecord(projection.standardOutput)
    || !isRecord(projection.standardYield)
  ) {
    invalidContract("Recipe Canonical Projection evidence is incomplete.");
  }
  measurementIdentity(projection.standardOutput, "standardOutput");
  measurementIdentity(projection.standardYield, "standardYield", true);
  for (const [position, line] of projection.lines.entries()) {
    if (
      !isRecord(line)
      || line.linePosition !== position
      || typeof line.ingredientId !== "string"
      || !isRecord(line.normalizationEvidence)
      || line.normalizationEvidence.ingredientId !== line.ingredientId
      || !isRecord(line.normalizationEvidence.measurementEvidence)
    ) {
      invalidContract(`Recipe Line ${position} evidence is invalid.`);
    }
    try {
      IngredientId.parse(line.ingredientId);
    } catch {
      invalidContract(`Recipe Line ${position} Ingredient identity is invalid.`);
    }
    measurementIdentity(
      line.normalizationEvidence.measurementEvidence,
      `lines[${position}]`,
      true
    );
  }
  return evaluatedAt;
}

function selectQuote(
  reader: CostEvaluationQuoteReader,
  ingredientId: IngredientId,
  evaluatedAt: string
) {
  try {
    const lookup = reader.findEffectiveQuoteAt(ingredientId, evaluatedAt);
    if (lookup.status === "not_found") {
      throw new RecipeCostEvaluationError(
        "MISSING_INGREDIENT_COST",
        "No authoritative Ingredient Cost Quote exists at evaluatedAt.",
        { ingredientId: ingredientId.value }
      );
    }
    return lookup.quote;
  } catch (error) {
    if (error instanceof RecipeCostEvaluationError) {
      throw error;
    }
    if (error instanceof AmbiguousEffectiveIngredientCostQuote) {
      throw new RecipeCostEvaluationError(
        "AMBIGUOUS_INGREDIENT_COST",
        "Multiple Ingredient Cost Quotes are authoritative at evaluatedAt.",
        {
          ingredientId: ingredientId.value,
          quoteIds: error.quoteIds
        }
      );
    }
    throw error;
  }
}

function validateQuoteEvidence(
  evidence: IngredientCostQuoteNormalizationEvidenceV1,
  selectedQuoteId: string,
  ingredientId: string,
  evaluatedAt: string
): Readonly<{
  amount: ExactRational;
  quantity: ExactRational;
  currencyCode: string;
  dimension: string;
  canonicalUnitCode: string;
}> {
  const measurement = evidence.normalizationEvidence.measurementEvidence;
  if (
    evidence.contractName
      !== INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_NAME
    || evidence.contractVersion
      !== INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_VERSION
    || evidence.basis !== "INGREDIENT_COST_QUOTE"
    || evidence.quoteId !== selectedQuoteId
    || evidence.ingredientId !== ingredientId
    || evidence.evaluatedAt !== evaluatedAt
    || evidence.normalizationEvidence.ingredientId !== ingredientId
    || evidence.normalizationEvidence.evaluatedAt !== evaluatedAt
  ) {
    throw new RecipeCostEvaluationError(
      "QUOTE_NORMALIZATION_FAILED",
      "Quote normalization evidence identity does not match the selected Quote, Ingredient, or evaluatedAt.",
      { ingredientId, sourceFailureCode: "INVALID_NORMALIZATION_EVIDENCE" }
    );
  }
  let amount: ExactRational;
  let quantity: ExactRational;
  try {
    amount = ExactRational.fromExactDecimal(
      evidence.monetaryAmount.coefficient,
      evidence.monetaryAmount.scale
    );
    quantity = ExactRational.fromExactDecimal(
      measurement.normalizedQuantity.coefficient,
      measurement.normalizedQuantity.scale
    );
  } catch {
    throw new RecipeCostEvaluationError(
      "QUOTE_NORMALIZATION_FAILED",
      "Quote normalization evidence contains invalid exact values.",
      { ingredientId, sourceFailureCode: "INVALID_NORMALIZATION_EVIDENCE" }
    );
  }
  if (!quantity.isPositive || amount.numerator.startsWith("-")) {
    throw new RecipeCostEvaluationError(
      "QUOTE_NORMALIZATION_FAILED",
      "Quote normalization evidence contains an invalid amount or quantity.",
      { ingredientId, sourceFailureCode: "INVALID_NORMALIZATION_EVIDENCE" }
    );
  }
  return Object.freeze({
    amount,
    quantity,
    currencyCode: evidence.monetaryAmount.currencyCode,
    dimension: measurement.dimension,
    canonicalUnitCode: measurement.canonicalUnitCode
  });
}

type CostFacts = Readonly<{
  amount: ExactRational;
  quantity: ExactRational;
  currencyCode: string;
  dimension: string;
  canonicalUnitCode: string;
}>;

function validateAcceptedPurchaseEvidence(
  evidence: AcceptedPurchaseValuationEvidenceV1,
  ingredientId: string,
  valuedAt: string
): CostFacts {
  try {
    const acceptedAt = assertIsoInstant(evidence.acceptedAt, "acceptedAt");
    if (
      !evidence.acceptedPurchaseId.trim()
      || !evidence.acceptedPurchaseLineId.trim()
      || !evidence.sourcePurchaseId.trim()
      || !evidence.supplierId.trim()
      || !evidence.profileId.trim()
      || !evidence.profileVersionId.trim()
      || !evidence.currencyCode.trim()
      || !evidence.dimension.trim()
      || !evidence.canonicalUnitCode.trim()
      || !Number.isSafeInteger(evidence.sourcePurchaseVersion)
      || evidence.sourcePurchaseVersion < 0
      || acceptedAt > valuedAt
    ) throw new Error("invalid Accepted Purchase evidence");
    const amount = ExactRational.fromExactDecimal(
      evidence.amountCoefficient,
      evidence.amountScale
    );
    const quantity = ExactRational.fromExactDecimal(
      evidence.normalizedQuantityCoefficient,
      evidence.normalizedQuantityScale
    );
    if (!quantity.isPositive || amount.numerator.startsWith("-")) {
      throw new Error("invalid Accepted Purchase amount or quantity");
    }
    return Object.freeze({
      amount,
      quantity,
      currencyCode: evidence.currencyCode,
      dimension: evidence.dimension,
      canonicalUnitCode: evidence.canonicalUnitCode
    });
  } catch {
    throw new RecipeCostEvaluationError(
      "ACCEPTED_PURCHASE_EVIDENCE_INVALID",
      "Accepted Purchase evidence is incomplete or invalid.",
      { ingredientId }
    );
  }
}

export class RecipeCostEvaluationService {
  constructor(
    private readonly readUnitOfWork: CostEvaluationReadUnitOfWork,
    private readonly quoteNormalization:
      IngredientCostQuoteNormalizationPort
  ) {}

  evaluate(command: EvaluateRecipeCostCommand): RecipeCostEvaluationOutcomeV1 {
    try {
      const evaluatedAt = validateCommand(command);
      return this.readUnitOfWork.execute((reader) =>
        this.evaluateWithinSnapshot(command, evaluatedAt, reader)
      );
    } catch (error) {
      if (error instanceof RecipeCostEvaluationError) {
        return fail(error);
      }
      if (error instanceof ExactRationalError) {
        return fail(new RecipeCostEvaluationError(
          "ARITHMETIC_FAILURE",
          "Exact Cost arithmetic failed."
        ));
      }
      return fail(new RecipeCostEvaluationError(
        "READ_TRANSACTION_FAILED",
        "Cost Evaluation read transaction failed."
      ));
    }
  }

  private evaluateWithinSnapshot(
    command: EvaluateRecipeCostCommand,
    evaluatedAt: string,
    reader: CostEvaluationQuoteReader
  ): RecipeCostEvaluationOutcomeV1 {
    const cache = new Map<string, Readonly<{
      facts: CostFacts;
      selectedSource: RecipeCostEvaluationLineV1["selectedSource"];
    }>>();
    const lines: RecipeCostEvaluationLineV1[] = [];
    let currencyCode: string | undefined;
    let standardBatchCost = ExactRational.create("0", "1");

    for (
      const line of command.recipe.recipeProjection.lines
    ) {
      const ingredientId = IngredientId.parse(line.ingredientId);
      let selected = cache.get(ingredientId.value);
      if (selected === undefined) {
        const actualCandidates = reader.findEligibleAcceptedPurchaseLines(
          ingredientId,
          evaluatedAt
        );
        if (actualCandidates.length > 0) {
          const rankedAt = actualCandidates[0]!.acceptedAt;
          const equallyRanked = actualCandidates.filter(
            (candidate) => candidate.acceptedAt === rankedAt
          );
          if (equallyRanked.length !== 1) {
            throw new RecipeCostEvaluationError(
              "AMBIGUOUS_ACCEPTED_PURCHASE_COST",
              "Multiple Accepted Purchase lines are equally ranked at valuedAt.",
              { ingredientId: ingredientId.value }
            );
          }
          const evidence = equallyRanked[0]!;
          const facts = validateAcceptedPurchaseEvidence(
            evidence,
            ingredientId.value,
            evaluatedAt
          );
          selected = Object.freeze({
            facts,
            selectedSource: Object.freeze({
              sourceType: "ActualPurchase" as const,
              acceptedPurchaseId: evidence.acceptedPurchaseId,
              acceptedPurchaseLineId: evidence.acceptedPurchaseLineId,
              sourcePurchaseId: evidence.sourcePurchaseId,
              sourcePurchaseVersion: evidence.sourcePurchaseVersion,
              supplierId: evidence.supplierId,
              acceptedAt: evidence.acceptedAt,
              currencyCode: facts.currencyCode,
              amount: rationalEvidence(facts.amount),
              normalizedQuantity: rationalEvidence(facts.quantity),
              dimension: facts.dimension,
              canonicalUnitCode: facts.canonicalUnitCode,
              profileId: evidence.profileId,
              profileVersionId: evidence.profileVersionId
            })
          });
        } else {
          const quote = selectQuote(reader, ingredientId, evaluatedAt);
          let normalization;
          try {
            normalization = this.quoteNormalization.normalize({ quote, evaluatedAt });
          } catch {
            throw new RecipeCostEvaluationError(
              "QUOTE_NORMALIZATION_FAILED",
              "Quote normalization authority failed.",
              { ingredientId: ingredientId.value }
            );
          }
          if (normalization.status === "failed") {
            throw new RecipeCostEvaluationError(
              "QUOTE_NORMALIZATION_FAILED",
              normalization.failure.message,
              { ingredientId: ingredientId.value, sourceFailureCode: normalization.failure.code }
            );
          }
          const quoteEvidence = cloneAndFreeze(normalization.evidence);
          const quoteFacts = validateQuoteEvidence(
            quoteEvidence, quote.quoteId.value, ingredientId.value, evaluatedAt
          );
          selected = Object.freeze({
            facts: quoteFacts,
            selectedSource: Object.freeze({
              sourceType: "QuoteFallback" as const,
              quoteNormalizationEvidence: quoteEvidence
            })
          });
        }
        cache.set(ingredientId.value, selected);
      }
      const sourceFacts = selected.facts;
      if (currencyCode === undefined) {
        currencyCode = sourceFacts.currencyCode;
      } else if (currencyCode !== sourceFacts.currencyCode) {
        throw new RecipeCostEvaluationError(
          "CURRENCY_MISMATCH",
          "All selected Ingredient Cost Quotes must use one Currency.",
          { ingredientId: ingredientId.value, linePosition: line.linePosition }
        );
      }
      const recipeMeasurement =
        line.normalizationEvidence.measurementEvidence;
      if (
        recipeMeasurement.dimension !== sourceFacts.dimension
        || recipeMeasurement.canonicalUnitCode
          !== sourceFacts.canonicalUnitCode
      ) {
        throw new RecipeCostEvaluationError(
          "MEASUREMENT_INCOMPATIBILITY",
          "Recipe and selected Cost evidence have incompatible canonical Measurement facts.",
          { ingredientId: ingredientId.value, linePosition: line.linePosition }
        );
      }
      const recipeQuantity = ExactRational.fromExactDecimal(
        recipeMeasurement.normalizedQuantity.coefficient,
        recipeMeasurement.normalizedQuantity.scale
      );
      const lineCost = sourceFacts.amount
        .multiply(recipeQuantity)
        .divide(sourceFacts.quantity);
      standardBatchCost = standardBatchCost.add(lineCost);
      lines.push(Object.freeze({
        linePosition: line.linePosition,
        ingredientId: ingredientId.value,
        recipeNormalizationEvidence:
          cloneAndFreeze(line.normalizationEvidence),
        selectedSource: selected.selectedSource,
        exactLineCost: rationalEvidence(lineCost)
      }));
    }

    if (currencyCode === undefined) {
      throw new RecipeCostEvaluationError(
        "INVALID_RECIPE_COSTING_CONTRACT",
        "Recipe Costing Contract must contain at least one Line."
      );
    }
    if (currencyCode !== "TWD") {
      throw new RecipeCostEvaluationError(
        "UNSUPPORTED_CURRENCY",
        "VAL-2 supports TWD only."
      );
    }
    const yieldQuantity = ExactRational.fromExactDecimal(
      command.recipe.recipeProjection.standardYield.normalizedQuantity
        .coefficient,
      command.recipe.recipeProjection.standardYield.normalizedQuantity.scale
    );
    if (!yieldQuantity.isPositive) {
      throw new RecipeCostEvaluationError(
        "ARITHMETIC_FAILURE",
        "Standard Yield must be greater than zero."
      );
    }
    const perYieldCost = standardBatchCost.divide(yieldQuantity);
    const result: RecipeCostEvaluationResultV1 = Object.freeze({
      contractName: RECIPE_COST_EVALUATION_RESULT_CONTRACT_NAME,
      contractVersion: RECIPE_COST_EVALUATION_RESULT_CONTRACT_VERSION,
      basis: RECIPE_COST_EVALUATION_BASIS,
      valuationPolicy: COST_VALUATION_POLICY,
      roundingPolicy: COST_ROUNDING_POLICY,
      evaluatedAt,
      currencyCode: "TWD",
      recipe: cloneAndFreeze(command.recipe),
      lines: Object.freeze(lines),
      standardOutput: cloneAndFreeze(
        command.recipe.recipeProjection.standardOutput
      ),
      standardYield: cloneAndFreeze(
        command.recipe.recipeProjection.standardYield
      ),
      exactStandardBatchCost: rationalEvidence(standardBatchCost),
      exactPerStandardYieldCost: rationalEvidence(perYieldCost)
    });
    return Object.freeze({ status: "evaluated", result });
  }
}
