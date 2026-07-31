import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
  type CompleteMeasurementProfileFactsV1,
  type FormalMeasurementProfileDefinitionContractV1,
  type IngredientMeasurementProfileRepositoryPortV1,
  type IngredientMeasurementSourceReferenceV1,
  type IngredientNormalizationRequestV1,
  type MeasurementProfileDefinitionContractV1
} from "../domains/recipe/contracts/ingredient-measurement-profile-contract.js";
import type {
  MeasurementFoundationContractV1
} from "../domains/recipe/contracts/measurement-foundation-contract.js";
import {
  AmbiguousIngredientMeasurementAlias,
  ImmutableActiveMeasurementProfileViolation,
  InvalidIngredientMeasurementProfileDefinition,
  InvalidIngredientMeasurementProfileTransition,
  MissingIngredientMeasurementSourceEvidence
} from "../domains/recipe/measurement-profile/errors.js";
import { IngredientMeasurementProfile } from "../domains/recipe/measurement-profile/ingredient-measurement-profile.js";
import { IngredientMeasurementNormalizationService } from "../domains/recipe/measurement-profile/ingredient-normalization-service.js";
import { MeasurementNormalizer } from "../domains/recipe/measurement/measurement-normalizer.js";
import { MeasurementUnitResolver } from "../domains/recipe/measurement/measurement-unit-resolver.js";

const INGREDIENT_ID = "ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_INGREDIENT_ID = "ing_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROFILE_ID = "measurement_profile_cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROFILE_VERSION_ID =
  "measurement_profile_version_dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SECOND_PROFILE_ID =
  "measurement_profile_eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const SECOND_PROFILE_VERSION_ID =
  "measurement_profile_version_ffffffff-ffff-4fff-8fff-ffffffffffff";
const NEXT_PROFILE_VERSION_ID =
  "measurement_profile_version_11111111-1111-4111-8111-111111111111";
const ACTIVE_AT = "2026-07-30T01:00:00.000Z";
const LATER = "2026-07-31T01:00:00.000Z";

const unitResolver = new MeasurementUnitResolver();
const normalizer = new MeasurementNormalizer();
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

function source(
  input: Partial<IngredientMeasurementSourceReferenceV1> = {}
): IngredientMeasurementSourceReferenceV1 {
  return {
    sourceType: input.sourceType ?? "SYSTEM",
    ...(input.referenceId === undefined
      ? { referenceId: "measurement-profile-test" }
      : { referenceId: input.referenceId }),
    recordedAt: input.recordedAt ?? "2026-07-29T01:00:00.000Z",
    recordedBy: input.recordedBy ?? "actor_test"
  };
}

function facts(
  dimension: "mass" | "volume" | "count" = "mass",
  input: Partial<CompleteMeasurementProfileFactsV1> = {}
): CompleteMeasurementProfileFactsV1 {
  const defaults = dimension === "mass"
    ? { canonicalUnitCode: "g" as const, allowedUnitCodes: ["g", "kg", "tw_catty"] as const }
    : dimension === "volume"
      ? { canonicalUnitCode: "ml" as const, allowedUnitCodes: ["ml", "l", "cc"] as const }
      : { canonicalUnitCode: "each" as const, allowedUnitCodes: ["each", "dozen"] as const };
  return {
    dimension,
    canonicalUnitCode: input.canonicalUnitCode ?? defaults.canonicalUnitCode,
    allowedUnitCodes: input.allowedUnitCodes ?? defaults.allowedUnitCodes,
    profileAliases: input.profileAliases ?? [],
    source: input.source ?? source()
  };
}

function draft(input: {
  profileId?: string;
  profileVersionId?: string;
  ingredientId?: string;
  sourceEvidence?: IngredientMeasurementSourceReferenceV1;
} = {}): IngredientMeasurementProfile {
  return IngredientMeasurementProfile.createDraft({
    identity: {
      profileId: input.profileId ?? PROFILE_ID,
      profileVersionId: input.profileVersionId ?? PROFILE_VERSION_ID,
      ingredientId: input.ingredientId ?? INGREDIENT_ID
    },
    createdAt: "2026-07-29T00:00:00.000Z",
    createdBy: "actor_test",
    ...(input.sourceEvidence === undefined ? {} : { source: input.sourceEvidence })
  });
}

