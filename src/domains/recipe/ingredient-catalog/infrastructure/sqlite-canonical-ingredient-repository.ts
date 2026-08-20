import type { DatabaseAdapter } from "../../../../shared/database/database-adapter.js";
import { CanonicalIngredient } from "../canonical-ingredient.js";
import type { CanonicalIngredientRepository } from "../canonical-ingredient-repository.js";
import { CanonicalIngredientError, CanonicalIngredientVersionConflict } from "../errors.js";
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
  CanonicalIngredientLifecycleEventRecord,
  CanonicalIngredientLifecycleEventRow,
  CanonicalIngredientRecord,
  CanonicalIngredientRow
} from "../persistence/records.js";

const INGREDIENT_COLUMNS = "ingredient_id, name, category_code, status, aggregate_version, created_at, created_by, archived_at, archived_by, archive_reason";

function contractsMatch(left: CanonicalIngredient, right: CanonicalIngredient): boolean {
  return JSON.stringify(left.toContract()) === JSON.stringify(right.toContract())
    && JSON.stringify(left.lifecycleHistory) === JSON.stringify(right.lifecycleHistory);
}

function isConstraintFailure(error: unknown): boolean {
  const code = (error as { code?: unknown } | undefined)?.code;
  return typeof code === "string" && code.startsWith("SQLITE_CONSTRAINT");
}

function mapTechnicalFailure(operation: string, error: unknown): never {
  if (error instanceof CanonicalIngredientError || error instanceof CanonicalIngredientPersistenceError) throw error;
  throw new CanonicalIngredientPersistenceFailure(operation, error);
}

export class SqliteCanonicalIngredientRepository implements CanonicalIngredientRepository {
  constructor(private readonly database: DatabaseAdapter) {}

  saveNew(ingredient: CanonicalIngredient): void {
    const mapped = CanonicalIngredientPersistenceMapper.toRecord(ingredient);
    if (mapped.ingredient.status !== "Active" || mapped.ingredient.aggregateVersion !== 0 || mapped.lifecycleEvents.length !== 0) {
      throw new InvalidCanonicalIngredientPersistenceState("A new Canonical Ingredient must be Active at aggregateVersion 0 without lifecycle history.");
    }
    try { this.insertIngredient(mapped.ingredient); }
    catch (error) {
      if (isConstraintFailure(error) && this.rawFindById(mapped.ingredient.ingredientId) !== undefined) throw new DuplicateCanonicalIngredient(mapped.ingredient.ingredientId, error);
      throw new CanonicalIngredientPersistenceFailure("save new Canonical Ingredient", error);
    }
  }

  saveWithExpectedVersion(ingredient: CanonicalIngredient, expectedVersion: number): number {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new CanonicalIngredientVersionConflict(expectedVersion, ingredient.aggregateVersion);
    if (ingredient.aggregateVersion !== expectedVersion + 1) throw new InvalidCanonicalIngredientPersistenceState("Versioned Canonical Ingredient save must contain exactly one lifecycle transition.");
    try {
      return this.database.transactionImmediate(() => {
        const persisted = this.loadById(ingredient.ingredientId.value);
        if (!persisted) throw new CanonicalIngredientPersistenceNotFound(ingredient.ingredientId.value);
        if (persisted.aggregateVersion !== expectedVersion) throw new CanonicalIngredientVersionConflict(expectedVersion, persisted.aggregateVersion);
        const expectedCandidate = this.replaySingleTransition(persisted, ingredient);
        if (!contractsMatch(expectedCandidate, ingredient)) throw new InvalidCanonicalIngredientPersistenceState("Canonical Ingredient mutation does not match one legal Aggregate transition.");
        const mapped = CanonicalIngredientPersistenceMapper.toRecord(ingredient);
        const event = mapped.lifecycleEvents.at(-1);
        if (!event || event.aggregateVersion !== ingredient.aggregateVersion) throw new InvalidCanonicalIngredientPersistenceState("Canonical Ingredient transition is missing lifecycle evidence.");
        this.insertLifecycleEvent(event);
        const result = this.database.execute(
          `UPDATE recipe_canonical_ingredients
              SET name = ?, status = ?, aggregate_version = ?, archived_at = ?, archived_by = ?, archive_reason = ?
            WHERE ingredient_id = ? AND aggregate_version = ?`,
          [
            mapped.ingredient.name, mapped.ingredient.status, mapped.ingredient.aggregateVersion,
            mapped.ingredient.archivedAt ?? null, mapped.ingredient.archivedBy ?? null, mapped.ingredient.archiveReason ?? null,
            mapped.ingredient.ingredientId, expectedVersion
          ]
        );
        if (result.changes !== 1) {
          const current = this.rawFindById(mapped.ingredient.ingredientId);
          throw new CanonicalIngredientVersionConflict(expectedVersion, current?.aggregate_version ?? expectedVersion);
        }
        return mapped.ingredient.aggregateVersion;
      });
    } catch (error) { return mapTechnicalFailure("save Canonical Ingredient with expected version", error); }
  }

