import type {
  CanonicalIngredientArchiveFactV1,
  CanonicalIngredientContractV1,
  CanonicalIngredientRenameFactV1
} from "../../contracts/canonical-ingredient-contract.js";
import { CanonicalIngredient } from "../canonical-ingredient.js";
import { CanonicalIngredientError } from "../errors.js";
import { CanonicalIngredientId } from "../identities.js";
import { IngredientCategory } from "../ingredient-category.js";
import { InvalidCanonicalIngredientPersistenceState } from "./errors.js";
import type {
  CanonicalIngredientRecord,
  CanonicalIngredientRenameRecord,
  CanonicalIngredientRenameRow,
  CanonicalIngredientRow
} from "./records.js";

function invalidState(
  ingredientId: unknown,
  detail: string,
  cause?: unknown
): InvalidCanonicalIngredientPersistenceState {
  return new InvalidCanonicalIngredientPersistenceState(
    `Canonical Ingredient ${String(ingredientId)} ${detail}.`,
    cause
  );
}

function renameFactMatches(
  fact: CanonicalIngredientRenameFactV1,
  row: CanonicalIngredientRenameRow
): boolean {
  return fact.previousName === row.previous_name
    && fact.newName === row.new_name
    && fact.renamedAt === row.renamed_at
    && fact.renamedBy === row.renamed_by
    && fact.reason === row.reason;
}

function archiveFactMatches(
  fact: CanonicalIngredientArchiveFactV1 | undefined,
  row: CanonicalIngredientRow
): boolean {
  if (fact === undefined) {
    return row.archived_at === null
      && row.archived_by === null
      && row.archive_reason === null;
  }
  return fact.archivedAt === row.archived_at
    && fact.archivedBy === row.archived_by
    && fact.reason === row.archive_reason;
}

function crossCheck(
  contract: CanonicalIngredientContractV1,
  row: CanonicalIngredientRow,
  renameRows: readonly CanonicalIngredientRenameRow[]
): void {
  const currentStateMatches = contract.ingredientId === row.ingredient_id
    && contract.name === row.name
    && contract.categoryCode === row.category_code
    && contract.status === row.status
    && contract.aggregateVersion === row.aggregate_version
    && contract.createdAt === row.created_at
    && contract.createdBy === row.created_by
    && archiveFactMatches(contract.archiveFact, row);
  const completeHistoryMatches = contract.renameHistory.length === renameRows.length
    && contract.renameHistory.every((fact, index) => {
      const persisted = renameRows[index];
      return persisted !== undefined && renameFactMatches(fact, persisted);
    });
  if (!currentStateMatches || !completeHistoryMatches) {
    throw invalidState(
      row.ingredient_id,
      "does not match its replayed current state and history"
    );
  }
}

export class CanonicalIngredientPersistenceMapper {
  static toRecord(ingredient: CanonicalIngredient): Readonly<{
    ingredient: CanonicalIngredientRecord;
    renames: readonly CanonicalIngredientRenameRecord[];
  }> {
    const contract = ingredient.toContract();
    return Object.freeze({
      ingredient: Object.freeze({
        ingredientId: contract.ingredientId,
        name: contract.name,
        categoryCode: contract.categoryCode,
        status: contract.status,
        aggregateVersion: contract.aggregateVersion,
        createdAt: contract.createdAt,
        createdBy: contract.createdBy,
        archivedAt: contract.archiveFact?.archivedAt,
        archivedBy: contract.archiveFact?.archivedBy,
        archiveReason: contract.archiveFact?.reason
      }),
      renames: Object.freeze(
        contract.renameHistory.map((fact, index) => Object.freeze({
          ingredientId: contract.ingredientId,
          transitionVersion: index + 1,
          previousName: fact.previousName,
          newName: fact.newName,
          renamedAt: fact.renamedAt,
          renamedBy: fact.renamedBy,
          reason: fact.reason
        }))
      )
    });
  }

  static fromRows(
    row: CanonicalIngredientRow,
    renameRows: readonly CanonicalIngredientRenameRow[]
  ): CanonicalIngredient {
    try {
      const hasAnyArchiveEvidence = row.archived_at !== null
        || row.archived_by !== null
        || row.archive_reason !== null;
      const hasCompleteArchiveEvidence = row.archived_at !== null
        && row.archived_by !== null
        && row.archive_reason !== null;
      if (hasAnyArchiveEvidence !== hasCompleteArchiveEvidence) {
        throw invalidState(row.ingredient_id, "has incomplete archive evidence");
      }
      if (
        (row.status === "Archived") !== hasCompleteArchiveEvidence
        || (row.status !== "Active" && row.status !== "Archived")
      ) {
        throw invalidState(row.ingredient_id, "has contradictory lifecycle state");
      }
      if (!Number.isSafeInteger(row.aggregate_version) || row.aggregate_version < 0) {
        throw invalidState(row.ingredient_id, "has an invalid aggregate version");
      }

      const orderedRows = [...renameRows].sort(
        (left, right) => left.transition_version - right.transition_version
      );
      orderedRows.forEach((rename, index) => {
        if (
          rename.ingredient_id !== row.ingredient_id
          || rename.transition_version !== index + 1
        ) {
          throw invalidState(
            row.ingredient_id,
            "has missing, duplicate, reordered, or foreign rename history"
          );
        }
      });

      const originalName = orderedRows[0]?.previous_name ?? row.name;
      let aggregate = CanonicalIngredient.create({
        ingredientId: CanonicalIngredientId.parse(row.ingredient_id),
        name: originalName,
        category: IngredientCategory.parse(row.category_code),
        createdAt: row.created_at,
        createdBy: row.created_by
      });

      for (const rename of orderedRows) {
        if (aggregate.name !== rename.previous_name) {
          throw invalidState(row.ingredient_id, "has a broken rename chain");
        }
        aggregate = aggregate.rename(rename.new_name, {
          occurredAt: rename.renamed_at,
          actorId: rename.renamed_by,
          reason: rename.reason
        });
        if (aggregate.aggregateVersion !== rename.transition_version) {
          throw invalidState(row.ingredient_id, "has inconsistent transition versions");
        }
      }

      if (hasCompleteArchiveEvidence) {
        aggregate = aggregate.archive({
          occurredAt: row.archived_at as string,
          actorId: row.archived_by as string,
          reason: row.archive_reason as string
        });
      }

      crossCheck(aggregate.toContract(), row, orderedRows);
      return aggregate;
    } catch (error) {
      if (error instanceof InvalidCanonicalIngredientPersistenceState) {
        throw error;
      }
      if (error instanceof CanonicalIngredientError) {
        throw invalidState(row.ingredient_id, "contains invalid persisted state", error);
      }
      throw invalidState(row.ingredient_id, "could not be hydrated", error);
    }
  }
}
