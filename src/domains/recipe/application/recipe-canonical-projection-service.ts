import {
  INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
  type IngredientMeasurementNormalizationContractV1,
  type IngredientNormalizationEvidenceV1,
  type IngredientNormalizationFailureCodeV1
} from "../contracts/ingredient-measurement-profile-contract.js";
import {
  MEASUREMENT_FOUNDATION_CONTRACT_VERSION,
  type MeasurementExactQuantityV1,
  type MeasurementFoundationContractV1,
  type MeasurementNormalizationEvidenceV1
} from "../contracts/measurement-foundation-contract.js";
import {
  RECIPE_CANONICAL_PROJECTION_CONTRACT_NAME,
  RECIPE_CANONICAL_PROJECTION_CONTRACT_VERSION,
  type RecipeCanonicalProjectionFailureCodeV1,
  type RecipeCanonicalProjectionFailureV1,
  type RecipeCanonicalProjectionLineV1,
  type RecipeCanonicalProjectionResultV1,
  type RecipeCanonicalProjectionV1
} from "../contracts/recipe-canonical-projection-contract.js";
import type {
  CanonicalIngredientIdV1
} from "../contracts/canonical-ingredient-contract.js";
import type {
  PublishedExactQuantity,
  PublishedRecipeSnapshot
} from "../domain/published-recipe-snapshot.js";
import { RecipeCanonicalProjectionError } from "./recipe-canonical-projection-errors.js";

