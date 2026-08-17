import assert from "node:assert/strict";
import test from "node:test";
import {
  IngredientMeasurementProfileSupersessionExpectedVersionConflict,
  IngredientMeasurementProfileSupersessionIngredientInactive,
  IngredientMeasurementProfileSupersessionMeasurementFailure,
  IngredientMeasurementProfileSupersessionNotFound,
  IngredientMeasurementProfileSupersessionPersistenceFailure,
  IngredientMeasurementProfileSupersessionService,
  IngredientMeasurementProfileSupersessionValidationFailure
} from "../domains/recipe/index.js";
import { IngredientMeasurementProfile } from "../domains/recipe/measurement-profile/ingredient-measurement-profile.js";
import { IngredientMeasurementProfileVersionConflict } from "../domains/recipe/measurement-profile/persistence/errors.js";
import { MeasurementUnitResolver } from "../domains/recipe/measurement/measurement-unit-resolver.js";
import type { MeasurementProfileFactsResolutionContractV1 } from "../domains/recipe/contracts/measurement-foundation-contract.js";

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
  findById() { return this.state === undefined ? undefined : Object.freeze({ status: this.state }); }
}

class ProfileFixture {
  profile: IngredientMeasurementProfile | undefined = activeProfile();
  aggregateVersion = 0;
  failure: unknown = undefined;
  writes = 0;

  findAggregateByProfileId() {
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
  return {
    profileId: IDS.profile,
    expectedVersion: 0,
    dimension: "mass",
    canonicalUnitCode: "g",
    allowedUnitCodes: ["g", "kg"],
    occurredAt: T1,
    actor: "owner",
    reason: "supplier packaging revision",
    ...overrides
  };
}

function fixture(
  ingredients = new IngredientFixture(),
  profiles = new ProfileFixture(),
  facts: MeasurementProfileFactsResolutionContractV1 = {
    resolveProfileFacts() {
      return Object.freeze({ status: "resolved" as const, facts: Object.freeze({ dimension: "mass" as const, canonicalUnitCode: "g" as const, allowedUnitCodes: Object.freeze(["g", "kg"] as const) }) });
    }
  }
) {
  return {
    ingredients,
    profiles,
    service: new IngredientMeasurementProfileSupersessionService(ingredients, profiles, facts, new MeasurementUnitResolver())
  };
}

test("Profile Supersession Service preserves one continuous Active version and immutable history", () => {
  const setup = fixture();
  const result = setup.service.supersede(command());
  const oldVersion = result.versions.find((version) => version.identity.profileVersionId === IDS.version);
  const replacement = result.versions.find((version) => version.state === "Active");
  assert.equal(oldVersion?.state, "Superseded");
  assert.equal(oldVersion?.effectiveTo, T1);
  assert.equal(replacement?.effectiveFrom, T1);
  assert.notEqual(replacement?.identity.profileVersionId, IDS.version);
  assert.equal(setup.profiles.writes, 1);
});

test("Profile Supersession Service forwards raw facts and rejects family changes without writing", () => {
  const seen: unknown[] = [];
  const setup = fixture(undefined, undefined, {
    resolveProfileFacts(input) {
      seen.push(input);
      return Object.freeze({ status: "resolved" as const, facts: Object.freeze({ dimension: "volume" as const, canonicalUnitCode: "ml" as const, allowedUnitCodes: Object.freeze(["ml"] as const) }) });
    }
  });
  assert.throws(() => setup.service.supersede(command({ dimension: "owner-token", canonicalUnitCode: "owner-unit", allowedUnitCodes: ["owner-allowed"] })), IngredientMeasurementProfileSupersessionValidationFailure);
  assert.deepEqual(seen, [{ rawDimension: "owner-token", rawCanonicalUnit: "owner-unit", rawAllowedUnitValues: ["owner-allowed"] }]);
  assert.equal(setup.profiles.writes, 0);
});

test("Profile Supersession Service rejects missing, no-Active, archived, stale and Measurement failures without writing", () => {
  const missing = fixture();
  missing.profiles.profile = undefined;
  assert.throws(() => missing.service.supersede(command()), IngredientMeasurementProfileSupersessionNotFound);

  const noActive = fixture();
  noActive.profiles.profile = activeProfile().deprecateActive(IDS.version, { occurredAt: T1, actorId: "owner" });
  assert.throws(() => noActive.service.supersede(command()), IngredientMeasurementProfileSupersessionValidationFailure);

  const archived = fixture();
  archived.ingredients.state = "Archived";
  assert.throws(() => archived.service.supersede(command()), IngredientMeasurementProfileSupersessionIngredientInactive);

  const stale = fixture();
  assert.throws(() => stale.service.supersede(command({ expectedVersion: 1 })), IngredientMeasurementProfileSupersessionExpectedVersionConflict);

  const resolution = fixture(undefined, undefined, { resolveProfileFacts() { return Object.freeze({ status: "failed" as const, code: "UNSUPPORTED_MEASUREMENT_DIMENSION" as const }); } });
  assert.throws(() => resolution.service.supersede(command()), IngredientMeasurementProfileSupersessionMeasurementFailure);
  assert.equal(missing.profiles.writes + noActive.profiles.writes + archived.profiles.writes + stale.profiles.writes + resolution.profiles.writes, 0);
});

test("Profile Supersession Service contains persistence detail", () => {
  const setup = fixture();
  setup.profiles.failure = new Error("SQLITE private stack cause");
  assert.throws(() => setup.service.supersede(command()), (error: unknown) => {
    assert.ok(error instanceof IngredientMeasurementProfileSupersessionPersistenceFailure);
    assert.doesNotMatch(error.message, /sqlite|private|stack|cause/i);
    return true;
  });
});
