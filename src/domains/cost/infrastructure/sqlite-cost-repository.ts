import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import {
  selectEffectiveIngredientCostQuote,
  type CostRepository,
  type EffectiveIngredientCostQuoteLookup
} from "../domain/cost-repository.js";
import { CostDomainError, IngredientCostQuoteVersionConflict } from "../domain/errors.js";
import { IngredientCostQuote } from "../domain/ingredient-cost-quote.js";
import { IngredientCostQuoteId, IngredientId } from "../domain/identities.js";
import { CostPersistenceMapper } from "../persistence/cost-persistence-mapper.js";
import {
  CostPersistenceFailure,
  CostPersistenceError,
  DuplicateIngredientCostQuote,
  ImmutableIngredientCostQuoteViolation,
  IngredientCostQuotePersistenceNotFound,
  InvalidCostPersistenceState
} from "../persistence/errors.js";
import type { IngredientCostQuoteRecord, IngredientCostQuoteRow } from "../persistence/records.js";

const QUOTE_COLUMNS = `
  quote_id,
  ingredient_id,
  CAST(amount_coefficient AS TEXT) AS amount_coefficient,
  amount_scale,
  currency_code,
  CAST(purchase_quantity_coefficient AS TEXT) AS purchase_quantity_coefficient,
  purchase_quantity_scale,
  unit_code,
  source_type,
  source_reference_id,
  supplier_id,
  effective_from,
  effective_to,
  recorded_at,
  recorded_by,
  superseded_at,
  superseded_by_quote_id,
  superseded_by_actor,
  aggregate_version
`;

function immutableEvidenceMatches(
  persisted: IngredientCostQuoteRow,
  candidate: IngredientCostQuoteRecord
): boolean {
  return persisted.quote_id === candidate.quoteId
    && persisted.ingredient_id === candidate.ingredientId
    && persisted.amount_coefficient === candidate.amountCoefficient
    && persisted.amount_scale === candidate.amountScale
    && persisted.currency_code === candidate.currencyCode
    && persisted.purchase_quantity_coefficient === candidate.purchaseQuantityCoefficient
    && persisted.purchase_quantity_scale === candidate.purchaseQuantityScale
    && persisted.unit_code === candidate.unitCode
    && persisted.source_type === candidate.sourceType
    && persisted.source_reference_id === (candidate.sourceReferenceId ?? null)
    && persisted.supplier_id === (candidate.supplierId ?? null)
    && persisted.effective_from === candidate.effectiveFrom
    && persisted.effective_to === (candidate.effectiveTo ?? null)
    && persisted.recorded_at === candidate.recordedAt
    && persisted.recorded_by === candidate.recordedBy;
}

function completeRecordMatches(
  persisted: IngredientCostQuoteRow,
  candidate: IngredientCostQuoteRecord
): boolean {
  return immutableEvidenceMatches(persisted, candidate)
    && persisted.superseded_at === (candidate.supersededAt ?? null)
    && persisted.superseded_by_quote_id === (candidate.supersededByQuoteId ?? null)
    && persisted.superseded_by_actor === (candidate.supersededByActor ?? null)
    && persisted.aggregate_version === candidate.aggregateVersion;
}

function isConstraintFailure(error: unknown): boolean {
  const code = (error as { code?: unknown } | undefined)?.code;
  return typeof code === "string" && code.startsWith("SQLITE_CONSTRAINT");
}

function mapTechnicalFailure(operation: string, error: unknown): never {
  if (error instanceof CostDomainError || error instanceof CostPersistenceError) {
    throw error;
  }
  throw new CostPersistenceFailure(operation, error);
}

export class SqliteCostRepository implements CostRepository {
  constructor(private readonly database: DatabaseAdapter) {}

  save(quote: IngredientCostQuote): void {
    if (quote.state !== "Recorded" || quote.aggregateVersion !== 0) {
      throw new InvalidCostPersistenceState(
        "A new Ingredient Cost Quote must be persisted in Recorded state at aggregateVersion 0."
      );
    }
    const record = CostPersistenceMapper.toRecord(quote);
    try {
      this.database.execute(
        `INSERT INTO cost_ingredient_cost_quotes (
          quote_id, ingredient_id, amount_coefficient, amount_scale, currency_code,
          purchase_quantity_coefficient, purchase_quantity_scale, unit_code,
          source_type, source_reference_id, supplier_id,
          effective_from, effective_to, recorded_at, recorded_by,
          superseded_at, superseded_by_quote_id, superseded_by_actor, aggregate_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0)`,
        [
          record.quoteId,
          record.ingredientId,
          record.amountCoefficient,
          record.amountScale,
          record.currencyCode,
          record.purchaseQuantityCoefficient,
          record.purchaseQuantityScale,
          record.unitCode,
          record.sourceType,
          record.sourceReferenceId ?? null,
          record.supplierId ?? null,
          record.effectiveFrom,
          record.effectiveTo ?? null,
          record.recordedAt,
          record.recordedBy
        ]
      );
    } catch (error) {
      if (isConstraintFailure(error)) {
        throw new DuplicateIngredientCostQuote(quote.quoteId.value, error);
      }
      throw new CostPersistenceFailure("save Ingredient Cost Quote", error);
    }
  }

