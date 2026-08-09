import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  RECIPE_RECEIPT_FINGERPRINT_ALGORITHM,
  RECIPE_RECEIPT_INPUT_VERSION,
  RecipeIdempotencyConflict,
  RecipeId,
  SqliteRecipePersistenceUnitOfWork,
  expectedRecipeReceiptFingerprint,
  type FamilyCreationPersistenceInput,
  type RecipeLineRecord,
  type RecipePublicationPersistenceInput,
  type DraftAbandonmentPersistenceInput
} from "../domains/recipe/index.js";
import { BetterSqlite3Adapter } from "../shared/database/better-sqlite3-adapter.js";
import { SqliteRecipeRepository } from "../domains/recipe/infrastructure/sqlite-recipe-repository.js";
import type { DatabaseAdapter, ExecuteResult, SqlParameters } from "../shared/database/database-adapter.js";
import { runMigrations } from "../shared/database/migrate.js";

const now = "2026-08-08T08:00:00.000Z";
const ingredientId = "ing_90000000-0000-4000-8000-000000000001";

class FailingWriteAdapter implements DatabaseAdapter {
  private writes = 0;
  constructor(private readonly delegate: DatabaseAdapter, private readonly failAt: number) {}
  get transactionSafety() { return this.delegate.transactionSafety; }
  execute(sql: string, parameters?: SqlParameters): ExecuteResult {
    this.writes += 1;
    if (this.writes === this.failAt) throw new Error(`injected write failure ${this.failAt}`);
    return this.delegate.execute(sql, parameters);
  }
  queryOne<T>(sql: string, parameters?: SqlParameters): T | undefined { return this.delegate.queryOne<T>(sql, parameters); }
  queryMany<T>(sql: string, parameters?: SqlParameters): T[] { return this.delegate.queryMany<T>(sql, parameters); }
  transaction<T>(work: () => T): T { return this.delegate.transaction(work); }
  transactionImmediate<T>(work: () => T): T { return this.delegate.transactionImmediate(work); }
  close(): void { /* The fixture owns the connection. */ }
}

function receipt(operationType: "FAMILY_CREATE" | "DRAFT_ABANDON" | "RECIPE_PUBLISH", scopeType: "PRODUCT" | "RECIPE_DRAFT" | "RECIPE_FAMILY", scopeId: string, key: string) {
  return {
    operationType, scopeType, scopeId, idempotencyKey: key,
    canonicalInputVersion: RECIPE_RECEIPT_INPUT_VERSION,
    requestFingerprintAlgorithm: RECIPE_RECEIPT_FINGERPRINT_ALGORITHM,
    requestFingerprint: "0".repeat(64), receiptCreatedAt: now
  } as const;
}

function line(ownerId: string, ownerType: "draft" | "version", suffix: string, position = 0): RecipeLineRecord {
  return Object.freeze({
    ownerType, ownerId, position,
    recipeLineId: `recipe_line_70000000-0000-4000-8000-0000000000${suffix}`,
    ingredientReferenceId: ingredientId,
    ingredientCanonicalName: "Pork",
    ingredientMeasurementDimension: "mass",
    ingredientStatus: "active",
    ingredientCreatedAt: now,
    quantity: Object.freeze({ coefficient: "100", scale: 0, unitCode: "g", measurementDimension: "mass" }),
    preparationNote: "Trim"
  });
}

