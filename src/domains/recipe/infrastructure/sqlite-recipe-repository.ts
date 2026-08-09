import { isDeepStrictEqual } from "node:util";
import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import type { RecipeAggregate } from "../domain/recipe-aggregate.js";
import type {
  RecipeBackOfficeListItem,
  RecipeBackOfficeRepository,
  VersionedRecipeAggregate
} from "../domain/recipe-repository.js";
import type {
  RecipeDraftId,
  RecipeId,
  RecipeVersionId
} from "../domain/identities.js";
import {
  InvalidRecipePersistenceState,
  RecipeConcurrencyConflict
} from "../persistence/errors.js";
import { RecipePersistenceMapper } from "../persistence/recipe-persistence-mapper.js";
import type {
  ExactQuantityRecord,
  RecipeDraftRecord,
  RecipeAbandonmentAuditRecord,
  RecipeLineRecord,
  RecipePersistenceRecords,
  RecipePublishAuditRecord,
  RecipeRecord,
  RecipeSupersessionAuditRecord,
  RecipeVersionRecord
} from "../persistence/records.js";

type RecipeRow = Readonly<{
  recipe_id: string;
  recipe_family_id: string;
  product_id: string | null;
  current_draft_id: string;
  current_recipe_version_id: string | null;
  aggregate_version: number;
  state: RecipeRecord["state"];
}>;

type DraftRow = Readonly<{
  draft_id: string;
  recipe_id: string;
  recipe_family_id: string;
  name: string;
  state: RecipeDraftRecord["state"];
  product_id: string | null;
  product_version_id: string | null;
  instructions: string | null;
  standard_output_coefficient: string | null;
  standard_output_scale: number | null;
  standard_output_unit_code: string | null;
  standard_output_dimension: ExactQuantityRecord["measurementDimension"] | null;
  standard_yield_coefficient: string | null;
  standard_yield_scale: number | null;
  standard_yield_unit_code: string | null;
  standard_yield_dimension: ExactQuantityRecord["measurementDimension"] | null;
  created_by: string;
  created_at: string;
}>;

type VersionRow = Readonly<{
  recipe_version_id: string;
  recipe_id: string;
  recipe_family_id: string;
  source_draft_id: string;
  version_number: number;
  state: "Published" | "Superseded";
  name: string;
  product_id: string;
  product_version_id: string;
  instructions: string | null;
  standard_output_coefficient: string;
  standard_output_scale: number;
  standard_output_unit_code: string;
  standard_output_dimension: ExactQuantityRecord["measurementDimension"];
  standard_yield_coefficient: string;
  standard_yield_scale: number;
  standard_yield_unit_code: string;
  standard_yield_dimension: ExactQuantityRecord["measurementDimension"];
  published_by: string;
  published_at: string;
}>;

type LineRow = Readonly<{
  owner_id: string;
  recipe_line_id: string;
  position: number;
  ingredient_id: string;
  ingredient_canonical_name: string;
  ingredient_measurement_dimension:
    RecipeLineRecord["ingredientMeasurementDimension"];
  ingredient_status: RecipeLineRecord["ingredientStatus"];
  ingredient_created_at: string;
  quantity_coefficient: string;
  quantity_scale: number;
  quantity_unit_code: string;
  quantity_dimension: ExactQuantityRecord["measurementDimension"];
  preparation_note: string | null;
}>;

type AbandonmentAuditRow = Readonly<{
  event_key: string;
  recipe_family_id: string;
  recipe_id: string;
  draft_id: string;
  actor: string;
  occurred_at: string;
  reason: string;
  previous_aggregate_version: number;
  resulting_aggregate_version: number;
}>;

type PublishAuditRow = Readonly<{
  event_key: string;
  recipe_id: string;
  draft_id: string;
  recipe_version_id: string;
  version_number: number;
  actor: string;
  occurred_at: string;
}>;

type SupersessionAuditRow = Readonly<{
  event_key: string;
  recipe_id: string;
  superseded_recipe_version_id: string;
  superseded_by_recipe_version_id: string;
  actor: string;
  occurred_at: string;
  reason: string;
}>;

