import type { CanonicalIngredientLifecycleEventV1 } from "../../contracts/canonical-ingredient-contract.js";
import { CanonicalIngredient } from "../canonical-ingredient.js";
import { CanonicalIngredientError } from "../errors.js";
import { CanonicalIngredientId } from "../identities.js";
import { IngredientCategory } from "../ingredient-category.js";
import { InvalidCanonicalIngredientPersistenceState } from "./errors.js";
import type {
  CanonicalIngredientLifecycleEventRecord,
  CanonicalIngredientLifecycleEventRow,
  CanonicalIngredientRecord,
  CanonicalIngredientRow
} from "./records.js";

function invalidState(ingredientId: unknown, detail: string, cause?: unknown): InvalidCanonicalIngredientPersistenceState {
  return new InvalidCanonicalIngredientPersistenceState(`Canonical Ingredient ${String(ingredientId)} ${detail}.`, cause);
}

function eventFromRow(row: CanonicalIngredientLifecycleEventRow): CanonicalIngredientLifecycleEventV1 {
  if (row.event_type !== "RENAMED" && row.event_type !== "ARCHIVED" && row.event_type !== "REACTIVATED") {
    throw invalidState(row.ingredient_id, "has an unknown lifecycle event type");
  }
  const rename = row.event_type === "RENAMED";
  if (rename !== (row.previous_name !== null && row.new_name !== null)) {
    throw invalidState(row.ingredient_id, "has contradictory Rename lifecycle evidence");
  }
  return Object.freeze({
    aggregateVersion: row.aggregate_version,
    eventType: row.event_type,
    occurredAt: row.occurred_at,
    actor: row.actor,
    reason: row.reason,
    ...(rename ? { previousName: row.previous_name as string, newName: row.new_name as string } : {})
  });
}

export class CanonicalIngredientPersistenceMapper {
  static toRecord(ingredient: CanonicalIngredient): Readonly<{
    ingredient: CanonicalIngredientRecord;
    lifecycleEvents: readonly CanonicalIngredientLifecycleEventRecord[];
  }> {
    const contract = ingredient.toContract();
    return Object.freeze({
      ingredient: Object.freeze({
        ingredientId: contract.ingredientId, name: contract.name, categoryCode: contract.categoryCode,
        status: contract.status, aggregateVersion: contract.aggregateVersion,
        createdAt: contract.createdAt, createdBy: contract.createdBy,
        ...(contract.archiveFact === undefined ? {} : {
          archivedAt: contract.archiveFact.archivedAt,
          archivedBy: contract.archiveFact.archivedBy,
          archiveReason: contract.archiveFact.reason
        })
      }),
      lifecycleEvents: Object.freeze(ingredient.lifecycleHistory.map((event) => Object.freeze({
        ingredientId: contract.ingredientId, aggregateVersion: event.aggregateVersion, eventType: event.eventType,
        occurredAt: event.occurredAt, actor: event.actor, reason: event.reason,
        ...(event.eventType === "RENAMED" ? { previousName: event.previousName!, newName: event.newName! } : {})
      })))
    });
  }

  static fromRows(row: CanonicalIngredientRow, eventRows: readonly CanonicalIngredientLifecycleEventRow[]): CanonicalIngredient {
    try {
      if ((row.status !== "Active" && row.status !== "Archived") || !Number.isSafeInteger(row.aggregate_version) || row.aggregate_version < 0) {
        throw invalidState(row.ingredient_id, "has an invalid current lifecycle projection");
      }
      const events = [...eventRows].sort((left, right) => left.aggregate_version - right.aggregate_version);
      events.forEach((event, index) => {
        if (event.ingredient_id !== row.ingredient_id || event.aggregate_version !== index + 1) {
          throw invalidState(row.ingredient_id, "has missing, duplicate, reordered, or foreign lifecycle evidence");
        }
      });
      if (events.length !== row.aggregate_version) throw invalidState(row.ingredient_id, "has lifecycle evidence inconsistent with aggregate version");
      const lifecycleHistory = events.map(eventFromRow);
      const originalName = lifecycleHistory.find((event) => event.eventType === "RENAMED")?.previousName ?? row.name;
      const aggregate = CanonicalIngredient.replay({
        ingredientId: CanonicalIngredientId.parse(row.ingredient_id), name: originalName,
        category: IngredientCategory.parse(row.category_code), createdAt: row.created_at,
        createdBy: row.created_by, lifecycleHistory
      });
      const contract = aggregate.toContract();
      if (contract.name !== row.name || contract.status !== row.status || contract.aggregateVersion !== row.aggregate_version) {
        throw invalidState(row.ingredient_id, "does not match its replayed current state");
      }
      if (contract.archiveFact === undefined) {
        if (row.archived_at !== null || row.archived_by !== null || row.archive_reason !== null) {
          throw invalidState(row.ingredient_id, "has Archive projection fields while replay is Active");
        }
      } else if (
        row.archived_at !== contract.archiveFact.archivedAt
        || row.archived_by !== contract.archiveFact.archivedBy
        || row.archive_reason !== contract.archiveFact.reason
      ) {
        throw invalidState(row.ingredient_id, "has Archive projection fields inconsistent with lifecycle replay");
      }
      return aggregate;
    } catch (error) {
      if (error instanceof InvalidCanonicalIngredientPersistenceState) throw error;
      if (error instanceof CanonicalIngredientError) throw invalidState(row.ingredient_id, "contains invalid persisted state", error);
      throw invalidState(row.ingredient_id, "could not be hydrated", error);
    }
  }
}