function familyInput(suffix: string, productId = `product_${suffix}`): FamilyCreationPersistenceInput {
  const draftId = `recipe_draft_20000000-0000-4000-8000-0000000000${suffix}`;
  const provisional: FamilyCreationPersistenceInput = {
    receipt: receipt("FAMILY_CREATE", "PRODUCT", productId, `create-${suffix}`),
    productId, productVersionId: `product_version_${suffix}`,
    recipeFamilyId: `recipe_family_30000000-0000-4000-8000-0000000000${suffix}`,
    recipeId: `recipe_10000000-0000-4000-8000-0000000000${suffix}`,
    initialDraftId: draftId, initialDraftName: `Recipe ${suffix}`,
    instructions: "Cook slowly", initialLines: [line(draftId, "draft", suffix)],
    initialAggregateVersion: 1,
    creationAudit: { eventId: `create_event_${suffix}`, actor: "owner", occurredAt: now }
  };
  return Object.freeze({ ...provisional, receipt: Object.freeze({ ...provisional.receipt, requestFingerprint: expectedRecipeReceiptFingerprint(provisional) }) });
}

function abandonmentInput(family: FamilyCreationPersistenceInput): DraftAbandonmentPersistenceInput {
  const provisional: DraftAbandonmentPersistenceInput = {
    receipt: receipt("DRAFT_ABANDON", "RECIPE_DRAFT", family.initialDraftId, "abandon-1"),
    recipeFamilyId: family.recipeFamilyId, recipeId: family.recipeId,
    draftId: family.initialDraftId, expectedCurrentDraftId: family.initialDraftId,
    expectedAggregateVersion: 1,
    abandonment: { eventId: "abandon_event_1", actor: "owner", occurredAt: now, reason: "Duplicate draft", previousAggregateVersion: 1, resultingAggregateVersion: 2 }
  };
  return Object.freeze({ ...provisional, receipt: Object.freeze({ ...provisional.receipt, requestFingerprint: expectedRecipeReceiptFingerprint(provisional) }) });
}

function publicationInput(family: FamilyCreationPersistenceInput): RecipePublicationPersistenceInput {
  const versionId = "recipe_version_50000000-0000-4000-8000-000000000001";
  const provisional: RecipePublicationPersistenceInput = {
    receipt: receipt("RECIPE_PUBLISH", "RECIPE_FAMILY", family.recipeFamilyId, "publish-1"),
    recipeFamilyId: family.recipeFamilyId, recipeId: family.recipeId,
    sourceDraftId: family.initialDraftId, expectedAggregateVersion: 1,
    expectedCurrentRecipeVersionId: null,
    publishedVersionSnapshot: {
      version: {
        recipeVersionId: versionId, recipeId: family.recipeId,
        recipeFamilyId: family.recipeFamilyId, sourceDraftId: family.initialDraftId,
        versionNumber: 1, state: "Published", name: family.initialDraftName,
        productId: family.productId, productVersionId: family.productVersionId,
        instructions: family.instructions,
        standardOutput: { coefficient: "100", scale: 0, unitCode: "g", measurementDimension: "mass" },
        standardYield: { coefficient: "1", scale: 0, unitCode: "each", measurementDimension: "count" },
        publishedBy: "owner", publishedAt: now
      },
      lines: [line(versionId, "version", "01")]
    },
    publicationAudit: { eventKey: "publish_event_1", recipeId: family.recipeId, draftId: family.initialDraftId, recipeVersionId: versionId, versionNumber: 1, actor: "owner", occurredAt: now, reason: "Initial publication" },
    supersessionAudit: null, resultingCurrentRecipeVersionId: versionId,
    resultingAggregateVersion: 2
  };
  const draftLineId = family.initialLines[0]!.recipeLineId;
  const corrected = { ...provisional, publishedVersionSnapshot: { ...provisional.publishedVersionSnapshot, lines: [{ ...provisional.publishedVersionSnapshot.lines[0]!, recipeLineId: draftLineId }] } };
  return Object.freeze({ ...corrected, receipt: Object.freeze({ ...corrected.receipt, requestFingerprint: expectedRecipeReceiptFingerprint(corrected) }) });
}

