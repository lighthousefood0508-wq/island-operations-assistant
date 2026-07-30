import {
  INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
  type ActiveMeasurementProfileDefinitionContractV1,
  type CompleteMeasurementProfileFactsV1,
  type DraftMeasurementProfileDefinitionContractV1,
  type IngredientMeasurementLifecycleFactV1,
  type IngredientMeasurementProfileContractV1,
  type IngredientMeasurementProfileIdentityV1,
  type IngredientMeasurementProfileVersionId,
  type IngredientMeasurementSourceReferenceV1,
  type MeasurementProfileDefinitionContractV1,
  type SupersededMeasurementProfileDefinitionContractV1
} from "../contracts/ingredient-measurement-profile-contract.js";
import type {
  MeasurementUnitResolutionContractV1
} from "../contracts/measurement-foundation-contract.js";
import {
  ImmutableActiveMeasurementProfileViolation,
  InvalidIngredientMeasurementProfileDefinition,
  InvalidIngredientMeasurementProfileTransition
} from "./errors.js";
import { createIngredientMeasurementProfileIdentity } from "./identities.js";
import {
  assertProfileInstant,
  assertProfileText,
  compareProfileInstants,
  freezeProfileSource,
  validateAndFreezeProfileDefinition
} from "./profile-validator.js";

type TransitionInput = Readonly<{
  occurredAt: string;
  actorId: string;
  reason?: string;
}>;

function freezeLifecycleFact(
  transition: IngredientMeasurementLifecycleFactV1
): IngredientMeasurementLifecycleFactV1 {
  return Object.freeze({
    transition: transition.transition,
    occurredAt: assertProfileInstant(transition.occurredAt, "Lifecycle occurredAt"),
    actorId: assertProfileText(transition.actorId, "Lifecycle actorId"),
    ...(transition.reason === undefined
      ? {}
      : { reason: assertProfileText(transition.reason, "Lifecycle reason") }),
    ...(transition.supersedingProfileVersionId === undefined
      ? {}
      : {
        supersedingProfileVersionId:
          transition.supersedingProfileVersionId
      })
  });
}

function transitionFact(
  transition: IngredientMeasurementLifecycleFactV1["transition"],
  input: TransitionInput,
  supersedingProfileVersionId?: IngredientMeasurementProfileVersionId
): IngredientMeasurementLifecycleFactV1 {
  return freezeLifecycleFact({
    transition,
    occurredAt: input.occurredAt,
    actorId: input.actorId,
    ...(input.reason === undefined ? {} : { reason: input.reason }),
    ...(supersedingProfileVersionId === undefined
      ? {}
      : { supersedingProfileVersionId })
  });
}

function replaceVersion(
  versions: readonly MeasurementProfileDefinitionContractV1[],
  replacement: MeasurementProfileDefinitionContractV1
): readonly MeasurementProfileDefinitionContractV1[] {
  return Object.freeze(
    versions.map((version) =>
      version.identity.profileVersionId === replacement.identity.profileVersionId
        ? replacement
        : version
    )
  );
}

export class IngredientMeasurementProfile {
  private constructor(
    readonly profileId: string,
    readonly ingredientId: string,
    private readonly versions: readonly MeasurementProfileDefinitionContractV1[]
  ) {
    Object.freeze(this);
  }

  static createDraft(input: {
    identity: IngredientMeasurementProfileIdentityV1;
    createdAt: string;
    createdBy: string;
    source?: IngredientMeasurementSourceReferenceV1;
  }): IngredientMeasurementProfile {
    const identity = createIngredientMeasurementProfileIdentity(input.identity);
    const created = transitionFact("CREATED", {
      occurredAt: input.createdAt,
      actorId: input.createdBy
    });
    const draft: DraftMeasurementProfileDefinitionContractV1 = Object.freeze({
      contractVersion: INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
      identity,
      state: "Draft",
      lifecycle: Object.freeze([created]),
      ...(input.source === undefined
        ? {}
        : {
          definition: Object.freeze({
            source: freezeProfileSource(input.source)
          })
        })
    });
    return new IngredientMeasurementProfile(
      identity.profileId,
      identity.ingredientId,
      Object.freeze([draft])
    );
  }

