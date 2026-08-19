import { randomUUID } from "node:crypto";
import type {
  CompleteMeasurementProfileFactsV1,
  IngredientMeasurementProfileContractV1,
  IngredientMeasurementProfileId,
  IngredientMeasurementProfileVersionId
} from "../../contracts/ingredient-measurement-profile-contract.js";
import type {
  MeasurementProfileFactsResolutionContractV1,
  MeasurementUnitResolutionContractV1,
  ResolvedMeasurementProfileFactsV1
} from "../../contracts/measurement-foundation-contract.js";
import { CanonicalIngredientId } from "../../ingredient-catalog/identities.js";
import { IngredientMeasurementProfile } from "../ingredient-measurement-profile.js";
import {
  IngredientMeasurementProfileReestablishmentExpectedVersionConflict,
  IngredientMeasurementProfileReestablishmentIngredientInactive,
  IngredientMeasurementProfileReestablishmentMeasurementFailure,
  IngredientMeasurementProfileReestablishmentNotFound,
  IngredientMeasurementProfileReestablishmentPersistenceFailure,
  IngredientMeasurementProfileReestablishmentValidationFailure
} from "./ingredient-measurement-profile-reestablishment-errors.js";

type IngredientLookup = Readonly<{ findById(ingredientId: CanonicalIngredientId): Readonly<{ status: "Active" | "Archived" }> | undefined }>;
type ProfileStore = Readonly<{
  findAggregateByProfileId(profileId: IngredientMeasurementProfileId): Readonly<{ profile: IngredientMeasurementProfile; aggregateVersion: number }> | undefined;
  saveWithExpectedVersion(profile: IngredientMeasurementProfile, expectedVersion: number): number;
}>;
type FactsInput = Readonly<{ dimension: string; canonicalUnitCode: string; allowedUnitCodes: readonly string[] }>;
type CommandBase = Readonly<{ profileId: string; expectedVersion: number; occurredAt: string; actor: string; reason?: string }>;
export type IngredientMeasurementProfileAppendDraftCommand = CommandBase & FactsInput;
export type IngredientMeasurementProfileReviseDraftCommand = CommandBase & FactsInput & Readonly<{ draftVersionId: string }>;
export type IngredientMeasurementProfileActivateDraftCommand = CommandBase & Readonly<{ draftVersionId: string }>;

function requireText(value: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new IngredientMeasurementProfileReestablishmentValidationFailure();
  return value.trim();
}
function requireVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new IngredientMeasurementProfileReestablishmentValidationFailure();
  return value;
}
function requireValues(values: readonly string[]): readonly string[] {
  if (!Array.isArray(values) || values.length === 0) throw new IngredientMeasurementProfileReestablishmentValidationFailure();
  return Object.freeze(values.map(requireText));
}
function isConflict(error: unknown): boolean {
  return error instanceof Error && error.name === "IngredientMeasurementProfileVersionConflict";
}
function isCompleteDefinition(
  definition: IngredientMeasurementProfileContractV1["versions"][number] extends never ? never : Partial<CompleteMeasurementProfileFactsV1> | undefined
): definition is CompleteMeasurementProfileFactsV1 {
  return definition?.dimension !== undefined
    && definition.canonicalUnitCode !== undefined
    && definition.allowedUnitCodes !== undefined
    && definition.profileAliases !== undefined
    && definition.source !== undefined;
}

export class IngredientMeasurementProfileReestablishmentService {
  constructor(
    private readonly ingredients: IngredientLookup,
    private readonly profiles: ProfileStore,
    private readonly measurementFacts: MeasurementProfileFactsResolutionContractV1,
    private readonly measurementUnits: MeasurementUnitResolutionContractV1
  ) {}

  appendDraft(command: IngredientMeasurementProfileAppendDraftCommand): IngredientMeasurementProfileContractV1 {
    const prepared = this.prepareFacts(command);
    const draftVersionId = `measurement_profile_version_${randomUUID()}`;
    let result: IngredientMeasurementProfile;
    try {
      result = prepared.profile.appendDraftAfterDeprecation({
        draftIdentity: { profileId: prepared.profileId, profileVersionId: draftVersionId, ingredientId: prepared.ingredientId },
        transition: this.transition(prepared),
        definition: this.definition(prepared.facts, prepared)
      });
    } catch { throw new IngredientMeasurementProfileReestablishmentValidationFailure(); }
    return this.persist(result, prepared.expectedVersion);
  }

  reviseDraft(command: IngredientMeasurementProfileReviseDraftCommand): IngredientMeasurementProfileContractV1 {
    const prepared = this.prepareFacts(command);
    const draftVersionId = requireText(command.draftVersionId);
    let result: IngredientMeasurementProfile;
    try { result = prepared.profile.reviseDraft(draftVersionId, this.definition(prepared.facts, prepared), this.transition(prepared)); }
    catch { throw new IngredientMeasurementProfileReestablishmentValidationFailure(); }
    return this.persist(result, prepared.expectedVersion);
  }

