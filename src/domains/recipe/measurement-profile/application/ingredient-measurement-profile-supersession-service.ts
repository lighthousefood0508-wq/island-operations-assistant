import { randomUUID } from "node:crypto";
import type {
  IngredientMeasurementProfileContractV1,
  IngredientMeasurementProfileId
} from "../../contracts/ingredient-measurement-profile-contract.js";
import type {
  MeasurementProfileFactsResolutionContractV1,
  MeasurementUnitResolutionContractV1,
  ResolvedMeasurementProfileFactsV1
} from "../../contracts/measurement-foundation-contract.js";
import { CanonicalIngredientId } from "../../ingredient-catalog/identities.js";
import { IngredientMeasurementProfile } from "../ingredient-measurement-profile.js";
import {
  IngredientMeasurementProfileSupersessionExpectedVersionConflict,
  IngredientMeasurementProfileSupersessionIngredientInactive,
  IngredientMeasurementProfileSupersessionMeasurementFailure,
  IngredientMeasurementProfileSupersessionNotFound,
  IngredientMeasurementProfileSupersessionPersistenceFailure,
  IngredientMeasurementProfileSupersessionReferenced,
  IngredientMeasurementProfileSupersessionValidationFailure
} from "./ingredient-measurement-profile-supersession-errors.js";

type IngredientLookup = Readonly<{
  findById(ingredientId: CanonicalIngredientId):
    | Readonly<{ status: "Active" | "Archived" }>
    | undefined;
}>;

type ProfileSupersessionStore = Readonly<{
  findAggregateByProfileId(profileId: IngredientMeasurementProfileId):
    | Readonly<{ profile: IngredientMeasurementProfile; aggregateVersion: number }>
    | undefined;
  saveWithExpectedVersion(
    profile: IngredientMeasurementProfile,
    expectedVersion: number
  ): number;
}>;

export type IngredientMeasurementProfileCorrectionReferenceGate = Readonly<{
  hasBlockingReferences(ingredientId: string): boolean;
}>;

export type IngredientMeasurementProfileSupersessionCommand = Readonly<{
  profileId: string;
  expectedVersion: number;
  dimension: string;
  canonicalUnitCode: string;
  allowedUnitCodes: readonly string[];
  occurredAt: string;
  actor: string;
  reason?: string;
}>;

function requireText(value: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new IngredientMeasurementProfileSupersessionValidationFailure();
  }
  return value.trim();
}

function requireValues(values: readonly string[]): readonly string[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new IngredientMeasurementProfileSupersessionValidationFailure();
  }
  return Object.freeze(values.map(requireText));
}

function requireExpectedVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new IngredientMeasurementProfileSupersessionValidationFailure();
  }
  return value;
}

function isExpectedVersionConflict(error: unknown): boolean {
  return error instanceof Error
    && error.name === "IngredientMeasurementProfileVersionConflict"
    && Number.isSafeInteger(Reflect.get(error, "expectedVersion"))
    && Number.isSafeInteger(Reflect.get(error, "actualVersion"));
}

export class IngredientMeasurementProfileSupersessionService {
  constructor(
    private readonly ingredients: IngredientLookup,
    private readonly profiles: ProfileSupersessionStore,
    private readonly measurementFacts: MeasurementProfileFactsResolutionContractV1,
    private readonly measurementUnits: MeasurementUnitResolutionContractV1,
    private readonly correctionReferences: IngredientMeasurementProfileCorrectionReferenceGate
  ) {}

