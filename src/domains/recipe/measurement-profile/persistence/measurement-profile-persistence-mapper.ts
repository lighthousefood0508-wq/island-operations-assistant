import { isDeepStrictEqual } from "node:util";
import {
  INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
  type CompleteMeasurementProfileFactsV1,
  type IngredientMeasurementLifecycleFactV1,
  type IngredientMeasurementProfileContractV1,
  type IngredientMeasurementProfileIdentityV1,
  type IngredientMeasurementProfileAliasV1,
  type IngredientMeasurementSourceReferenceV1,
  type MeasurementProfileDefinitionContractV1
} from "../../contracts/ingredient-measurement-profile-contract.js";
import type {
  MeasurementUnitResolutionContractV1,
  StableMeasurementUnitCodeV1
} from "../../contracts/measurement-foundation-contract.js";
import { IngredientMeasurementProfile } from "../ingredient-measurement-profile.js";
import { createIngredientMeasurementProfileIdentity } from "../identities.js";
import { InvalidIngredientMeasurementProfilePersistenceState } from "./errors.js";
import type {
  IngredientMeasurementProfileRecord,
  IngredientMeasurementProfileRow,
  IngredientMeasurementProfileVersionRecord,
  IngredientMeasurementProfileVersionRow
} from "./records.js";

const STATES = new Set(["Draft", "Active", "Deprecated", "Superseded"]);
const TRANSITIONS = new Set([
  "CREATED",
  "ACTIVATED",
  "DEPRECATED",
  "SUPERSEDED",
  "DRAFT_REVISED"
]);

function isCompleteFacts(
  definition: Partial<CompleteMeasurementProfileFactsV1> | undefined
): definition is CompleteMeasurementProfileFactsV1 {
  return definition?.dimension !== undefined
    && definition.canonicalUnitCode !== undefined
    && definition.allowedUnitCodes !== undefined
    && definition.profileAliases !== undefined
    && definition.source !== undefined;
}

function parseJson<T>(source: string, label: string): T {
  try {
    return JSON.parse(source) as T;
  } catch (error) {
    throw new InvalidIngredientMeasurementProfilePersistenceState(
      `${label} must contain valid JSON.`,
      error
    );
  }
}

function assertLifecycle(
  value: unknown
): readonly IngredientMeasurementLifecycleFactV1[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidIngredientMeasurementProfilePersistenceState(
      "Measurement Profile lifecycle must be a non-empty array."
    );
  }
  return Object.freeze(value.map((candidate) => {
    if (
      typeof candidate !== "object"
      || candidate === null
      || !("transition" in candidate)
      || !TRANSITIONS.has(String(candidate.transition))
      || !("occurredAt" in candidate)
      || typeof candidate.occurredAt !== "string"
      || !("actorId" in candidate)
      || typeof candidate.actorId !== "string"
    ) {
      throw new InvalidIngredientMeasurementProfilePersistenceState(
        "Measurement Profile lifecycle fact is invalid."
      );
    }
    const fact = candidate as IngredientMeasurementLifecycleFactV1;
    return Object.freeze({ ...fact });
  }));
}

function assertStringArray(
  value: unknown,
  label: string
): readonly StableMeasurementUnitCodeV1[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new InvalidIngredientMeasurementProfilePersistenceState(
      `${label} must be a JSON string array.`
    );
  }
  return Object.freeze([...value]) as readonly StableMeasurementUnitCodeV1[];
}

function assertAliases(value: unknown): readonly IngredientMeasurementProfileAliasV1[] {
  if (!Array.isArray(value)) {
    throw new InvalidIngredientMeasurementProfilePersistenceState(
      "Measurement Profile aliases must be a JSON array."
    );
  }
  return Object.freeze(value.map((candidate) => {
    if (
      typeof candidate !== "object"
      || candidate === null
      || !("rawValue" in candidate)
      || typeof candidate.rawValue !== "string"
      || candidate.scope !== "PROFILE"
      || !("resolvedUnitCode" in candidate)
      || typeof candidate.resolvedUnitCode !== "string"
    ) {
      throw new InvalidIngredientMeasurementProfilePersistenceState(
        "Measurement Profile alias is invalid."
      );
    }
    return Object.freeze({
      rawValue: candidate.rawValue,
      scope: "PROFILE" as const,
      resolvedUnitCode:
        candidate.resolvedUnitCode as StableMeasurementUnitCodeV1
    });
  }));
}

