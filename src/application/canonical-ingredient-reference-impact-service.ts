import {
  type CostIngredientReferenceImpactReadPort,
  IngredientId
} from "../domains/cost/index.js";
import {
  CanonicalIngredientLifecycleNotFound,
  CanonicalIngredientLifecycleValidationFailure,
  CanonicalIngredientManagementReadService,
  IngredientReferenceId,
  type CanonicalIngredientIdV1,
  type RecipeDraftIngredientReferenceV1,
  type RecipeIngredientReferenceImpactReadPort,
  type RecipePublishedIngredientReferenceV1
} from "../domains/recipe/index.js";

export type CanonicalIngredientDraftReferenceV1 = Readonly<{
  recipeId: string;
  draftId: string;
  recipeLineId: string;
}>;

export type CanonicalIngredientPublishedReferenceV1 = Readonly<{
  recipeId: string;
  recipeVersionId: string;
  recipeLineId: string;
}>;

export type CanonicalIngredientReferenceImpactV1 = Readonly<{
  contractName: "CanonicalIngredientReferenceImpact";
  contractVersion: 1;
  ingredientId: CanonicalIngredientIdV1;
  recipeDrafts: Readonly<{
    availability: "Available";
    uniqueRecipeCount: number;
    draftCount: number;
    lineOccurrenceCount: number;
    recipeIds: readonly string[];
    draftIds: readonly string[];
    references: readonly CanonicalIngredientDraftReferenceV1[];
  }>;
  recipePublishedVersions: Readonly<{
    availability: "Available";
    uniqueRecipeCount: number;
    publishedVersionCount: number;
    lineOccurrenceCount: number;
    recipeIds: readonly string[];
    recipeVersionIds: readonly string[];
    references: readonly CanonicalIngredientPublishedReferenceV1[];
  }>;
  costQuotes: Readonly<{
    availability: "Available";
    quoteCount: number;
    quoteIds: readonly string[];
  }>;
  acceptedPurchases: Readonly<{ availability: "Available"; acceptedPurchaseCount:number; acceptedPurchaseIds:readonly string[] }>;
  costSnapshots: Readonly<{ availability: "Available"; costSnapshotCount:number; costSnapshotIds:readonly string[] }>;
  deletionEligibility: Readonly<{
    status: "Indeterminate";
    blocked: true;
  }>;
}>;

type ReferenceImpactErrorCode =
  | "CANONICAL_INGREDIENT_REFERENCE_IMPACT_VALIDATION_FAILURE"
  | "CANONICAL_INGREDIENT_REFERENCE_IMPACT_NOT_FOUND"
  | "CANONICAL_INGREDIENT_REFERENCE_IMPACT_READ_FAILURE";