function activeProfile(input: {
  profileId?: string;
  profileVersionId?: string;
  ingredientId?: string;
  definition?: CompleteMeasurementProfileFactsV1;
} = {}): IngredientMeasurementProfile {
  const profileVersionId = input.profileVersionId ?? PROFILE_VERSION_ID;
  return draft(input).activateDraft(
    profileVersionId,
    input.definition ?? facts(),
    {
      occurredAt: ACTIVE_AT,
      actorId: "actor_test",
      reason: "approved"
    },
    unitResolver
  );
}

class TestProfileRepository implements IngredientMeasurementProfileRepositoryPortV1 {
  constructor(
    private readonly versions: readonly MeasurementProfileDefinitionContractV1[]
  ) {}

  findHistoryByProfileId(profileId: string): readonly MeasurementProfileDefinitionContractV1[] {
    return Object.freeze(
      this.versions.filter((version) => version.identity.profileId === profileId)
    );
  }

  findActiveProfilesAt(
    ingredientId: string,
    evaluatedAt: string
  ): readonly FormalMeasurementProfileDefinitionContractV1[] {
    return Object.freeze(
      this.versions.filter(
        (version): version is FormalMeasurementProfileDefinitionContractV1 =>
          version.state !== "Draft"
          && version.identity.ingredientId === ingredientId
          && Date.parse(version.effectiveFrom) <= Date.parse(evaluatedAt)
          && (
            version.state === "Active"
            || Date.parse(evaluatedAt) < Date.parse(version.effectiveTo)
          )
      )
    );
  }

  findProfileVersion(
    profileVersionId: string
  ): MeasurementProfileDefinitionContractV1 | undefined {
    return this.versions.find(
      (version) => version.identity.profileVersionId === profileVersionId
    );
  }
}

function serviceFor(
  versions: readonly MeasurementProfileDefinitionContractV1[],
  measurement: MeasurementFoundationContractV1 = normalizer
): IngredientMeasurementNormalizationService {
  return new IngredientMeasurementNormalizationService(
    new TestProfileRepository(versions),
    unitResolver,
    measurement
  );
}

function request(input: Partial<IngredientNormalizationRequestV1> = {}): IngredientNormalizationRequestV1 {
  return {
    contractVersion: INGREDIENT_MEASUREMENT_PROFILE_CONTRACT_VERSION,
    ingredientId: input.ingredientId ?? INGREDIENT_ID,
    rawQuantity: input.rawQuantity ?? { coefficient: "1", scale: 0 },
    rawUnitValue: input.rawUnitValue ?? "g",
    ...(input.locale === undefined ? {} : { locale: input.locale }),
    evaluatedAt: input.evaluatedAt ?? LATER
  };
}

function onlyVersion(profile: IngredientMeasurementProfile): MeasurementProfileDefinitionContractV1 {
  return profile.toContract().versions[0]!;
}

function assertFailure(
  result: ReturnType<IngredientMeasurementNormalizationService["normalizeCurrent"]>,
  code: string
): void {
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.failure.code, code);
  }
}

test("normalizeAt exposes effective-time normalization through the published contract", () => {
  const service = serviceFor([onlyVersion(activeProfile())]);
  const result = service.normalizeAt(request({
    rawQuantity: { coefficient: "2", scale: 0 },
    rawUnitValue: "kg",
    evaluatedAt: LATER
  }));

  assert.equal(result.status, "normalized");
  if (result.status === "normalized") {
    assert.equal(result.evidence.evaluatedAt, LATER);
    assert.equal(result.evidence.profileVersionId, PROFILE_VERSION_ID);
    assert.deepEqual(result.evidence.measurementEvidence.normalizedQuantity, {
      coefficient: "2000",
      scale: 0
    });
  }
});

test("valid mass Profile canonicalizes to g", () => {
  const version = onlyVersion(activeProfile());
  assert.equal(version.state, "Active");
  if (version.state === "Active") {
    assert.equal(version.dimension, "mass");
    assert.equal(version.canonicalUnitCode, "g");
  }
});

test("valid volume Profile canonicalizes to ml", () => {
  const version = onlyVersion(activeProfile({ definition: facts("volume") }));
  assert.equal(version.state === "Active" && version.canonicalUnitCode, "ml");
});

test("valid count Profile canonicalizes to each", () => {
  const version = onlyVersion(activeProfile({ definition: facts("count") }));
  assert.equal(version.state === "Active" && version.canonicalUnitCode, "each");
});