function sourceFromRow(
  row: IngredientMeasurementProfileVersionRow
): IngredientMeasurementSourceReferenceV1 | undefined {
  if (
    row.source_type === null
    && row.source_recorded_at === null
    && row.source_recorded_by === null
    && row.source_reference_id === null
  ) {
    return undefined;
  }
  if (
    row.source_type === null
    || row.source_recorded_at === null
    || row.source_recorded_by === null
  ) {
    throw new InvalidIngredientMeasurementProfilePersistenceState(
      "Measurement Profile source evidence is incomplete."
    );
  }
  return Object.freeze({
    sourceType: row.source_type,
    ...(row.source_reference_id === null
      ? {}
      : { referenceId: row.source_reference_id }),
    recordedAt: row.source_recorded_at,
    recordedBy: row.source_recorded_by
  });
}

function completeFacts(
  row: IngredientMeasurementProfileVersionRow
): CompleteMeasurementProfileFactsV1 {
  if (
    row.dimension === null
    || row.canonical_unit_code === null
    || row.allowed_unit_codes_json === null
    || row.profile_aliases_json === null
  ) {
    throw new InvalidIngredientMeasurementProfilePersistenceState(
      "Formal Measurement Profile definition is incomplete."
    );
  }
  const source = sourceFromRow(row);
  if (source === undefined) {
    throw new InvalidIngredientMeasurementProfilePersistenceState(
      "Formal Measurement Profile source evidence is missing."
    );
  }
  return Object.freeze({
    dimension: row.dimension,
    canonicalUnitCode: row.canonical_unit_code,
    allowedUnitCodes: assertStringArray(
      parseJson<unknown>(row.allowed_unit_codes_json, "Allowed Units"),
      "Allowed Units"
    ),
    profileAliases: assertAliases(
      parseJson<unknown>(row.profile_aliases_json, "Profile aliases")
    ),
    source
  });
}

function versionFromRow(
  row: IngredientMeasurementProfileVersionRow
): MeasurementProfileDefinitionContractV1 {
  if (!STATES.has(row.state)) {
    throw new InvalidIngredientMeasurementProfilePersistenceState(
      `Unsupported Measurement Profile state ${row.state}.`
    );
  }
  const identity = createIngredientMeasurementProfileIdentity({
    profileId: row.profile_id,
    profileVersionId: row.profile_version_id,
    ingredientId: row.ingredient_id
  });
  const lifecycle = assertLifecycle(
    parseJson<unknown>(row.lifecycle_json, "Profile lifecycle")
  );
  if (row.state === "Draft") {
    const source = sourceFromRow(row);
    return Object.freeze({
      contractVersion: INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
      identity,
      state: "Draft",
      lifecycle,
      ...(row.dimension !== null
        && row.canonical_unit_code !== null
        && row.allowed_unit_codes_json !== null
        && row.profile_aliases_json !== null
        ? { definition: completeFacts(row) }
        : source === undefined
          ? {}
          : { definition: Object.freeze({ source }) })
    });
  }
  const facts = completeFacts(row);
  if (row.effective_from === null) {
    throw new InvalidIngredientMeasurementProfilePersistenceState(
      "Formal Measurement Profile effectiveFrom is missing."
    );
  }
  if (row.state === "Active") {
    return Object.freeze({
      contractVersion: INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
      identity,
      state: "Active",
      ...facts,
      effectiveFrom: row.effective_from,
      lifecycle
    });
  }
  if (row.effective_to === null) {
    throw new InvalidIngredientMeasurementProfilePersistenceState(
      "Closed Measurement Profile effectiveTo is missing."
    );
  }
  if (row.state === "Deprecated") {
    return Object.freeze({
      contractVersion: INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
      identity,
      state: "Deprecated",
      ...facts,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      lifecycle
    });
  }
  if (row.superseding_profile_version_id === null) {
    throw new InvalidIngredientMeasurementProfilePersistenceState(
      "Superseded Measurement Profile reference is missing."
    );
  }
  return Object.freeze({
    contractVersion: INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
    identity,
    state: "Superseded",
    ...facts,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    supersedingProfileVersionId: row.superseding_profile_version_id,
    lifecycle
  });
}

function transition(
  fact: IngredientMeasurementLifecycleFactV1
): { occurredAt: string; actorId: string; reason?: string } {
  return {
    occurredAt: fact.occurredAt,
    actorId: fact.actorId,
    ...(fact.reason === undefined ? {} : { reason: fact.reason })
  };
}

function requireTransition(
  version: MeasurementProfileDefinitionContractV1,
  name: IngredientMeasurementLifecycleFactV1["transition"]
): IngredientMeasurementLifecycleFactV1 {
  const matches = version.lifecycle.filter((fact) => fact.transition === name);
  if (matches.length !== 1) {
    throw new InvalidIngredientMeasurementProfilePersistenceState(
      `Measurement Profile Version requires exactly one ${name} fact.`
    );
  }
  return matches[0]!;
}

