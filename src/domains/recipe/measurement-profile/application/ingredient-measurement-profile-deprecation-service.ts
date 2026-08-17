import type {
  IngredientMeasurementProfileContractV1,
  IngredientMeasurementProfileId
} from "../../contracts/ingredient-measurement-profile-contract.js";
import { CanonicalIngredientId } from "../../ingredient-catalog/identities.js";
import { IngredientMeasurementProfile } from "../ingredient-measurement-profile.js";
import {
  IngredientMeasurementProfileDeprecationExpectedVersionConflict,
  IngredientMeasurementProfileDeprecationIngredientInactive,
  IngredientMeasurementProfileDeprecationNotFound,
  IngredientMeasurementProfileDeprecationPersistenceFailure,
  IngredientMeasurementProfileDeprecationValidationFailure
} from "./ingredient-measurement-profile-deprecation-errors.js";

type IngredientLookup = Readonly<{
  findById(ingredientId: CanonicalIngredientId):
    | Readonly<{ status: "Active" | "Archived" }>
    | undefined;
}>;

type ProfileDeprecationStore = Readonly<{
  findAggregateByProfileId(profileId: IngredientMeasurementProfileId):
    | Readonly<{ profile: IngredientMeasurementProfile; aggregateVersion: number }>
    | undefined;
  saveWithExpectedVersion(
    profile: IngredientMeasurementProfile,
    expectedVersion: number
  ): number;
}>;

export type IngredientMeasurementProfileDeprecationCommand = Readonly<{
  profileId: string;
  expectedVersion: number;
  occurredAt: string;
  actor: string;
  reason?: string;
}>;

function requireText(value: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new IngredientMeasurementProfileDeprecationValidationFailure();
  }
  return value.trim();
}

function requireExpectedVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new IngredientMeasurementProfileDeprecationValidationFailure();
  }
  return value;
}

function isExpectedVersionConflict(error: unknown): boolean {
  return error instanceof Error
    && error.name === "IngredientMeasurementProfileVersionConflict"
    && Number.isSafeInteger(Reflect.get(error, "expectedVersion"))
    && Number.isSafeInteger(Reflect.get(error, "actualVersion"));
}

export class IngredientMeasurementProfileDeprecationService {
  constructor(
    private readonly ingredients: IngredientLookup,
    private readonly profiles: ProfileDeprecationStore
  ) {}

  deprecate(
    command: IngredientMeasurementProfileDeprecationCommand
  ): IngredientMeasurementProfileContractV1 {
    let profile: IngredientMeasurementProfile;
    let expectedVersion: number;
    let occurredAt: string;
    let actor: string;
    let activeProfileVersionId: string;
    try {
      const profileId = requireText(command.profileId);
      expectedVersion = requireExpectedVersion(command.expectedVersion);
      occurredAt = requireText(command.occurredAt);
      actor = requireText(command.actor);
      let stored: Readonly<{
        profile: IngredientMeasurementProfile;
        aggregateVersion: number;
      }> | undefined;
      try {
        stored = this.profiles.findAggregateByProfileId(profileId);
      } catch {
        throw new IngredientMeasurementProfileDeprecationPersistenceFailure();
      }
      if (stored === undefined) throw new IngredientMeasurementProfileDeprecationNotFound();
      profile = stored.profile;
      if (stored.aggregateVersion !== expectedVersion) {
        throw new IngredientMeasurementProfileDeprecationExpectedVersionConflict();
      }
      const contract = profile.toContract();
      const active = contract.versions.find((version) => version.state === "Active");
      if (active === undefined || active.state !== "Active") {
        throw new IngredientMeasurementProfileDeprecationValidationFailure();
      }
      activeProfileVersionId = active.identity.profileVersionId;
      let ingredient: Readonly<{ status: "Active" | "Archived" }> | undefined;
      try {
        ingredient = this.ingredients.findById(
          CanonicalIngredientId.parse(contract.ingredientId)
        );
      } catch {
        throw new IngredientMeasurementProfileDeprecationPersistenceFailure();
      }
      if (ingredient === undefined) throw new IngredientMeasurementProfileDeprecationNotFound();
      if (ingredient.status !== "Active") {
        throw new IngredientMeasurementProfileDeprecationIngredientInactive();
      }
    } catch (error) {
      if (
        error instanceof IngredientMeasurementProfileDeprecationNotFound
        || error instanceof IngredientMeasurementProfileDeprecationExpectedVersionConflict
        || error instanceof IngredientMeasurementProfileDeprecationIngredientInactive
        || error instanceof IngredientMeasurementProfileDeprecationPersistenceFailure
        || error instanceof IngredientMeasurementProfileDeprecationValidationFailure
      ) throw error;
      throw new IngredientMeasurementProfileDeprecationValidationFailure();
    }

    let deprecated: IngredientMeasurementProfile;
    try {
      deprecated = profile.deprecateActive(activeProfileVersionId, {
        occurredAt,
        actorId: actor,
        ...(command.reason === undefined ? {} : { reason: requireText(command.reason) })
      });
    } catch {
      throw new IngredientMeasurementProfileDeprecationValidationFailure();
    }

    try {
      this.profiles.saveWithExpectedVersion(deprecated, expectedVersion);
    } catch (error) {
      if (isExpectedVersionConflict(error)) {
        throw new IngredientMeasurementProfileDeprecationExpectedVersionConflict();
      }
      throw new IngredientMeasurementProfileDeprecationPersistenceFailure();
    }
    return deprecated.toContract();
  }
}