function quantity(
  coefficient: string | null,
  scale: number | null,
  unitCode: string | null,
  dimension: ExactQuantityRecord["measurementDimension"] | null
): ExactQuantityRecord | null {
  if (
    coefficient === null
    && scale === null
    && unitCode === null
    && dimension === null
  ) return null;
  if (
    coefficient === null
    || scale === null
    || unitCode === null
    || dimension === null
  ) {
    throw new InvalidRecipePersistenceState(
      "Persisted Recipe exact quantity is incomplete."
    );
  }
  return Object.freeze({
    coefficient,
    scale,
    unitCode,
    measurementDimension: dimension
  });
}

function draftRecord(row: DraftRow): RecipeDraftRecord {
  return Object.freeze({
    draftId: row.draft_id,
    recipeId: row.recipe_id,
    recipeFamilyId: row.recipe_family_id,
    name: row.name,
    state: row.state,
    productId: row.product_id,
    productVersionId: row.product_version_id,
    instructions: row.instructions,
    standardOutput: quantity(
      row.standard_output_coefficient,
      row.standard_output_scale,
      row.standard_output_unit_code,
      row.standard_output_dimension
    ),
    standardYield: quantity(
      row.standard_yield_coefficient,
      row.standard_yield_scale,
      row.standard_yield_unit_code,
      row.standard_yield_dimension
    ),
    createdBy: row.created_by,
    createdAt: row.created_at
  });
}

function versionRecord(row: VersionRow): RecipeVersionRecord {
  return Object.freeze({
    recipeVersionId: row.recipe_version_id,
    recipeId: row.recipe_id,
    recipeFamilyId: row.recipe_family_id,
    sourceDraftId: row.source_draft_id,
    versionNumber: row.version_number,
    state: row.state,
    name: row.name,
    productId: row.product_id,
    productVersionId: row.product_version_id,
    instructions: row.instructions,
    standardOutput: quantity(
      row.standard_output_coefficient,
      row.standard_output_scale,
      row.standard_output_unit_code,
      row.standard_output_dimension
    )!,
    standardYield: quantity(
      row.standard_yield_coefficient,
      row.standard_yield_scale,
      row.standard_yield_unit_code,
      row.standard_yield_dimension
    )!,
    publishedBy: row.published_by,
    publishedAt: row.published_at
  });
}

function lineRecord(
  row: LineRow,
  ownerType: RecipeLineRecord["ownerType"]
): RecipeLineRecord {
  return Object.freeze({
    ownerType,
    ownerId: row.owner_id,
    position: row.position,
    recipeLineId: row.recipe_line_id,
    ingredientReferenceId: row.ingredient_id,
    ingredientCanonicalName: row.ingredient_canonical_name,
    ingredientMeasurementDimension: row.ingredient_measurement_dimension,
    ingredientStatus: row.ingredient_status,
    ingredientCreatedAt: row.ingredient_created_at,
    quantity: quantity(
      row.quantity_coefficient,
      row.quantity_scale,
      row.quantity_unit_code,
      row.quantity_dimension
    )!,
    preparationNote: row.preparation_note
  });
}

function abandonmentAudit(row: AbandonmentAuditRow): RecipeAbandonmentAuditRecord {
  return Object.freeze({
    eventKey: row.event_key,
    recipeFamilyId: row.recipe_family_id,
    recipeId: row.recipe_id,
    draftId: row.draft_id,
    actor: row.actor,
    occurredAt: row.occurred_at,
    reason: row.reason,
    previousAggregateVersion: row.previous_aggregate_version,
    resultingAggregateVersion: row.resulting_aggregate_version
  });
}

function publishAudit(row: PublishAuditRow): RecipePublishAuditRecord {
  return Object.freeze({
    eventKey: row.event_key,
    recipeId: row.recipe_id,
    draftId: row.draft_id,
    recipeVersionId: row.recipe_version_id,
    versionNumber: row.version_number,
    actor: row.actor,
    occurredAt: row.occurred_at
  });
}

function supersessionAudit(
  row: SupersessionAuditRow
): RecipeSupersessionAuditRecord {
  return Object.freeze({
    eventKey: row.event_key,
    recipeId: row.recipe_id,
    supersededRecipeVersionId: row.superseded_recipe_version_id,
    supersededByRecipeVersionId: row.superseded_by_recipe_version_id,
    actor: row.actor,
    occurredAt: row.occurred_at,
    reason: row.reason
  });
}

export class SqliteRecipeRepository implements RecipeBackOfficeRepository {
  constructor(
    private readonly database: DatabaseAdapter,
    private readonly mapper = new RecipePersistenceMapper()
  ) {}