  findById(ingredientId: CanonicalIngredientId): CanonicalIngredient | undefined {
    try { return this.loadById(ingredientId.value); } catch (error) { return mapTechnicalFailure("find Canonical Ingredient by identity", error); }
  }
  listActive(): readonly CanonicalIngredient[] { return this.listByStatus("Active", "list active Canonical Ingredients"); }
  listActiveForManagement(): readonly CanonicalIngredient[] { return this.listByStatus("Active", "list Active Canonical Ingredients for management"); }
  listArchivedForManagement(): readonly CanonicalIngredient[] { return this.listByStatus("Archived", "list Archived Canonical Ingredients for management"); }

  searchByName(query: string): readonly CanonicalIngredient[] {
    const candidate = query.trim(); if (!candidate) return Object.freeze([]);
    try {
      const rows = this.database.queryMany<CanonicalIngredientRow>(`SELECT ${INGREDIENT_COLUMNS} FROM recipe_canonical_ingredients WHERE status = 'Active' AND instr(name, ?) > 0 ORDER BY ingredient_id`, [candidate]);
      return Object.freeze(rows.map((row) => this.hydrate(row)));
    } catch (error) { return mapTechnicalFailure("search active Canonical Ingredients", error); }
  }
  findDuplicateCandidates(name: string): readonly CanonicalIngredient[] {
    const candidate = name.trim(); if (!candidate) return Object.freeze([]);
    try {
      const rows = this.database.queryMany<CanonicalIngredientRow>(`SELECT ${INGREDIENT_COLUMNS} FROM recipe_canonical_ingredients WHERE status = 'Active' AND name = ? ORDER BY ingredient_id`, [candidate]);
      return Object.freeze(rows.map((row) => this.hydrate(row)));
    } catch (error) { return mapTechnicalFailure("find active Canonical Ingredients", error); }
  }

  private listByStatus(status: "Active" | "Archived", operation: string): readonly CanonicalIngredient[] {
    try {
      const rows = this.database.queryMany<CanonicalIngredientRow>(`SELECT ${INGREDIENT_COLUMNS} FROM recipe_canonical_ingredients WHERE status = ? ORDER BY name ASC, ingredient_id ASC`, [status]);
      return Object.freeze(rows.map((row) => this.hydrate(row)));
    } catch (error) { return mapTechnicalFailure(operation, error); }
  }
  private insertIngredient(record: CanonicalIngredientRecord): void {
    this.database.execute(`INSERT INTO recipe_canonical_ingredients (ingredient_id, name, category_code, status, aggregate_version, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`, [record.ingredientId, record.name, record.categoryCode, record.status, record.aggregateVersion, record.createdAt, record.createdBy]);
  }
  private insertLifecycleEvent(record: CanonicalIngredientLifecycleEventRecord): void {
    this.database.execute(`INSERT INTO recipe_canonical_ingredient_lifecycle_events (ingredient_id, aggregate_version, event_type, occurred_at, actor, reason, previous_name, new_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [record.ingredientId, record.aggregateVersion, record.eventType, record.occurredAt, record.actor, record.reason, record.previousName ?? null, record.newName ?? null]);
  }
  private rawFindById(ingredientId: string): CanonicalIngredientRow | undefined { return this.database.queryOne<CanonicalIngredientRow>(`SELECT ${INGREDIENT_COLUMNS} FROM recipe_canonical_ingredients WHERE ingredient_id = ?`, [ingredientId]); }
  private rawEvents(ingredientId: string): readonly CanonicalIngredientLifecycleEventRow[] {
    return this.database.queryMany<CanonicalIngredientLifecycleEventRow>(`SELECT ingredient_id, aggregate_version, event_type, occurred_at, actor, reason, previous_name, new_name FROM recipe_canonical_ingredient_lifecycle_events WHERE ingredient_id = ? ORDER BY aggregate_version`, [ingredientId]);
  }
  private loadById(ingredientId: string): CanonicalIngredient | undefined { const row = this.rawFindById(ingredientId); return row ? this.hydrate(row) : undefined; }
  private hydrate(row: CanonicalIngredientRow): CanonicalIngredient { return CanonicalIngredientPersistenceMapper.fromRows(row, this.rawEvents(row.ingredient_id)); }
  private replaySingleTransition(persisted: CanonicalIngredient, candidate: CanonicalIngredient): CanonicalIngredient {
    const before = persisted.toContract(); const after = candidate.toContract();
    if (after.ingredientId !== before.ingredientId || after.categoryCode !== before.categoryCode || after.createdAt !== before.createdAt || after.createdBy !== before.createdBy) throw new InvalidCanonicalIngredientPersistenceState("Canonical Ingredient attempted to alter immutable evidence.");
    const event = candidate.lifecycleHistory.at(-1);
    if (!event || candidate.lifecycleHistory.length !== persisted.lifecycleHistory.length + 1) throw new InvalidCanonicalIngredientPersistenceState("Canonical Ingredient candidate must append one lifecycle event.");
    if (event.eventType === "RENAMED" && event.newName !== undefined) return persisted.rename(event.newName, { occurredAt: event.occurredAt, actorId: event.actor, reason: event.reason });
    if (event.eventType === "ARCHIVED") return persisted.archive({ occurredAt: event.occurredAt, actorId: event.actor, reason: event.reason });
    if (event.eventType === "REACTIVATED") return persisted.reactivate({ occurredAt: event.occurredAt, actorId: event.actor, reason: event.reason });
    throw new InvalidCanonicalIngredientPersistenceState("Canonical Ingredient candidate does not contain one legal lifecycle transition.");
  }
}