  reviseDraft(
    profileVersionId: IngredientMeasurementProfileVersionId,
    definition: Partial<CompleteMeasurementProfileFactsV1>,
    transition: TransitionInput
  ): IngredientMeasurementProfile {
    const current = this.requireVersion(profileVersionId);
    if (current.state !== "Draft") {
      throw new ImmutableActiveMeasurementProfileViolation();
    }
    const revised: DraftMeasurementProfileDefinitionContractV1 = Object.freeze({
      ...current,
      definition: Object.freeze({
        ...current.definition,
        ...definition,
        ...(definition.source === undefined
          ? {}
          : { source: freezeProfileSource(definition.source) }),
        ...(definition.allowedUnitCodes === undefined
          ? {}
          : { allowedUnitCodes: Object.freeze([...definition.allowedUnitCodes]) }),
        ...(definition.profileAliases === undefined
          ? {}
          : {
            profileAliases: Object.freeze(
              definition.profileAliases.map((alias) =>
                Object.freeze({ ...alias })
              )
            )
          })
      }),
      lifecycle: Object.freeze([
        ...current.lifecycle,
        transitionFact("DRAFT_REVISED", transition)
      ])
    });
    return new IngredientMeasurementProfile(
      this.profileId,
      this.ingredientId,
      replaceVersion(this.versions, revised)
    );
  }

  activateDraft(
    profileVersionId: IngredientMeasurementProfileVersionId,
    definition: CompleteMeasurementProfileFactsV1,
    transition: TransitionInput,
    unitResolver: MeasurementUnitResolutionContractV1
  ): IngredientMeasurementProfile {
    const current = this.requireVersion(profileVersionId);
    if (current.state !== "Draft") {
      throw new InvalidIngredientMeasurementProfileTransition(
        current.state,
        "ACTIVATED"
      );
    }
    if (this.versions.some((version) => version.state === "Active")) {
      throw new InvalidIngredientMeasurementProfileDefinition(
        "A Measurement Profile may have only one Active Version at an instant."
      );
    }
    const facts = validateAndFreezeProfileDefinition(definition, unitResolver);
    const effectiveFrom = assertProfileInstant(
      transition.occurredAt,
      "Activation occurredAt"
    );
    const active: ActiveMeasurementProfileDefinitionContractV1 = Object.freeze({
      contractVersion: INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
      identity: current.identity,
      state: "Active",
      ...facts,
      effectiveFrom,
      lifecycle: Object.freeze([
        ...current.lifecycle,
        transitionFact("ACTIVATED", transition)
      ])
    });
    return new IngredientMeasurementProfile(
      this.profileId,
      this.ingredientId,
      replaceVersion(this.versions, active)
    );
  }

  deprecateActive(
    profileVersionId: IngredientMeasurementProfileVersionId,
    transition: TransitionInput
  ): IngredientMeasurementProfile {
    const current = this.requireVersion(profileVersionId);
    if (current.state !== "Active") {
      throw new InvalidIngredientMeasurementProfileTransition(
        current.state,
        "DEPRECATED"
      );
    }
    const effectiveTo = assertProfileInstant(
      transition.occurredAt,
      "Deprecation occurredAt"
    );
    if (compareProfileInstants(effectiveTo, current.effectiveFrom) <= 0) {
      throw new InvalidIngredientMeasurementProfileDefinition(
        "Deprecation must occur after Profile activation."
      );
    }
    const deprecated = Object.freeze({
      ...current,
      state: "Deprecated" as const,
      effectiveTo,
      lifecycle: Object.freeze([
        ...current.lifecycle,
        transitionFact("DEPRECATED", transition)
      ])
    });
    return new IngredientMeasurementProfile(
      this.profileId,
      this.ingredientId,
      replaceVersion(this.versions, deprecated)
    );
  }