  save(recipe: RecipeAggregate): void {
    const records = this.mapper.toRecords(recipe, 1);
    try {
      this.database.transactionImmediate(() => {
        const existing = this.rawRecipe(records.recipe.recipeId);
        if (existing !== undefined) {
          throw new RecipeConcurrencyConflict(
            records.recipe.recipeId,
            0,
            existing.aggregate_version
          );
        }
        this.insertRecipe(records.recipe);
        this.writeDraft(records.draft, records.draftLines, false);
        this.appendVersion(records);
        this.appendAbandonment(records.abandonmentAudit);
      });
    } catch (error) {
      this.mapFailure("save new Recipe", error);
    }
  }

  saveWithExpectedVersion(
    recipe: RecipeAggregate,
    expectedAggregateVersion: number
  ): number {
    const recipeId = recipe.recipeId.value;
    if (
      !Number.isSafeInteger(expectedAggregateVersion)
      || expectedAggregateVersion < 1
    ) {
      throw new RecipeConcurrencyConflict(
        recipeId,
        expectedAggregateVersion,
        0
      );
    }
    const nextVersion = expectedAggregateVersion + 1;
    const mapped = this.mapper.toRecords(recipe, nextVersion);
    try {
      return this.database.transactionImmediate(() => {
        const existing = this.rawRecipe(recipeId);
        if (existing === undefined) {
          throw new RecipeConcurrencyConflict(
            recipeId,
            expectedAggregateVersion,
            0
          );
        }
        if (existing.aggregate_version !== expectedAggregateVersion) {
          throw new RecipeConcurrencyConflict(
            recipeId,
            expectedAggregateVersion,
            existing.aggregate_version
          );
        }
        const incoming = this.retainCurrentPublishedPointer(mapped, existing);
        this.validateAppend(incoming);
        const historicalSupersession =
          incoming.recipe.state === "Superseded"
          && existing.current_recipe_version_id
            !== incoming.recipe.currentRecipeVersionId;

        if (!historicalSupersession) {
          const draftExists =
            this.rawDraft(incoming.draft.draftId) !== undefined;
          this.writeDraft(
            incoming.draft,
            incoming.draftLines,
            draftExists
          );
          this.appendVersion(incoming);
          this.appendAbandonment(incoming.abandonmentAudit);
        } else {
          this.appendSupersessions(
            incoming.supersessionAudits,
            incoming.recipe.recipeFamilyId
          );
        }

        const result = historicalSupersession
          ? this.database.execute(
            `UPDATE recipe_recipes
                SET aggregate_version = ?
              WHERE recipe_id = ?
                AND aggregate_version = ?`,
            [nextVersion, recipeId, expectedAggregateVersion]
          )
          : this.database.execute(
            `UPDATE recipe_recipes
                SET current_draft_id = ?,
                    current_recipe_version_id = ?,
                    aggregate_version = ?,
                    state = ?
              WHERE recipe_id = ?
                AND aggregate_version = ?`,
            [
              incoming.recipe.currentDraftId,
              incoming.recipe.currentRecipeVersionId,
              nextVersion,
              incoming.recipe.state,
              recipeId,
              expectedAggregateVersion
            ]
          );
        if (result.changes !== 1) {
          throw new RecipeConcurrencyConflict(
            recipeId,
            expectedAggregateVersion,
            this.rawRecipe(recipeId)?.aggregate_version
              ?? expectedAggregateVersion
          );
        }
        return nextVersion;
      });
    } catch (error) {
      return this.mapFailure("save Recipe with expected version", error);
    }
  }

  findById(recipeId: RecipeId): RecipeAggregate | undefined {
    return this.findWithVersion(recipeId)?.aggregate;
  }

  findWithVersion(recipeId: RecipeId): VersionedRecipeAggregate | undefined {
    try {
      const recipe = this.rawRecipe(recipeId.value);
      if (recipe === undefined) return undefined;
      return this.rehydrate(this.recordsForCurrent(recipe));
    } catch (error) {
      return this.mapFailure("find current Recipe", error);
    }
  }

  findByDraftId(
    draftId: RecipeDraftId
  ): VersionedRecipeAggregate | undefined {
    try {
      const draft = this.rawDraft(draftId.value);
      if (draft === undefined) return undefined;
      const recipe = this.rawRecipe(draft.recipe_id);
      if (recipe === undefined) {
        throw new InvalidRecipePersistenceState(
          "Recipe Draft references a missing Recipe."
        );
      }
      const version = this.database.queryOne<VersionRow>(
        "SELECT * FROM recipe_versions WHERE source_draft_id = ?",
        [draftId.value]
      );
      return version === undefined
        ? this.rehydrate(this.recordsForDraft(recipe, draft))
        : this.rehydrate(this.recordsForVersion(recipe, version));
    } catch (error) {
      return this.mapFailure("find Recipe by Draft identity", error);
    }
  }

