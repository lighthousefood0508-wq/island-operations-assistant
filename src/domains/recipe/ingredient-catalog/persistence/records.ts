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
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
}>;

export type CanonicalIngredientLifecycleEventRecord = Readonly<{
  ingredientId: string;
  aggregateVersion: number;
  eventType: "RENAMED" | "ARCHIVED" | "REACTIVATED";
  occurredAt: string;
  actor: string;
  reason: string;
  previousName?: string;
  newName?: string;
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

export type CanonicalIngredientLifecycleEventRow = Readonly<{
  ingredient_id: string;
  aggregate_version: number;
  event_type: string;
  occurred_at: string;
  actor: string;
  reason: string;
  previous_name: string | null;
  new_name: string | null;
}>;
