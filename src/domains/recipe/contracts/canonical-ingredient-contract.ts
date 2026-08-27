export const CANONICAL_INGREDIENT_CONTRACT_VERSION = 1 as const;

export const APPROVED_INGREDIENT_CATEGORY_CODES_V1 = Object.freeze([
  "meat",
  "seafood",
  "vegetable",
  "seasoning",
  "sauce",
  "dry_goods",
  "frozen",
  "beverage",
  "alcohol",
  "packaging",
  "other"
] as const);

export type ApprovedIngredientCategoryCodeV1 =
  typeof APPROVED_INGREDIENT_CATEGORY_CODES_V1[number];

/**
 * Readers must preserve future Owner-approved codes even though v1 writers
 * validate against APPROVED_INGREDIENT_CATEGORY_CODES_V1.
 */
export type IngredientCategoryCodeV1 = string;
export type CanonicalIngredientIdV1 = string;
export type CanonicalIngredientStatusV1 = "Active" | "Archived";

export type CanonicalIngredientRenameFactV1 = Readonly<{
  previousName: string;
  newName: string;
  renamedAt: string;
  renamedBy: string;
  reason: string;
}>;

export type CanonicalIngredientArchiveFactV1 = Readonly<{
  archivedAt: string;
  archivedBy: string;
  reason: string;
}>;

/** Internal replay evidence is ordered by aggregateVersion. Management readers
 * retain the v1 renameHistory/archiveFact projection for compatibility. */
export type CanonicalIngredientLifecycleEventV1 = Readonly<{
  aggregateVersion: number;
  eventType: "RENAMED" | "ARCHIVED" | "REACTIVATED";
  occurredAt: string;
  actor: string;
  reason: string;
  previousName?: string;
  newName?: string;
}>;

export type CanonicalIngredientContractV1 = Readonly<{
  contractVersion: typeof CANONICAL_INGREDIENT_CONTRACT_VERSION;
  ingredientId: CanonicalIngredientIdV1;
  name: string;
  categoryCode: IngredientCategoryCodeV1;
  status: CanonicalIngredientStatusV1;
  aggregateVersion: number;
  createdAt: string;
  createdBy: string;
  renameHistory: readonly CanonicalIngredientRenameFactV1[];
  archiveFact?: CanonicalIngredientArchiveFactV1;
}>;
