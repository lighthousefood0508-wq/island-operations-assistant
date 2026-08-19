import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { CanonicalIngredient } from "../domains/recipe/ingredient-catalog/canonical-ingredient.js";
import { CanonicalIngredientId } from "../domains/recipe/ingredient-catalog/identities.js";
import { IngredientCategory } from "../domains/recipe/ingredient-catalog/ingredient-category.js";
import { SqliteCanonicalIngredientRepository } from "../domains/recipe/ingredient-catalog/infrastructure/sqlite-canonical-ingredient-repository.js";
import { MeasurementUnitResolver } from "../domains/recipe/measurement/measurement-unit-resolver.js";
import { IngredientMeasurementProfile } from "../domains/recipe/measurement-profile/ingredient-measurement-profile.js";
import { SqliteIngredientMeasurementProfileRepository } from "../domains/recipe/measurement-profile/infrastructure/sqlite-ingredient-measurement-profile-repository.js";
import {
  DuplicateIngredientMeasurementProfile,
  IngredientMeasurementProfileVersionConflict,
  InvalidIngredientMeasurementProfilePersistenceState
} from "../domains/recipe/measurement-profile/persistence/errors.js";
import type { DatabaseAdapter } from "../shared/database/database-adapter.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";

const IDS = {
  ingredient: "ing_11111111-1111-4111-8111-111111111111",
  profile: "measurement_profile_22222222-2222-4222-8222-222222222222",
  version1:
    "measurement_profile_version_33333333-3333-4333-8333-333333333333",
  version2:
    "measurement_profile_version_44444444-4444-4444-8444-444444444444"
} as const;
const T0 = "2026-07-31T01:00:00.000Z";
const T1 = "2026-08-01T01:00:00.000Z";

type Fixture = Readonly<{
  database: DatabaseAdapter;
  databasePath: string;
  repository: SqliteIngredientMeasurementProfileRepository;
}>;

function cleanup(databasePath: string): void {
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }
}

function fixture(t: TestContext): Fixture {
  const databasePath = path.resolve(
    "data",
    `ingredient-measurement-profile-persistence-${randomUUID()}.sqlite`
  );
  const database = createDatabase({
    host: "127.0.0.1",
    port: 0,
    databasePath
  });
  runMigrations(database);
  const ingredientRepository =
    new SqliteCanonicalIngredientRepository(database);
  ingredientRepository.saveNew(CanonicalIngredient.create({
    ingredientId: CanonicalIngredientId.parse(IDS.ingredient),
    name: "Pork belly",
    category: IngredientCategory.parse("meat"),
    createdAt: T0,
    createdBy: "owner"
  }));
  t.after(() => {
    database.close();
    cleanup(databasePath);
  });
  return {
    database,
    databasePath,
    repository: new SqliteIngredientMeasurementProfileRepository(
      database,
      new MeasurementUnitResolver()
    )
  };
}

function activeProfile(): IngredientMeasurementProfile {
  const resolver = new MeasurementUnitResolver();
  const draft = IngredientMeasurementProfile.createDraft({
    identity: {
      profileId: IDS.profile,
      profileVersionId: IDS.version1,
      ingredientId: IDS.ingredient
    },
    createdAt: T0,
    createdBy: "owner"
  });
  return draft.activateDraft(
    IDS.version1,
    {
      dimension: "mass",
      canonicalUnitCode: "g",
      allowedUnitCodes: ["g", "kg", "tw_catty"],
      profileAliases: [],
      source: {
        sourceType: "MANUAL",
        referenceId: "owner-setup",
        recordedAt: T0,
        recordedBy: "owner"
      }
    },
    { occurredAt: T0, actorId: "owner" },
    resolver
  );
}

test("migration creates empty Profile tables and effective lookup indexes", (t) => {
  const { database } = fixture(t);
  const tables = database.queryMany<{ name: string }>(
    `SELECT name
       FROM sqlite_master
      WHERE type = 'table'
        AND name LIKE 'recipe_ingredient_measurement_profile%'
      ORDER BY name`
  ).map((row) => row.name);
  assert.deepEqual(tables, [
    "recipe_ingredient_measurement_profile_versions",
    "recipe_ingredient_measurement_profiles"
  ]);
  const count = database.queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM recipe_ingredient_measurement_profiles"
  );
  assert.equal(count?.count, 0);
  const indexes = database.queryMany<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'index'"
  ).map((row) => row.name);
  assert.ok(indexes.includes("recipe_measurement_profiles_one_active"));
  assert.ok(indexes.includes("recipe_measurement_profiles_effective_lookup"));
});

test("Active Profile round-trips and supplies all approved read capabilities", (t) => {
  const { repository } = fixture(t);
  repository.saveNew(activeProfile());

  const stored = repository.findAggregateByProfileId(IDS.profile);
  assert.ok(stored);
  assert.equal(stored.aggregateVersion, 0);
  assert.deepEqual(stored.profile.toContract(), activeProfile().toContract());
  assert.equal(repository.listProfiles().length, 1);
  assert.equal(repository.findHistoryByProfileId(IDS.profile).length, 1);
  assert.equal(repository.findProfileVersion(IDS.version1)?.state, "Active");
  assert.equal(
    repository.findActiveProfilesAt(IDS.ingredient, T0)[0]?.identity
      .profileVersionId,
    IDS.version1
  );
});

test("duplicate Profile identity fails without replacing the original", (t) => {
  const { repository } = fixture(t);
  repository.saveNew(activeProfile());
  assert.throws(
    () => repository.saveNew(activeProfile()),
    DuplicateIngredientMeasurementProfile
  );
  assert.equal(repository.listProfiles().length, 1);
});