  saveWithExpectedVersion(quote: IngredientCostQuote, expectedVersion: number): number {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
      throw new IngredientCostQuoteVersionConflict(expectedVersion, quote.aggregateVersion);
    }
    if (
      quote.state !== "Superseded"
      || quote.supersession === undefined
      || (
        quote.aggregateVersion !== expectedVersion
        && quote.aggregateVersion !== expectedVersion + 1
      )
    ) {
      throw new InvalidCostPersistenceState(
        "Versioned Quote save must append one Supersession fact or retry its exact persisted version."
      );
    }
    const candidate = CostPersistenceMapper.toRecord(quote);

    try {
      return this.database.transactionImmediate(() => {
        const persisted = this.rawFindByQuoteId(quote.quoteId.value);
        if (persisted === undefined) {
          throw new IngredientCostQuotePersistenceNotFound(quote.quoteId.value);
        }
        if (persisted.aggregate_version !== expectedVersion) {
          throw new IngredientCostQuoteVersionConflict(
            expectedVersion,
            persisted.aggregate_version
          );
        }
        if (!immutableEvidenceMatches(persisted, candidate)) {
          throw new ImmutableIngredientCostQuoteViolation(quote.quoteId.value);
        }
        if (quote.aggregateVersion === expectedVersion) {
          if (!completeRecordMatches(persisted, candidate)) {
            throw new IngredientCostQuoteVersionConflict(
              expectedVersion,
              persisted.aggregate_version
            );
          }
          return expectedVersion;
        }

        const result = this.database.execute(
          `UPDATE cost_ingredient_cost_quotes
             SET superseded_at = ?,
                 superseded_by_quote_id = ?,
                 superseded_by_actor = ?,
                 aggregate_version = ?
             WHERE quote_id = ?
               AND aggregate_version = ?
               AND superseded_at IS NULL
               AND superseded_by_quote_id IS NULL
               AND superseded_by_actor IS NULL`,
          [
            candidate.supersededAt,
            candidate.supersededByQuoteId,
            candidate.supersededByActor,
            candidate.aggregateVersion,
            candidate.quoteId,
            expectedVersion
          ]
        );
        if (result.changes !== 1) {
          const current = this.rawFindByQuoteId(quote.quoteId.value);
          throw new IngredientCostQuoteVersionConflict(
            expectedVersion,
            current?.aggregate_version ?? expectedVersion
          );
        }
        return candidate.aggregateVersion;
      });
    } catch (error) {
      return mapTechnicalFailure("save Ingredient Cost Quote with expected version", error);
    }
  }

  findByQuoteId(quoteId: IngredientCostQuoteId): IngredientCostQuote | undefined {
    try {
      const row = this.rawFindByQuoteId(quoteId.value);
      return row === undefined ? undefined : this.hydrate(row, new Set());
    } catch (error) {
      return mapTechnicalFailure("find Ingredient Cost Quote by identity", error);
    }
  }

  findQuotesByIngredientId(ingredientId: IngredientId): readonly IngredientCostQuote[] {
    try {
      const rows = this.database.queryMany<IngredientCostQuoteRow>(
        `SELECT ${QUOTE_COLUMNS}
         FROM cost_ingredient_cost_quotes
         WHERE ingredient_id = ?`,
        [ingredientId.value]
      );
      return Object.freeze(rows.map((row) => this.hydrate(row, new Set())));
    } catch (error) {
      return mapTechnicalFailure("find Ingredient Cost Quote history", error);
    }
  }

  findEffectiveQuoteAt(
    ingredientId: IngredientId,
    instant: string
  ): EffectiveIngredientCostQuoteLookup {
    try {
      return selectEffectiveIngredientCostQuote(
        this.findQuotesByIngredientId(ingredientId),
        ingredientId,
        instant
      );
    } catch (error) {
      return mapTechnicalFailure("find effective Ingredient Cost Quote", error);
    }
  }

  private rawFindByQuoteId(quoteId: string): IngredientCostQuoteRow | undefined {
    return this.database.queryOne<IngredientCostQuoteRow>(
      `SELECT ${QUOTE_COLUMNS}
       FROM cost_ingredient_cost_quotes
       WHERE quote_id = ?`,
      [quoteId]
    );
  }

  private hydrate(
    row: IngredientCostQuoteRow,
    lineage: ReadonlySet<string>
  ): IngredientCostQuote {
    if (lineage.has(row.quote_id)) {
      throw new InvalidCostPersistenceState(
        `Ingredient Cost Quote supersession contains a cycle at ${row.quote_id}.`
      );
    }
    const nextLineage = new Set(lineage);
    nextLineage.add(row.quote_id);
    return CostPersistenceMapper.fromRow(row, (supersedingQuoteId) => {
      const supersedingRow = this.rawFindByQuoteId(supersedingQuoteId.value);
      if (supersedingRow === undefined) {
        throw new InvalidCostPersistenceState(
          `Superseding Ingredient Cost Quote ${supersedingQuoteId.value} is missing.`
        );
      }
      return this.hydrate(supersedingRow, nextLineage);
    });
  }
}