test("Profile, Profile Version, and Canonical Ingredient identities are validated", () => {
  assert.throws(
    () => draft({ profileId: "profile-by-name" }),
    /measurement_profile_<uuid>/
  );
  assert.throws(
    () => draft({ profileVersionId: "version-1" }),
    /measurement_profile_version_<uuid>/
  );
  assert.throws(
    () => draft({ ingredientId: "ingredient-by-name" }),
    /ing_<uuid>/
  );
});

test("Draft revision defensively copies mutable definition inputs", () => {
  const aliases = [
    { rawValue: "顆", scope: "PROFILE" as const, resolvedUnitCode: "each" as const }
  ];
  const revised = draft().reviseDraft(
    PROFILE_VERSION_ID,
    { profileAliases: aliases },
    { occurredAt: ACTIVE_AT, actorId: "actor_test" }
  );
  aliases[0]!.rawValue = "粒";
  const version = onlyVersion(revised);
  assert.equal(
    version.state === "Draft"
      && version.definition?.profileAliases?.[0]?.rawValue,
    "顆"
  );
});

test("identity conversion normalizes without alias evidence", () => {
  const result = serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(request());
  assert.equal(result.status, "normalized");
  if (result.status === "normalized") {
    assert.equal(result.evidence.resolvedAlias, undefined);
    assert.deepEqual(result.evidence.measurementEvidence.conversionRatio, {
      numerator: "1",
      denominator: "1"
    });
  }
});

test("global exact conversion uses existing Measurement Foundation", () => {
  const result = serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(
    request({ rawUnitValue: "kg", rawQuantity: { coefficient: "2", scale: 0 } })
  );
  assert.equal(result.status, "normalized");
  if (result.status === "normalized") {
    assert.deepEqual(result.evidence.measurementEvidence.normalizedQuantity, {
      coefficient: "2000",
      scale: 0
    });
  }
});

test("explicit stable unit code resolves before aliases", () => {
  const result = unitResolver.resolveUnit({ rawValue: "kg" });
  assert.equal(result.status, "resolved");
  if (result.status === "resolved") assert.equal(result.scope, "EXPLICIT");
});

test("GLOBAL alias resolves to a stable unit code", () => {
  const result = serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(
    request({ rawUnitValue: "公斤" })
  );
  assert.equal(result.status, "normalized");
  if (result.status === "normalized") {
    assert.equal(result.evidence.resolvedAlias?.scope, "GLOBAL");
    assert.equal(result.evidence.resolvedAlias?.resolvedUnitCode, "kg");
  }
});

test("normalization evidence preserves the exact caller raw unit input", () => {
  const result = serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(
    request({ rawUnitValue: " kg " })
  );
  assert.equal(result.status, "normalized");
  if (result.status === "normalized") {
    assert.equal(result.evidence.rawUnitValue, " kg ");
    assert.equal(result.evidence.measurementEvidence.rawUnitCode, "kg");
  }
});

test("LOCALE alias with explicit locale resolves exactly", () => {
  const result = serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(
    request({ rawUnitValue: "斤", locale: "zh-TW" })
  );
  assert.equal(result.status, "normalized");
  if (result.status === "normalized") {
    assert.equal(result.evidence.resolvedAlias?.scope, "LOCALE");
    assert.equal(result.evidence.resolvedAlias?.resolvedUnitCode, "tw_catty");
  }
});

test("PROFILE supplemental alias resolves only for its Profile", () => {
  const profile = activeProfile({
    definition: facts("count", {
      profileAliases: [{ rawValue: "顆", scope: "PROFILE", resolvedUnitCode: "each" }]
    })
  });
  const result = serviceFor([onlyVersion(profile)]).normalizeCurrent(
    request({ rawUnitValue: "顆" })
  );
  assert.equal(result.status, "normalized");
  if (result.status === "normalized") {
    assert.equal(result.evidence.resolvedAlias?.scope, "PROFILE");
  }
});

test("PROFILE alias target must be allowed by the Profile", () => {
  assert.throws(
    () => activeProfile({
      definition: facts("count", {
        allowedUnitCodes: ["each"],
        profileAliases: [{ rawValue: "一打", scope: "PROFILE", resolvedUnitCode: "dozen" }]
      })
    }),
    /not allowed/
  );
});

