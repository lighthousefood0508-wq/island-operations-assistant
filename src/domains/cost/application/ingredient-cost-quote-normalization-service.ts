import {
  INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
  type IngredientMeasurementNormalizationContractV1,
  type IngredientNormalizationEvidenceV1,
  type IngredientNormalizationFailureCodeV1
} from "../../recipe/contracts/ingredient-measurement-profile-contract.js";
import type {
  MeasurementExactQuantityV1,
  MeasurementNormalizationEvidenceV1
} from "../../recipe/contracts/measurement-foundation-contract.js";
import {
  INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_NAME,
  INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_VERSION,
  type IngredientCostQuoteNormalizationEvidenceV1,
  type IngredientCostQuoteNormalizationFailureCodeV1,
  type IngredientCostQuoteNormalizationFailureV1,
  type IngredientCostQuoteNormalizationResultV1
} from "../contracts/ingredient-cost-quote-normalization-evidence-contract.js";
import { assertIsoInstant } from "../domain/effective-period.js";
import type { IngredientCostQuote } from "../domain/ingredient-cost-quote.js";
import { IngredientCostQuoteNormalizationError } from "./ingredient-cost-quote-normalization-errors.js";

export type NormalizeIngredientCostQuoteRequest = Readonly<{
  quote: IngredientCostQuote;
  evaluatedAt: string;
}>;

function freezeFailure(
  code: IngredientCostQuoteNormalizationFailureCodeV1,
  message: string,
  sourceFailureCode?: IngredientNormalizationFailureCodeV1
): IngredientCostQuoteNormalizationResultV1 {
  const failure: IngredientCostQuoteNormalizationFailureV1 = Object.freeze({
    code,
    message,
    ...(sourceFailureCode === undefined ? {} : { sourceFailureCode })
  });
  return Object.freeze({ status: "failed", failure });
}

function cloneExactQuantity(
  quantity: MeasurementExactQuantityV1
): MeasurementExactQuantityV1 {
  return Object.freeze({
    coefficient: quantity.coefficient,
    scale: quantity.scale
  });
}

function cloneMeasurementEvidence(
  evidence: MeasurementNormalizationEvidenceV1
): MeasurementNormalizationEvidenceV1 {
  return Object.freeze({
    contractVersion: evidence.contractVersion,
    dimension: evidence.dimension,
    rawQuantity: cloneExactQuantity(evidence.rawQuantity),
    rawUnitCode: evidence.rawUnitCode,
    conversionId: evidence.conversionId,
    conversionVersion: evidence.conversionVersion,
    conversionRatio: Object.freeze({
      numerator: evidence.conversionRatio.numerator,
      denominator: evidence.conversionRatio.denominator
    }),
    normalizedQuantity: cloneExactQuantity(evidence.normalizedQuantity),
    canonicalUnitCode: evidence.canonicalUnitCode
  });
}

function cloneNormalizationEvidence(
  evidence: IngredientNormalizationEvidenceV1
): IngredientNormalizationEvidenceV1 {
  return Object.freeze({
    contractVersion: evidence.contractVersion,
    ingredientId: evidence.ingredientId,
    profileId: evidence.profileId,
    profileVersionId: evidence.profileVersionId,
    evaluatedAt: evidence.evaluatedAt,
    rawUnitValue: evidence.rawUnitValue,
    source: Object.freeze({
      sourceType: evidence.source.sourceType,
      ...(evidence.source.referenceId === undefined
        ? {}
        : { referenceId: evidence.source.referenceId }),
      recordedAt: evidence.source.recordedAt,
      recordedBy: evidence.source.recordedBy
    }),
    ...(evidence.resolvedAlias === undefined
      ? {}
      : {
        resolvedAlias: Object.freeze({
          rawValue: evidence.resolvedAlias.rawValue,
          scope: evidence.resolvedAlias.scope,
          ...(evidence.resolvedAlias.locale === undefined
            ? {}
            : { locale: evidence.resolvedAlias.locale }),
          resolvedUnitCode: evidence.resolvedAlias.resolvedUnitCode
        })
      }),
    measurementEvidence: cloneMeasurementEvidence(
      evidence.measurementEvidence
    )
  });
}

function mapNormalizationFailure(
  sourceCode: IngredientNormalizationFailureCodeV1
): IngredientCostQuoteNormalizationFailureCodeV1 {
  if (sourceCode === "MISSING_ACTIVE_PROFILE") {
    return "MISSING_INGREDIENT_MEASUREMENT_PROFILE";
  }
  if (sourceCode === "AMBIGUOUS_ACTIVE_PROFILE") {
    return "AMBIGUOUS_INGREDIENT_MEASUREMENT_PROFILE";
  }
  if (sourceCode === "MISSING_HISTORICAL_PROFILE_VERSION") {
    return "INVALID_PROFILE_VERSION_REFERENCE";
  }
  if (
    sourceCode === "UNKNOWN_UNIT_ALIAS"
    || sourceCode === "AMBIGUOUS_UNIT_ALIAS"
    || sourceCode === "LOCALE_REQUIRED"
    || sourceCode === "UNSUPPORTED_LOCALE_ALIAS"
    || sourceCode === "UNIT_NOT_ALLOWED_BY_PROFILE"
    || sourceCode === "UNSUPPORTED_TAIWAN_UNIT"
  ) {
    return "UNKNOWN_PURCHASE_UNIT";
  }
  if (sourceCode === "PACKAGE_SPECIFICATION_REQUIRED") {
    return "PACKAGE_SPECIFICATION_REQUIRED";
  }
  if (sourceCode === "INCOMPATIBLE_MEASUREMENT_DIMENSION") {
    return "MEASUREMENT_DIMENSION_MISMATCH";
  }
  if (sourceCode === "NON_EXACT_NORMALIZATION") {
    return "NON_EXACT_NORMALIZATION";
  }
  if (sourceCode === "ARITHMETIC_OVERFLOW") {
    return "NORMALIZATION_OVERFLOW";
  }
  return "QUOTE_NORMALIZATION_FAILED";
}

