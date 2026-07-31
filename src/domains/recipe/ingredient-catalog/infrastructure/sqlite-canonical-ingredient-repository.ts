import type { DatabaseAdapter } from "../../../../shared/database/database-adapter.js";
import { CanonicalIngredient } from "../canonical-ingredient.js";
import type { CanonicalIngredientRepository } from "../canonical-ingredient-repository.js";
import {
  CanonicalIngredientError,
  CanonicalIngredientVersionConflict
} from "../errors.js";
import { CanonicalIngredientId } from "../identities.js";
import { CanonicalIngredientPersistenceMapper } from "../persistence/canonical-ingredient-persistence-mapper.js";
import {
  CanonicalIngredientPersistenceError,
  CanonicalIngredientPersistenceFailure,
  CanonicalIngredientPersistenceNotFound,
  DuplicateCanonicalIngredient,
  InvalidCanonicalIngredientPersistenceState
} from "../persistence/errors.js";
import type {
  CanonicalIngredientRecord,
  CanonicalIngredientRenameRecord,
  CanonicalIngredientRenameRow,
  CanonicalIngredientRow
} from "../persistence/records.js";

const INGREDIENT_COLUMNS = `
  ingredient_id,
  name,
  category_code,
  status,
  aggregate_version,
  created_at,
  created_by,
  archived_at,
  archived_by,
  archive_reason
`;

function contractsMatch(
  left: CanonicalIngredient,
  right: CanonicalIngredient
): boolean {
  return JSON.stringify(left.toContract()) === JSON.stringify(right.toContract());
}

function isConstraintFailure(error: unknown): boolean {
  const code = (error as { code?: unknown } | undefined)?.code;
  return typeof code === "string" && code.startsWith("SQLITE_CONSTRAINT");
}

function mapTechnicalFailure(operation: string, error: unknown): never {
  if (
    error instanceof CanonicalIngredientError
    || error instanceof CanonicalIngredientPersistenceError
  ) {
    throw error;
  }
  throw new CanonicalIngredientPersistenceFailure(operation, error);
}

