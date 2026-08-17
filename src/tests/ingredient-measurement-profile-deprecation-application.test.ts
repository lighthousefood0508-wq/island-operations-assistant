import assert from "node:assert/strict";
import test from "node:test";
import {
  IngredientMeasurementProfileDeprecationExpectedVersionConflict,
  IngredientMeasurementProfileDeprecationIngredientInactive,
  IngredientMeasurementProfileDeprecationNotFound,
  IngredientMeasurementProfileDeprecationPersistenceFailure,
  IngredientMeasurementProfileDeprecationService,
  IngredientMeasurementProfileDeprecationValidationFailure
} from "../domains/recipe/index.js";
import { IngredientMeasurementProfile } from "../domains/recipe/measurement-profile/ingredient-measurement-profile.js";
import { IngredientMeasurementProfileVersionConflict } from "../domains/recipe/measurement-profile/persistence/errors.js";
import { MeasurementUnitResolver } from "../domains/recipe/measurement/measurement-unit-resolver.js";

const IDS = Object.freeze({
  ingredient: "ing_123e4567-e89b-42d3-a456-426614174000",
  profile: "measurement_profile_123e4567-e89b-42d3-a456-426614174001",
  version: "measurement_profile_version_123e4567-e89b-42d3-a456-426614174002"
});
const T0 = "2026-08-17T01:00:00.000Z";
const T1 = "2026-08-18T01:00:00.000Z";

function activeProfile(): IngredientMeasurementProfile {
  return IngredientMeasurementProfile.createDraft({
    identity: { profileId: IDS.profile, profileVersionId: IDS.version, ingredientId: IDS.ingredient },
    createdAt: T0,
    createdBy: "owner"
  }).activateDraft(IDS.version, {
    dimension: "mass",
    canonicalUnitCode: "g",
    allowedUnitCodes: ["g", "kg"],
    profileAliases: [],
    source: { sourceType: "MANUAL", recordedAt: T0, recordedBy: "owner" }
  }, { occurredAt: T0, actorId: "owner" }, new MeasurementUnitResolver());
}

class IngredientFixture {
  state: "Active" | "Archived" | undefined = "Active";
  failure: unknown = undefined;

  findById() {
    if (this.failure !== undefined) throw this.failure;
    return this.state === undefined ? undefined : Object.freeze({ status: this.state });
  }
}

class ProfileFixture {
  profile: IngredientMeasurementProfile | undefined = activeProfile();
  aggregateVersion = 0;
  lookupFailure: unknown = undefined;
  failure: unknown = undefined;
  writes = 0;

  findAggregateByProfileId() {
    if (this.lookupFailure !== undefined) throw this.lookupFailure;
    return this.profile === undefined ? undefined : Object.freeze({ profile: this.profile, aggregateVersion: this.aggregateVersion });
  }

  saveWithExpectedVersion(profile: IngredientMeasurementProfile, expectedVersion: number): number {
    if (this.failure !== undefined) throw this.failure;
    if (expectedVersion !== this.aggregateVersion) throw new IngredientMeasurementProfileVersionConflict(expectedVersion, this.aggregateVersion);
    this.profile = profile;
    this.aggregateVersion += 1;
    this.writes += 1;
    return this.aggregateVersion;
  }
}

function command(overrides: Record<string, unknown> = {}) {
  return { profileId: IDS.profile, expectedVersion: 0, occurredAt: T1, actor: "owner", reason: "retired measurement", ...overrides };
}

function fixture(ingredients = new IngredientFixture(), profiles = new ProfileFixture()) {
  return { ingredients, profiles, service: new IngredientMeasurementProfileDeprecationService(ingredients, profiles) };
}

test("Profile Deprecation Service creates an intentional no-Active Profile state without rewriting history", () => {
  const setup = fixture();
  const result = setup.service.deprecate(command());
  assert.equal(result.versions.length, 1);
  assert.equal(result.versions[0]?.state, "Deprecated");
  assert.equal(result.versions[0]?.effectiveTo, T1);
  assert.equal(result.versions[0]?.identity.profileVersionId, IDS.version);
  assert.equal(setup.profiles.writes, 1);
});

test("Profile Deprecation Service rejects missing, no-Active, archived and stale commands without writing", () => {
  const missing = fixture();
  missing.profiles.profile = undefined;
  assert.throws(() => missing.service.deprecate(command()), IngredientMeasurementProfileDeprecationNotFound);

  const noActive = fixture();
  noActive.profiles.profile = activeProfile().deprecateActive(IDS.version, { occurredAt: T1, actorId: "owner" });
  assert.throws(() => noActive.service.deprecate(command()), IngredientMeasurementProfileDeprecationValidationFailure);

  const archived = fixture();
  archived.ingredients.state = "Archived";
  assert.throws(() => archived.service.deprecate(command()), IngredientMeasurementProfileDeprecationIngredientInactive);

  const stale = fixture();
  assert.throws(() => stale.service.deprecate(command({ expectedVersion: 1 })), IngredientMeasurementProfileDeprecationExpectedVersionConflict);
  assert.equal(missing.profiles.writes + noActive.profiles.writes + archived.profiles.writes + stale.profiles.writes, 0);
});

test("Profile Deprecation Service validates command and contains persistence detail", () => {
  const invalid = fixture();
  assert.throws(() => invalid.service.deprecate(command({ actor: "" })), IngredientMeasurementProfileDeprecationValidationFailure);
  assert.equal(invalid.profiles.writes, 0);

  const persistence = fixture();
  persistence.profiles.failure = new Error("SQLITE private stack cause");
  assert.throws(() => persistence.service.deprecate(command()), (error: unknown) => {
    assert.ok(error instanceof IngredientMeasurementProfileDeprecationPersistenceFailure);
    assert.doesNotMatch(error.message, /sqlite|private|stack|cause/i);
    return true;
  });
});

test("Profile Deprecation Service contains technical lookup failures without writing", () => {
  const profileLookup = fixture();
  profileLookup.profiles.lookupFailure = new Error("SQLITE profile table private stack cause");
  assert.throws(() => profileLookup.service.deprecate(command()), (error: unknown) => {
    assert.ok(error instanceof IngredientMeasurementProfileDeprecationPersistenceFailure);
    assert.doesNotMatch(error.message, /sqlite|private|stack|cause/i);
    return true;
  });

  const ingredientLookup = fixture();
  ingredientLookup.ingredients.failure = new Error("SQLITE ingredient table private stack cause");
  assert.throws(() => ingredientLookup.service.deprecate(command()), (error: unknown) => {
    assert.ok(error instanceof IngredientMeasurementProfileDeprecationPersistenceFailure);
    assert.doesNotMatch(error.message, /sqlite|private|stack|cause/i);
    return true;
  });

  assert.equal(profileLookup.profiles.writes + ingredientLookup.profiles.writes, 0);
});