function fixture(run: (database: BetterSqlite3Adapter, uow: SqliteRecipePersistenceUnitOfWork, databasePath: string) => void): void {
  const directory = mkdtempSync(path.join(tmpdir(), "recipe-uow-"));
  const databasePath = path.join(directory, "test.sqlite");
  const database = new BetterSqlite3Adapter(databasePath);
  try {
    runMigrations(database);
    database.execute("INSERT INTO recipe_canonical_ingredients (ingredient_id, name, category_code, status, aggregate_version, created_at, created_by) VALUES (?, 'Pork', 'meat', 'Active', 0, ?, 'owner')", [ingredientId, now]);
    run(database, new SqliteRecipePersistenceUnitOfWork(database), databasePath);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

test("Family creation commits Family, Draft, stable Lines, audit and durable replay receipt atomically", () => fixture((database, uow) => {
  const input = familyInput("01");
  const first = uow.createFamilyWithInitialDraft(input);
  const replay = uow.createFamilyWithInitialDraft(input);
  assert.deepEqual(replay, first);
  assert.equal(database.queryOne<{ count: number }>("SELECT count(*) AS count FROM recipe_recipes")?.count, 1);
  assert.equal(database.queryOne<{ recipe_line_id: string }>("SELECT recipe_line_id FROM recipe_draft_lines")?.recipe_line_id, input.initialLines[0]!.recipeLineId);
  assert.equal(database.queryOne<{ count: number }>("SELECT count(*) AS count FROM recipe_creation_audits")?.count, 1);
  assert.equal(database.queryOne<{ count: number }>("SELECT count(*) AS count FROM recipe_command_receipts")?.count, 1);

  const changed: FamilyCreationPersistenceInput = { ...input, creationAudit: { ...input.creationAudit, actor: "other" } };
  const conflicting = { ...changed, receipt: { ...changed.receipt, requestFingerprint: expectedRecipeReceiptFingerprint(changed) } };
  assert.throws(() => uow.createFamilyWithInitialDraft(conflicting), RecipeIdempotencyConflict);
}));

test("Publication commits immutable Version, matching Lines, audit, pointer and receipt then survives restart", () => fixture((database, uow, databasePath) => {
  const family = familyInput("01");
  uow.createFamilyWithInitialDraft(family);
  const input = publicationInput(family);
  const result = uow.publishRecipeVersion(input);
  assert.equal(result.currentRecipeVersionId, input.resultingCurrentRecipeVersionId);
  assert.equal(database.queryOne<{ state: string }>("SELECT state FROM recipe_recipes WHERE recipe_id = ?", [family.recipeId])?.state, "Published");
  assert.equal(database.queryOne<{ instructions: string }>("SELECT instructions FROM recipe_versions")?.instructions, "Cook slowly");
  assert.equal(database.queryOne<{ recipe_line_id: string }>("SELECT recipe_line_id FROM recipe_version_lines")?.recipe_line_id, family.initialLines[0]!.recipeLineId);
  assert.deepEqual(uow.publishRecipeVersion(input), result);

  const reopened = new BetterSqlite3Adapter(databasePath);
  try {
    assert.deepEqual(new SqliteRecipePersistenceUnitOfWork(reopened).publishRecipeVersion(input), result);
  } finally { reopened.close(); }
}));

test("Draft abandonment commits terminal state, audit and receipt atomically and replays", () => fixture((database, uow) => {
  const family = familyInput("02");
  uow.createFamilyWithInitialDraft(family);
  const input = abandonmentInput(family);
  const result = uow.abandonDraft(input);
  assert.equal(result.state, "Abandoned");
  assert.deepEqual(uow.abandonDraft(input), result);
  assert.equal(database.queryOne<{ state: string }>("SELECT state FROM recipe_drafts WHERE draft_id = ?", [family.initialDraftId])?.state, "Abandoned");
  assert.equal(database.queryOne<{ count: number }>("SELECT count(*) AS count FROM recipe_abandonment_audits")?.count, 1);
  const restored = new SqliteRecipeRepository(database).findWithVersion(RecipeId.parse(family.recipeId));
  assert.equal(restored?.aggregate.snapshot().state, "Abandoned");
  assert.equal(restored?.aggregate.snapshot().abandonment?.reason, input.abandonment.reason);
}));

test("Abandoned later Draft rehydrates after restart without losing the current Published Version pointer", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "recipe-uow-pointer-"));
  const databasePath = path.join(directory, "test.sqlite");
  let database: BetterSqlite3Adapter | undefined = new BetterSqlite3Adapter(databasePath);
  try {
    runMigrations(database);
    database.execute("INSERT INTO recipe_canonical_ingredients (ingredient_id, name, category_code, status, aggregate_version, created_at, created_by) VALUES (?, 'Pork', 'meat', 'Active', 0, ?, 'owner')", [ingredientId, now]);
    const uow = new SqliteRecipePersistenceUnitOfWork(database);
    const family = familyInput("10");
    uow.createFamilyWithInitialDraft(family);
    const publication = publicationInput(family);
    const published = uow.publishRecipeVersion(publication);

    const laterDraftId = "recipe_draft_20000000-0000-4000-8000-000000000099";
    const laterLine = line(laterDraftId, "draft", "99");
    database.transactionImmediate(() => {
      database!.execute(
        `INSERT INTO recipe_drafts (
          draft_id, recipe_id, recipe_family_id, name, state, product_id,
          product_version_id, instructions, standard_output_coefficient,
          standard_output_scale, standard_output_unit_code, standard_output_dimension,
          standard_yield_coefficient, standard_yield_scale, standard_yield_unit_code,
          standard_yield_dimension, created_by, created_at
        ) VALUES (?, ?, ?, 'Recipe 10 revision', 'Draft', ?, ?, 'Revised', '100', 0, 'g', 'mass', '1', 0, 'each', 'count', 'owner', ?)`,
        [laterDraftId, family.recipeId, family.recipeFamilyId, family.productId, family.productVersionId, now]
      );
      database!.execute(
        "INSERT INTO recipe_draft_lines (draft_id, recipe_line_id, position, ingredient_id, ingredient_canonical_name, ingredient_measurement_dimension, ingredient_status, ingredient_created_at, quantity_coefficient, quantity_scale, quantity_unit_code, quantity_dimension, preparation_note) VALUES (?, ?, 0, ?, 'Pork', 'mass', 'active', ?, '100', 0, 'g', 'mass', 'Trim')",
        [laterDraftId, laterLine.recipeLineId, ingredientId, now]
      );
      database!.execute(
        "UPDATE recipe_recipes SET current_draft_id = ?, aggregate_version = 3, state = 'Draft' WHERE recipe_id = ?",
        [laterDraftId, family.recipeId]
      );
    });

    const provisionalAbandonment: DraftAbandonmentPersistenceInput = {
      receipt: receipt("DRAFT_ABANDON", "RECIPE_DRAFT", laterDraftId, "abandon-after-publish"),
      recipeFamilyId: family.recipeFamilyId,
      recipeId: family.recipeId,
      draftId: laterDraftId,
      expectedCurrentDraftId: laterDraftId,
      expectedAggregateVersion: 3,
      abandonment: {
        eventId: "abandon_event_after_publish",
        actor: "owner",
        occurredAt: now,
        reason: "Revision no longer applies",
        previousAggregateVersion: 3,
        resultingAggregateVersion: 4
      }
    };
    const abandonment = {
      ...provisionalAbandonment,
      receipt: {
        ...provisionalAbandonment.receipt,
        requestFingerprint: expectedRecipeReceiptFingerprint(provisionalAbandonment)
      }
    };
    const abandoned = uow.abandonDraft(abandonment);
    assert.equal(abandoned.currentRecipeVersionId, published.currentRecipeVersionId);

    database.close();
    database = undefined;
    const reopened = new BetterSqlite3Adapter(databasePath);
    try {
      const repository = new SqliteRecipeRepository(reopened);
      const restored = repository.findWithVersion(RecipeId.parse(family.recipeId));
      const restoredSnapshot = restored?.aggregate.snapshot();
      assert.equal(restoredSnapshot?.state, "Abandoned");
      assert.equal(restoredSnapshot?.abandonment?.recipeFamilyId.value, family.recipeFamilyId);
      assert.equal(restoredSnapshot?.abandonment?.recipeId.value, family.recipeId);
      assert.equal(restoredSnapshot?.abandonment?.draftId.value, laterDraftId);
      assert.equal(restoredSnapshot?.abandonment?.resultingState, "Abandoned");
      assert.equal(restoredSnapshot?.abandonment?.actor, "owner");
      assert.equal(restoredSnapshot?.abandonment?.occurredAt, now);
      assert.equal(restoredSnapshot?.abandonment?.reason, "Revision no longer applies");
      assert.equal(restoredSnapshot?.abandonment?.previousAggregateVersion, 3);
      assert.equal(restoredSnapshot?.abandonment?.resultingAggregateVersion, 4);
      assert.equal(
        repository.listRecipes()[0]?.currentRecipeVersionId,
        published.currentRecipeVersionId
      );
      assert.equal(
        reopened.queryOne<{ state: string }>(
          "SELECT state FROM recipe_versions WHERE recipe_version_id = ?",
          [published.currentRecipeVersionId]
        )?.state,
        "Published"
      );
    } finally {
      reopened.close();
    }
  } finally {
    database?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("replacement publication supersedes the prior Version and moves the pointer exactly once", () => fixture((database, uow) => {
  const family = familyInput("01");
  uow.createFamilyWithInitialDraft(family);
  const first = publicationInput(family);
  uow.publishRecipeVersion(first);

  const secondDraftId = "recipe_draft_20000000-0000-4000-8000-000000000099";
  const secondLine = line(secondDraftId, "draft", "99");
  database.transactionImmediate(() => {
    database.execute(
      `INSERT INTO recipe_drafts (
        draft_id, recipe_id, recipe_family_id, name, state, product_id,
        product_version_id, instructions, standard_output_coefficient,
        standard_output_scale, standard_output_unit_code, standard_output_dimension,
        standard_yield_coefficient, standard_yield_scale, standard_yield_unit_code,
        standard_yield_dimension, created_by, created_at
      ) VALUES (?, ?, ?, 'Recipe 2', 'Draft', ?, ?, 'Revised', '120', 0, 'g', 'mass', '1', 0, 'each', 'count', 'owner', ?)`,
      [secondDraftId, family.recipeId, family.recipeFamilyId, family.productId, family.productVersionId, now]
    );
    database.execute(
      "INSERT INTO recipe_draft_lines (draft_id, recipe_line_id, position, ingredient_id, ingredient_canonical_name, ingredient_measurement_dimension, ingredient_status, ingredient_created_at, quantity_coefficient, quantity_scale, quantity_unit_code, quantity_dimension, preparation_note) VALUES (?, ?, 0, ?, 'Pork', 'mass', 'active', ?, '100', 0, 'g', 'mass', 'Trim')",
      [secondDraftId, secondLine.recipeLineId, ingredientId, now]
    );
    database.execute("UPDATE recipe_recipes SET current_draft_id = ?, state = 'Draft' WHERE recipe_id = ?", [secondDraftId, family.recipeId]);
  });

  const versionId = "recipe_version_50000000-0000-4000-8000-000000000002";
  const provisional: RecipePublicationPersistenceInput = {
    ...first,
    receipt: receipt("RECIPE_PUBLISH", "RECIPE_FAMILY", family.recipeFamilyId, "publish-2"),
    sourceDraftId: secondDraftId,
    expectedAggregateVersion: 2,
    expectedCurrentRecipeVersionId: first.resultingCurrentRecipeVersionId,
    publishedVersionSnapshot: {
      version: {
        ...first.publishedVersionSnapshot.version,
        recipeVersionId: versionId,
        sourceDraftId: secondDraftId,
        versionNumber: 2,
        name: "Recipe 2",
        instructions: "Revised"
      },
      lines: [{ ...secondLine, ownerType: "version", ownerId: versionId }]
    },
    publicationAudit: {
      ...first.publicationAudit,
      eventKey: "publish_event_2",
      draftId: secondDraftId,
      recipeVersionId: versionId,
      versionNumber: 2,
      reason: "Recipe revision"
    },
    supersessionAudit: {
      eventKey: "supersede_event_1",
      recipeId: family.recipeId,
      supersededRecipeVersionId: first.resultingCurrentRecipeVersionId,
      supersededByRecipeVersionId: versionId,
      actor: "owner",
      occurredAt: now,
      reason: "Recipe revision"
    },
    resultingCurrentRecipeVersionId: versionId,
    resultingAggregateVersion: 3
  };
  const input = { ...provisional, receipt: { ...provisional.receipt, requestFingerprint: expectedRecipeReceiptFingerprint(provisional) } };
  const result = uow.publishRecipeVersion(input);
  assert.equal(result.supersessionAuditEventId, "supersede_event_1");
  assert.equal(database.queryOne<{ state: string }>("SELECT state FROM recipe_versions WHERE recipe_version_id = ?", [first.resultingCurrentRecipeVersionId])?.state, "Superseded");
  assert.equal(database.queryOne<{ current_recipe_version_id: string }>("SELECT current_recipe_version_id FROM recipe_recipes WHERE recipe_id = ?", [family.recipeId])?.current_recipe_version_id, versionId);
  assert.deepEqual(uow.publishRecipeVersion(input), result);
}));

test("Family creation failure rolls back Family, Draft, Lines, audit and receipt", () => fixture((database, uow) => {
  const input = familyInput("03");
  const broken: FamilyCreationPersistenceInput = {
    ...input,
    initialLines: [{ ...input.initialLines[0]!, ingredientReferenceId: "ing_ffffffff-ffff-4fff-8fff-ffffffffffff" }]
  };
  const withFingerprint = { ...broken, receipt: { ...broken.receipt, requestFingerprint: expectedRecipeReceiptFingerprint(broken) } };
  assert.throws(() => uow.createFamilyWithInitialDraft(withFingerprint));
  assert.equal(database.queryOne<{ count: number }>("SELECT count(*) AS count FROM recipe_recipes")?.count, 0);
  assert.equal(database.queryOne<{ count: number }>("SELECT count(*) AS count FROM recipe_command_receipts")?.count, 0);
}));

test("failure injection at every Family-create write stage leaves no partial state", () => {
  for (let stage = 1; stage <= 5; stage += 1) fixture((database) => {
    const uow = new SqliteRecipePersistenceUnitOfWork(new FailingWriteAdapter(database, stage));
    assert.throws(() => uow.createFamilyWithInitialDraft(familyInput("04")), new RegExp(`injected write failure ${stage}`));
    for (const table of ["recipe_recipes", "recipe_drafts", "recipe_draft_lines", "recipe_creation_audits", "recipe_command_receipts"]) {
      assert.equal(database.queryOne<{ count: number }>(`SELECT count(*) AS count FROM ${table}`)?.count, 0, `${table} survived stage ${stage}`);
    }
  });
});

test("failure injection at every Abandon write stage preserves the editable Draft", () => {
  for (let stage = 1; stage <= 4; stage += 1) fixture((database, setup) => {
    const family = familyInput("05");
    setup.createFamilyWithInitialDraft(family);
    const uow = new SqliteRecipePersistenceUnitOfWork(new FailingWriteAdapter(database, stage));
    assert.throws(() => uow.abandonDraft(abandonmentInput(family)), new RegExp(`injected write failure ${stage}`));
    assert.equal(database.queryOne<{ state: string }>("SELECT state FROM recipe_drafts WHERE draft_id = ?", [family.initialDraftId])?.state, "Draft");
    assert.equal(database.queryOne<{ aggregate_version: number }>("SELECT aggregate_version FROM recipe_recipes WHERE recipe_id = ?", [family.recipeId])?.aggregate_version, 1);
    assert.equal(database.queryOne<{ count: number }>("SELECT count(*) AS count FROM recipe_abandonment_audits")?.count, 0);
    assert.equal(database.queryOne<{ count: number }>("SELECT count(*) AS count FROM recipe_command_receipts WHERE operation_type = 'DRAFT_ABANDON'")?.count, 0);
  });
});

test("failure injection at every initial Publish write stage leaves no partial publication", () => {
  for (let stage = 1; stage <= 6; stage += 1) fixture((database, setup) => {
    const family = familyInput("06");
    setup.createFamilyWithInitialDraft(family);
    const input = publicationInput(family);
    const uow = new SqliteRecipePersistenceUnitOfWork(new FailingWriteAdapter(database, stage));
    assert.throws(() => uow.publishRecipeVersion(input), new RegExp(`injected write failure ${stage}`));
    assert.equal(database.queryOne<{ state: string }>("SELECT state FROM recipe_drafts WHERE draft_id = ?", [family.initialDraftId])?.state, "Draft");
    assert.equal(database.queryOne<{ current_recipe_version_id: string | null }>("SELECT current_recipe_version_id FROM recipe_recipes WHERE recipe_id = ?", [family.recipeId])?.current_recipe_version_id, null);
    for (const table of ["recipe_versions", "recipe_version_lines", "recipe_publish_audits"]) {
      assert.equal(database.queryOne<{ count: number }>(`SELECT count(*) AS count FROM ${table}`)?.count, 0, `${table} survived stage ${stage}`);
    }
    assert.equal(database.queryOne<{ count: number }>("SELECT count(*) AS count FROM recipe_command_receipts WHERE operation_type = 'RECIPE_PUBLISH'")?.count, 0);
  });
});

test("independent SQLite connections serialize Product uniqueness and release locks cleanly", () => fixture((database, firstUow, databasePath) => {
  const second = new BetterSqlite3Adapter(databasePath);
  try {
    runMigrations(second);
    const secondUow = new SqliteRecipePersistenceUnitOfWork(second);
    const winner = familyInput("07", "product_shared");
    database.transactionImmediate(() => {
      assert.throws(
        () => secondUow.createFamilyWithInitialDraft(winner),
        /database is locked/
      );
    });

    firstUow.createFamilyWithInitialDraft(winner);
    const competing = familyInput("08", "product_shared");
    assert.throws(() => secondUow.createFamilyWithInitialDraft(competing));
    assert.equal(database.queryOne<{ count: number }>("SELECT count(*) AS count FROM recipe_recipes WHERE product_id = 'product_shared'")?.count, 1);
  } finally {
    second.close();
  }
}));

test("independent connections allow only one Publish or Abandon transition for one aggregate version", () => fixture((database, firstUow, databasePath) => {
  const family = familyInput("09");
  firstUow.createFamilyWithInitialDraft(family);
  const second = new BetterSqlite3Adapter(databasePath);
  try {
    runMigrations(second);
    const secondUow = new SqliteRecipePersistenceUnitOfWork(second);
    firstUow.abandonDraft(abandonmentInput(family));
    assert.throws(() => secondUow.publishRecipeVersion(publicationInput(family)));
    assert.equal(database.queryOne<{ count: number }>("SELECT count(*) AS count FROM recipe_versions")?.count, 0);
    assert.equal(database.queryOne<{ count: number }>("SELECT count(*) AS count FROM recipe_abandonment_audits")?.count, 1);
  } finally {
    second.close();
  }
}));
