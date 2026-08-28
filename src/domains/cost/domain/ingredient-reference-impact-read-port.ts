import type { IngredientId } from "./identities.js";

export type CostIngredientQuoteReferenceImpactReadModelV1 = Readonly<{
  contractName: "CostIngredientQuoteReferenceImpact";
  contractVersion: 1;
  quoteIds: readonly string[];
}>;
export type CostAcceptedPurchaseReferenceImpactReadModelV1 = Readonly<{ contractName:"CostAcceptedPurchaseReferenceImpact"; contractVersion:1; acceptedPurchaseIds:readonly string[] }>;
export type CostSnapshotReferenceImpactReadModelV1 = Readonly<{ contractName:"CostSnapshotReferenceImpact"; contractVersion:1; costSnapshotIds:readonly string[] }>;
export type CostPurchaseReferenceImpactReadModelV1 = Readonly<{
  contractName: "CostPurchaseReferenceImpact";
  contractVersion: 1;
  purchaseIds: readonly string[];
}>;

export interface CostIngredientReferenceImpactReadPort {
  findIngredientQuoteReferences(
    ingredientId: IngredientId
  ): CostIngredientQuoteReferenceImpactReadModelV1;
  findIngredientAcceptedPurchaseReferences(ingredientId: IngredientId): CostAcceptedPurchaseReferenceImpactReadModelV1;
  findIngredientCostSnapshotReferences(ingredientId: IngredientId): CostSnapshotReferenceImpactReadModelV1;
}

export interface CostPurchaseReferenceImpactReadPort {
  findIngredientPurchaseReferences(ingredientId: IngredientId): CostPurchaseReferenceImpactReadModelV1;
}
