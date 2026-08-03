import type {
  RecipeDraftId,
  RecipeFamilyId,
  RecipeId,
  RecipeVersionId
} from "./identities.js";
import type { Quantity } from "./quantity.js";
import type { RecipeLine } from "./recipe-line.js";
import type { VersionNumber } from "./version-number.js";

export type RecipeState = "Draft" | "Abandoned" | "Published" | "Superseded";

export type ProductReference = Readonly<{
  productId: string;
  productVersionId: string;
}>;

export type RecipePublication = Readonly<{
  recipeVersionId: RecipeVersionId;
  versionNumber: VersionNumber;
  publishedBy: string;
  publishedAt: string;
}>;

export type RecipeSupersession = Readonly<{
  supersededByRecipeVersionId: RecipeVersionId;
  supersededBy: string;
  supersededAt: string;
  reason: string;
}>;

export type RecipeAbandonment = Readonly<{
  recipeFamilyId: RecipeFamilyId;
  recipeId: RecipeId;
  draftId: RecipeDraftId;
  resultingState: "Abandoned";
  actor: string;
  occurredAt: string;
  reason: string;
  previousAggregateVersion: number;
  resultingAggregateVersion: number;
}>;

export type RecipeSnapshot = Readonly<{
  recipeId: RecipeId;
  recipeFamilyId: RecipeFamilyId;
  draftId: RecipeDraftId;
  name: string;
  state: RecipeState;
  product: ProductReference | null;
  lines: readonly RecipeLine[];
  standardOutput: Quantity | null;
  standardYield: Quantity | null;
  publication: RecipePublication | null;
  supersession: RecipeSupersession | null;
  abandonment: RecipeAbandonment | null;
  instructions: string | null;
  createdBy: string;
  createdAt: string;
}>;
