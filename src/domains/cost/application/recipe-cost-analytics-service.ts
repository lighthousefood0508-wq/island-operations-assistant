import type { ExactRationalV1 } from "../domain/recipe-cost-evaluation.js";
import {
  RECIPE_COST_ANALYTICS_CONTRACT_NAME,
  RECIPE_COST_ANALYTICS_CONTRACT_VERSION,
  type CostAnalyticsDirectionV1,
  type ExactCostChangeV1,
  type RecipeCostAnalyticsContractV1,
  type RecipeCostAnalyticsSnapshotV1
} from "../domain/recipe-cost-analytics-contract.js";
import type { RecipeCostHistoryEntryV1 } from "../domain/recipe-cost-history-read-contract.js";
import { RecipeCostHistoryReadService } from "./recipe-cost-history-read-service.js";
import {
  RecipeCostHistoryReadPersistenceFailure,
  RecipeCostHistoryReadValidationFailure
} from "./recipe-cost-history-read-errors.js";
import {
  RecipeCostAnalyticsReadFailure,
  RecipeCostAnalyticsValidationFailure
} from "./recipe-cost-analytics-errors.js";

type Rational = Readonly<{ numerator: bigint; denominator: bigint }>;

function rational(value: ExactRationalV1): Rational {
  const numerator = BigInt(value.numerator);
  const denominator = BigInt(value.denominator);
  if (denominator <= 0n) throw new Error("Stored exact cost denominator is invalid.");
  return Object.freeze({ numerator, denominator });
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function subtract(left: ExactRationalV1, right: ExactRationalV1): ExactRationalV1 {
  const a = rational(left);
  const b = rational(right);
  const numerator = a.numerator * b.denominator - b.numerator * a.denominator;
  const denominator = a.denominator * b.denominator;
  const factor = gcd(numerator, denominator);
  return Object.freeze({ numerator: (numerator / factor).toString(), denominator: (denominator / factor).toString() });
}

function direction(value: ExactRationalV1): CostAnalyticsDirectionV1 {
  const numerator = rational(value).numerator;
  return numerator > 0n ? "increase" : numerator < 0n ? "decrease" : "unchanged";
}

function change(left: ExactRationalV1, right: ExactRationalV1): ExactCostChangeV1 {
  const exactDifference = subtract(left, right);
  return Object.freeze({ exactDifference, direction: direction(exactDifference) });
}

function summary(entry: RecipeCostHistoryEntryV1): RecipeCostAnalyticsSnapshotV1 {
  const snapshot = entry.snapshot;
  const suppliers = new Map<string, { count: number; acceptedPurchaseIds: Set<string> }>();
  let actualPurchaseLineCount = 0;
  let quoteFallbackLineCount = 0;
  for (const line of snapshot.result.lines) {
    if (line.selectedSource.sourceType === "ActualPurchase") {
      actualPurchaseLineCount += 1;
      const value = suppliers.get(line.selectedSource.supplierId) ?? { count: 0, acceptedPurchaseIds: new Set<string>() };
      value.count += 1;
      value.acceptedPurchaseIds.add(line.selectedSource.acceptedPurchaseId);
      suppliers.set(line.selectedSource.supplierId, value);
    } else {
      quoteFallbackLineCount += 1;
    }
  }
  return Object.freeze({
    costSnapshotId: snapshot.costSnapshotId,
    recipeVersionId: snapshot.recipeVersionId,
    valuedAt: snapshot.valuedAt,
    capturedAt: snapshot.capturedAt,
    capturedBy: snapshot.capturedBy,
    valuationPolicy: snapshot.result.valuationPolicy,
    roundingPolicy: snapshot.result.roundingPolicy,
    exactStandardBatchCost: snapshot.result.exactStandardBatchCost,
    exactPerStandardYieldCost: snapshot.result.exactPerStandardYieldCost,
    actualPurchaseLineCount,
    quoteFallbackLineCount,
    actualPurchaseSuppliers: Object.freeze([...suppliers.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([supplierId, value]) => Object.freeze({
        supplierId,
        actualPurchaseLineCount: value.count,
        acceptedPurchaseIds: Object.freeze([...value.acceptedPurchaseIds].sort())
      })))
  });
}

/** Projects governed immutable History; it neither values nor reads persistence. */
export class RecipeCostAnalyticsService {
  constructor(private readonly history: Pick<RecipeCostHistoryReadService, "list">) {}

  get(recipeId: string): RecipeCostAnalyticsContractV1 {
    try {
      const timeline = this.history.list(recipeId);
      const snapshots = Object.freeze(timeline.entries.map(summary));
      const latest = snapshots.at(-1) ?? null;
      const previous = snapshots.length > 1 ? snapshots.at(-2) ?? null : null;
      return Object.freeze({
        contractName: RECIPE_COST_ANALYTICS_CONTRACT_NAME,
        contractVersion: RECIPE_COST_ANALYTICS_CONTRACT_VERSION,
        recipeId: timeline.recipeId,
        snapshots,
        latest,
        previous,
        latestMinusPrevious: latest !== null && previous !== null
          ? Object.freeze({
            standardBatchCost: change(latest.exactStandardBatchCost, previous.exactStandardBatchCost),
            perStandardYieldCost: change(latest.exactPerStandardYieldCost, previous.exactPerStandardYieldCost)
          })
          : null
      });
    } catch (error) {
      if (error instanceof RecipeCostHistoryReadValidationFailure) {
        throw new RecipeCostAnalyticsValidationFailure();
      }
      if (error instanceof RecipeCostAnalyticsValidationFailure) throw error;
      if (error instanceof RecipeCostHistoryReadPersistenceFailure) {
        throw new RecipeCostAnalyticsReadFailure();
      }
      throw new RecipeCostAnalyticsReadFailure();
    }
  }
}