  findPublishedVersion(
    recipeId: RecipeId,
    recipeVersionId?: RecipeVersionId
  ): VersionedRecipeAggregate | undefined {
    try {
      const recipe = this.rawRecipe(recipeId.value);
      if (recipe === undefined) return undefined;
      const version = recipeVersionId === undefined
        ? this.database.queryOne<VersionRow>(
          `SELECT *
             FROM recipe_versions
            WHERE recipe_id = ?
            ORDER BY version_number DESC
            LIMIT 1`,
          [recipeId.value]
        )
        : this.database.queryOne<VersionRow>(
          `SELECT *
             FROM recipe_versions
            WHERE recipe_id = ?
              AND recipe_version_id = ?`,
          [recipeId.value, recipeVersionId.value]
        );
      return version === undefined
        ? undefined
        : this.rehydrate(this.recordsForVersion(recipe, version));
    } catch (error) {
      return this.mapFailure("find Published Recipe Version", error);
    }
  }

  listRecipes(): readonly RecipeBackOfficeListItem[] {
    try {
      const rows = this.database.queryMany<
        RecipeRow & { name: string; version_number: number | null }
      >(
        `SELECT
           r.recipe_id,
           r.recipe_family_id,
           r.product_id,
           r.current_draft_id,
           r.current_recipe_version_id,
           r.aggregate_version,
           r.state,
           d.name,
           v.version_number
         FROM recipe_recipes r
         JOIN recipe_drafts d
           ON d.draft_id = r.current_draft_id
         LEFT JOIN recipe_versions v
           ON v.recipe_version_id = r.current_recipe_version_id
         ORDER BY d.name, r.recipe_id`
      );
      for (const row of rows) this.assertCurrentPublishedPointer(row);
      return Object.freeze(rows.map((row) => Object.freeze({
        recipeId: row.recipe_id,
        currentDraftId: row.current_draft_id,
        currentRecipeVersionId: row.current_recipe_version_id,
        aggregateVersion: row.aggregate_version,
        state: row.state,
        name: row.name,
        versionNumber: row.version_number
      })));
    } catch (error) {
      return this.mapFailure("list Recipes", error);
    }
  }

  private rawRecipe(recipeId: string): RecipeRow | undefined {
    return this.database.queryOne<RecipeRow>(
      "SELECT * FROM recipe_recipes WHERE recipe_id = ?",
      [recipeId]
    );
  }

  private rawDraft(draftId: string): DraftRow | undefined {
    return this.database.queryOne<DraftRow>(
      "SELECT * FROM recipe_drafts WHERE draft_id = ?",
      [draftId]
    );
  }

  private rawDraftLines(draftId: string): readonly RecipeLineRecord[] {
    return this.database.queryMany<LineRow>(
      `SELECT
         draft_id AS owner_id,
         recipe_line_id,
         position,
         ingredient_id,
         ingredient_canonical_name,
         ingredient_measurement_dimension,
         ingredient_status,
         ingredient_created_at,
         quantity_coefficient,
         quantity_scale,
         quantity_unit_code,
         quantity_dimension,
         preparation_note
       FROM recipe_draft_lines
       WHERE draft_id = ?
       ORDER BY position`,
      [draftId]
    ).map((row) => lineRecord(row, "draft"));
  }

  private rawVersionLines(
    recipeVersionId: string
  ): readonly RecipeLineRecord[] {
    return this.database.queryMany<LineRow>(
      `SELECT
         recipe_version_id AS owner_id,
         recipe_line_id,
         position,
         ingredient_id,
         ingredient_canonical_name,
         ingredient_measurement_dimension,
         ingredient_status,
         ingredient_created_at,
         quantity_coefficient,
         quantity_scale,
         quantity_unit_code,
         quantity_dimension,
         preparation_note
       FROM recipe_version_lines
       WHERE recipe_version_id = ?
       ORDER BY position`,
      [recipeVersionId]
    ).map((row) => lineRecord(row, "version"));
  }

