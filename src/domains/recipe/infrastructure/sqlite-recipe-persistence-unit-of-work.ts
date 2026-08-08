import { DatabaseTransactionFailure, type DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import {
  InvalidRecipePersistenceState,
  InvalidRecipeReceiptEvidence,
  RecipeConcurrencyConflict,
  RecipeIdempotencyConflict,
  RecipeLineIdentityPersistenceCollision,
  RecipePersistenceError,
  RecipePersistenceTransactionFailure
} from "../persistence/errors.js";
import {
  RECIPE_RECEIPT_FINGERPRINT_ALGORITHM,
  RECIPE_RECEIPT_INPUT_VERSION,
  expectedRecipeReceiptFingerprint,
  type DraftAbandonmentPersistenceInput,
  type DraftAbandonmentPersistenceResult,
  type FamilyCreationPersistenceInput,
  type FamilyCreationPersistenceResult,
  type ReceiptRequestEvidence,
  type RecipePersistenceUnitOfWork,
  type RecipePublicationPersistenceInput,
  type RecipePublicationPersistenceResult
} from "../persistence/recipe-persistence-unit-of-work.js";
import type { RecipeLineRecord } from "../persistence/records.js";

type RecipeRow = Readonly<{
  recipe_id: string;
  recipe_family_id: string;
  product_id: string | null;
  current_draft_id: string;
  current_recipe_version_id: string | null;
  aggregate_version: number;
  state: string;
}>;

type ReceiptRow = Readonly<{
  operation_type: ReceiptRequestEvidence["operationType"];
  scope_type: ReceiptRequestEvidence["scopeType"];
  scope_id: string;
  idempotency_key: string;
  request_fingerprint: string;
  result_recipe_family_id: string;
  result_recipe_id: string;
  result_draft_id: string;
  result_recipe_version_id: string | null;
  result_version_number: number | null;
  result_state: string | null;
  result_event_id: string;
  result_current_recipe_version_id: string | null;
  result_aggregate_version: number;
  created_at: string;
}>;

const LOWERCASE_SHA256 = /^[0-9a-f]{64}$/;
const RECIPE_ID = /^recipe_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const FAMILY_ID = /^recipe_family_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DRAFT_ID = /^recipe_draft_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VERSION_ID = /^recipe_version_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LINE_ID = /^recipe_line_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class SqliteRecipePersistenceUnitOfWork implements RecipePersistenceUnitOfWork {
  constructor(private readonly database: DatabaseAdapter) {}

  createFamilyWithInitialDraft(input: FamilyCreationPersistenceInput): FamilyCreationPersistenceResult {
    this.assertIdentity(input.recipeFamilyId, FAMILY_ID, "Recipe Family");
    this.assertIdentity(input.recipeId, RECIPE_ID, "Recipe");
    this.assertIdentity(input.initialDraftId, DRAFT_ID, "Recipe Draft");
    this.validateReceipt(input.receipt, "FAMILY_CREATE", "PRODUCT", input.productId, input);
    this.validateLines(input.initialLines, input.initialDraftId, "draft");
    if (!Number.isSafeInteger(input.initialAggregateVersion) || input.initialAggregateVersion < 1) {
      throw new InvalidRecipePersistenceState("Initial Recipe aggregate version must be a positive safe integer.");
    }
    return this.run("create Recipe Family", () => {
      const replay = this.arbitrateReceipt(input.receipt);
      if (replay) return this.familyResult(replay);

      this.database.execute(
        `INSERT INTO recipe_recipes (
          recipe_id, recipe_family_id, product_id, current_draft_id,
          current_recipe_version_id, aggregate_version, state
        ) VALUES (?, ?, ?, ?, NULL, ?, 'Draft')`,
        [input.recipeId, input.recipeFamilyId, input.productId, input.initialDraftId, input.initialAggregateVersion]
      );
      this.database.execute(
        `INSERT INTO recipe_drafts (
          draft_id, recipe_id, recipe_family_id, name, state, product_id,
          product_version_id, instructions, standard_output_coefficient,
          standard_output_scale, standard_output_unit_code,
          standard_output_dimension, standard_yield_coefficient,
          standard_yield_scale, standard_yield_unit_code,
          standard_yield_dimension, created_by, created_at
        ) VALUES (?, ?, ?, ?, 'Draft', ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
        [
          input.initialDraftId, input.recipeId, input.recipeFamilyId,
          input.initialDraftName, input.productId, input.productVersionId,
          input.instructions, input.creationAudit.actor, input.creationAudit.occurredAt
        ]
      );
      input.initialLines.forEach((line) => this.insertDraftLine(line));
      this.database.execute(
        `INSERT INTO recipe_creation_audits (
          event_key, recipe_family_id, product_id, recipe_id, initial_draft_id,
          actor, occurred_at, resulting_aggregate_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.creationAudit.eventId, input.recipeFamilyId, input.productId,
          input.recipeId, input.initialDraftId, input.creationAudit.actor,
          input.creationAudit.occurredAt, input.initialAggregateVersion
        ]
      );
      this.insertReceipt(input.receipt, {
        familyId: input.recipeFamilyId,
        recipeId: input.recipeId,
        draftId: input.initialDraftId,
        versionId: null,
        versionNumber: null,
        state: null,
        eventId: input.creationAudit.eventId,
        currentVersionId: null,
        aggregateVersion: input.initialAggregateVersion
      });
      return Object.freeze({
        recipeFamilyId: input.recipeFamilyId,
        recipeId: input.recipeId,
        initialDraftId: input.initialDraftId,
        resultingAggregateVersion: input.initialAggregateVersion,
        creationAuditEventId: input.creationAudit.eventId,
        receiptCreatedAt: input.receipt.receiptCreatedAt
      });
    });
  }

  abandonDraft(input: DraftAbandonmentPersistenceInput): DraftAbandonmentPersistenceResult {
    this.assertIdentity(input.recipeFamilyId, FAMILY_ID, "Recipe Family");
    this.assertIdentity(input.recipeId, RECIPE_ID, "Recipe");
    this.assertIdentity(input.draftId, DRAFT_ID, "Recipe Draft");
    this.validateReceipt(input.receipt, "DRAFT_ABANDON", "RECIPE_DRAFT", input.draftId, input);
    if (input.expectedCurrentDraftId !== input.draftId) {
      throw new InvalidRecipePersistenceState("Abandonment target must be the expected current Draft.");
    }
    if (
      input.abandonment.previousAggregateVersion !== input.expectedAggregateVersion
      || input.abandonment.resultingAggregateVersion !== input.expectedAggregateVersion + 1
      || input.abandonment.reason.trim().length === 0
    ) throw new InvalidRecipePersistenceState("Abandonment version or reason evidence is invalid.");

    return this.run("abandon Recipe Draft", () => {
      const replay = this.arbitrateReceipt(input.receipt);
      if (replay) return this.abandonmentResult(replay);
      const recipe = this.requireRecipe(input.recipeId);
      this.assertOwner(recipe, input.recipeFamilyId);
      if (recipe.current_draft_id !== input.expectedCurrentDraftId || recipe.state !== "Draft") {
        throw new InvalidRecipePersistenceState("Recipe Draft is not the current editable Draft.");
      }
      this.assertVersion(recipe, input.expectedAggregateVersion);

      const draftUpdate = this.database.execute(
        `UPDATE recipe_drafts SET state = 'Abandoned'
          WHERE draft_id = ? AND recipe_id = ? AND recipe_family_id = ? AND state = 'Draft'`,
        [input.draftId, input.recipeId, input.recipeFamilyId]
      );
      const recipeUpdate = this.database.execute(
        `UPDATE recipe_recipes SET state = 'Abandoned', aggregate_version = ?
          WHERE recipe_id = ? AND recipe_family_id = ? AND aggregate_version = ? AND current_draft_id = ?`,
        [input.abandonment.resultingAggregateVersion, input.recipeId, input.recipeFamilyId, input.expectedAggregateVersion, input.draftId]
      );
      if (draftUpdate.changes !== 1 || recipeUpdate.changes !== 1) {
        throw new RecipeConcurrencyConflict(input.recipeId, input.expectedAggregateVersion, this.requireRecipe(input.recipeId).aggregate_version);
      }
      this.database.execute(
        `INSERT INTO recipe_abandonment_audits (
          event_key, recipe_family_id, recipe_id, draft_id, actor, occurred_at,
          reason, previous_aggregate_version, resulting_aggregate_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.abandonment.eventId, input.recipeFamilyId, input.recipeId,
          input.draftId, input.abandonment.actor, input.abandonment.occurredAt,
          input.abandonment.reason, input.abandonment.previousAggregateVersion,
          input.abandonment.resultingAggregateVersion
        ]
      );
      this.insertReceipt(input.receipt, {
        familyId: input.recipeFamilyId, recipeId: input.recipeId, draftId: input.draftId,
        versionId: null, versionNumber: null, state: "Abandoned",
        eventId: input.abandonment.eventId, currentVersionId: recipe.current_recipe_version_id,
        aggregateVersion: input.abandonment.resultingAggregateVersion
      });
      return Object.freeze({
        recipeFamilyId: input.recipeFamilyId, recipeId: input.recipeId,
        draftId: input.draftId, state: "Abandoned" as const,
        abandonmentEventId: input.abandonment.eventId,
        resultingAggregateVersion: input.abandonment.resultingAggregateVersion,
        currentRecipeVersionId: recipe.current_recipe_version_id,
        receiptCreatedAt: input.receipt.receiptCreatedAt
      });
    });
  }

  publishRecipeVersion(input: RecipePublicationPersistenceInput): RecipePublicationPersistenceResult {
    this.assertIdentity(input.recipeFamilyId, FAMILY_ID, "Recipe Family");
    this.assertIdentity(input.recipeId, RECIPE_ID, "Recipe");
    this.assertIdentity(input.sourceDraftId, DRAFT_ID, "Recipe Draft");
    this.assertIdentity(input.resultingCurrentRecipeVersionId, VERSION_ID, "Recipe Version");
    this.validateReceipt(input.receipt, "RECIPE_PUBLISH", "RECIPE_FAMILY", input.recipeFamilyId, input);
    const snapshot = input.publishedVersionSnapshot;
    this.validatePublicationInput(input);
    this.validateLines(snapshot.lines, snapshot.version.recipeVersionId, "version");

    return this.run("publish Recipe Version", () => {
      const replay = this.arbitrateReceipt(input.receipt);
      if (replay) return this.publicationResult(replay);
      const recipe = this.requireRecipe(input.recipeId);
      this.assertOwner(recipe, input.recipeFamilyId);
      this.assertVersion(recipe, input.expectedAggregateVersion);
      if (
        recipe.current_draft_id !== input.sourceDraftId
        || recipe.current_recipe_version_id !== input.expectedCurrentRecipeVersionId
        || recipe.state !== "Draft"
      ) throw new InvalidRecipePersistenceState("Recipe publication prerequisites do not match current persisted state.");
      this.assertPublishedLinesMatchDraft(input);

      const version = snapshot.version;
      this.database.execute(
        `INSERT INTO recipe_versions (
          recipe_version_id, recipe_id, recipe_family_id, source_draft_id,
          version_number, state, name, product_id, product_version_id,
          instructions, standard_output_coefficient, standard_output_scale,
          standard_output_unit_code, standard_output_dimension,
          standard_yield_coefficient, standard_yield_scale,
          standard_yield_unit_code, standard_yield_dimension,
          published_by, published_at
        ) VALUES (?, ?, ?, ?, ?, 'Published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          version.recipeVersionId, input.recipeId, input.recipeFamilyId,
          input.sourceDraftId, version.versionNumber, version.name,
          version.productId, version.productVersionId, version.instructions,
          version.standardOutput.coefficient, version.standardOutput.scale,
          version.standardOutput.unitCode, version.standardOutput.measurementDimension,
          version.standardYield.coefficient, version.standardYield.scale,
          version.standardYield.unitCode, version.standardYield.measurementDimension,
          version.publishedBy, version.publishedAt
        ]
      );
      snapshot.lines.forEach((line) => this.insertVersionLine(line));
      this.database.execute(
        `INSERT INTO recipe_publish_audits (
          event_key, recipe_family_id, recipe_id, draft_id, recipe_version_id,
          version_number, actor, occurred_at, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.publicationAudit.eventKey, input.recipeFamilyId, input.recipeId,
          input.sourceDraftId, version.recipeVersionId, version.versionNumber,
          input.publicationAudit.actor, input.publicationAudit.occurredAt,
          input.publicationAudit.reason
        ]
      );
      if (input.expectedCurrentRecipeVersionId !== null) {
        const supersession = input.supersessionAudit!;
        const superseded = this.database.execute(
          "UPDATE recipe_versions SET state = 'Superseded' WHERE recipe_version_id = ? AND recipe_family_id = ? AND state = 'Published'",
          [input.expectedCurrentRecipeVersionId, input.recipeFamilyId]
        );
        if (superseded.changes !== 1) throw new InvalidRecipePersistenceState("Previous current Recipe Version cannot be superseded.");
        this.database.execute(
          `INSERT INTO recipe_supersession_audits (
            event_key, recipe_family_id, recipe_id, superseded_recipe_version_id,
            superseded_by_recipe_version_id, actor, occurred_at, reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            supersession.eventKey, input.recipeFamilyId, input.recipeId,
            supersession.supersededRecipeVersionId, supersession.supersededByRecipeVersionId,
            supersession.actor, supersession.occurredAt, supersession.reason
          ]
        );
      }
      this.database.execute("UPDATE recipe_drafts SET state = 'Published' WHERE draft_id = ? AND state = 'Draft'", [input.sourceDraftId]);
      const pointer = this.database.execute(
        `UPDATE recipe_recipes
            SET current_recipe_version_id = ?, state = 'Published', aggregate_version = ?
          WHERE recipe_id = ? AND recipe_family_id = ? AND aggregate_version = ?
            AND current_draft_id = ? AND current_recipe_version_id IS ?`,
        [
          input.resultingCurrentRecipeVersionId, input.resultingAggregateVersion,
          input.recipeId, input.recipeFamilyId, input.expectedAggregateVersion,
          input.sourceDraftId, input.expectedCurrentRecipeVersionId
        ]
      );
      if (pointer.changes !== 1) throw new RecipeConcurrencyConflict(input.recipeId, input.expectedAggregateVersion, this.requireRecipe(input.recipeId).aggregate_version);
      this.insertReceipt(input.receipt, {
        familyId: input.recipeFamilyId, recipeId: input.recipeId,
        draftId: input.sourceDraftId, versionId: version.recipeVersionId,
        versionNumber: version.versionNumber, state: null,
        eventId: input.publicationAudit.eventKey,
        currentVersionId: input.resultingCurrentRecipeVersionId,
        aggregateVersion: input.resultingAggregateVersion
      });
      return Object.freeze({
        recipeFamilyId: input.recipeFamilyId, recipeId: input.recipeId,
        sourceDraftId: input.sourceDraftId, recipeVersionId: version.recipeVersionId,
        versionNumber: version.versionNumber,
        currentRecipeVersionId: input.resultingCurrentRecipeVersionId,
        resultingAggregateVersion: input.resultingAggregateVersion,
        publicationAuditEventId: input.publicationAudit.eventKey,
        supersessionAuditEventId: input.supersessionAudit?.eventKey ?? null,
        receiptCreatedAt: input.receipt.receiptCreatedAt
      });
    });
  }

  private run<T>(operation: string, work: () => T): T {
    try {
      return this.database.transactionImmediate(work);
    } catch (error) {
      if (error instanceof RecipePersistenceError) throw error;
      if (error instanceof DatabaseTransactionFailure) {
        throw new RecipePersistenceTransactionFailure(
          error.phase, error.rollbackFailure, error.adapterUnsafe, error.primaryCause
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      if (/recipe_(draft|version)_lines.*(UNIQUE|PRIMARY KEY)|UNIQUE constraint failed: recipe_(draft|version)_lines/i.test(message)) {
        throw new RecipeLineIdentityPersistenceCollision("Recipe Line owner", "persisted Recipe Line", error);
      }
      throw new InvalidRecipePersistenceState(`Could not ${operation}. ${message}`, error);
    }
  }

  private validateReceipt(
    receipt: ReceiptRequestEvidence,
    operation: ReceiptRequestEvidence["operationType"],
    scope: ReceiptRequestEvidence["scopeType"],
    scopeId: string,
    input: FamilyCreationPersistenceInput | DraftAbandonmentPersistenceInput | RecipePublicationPersistenceInput
  ): void {
    if (
      receipt.operationType !== operation || receipt.scopeType !== scope || receipt.scopeId !== scopeId
      || receipt.canonicalInputVersion !== RECIPE_RECEIPT_INPUT_VERSION
      || receipt.requestFingerprintAlgorithm !== RECIPE_RECEIPT_FINGERPRINT_ALGORITHM
      || !LOWERCASE_SHA256.test(receipt.requestFingerprint)
      || Buffer.byteLength(receipt.idempotencyKey, "utf8") < 1
      || Buffer.byteLength(receipt.idempotencyKey, "utf8") > 200
    ) throw new InvalidRecipeReceiptEvidence("Recipe receipt operation, scope, key, version, or fingerprint evidence is invalid.");
    if (expectedRecipeReceiptFingerprint(input) !== receipt.requestFingerprint) {
      throw new InvalidRecipeReceiptEvidence("Recipe receipt fingerprint does not match the canonical persistence input.");
    }
  }

  private validateLines(lines: readonly RecipeLineRecord[], ownerId: string, ownerType: "draft" | "version"): void {
    const ids = new Set<string>();
    lines.forEach((line, index) => {
      if (line.ownerType !== ownerType || line.ownerId !== ownerId || line.position !== index) {
        throw new InvalidRecipePersistenceState("Recipe Lines must use the supplied owner and contiguous persisted order.");
      }
      if (ids.has(line.recipeLineId)) throw new RecipeLineIdentityPersistenceCollision(ownerId, line.recipeLineId);
      this.assertIdentity(line.recipeLineId, LINE_ID, "Recipe Line");
      ids.add(line.recipeLineId);
    });
  }

  private validatePublicationInput(input: RecipePublicationPersistenceInput): void {
    const version = input.publishedVersionSnapshot.version;
    if (
      version.recipeFamilyId !== input.recipeFamilyId || version.recipeId !== input.recipeId
      || version.sourceDraftId !== input.sourceDraftId
      || version.recipeVersionId !== input.resultingCurrentRecipeVersionId
      || input.resultingAggregateVersion !== input.expectedAggregateVersion + 1
      || input.publicationAudit.recipeId !== input.recipeId
      || input.publicationAudit.draftId !== input.sourceDraftId
      || input.publicationAudit.recipeVersionId !== version.recipeVersionId
      || input.publicationAudit.versionNumber !== version.versionNumber
      || input.publicationAudit.reason.trim().length === 0
      || ((input.expectedCurrentRecipeVersionId === null) !== (input.supersessionAudit === null))
    ) throw new InvalidRecipePersistenceState("Recipe publication identities, versions, audit, or supersession evidence are inconsistent.");
    if (input.supersessionAudit && (
      input.supersessionAudit.recipeId !== input.recipeId
      || input.supersessionAudit.supersededRecipeVersionId !== input.expectedCurrentRecipeVersionId
      || input.supersessionAudit.supersededByRecipeVersionId !== version.recipeVersionId
    )) throw new InvalidRecipePersistenceState("Recipe supersession evidence is inconsistent with publication.");
  }

  private assertPublishedLinesMatchDraft(input: RecipePublicationPersistenceInput): void {
    const persisted = this.database.queryMany<{
      recipe_line_id: string; position: number; ingredient_id: string;
      ingredient_canonical_name: string; ingredient_measurement_dimension: string;
      ingredient_status: string; ingredient_created_at: string;
      quantity_coefficient: string; quantity_scale: number;
      quantity_unit_code: string; quantity_dimension: string;
      preparation_note: string | null;
    }>("SELECT recipe_line_id, position, ingredient_id, ingredient_canonical_name, ingredient_measurement_dimension, ingredient_status, ingredient_created_at, quantity_coefficient, quantity_scale, quantity_unit_code, quantity_dimension, preparation_note FROM recipe_draft_lines WHERE draft_id = ? ORDER BY position", [input.sourceDraftId]);
    const lines = input.publishedVersionSnapshot.lines;
    if (persisted.length !== lines.length || persisted.some((row, index) => {
      const line = lines[index]!;
      return row.recipe_line_id !== line.recipeLineId || row.position !== line.position
        || row.ingredient_id !== line.ingredientReferenceId || row.ingredient_canonical_name !== line.ingredientCanonicalName
        || row.ingredient_measurement_dimension !== line.ingredientMeasurementDimension || row.ingredient_status !== line.ingredientStatus
        || row.ingredient_created_at !== line.ingredientCreatedAt || row.quantity_coefficient !== line.quantity.coefficient
        || row.quantity_scale !== line.quantity.scale || row.quantity_unit_code !== line.quantity.unitCode
        || row.quantity_dimension !== line.quantity.measurementDimension || row.preparation_note !== line.preparationNote;
    })) throw new InvalidRecipePersistenceState("Published Recipe Lines must exactly match the persisted source Draft snapshot.");
  }

  private arbitrateReceipt(receipt: ReceiptRequestEvidence): ReceiptRow | undefined {
    const existing = this.database.queryOne<ReceiptRow>(
      "SELECT * FROM recipe_command_receipts WHERE operation_type = ? AND scope_type = ? AND scope_id = ? AND idempotency_key = ?",
      [receipt.operationType, receipt.scopeType, receipt.scopeId, receipt.idempotencyKey]
    );
    if (existing && existing.request_fingerprint !== receipt.requestFingerprint) {
      throw new RecipeIdempotencyConflict(receipt.operationType, receipt.scopeId);
    }
    return existing;
  }

  private insertReceipt(receipt: ReceiptRequestEvidence, result: {
    familyId: string; recipeId: string; draftId: string; versionId: string | null;
    versionNumber: number | null; state: string | null; eventId: string;
    currentVersionId: string | null; aggregateVersion: number;
  }): void {
    this.database.execute(
      `INSERT INTO recipe_command_receipts (
        operation_type, scope_type, scope_id, idempotency_key,
        canonical_input_version, request_fingerprint_algorithm,
        request_fingerprint, result_recipe_family_id, result_recipe_id,
        result_draft_id, result_recipe_version_id, result_version_number,
        result_state, result_event_id, result_current_recipe_version_id,
        result_aggregate_version, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        receipt.operationType, receipt.scopeType, receipt.scopeId, receipt.idempotencyKey,
        receipt.canonicalInputVersion, receipt.requestFingerprintAlgorithm,
        receipt.requestFingerprint, result.familyId, result.recipeId, result.draftId,
        result.versionId, result.versionNumber, result.state, result.eventId,
        result.currentVersionId, result.aggregateVersion, receipt.receiptCreatedAt
      ]
    );
  }

  private insertDraftLine(line: RecipeLineRecord): void {
    this.database.execute(
      "INSERT INTO recipe_draft_lines (draft_id, recipe_line_id, position, ingredient_id, ingredient_canonical_name, ingredient_measurement_dimension, ingredient_status, ingredient_created_at, quantity_coefficient, quantity_scale, quantity_unit_code, quantity_dimension, preparation_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [line.ownerId, line.recipeLineId, line.position, line.ingredientReferenceId, line.ingredientCanonicalName, line.ingredientMeasurementDimension, line.ingredientStatus, line.ingredientCreatedAt, line.quantity.coefficient, line.quantity.scale, line.quantity.unitCode, line.quantity.measurementDimension, line.preparationNote]
    );
  }

  private insertVersionLine(line: RecipeLineRecord): void {
    this.database.execute(
      "INSERT INTO recipe_version_lines (recipe_version_id, recipe_line_id, position, ingredient_id, ingredient_canonical_name, ingredient_measurement_dimension, ingredient_status, ingredient_created_at, quantity_coefficient, quantity_scale, quantity_unit_code, quantity_dimension, preparation_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [line.ownerId, line.recipeLineId, line.position, line.ingredientReferenceId, line.ingredientCanonicalName, line.ingredientMeasurementDimension, line.ingredientStatus, line.ingredientCreatedAt, line.quantity.coefficient, line.quantity.scale, line.quantity.unitCode, line.quantity.measurementDimension, line.preparationNote]
    );
  }

  private requireRecipe(recipeId: string): RecipeRow {
    const recipe = this.database.queryOne<RecipeRow>("SELECT * FROM recipe_recipes WHERE recipe_id = ?", [recipeId]);
    if (!recipe) throw new InvalidRecipePersistenceState(`Recipe ${recipeId} does not exist.`);
    return recipe;
  }

  private assertOwner(recipe: RecipeRow, familyId: string): void {
    if (recipe.recipe_family_id !== familyId) throw new InvalidRecipePersistenceState("Recipe Family ownership does not match.");
  }

  private assertVersion(recipe: RecipeRow, expected: number): void {
    if (recipe.aggregate_version !== expected) throw new RecipeConcurrencyConflict(recipe.recipe_id, expected, recipe.aggregate_version);
  }

  private assertIdentity(value: string, pattern: RegExp, label: string): void {
    if (!pattern.test(value)) throw new InvalidRecipePersistenceState(`${label} identity ${value} is malformed.`);
  }

  private familyResult(row: ReceiptRow): FamilyCreationPersistenceResult {
    return Object.freeze({ recipeFamilyId: row.result_recipe_family_id, recipeId: row.result_recipe_id, initialDraftId: row.result_draft_id, resultingAggregateVersion: row.result_aggregate_version, creationAuditEventId: row.result_event_id, receiptCreatedAt: row.created_at });
  }
  private abandonmentResult(row: ReceiptRow): DraftAbandonmentPersistenceResult {
    return Object.freeze({ recipeFamilyId: row.result_recipe_family_id, recipeId: row.result_recipe_id, draftId: row.result_draft_id, state: "Abandoned", abandonmentEventId: row.result_event_id, resultingAggregateVersion: row.result_aggregate_version, currentRecipeVersionId: row.result_current_recipe_version_id, receiptCreatedAt: row.created_at });
  }
  private publicationResult(row: ReceiptRow): RecipePublicationPersistenceResult {
    if (row.result_recipe_version_id === null || row.result_version_number === null || row.result_current_recipe_version_id === null) throw new InvalidRecipePersistenceState("Committed publication receipt is incomplete.");
    const supersession = this.database.queryOne<{ event_key: string }>(
      "SELECT event_key FROM recipe_supersession_audits WHERE superseded_by_recipe_version_id = ?",
      [row.result_recipe_version_id]
    );
    return Object.freeze({ recipeFamilyId: row.result_recipe_family_id, recipeId: row.result_recipe_id, sourceDraftId: row.result_draft_id, recipeVersionId: row.result_recipe_version_id, versionNumber: row.result_version_number, currentRecipeVersionId: row.result_current_recipe_version_id, resultingAggregateVersion: row.result_aggregate_version, publicationAuditEventId: row.result_event_id, supersessionAuditEventId: supersession?.event_key ?? null, receiptCreatedAt: row.created_at });
  }
}