test("PROFILE alias cannot override GLOBAL authority", () => {
  assert.throws(
    () => activeProfile({
      definition: facts("mass", {
        profileAliases: [{ rawValue: "公斤", scope: "PROFILE", resolvedUnitCode: "g" }]
      })
    }),
    InvalidIngredientMeasurementProfileDefinition
  );
});

test("PROFILE alias cannot override LOCALE authority", () => {
  assert.throws(
    () => activeProfile({
      definition: facts("mass", {
        profileAliases: [{ rawValue: "斤", scope: "PROFILE", resolvedUnitCode: "g" }]
      })
    }),
    InvalidIngredientMeasurementProfileDefinition
  );
});

test("unknown alias fails closed", () => {
  assertFailure(
    serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(
      request({ rawUnitValue: "stone" })
    ),
    "UNKNOWN_UNIT_ALIAS"
  );
});

test("blank raw unit returns a typed failure instead of throwing", () => {
  assertFailure(
    serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(
      request({ rawUnitValue: "   " })
    ),
    "UNKNOWN_UNIT_ALIAS"
  );
});

test("ambiguous PROFILE alias fails closed", () => {
  const valid = onlyVersion(activeProfile());
  assert.equal(valid.state, "Active");
  if (valid.state !== "Active") return;
  const malformed = {
    ...valid,
    profileAliases: Object.freeze([
      { rawValue: "匙", scope: "PROFILE" as const, resolvedUnitCode: "g" as const },
      { rawValue: "匙", scope: "PROFILE" as const, resolvedUnitCode: "kg" as const }
    ])
  };
  assertFailure(
    serviceFor([malformed]).normalizeCurrent(request({ rawUnitValue: "匙" })),
    "AMBIGUOUS_UNIT_ALIAS"
  );
});

test("duplicate PROFILE aliases are rejected during validation", () => {
  assert.throws(
    () => activeProfile({
      definition: facts("count", {
        profileAliases: [
          { rawValue: "顆", scope: "PROFILE", resolvedUnitCode: "each" },
          { rawValue: "顆", scope: "PROFILE", resolvedUnitCode: "each" }
        ]
      })
    }),
    AmbiguousIngredientMeasurementAlias
  );
});

test("斤 without locale fails closed", () => {
  assertFailure(
    serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(
      request({ rawUnitValue: "斤" })
    ),
    "LOCALE_REQUIRED"
  );
});

test("斤 with unsupported locale fails closed", () => {
  assertFailure(
    serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(
      request({ rawUnitValue: "斤", locale: "en-US" })
    ),
    "UNSUPPORTED_LOCALE_ALIAS"
  );
});

test("tw_catty normalizes exactly to 600 g", () => {
  const result = serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(
    request({ rawUnitValue: "tw_catty" })
  );
  assert.equal(result.status, "normalized");
  if (result.status === "normalized") {
    assert.deepEqual(result.evidence.measurementEvidence.conversionRatio, {
      numerator: "600",
      denominator: "1"
    });
    assert.deepEqual(result.evidence.measurementEvidence.normalizedQuantity, {
      coefficient: "600",
      scale: 0
    });
  }
});

test("Profile contract has no ratio field and cannot override tw_catty", () => {
  const sourceText = readFileSync(
    path.join(projectRoot, "src/domains/recipe/contracts/ingredient-measurement-profile-contract.ts"),
    "utf8"
  );
  assert.doesNotMatch(sourceText, /profile.*(?:numerator|denominator)|conversionRatio/i);
});

test("兩 remains unsupported in v1", () => {
  assertFailure(
    serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(
      request({ rawUnitValue: "兩", locale: "zh-TW" })
    ),
    "UNSUPPORTED_TAIWAN_UNIT"
  );
});

for (const packageValue of ["包", "袋", "盒", "罐"]) {
  test(`${packageValue} returns PACKAGE_SPECIFICATION_REQUIRED`, () => {
    assertFailure(
      serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(
        request({ rawUnitValue: packageValue })
      ),
      "PACKAGE_SPECIFICATION_REQUIRED"
    );
  });
}

test("missing Active Profile fails closed", () => {
  assertFailure(serviceFor([]).normalizeCurrent(request()), "MISSING_ACTIVE_PROFILE");
});

test("multiple Active Profiles fail closed without choosing one", () => {
  const first = onlyVersion(activeProfile());
  const second = onlyVersion(activeProfile({
    profileId: SECOND_PROFILE_ID,
    profileVersionId: SECOND_PROFILE_VERSION_ID
  }));
  assertFailure(
    serviceFor([first, second]).normalizeCurrent(request()),
    "AMBIGUOUS_ACTIVE_PROFILE"
  );
});