  supersede(
    command: IngredientMeasurementProfileSupersessionCommand
  ): IngredientMeasurementProfileContractV1 {
    let profile: IngredientMeasurementProfile;
    let expectedVersion: number;
    let occurredAt: string;
    let actor: string;
    let active: Extract<IngredientMeasurementProfileContractV1["versions"][number], { state: "Active" }>;
    let facts: ResolvedMeasurementProfileFactsV1;
    let ingredientId: string;
    let crossBasisCorrection = false;
    let reason: string | undefined;
    try {
      const profileId = requireText(command.profileId);
      expectedVersion = requireExpectedVersion(command.expectedVersion);
      occurredAt = requireText(command.occurredAt);
      actor = requireText(command.actor);
      const stored = this.profiles.findAggregateByProfileId(profileId);
      if (stored === undefined) throw new IngredientMeasurementProfileSupersessionNotFound();
      profile = stored.profile;
      if (stored.aggregateVersion !== expectedVersion) {
        throw new IngredientMeasurementProfileSupersessionExpectedVersionConflict();
      }
      const contract = profile.toContract();
      ingredientId = contract.ingredientId;
      const candidate = contract.versions.find((version) => version.state === "Active");
      if (candidate === undefined || candidate.state !== "Active") {
        throw new IngredientMeasurementProfileSupersessionValidationFailure();
      }
      active = candidate;
      const ingredient = this.ingredients.findById(CanonicalIngredientId.parse(contract.ingredientId));
      if (ingredient === undefined) throw new IngredientMeasurementProfileSupersessionNotFound();
      if (ingredient.status !== "Active") throw new IngredientMeasurementProfileSupersessionIngredientInactive();
      const resolved = this.measurementFacts.resolveProfileFacts({
        rawDimension: requireText(command.dimension),
        rawCanonicalUnit: requireText(command.canonicalUnitCode),
        rawAllowedUnitValues: requireValues(command.allowedUnitCodes)
      });
      if (resolved.status === "failed") throw new IngredientMeasurementProfileSupersessionMeasurementFailure();
      facts = resolved.facts;
      crossBasisCorrection = facts.dimension !== active.dimension
        || facts.canonicalUnitCode !== active.canonicalUnitCode;
      reason = command.reason === undefined ? undefined : requireText(command.reason);
      if (crossBasisCorrection && reason === undefined) {
        throw new IngredientMeasurementProfileSupersessionValidationFailure();
      }
    } catch (error) {
      if (
        error instanceof IngredientMeasurementProfileSupersessionNotFound
        || error instanceof IngredientMeasurementProfileSupersessionExpectedVersionConflict
        || error instanceof IngredientMeasurementProfileSupersessionIngredientInactive
        || error instanceof IngredientMeasurementProfileSupersessionMeasurementFailure
        || error instanceof IngredientMeasurementProfileSupersessionValidationFailure
      ) throw error;
      throw new IngredientMeasurementProfileSupersessionValidationFailure();
    }

    if (crossBasisCorrection) {
      try {
        if (this.correctionReferences.hasBlockingReferences(ingredientId)) {
          throw new IngredientMeasurementProfileSupersessionReferenced();
        }
      } catch (error) {
        if (error instanceof IngredientMeasurementProfileSupersessionReferenced) throw error;
        throw new IngredientMeasurementProfileSupersessionPersistenceFailure();
      }
    }

    let superseded: IngredientMeasurementProfile;
    try {
      superseded = profile.supersedeActive({
        activeProfileVersionId: active.identity.profileVersionId,
        supersedingIdentity: {
          profileId: active.identity.profileId,
          profileVersionId: `measurement_profile_version_${randomUUID()}`,
          ingredientId: active.identity.ingredientId
        },
        supersedingDefinition: {
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
        transition: {
          occurredAt,
          actorId: actor,
          ...(reason === undefined ? {} : { reason })
        },
        unitResolver: this.measurementUnits
      });
    } catch {
      throw new IngredientMeasurementProfileSupersessionValidationFailure();
    }

    try {
      this.profiles.saveWithExpectedVersion(superseded, expectedVersion);
    } catch (error) {
      if (isExpectedVersionConflict(error)) {
        throw new IngredientMeasurementProfileSupersessionExpectedVersionConflict();
      }
      throw new IngredientMeasurementProfileSupersessionPersistenceFailure();
    }
    return superseded.toContract();
  }
}
