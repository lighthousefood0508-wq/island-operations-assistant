import { randomUUID } from "node:crypto";
import type { DatabaseAdapter } from "../../shared/database/database-adapter.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { CostQuoteLifecycleService } from "../../domains/cost/application/cost-quote-lifecycle-service.js";
import { IngredientCostQuoteNormalizationService } from "../../domains/cost/application/ingredient-cost-quote-normalization-service.js";
import { RecipeCostEvaluationService } from "../../domains/cost/application/recipe-cost-evaluation-service.js";
import { CostSource } from "../../domains/cost/domain/cost-source.js";
import { CostUnit } from "../../domains/cost/domain/cost-unit.js";
import { Currency } from "../../domains/cost/domain/currency.js";
import { EffectivePeriod } from "../../domains/cost/domain/effective-period.js";
import { CostDomainError } from "../../domains/cost/domain/errors.js";
import { ExactDecimal } from "../../domains/cost/domain/exact-decimal.js";
import {
  IngredientCostQuoteId,
  IngredientId
} from "../../domains/cost/domain/identities.js";
import { MonetaryAmount } from "../../domains/cost/domain/monetary-amount.js";
import { SqliteCostEvaluationReadUnitOfWork } from "../../domains/cost/infrastructure/sqlite-cost-evaluation-read-unit-of-work.js";
import { SqliteCostQuoteUnitOfWork } from "../../domains/cost/infrastructure/sqlite-cost-unit-of-work.js";
import { SqliteCostRepository } from "../../domains/cost/infrastructure/sqlite-cost-repository.js";
import { RecipeCanonicalProjectionService } from "../../domains/recipe/application/recipe-canonical-projection-service.js";
import { RecipeCostingContractV2Service } from "../../domains/recipe/application/recipe-costing-contract-v2-service.js";
import { RecipePublishService } from "../../domains/recipe/application/recipe-publish-service.js";
import type {
  CanonicalIngredientContractV1,
  CanonicalIngredientCreationService,
  IngredientMeasurementProfileCreationService,
  IngredientMeasurementProfileDeprecationService,
  IngredientMeasurementProfileReestablishmentService,
  IngredientMeasurementProfileSupersessionService,
  IngredientMeasurementProfileContractV1,
  MeasurementDimensionV1,
  StableMeasurementUnitCodeV1
} from "../../domains/recipe/index.js";
import {
  IngredientMeasurementProfileDeprecationExpectedVersionConflict,
  IngredientMeasurementProfileDeprecationIngredientInactive,
  IngredientMeasurementProfileDeprecationNotFound,
  IngredientMeasurementProfileDeprecationPersistenceFailure,
  IngredientMeasurementProfileReestablishmentExpectedVersionConflict,
  IngredientMeasurementProfileReestablishmentIngredientInactive,
  IngredientMeasurementProfileReestablishmentMeasurementFailure,
  IngredientMeasurementProfileReestablishmentNotFound,
  IngredientMeasurementProfileReestablishmentPersistenceFailure,
  IngredientMeasurementProfileSupersessionExpectedVersionConflict,
  IngredientMeasurementProfileSupersessionIngredientInactive,
  IngredientMeasurementProfileSupersessionMeasurementFailure,
  IngredientMeasurementProfileSupersessionNotFound,
  IngredientMeasurementProfileSupersessionPersistenceFailure,
  IngredientReference,
  Quantity,
  RecipeDraftId,
  RecipeId,
  RecipeSnapshotBuilder,
  RecipeVersionId,
  Unit,
  VersionNumber
} from "../../domains/recipe/index.js";
import { CanonicalIngredientId } from "../../domains/recipe/ingredient-catalog/identities.js";
import { SqliteCanonicalIngredientRepository } from "../../domains/recipe/ingredient-catalog/infrastructure/sqlite-canonical-ingredient-repository.js";
import { SqliteRecipeRepository } from "../../domains/recipe/infrastructure/sqlite-recipe-repository.js";
import { MeasurementNormalizer } from "../../domains/recipe/measurement/measurement-normalizer.js";
import { MeasurementUnitResolver } from "../../domains/recipe/measurement/measurement-unit-resolver.js";
import { IngredientMeasurementNormalizationService } from "../../domains/recipe/measurement-profile/ingredient-normalization-service.js";
import { SqliteIngredientMeasurementProfileRepository } from "../../domains/recipe/measurement-profile/infrastructure/sqlite-ingredient-measurement-profile-repository.js";

type JsonObject = Record<string, unknown>;

