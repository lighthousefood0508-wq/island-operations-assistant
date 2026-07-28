import type { RecipeDraftId, RecipeId, RecipeVersionId } from "./identities.js";
import type { Quantity } from "./quantity.js";
import type { RecipeLine } from "./recipe-line.js";
import type { VersionNumber } from "./version-number.js";

export type RecipeState = "Draft" | "Published" | "Superseded";

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

export type RecipeSnapshot = Readonly<{
  recipeId: RecipeId;
  draftId: RecipeDraftId;
  name: string;
  state: RecipeState;
  product: ProductReference | null;
  lines: readonly RecipeLine[];
  standardOutput: Quantity | null;
  standardYield: Quantity | null;
  publication: RecipePublication | null;
  supersession: RecipeSupersession | null;
  createdBy: string;
  createdAt: string;
}>;