abstract class CanonicalIngredientReferenceImpactError extends Error {
  abstract readonly code: ReferenceImpactErrorCode;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class CanonicalIngredientReferenceImpactValidationFailure
  extends CanonicalIngredientReferenceImpactError {
  readonly code =
    "CANONICAL_INGREDIENT_REFERENCE_IMPACT_VALIDATION_FAILURE" as const;

  constructor() {
    super("Canonical Ingredient Reference Impact identity is invalid.");
  }
}

export class CanonicalIngredientReferenceImpactNotFound
  extends CanonicalIngredientReferenceImpactError {
  readonly code = "CANONICAL_INGREDIENT_REFERENCE_IMPACT_NOT_FOUND" as const;

  constructor() {
    super("Canonical Ingredient was not found for Reference Impact.");
  }
}

export class CanonicalIngredientReferenceImpactReadFailure
  extends CanonicalIngredientReferenceImpactError {
  readonly code = "CANONICAL_INGREDIENT_REFERENCE_IMPACT_READ_FAILURE" as const;

  constructor() {
    super("Canonical Ingredient Reference Impact could not be read.");
  }
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function uniqueDraftReferences(
  values: readonly RecipeDraftIngredientReferenceV1[]
): readonly CanonicalIngredientDraftReferenceV1[] {
  const unique = new Map<string, CanonicalIngredientDraftReferenceV1>();
  for (const value of values) {
    const key = `${value.recipeId}\0${value.draftId}\0${value.recipeLineId}`;
    unique.set(key, {
      recipeId: value.recipeId,
      draftId: value.draftId,
      recipeLineId: value.recipeLineId
    });
  }
  return [...unique.values()].sort((left, right) =>
    compareText(left.recipeId, right.recipeId)
      || compareText(left.draftId, right.draftId)
      || compareText(left.recipeLineId, right.recipeLineId)
  );
}

function uniquePublishedReferences(
  values: readonly RecipePublishedIngredientReferenceV1[]
): readonly CanonicalIngredientPublishedReferenceV1[] {
  const unique = new Map<string, CanonicalIngredientPublishedReferenceV1>();
  for (const value of values) {
    const key =
      `${value.recipeId}\0${value.recipeVersionId}\0${value.recipeLineId}`;
    unique.set(key, {
      recipeId: value.recipeId,
      recipeVersionId: value.recipeVersionId,
      recipeLineId: value.recipeLineId
    });
  }
  return [...unique.values()].sort((left, right) =>
    compareText(left.recipeId, right.recipeId)
      || compareText(left.recipeVersionId, right.recipeVersionId)
      || compareText(left.recipeLineId, right.recipeLineId)
  );
}

export class CanonicalIngredientReferenceImpactService {
  constructor(
    private readonly ingredientReader: Pick<
      CanonicalIngredientManagementReadService,
      "getById"
    >,
    private readonly recipeReader: RecipeIngredientReferenceImpactReadPort,
    private readonly costReader: CostIngredientReferenceImpactReadPort
  ) {}

  getByIngredientId(
    ingredientId: string
  ): CanonicalIngredientReferenceImpactV1 {
    let loadedIngredientId: CanonicalIngredientIdV1;
    try {
      loadedIngredientId = this.ingredientReader.getById(ingredientId)
        .ingredientId;
    } catch (error) {
      if (error instanceof CanonicalIngredientLifecycleValidationFailure) {
        throw new CanonicalIngredientReferenceImpactValidationFailure();
      }
      if (error instanceof CanonicalIngredientLifecycleNotFound) {
        throw new CanonicalIngredientReferenceImpactNotFound();
      }
      throw new CanonicalIngredientReferenceImpactReadFailure();
    }

    try {
      const recipe = this.recipeReader.findIngredientReferences(
        IngredientReferenceId.parse(loadedIngredientId)
      );
      const cost = this.costReader.findIngredientQuoteReferences(
        IngredientId.parse(loadedIngredientId)
      );
      const acceptedPurchaseReferences=this.costReader.findIngredientAcceptedPurchaseReferences(IngredientId.parse(loadedIngredientId));
      const snapshotReferences=this.costReader.findIngredientCostSnapshotReferences(IngredientId.parse(loadedIngredientId));
      const draftReferences = uniqueDraftReferences(recipe.draftReferences);
      const publishedReferences = uniquePublishedReferences(
        recipe.publishedReferences
      );
      const quoteIds = uniqueSorted(cost.quoteIds);
      return {
        contractName: "CanonicalIngredientReferenceImpact",
        contractVersion: 1,
        ingredientId: loadedIngredientId,
        recipeDrafts: {
          availability: "Available",
          uniqueRecipeCount: uniqueSorted(
            draftReferences.map((reference) => reference.recipeId)
          ).length,
          draftCount: uniqueSorted(
            draftReferences.map((reference) => reference.draftId)
          ).length,
          lineOccurrenceCount: draftReferences.length,
          recipeIds: uniqueSorted(
            draftReferences.map((reference) => reference.recipeId)
          ),
          draftIds: uniqueSorted(
            draftReferences.map((reference) => reference.draftId)
          ),
          references: draftReferences
        },
        recipePublishedVersions: {
          availability: "Available",
          uniqueRecipeCount: uniqueSorted(
            publishedReferences.map((reference) => reference.recipeId)
          ).length,
          publishedVersionCount: uniqueSorted(
            publishedReferences.map((reference) => reference.recipeVersionId)
          ).length,
          lineOccurrenceCount: publishedReferences.length,
          recipeIds: uniqueSorted(
            publishedReferences.map((reference) => reference.recipeId)
          ),
          recipeVersionIds: uniqueSorted(
            publishedReferences.map(
              (reference) => reference.recipeVersionId
            )
          ),
          references: publishedReferences
        },
        costQuotes: {
          availability: "Available",
          quoteCount: quoteIds.length,
          quoteIds
        },
        acceptedPurchases: { availability: "Available",acceptedPurchaseCount:uniqueSorted(acceptedPurchaseReferences.acceptedPurchaseIds).length,acceptedPurchaseIds:uniqueSorted(acceptedPurchaseReferences.acceptedPurchaseIds) },
        costSnapshots: { availability: "Available",costSnapshotCount:uniqueSorted(snapshotReferences.costSnapshotIds).length,costSnapshotIds:uniqueSorted(snapshotReferences.costSnapshotIds) },
        deletionEligibility: {
          status: "Indeterminate",
          blocked: true
        }
      };
    } catch {
      throw new CanonicalIngredientReferenceImpactReadFailure();
    }
  }
}