function assertEvidenceMatchesQuote(
  evidence: IngredientNormalizationEvidenceV1,
  quote: IngredientCostQuote,
  evaluatedAt: string
): void {
  const measurement = evidence.measurementEvidence;
  if (
    evidence.contractVersion !==
      INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION
    || evidence.ingredientId !== quote.ingredientId.value
    || evidence.evaluatedAt !== evaluatedAt
    || evidence.rawUnitValue !== quote.purchaseUnit.code
    || measurement.rawQuantity.coefficient !==
      quote.purchaseQuantity.coefficient
    || measurement.rawQuantity.scale !== quote.purchaseQuantity.scale
    || !evidence.profileId.trim()
    || !evidence.profileVersionId.trim()
    || !measurement.conversionId.trim()
    || !Number.isInteger(measurement.conversionVersion)
    || measurement.conversionVersion <= 0
  ) {
    throw new IngredientCostQuoteNormalizationError(
      !evidence.profileId.trim() || !evidence.profileVersionId.trim()
        ? "INVALID_PROFILE_VERSION_REFERENCE"
        : "INVALID_NORMALIZATION_EVIDENCE",
      "Ingredient normalization evidence does not match the immutable Cost Quote."
    );
  }
}

export class IngredientCostQuoteNormalizationService {
  constructor(
    private readonly ingredientNormalization:
      IngredientMeasurementNormalizationContractV1
  ) {}

  normalize(
    request: NormalizeIngredientCostQuoteRequest
  ): IngredientCostQuoteNormalizationResultV1 {
    try {
      const evaluatedAt = assertIsoInstant(
        request.evaluatedAt,
        "evaluatedAt"
      );
      if (!request.quote.isAuthoritativeAt(evaluatedAt)) {
        return freezeFailure(
          "QUOTE_NOT_AUTHORITATIVE_AT_INSTANT",
          "Ingredient Cost Quote is not authoritative at evaluatedAt."
        );
      }

      let normalizationResult;
      try {
        normalizationResult = this.ingredientNormalization.normalizeAt({
          contractVersion:
            INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
          ingredientId: request.quote.ingredientId.value,
          rawQuantity: {
            coefficient: request.quote.purchaseQuantity.coefficient,
            scale: request.quote.purchaseQuantity.scale
          },
          rawUnitValue: request.quote.purchaseUnit.code,
          evaluatedAt
        });
      } catch {
        return freezeFailure(
          "QUOTE_NORMALIZATION_FAILED",
          "Ingredient normalization authority failed."
        );
      }

      if (normalizationResult.status === "failed") {
        return freezeFailure(
          mapNormalizationFailure(normalizationResult.failure.code),
          normalizationResult.failure.message,
          normalizationResult.failure.code
        );
      }

      assertEvidenceMatchesQuote(
        normalizationResult.evidence,
        request.quote,
        evaluatedAt
      );
      const quote = request.quote;
      const evidence: IngredientCostQuoteNormalizationEvidenceV1 =
        Object.freeze({
          contractName:
            INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_NAME,
          contractVersion:
            INGREDIENT_COST_QUOTE_NORMALIZATION_EVIDENCE_CONTRACT_VERSION,
          basis: "INGREDIENT_COST_QUOTE",
          quoteId: quote.quoteId.value,
          ingredientId: quote.ingredientId.value,
          evaluatedAt,
          quoteState: quote.state,
          monetaryAmount: Object.freeze({
            coefficient: quote.monetaryAmount.coefficient,
            scale: quote.monetaryAmount.scale,
            currencyCode: quote.monetaryAmount.currency.code
          }),
          purchase: Object.freeze({
            rawQuantity: Object.freeze({
              coefficient: quote.purchaseQuantity.coefficient,
              scale: quote.purchaseQuantity.scale
            }),
            rawUnitCode: quote.purchaseUnit.code
          }),
          effectivePeriod: Object.freeze({
            effectiveFrom: quote.effectivePeriod.effectiveFrom,
            ...(quote.effectivePeriod.effectiveTo === undefined
              ? {}
              : { effectiveTo: quote.effectivePeriod.effectiveTo })
          }),
          source: Object.freeze({
            sourceType: quote.source.sourceType,
            ...(quote.source.sourceReferenceId === undefined
              ? {}
              : { sourceReferenceId: quote.source.sourceReferenceId }),
            ...(quote.source.supplierId === undefined
              ? {}
              : { supplierId: quote.source.supplierId })
          }),
          recording: Object.freeze({
            recordedAt: quote.recordedAt,
            recordedBy: quote.recordedBy
          }),
          supersession: quote.supersession === undefined
            ? null
            : Object.freeze({
              supersededByQuoteId:
                quote.supersession.supersededByQuoteId.value,
              supersededAt: quote.supersession.supersededAt,
              supersededBy: quote.supersession.supersededBy
            }),
          normalizationEvidence: cloneNormalizationEvidence(
            normalizationResult.evidence
          )
        });
      return Object.freeze({ status: "normalized", evidence });
    } catch (error) {
      if (error instanceof IngredientCostQuoteNormalizationError) {
        return freezeFailure(
          error.code,
          error.message,
          error.sourceFailureCode
        );
      }
      return freezeFailure(
        "INVALID_QUOTE_NORMALIZATION_REQUEST",
        "Quote normalization request is invalid."
      );
    }
  }
}
