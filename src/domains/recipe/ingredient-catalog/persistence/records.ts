import type {
  CanonicalIngredientStatusV1,
  IngredientCategoryCodeV1
} from "../../contracts/canonical-ingredient-contract.js";

export type CanonicalIngredientRecord = Readonly<{
  ingredientId: string;
  name: string;
  categoryCode: IngredientCategoryCodeV1;
  status: CanonicalIngredientStatusV1;
  aggregateVersion: number;
  createdAt: string;
  createdBy: string;
  archivedAt: string | undefined;
  archivedBy: string | undefined;
  archiveReason: string | undefined;
}>;

export type CanonicalIngredientRenameRecord = Readonly<{
  ingredientId: string;
  transitionVersion: number;
  previousName: string;
  newName: string;
  renamedAt: string;
  renamedBy: string;
  reason: string;
}>;

export type CanonicalIngredientRow = Readonly<{
  ingredient_id: string;
  name: string;
  category_code: string;
  status: string;
  aggregate_version: number;
  created_at: string;
  created_by: string;
  archived_at: string | null;
  archived_by: string | null;
  archive_reason: string | null;
}>;

export type CanonicalIngredientRenameRow = Readonly<{
  ingredient_id: string;
  transition_version: number;
  previous_name: string;
  new_name: string;
  renamed_at: string;
  renamed_by: string;
  reason: string;
}>;
