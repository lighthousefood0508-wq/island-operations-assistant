import { randomUUID } from "node:crypto";
import type {
  IngredientMeasurementProfileContractV1
} from "../../contracts/ingredient-measurement-profile-contract.js";
import type {
  MeasurementProfileFactsResolutionContractV1,
  ResolvedMeasurementProfileFactsV1,
  MeasurementUnitResolutionContractV1
} from "../../contracts/measurement-foundation-contract.js";
import { CanonicalIngredientId } from "../../ingredient-catalog/identities.js";
import { IngredientMeasurementProfile } from "../ingredient-measurement-profile.js";
import {
  IngredientMeasurementProfileCreationIngredientInactive,
  IngredientMeasurementProfileCreationIngredientNotFound,
  IngredientMeasurementProfileCreationMeasurementFailure,
  IngredientMeasurementProfileCreationPersistenceFailure,
  IngredientMeasurementProfileCreationValidationFailure
} from "./ingredient-measurement-profile-creation-errors.js";

type IngredientLookup = Readonly<{
  findById(ingredientId: CanonicalIngredientId):
    | Readonly<{ status: "Active" | "Archived" }>
    | undefined;
}>;

type ProfileCreationStore = Readonly<{
  saveNew(profile: IngredientMeasurementProfile): void;
}>;

export type IngredientMeasurementProfileCreationCommand = Readonly<{
  ingredientId: string;
  dimension: string;
  canonicalUnitCode: string;
  allowedUnitCodes: readonly string[];
  occurredAt: string;
  actor: string;
}>;

function requireText(value: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new IngredientMeasurementProfileCreationValidationFailure();
  }
  return value.trim();
}

function requireValues(values: readonly string[]): readonly string[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new IngredientMeasurementProfileCreationValidationFailure();
  }
  return Object.freeze(values.map(requireText));
}

export class IngredientMeasurementProfileCreationService {
  constructor(
    private readonly ingredients: IngredientLookup,
    private readonly profiles: ProfileCreationStore,
    private readonly measurementFacts: MeasurementProfileFactsResolutionContractV1,
    private readonly measurementUnits: MeasurementUnitResolutionContractV1
  ) {}

  create(
    command: IngredientMeasurementProfileCreationCommand
  ): IngredientMeasurementProfileContractV1 {
    let ingredientId: CanonicalIngredientId;
    let occurredAt: string;
    let actor: string;
    let facts: ResolvedMeasurementProfileFactsV1;
    try {
      ingredientId = CanonicalIngredientId.parse(requireText(command.ingredientId));
      occurredAt = requireText(command.occurredAt);
      actor = requireText(command.actor);
      const ingredient = this.ingredients.findById(ingredientId);
      if (ingredient === undefined) {
        throw new IngredientMeasurementProfileCreationIngredientNotFound();
      }
      if (ingredient.status !== "Active") {
        throw new IngredientMeasurementProfileCreationIngredientInactive();
      }
      const resolved = this.measurementFacts.resolveProfileFacts({
        rawDimension: requireText(command.dimension),
        rawCanonicalUnit: requireText(command.canonicalUnitCode),
        rawAllowedUnitValues: requireValues(command.allowedUnitCodes)
      });
      if (resolved.status === "failed") {
        throw new IngredientMeasurementProfileCreationMeasurementFailure();
      }
      facts = resolved.facts;
    } catch (error) {
      if (
        error instanceof IngredientMeasurementProfileCreationIngredientNotFound
        || error instanceof IngredientMeasurementProfileCreationIngredientInactive
        || error instanceof IngredientMeasurementProfileCreationMeasurementFailure
        || error instanceof IngredientMeasurementProfileCreationValidationFailure
      ) {
        throw error;
      }
      throw new IngredientMeasurementProfileCreationValidationFailure();
    }

    let profile: IngredientMeasurementProfile;
    try {
      const profileId = `measurement_profile_${randomUUID()}`;
      const profileVersionId = `measurement_profile_version_${randomUUID()}`;
      profile = IngredientMeasurementProfile.createDraft({
        identity: { profileId, profileVersionId, ingredientId: ingredientId.value },
        createdAt: occurredAt,
        createdBy: actor
      }).activateDraft(
        profileVersionId,
        {
          dimension: facts.dimension,
          canonicalUnitCode: facts.canonicalUnitCode,
          allowedUnitCodes: facts.allowedUnitCodes,
          profileAliases: [],
          source: {
            sourceType: "MANUAL",
            referenceId: "cost-back-office",
            recordedAt: occurredAt,
            recordedBy: actor
          }
        },
        { occurredAt, actorId: actor },
        this.measurementUnits
      );
    } catch {
      throw new IngredientMeasurementProfileCreationValidationFailure();
    }

    try {
      this.profiles.saveNew(profile);
    } catch {
      throw new IngredientMeasurementProfileCreationPersistenceFailure();
    }
    return profile.toContract();
  }
}