function replay(
  contract: IngredientMeasurementProfileContractV1,
  unitResolver: MeasurementUnitResolutionContractV1
): IngredientMeasurementProfile {
  const first = contract.versions[0];
  if (first === undefined) {
    throw new InvalidIngredientMeasurementProfilePersistenceState(
      "Measurement Profile requires at least one Version."
    );
  }
  const created = requireTransition(first, "CREATED");
  let profile = IngredientMeasurementProfile.createDraft({
    identity: first.identity,
    createdAt: created.occurredAt,
    createdBy: created.actorId,
    ...(first.state === "Draft" && first.definition?.source !== undefined
      ? { source: first.definition.source }
      : {})
  });

  const firstDefinition =
    first.state === "Draft" ? first.definition : {
      dimension: first.dimension,
      canonicalUnitCode: first.canonicalUnitCode,
      allowedUnitCodes: first.allowedUnitCodes,
      profileAliases: first.profileAliases,
      source: first.source
    };
  for (const revision of first.lifecycle.filter(
    (fact) => fact.transition === "DRAFT_REVISED"
  )) {
    profile = profile.reviseDraft(
      first.identity.profileVersionId,
      firstDefinition ?? {},
      transition(revision)
    );
  }
  if (first.state === "Draft") return profile;

  profile = profile.activateDraft(
    first.identity.profileVersionId,
    firstDefinition as CompleteMeasurementProfileFactsV1,
    transition(requireTransition(first, "ACTIVATED")),
    unitResolver
  );
  const firstWasDeprecated = first.state === "Deprecated";
  if (firstWasDeprecated) {
    profile = profile.deprecateActive(
      first.identity.profileVersionId,
      transition(requireTransition(first, "DEPRECATED"))
    );
  }

  for (let index = 0; index < contract.versions.length - 1; index += 1) {
    const current = contract.versions[index]!;
    const next = contract.versions[index + 1]!;
    if (current.state === "Superseded" && next.state !== "Draft") {
      profile = profile.supersedeActive({
        activeProfileVersionId: current.identity.profileVersionId,
        supersedingIdentity: next.identity,
        supersedingDefinition: {
          dimension: next.dimension,
          canonicalUnitCode: next.canonicalUnitCode,
          allowedUnitCodes: next.allowedUnitCodes,
          profileAliases: next.profileAliases,
          source: next.source
        },
        transition: transition(requireTransition(current, "SUPERSEDED")),
        unitResolver
      });
      continue;
    }
    if (current.state === "Deprecated") {
      const created = requireTransition(next, "CREATED");
      const definition = next.state === "Draft" ? next.definition : {
        dimension: next.dimension,
        canonicalUnitCode: next.canonicalUnitCode,
        allowedUnitCodes: next.allowedUnitCodes,
        profileAliases: next.profileAliases,
        source: next.source
      };
      if (!isCompleteFacts(definition)) {
        throw new InvalidIngredientMeasurementProfilePersistenceState(
          "A re-established Draft must retain complete Measurement Profile facts."
        );
      }
      profile = profile.appendDraftAfterDeprecation({
        draftIdentity: next.identity,
        transition: transition(created),
        definition
      });
      for (const revision of next.lifecycle.filter(
        (fact) => fact.transition === "DRAFT_REVISED"
      )) {
        profile = profile.reviseDraft(next.identity.profileVersionId, definition, transition(revision));
      }
      if (next.state === "Active") {
        profile = profile.activateDraft(
          next.identity.profileVersionId,
          definition,
          transition(requireTransition(next, "ACTIVATED")),
          unitResolver
        );
      } else if (next.state !== "Draft") {
        throw new InvalidIngredientMeasurementProfilePersistenceState(
          "A re-established Profile Version must be Draft or Active."
        );
      }
      continue;
    }
    throw new InvalidIngredientMeasurementProfilePersistenceState(
      "Measurement Profile Version history is not a legal append-first lifecycle chain."
    );
  }

  const finalVersion = contract.versions.at(-1)!;
  if (finalVersion.state === "Deprecated" && !firstWasDeprecated) {
    profile = profile.deprecateActive(
      finalVersion.identity.profileVersionId,
      transition(requireTransition(finalVersion, "DEPRECATED"))
    );
  }
  return profile;
}