function text(input: JsonObject, field: string): string {
  const value = input[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(422, "invalid_cost_input", `${field} is required.`, {
      field
    });
  }
  return value.trim();
}

function optionalText(input: JsonObject, field: string): string | undefined {
  const value = input[field];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new HttpError(422, "invalid_cost_input", `${field} must be text.`, {
      field
    });
  }
  return value.trim() || undefined;
}

function integer(input: JsonObject, field: string): number {
  const value = input[field];
  if (!Number.isSafeInteger(value)) {
    throw new HttpError(
      422,
      "invalid_cost_input",
      `${field} must be a safe integer.`,
      { field }
    );
  }
  return value as number;
}

function dimension(input: JsonObject, field: string): MeasurementDimensionV1 {
  const value = text(input, field);
  if (value !== "mass" && value !== "volume" && value !== "count") {
    throw new HttpError(422, "invalid_cost_input", `${field} is invalid.`, {
      field
    });
  }
  return value;
}

function unitCodes(input: JsonObject): readonly StableMeasurementUnitCodeV1[] {
  const value = input.allowedUnitCodes;
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError(
      422,
      "invalid_cost_input",
      "allowedUnitCodes must contain at least one Unit.",
      { field: "allowedUnitCodes" }
    );
  }
  return Object.freeze(value.map((entry) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new HttpError(
        422,
        "invalid_cost_input",
        "allowedUnitCodes contains an invalid Unit.",
        { field: "allowedUnitCodes" }
      );
    }
    return entry.trim() as StableMeasurementUnitCodeV1;
  }));
}

function rawTextValues(input: JsonObject, field: string): readonly string[] {
  const value = input[field];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new HttpError(422, "invalid_cost_input", `${field} must contain text values.`, {
      field
    });
  }
  return Object.freeze(value);
}

