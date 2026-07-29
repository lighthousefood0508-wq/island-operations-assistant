import type { CostSourceType } from "../domain/cost-source.js";

export type IngredientCostQuoteRecord = Readonly<{
  quoteId: string;
  ingredientId: string;
  amountCoefficient: string;
  amountScale: number;
  currencyCode: string;
  purchaseQuantityCoefficient: string;
  purchaseQuantityScale: number;
  unitCode: string;
  sourceType: CostSourceType;
  sourceReferenceId: string | undefined;
  supplierId: string | undefined;
  effectiveFrom: string;
  effectiveTo: string | undefined;
  recordedAt: string;
  recordedBy: string;
  supersededAt: string | undefined;
  supersededByQuoteId: string | undefined;
  supersededByActor: string | undefined;
  aggregateVersion: number;
}>;

export type IngredientCostQuoteRow = Readonly<{
  quote_id: string;
  ingredient_id: string;
  amount_coefficient: string;
  amount_scale: number;
  currency_code: string;
  purchase_quantity_coefficient: string;
  purchase_quantity_scale: number;
  unit_code: string;
  source_type: string;
  source_reference_id: string | null;
  supplier_id: string | null;
  effective_from: string;
  effective_to: string | null;
  recorded_at: string;
  recorded_by: string;
  superseded_at: string | null;
  superseded_by_quote_id: string | null;
  superseded_by_actor: string | null;
  aggregate_version: number;
}>;