function toVersionRecord(
  version: MeasurementProfileDefinitionContractV1,
  position: number
): IngredientMeasurementProfileVersionRecord {
  const definition = version.state === "Draft" ? version.definition : version;
  const source = definition?.source;
  return Object.freeze({
    profileVersionId: version.identity.profileVersionId,
    profileId: version.identity.profileId,
    ingredientId: version.identity.ingredientId,
    versionPosition: position,
    state: version.state,
    ...("dimension" in (definition ?? {})
      ? { dimension: definition!.dimension }
      : {}),
    ...("canonicalUnitCode" in (definition ?? {})
      ? { canonicalUnitCode: definition!.canonicalUnitCode }
      : {}),
    ...("allowedUnitCodes" in (definition ?? {})
      ? { allowedUnitCodesJson: JSON.stringify(definition!.allowedUnitCodes) }
      : {}),
    ...("profileAliases" in (definition ?? {})
      ? { profileAliasesJson: JSON.stringify(definition!.profileAliases) }
      : {}),
    ...(source === undefined
      ? {}
      : {
        sourceType: source.sourceType,
        ...(source.referenceId === undefined
          ? {}
          : { sourceReferenceId: source.referenceId }),
        sourceRecordedAt: source.recordedAt,
        sourceRecordedBy: source.recordedBy
      }),
    ...("effectiveFrom" in version
      ? { effectiveFrom: version.effectiveFrom }
      : {}),
    ...("effectiveTo" in version
      ? { effectiveTo: version.effectiveTo }
      : {}),
    ...("supersedingProfileVersionId" in version
      ? {
        supersedingProfileVersionId:
          version.supersedingProfileVersionId
      }
      : {}),
    lifecycleJson: JSON.stringify(version.lifecycle)
  });
}

export class MeasurementProfilePersistenceMapper {
  constructor(
    private readonly unitResolver: MeasurementUnitResolutionContractV1
  ) {}

  toRecords(
    profile: IngredientMeasurementProfile,
    aggregateVersion: number
  ): Readonly<{
    profile: IngredientMeasurementProfileRecord;
    versions: readonly IngredientMeasurementProfileVersionRecord[];
  }> {
    if (!Number.isSafeInteger(aggregateVersion) || aggregateVersion < 0) {
      throw new InvalidIngredientMeasurementProfilePersistenceState(
        "Measurement Profile aggregateVersion must be a non-negative safe integer."
      );
    }
    const contract = profile.toContract();
    const created = requireTransition(contract.versions[0]!, "CREATED");
    return Object.freeze({
      profile: Object.freeze({
        profileId: contract.profileId,
        ingredientId: contract.ingredientId,
        aggregateVersion,
        createdAt: created.occurredAt,
        createdBy: created.actorId
      }),
      versions: Object.freeze(
        contract.versions.map(toVersionRecord)
      )
    });
  }

  fromRows(
    profileRow: IngredientMeasurementProfileRow,
    versionRows: readonly IngredientMeasurementProfileVersionRow[]
  ): IngredientMeasurementProfile {
    try {
      const ordered = [...versionRows].sort(
        (left, right) => left.version_position - right.version_position
      );
      if (
        ordered.length === 0
        || ordered.some((row, index) =>
          row.version_position !== index
          || row.profile_id !== profileRow.profile_id
          || row.ingredient_id !== profileRow.ingredient_id
        )
      ) {
        throw new InvalidIngredientMeasurementProfilePersistenceState(
          "Measurement Profile Version rows are missing, reordered, or belong to another identity."
        );
      }
      const contract: IngredientMeasurementProfileContractV1 = Object.freeze({
        contractVersion: INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
        profileId: profileRow.profile_id,
        ingredientId: profileRow.ingredient_id,
        versions: Object.freeze(ordered.map(versionFromRow))
      });
      const profile = replay(contract, this.unitResolver);
      if (!isDeepStrictEqual(profile.toContract(), contract)) {
        throw new InvalidIngredientMeasurementProfilePersistenceState(
          "Replayed Measurement Profile does not match persisted history."
        );
      }
      const created = requireTransition(contract.versions[0]!, "CREATED");
      if (
        created.occurredAt !== profileRow.created_at
        || created.actorId !== profileRow.created_by
      ) {
        throw new InvalidIngredientMeasurementProfilePersistenceState(
          "Measurement Profile creation evidence does not match persisted current state."
        );
      }
      return profile;
    } catch (error) {
      if (error instanceof InvalidIngredientMeasurementProfilePersistenceState) {
        throw error;
      }
      throw new InvalidIngredientMeasurementProfilePersistenceState(
        "Measurement Profile persistence rows failed Domain replay.",
        error
      );
    }
  }
}