test("Draft Ingredient without Active Profile cannot formally normalize", () => {
  assertFailure(
    serviceFor([onlyVersion(draft())]).normalizeCurrent(request()),
    "MISSING_ACTIVE_PROFILE"
  );
});

test("Active Profile Version is immutable", () => {
  const profile = activeProfile();
  assert.throws(
    () => profile.reviseDraft(
      PROFILE_VERSION_ID,
      { allowedUnitCodes: ["g"] },
      { occurredAt: LATER, actorId: "actor_test" }
    ),
    ImmutableActiveMeasurementProfileViolation
  );
  assert.equal(Object.isFrozen(onlyVersion(profile)), true);
});

test("valid explicit lifecycle transition deprecates an Active Profile", () => {
  const profile = activeProfile().deprecateActive(PROFILE_VERSION_ID, {
    occurredAt: LATER,
    actorId: "actor_test",
    reason: "retired"
  });
  const version = onlyVersion(profile);
  assert.equal(version.state, "Deprecated");
  assert.equal(version.lifecycle.at(-1)?.transition, "DEPRECATED");
});

test("lifecycle ordering compares ISO instants rather than timestamp strings", () => {
  const profile = draft().activateDraft(
    PROFILE_VERSION_ID,
    facts(),
    {
      occurredAt: "2026-07-30T03:00:00.000Z",
      actorId: "actor_test"
    },
    unitResolver
  );
  assert.throws(
    () => profile.deprecateActive(PROFILE_VERSION_ID, {
      occurredAt: "2026-07-30T10:00:00.000+08:00",
      actorId: "actor_test"
    }),
    /after Profile activation/
  );
});

test("invalid lifecycle transition fails closed", () => {
  assert.throws(
    () => draft().deprecateActive(PROFILE_VERSION_ID, {
      occurredAt: LATER,
      actorId: "actor_test"
    }),
    InvalidIngredientMeasurementProfileTransition
  );
});

test("supersession preserves old version and activates a new immutable version", () => {
  const profile = activeProfile().supersedeActive({
    activeProfileVersionId: PROFILE_VERSION_ID,
    supersedingIdentity: {
      profileId: PROFILE_ID,
      profileVersionId: NEXT_PROFILE_VERSION_ID,
      ingredientId: INGREDIENT_ID
    },
    supersedingDefinition: facts(),
    transition: {
      occurredAt: LATER,
      actorId: "actor_test",
      reason: "new evidence"
    },
    unitResolver
  });
  const versions = profile.toContract().versions;
  assert.equal(versions.length, 2);
  assert.equal(versions[0]?.state, "Superseded");
  assert.equal(versions[1]?.state, "Active");
  assert.equal(
    versions[0]?.state === "Superseded"
      && versions[0].supersedingProfileVersionId,
    NEXT_PROFILE_VERSION_ID
  );
});

test("effective-time lookup selects a Superseded Version within its historical interval", () => {
  const versions = activeProfile().supersedeActive({
    activeProfileVersionId: PROFILE_VERSION_ID,
    supersedingIdentity: {
      profileId: PROFILE_ID,
      profileVersionId: NEXT_PROFILE_VERSION_ID,
      ingredientId: INGREDIENT_ID
    },
    supersedingDefinition: facts(),
    transition: {
      occurredAt: LATER,
      actorId: "actor_test"
    },
    unitResolver
  }).toContract().versions;
  const historical = serviceFor(versions).normalizeCurrent(
    request({ evaluatedAt: "2026-07-30T12:00:00.000Z" })
  );
  assert.equal(historical.status, "normalized");
  if (historical.status === "normalized") {
    assert.equal(historical.evidence.profileVersionId, PROFILE_VERSION_ID);
  }
});