  private recordsForCurrent(recipe: RecipeRow): RecipePersistenceRecords {
    this.assertCurrentPublishedPointer(recipe);
    const draft = this.rawDraft(recipe.current_draft_id);
    if (draft === undefined) {
      throw new InvalidRecipePersistenceState(
        "Current Recipe Draft record is missing."
      );
    }
    if (recipe.current_recipe_version_id === null || recipe.state === "Draft" || recipe.state === "Abandoned") {
      return this.recordsForDraft(recipe, draft);
    }
    const version = this.database.queryOne<VersionRow>(
      "SELECT * FROM recipe_versions WHERE recipe_version_id = ?",
      [recipe.current_recipe_version_id]
    );
    if (version === undefined) {
      throw new InvalidRecipePersistenceState(
        "Current Recipe Version record is missing."
      );
    }
    return this.recordsForVersion(recipe, version);
  }

  private recordsForDraft(
    recipe: RecipeRow,
    draft: DraftRow
  ): RecipePersistenceRecords {
    this.assertCurrentPublishedPointer(recipe);
    return Object.freeze({
      recipe: Object.freeze({
        recipeId: recipe.recipe_id,
        recipeFamilyId: recipe.recipe_family_id,
        productId: recipe.product_id,
        currentDraftId: draft.draft_id,
        currentRecipeVersionId: recipe.current_recipe_version_id,
        aggregateVersion: recipe.aggregate_version,
        state: recipe.state
      }),
      draft: draftRecord({ ...draft, state: recipe.state }),
      draftLines: Object.freeze(this.rawDraftLines(draft.draft_id)),
      version: null,
      versionLines: Object.freeze([]),
      publishAudit: null,
      supersessionAudits: Object.freeze([]),
      abandonmentAudit: recipe.state === "Abandoned"
        ? this.loadAbandonmentAudit(draft.draft_id)
        : null
    });
  }

  private recordsForVersion(
    recipe: RecipeRow,
    version: VersionRow
  ): RecipePersistenceRecords {
    const draft = this.rawDraft(version.source_draft_id);
    const audit = this.database.queryOne<PublishAuditRow>(
      "SELECT * FROM recipe_publish_audits WHERE recipe_version_id = ?",
      [version.recipe_version_id]
    );
    if (draft === undefined || audit === undefined) {
      throw new InvalidRecipePersistenceState(
        "Published Recipe Version is missing Draft or Publish Audit evidence."
      );
    }
    const supersession = this.database.queryOne<SupersessionAuditRow>(
      `SELECT *
         FROM recipe_supersession_audits
        WHERE superseded_recipe_version_id = ?`,
      [version.recipe_version_id]
    );
    const state = supersession === undefined ? "Published" : "Superseded";
    return Object.freeze({
      recipe: Object.freeze({
        recipeId: recipe.recipe_id,
        recipeFamilyId: recipe.recipe_family_id,
        productId: recipe.product_id,
        currentDraftId: version.source_draft_id,
        currentRecipeVersionId: version.recipe_version_id,
        aggregateVersion: recipe.aggregate_version,
        state
      }),
      draft: draftRecord({ ...draft, state }),
      draftLines: Object.freeze([]),
      version: versionRecord(version),
      versionLines: Object.freeze(
        this.rawVersionLines(version.recipe_version_id)
      ),
      publishAudit: publishAudit(audit),
      supersessionAudits: Object.freeze(
        supersession === undefined
          ? []
          : [supersessionAudit(supersession)]
      ),
      abandonmentAudit: null
    });
  }

  private loadAbandonmentAudit(draftId: string): RecipeAbandonmentAuditRecord {
    const row = this.database.queryOne<AbandonmentAuditRow>(
      "SELECT * FROM recipe_abandonment_audits WHERE draft_id = ?",
      [draftId]
    );
    if (!row) throw new InvalidRecipePersistenceState("Abandoned Draft is missing append-only audit evidence.");
    return abandonmentAudit(row);
  }