export class SqliteCanonicalIngredientRepository
implements CanonicalIngredientRepository {
  constructor(private readonly database: DatabaseAdapter) {}

  saveNew(ingredient: CanonicalIngredient): void {
    const mapped = CanonicalIngredientPersistenceMapper.toRecord(ingredient);
    if (
      mapped.ingredient.status !== "Active"
      || mapped.ingredient.aggregateVersion !== 0
      || mapped.renames.length !== 0
      || mapped.ingredient.archivedAt !== undefined
    ) {
      throw new InvalidCanonicalIngredientPersistenceState(
        "A new Canonical Ingredient must be Active at aggregateVersion 0 without lifecycle history."
      );
    }
    try {
      this.insertIngredient(mapped.ingredient);
    } catch (error) {
      if (
        isConstraintFailure(error)
        && this.rawFindById(mapped.ingredient.ingredientId) !== undefined
      ) {
        throw new DuplicateCanonicalIngredient(
          mapped.ingredient.ingredientId,
          error
        );
      }
      throw new CanonicalIngredientPersistenceFailure(
        "save new Canonical Ingredient",
        error
      );
    }
  }

  saveWithExpectedVersion(
    ingredient: CanonicalIngredient,
    expectedVersion: number
  ): number {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
      throw new CanonicalIngredientVersionConflict(
        expectedVersion,
        ingredient.aggregateVersion
      );
    }
    if (ingredient.aggregateVersion !== expectedVersion + 1) {
      throw new InvalidCanonicalIngredientPersistenceState(
        "Versioned Canonical Ingredient save must contain exactly one new lifecycle transition."
      );
    }

    try {
      return this.database.transactionImmediate(() => {
        const persisted = this.loadById(ingredient.ingredientId.value);
        if (persisted === undefined) {
          throw new CanonicalIngredientPersistenceNotFound(
            ingredient.ingredientId.value
          );
        }
        if (persisted.aggregateVersion !== expectedVersion) {
          throw new CanonicalIngredientVersionConflict(
            expectedVersion,
            persisted.aggregateVersion
          );
        }

        const expectedCandidate = this.replaySingleTransition(
          persisted,
          ingredient
        );
        if (!contractsMatch(expectedCandidate, ingredient)) {
          throw new InvalidCanonicalIngredientPersistenceState(
            "Canonical Ingredient mutation does not match one legal Aggregate transition."
          );
        }

        const mapped = CanonicalIngredientPersistenceMapper.toRecord(ingredient);
        const newRename = mapped.renames.find(
          (rename) => rename.transitionVersion === ingredient.aggregateVersion
        );
        if (newRename !== undefined) {
          this.insertRename(newRename);
        }

        const result = this.database.execute(
          `UPDATE recipe_canonical_ingredients
             SET name = ?,
                 status = ?,
                 aggregate_version = ?,
                 archived_at = ?,
                 archived_by = ?,
                 archive_reason = ?
             WHERE ingredient_id = ?
               AND aggregate_version = ?`,
          [
            mapped.ingredient.name,
            mapped.ingredient.status,
            mapped.ingredient.aggregateVersion,
            mapped.ingredient.archivedAt ?? null,
            mapped.ingredient.archivedBy ?? null,
            mapped.ingredient.archiveReason ?? null,
            mapped.ingredient.ingredientId,
            expectedVersion
          ]
        );
        if (result.changes !== 1) {
          const current = this.rawFindById(mapped.ingredient.ingredientId);
          throw new CanonicalIngredientVersionConflict(
            expectedVersion,
            current?.aggregate_version ?? expectedVersion
          );
        }
        return mapped.ingredient.aggregateVersion;
      });
    } catch (error) {
      return mapTechnicalFailure(
        "save Canonical Ingredient with expected version",
        error
      );
    }
  }

  findById(
    ingredientId: CanonicalIngredientId
  ): CanonicalIngredient | undefined {
    try {
      return this.loadById(ingredientId.value);
    } catch (error) {
      return mapTechnicalFailure("find Canonical Ingredient by identity", error);
    }
  }

  searchByName(query: string): readonly CanonicalIngredient[] {
    const candidate = query.trim();
    if (candidate.length === 0) return Object.freeze([]);
    try {
      const rows = this.database.queryMany<CanonicalIngredientRow>(
        `SELECT ${INGREDIENT_COLUMNS}
           FROM recipe_canonical_ingredients
          WHERE status = 'Active'
            AND instr(name, ?) > 0
          ORDER BY ingredient_id`,
        [candidate]
      );
      return Object.freeze(rows.map((row) => this.hydrate(row)));
    } catch (error) {
      return mapTechnicalFailure("search active Canonical Ingredients", error);
    }
  }

  findDuplicateCandidates(
    name: string
  ): readonly CanonicalIngredient[] {
    const candidate = name.trim();
    if (candidate.length === 0) return Object.freeze([]);
    try {
      const rows = this.database.queryMany<CanonicalIngredientRow>(
        `SELECT ${INGREDIENT_COLUMNS}
           FROM recipe_canonical_ingredients
          WHERE status = 'Active'
            AND name = ?
          ORDER BY ingredient_id`,
        [candidate]
      );
      return Object.freeze(rows.map((row) => this.hydrate(row)));
    } catch (error) {
      return mapTechnicalFailure(
        "find active Canonical Ingredient duplicate candidates",
        error
      );
    }
  }

  private insertIngredient(record: CanonicalIngredientRecord): void {
    this.database.execute(
      `INSERT INTO recipe_canonical_ingredients (
        ingredient_id, name, category_code, status, aggregate_version,
        created_at, created_by, archived_at, archived_by, archive_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.ingredientId,
        record.name,
        record.categoryCode,
        record.status,
        record.aggregateVersion,
        record.createdAt,
        record.createdBy,
        record.archivedAt ?? null,
        record.archivedBy ?? null,
        record.archiveReason ?? null
      ]
    );
  }

  private insertRename(record: CanonicalIngredientRenameRecord): void {
    this.database.execute(
      `INSERT INTO recipe_canonical_ingredient_renames (
        ingredient_id, transition_version, previous_name, new_name,
        renamed_at, renamed_by, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.ingredientId,
        record.transitionVersion,
        record.previousName,
        record.newName,
        record.renamedAt,
        record.renamedBy,
        record.reason
      ]
    );
  }

  private rawFindById(
    ingredientId: string
  ): CanonicalIngredientRow | undefined {
    return this.database.queryOne<CanonicalIngredientRow>(
      `SELECT ${INGREDIENT_COLUMNS}
         FROM recipe_canonical_ingredients
        WHERE ingredient_id = ?`,
      [ingredientId]
    );
  }

  private rawRenames(
    ingredientId: string
  ): readonly CanonicalIngredientRenameRow[] {
    return this.database.queryMany<CanonicalIngredientRenameRow>(
      `SELECT
        ingredient_id,
        transition_version,
        previous_name,
        new_name,
        renamed_at,
        renamed_by,
        reason
       FROM recipe_canonical_ingredient_renames
       WHERE ingredient_id = ?
       ORDER BY transition_version`,
      [ingredientId]
    );
  }

  private loadById(ingredientId: string): CanonicalIngredient | undefined {
    const row = this.rawFindById(ingredientId);
    return row === undefined ? undefined : this.hydrate(row);
  }

  private hydrate(row: CanonicalIngredientRow): CanonicalIngredient {
    return CanonicalIngredientPersistenceMapper.fromRows(
      row,
      this.rawRenames(row.ingredient_id)
    );
  }

  private replaySingleTransition(
    persisted: CanonicalIngredient,
    candidate: CanonicalIngredient
  ): CanonicalIngredient {
    const persistedContract = persisted.toContract();
    const candidateContract = candidate.toContract();
    const immutableFactsMatch =
      candidateContract.ingredientId === persistedContract.ingredientId
      && candidateContract.categoryCode === persistedContract.categoryCode
      && candidateContract.createdAt === persistedContract.createdAt
      && candidateContract.createdBy === persistedContract.createdBy;
    if (!immutableFactsMatch || persisted.status !== "Active") {
      throw new InvalidCanonicalIngredientPersistenceState(
        "Canonical Ingredient attempted to alter immutable evidence or an Archived Aggregate."
      );
    }

    if (
      candidate.status === "Active"
      && candidate.renameHistory.length === persisted.renameHistory.length + 1
      && candidate.archiveFact === undefined
    ) {
      const rename = candidate.renameHistory.at(-1);
      if (rename === undefined) {
        throw new InvalidCanonicalIngredientPersistenceState(
          "Canonical Ingredient rename transition is missing audit evidence."
        );
      }
      return persisted.rename(rename.newName, {
        occurredAt: rename.renamedAt,
        actorId: rename.renamedBy,
        reason: rename.reason
      });
    }

    if (
      candidate.status === "Archived"
      && candidate.renameHistory.length === persisted.renameHistory.length
      && candidate.archiveFact !== undefined
    ) {
      return persisted.archive({
        occurredAt: candidate.archiveFact.archivedAt,
        actorId: candidate.archiveFact.archivedBy,
        reason: candidate.archiveFact.reason
      });
    }

    throw new InvalidCanonicalIngredientPersistenceState(
      "Canonical Ingredient candidate does not contain exactly one Rename or Archive transition."
    );
  }
}