test("effective interval uses inclusive start and exclusive end", () => {
  const versions = activeProfile().supersedeActive({
    activeProfileVersionId: PROFILE_VERSION_ID,
    supersedingIdentity: {
      profileId: PROFILE_ID,
      profileVersionId: NEXT_PROFILE_VERSION_ID,
      ingredientId: INGREDIENT_ID
    },
    supersedingDefinition: facts(),
    transition: {
      occurredAt: LATER,
      actorId: "actor_test"
    },
    unitResolver
  }).toContract().versions;
  const repository = new TestProfileRepository(versions);
  assert.deepEqual(
    repository.findActiveProfilesAt(INGREDIENT_ID, ACTIVE_AT)
      .map((version) => version.identity.profileVersionId),
    [PROFILE_VERSION_ID]
  );
  assert.deepEqual(
    repository.findActiveProfilesAt(INGREDIENT_ID, LATER)
      .map((version) => version.identity.profileVersionId),
    [NEXT_PROFILE_VERSION_ID]
  );
});

test("Ingredient Archive does not break pinned historical replay", () => {
  const version = onlyVersion(
    activeProfile().deprecateActive(PROFILE_VERSION_ID, {
      occurredAt: LATER,
      actorId: "actor_test"
    })
  );
  const service = serviceFor([version]);
  assertFailure(service.normalizeCurrent(request()), "MISSING_ACTIVE_PROFILE");
  const replay = service.normalizePinned({
    ...request({ evaluatedAt: "2026-07-30T12:00:00.000Z" }),
    profileVersionId: PROFILE_VERSION_ID
  });
  assert.equal(replay.status, "normalized");
});

test("historical replay pins profileVersionId", () => {
  const version = onlyVersion(
    activeProfile().deprecateActive(PROFILE_VERSION_ID, {
      occurredAt: LATER,
      actorId: "actor_test"
    })
  );
  const replay = serviceFor([version]).normalizePinned({
    ...request({ evaluatedAt: "2026-07-30T12:00:00.000Z" }),
    profileVersionId: PROFILE_VERSION_ID
  });
  assert.equal(replay.status, "normalized");
  if (replay.status === "normalized") {
    assert.equal(replay.evidence.profileVersionId, PROFILE_VERSION_ID);
  }
});

test("pinned historical normalization enforces the Profile effective interval", () => {
  const version = onlyVersion(
    activeProfile().deprecateActive(PROFILE_VERSION_ID, {
      occurredAt: LATER,
      actorId: "actor_test"
    })
  );
  const service = serviceFor([version]);
  assertFailure(
    service.normalizePinned({
      ...request({ evaluatedAt: "2026-07-30T00:59:59.999Z" }),
      profileVersionId: PROFILE_VERSION_ID
    }),
    "INVALID_MEASUREMENT_PROFILE_DEFINITION"
  );
  assertFailure(
    service.normalizePinned({
      ...request({ evaluatedAt: LATER }),
      profileVersionId: PROFILE_VERSION_ID
    }),
    "INVALID_MEASUREMENT_PROFILE_DEFINITION"
  );
});

test("missing historical Profile Version fails closed", () => {
  assertFailure(
    serviceFor([]).normalizePinned({
      ...request(),
      profileVersionId: PROFILE_VERSION_ID
    }),
    "MISSING_HISTORICAL_PROFILE_VERSION"
  );
});

test("normalization evidence contains required identity and time fields", () => {
  const result = serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(request());
  assert.equal(result.status, "normalized");
  if (result.status === "normalized") {
    assert.equal(result.evidence.contractVersion, 1);
    assert.equal(result.evidence.ingredientId, INGREDIENT_ID);
    assert.equal(result.evidence.profileId, PROFILE_ID);
    assert.equal(result.evidence.profileVersionId, PROFILE_VERSION_ID);
    assert.equal(result.evidence.evaluatedAt, LATER);
    assert.equal(result.evidence.source.sourceType, "SYSTEM");
  }
});

test("evidence preserves Measurement contract, conversion ratio and version", () => {
  const result = serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(
    request({ rawUnitValue: "tw_catty" })
  );
  assert.equal(result.status, "normalized");
  if (result.status === "normalized") {
    const evidence = result.evidence.measurementEvidence;
    assert.equal(evidence.contractVersion, 1);
    assert.equal(evidence.conversionId, "measurement.mass.tw-catty-to-g");
    assert.equal(evidence.conversionVersion, 1);
    assert.deepEqual(evidence.conversionRatio, { numerator: "600", denominator: "1" });
  }
});

test("SourceReference requires recordedAt and recordedBy", () => {
  assert.throws(
    () => activeProfile({
      definition: facts("mass", {
        source: source({ recordedBy: "" })
      })
    }),
    MissingIngredientMeasurementSourceEvidence
  );
});