  supersedeActive(input: {
    activeProfileVersionId: IngredientMeasurementProfileVersionId;
    supersedingIdentity: IngredientMeasurementProfileIdentityV1;
    supersedingDefinition: CompleteMeasurementProfileFactsV1;
    transition: TransitionInput;
    unitResolver: MeasurementUnitResolutionContractV1;
  }): IngredientMeasurementProfile {
    const current = this.requireVersion(input.activeProfileVersionId);
    if (current.state !== "Active") {
      throw new InvalidIngredientMeasurementProfileTransition(
        current.state,
        "SUPERSEDED"
      );
    }
    const supersedingIdentity = createIngredientMeasurementProfileIdentity(
      input.supersedingIdentity
    );
    if (
      supersedingIdentity.profileId !== this.profileId
      || supersedingIdentity.ingredientId !== this.ingredientId
      || supersedingIdentity.profileVersionId === current.identity.profileVersionId
    ) {
      throw new InvalidIngredientMeasurementProfileDefinition(
        "A superseding Profile Version must be new and belong to the same Profile and Ingredient."
      );
    }
    if (
      this.versions.some(
        (version) =>
          version.identity.profileVersionId ===
          supersedingIdentity.profileVersionId
      )
    ) {
      throw new InvalidIngredientMeasurementProfileDefinition(
        "Profile Version identity cannot be reused."
      );
    }

    const effectiveTo = assertProfileInstant(
      input.transition.occurredAt,
      "Supersession occurredAt"
    );
    if (compareProfileInstants(effectiveTo, current.effectiveFrom) <= 0) {
      throw new InvalidIngredientMeasurementProfileDefinition(
        "Supersession must occur after Profile activation."
      );
    }
    const supersedingFacts = validateAndFreezeProfileDefinition(
      input.supersedingDefinition,
      input.unitResolver
    );
    const superseded: SupersededMeasurementProfileDefinitionContractV1 =
      Object.freeze({
        ...current,
        state: "Superseded",
        effectiveTo,
        supersedingProfileVersionId:
          supersedingIdentity.profileVersionId,
        lifecycle: Object.freeze([
          ...current.lifecycle,
          transitionFact(
            "SUPERSEDED",
            input.transition,
            supersedingIdentity.profileVersionId
          )
        ])
      });
    const superseding: ActiveMeasurementProfileDefinitionContractV1 =
      Object.freeze({
        contractVersion: INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
        identity: supersedingIdentity,
        state: "Active",
        ...supersedingFacts,
        effectiveFrom: effectiveTo,
        lifecycle: Object.freeze([
          transitionFact("CREATED", input.transition),
          transitionFact("ACTIVATED", input.transition)
        ])
      });

    return new IngredientMeasurementProfile(
      this.profileId,
      this.ingredientId,
      Object.freeze([
        ...replaceVersion(this.versions, superseded),
        superseding
      ])
    );
  }

  findVersion(
    profileVersionId: IngredientMeasurementProfileVersionId
  ): MeasurementProfileDefinitionContractV1 | undefined {
    return this.versions.find(
      (version) =>
        version.identity.profileVersionId === profileVersionId
    );
  }

  toContract(): IngredientMeasurementProfileContractV1 {
    return Object.freeze({
      contractVersion: INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
      profileId: this.profileId,
      ingredientId: this.ingredientId,
      versions: Object.freeze([...this.versions])
    });
  }

  private requireVersion(
    profileVersionId: IngredientMeasurementProfileVersionId
  ): MeasurementProfileDefinitionContractV1 {
    const version = this.findVersion(profileVersionId);
    if (version === undefined) {
      throw new InvalidIngredientMeasurementProfileDefinition(
        `Measurement Profile Version ${profileVersionId} does not exist.`
      );
    }
    return version;
  }
}