const CANONICAL_INGREDIENT_ID_PATTERN =
  /^ing_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function freezeFailure(
  code: RecipeCanonicalProjectionFailureCodeV1,
  message: string,
  linePosition?: number,
  sourceFailureCode?: IngredientNormalizationFailureCodeV1
): RecipeCanonicalProjectionResultV1 {
  const failure: RecipeCanonicalProjectionFailureV1 = Object.freeze({
    code,
    message,
    ...(linePosition === undefined ? {} : { linePosition }),
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

function cloneIngredientEvidence(
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

function exactQuantityMatches(
  source: PublishedExactQuantity,
  actual: MeasurementExactQuantityV1
): boolean {
  return source.coefficient === actual.coefficient
    && source.scale === actual.scale;
}

function expectedCanonicalUnit(
  dimension: PublishedExactQuantity["unit"]["dimension"]
): "g" | "ml" | "each" {
  if (dimension === "mass") {
    return "g";
  }
  if (dimension === "volume") {
    return "ml";
  }
  return "each";
}

function assertMeasurementEvidence(
  evidence: MeasurementNormalizationEvidenceV1,
  source: PublishedExactQuantity,
  failureCode: RecipeCanonicalProjectionFailureCodeV1,
  linePosition?: number
): void {
  if (
    evidence.contractVersion !== MEASUREMENT_FOUNDATION_CONTRACT_VERSION
    || evidence.dimension !== source.unit.dimension
    || evidence.rawUnitCode !== source.unit.code
    || !exactQuantityMatches(source, evidence.rawQuantity)
    || evidence.canonicalUnitCode !== expectedCanonicalUnit(evidence.dimension)
    || !evidence.conversionId.trim()
    || !Number.isInteger(evidence.conversionVersion)
    || evidence.conversionVersion <= 0
  ) {
    throw new RecipeCanonicalProjectionError(
      failureCode,
      "Normalization evidence does not match the immutable Recipe quantity.",
      linePosition
    );
  }
}

function assertIngredientEvidence(
  evidence: IngredientNormalizationEvidenceV1,
  source: PublishedExactQuantity,
  ingredientId: CanonicalIngredientIdV1,
  publishedAt: string,
  linePosition: number
): void {
  if (
    evidence.contractVersion !== INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION
    || evidence.ingredientId !== ingredientId
    || evidence.evaluatedAt !== publishedAt
    || evidence.rawUnitValue !== source.unit.code
  ) {
    throw new RecipeCanonicalProjectionError(
      "INVALID_NORMALIZATION_EVIDENCE",
      "Ingredient normalization evidence does not match the projected Recipe Line.",
      linePosition
    );
  }
  if (!evidence.profileId.trim() || !evidence.profileVersionId.trim()) {
    throw new RecipeCanonicalProjectionError(
      "INVALID_PROFILE_VERSION_REFERENCE",
      "Ingredient normalization evidence lacks a valid historical Profile Version reference.",
      linePosition
    );
  }
  assertMeasurementEvidence(
    evidence.measurementEvidence,
    source,
    "MEASUREMENT_DIMENSION_MISMATCH",
    linePosition
  );
}

function mapNormalizationFailure(
  sourceFailureCode: IngredientNormalizationFailureCodeV1
): RecipeCanonicalProjectionFailureCodeV1 {
  if (sourceFailureCode === "MISSING_ACTIVE_PROFILE") {
    return "MISSING_INGREDIENT_MEASUREMENT_PROFILE";
  }
  if (sourceFailureCode === "AMBIGUOUS_ACTIVE_PROFILE") {
    return "AMBIGUOUS_INGREDIENT_MEASUREMENT_PROFILE";
  }
  if (sourceFailureCode === "MISSING_HISTORICAL_PROFILE_VERSION") {
    return "INVALID_PROFILE_VERSION_REFERENCE";
  }
  if (sourceFailureCode === "INCOMPATIBLE_MEASUREMENT_DIMENSION") {
    return "MEASUREMENT_DIMENSION_MISMATCH";
  }
  return "INGREDIENT_NORMALIZATION_FAILED";
}

function assertSource(snapshot: PublishedRecipeSnapshot): void {
  if (
    (snapshot.state !== "Published" && snapshot.state !== "Superseded")
    || !snapshot.recipeId.trim()
    || !snapshot.recipeVersionId.trim()
    || !Number.isInteger(snapshot.versionNumber)
    || snapshot.versionNumber <= 0
    || !snapshot.product.productId.trim()
    || !snapshot.product.productVersionId.trim()
    || !snapshot.publishedAt.trim()
    || !snapshot.publishedBy.trim()
    || snapshot.lines.length === 0
  ) {
    throw new RecipeCanonicalProjectionError(
      "INVALID_RECIPE_PROJECTION_SOURCE",
      "Canonical Projection requires a complete immutable Published Recipe Version."
    );
  }
}

export class RecipeCanonicalProjectionService {
  constructor(
    private readonly ingredientNormalization:
      IngredientMeasurementNormalizationContractV1,
    private readonly measurement: MeasurementFoundationContractV1
  ) {}

  project(
    snapshot: PublishedRecipeSnapshot
  ): RecipeCanonicalProjectionResultV1 {
    try {
      assertSource(snapshot);
      const lines: RecipeCanonicalProjectionLineV1[] = [];

      for (const [linePosition, line] of snapshot.lines.entries()) {
        const ingredientId = line.ingredient.ingredientReferenceId;
        if (!CANONICAL_INGREDIENT_ID_PATTERN.test(ingredientId)) {
          throw new RecipeCanonicalProjectionError(
            "INVALID_CANONICAL_INGREDIENT_ID",
            "Recipe Line must reference the canonical ing_<uuid> identity.",
            linePosition
          );
        }

        let normalizationResult;
        try {
          normalizationResult = this.ingredientNormalization.normalizeAt({
            contractVersion:
              INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
            ingredientId,
            rawQuantity: {
              coefficient: line.quantity.coefficient,
              scale: line.quantity.scale
            },
            rawUnitValue: line.quantity.unit.code,
            evaluatedAt: snapshot.publishedAt
          });
        } catch {
          return freezeFailure(
            "INGREDIENT_NORMALIZATION_FAILED",
            "Ingredient normalization authority failed.",
            linePosition
          );
        }

        if (normalizationResult.status === "failed") {
          return freezeFailure(
            mapNormalizationFailure(normalizationResult.failure.code),
            normalizationResult.failure.message,
            linePosition,
            normalizationResult.failure.code
          );
        }

        assertIngredientEvidence(
          normalizationResult.evidence,
          line.quantity,
          ingredientId,
          snapshot.publishedAt,
          linePosition
        );
        lines.push(Object.freeze({
          linePosition,
          ingredientId,
          normalizationEvidence: cloneIngredientEvidence(
            normalizationResult.evidence
          )
        }));
      }

      const standardOutput = this.normalizeRecipeQuantity(
        snapshot.standardOutput,
        "STANDARD_OUTPUT_NORMALIZATION_FAILED"
      );
      const standardYield = this.normalizeRecipeQuantity(
        snapshot.standardYield,
        "STANDARD_YIELD_NORMALIZATION_FAILED"
      );

      const projection: RecipeCanonicalProjectionV1 = Object.freeze({
        contractName: RECIPE_CANONICAL_PROJECTION_CONTRACT_NAME,
        contractVersion: RECIPE_CANONICAL_PROJECTION_CONTRACT_VERSION,
        basis: "PUBLISHED_RECIPE_VERSION",
        recipeId: snapshot.recipeId,
        recipeVersionId: snapshot.recipeVersionId,
        versionNumber: snapshot.versionNumber,
        state: snapshot.state,
        product: Object.freeze({
          productId: snapshot.product.productId,
          productVersionId: snapshot.product.productVersionId
        }),
        lines: Object.freeze(lines),
        standardOutput,
        standardYield,
        publication: Object.freeze({
          publishedAt: snapshot.publishedAt,
          publishedBy: snapshot.publishedBy
        }),
        supersession: snapshot.supersession === null
          ? null
          : Object.freeze({
            supersededByRecipeVersionId:
              snapshot.supersession.supersededByRecipeVersionId,
            supersededAt: snapshot.supersession.supersededAt,
            supersededBy: snapshot.supersession.supersededBy,
            reason: snapshot.supersession.reason
          })
      });

      return Object.freeze({ status: "projected", projection });
    } catch (error) {
      if (error instanceof RecipeCanonicalProjectionError) {
        return freezeFailure(
          error.code,
          error.message,
          error.linePosition,
          error.sourceFailureCode
        );
      }
      return freezeFailure(
        "RECIPE_CANONICAL_PROJECTION_FAILED",
        "Recipe Canonical Projection failed."
      );
    }
  }

  private normalizeRecipeQuantity(
    source: PublishedExactQuantity,
    failureCode:
      | "STANDARD_OUTPUT_NORMALIZATION_FAILED"
      | "STANDARD_YIELD_NORMALIZATION_FAILED"
  ): MeasurementNormalizationEvidenceV1 {
    let evidence: MeasurementNormalizationEvidenceV1;
    try {
      evidence = this.measurement.normalize({
        contractVersion: MEASUREMENT_FOUNDATION_CONTRACT_VERSION,
        dimension: source.unit.dimension,
        rawQuantity: {
          coefficient: source.coefficient,
          scale: source.scale
        },
        rawUnitCode: source.unit.code
      });
    } catch {
      throw new RecipeCanonicalProjectionError(
        failureCode,
        "Recipe quantity normalization failed."
      );
    }
    assertMeasurementEvidence(evidence, source, failureCode);
    return cloneMeasurementEvidence(evidence);
  }
}
