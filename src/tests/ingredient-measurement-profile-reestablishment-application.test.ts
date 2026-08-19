import assert from "node:assert/strict";
import test from "node:test";
import {
  IngredientMeasurementProfileReestablishmentExpectedVersionConflict,
  IngredientMeasurementProfileReestablishmentIngredientInactive,
  IngredientMeasurementProfileReestablishmentPersistenceFailure,
  IngredientMeasurementProfileReestablishmentService,
  IngredientMeasurementProfileReestablishmentValidationFailure,
  type MeasurementProfileFactsResolutionContractV1
} from "../domains/recipe/index.js";
import { IngredientMeasurementProfile } from "../domains/recipe/measurement-profile/ingredient-measurement-profile.js";
import { IngredientMeasurementProfileVersionConflict } from "../domains/recipe/measurement-profile/persistence/errors.js";
import { MeasurementUnitResolver } from "../domains/recipe/measurement/measurement-unit-resolver.js";

const IDS = Object.freeze({ ingredient: "ing_123e4567-e89b-42d3-a456-426614174000", profile: "measurement_profile_123e4567-e89b-42d3-a456-426614174001", version: "measurement_profile_version_123e4567-e89b-42d3-a456-426614174002" });
const T0 = "2026-08-17T01:00:00.000Z";
const T1 = "2026-08-18T01:00:00.000Z";
const T2 = "2026-08-19T01:00:00.000Z";
const facts: MeasurementProfileFactsResolutionContractV1 = { resolveProfileFacts: () => Object.freeze({ status: "resolved" as const, facts: Object.freeze({ dimension: "mass" as const, canonicalUnitCode: "g" as const, allowedUnitCodes: Object.freeze(["g" as const, "kg" as const]) }) }) };

function deprecatedProfile() {
  return IngredientMeasurementProfile.createDraft({ identity: { profileId: IDS.profile, profileVersionId: IDS.version, ingredientId: IDS.ingredient }, createdAt: T0, createdBy: "owner" })
    .activateDraft(IDS.version, { dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g", "kg"], profileAliases: [], source: { sourceType: "MANUAL", recordedAt: T0, recordedBy: "owner" } }, { occurredAt: T0, actorId: "owner" }, new MeasurementUnitResolver())
    .deprecateActive(IDS.version, { occurredAt: T1, actorId: "owner" });
}

class Ingredients { status: "Active" | "Archived" = "Active"; findById() { return Object.freeze({ status: this.status }); } }
class Profiles {
  profile = deprecatedProfile(); version = 0; writes = 0; failure: unknown;
  findAggregateByProfileId() { return Object.freeze({ profile: this.profile, aggregateVersion: this.version }); }
  saveWithExpectedVersion(profile: IngredientMeasurementProfile, expectedVersion: number) { if (this.failure !== undefined) throw this.failure; if (expectedVersion !== this.version) throw new IngredientMeasurementProfileVersionConflict(expectedVersion, this.version); this.profile = profile; this.version += 1; this.writes += 1; return this.version; }
}
function command(overrides: Record<string, unknown> = {}) { return { profileId: IDS.profile, expectedVersion: 0, dimension: "mass", canonicalUnitCode: "g", allowedUnitCodes: ["g", "kg"], occurredAt: T1, actor: "owner", ...overrides }; }
function fixture() { const ingredients = new Ingredients(); const profiles = new Profiles(); return { ingredients, profiles, service: new IngredientMeasurementProfileReestablishmentService(ingredients, profiles, facts, new MeasurementUnitResolver()) }; }

test("Profile Re-establishment Service appends Draft then activates a new immutable Version", () => {
  const setup = fixture();
  const draft = setup.service.appendDraft(command());
  const draftVersion = draft.versions.at(-1)!;
  assert.equal(draftVersion.state, "Draft");
  assert.notEqual(draftVersion.identity.profileVersionId, IDS.version);
  assert.equal(setup.profiles.writes, 1);
  const active = setup.service.activateDraft({ profileId: IDS.profile, draftVersionId: draftVersion.identity.profileVersionId, expectedVersion: 1, occurredAt: T2, actor: "owner" });
  assert.equal(active.versions[0]?.state, "Deprecated");
  const activeVersion = active.versions.at(-1);
  assert.equal(activeVersion?.state, "Active");
  if (activeVersion?.state !== "Active") assert.fail("Draft did not activate.");
  assert.equal(activeVersion.effectiveFrom, T2);
  assert.equal(setup.profiles.writes, 2);
});

test("Profile Re-establishment Service rejects archived, stale and basis-changing commands without writes", () => {
  const archived = fixture(); archived.ingredients.status = "Archived";
  assert.throws(() => archived.service.appendDraft(command()), IngredientMeasurementProfileReestablishmentIngredientInactive);
  const stale = fixture();
  assert.throws(() => stale.service.appendDraft(command({ expectedVersion: 4 })), IngredientMeasurementProfileReestablishmentExpectedVersionConflict);
  const incompatibleFacts: MeasurementProfileFactsResolutionContractV1 = { resolveProfileFacts: () => Object.freeze({ status: "resolved" as const, facts: Object.freeze({ dimension: "volume" as const, canonicalUnitCode: "ml" as const, allowedUnitCodes: Object.freeze(["ml" as const]) }) }) };
  const mismatch = fixture();
  const service = new IngredientMeasurementProfileReestablishmentService(mismatch.ingredients, mismatch.profiles, incompatibleFacts, new MeasurementUnitResolver());
  assert.throws(() => service.appendDraft(command()), IngredientMeasurementProfileReestablishmentValidationFailure);
  assert.equal(archived.profiles.writes + stale.profiles.writes + mismatch.profiles.writes, 0);
});

test("Profile Re-establishment Service contains persistence failure without raw detail", () => {
  const setup = fixture(); setup.profiles.failure = new Error("SQLITE private table stack cause");
  assert.throws(() => setup.service.appendDraft(command()), (error: unknown) => {
    assert.ok(error instanceof IngredientMeasurementProfileReestablishmentPersistenceFailure);
    assert.doesNotMatch((error as Error).message, /sqlite|table|stack|cause/i);
    return true;
  });
  assert.equal(setup.profiles.writes, 0);
});
