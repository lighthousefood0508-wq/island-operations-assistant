import {
  type CostPurchaseReferenceImpactReadPort,
  IngredientId
} from "../domains/cost/index.js";
import type {
  IngredientMeasurementProfileContractV1,
  IngredientMeasurementProfileId
} from "../domains/recipe/index.js";
import {
  CanonicalIngredientReferenceImpactReadFailure,
  CanonicalIngredientReferenceImpactService,
  type CanonicalIngredientReferenceImpactV1
} from "./canonical-ingredient-reference-impact-service.js";

type ProfileImpactStore = Readonly<{
  findAggregateByProfileId(profileId: IngredientMeasurementProfileId):
    | Readonly<{
      profile: Readonly<{ toContract(): IngredientMeasurementProfileContractV1 }>;
      aggregateVersion: number;
    }>
    | undefined;
}>;

export type IngredientMeasurementProfileCorrectionImpactV1 = Readonly<{
  contractName: "IngredientMeasurementProfileCorrectionImpact";
  contractVersion: 1;
  profileId: string;
  ingredientId: string;
  expectedVersion: number;
  activeVersion: Readonly<{
    profileVersionId: string;
    dimension: string;
    canonicalUnitCode: string;
    allowedUnitCodes: readonly string[];
    state: "Active";
  }>;
  references: Readonly<{
    recipeDrafts: CanonicalIngredientReferenceImpactV1["recipeDrafts"];
    recipePublishedVersions: CanonicalIngredientReferenceImpactV1["recipePublishedVersions"];
    costQuotes: CanonicalIngredientReferenceImpactV1["costQuotes"];
    purchases: Readonly<{
      availability: "Available";
      purchaseCount: number;
      purchaseIds: readonly string[];
    }>;
    acceptedPurchases: CanonicalIngredientReferenceImpactV1["acceptedPurchases"];
    costSnapshots: CanonicalIngredientReferenceImpactV1["costSnapshots"];
  }>;
  crossBasisCorrectionAllowed: boolean;
}>;

export class IngredientMeasurementProfileCorrectionImpactValidationFailure extends Error {
  constructor() {
    super("Measurement Profile correction impact identity is invalid.");
    this.name = new.target.name;
  }
}

export class IngredientMeasurementProfileCorrectionImpactNotFound extends Error {
  constructor() {
    super("Ingredient Measurement Profile was not found for correction impact.");
    this.name = new.target.name;
  }
}

export class IngredientMeasurementProfileCorrectionImpactReadFailure extends Error {
  constructor() {
    super("Measurement Profile correction impact could not be read.");
    this.name = new.target.name;
  }
}

function text(value: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new IngredientMeasurementProfileCorrectionImpactValidationFailure();
  }
  return value.trim();
}

function activeVersion(contract: IngredientMeasurementProfileContractV1) {
  const active = contract.versions.find((version) => version.state === "Active");
  if (active === undefined || active.state !== "Active") {
    throw new IngredientMeasurementProfileCorrectionImpactNotFound();
  }
  return active;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

export class IngredientMeasurementProfileCorrectionImpactService {
  constructor(
    private readonly profiles: ProfileImpactStore,
    private readonly canonicalImpact: Pick<CanonicalIngredientReferenceImpactService, "getByIngredientId">,
    private readonly costImpact: CostPurchaseReferenceImpactReadPort
  ) {}

  getByProfileId(profileId: string): IngredientMeasurementProfileCorrectionImpactV1 {
    let stored: ReturnType<ProfileImpactStore["findAggregateByProfileId"]>;
    try {
      stored = this.profiles.findAggregateByProfileId(text(profileId));
    } catch (error) {
      if (error instanceof IngredientMeasurementProfileCorrectionImpactValidationFailure) throw error;
      throw new IngredientMeasurementProfileCorrectionImpactReadFailure();
    }
    if (stored === undefined) throw new IngredientMeasurementProfileCorrectionImpactNotFound();

    const contract = stored.profile.toContract();
    const active = activeVersion(contract);
    const references = this.references(contract.ingredientId);
    return Object.freeze({
      contractName: "IngredientMeasurementProfileCorrectionImpact",
      contractVersion: 1,
      profileId: contract.profileId,
      ingredientId: contract.ingredientId,
      expectedVersion: stored.aggregateVersion,
      activeVersion: Object.freeze({
        profileVersionId: active.identity.profileVersionId,
        dimension: active.dimension,
        canonicalUnitCode: active.canonicalUnitCode,
        allowedUnitCodes: Object.freeze([...active.allowedUnitCodes]),
        state: "Active"
      }),
      references: references.model,
      crossBasisCorrectionAllowed: !references.hasReferences
    });
  }

  hasBlockingReferences(ingredientId: string): boolean {
    return this.references(text(ingredientId)).hasReferences;
  }

  private references(ingredientId: string): Readonly<{
    model: IngredientMeasurementProfileCorrectionImpactV1["references"];
    hasReferences: boolean;
  }> {
    try {
      const canonical = this.canonicalImpact.getByIngredientId(ingredientId);
      const purchases = uniqueSorted(
        this.costImpact.findIngredientPurchaseReferences(IngredientId.parse(ingredientId)).purchaseIds
      );
      const model = Object.freeze({
        recipeDrafts: canonical.recipeDrafts,
        recipePublishedVersions: canonical.recipePublishedVersions,
        costQuotes: canonical.costQuotes,
        purchases: Object.freeze({
          availability: "Available" as const,
          purchaseCount: purchases.length,
          purchaseIds: purchases
        }),
        acceptedPurchases: canonical.acceptedPurchases,
        costSnapshots: canonical.costSnapshots
      });
      return Object.freeze({
        model,
        hasReferences:
          model.recipeDrafts.lineOccurrenceCount > 0
          || model.recipePublishedVersions.lineOccurrenceCount > 0
          || model.costQuotes.quoteCount > 0
          || model.purchases.purchaseCount > 0
          || model.acceptedPurchases.acceptedPurchaseCount > 0
          || model.costSnapshots.costSnapshotCount > 0
      });
    } catch (error) {
      if (error instanceof CanonicalIngredientReferenceImpactReadFailure) {
        throw new IngredientMeasurementProfileCorrectionImpactReadFailure();
      }
      throw new IngredientMeasurementProfileCorrectionImpactReadFailure();
    }
  }
}