test("Profile Version Number is absent from public contracts and evidence", () => {
  const sourceText = readFileSync(
    path.join(projectRoot, "src/domains/recipe/contracts/ingredient-measurement-profile-contract.ts"),
    "utf8"
  );
  assert.doesNotMatch(sourceText, /profileVersionNumber/);
  const result = serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(request());
  assert.equal(
    result.status === "normalized"
      && Object.hasOwn(result.evidence, "profileVersionNumber"),
    false
  );
});

test("unsupported exact scale fails closed", () => {
  const result = serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(
    request({ rawQuantity: { coefficient: "1", scale: 7 } })
  );
  assertFailure(result, "UNSUPPORTED_EXACT_SCALE");
});

test("non-exact normalization fails closed", () => {
  const nonExact: MeasurementFoundationContractV1 = {
    normalize() {
      throw Object.assign(new Error("Message wording is not classification authority."), {
        code: "NON_EXACT_MEASUREMENT_NORMALIZATION"
      });
    }
  };
  assertFailure(
    serviceFor([onlyVersion(activeProfile())], nonExact).normalizeCurrent(request()),
    "NON_EXACT_NORMALIZATION"
  );
});

test("unsupported scale classification uses a stable code rather than message text", () => {
  const unsupportedScale: MeasurementFoundationContractV1 = {
    normalize() {
      throw Object.assign(new Error("No scale keyword is required here."), {
        code: "UNSUPPORTED_MEASUREMENT_SCALE"
      });
    }
  };
  assertFailure(
    serviceFor([onlyVersion(activeProfile())], unsupportedScale).normalizeCurrent(request()),
    "UNSUPPORTED_EXACT_SCALE"
  );
});

test("arithmetic overflow fails closed", () => {
  assertFailure(
    serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(
      request({
        rawUnitValue: "kg",
        rawQuantity: { coefficient: "9223372036854775807", scale: 0 }
      })
    ),
    "ARITHMETIC_OVERFLOW"
  );
});

test("normalization performs no rounding", () => {
  const result = serviceFor([onlyVersion(activeProfile())]).normalizeCurrent(
    request({
      rawUnitValue: "kg",
      rawQuantity: { coefficient: "125", scale: 2 }
    })
  );
  assert.equal(result.status, "normalized");
  if (result.status === "normalized") {
    assert.deepEqual(result.evidence.measurementEvidence.normalizedQuantity, {
      coefficient: "1250",
      scale: 0
    });
  }
});

test("cross-dimension unit is rejected by Profile validation", () => {
  assert.throws(
    () => activeProfile({
      definition: facts("mass", {
        allowedUnitCodes: ["g", "ml"]
      })
    }),
    InvalidIngredientMeasurementProfileDefinition
  );
});

test("Repository Port exposes history, active-at and pinned-version semantics", () => {
  const version = onlyVersion(activeProfile());
  const repository = new TestProfileRepository([version]);
  assert.equal(repository.findHistoryByProfileId(PROFILE_ID).length, 1);
  assert.equal(repository.findActiveProfilesAt(INGREDIENT_ID, LATER).length, 1);
  assert.equal(repository.findProfileVersion(PROFILE_VERSION_ID), version);
  assert.equal(repository.findActiveProfilesAt(OTHER_INGREDIENT_ID, LATER).length, 0);
});

test("Profile source contains no persistence, Cost, Recipe Aggregate, float, or package conversion", () => {
  const files = [
    "src/domains/recipe/measurement-profile/ingredient-measurement-profile.ts",
    "src/domains/recipe/measurement-profile/ingredient-normalization-service.ts"
  ];
  const sourceText = files
    .map((file) => readFileSync(path.join(projectRoot, file), "utf8"))
    .join("\n");
  assert.doesNotMatch(
    sourceText,
    /better-sqlite3|node:sqlite|domains[\\/]cost|recipe-aggregate|parseFloat|toFixed|PACKAGE.*(?:ratio|conversion)/i
  );
});

test("Profile validation consumes Measurement authority instead of defining canonical mappings", () => {
  const sourceText = readFileSync(
    path.join(projectRoot, "src/domains/recipe/measurement-profile/profile-validator.ts"),
    "utf8"
  );
  assert.doesNotMatch(sourceText, /CANONICAL_UNITS|mass\s*:\s*["']g|volume\s*:\s*["']ml|count\s*:\s*["']each/);
  assert.match(sourceText, /unitResolver\.resolveUnit/);
});