test("supersession persists one append-first transition and historical lookup", (t) => {
  const { repository } = fixture(t);
  repository.saveNew(activeProfile());
  const superseded = activeProfile().supersedeActive({
    activeProfileVersionId: IDS.version1,
    supersedingIdentity: {
      profileId: IDS.profile,
      profileVersionId: IDS.version2,
      ingredientId: IDS.ingredient
    },
    supersedingDefinition: {
      dimension: "mass",
      canonicalUnitCode: "g",
      allowedUnitCodes: ["g", "kg"],
      profileAliases: [],
      source: {
        sourceType: "MANUAL",
        referenceId: "owner-revision",
        recordedAt: T1,
        recordedBy: "owner"
      }
    },
    transition: {
      occurredAt: T1,
      actorId: "owner",
      reason: "Remove customary-unit entry."
    },
    unitResolver: new MeasurementUnitResolver()
  });

  assert.equal(repository.saveWithExpectedVersion(superseded, 0), 1);
  assert.equal(repository.findProfileVersion(IDS.version1)?.state, "Superseded");
  assert.equal(repository.findProfileVersion(IDS.version2)?.state, "Active");
  assert.equal(
    repository.findActiveProfilesAt(
      IDS.ingredient,
      "2026-07-31T12:00:00.000Z"
    )[0]?.identity.profileVersionId,
    IDS.version1
  );
  assert.equal(
    repository.findActiveProfilesAt(IDS.ingredient, T1)[0]?.identity
      .profileVersionId,
    IDS.version2
  );
});

test("stale expected version fails without changing Profile history", (t) => {
  const { repository } = fixture(t);
  repository.saveNew(activeProfile());
  const deprecated = activeProfile().deprecateActive(
    IDS.version1,
    { occurredAt: T1, actorId: "owner", reason: "No longer formal." }
  );
  repository.saveWithExpectedVersion(deprecated, 0);

  assert.throws(
    () => repository.saveWithExpectedVersion(deprecated, 0),
    IngredientMeasurementProfileVersionConflict
  );
  assert.equal(repository.findHistoryByProfileId(IDS.profile).length, 1);
});

test("malformed persisted lifecycle fails closed during hydration", (t) => {
  const { database, repository } = fixture(t);
  repository.saveNew(activeProfile());
  database.execute(
    `UPDATE recipe_ingredient_measurement_profile_versions
        SET lifecycle_json = '[]'
      WHERE profile_version_id = ?`,
    [IDS.version1]
  );
  assert.throws(
    () => repository.findAggregateByProfileId(IDS.profile),
    InvalidIngredientMeasurementProfilePersistenceState
  );
});

test("foreign-key and one-active constraints reject contradictory authority", (t) => {
  const { database, repository } = fixture(t);
  repository.saveNew(activeProfile());
  assert.throws(() => database.execute(
    `INSERT INTO recipe_ingredient_measurement_profiles (
      profile_id, ingredient_id, aggregate_version, created_at, created_by
    ) VALUES (?, ?, 0, ?, 'owner')`,
    [
      "measurement_profile_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      IDS.ingredient,
      T0
    ]
  ));
  assert.equal(repository.listProfiles().length, 1);
});

test("003J persistence round-trips Active to Deprecated to Draft to Active without rewriting history", (t) => {
  const { repository } = fixture(t);
  const resolver = new MeasurementUnitResolver();
  repository.saveNew(activeProfile());
  const deprecated = activeProfile().deprecateActive(IDS.version1, { occurredAt: T1, actorId: "owner" });
  assert.equal(repository.saveWithExpectedVersion(deprecated, 0), 1);
  const appended = deprecated.appendDraftAfterDeprecation({
    draftIdentity: { profileId: IDS.profile, profileVersionId: IDS.version2, ingredientId: IDS.ingredient },
    transition: { occurredAt: T1, actorId: "owner" },
    definition: {
      dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g", "kg"], profileAliases: [], source: { sourceType: "MANUAL", recordedAt: T1, recordedBy: "owner" }
    }
  });
  assert.equal(repository.saveWithExpectedVersion(appended, 1), 2);
  const roundTrippedDraft = repository.findAggregateByProfileId(IDS.profile)?.profile.findVersion(IDS.version2);
  assert.equal(roundTrippedDraft?.state, "Draft");
  assert.deepEqual(roundTrippedDraft?.lifecycle.map((fact) => fact.transition), ["CREATED"]);
  const revised = appended.reviseDraft(IDS.version2, {
    dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g", "kg"], profileAliases: [], source: { sourceType: "MANUAL", recordedAt: T1, recordedBy: "owner" }
  }, { occurredAt: "2026-08-02T00:00:00.000Z", actorId: "owner" });
  assert.equal(repository.saveWithExpectedVersion(revised, 2), 3);
  const roundTrippedRevised = repository.findAggregateByProfileId(IDS.profile)?.profile.findVersion(IDS.version2);
  assert.deepEqual(roundTrippedRevised?.lifecycle.map((fact) => fact.transition), ["CREATED", "DRAFT_REVISED"]);
  const reestablished = revised.activateDraft(IDS.version2, {
    dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g", "kg"], profileAliases: [], source: { sourceType: "MANUAL", recordedAt: T1, recordedBy: "owner" }
  }, { occurredAt: "2026-08-02T01:00:00.000Z", actorId: "owner" }, resolver);
  assert.equal(repository.saveWithExpectedVersion(reestablished, 3), 4);
  assert.equal(repository.findProfileVersion(IDS.version1)?.state, "Deprecated");
  assert.equal(repository.findProfileVersion(IDS.version2)?.state, "Active");
});
