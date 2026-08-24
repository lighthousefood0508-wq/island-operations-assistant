import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import { AcceptedPurchase } from "../domain/accepted-purchase.js";
import type { CostEvidenceReadPort } from "../domain/cost-evidence-read-port.js";
import { CostSnapshot } from "../domain/cost-snapshot.js";
import type { CostSnapshotContractV1 } from "../domain/cost-snapshot.js";
import {
  AcceptedPurchaseId,
  AcceptedPurchaseLineId,
  CostSnapshotId,
  IngredientId,
  PurchaseId,
  PurchaseLineId,
  SupplierId
} from "../domain/identities.js";
import { Currency } from "../domain/currency.js";
import { ExactDecimal } from "../domain/exact-decimal.js";
import { MonetaryAmount } from "../domain/monetary-amount.js";
import type { RecipeCostEvaluationResultV1 } from "../domain/recipe-cost-evaluation.js";
import type { AcceptedPurchaseHeaderRow, AcceptedPurchaseLineRow } from "../persistence/accepted-purchase-records.js";
import type { CostSnapshotHeaderRow, CostSnapshotLineRow } from "../persistence/cost-snapshot-records.js";
import { CostPersistenceFailure, InvalidCostPersistenceState } from "../persistence/errors.js";
import { SqliteCostPurchaseRepository } from "./sqlite-cost-purchase-repository.js";
import { SqliteCostSupplierRepository } from "./sqlite-cost-supplier-repository.js";

type JsonRecord = Record<string, unknown>;

function parseJson(value: string, label: string): JsonRecord {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as JsonRecord;
  } catch (error) {
    throw new InvalidCostPersistenceState(`Stored ${label} is invalid.`, error);
  }
}

function readText(record: JsonRecord, field: string, label: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new InvalidCostPersistenceState(`Stored ${label}.${field} is invalid.`);
  }
  return value;
}

function readNumber(record: JsonRecord, field: string, label: string): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new InvalidCostPersistenceState(`Stored ${label}.${field} is invalid.`);
  }
  return value;
}

function hydrateAcceptedPurchase(
  header: AcceptedPurchaseHeaderRow,
  lines: readonly AcceptedPurchaseLineRow[]
) {
  return AcceptedPurchase.create({
    acceptedPurchaseId: AcceptedPurchaseId.parse(header.accepted_purchase_id),
    sourcePurchaseId: PurchaseId.parse(header.source_purchase_id),
    sourcePurchaseVersion: header.source_purchase_version,
    supplierId: SupplierId.parse(header.supplier_id),
    currency: Currency.create(header.currency_code),
    acceptedAt: header.accepted_at,
    acceptedBy: header.accepted_by,
    lines: lines.map((line) => Object.freeze({
      acceptedPurchaseLineId: AcceptedPurchaseLineId.parse(line.accepted_purchase_line_id),
      sourcePurchaseLineId: PurchaseLineId.parse(line.source_purchase_line_id),
      ingredientId: IngredientId.parse(line.ingredient_id),
      rawQuantity: ExactDecimal.create(line.raw_quantity_coefficient, line.raw_quantity_scale),
      rawUnitCode: line.raw_unit_code,
      amount: MonetaryAmount.create(
        line.amount_coefficient,
        line.amount_scale,
        Currency.create(header.currency_code)
      ),
      normalizedQuantity: ExactDecimal.create(
        line.normalized_quantity_coefficient,
        line.normalized_quantity_scale
      ),
      dimension: line.measurement_dimension,
      canonicalUnitCode: line.canonical_unit_code,
      profileId: line.profile_id,
      profileVersionId: line.profile_version_id
    }))
  }).toContract();
}

function hydrateSnapshot(
  header: CostSnapshotHeaderRow,
  lines: readonly CostSnapshotLineRow[]
): CostSnapshotContractV1 {
  const recipe = parseJson(header.recipe_costing_json, "Snapshot recipe evidence");
  const projection = recipe.recipeProjection;
  if (projection === null || typeof projection !== "object" || Array.isArray(projection)) {
    throw new InvalidCostPersistenceState("Stored Snapshot Recipe projection is invalid.");
  }
  const projectionRecord = projection as JsonRecord;
  const result: RecipeCostEvaluationResultV1 = {
    contractName: "RecipeCostEvaluationResult",
    contractVersion: 1,
    basis: "STANDARD_RECIPE",
    valuationPolicy: header.valuation_policy as "VAL-2",
    roundingPolicy: header.rounding_policy as "NONE_EXACT",
    evaluatedAt: header.valued_at,
    currencyCode: header.currency_code as "TWD",
    recipe: recipe as never,
    lines: Object.freeze(lines.map((line, position) => {
      if (line.line_position !== position) {
        throw new InvalidCostPersistenceState("Stored Snapshot line ordering is invalid.");
      }
      const recipeLine = parseJson(line.recipe_line_json, "Snapshot line evidence");
      const selectedSource = parseJson(line.selected_source_json, "Snapshot selected source");
      if (readNumber(recipeLine, "linePosition", "Snapshot line") !== position
        || readText(recipeLine, "ingredientId", "Snapshot line") !== line.ingredient_id) {
        throw new InvalidCostPersistenceState("Stored Snapshot line identity is invalid.");
      }
      return Object.freeze({
        linePosition: position,
        ingredientId: line.ingredient_id,
        recipeNormalizationEvidence: recipeLine.normalizationEvidence as never,
        selectedSource: selectedSource as never,
        exactLineCost: Object.freeze({
          numerator: line.exact_cost_numerator,
          denominator: line.exact_cost_denominator
        })
      });
    })),
    standardOutput: projectionRecord.standardOutput as never,
    standardYield: projectionRecord.standardYield as never,
    exactStandardBatchCost: Object.freeze({
      numerator: header.standard_batch_numerator,
      denominator: header.standard_batch_denominator
    }),
    exactPerStandardYieldCost: Object.freeze({
      numerator: header.per_yield_numerator,
      denominator: header.per_yield_denominator
    })
  };
  return CostSnapshot.capture({
    costSnapshotId: CostSnapshotId.parse(header.cost_snapshot_id),
    result,
    capturedAt: header.captured_at,
    capturedBy: header.captured_by
  }).toContract();
}