function objectArray(input: JsonObject, field: string): readonly JsonObject[] {
  const value = input[field];
  if (
    !Array.isArray(value)
    || value.length === 0
    || value.some((entry) =>
      entry === null || typeof entry !== "object" || Array.isArray(entry)
    )
  ) {
    throw new HttpError(
      422,
      "invalid_cost_input",
      `${field} must contain at least one item.`,
      { field }
    );
  }
  return value as readonly JsonObject[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The operation failed.";
}

export class CostBackOfficeService {
  private readonly ingredientRepository:
    SqliteCanonicalIngredientRepository;
  private readonly profileRepository:
    SqliteIngredientMeasurementProfileRepository;
  private readonly recipeRepository: SqliteRecipeRepository;
  private readonly quoteRepository: SqliteCostRepository;
  private readonly unitResolver = new MeasurementUnitResolver();
  private readonly recipePublisher: RecipePublishService;
  private readonly recipeProjection: RecipeCanonicalProjectionService;
  private readonly recipeCosting = new RecipeCostingContractV2Service();
  private readonly quoteLifecycle: CostQuoteLifecycleService;
  private readonly evaluator: RecipeCostEvaluationService;

  constructor(
    private readonly database: DatabaseAdapter,
    private readonly canonicalIngredientCreation: Pick<CanonicalIngredientCreationService, "create">,
    private readonly profileCreation: Pick<IngredientMeasurementProfileCreationService, "create">,
    private readonly profileSupersession: Pick<IngredientMeasurementProfileSupersessionService, "supersede">,
    private readonly profileDeprecation: Pick<IngredientMeasurementProfileDeprecationService, "deprecate">,
    private readonly profileReestablishment: Pick<IngredientMeasurementProfileReestablishmentService, "appendDraft" | "reviseDraft" | "activateDraft">
  ) {
    this.ingredientRepository =
      new SqliteCanonicalIngredientRepository(database);
    this.profileRepository =
      new SqliteIngredientMeasurementProfileRepository(
        database,
        this.unitResolver
      );
    this.recipeRepository = new SqliteRecipeRepository(database);
    this.quoteRepository = new SqliteCostRepository(database);
    const measurement = new MeasurementNormalizer();
    const ingredientNormalization =
      new IngredientMeasurementNormalizationService(
        this.profileRepository,
        this.unitResolver,
        measurement
      );
    this.recipePublisher = new RecipePublishService(this.recipeRepository);
    this.recipeProjection = new RecipeCanonicalProjectionService(
      ingredientNormalization,
      measurement
    );
    this.quoteLifecycle = new CostQuoteLifecycleService(
      new SqliteCostQuoteUnitOfWork(database)
    );
    this.evaluator = new RecipeCostEvaluationService(
      new SqliteCostEvaluationReadUnitOfWork(database),
      new IngredientCostQuoteNormalizationService(ingredientNormalization)
    );
  }

  getSetup(): Readonly<{
    ingredients: readonly CanonicalIngredientContractV1[];
    profiles: readonly IngredientMeasurementProfileContractV1[];
    recipes: ReturnType<SqliteRecipeRepository["listRecipes"]>;
  }> {
    return Object.freeze({
      ingredients: Object.freeze(
        this.ingredientRepository.listActive()
          .map((ingredient) => ingredient.toContract())
      ),
      profiles: this.profileRepository.listProfiles(),
      recipes: this.recipeRepository.listRecipes()
    });
  }

  createIngredient(input: JsonObject) {
    try {
      return this.canonicalIngredientCreation.create({
        name: text(input, "name"),
        categoryCode: text(input, "categoryCode"),
        occurredAt: text(input, "occurredAt"),
        actor: text(input, "actor")
      });
    } catch (error) {
      throw this.invalidOperation("ingredient_invalid", error);
    }
  }

  createProfile(input: JsonObject): IngredientMeasurementProfileContractV1 {
    try {
      return this.profileCreation.create({
        ingredientId: text(input, "ingredientId"),
        dimension: text(input, "dimension"),
        canonicalUnitCode: text(input, "canonicalUnitCode"),
        allowedUnitCodes: rawTextValues(input, "allowedUnitCodes"),
        occurredAt: text(input, "occurredAt"),
        actor: text(input, "actor")
      });
    } catch (error) {
      throw this.invalidOperation("measurement_profile_invalid", error);
    }
  }

  supersedeProfile(profileId: string, input: JsonObject): IngredientMeasurementProfileContractV1 {
    try {
      const reason = optionalText(input, "reason");
      return this.profileSupersession.supersede({
        profileId,
        expectedVersion: integer(input, "expectedVersion"),
        dimension: text(input, "dimension"),
        canonicalUnitCode: text(input, "canonicalUnitCode"),
        allowedUnitCodes: rawTextValues(input, "allowedUnitCodes"),
        occurredAt: text(input, "occurredAt"),
        actor: text(input, "actor"),
        ...(reason === undefined
          ? {}
          : { reason })
      });
    } catch (error) {
      throw this.supersessionOperation(error);
    }
  }

  deprecateProfile(profileId: string, input: JsonObject): IngredientMeasurementProfileContractV1 {
    try {
      const reason = optionalText(input, "reason");
      return this.profileDeprecation.deprecate({
        profileId,
        expectedVersion: integer(input, "expectedVersion"),
        occurredAt: text(input, "occurredAt"),
        actor: text(input, "actor"),
        ...(reason === undefined ? {} : { reason })
      });
    } catch (error) {
      throw this.deprecationOperation(error);
    }
  }

  appendProfileReestablishmentDraft(profileId: string, input: JsonObject): IngredientMeasurementProfileContractV1 {
    try {
      const reason = optionalText(input, "reason");
      return this.profileReestablishment.appendDraft({ profileId, expectedVersion: integer(input, "expectedVersion"), dimension: text(input, "dimension"), canonicalUnitCode: text(input, "canonicalUnitCode"), allowedUnitCodes: rawTextValues(input, "allowedUnitCodes"), occurredAt: text(input, "occurredAt"), actor: text(input, "actor"), ...(reason === undefined ? {} : { reason }) });
    } catch (error) { throw this.reestablishmentOperation(error); }
  }

  reviseProfileReestablishmentDraft(profileId: string, draftVersionId: string, input: JsonObject): IngredientMeasurementProfileContractV1 {
    try {
      const reason = optionalText(input, "reason");
      return this.profileReestablishment.reviseDraft({ profileId, draftVersionId, expectedVersion: integer(input, "expectedVersion"), dimension: text(input, "dimension"), canonicalUnitCode: text(input, "canonicalUnitCode"), allowedUnitCodes: rawTextValues(input, "allowedUnitCodes"), occurredAt: text(input, "occurredAt"), actor: text(input, "actor"), ...(reason === undefined ? {} : { reason }) });
    } catch (error) { throw this.reestablishmentOperation(error); }
  }

  activateProfileReestablishmentDraft(profileId: string, draftVersionId: string, input: JsonObject): IngredientMeasurementProfileContractV1 {
    try {
      const reason = optionalText(input, "reason");
      return this.profileReestablishment.activateDraft({ profileId, draftVersionId, expectedVersion: integer(input, "expectedVersion"), occurredAt: text(input, "occurredAt"), actor: text(input, "actor"), ...(reason === undefined ? {} : { reason }) });
    } catch (error) { throw this.reestablishmentOperation(error); }
  }

  createAndPublishRecipe(input: JsonObject) {
    try {
      return this.database.transactionImmediate(() => {
        const occurredAt = text(input, "occurredAt");
        const actor = text(input, "actor");
        const created = this.recipePublisher.createDraft({
          recipeId: RecipeId.fromUuid(randomUUID()),
          draftId: RecipeDraftId.fromUuid(randomUUID()),
          name: text(input, "name"),
          createdBy: actor,
          createdAt: occurredAt
        });
        const recipe = created.draft;
        recipe.bindProduct(
          text(input, "productId"),
          text(input, "productVersionId")
        );
        for (const line of objectArray(input, "lines")) {
          const ingredient = this.ingredientRepository.findById(
            CanonicalIngredientId.parse(text(line, "ingredientId"))
          );
          if (ingredient === undefined) {
            throw new Error("Recipe Ingredient does not exist.");
          }
          const lineDimension = dimension(line, "dimension");
          recipe.addIngredient(
            IngredientReference.create({
              ingredientReferenceId: ingredient.ingredientId,
              canonicalName: ingredient.name,
              measurementDimension: lineDimension,
              status: ingredient.status === "Active" ? "active" : "inactive",
              createdAt: ingredient.createdAt
            }),
            Quantity.create(
              BigInt(text(line, "coefficient")),
              integer(line, "scale"),
              Unit.create(text(line, "unitCode"), lineDimension)
            )
          );
        }
        const output = input.standardOutput as JsonObject;
        const yieldQuantity = input.standardYield as JsonObject;
        if (
          output === null || typeof output !== "object"
          || yieldQuantity === null || typeof yieldQuantity !== "object"
        ) {
          throw new Error("standardOutput and standardYield are required.");
        }
        const outputDimension = dimension(output, "dimension");
        const yieldDimension = dimension(yieldQuantity, "dimension");
        recipe.defineStandardOutput(
          Quantity.create(
            BigInt(text(output, "coefficient")),
            integer(output, "scale"),
            Unit.create(text(output, "unitCode"), outputDimension)
          ),
          Quantity.create(
            BigInt(text(yieldQuantity, "coefficient")),
            integer(yieldQuantity, "scale"),
            Unit.create(text(yieldQuantity, "unitCode"), yieldDimension)
          )
        );
        const configuredVersion = this.recipeRepository
          .saveWithExpectedVersion(recipe, created.aggregateVersion);
        const published = this.recipePublisher.publish({
          recipeId: recipe.recipeId,
          recipeVersionId: RecipeVersionId.fromUuid(randomUUID()),
          versionNumber: VersionNumber.create(1),
          expectedAggregateVersion: configuredVersion,
          publishedBy: actor,
          publishedAt: occurredAt
        });
        return Object.freeze({
          recipeId: published.snapshot.recipeId,
          recipeVersionId: published.snapshot.recipeVersionId,
          aggregateVersion: published.aggregateVersion,
          state: published.snapshot.state,
          name: published.snapshot.name
        });
      });
    } catch (error) {
      throw this.invalidOperation("recipe_invalid", error);
    }
  }

  recordQuote(input: JsonObject) {
    try {
      const result = this.quoteLifecycle.recordInitialQuote({
        quoteId: IngredientCostQuoteId.fromUuid(randomUUID()),
        ingredientId: IngredientId.parse(text(input, "ingredientId")),
        monetaryAmount: MonetaryAmount.create(
          text(input, "amountCoefficient"),
          integer(input, "amountScale"),
          Currency.TWD()
        ),
        purchaseQuantity: ExactDecimal.create(
          text(input, "quantityCoefficient"),
          integer(input, "quantityScale")
        ),
        purchaseUnit: CostUnit.create(text(input, "unitCode")),
        effectivePeriod: EffectivePeriod.create(
          text(input, "effectiveFrom"),
          optionalText(input, "effectiveTo")
        ),
        source: CostSource.create({
          sourceType: "manual",
          sourceReferenceId: optionalText(input, "sourceReferenceId")
        }),
        recordedAt: text(input, "recordedAt"),
        recordedBy: text(input, "actor")
      });
      return Object.freeze({
        status: result.status,
        quoteId: result.quoteId.value,
        aggregateVersion: result.aggregateVersion
      });
    } catch (error) {
      throw this.invalidOperation("quote_invalid", error);
    }
  }

  replaceQuote(oldQuoteId: string, input: JsonObject) {
    try {
      const supersededAt = text(input, "supersededAt");
      const actor = text(input, "actor");
      const result = this.quoteLifecycle.replaceEffectiveQuote({
        oldQuoteId: IngredientCostQuoteId.parse(oldQuoteId),
        expectedVersion: integer(input, "expectedVersion"),
        newQuote: {
          quoteId: IngredientCostQuoteId.fromUuid(randomUUID()),
          ingredientId: IngredientId.parse(text(input, "ingredientId")),
          monetaryAmount: MonetaryAmount.create(
            text(input, "amountCoefficient"),
            integer(input, "amountScale"),
            Currency.TWD()
          ),
          purchaseQuantity: ExactDecimal.create(
            text(input, "quantityCoefficient"),
            integer(input, "quantityScale")
          ),
          purchaseUnit: CostUnit.create(text(input, "unitCode")),
          effectivePeriod: EffectivePeriod.create(
            supersededAt,
            optionalText(input, "effectiveTo")
          ),
          source: CostSource.create({
            sourceType: "manual",
            sourceReferenceId: optionalText(input, "sourceReferenceId")
          }),
          recordedAt: text(input, "recordedAt"),
          recordedBy: actor
        },
        supersededAt,
        supersededBy: actor
      });
      return Object.freeze({
        status: result.status,
        oldQuoteId: result.oldQuoteId.value,
        newQuoteId: result.newQuoteId.value,
        oldAggregateVersion: result.oldAggregateVersion,
        newAggregateVersion: result.newAggregateVersion
      });
    } catch (error) {
      throw this.invalidOperation("quote_replacement_invalid", error);
    }
  }

  listQuotes(ingredientId: string) {
    try {
      return Object.freeze(
        this.quoteRepository.findQuotesByIngredientId(
          IngredientId.parse(ingredientId)
        ).map((quote) => Object.freeze({
          quoteId: quote.quoteId.value,
          ingredientId: quote.ingredientId.value,
          state: quote.state,
          aggregateVersion: quote.aggregateVersion,
          amount: Object.freeze({
            coefficient: quote.monetaryAmount.coefficient,
            scale: quote.monetaryAmount.scale,
            currencyCode: quote.monetaryAmount.currency.code
          }),
          purchaseQuantity: Object.freeze({
            coefficient: quote.purchaseQuantity.coefficient,
            scale: quote.purchaseQuantity.scale,
            unitCode: quote.purchaseUnit.code
          }),
          effectiveFrom: quote.effectivePeriod.effectiveFrom,
          effectiveTo: quote.effectivePeriod.effectiveTo ?? null,
          recordedAt: quote.recordedAt,
          supersession: quote.supersession === undefined
            ? null
            : Object.freeze({
              supersededByQuoteId:
                quote.supersession.supersededByQuoteId.value,
              supersededAt: quote.supersession.supersededAt,
              supersededBy: quote.supersession.supersededBy
            })
        }))
      );
    } catch (error) {
      throw this.invalidOperation("quote_lookup_failed", error);
    }
  }

  evaluate(input: JsonObject) {
    try {
      const recipe = this.recipeRepository.findPublishedVersion(
        RecipeId.parse(text(input, "recipeId"))
      );
      if (recipe === undefined) {
        throw new Error("Published Recipe was not found.");
      }
      const snapshot = new RecipeSnapshotBuilder().build(recipe.aggregate);
      const projection = this.recipeProjection.project(snapshot);
      if (projection.status === "failed") return projection;
      const costing = this.recipeCosting.create(projection.projection);
      if (costing.status === "failed") return costing;
      return this.evaluator.evaluate({
        recipe: costing.contract,
        evaluatedAt: text(input, "evaluatedAt")
      });
    } catch (error) {
      throw this.invalidOperation("cost_evaluation_invalid", error);
    }
  }

  private invalidOperation(code: string, error: unknown): HttpError {
    if (error instanceof HttpError) return error;
    if (error instanceof CostDomainError) {
      const status = error.code === "INGREDIENT_COST_QUOTE_LIFECYCLE_NOT_FOUND"
        ? 404
        : error.code.includes("CONFLICT")
          || error.code.includes("OVERLAP")
          || error.code.includes("ALREADY_SUPERSEDED")
          ? 409
          : 422;
      return new HttpError(status, error.code, error.message);
    }
    return new HttpError(422, code, errorMessage(error));
  }

  private supersessionOperation(error: unknown): HttpError {
    if (error instanceof HttpError) {
      if (error.code !== "invalid_cost_input") return error;
      return new HttpError(
        422,
        "measurement_profile_supersession_invalid",
        "Measurement Profile supersession command is not valid for the current Profile state."
      );
    }
    if (error instanceof IngredientMeasurementProfileSupersessionNotFound) {
      return new HttpError(404, "measurement_profile_not_found", "Ingredient Measurement Profile was not found.");
    }
    if (error instanceof IngredientMeasurementProfileSupersessionExpectedVersionConflict) {
      return new HttpError(409, "measurement_profile_expected_version_conflict", "Measurement Profile changed before supersession could be persisted.");
    }
    if (error instanceof IngredientMeasurementProfileSupersessionIngredientInactive) {
      return new HttpError(422, "measurement_profile_ingredient_inactive", "Canonical Ingredient must be Active to supersede its Measurement Profile.");
    }
    if (error instanceof IngredientMeasurementProfileSupersessionMeasurementFailure) {
      return new HttpError(422, "measurement_profile_measurement_resolution_failed", "Replacement Measurement Profile facts could not be resolved.");
    }
    if (error instanceof IngredientMeasurementProfileSupersessionPersistenceFailure) {
      return new HttpError(500, "measurement_profile_supersession_persistence_failed", "Measurement Profile supersession could not be persisted.");
    }
    return new HttpError(422, "measurement_profile_supersession_invalid", "Measurement Profile supersession command is not valid for the current Profile state.");
  }

  private deprecationOperation(error: unknown): HttpError {
    if (error instanceof HttpError) {
      if (error.code !== "invalid_cost_input") return error;
      return new HttpError(
        422,
        "measurement_profile_deprecation_invalid",
        "Measurement Profile deprecation command is not valid for the current Profile state."
      );
    }
    if (error instanceof IngredientMeasurementProfileDeprecationNotFound) {
      return new HttpError(404, "measurement_profile_not_found", "Ingredient Measurement Profile was not found.");
    }
    if (error instanceof IngredientMeasurementProfileDeprecationExpectedVersionConflict) {
      return new HttpError(409, "measurement_profile_expected_version_conflict", "Measurement Profile changed before deprecation could be persisted.");
    }
    if (error instanceof IngredientMeasurementProfileDeprecationIngredientInactive) {
      return new HttpError(422, "measurement_profile_ingredient_inactive", "Canonical Ingredient must be Active to deprecate its Measurement Profile.");
    }
    if (error instanceof IngredientMeasurementProfileDeprecationPersistenceFailure) {
      return new HttpError(500, "measurement_profile_deprecation_persistence_failed", "Measurement Profile deprecation could not be persisted.");
    }
    return new HttpError(422, "measurement_profile_deprecation_invalid", "Measurement Profile deprecation command is not valid for the current Profile state.");
  }

  private reestablishmentOperation(error: unknown): HttpError {
    if (error instanceof HttpError) return new HttpError(422, "measurement_profile_reestablishment_invalid", "Measurement Profile re-establishment command is not valid for the current Profile state.");
    if (error instanceof IngredientMeasurementProfileReestablishmentNotFound) return new HttpError(404, "measurement_profile_not_found", "Ingredient Measurement Profile or Draft Version was not found.");
    if (error instanceof IngredientMeasurementProfileReestablishmentExpectedVersionConflict) return new HttpError(409, "measurement_profile_expected_version_conflict", "Measurement Profile changed before re-establishment could be persisted.");
    if (error instanceof IngredientMeasurementProfileReestablishmentIngredientInactive) return new HttpError(422, "measurement_profile_ingredient_inactive", "Canonical Ingredient must be Active to re-establish its Measurement Profile.");
    if (error instanceof IngredientMeasurementProfileReestablishmentMeasurementFailure) return new HttpError(422, "measurement_profile_measurement_resolution_failed", "Measurement Profile facts could not be resolved.");
    if (error instanceof IngredientMeasurementProfileReestablishmentPersistenceFailure) return new HttpError(500, "measurement_profile_reestablishment_persistence_failed", "Measurement Profile re-establishment could not be persisted.");
    return new HttpError(422, "measurement_profile_reestablishment_invalid", "Measurement Profile re-establishment command is not valid for the current Profile state.");
  }
}
