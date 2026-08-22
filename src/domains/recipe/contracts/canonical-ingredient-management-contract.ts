import type {
  CanonicalIngredientContractV1
} from "./canonical-ingredient-contract.js";

export type CanonicalIngredientManagementRecordV1 =
  CanonicalIngredientContractV1;

export type CanonicalIngredientDuplicateCandidateV1 = Readonly<
  Pick<
    CanonicalIngredientManagementRecordV1,
    "ingredientId" | "name" | "status"
  >
>;

export type CanonicalIngredientDuplicateWarningV1 = Readonly<{
  code: "DUPLICATE_NAME_WARNING";
  candidates: readonly CanonicalIngredientDuplicateCandidateV1[];
}>;

export type RenameCanonicalIngredientCommandV1 = Readonly<{
  ingredientId: string;
  newName: string;
  expectedVersion: number;
  actor: string;
  occurredAt: string;
  reason: string;
}>;

export type ArchiveCanonicalIngredientCommandV1 = Readonly<{
  ingredientId: string;
  expectedVersion: number;
  actor: string;
  occurredAt: string;
  reason: string;
}>;

export type ReactivateCanonicalIngredientCommandV1 = Readonly<{
  ingredientId: string;
  expectedVersion: number;
  actor: string;
  occurredAt: string;
  reason: string;
}>;

export type RenameCanonicalIngredientResultV1 = Readonly<{
  ingredient: CanonicalIngredientManagementRecordV1;
  warnings: readonly CanonicalIngredientDuplicateWarningV1[];
}>;

export type ArchiveCanonicalIngredientResultV1 = Readonly<{
  ingredient: CanonicalIngredientManagementRecordV1;
}>;

export type ReactivateCanonicalIngredientResultV1 = Readonly<{
  ingredient: CanonicalIngredientManagementRecordV1;
}>;