  private insertRecipe(record: RecipeRecord): void {
    this.database.execute(
      `INSERT INTO recipe_recipes (
        recipe_id, recipe_family_id, product_id, current_draft_id,
        current_recipe_version_id, aggregate_version, state
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.recipeId,
        record.recipeFamilyId,
        record.productId,
        record.currentDraftId,
        record.currentRecipeVersionId,
        record.aggregateVersion,
        record.state
      ]
    );
  }

  private writeDraft(
    record: RecipeDraftRecord,
    lines: readonly RecipeLineRecord[],
    update: boolean
  ): void {
    const output = record.standardOutput;
    const yieldQuantity = record.standardYield;
    if (update) {
      this.database.execute(
        `UPDATE recipe_drafts
            SET name = ?,
                state = ?,
                product_id = ?,
                product_version_id = ?,
                instructions = ?,
                standard_output_coefficient = ?,
                standard_output_scale = ?,
                standard_output_unit_code = ?,
                standard_output_dimension = ?,
                standard_yield_coefficient = ?,
                standard_yield_scale = ?,
                standard_yield_unit_code = ?,
                standard_yield_dimension = ?
          WHERE draft_id = ?
            AND recipe_id = ?`,
        [
          record.name,
          record.state,
          record.productId,
          record.productVersionId,
          record.instructions,
          output?.coefficient ?? null,
          output?.scale ?? null,
          output?.unitCode ?? null,
          output?.measurementDimension ?? null,
          yieldQuantity?.coefficient ?? null,
          yieldQuantity?.scale ?? null,
          yieldQuantity?.unitCode ?? null,
          yieldQuantity?.measurementDimension ?? null,
          record.draftId,
          record.recipeId
        ]
      );
      this.database.execute(
        "DELETE FROM recipe_draft_lines WHERE draft_id = ?",
        [record.draftId]
      );
    } else {
      this.database.execute(
        `INSERT INTO recipe_drafts (
          draft_id, recipe_id, recipe_family_id, name, state, product_id, product_version_id, instructions,
          standard_output_coefficient, standard_output_scale,
          standard_output_unit_code, standard_output_dimension,
          standard_yield_coefficient, standard_yield_scale,
          standard_yield_unit_code, standard_yield_dimension,
          created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.draftId,
          record.recipeId,
          record.recipeFamilyId,
          record.name,
          record.state,
          record.productId,
          record.productVersionId,
          record.instructions,
          output?.coefficient ?? null,
          output?.scale ?? null,
          output?.unitCode ?? null,
          output?.measurementDimension ?? null,
          yieldQuantity?.coefficient ?? null,
          yieldQuantity?.scale ?? null,
          yieldQuantity?.unitCode ?? null,
          yieldQuantity?.measurementDimension ?? null,
          record.createdBy,
          record.createdAt
        ]
      );
    }
    for (const line of lines) this.insertDraftLine(line);
  }

  private insertDraftLine(line: RecipeLineRecord): void {
    this.database.execute(
      `INSERT INTO recipe_draft_lines (
        draft_id, recipe_line_id, position, ingredient_id, ingredient_canonical_name,
        ingredient_measurement_dimension, ingredient_status,
        ingredient_created_at, quantity_coefficient, quantity_scale,
        quantity_unit_code, quantity_dimension, preparation_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        line.ownerId,
        line.recipeLineId,
        line.position,
        line.ingredientReferenceId,
        line.ingredientCanonicalName,
        line.ingredientMeasurementDimension,
        line.ingredientStatus,
        line.ingredientCreatedAt,
        line.quantity.coefficient,
        line.quantity.scale,
        line.quantity.unitCode,
        line.quantity.measurementDimension,
        line.preparationNote
      ]
    );
  }

  private appendVersion(records: RecipePersistenceRecords): void {
    if (records.version === null || records.publishAudit === null) {
      this.appendSupersessions(
        records.supersessionAudits,
        records.recipe.recipeFamilyId
      );
      return;
    }
    const existing = this.database.queryOne<VersionRow>(
      "SELECT * FROM recipe_versions WHERE recipe_version_id = ?",
      [records.version.recipeVersionId]
    );
    if (existing === undefined) {
      this.insertVersion(records.version);
      for (const line of records.versionLines) this.insertVersionLine(line);
      this.insertPublishAudit(records.publishAudit, records.recipe.recipeFamilyId);
    } else {
      const existingRecords = this.recordsForVersion(
        this.rawRecipe(records.recipe.recipeId)!,
        existing
      );
      if (
        !isDeepStrictEqual(existingRecords.version, records.version)
        || !isDeepStrictEqual(
          existingRecords.versionLines,
          records.versionLines
        )
        || !isDeepStrictEqual(
          existingRecords.publishAudit,
          records.publishAudit
        )
      ) {
        throw new InvalidRecipePersistenceState(
          `Published Recipe Version ${records.version.recipeVersionId} cannot be overwritten.`
        );
      }
    }
    this.appendSupersessions(
      records.supersessionAudits,
      records.recipe.recipeFamilyId
    );
  }

  private insertVersion(record: RecipeVersionRecord): void {
    this.database.execute(
      `INSERT INTO recipe_versions (
        recipe_version_id, recipe_id, source_draft_id, version_number, name,
        recipe_family_id, state, product_id, product_version_id, instructions, standard_output_coefficient,
        standard_output_scale, standard_output_unit_code,
        standard_output_dimension, standard_yield_coefficient,
        standard_yield_scale, standard_yield_unit_code,
        standard_yield_dimension, published_by, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.recipeVersionId,
        record.recipeId,
        record.sourceDraftId,
        record.versionNumber,
        record.name,
        record.recipeFamilyId,
        record.state,
        record.productId,
        record.productVersionId,
        record.instructions,
        record.standardOutput.coefficient,
        record.standardOutput.scale,
        record.standardOutput.unitCode,
        record.standardOutput.measurementDimension,
        record.standardYield.coefficient,
        record.standardYield.scale,
        record.standardYield.unitCode,
        record.standardYield.measurementDimension,
        record.publishedBy,
        record.publishedAt
      ]
    );
  }

  private insertVersionLine(line: RecipeLineRecord): void {
    this.database.execute(
      `INSERT INTO recipe_version_lines (
        recipe_version_id, recipe_line_id, position, ingredient_id,
        ingredient_canonical_name, ingredient_measurement_dimension,
        ingredient_status, ingredient_created_at, quantity_coefficient,
        quantity_scale, quantity_unit_code, quantity_dimension, preparation_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        line.ownerId,
        line.recipeLineId,
        line.position,
        line.ingredientReferenceId,
        line.ingredientCanonicalName,
        line.ingredientMeasurementDimension,
        line.ingredientStatus,
        line.ingredientCreatedAt,
        line.quantity.coefficient,
        line.quantity.scale,
        line.quantity.unitCode,
        line.quantity.measurementDimension,
        line.preparationNote
      ]
    );
  }

  private insertPublishAudit(
    record: RecipePublishAuditRecord,
    recipeFamilyId: string
  ): void {
    this.database.execute(
      `INSERT INTO recipe_publish_audits (
        event_key, recipe_family_id, recipe_id, draft_id, recipe_version_id,
        version_number, actor, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.eventKey,
        recipeFamilyId,
        record.recipeId,
        record.draftId,
        record.recipeVersionId,
        record.versionNumber,
        record.actor,
        record.occurredAt
      ]
    );
  }

  private appendSupersessions(
    records: readonly RecipeSupersessionAuditRecord[],
    recipeFamilyId: string
  ): void {
    for (const record of records) {
      const existing = this.database.queryOne<SupersessionAuditRow>(
        `SELECT *
           FROM recipe_supersession_audits
          WHERE superseded_recipe_version_id = ?`,
        [record.supersededRecipeVersionId]
      );
      if (existing !== undefined) {
        if (!isDeepStrictEqual(supersessionAudit(existing), record)) {
          throw new InvalidRecipePersistenceState(
            `Supersession for ${record.supersededRecipeVersionId} cannot be overwritten.`
          );
        }
        continue;
      }
      const target = this.database.queryOne<{ present: number }>(
        `SELECT 1 AS present
           FROM recipe_versions
          WHERE recipe_version_id = ?`,
        [record.supersededByRecipeVersionId]
      );
      if (target === undefined) {
        throw new InvalidRecipePersistenceState(
          "Supersession target must already be an appended Published Recipe Version."
        );
      }
      this.database.execute(
        `INSERT INTO recipe_supersession_audits (
          event_key, recipe_family_id, recipe_id, superseded_recipe_version_id,
          superseded_by_recipe_version_id, actor, occurred_at, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.eventKey,
          recipeFamilyId,
          record.recipeId,
          record.supersededRecipeVersionId,
          record.supersededByRecipeVersionId,
          record.actor,
          record.occurredAt,
          record.reason
        ]
      );
    }
  }

  private appendAbandonment(
    record: RecipeAbandonmentAuditRecord | null
  ): void {
    if (record === null) return;
    const existing = this.database.queryOne<AbandonmentAuditRow>(
      "SELECT * FROM recipe_abandonment_audits WHERE draft_id = ?",
      [record.draftId]
    );
    if (existing !== undefined) {
      if (!isDeepStrictEqual(abandonmentAudit(existing), record)) {
        throw new InvalidRecipePersistenceState(
          `Abandonment evidence for ${record.draftId} cannot be overwritten.`
        );
      }
      return;
    }
    this.database.execute(
      `INSERT INTO recipe_abandonment_audits (
        event_key, recipe_family_id, recipe_id, draft_id, actor,
        occurred_at, reason, previous_aggregate_version,
        resulting_aggregate_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.eventKey,
        record.recipeFamilyId,
        record.recipeId,
        record.draftId,
        record.actor,
        record.occurredAt,
        record.reason,
        record.previousAggregateVersion,
        record.resultingAggregateVersion
      ]
    );
  }

  private validateAppend(records: RecipePersistenceRecords): void {
    if (records.version !== null) {
      const latest = this.database.queryOne<{ version_number: number }>(
        `SELECT version_number
           FROM recipe_versions
          WHERE recipe_id = ?
            AND recipe_version_id <> ?
          ORDER BY version_number DESC
          LIMIT 1`,
        [records.recipe.recipeId, records.version.recipeVersionId]
      );
      const existing = this.database.queryOne<{ present: number }>(
        `SELECT 1 AS present
           FROM recipe_versions
          WHERE recipe_version_id = ?`,
        [records.version.recipeVersionId]
      );
      if (
        existing === undefined
        && latest !== undefined
        && records.version.versionNumber <= latest.version_number
      ) {
        throw new InvalidRecipePersistenceState(
          `Recipe Version number ${records.version.versionNumber} must be greater than ${latest.version_number}.`
        );
      }
    }
  }

  private retainCurrentPublishedPointer(
    incoming: RecipePersistenceRecords,
    existing: RecipeRow
  ): RecipePersistenceRecords {
    if (incoming.recipe.state !== "Draft" && incoming.recipe.state !== "Abandoned") {
      return incoming;
    }
    this.assertCurrentPublishedPointer(existing);
    if (
      incoming.recipe.currentRecipeVersionId !== null
      && incoming.recipe.currentRecipeVersionId !== existing.current_recipe_version_id
    ) {
      throw new InvalidRecipePersistenceState(
        "Draft or Abandoned persistence cannot replace the current Published Recipe Version pointer."
      );
    }
    if (incoming.recipe.currentRecipeVersionId === existing.current_recipe_version_id) {
      return incoming;
    }
    return Object.freeze({
      ...incoming,
      recipe: Object.freeze({
        ...incoming.recipe,
        currentRecipeVersionId: existing.current_recipe_version_id
      })
    });
  }

  private assertCurrentPublishedPointer(recipe: RecipeRow): void {
    const pointer = recipe.current_recipe_version_id;
    if (pointer === null) {
      if (recipe.state === "Published" || recipe.state === "Superseded") {
        throw new InvalidRecipePersistenceState(
          "Published or Superseded Recipe records require a current Recipe Version pointer."
        );
      }
      return;
    }
    const version = this.database.queryOne<VersionRow>(
      "SELECT * FROM recipe_versions WHERE recipe_version_id = ?",
      [pointer]
    );
    if (
      version === undefined
      || version.recipe_id !== recipe.recipe_id
      || version.recipe_family_id !== recipe.recipe_family_id
      || version.state !== "Published"
    ) {
      throw new InvalidRecipePersistenceState(
        "Current Recipe Version pointer must identify the same Recipe Family's existing Published Version."
      );
    }
    const evidence = this.recordsForVersion(recipe, version);
    if (
      evidence.recipe.state !== "Published"
      || evidence.recipe.currentRecipeVersionId !== pointer
    ) {
      throw new InvalidRecipePersistenceState(
        "Current Recipe Version pointer must retain complete unsuperseded publication evidence."
      );
    }
    this.mapper.fromRecords(evidence);
  }

  private rehydrate(
    records: RecipePersistenceRecords
  ): VersionedRecipeAggregate {
    return Object.freeze({
      aggregate: this.mapper.fromRecords(records),
      aggregateVersion: records.recipe.aggregateVersion
    });
  }

  private mapFailure(operation: string, error: unknown): never {
    if (
      error instanceof InvalidRecipePersistenceState
      || error instanceof RecipeConcurrencyConflict
    ) {
      throw error;
    }
    const detail = error instanceof Error ? ` ${error.message}` : "";
    throw new InvalidRecipePersistenceState(
      `Failed to ${operation}.${detail}`,
      error
    );
  }
}