export class SqliteCostEvidenceReadPort implements CostEvidenceReadPort {
  private readonly suppliers: SqliteCostSupplierRepository;
  private readonly purchases: SqliteCostPurchaseRepository;

  constructor(private readonly database: DatabaseAdapter) {
    this.suppliers = new SqliteCostSupplierRepository(database);
    this.purchases = new SqliteCostPurchaseRepository(database);
  }

  findSupplier(supplierId: string) {
    try {
      return this.suppliers.findById(SupplierId.parse(supplierId))?.toContract();
    } catch (error) {
      throw new CostPersistenceFailure("read Cost Supplier evidence", error);
    }
  }

  listSuppliers() {
    try {
      return Object.freeze(this.suppliers.list().map((supplier) => supplier.toContract()));
    } catch (error) {
      throw new CostPersistenceFailure("list Cost Supplier evidence", error);
    }
  }

  findPurchase(purchaseId: string) {
    try {
      return this.purchases.findById(PurchaseId.parse(purchaseId))?.toContract();
    } catch (error) {
      throw new CostPersistenceFailure("read Cost Purchase evidence", error);
    }
  }

  findAcceptedPurchase(acceptedPurchaseId: string) {
    try {
      const header = this.database.queryOne<AcceptedPurchaseHeaderRow>(
        "SELECT * FROM cost_accepted_purchases WHERE accepted_purchase_id = ?",
        [acceptedPurchaseId]
      );
      return header === undefined ? undefined : this.acceptedPurchase(header);
    } catch (error) {
      throw new CostPersistenceFailure("read Accepted Purchase evidence", error);
    }
  }

  listAcceptedPurchasesForPurchase(purchaseId: PurchaseId) {
    try {
      const rows = this.database.queryMany<AcceptedPurchaseHeaderRow>(
        `SELECT * FROM cost_accepted_purchases
          WHERE source_purchase_id = ?
          ORDER BY accepted_at ASC, accepted_purchase_id ASC`,
        [purchaseId.value]
      );
      return Object.freeze(rows.map((row) => this.acceptedPurchase(row)));
    } catch (error) {
      throw new CostPersistenceFailure("list Accepted Purchase evidence", error);
    }
  }

  findSnapshot(costSnapshotId: string) {
    try {
      const header = this.database.queryOne<CostSnapshotHeaderRow>(
        "SELECT * FROM cost_recipe_snapshots WHERE cost_snapshot_id = ?",
        [costSnapshotId]
      );
      return header === undefined ? undefined : this.snapshot(header);
    } catch (error) {
      throw new CostPersistenceFailure("read Recipe Cost Snapshot evidence", error);
    }
  }

  listSnapshotsForRecipe(recipeId: string) {
    try {
      const headers = this.database.queryMany<CostSnapshotHeaderRow>(
        `SELECT * FROM cost_recipe_snapshots
          WHERE recipe_id = ?
          ORDER BY captured_at ASC, cost_snapshot_id ASC`,
        [recipeId]
      );
      return Object.freeze(headers.map((header) => this.snapshot(header)));
    } catch (error) {
      throw new CostPersistenceFailure("list Recipe Cost Snapshot evidence", error);
    }
  }

  private acceptedPurchase(header: AcceptedPurchaseHeaderRow) {
    const lines = this.database.queryMany<AcceptedPurchaseLineRow>(
      `SELECT accepted_purchase_line_id, source_purchase_line_id, ingredient_id,
              raw_quantity_coefficient, raw_quantity_scale, raw_unit_code,
              amount_coefficient, amount_scale, normalized_quantity_coefficient,
              normalized_quantity_scale, measurement_dimension, canonical_unit_code,
              profile_id, profile_version_id
         FROM cost_accepted_purchase_lines
        WHERE accepted_purchase_id = ?
        ORDER BY line_position ASC`,
      [header.accepted_purchase_id]
    );
    return hydrateAcceptedPurchase(header, lines);
  }

  private snapshot(header: CostSnapshotHeaderRow) {
    const lines = this.database.queryMany<CostSnapshotLineRow>(
      `SELECT * FROM cost_recipe_snapshot_lines
        WHERE cost_snapshot_id = ?
        ORDER BY line_position ASC`,
      [header.cost_snapshot_id]
    );
    return hydrateSnapshot(header, lines);
  }
}
