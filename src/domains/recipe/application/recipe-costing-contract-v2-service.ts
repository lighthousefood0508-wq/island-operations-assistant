import {
  RECIPE_CANONICAL_PROJECTION_CONTRACT_NAME,
  RECIPE_CANONICAL_PROJECTION_CONTRACT_VERSION,
  type RecipeCanonicalProjectionV1
} from "../contracts/recipe-canonical-projection-contract.js";
import {
  RECIPE_COSTING_CONTRACT_BASIS,
  RECIPE_COSTING_CONTRACT_NAME,
  RECIPE_COSTING_CONTRACT_VERSION,
  type RecipeCostingContractFailureCodeV2,
  type RecipeCostingContractResultV2,
  type RecipeCostingContractV2
} from "../contracts/recipe-costing-contract-v2.js";
import { RecipeCostingContractV2Error } from "./recipe-costing-contract-v2-errors.js";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function fail(
  code: RecipeCostingContractFailureCodeV2,
  message: string
): RecipeCostingContractResultV2 {
  return Object.freeze({
    status: "failed",
    failure: Object.freeze({ code, message })
  });
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

function assertSourceIdentity(source: unknown): asserts source is UnknownRecord {
  if (!isRecord(source)) {
    throw new RecipeCostingContractV2Error(
      "INVALID_RECIPE_COSTING_CONTRACT_SOURCE",
      "Recipe Costing Contract requires a Recipe Canonical Projection."
    );
  }
  if (
    source.contractName !== RECIPE_CANONICAL_PROJECTION_CONTRACT_NAME
    || source.basis !== "PUBLISHED_RECIPE_VERSION"
  ) {
    throw new RecipeCostingContractV2Error(
      "INVALID_RECIPE_COSTING_CONTRACT_SOURCE",
      "Recipe Costing Contract source identity or basis is invalid."
    );
  }
  if (typeof source.contractVersion !== "number") {
    throw new RecipeCostingContractV2Error(
      "INVALID_RECIPE_COSTING_CONTRACT_SOURCE",
      "Recipe Costing Contract source version is missing."
    );
  }
  if (
    source.contractVersion
    !== RECIPE_CANONICAL_PROJECTION_CONTRACT_VERSION
  ) {
    throw new RecipeCostingContractV2Error(
      "UNSUPPORTED_RECIPE_CANONICAL_PROJECTION_VERSION",
      "Recipe Canonical Projection version is not supported."
    );
  }
}

function assertEvidenceStructure(source: UnknownRecord): void {
  const product = source.product;
  const publication = source.publication;
  const supersession = source.supersession;
  if (
    !isNonEmptyString(source.recipeId)
    || !isNonEmptyString(source.recipeVersionId)
    || !Number.isInteger(source.versionNumber)
    || (source.versionNumber as number) <= 0
    || (source.state !== "Published" && source.state !== "Superseded")
    || !isRecord(product)
    || !isNonEmptyString(product.productId)
    || !isNonEmptyString(product.productVersionId)
    || !isRecord(publication)
    || !isNonEmptyString(publication.publishedAt)
    || !isNonEmptyString(publication.publishedBy)
    || !isRecord(source.standardOutput)
    || !isRecord(source.standardYield)
    || !Array.isArray(source.lines)
    || source.lines.length === 0
  ) {
    throw new RecipeCostingContractV2Error(
      "INVALID_RECIPE_COSTING_EVIDENCE",
      "Recipe Canonical Projection structure is incomplete."
    );
  }

  if (
    (source.state === "Published" && supersession !== null)
    || (source.state === "Superseded" && !isRecord(supersession))
  ) {
    throw new RecipeCostingContractV2Error(
      "INVALID_RECIPE_COSTING_EVIDENCE",
      "Recipe state and supersession evidence are inconsistent."
    );
  }

  for (const [position, line] of source.lines.entries()) {
    if (!isRecord(line) || !isRecord(line.normalizationEvidence)) {
      throw new RecipeCostingContractV2Error(
        "INVALID_RECIPE_COSTING_EVIDENCE",
        "Recipe Line evidence is incomplete."
      );
    }
    const evidence = line.normalizationEvidence;
    if (
      line.linePosition !== position
      || !isNonEmptyString(line.ingredientId)
      || evidence.ingredientId !== line.ingredientId
      || evidence.evaluatedAt !== publication.publishedAt
      || !isNonEmptyString(evidence.profileId)
      || !isNonEmptyString(evidence.profileVersionId)
      || !isRecord(evidence.measurementEvidence)
    ) {
      throw new RecipeCostingContractV2Error(
        "INVALID_RECIPE_COSTING_EVIDENCE",
        "Recipe Line and normalization evidence are inconsistent."
      );
    }
  }
}

export class RecipeCostingContractV2Service {
  create(
    source: RecipeCanonicalProjectionV1
  ): RecipeCostingContractResultV2 {
    try {
      assertSourceIdentity(source);
      assertEvidenceStructure(source);
      const recipeProjection = cloneAndFreeze(source);
      const contract: RecipeCostingContractV2 = Object.freeze({
        contractName: RECIPE_COSTING_CONTRACT_NAME,
        contractVersion: RECIPE_COSTING_CONTRACT_VERSION,
        basis: RECIPE_COSTING_CONTRACT_BASIS,
        sourceProjectionContractName:
          RECIPE_CANONICAL_PROJECTION_CONTRACT_NAME,
        sourceProjectionContractVersion:
          RECIPE_CANONICAL_PROJECTION_CONTRACT_VERSION,
        recipeProjection
      });
      return Object.freeze({ status: "created", contract });
    } catch (error) {
      if (error instanceof RecipeCostingContractV2Error) {
        return fail(error.code, error.message);
      }
      return fail(
        "RECIPE_COSTING_CONTRACT_V2_FAILED",
        "Recipe Costing Contract v2 creation failed."
      );
    }
  }
}
