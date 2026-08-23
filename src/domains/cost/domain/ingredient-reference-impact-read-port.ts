import type { IngredientId } from "./identities.js";

export type CostIngredientQuoteReferenceImpactReadModelV1 = Readonly<{
  contractName: "CostIngredientQuoteReferenceImpact";
  contractVersion: 1;
  quoteIds: readonly string[];
}>;
export type CostAcceptedPurchaseReferenceImpactReadModelV1 = Readonly<{ contractName:"CostAcceptedPurchaseReferenceImpact"; contractVersion:1; acceptedPurchaseIds:readonly string[] }>;

export interface CostIngredientReferenceImpactReadPort {
  findIngredientQuoteReferences(
    ingredientId: IngredientId
  ): CostIngredientQuoteReferenceImpactReadModelV1;
  findIngredientAcceptedPurchaseReferences(ingredientId: IngredientId): CostAcceptedPurchaseReferenceImpactReadModelV1;
}