  activateDraft(command: IngredientMeasurementProfileActivateDraftCommand): IngredientMeasurementProfileContractV1 {
    const prepared = this.prepare(command);
    const draftVersionId = requireText(command.draftVersionId);
    const draft = prepared.profile.findVersion(draftVersionId);
    if (draft === undefined) throw new IngredientMeasurementProfileReestablishmentNotFound();
    if (draft.state !== "Draft" || !isCompleteDefinition(draft.definition)) {
      throw new IngredientMeasurementProfileReestablishmentValidationFailure();
    }
    let result: IngredientMeasurementProfile;
    try {
      result = prepared.profile.activateDraft(draftVersionId, draft.definition, this.transition(prepared), this.measurementUnits);
    } catch { throw new IngredientMeasurementProfileReestablishmentValidationFailure(); }
    return this.persist(result, prepared.expectedVersion);
  }

  private prepareFacts(command: CommandBase & FactsInput) {
    const prepared = this.prepare(command);
    let resolved: ReturnType<MeasurementProfileFactsResolutionContractV1["resolveProfileFacts"]>;
    try {
      resolved = this.measurementFacts.resolveProfileFacts({ rawDimension: requireText(command.dimension), rawCanonicalUnit: requireText(command.canonicalUnitCode), rawAllowedUnitValues: requireValues(command.allowedUnitCodes) });
    } catch { throw new IngredientMeasurementProfileReestablishmentMeasurementFailure(); }
    if (resolved.status === "failed") throw new IngredientMeasurementProfileReestablishmentMeasurementFailure();
    return Object.freeze({ ...prepared, facts: resolved.facts });
  }

  private prepare(command: CommandBase) {
    let profileId: string; let expectedVersion: number; let occurredAt: string; let actor: string;
    try { profileId = requireText(command.profileId); expectedVersion = requireVersion(command.expectedVersion); occurredAt = requireText(command.occurredAt); actor = requireText(command.actor); }
    catch (error) { if (error instanceof IngredientMeasurementProfileReestablishmentValidationFailure) throw error; throw new IngredientMeasurementProfileReestablishmentValidationFailure(); }
    let stored: Readonly<{ profile: IngredientMeasurementProfile; aggregateVersion: number }> | undefined;
    try { stored = this.profiles.findAggregateByProfileId(profileId); } catch { throw new IngredientMeasurementProfileReestablishmentPersistenceFailure(); }
    if (stored === undefined) throw new IngredientMeasurementProfileReestablishmentNotFound();
    if (stored.aggregateVersion !== expectedVersion) throw new IngredientMeasurementProfileReestablishmentExpectedVersionConflict();
    const contract = stored.profile.toContract();
    let ingredient: Readonly<{ status: "Active" | "Archived" }> | undefined;
    try { ingredient = this.ingredients.findById(CanonicalIngredientId.parse(contract.ingredientId)); } catch { throw new IngredientMeasurementProfileReestablishmentPersistenceFailure(); }
    if (ingredient === undefined) throw new IngredientMeasurementProfileReestablishmentNotFound();
    if (ingredient.status !== "Active") throw new IngredientMeasurementProfileReestablishmentIngredientInactive();
    return Object.freeze({ profile: stored.profile, profileId, ingredientId: contract.ingredientId, expectedVersion, occurredAt, actor, reason: command.reason });
  }

  private transition(prepared: Readonly<{ occurredAt: string; actor: string; reason?: string }>) {
    return Object.freeze({ occurredAt: prepared.occurredAt, actorId: prepared.actor, ...(prepared.reason === undefined ? {} : { reason: requireText(prepared.reason) }) });
  }
  private source(prepared: Readonly<{ occurredAt: string; actor: string }>) {
    return Object.freeze({ sourceType: "MANUAL" as const, referenceId: "cost-back-office", recordedAt: prepared.occurredAt, recordedBy: prepared.actor });
  }
  private definition(facts: ResolvedMeasurementProfileFactsV1, prepared: Readonly<{ occurredAt: string; actor: string }>): CompleteMeasurementProfileFactsV1 {
    return Object.freeze({ dimension: facts.dimension, canonicalUnitCode: facts.canonicalUnitCode, allowedUnitCodes: facts.allowedUnitCodes, profileAliases: [], source: this.source(prepared) });
  }
  private persist(profile: IngredientMeasurementProfile, expectedVersion: number): IngredientMeasurementProfileContractV1 {
    try { this.profiles.saveWithExpectedVersion(profile, expectedVersion); }
    catch (error) { if (isConflict(error)) throw new IngredientMeasurementProfileReestablishmentExpectedVersionConflict(); throw new IngredientMeasurementProfileReestablishmentPersistenceFailure(); }
    return profile.toContract();
  }
}
