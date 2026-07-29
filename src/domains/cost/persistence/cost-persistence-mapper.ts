import { CostSource, type CostSourceType } from "../domain/cost-source.js";
import { CostUnit } from "../domain/cost-unit.js";
import { Currency } from "../domain/currency.js";
import { EffectivePeriod } from "../domain/effective-period.js";
import { CostDomainError } from "../domain/errors.js";
import { ExactDecimal } from "../domain/exact-decimal.js";
import { IngredientCostQuote } from "../domain/ingredient-cost-quote.js";
import { IngredientCostQuoteId, IngredientId } from "../domain/identities.js";
import { MonetaryAmount } from "../domain/monetary-amount.js";
import { InvalidCostPersistenceState } from "./errors.js";
import type { IngredientCostQuoteRecord, IngredientCostQuoteRow } from "./records.js";

export type SupersedingQuoteResolver = (quoteId: IngredientCostQuoteId) => IngredientCostQuote;

function persistedStateError(row: IngredientCostQuoteRow, cause: unknown): InvalidCostPersistenceState {
  return new InvalidCostPersistenceState(
    `Ingredient Cost Quote ${String(row.quote_id)} contains invalid persisted state.`,
    cause
  );
}

export class CostPersistenceMapper {
  static toRecord(quote: IngredientCostQuote): IngredientCostQuoteRecord {
    return Object.freeze({
      quoteId: quote.quoteId.value,
      ingredientId: quote.ingredientId.value,
      amountCoefficient: quote.monetaryAmount.coefficient,
      amountScale: quote.monetaryAmount.scale,
      currencyCode: quote.monetaryAmount.currency.code,
      purchaseQuantityCoefficient: quote.purchaseQuantity.coefficient,
      purchaseQuantityScale: quote.purchaseQuantity.scale,
      unitCode: quote.purchaseUnit.code,
      sourceType: quote.source.sourceType,
      sourceReferenceId: quote.source.sourceReferenceId,
      supplierId: quote.source.supplierId,
      effectiveFrom: quote.effectivePeriod.effectiveFrom,
      effectiveTo: quote.effectivePeriod.effectiveTo,
      recordedAt: quote.recordedAt,
      recordedBy: quote.recordedBy,
      supersededAt: quote.supersession?.supersededAt,
      supersededByQuoteId: quote.supersession?.supersededByQuoteId.value,
      supersededByActor: quote.supersession?.supersededBy,
      aggregateVersion: quote.aggregateVersion
    });
  }

  static fromRow(
    row: IngredientCostQuoteRow,
    resolveSupersedingQuote: SupersedingQuoteResolver
  ): IngredientCostQuote {
    try {
      const hasSupersession = row.superseded_at !== null
        || row.superseded_by_quote_id !== null
        || row.superseded_by_actor !== null;
      const completeSupersession = row.superseded_at !== null
        && row.superseded_by_quote_id !== null
        && row.superseded_by_actor !== null;
      if (hasSupersession !== completeSupersession) {
        throw new InvalidCostPersistenceState(
          `Ingredient Cost Quote ${row.quote_id} has incomplete supersession evidence.`
        );
      }
      if (completeSupersession && row.aggregate_version < 1) {
        throw new InvalidCostPersistenceState(
          `Ingredient Cost Quote ${row.quote_id} has an invalid superseded aggregate version.`
        );
      }

      const quote = IngredientCostQuote.record({
        quoteId: IngredientCostQuoteId.parse(row.quote_id),
        ingredientId: IngredientId.parse(row.ingredient_id),
        monetaryAmount: MonetaryAmount.create(
          row.amount_coefficient,
          row.amount_scale,
          Currency.create(row.currency_code)
        ),
        purchaseQuantity: ExactDecimal.create(
          row.purchase_quantity_coefficient,
          row.purchase_quantity_scale
        ),
        purchaseUnit: CostUnit.create(row.unit_code),
        effectivePeriod: EffectivePeriod.create(
          row.effective_from,
          row.effective_to ?? undefined
        ),
        source: CostSource.create({
          sourceType: row.source_type as CostSourceType,
          sourceReferenceId: row.source_reference_id ?? undefined,
          supplierId: row.supplier_id ?? undefined
        }),
        recordedAt: row.recorded_at,
        recordedBy: row.recorded_by,
        aggregateVersion: completeSupersession
          ? row.aggregate_version - 1
          : row.aggregate_version
      });

      if (completeSupersession) {
        const supersedingQuoteId = IngredientCostQuoteId.parse(row.superseded_by_quote_id);
        quote.supersedeWith(resolveSupersedingQuote(supersedingQuoteId), {
          supersededAt: row.superseded_at,
          supersededBy: row.superseded_by_actor
        });
      }
      if (quote.aggregateVersion !== row.aggregate_version) {
        throw new InvalidCostPersistenceState(
          `Ingredient Cost Quote ${row.quote_id} aggregate version did not round-trip.`
        );
      }
      return quote;
    } catch (error) {
      if (error instanceof InvalidCostPersistenceState && error.cause !== undefined) {
        throw error;
      }
      if (error instanceof CostDomainError || error instanceof InvalidCostPersistenceState) {
        throw persistedStateError(row, error);
      }
      throw persistedStateError(row, error);
    }
  }
}
