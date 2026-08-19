import type { DatabaseAdapter } from "../../../../shared/database/database-adapter.js";
import type {
  CanonicalIngredientIdV1,
  FormalMeasurementProfileDefinitionContractV1,
  IngredientMeasurementProfileContractV1,
  IngredientMeasurementProfileId,
  IngredientMeasurementProfileRepositoryPortV1,
  IngredientMeasurementProfileVersionId,
  MeasurementProfileDefinitionContractV1
} from "../../contracts/ingredient-measurement-profile-contract.js";
import type {
  MeasurementUnitResolutionContractV1
} from "../../contracts/measurement-foundation-contract.js";
import { IngredientMeasurementProfile } from "../ingredient-measurement-profile.js";
import type {
  IngredientMeasurementProfileStore,
  VersionedIngredientMeasurementProfile
} from "../measurement-profile-repository.js";
import {
  DuplicateIngredientMeasurementProfile,
  IngredientMeasurementProfilePersistenceError,
  IngredientMeasurementProfilePersistenceFailure,
  IngredientMeasurementProfileVersionConflict,
  InvalidIngredientMeasurementProfilePersistenceState
} from "../persistence/errors.js";
import { MeasurementProfilePersistenceMapper } from "../persistence/measurement-profile-persistence-mapper.js";
import type {
  IngredientMeasurementProfileRecord,
  IngredientMeasurementProfileRow,
  IngredientMeasurementProfileVersionRecord,
  IngredientMeasurementProfileVersionRow
} from "../persistence/records.js";

const PROFILE_COLUMNS = `
  profile_id,
  ingredient_id,
  aggregate_version,
  created_at,
  created_by
`;

const VERSION_COLUMNS = `
  profile_version_id,
  profile_id,
  ingredient_id,
  version_position,
  state,
  dimension,
  canonical_unit_code,
  allowed_unit_codes_json,
  profile_aliases_json,
  source_type,
  source_reference_id,
  source_recorded_at,
  source_recorded_by,
  effective_from,
  effective_to,
  superseding_profile_version_id,
  lifecycle_json
`;

function isConstraintFailure(error: unknown): boolean {
  const code = (error as { code?: unknown } | undefined)?.code;
  return typeof code === "string" && code.startsWith("SQLITE_CONSTRAINT");
}

function mapFailure(operation: string, error: unknown): never {
  if (error instanceof IngredientMeasurementProfilePersistenceError) {
    throw error;
  }
  throw new IngredientMeasurementProfilePersistenceFailure(operation, error);
}

function instant(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new InvalidIngredientMeasurementProfilePersistenceState(
      "Persisted Measurement Profile effective time is invalid."
    );
  }
  return parsed;
}

function isFormal(
  version: MeasurementProfileDefinitionContractV1
): version is FormalMeasurementProfileDefinitionContractV1 {
  return version.state !== "Draft";
}

function authoritativeAt(
  version: FormalMeasurementProfileDefinitionContractV1,
  evaluatedAt: string
): boolean {
  const evaluated = instant(evaluatedAt);
  return (
    instant(version.effectiveFrom) <= evaluated
    && (
      version.state === "Active"
      || evaluated < instant(version.effectiveTo)
    )
  );
}

export class SqliteIngredientMeasurementProfileRepository
implements
IngredientMeasurementProfileRepositoryPortV1,
IngredientMeasurementProfileStore {
  private readonly mapper: MeasurementProfilePersistenceMapper;

  constructor(
    private readonly database: DatabaseAdapter,
    unitResolver: MeasurementUnitResolutionContractV1
  ) {
    this.mapper = new MeasurementProfilePersistenceMapper(unitResolver);
  }

  saveNew(profile: IngredientMeasurementProfile): void {
    const mapped = this.mapper.toRecords(profile, 0);
    try {
      this.database.transactionImmediate(() => {
        this.insertProfile(mapped.profile);
        for (const version of mapped.versions) this.insertVersion(version);
      });
    } catch (error) {
      if (
        isConstraintFailure(error)
        && this.rawProfile(mapped.profile.profileId) !== undefined
      ) {
        throw new DuplicateIngredientMeasurementProfile(
          mapped.profile.profileId,
          error
        );
      }
      mapFailure("save new Ingredient Measurement Profile", error);
    }
  }

  saveWithExpectedVersion(
    profile: IngredientMeasurementProfile,
    expectedVersion: number
  ): number {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
      throw new IngredientMeasurementProfileVersionConflict(
        expectedVersion,
        -1
      );
    }
    const nextVersion = expectedVersion + 1;
    const mapped = this.mapper.toRecords(profile, nextVersion);
    try {
      return this.database.transactionImmediate(() => {
        const current = this.rawProfile(mapped.profile.profileId);
        if (current === undefined) {
          throw new InvalidIngredientMeasurementProfilePersistenceState(
            "Ingredient Measurement Profile does not exist."
          );
        }
        if (current.aggregate_version !== expectedVersion) {
          throw new IngredientMeasurementProfileVersionConflict(
            expectedVersion,
            current.aggregate_version
          );
        }
        const persistedRows = this.rawVersions(mapped.profile.profileId);
        const persisted = this.mapper.fromRows(current, persistedRows);
        this.assertSingleTransition(persisted, profile);

        for (const version of mapped.versions) {
          const existing = persistedRows.find(
            (row) => row.profile_version_id === version.profileVersionId
          );
          if (existing === undefined) this.insertVersion(version);
          else this.updateVersion(version);
        }
        const result = this.database.execute(
          `UPDATE recipe_ingredient_measurement_profiles
              SET aggregate_version = ?
            WHERE profile_id = ?
              AND aggregate_version = ?`,
          [nextVersion, mapped.profile.profileId, expectedVersion]
        );
        if (result.changes !== 1) {
          const actual =
            this.rawProfile(mapped.profile.profileId)?.aggregate_version
            ?? expectedVersion;
          throw new IngredientMeasurementProfileVersionConflict(
            expectedVersion,
            actual
          );
        }
        return nextVersion;
      });
    } catch (error) {
      return mapFailure(
        "save Ingredient Measurement Profile with expected version",
        error
      );
    }
  }

  findAggregateByProfileId(
    profileId: IngredientMeasurementProfileId
  ): VersionedIngredientMeasurementProfile | undefined {
    try {
      const row = this.rawProfile(profileId);
      if (row === undefined) return undefined;
      return Object.freeze({
        profile: this.mapper.fromRows(row, this.rawVersions(profileId)),
        aggregateVersion: row.aggregate_version
      });
    } catch (error) {
      return mapFailure("find Ingredient Measurement Profile Aggregate", error);
    }
  }

  listProfiles(): readonly IngredientMeasurementProfileContractV1[] {
    try {
      const rows = this.database.queryMany<IngredientMeasurementProfileRow>(
        `SELECT ${PROFILE_COLUMNS}
           FROM recipe_ingredient_measurement_profiles
          ORDER BY created_at, profile_id`
      );
      return Object.freeze(rows.map((row) =>
        this.mapper.fromRows(
          row,
          this.rawVersions(row.profile_id)
        ).toContract()
      ));
    } catch (error) {
      return mapFailure("list Ingredient Measurement Profiles", error);
    }
  }

  findHistoryByProfileId(
    profileId: IngredientMeasurementProfileId
  ): readonly MeasurementProfileDefinitionContractV1[] {
    const aggregate = this.findAggregateByProfileId(profileId);
    return aggregate === undefined
      ? Object.freeze([])
      : aggregate.profile.toContract().versions;
  }

  findActiveProfilesAt(
    ingredientId: CanonicalIngredientIdV1,
    evaluatedAt: string
  ): readonly FormalMeasurementProfileDefinitionContractV1[] {
    try {
      instant(evaluatedAt);
      const rows =
        this.database.queryMany<IngredientMeasurementProfileVersionRow>(
          `SELECT ${VERSION_COLUMNS}
             FROM recipe_ingredient_measurement_profile_versions
            WHERE ingredient_id = ?
              AND state <> 'Draft'
            ORDER BY profile_id, version_position`,
          [ingredientId]
        );
      const profileIds = [...new Set(rows.map((row) => row.profile_id))];
      const versions = profileIds.flatMap((profileId) => {
        const profileRow = this.rawProfile(profileId);
        if (profileRow === undefined) {
          throw new InvalidIngredientMeasurementProfilePersistenceState(
            "Measurement Profile Version references a missing Profile."
          );
        }
        return this.mapper.fromRows(
          profileRow,
          this.rawVersions(profileId)
        ).toContract().versions;
      });
      return Object.freeze(
        versions.filter(isFormal).filter((version) =>
          version.identity.ingredientId === ingredientId
          && authoritativeAt(version, evaluatedAt)
        )
      );
    } catch (error) {
      return mapFailure(
        "find active Ingredient Measurement Profiles at instant",
        error
      );
    }
  }

  findProfileVersion(
    profileVersionId: IngredientMeasurementProfileVersionId
  ): MeasurementProfileDefinitionContractV1 | undefined {
    try {
      const versionRow =
        this.database.queryOne<IngredientMeasurementProfileVersionRow>(
          `SELECT ${VERSION_COLUMNS}
             FROM recipe_ingredient_measurement_profile_versions
            WHERE profile_version_id = ?`,
          [profileVersionId]
        );
      if (versionRow === undefined) return undefined;
      const profileRow = this.rawProfile(versionRow.profile_id);
      if (profileRow === undefined) {
        throw new InvalidIngredientMeasurementProfilePersistenceState(
          "Measurement Profile Version references a missing Profile."
        );
      }
      return this.mapper.fromRows(
        profileRow,
        this.rawVersions(profileRow.profile_id)
      ).findVersion(profileVersionId);
    } catch (error) {
      return mapFailure("find Ingredient Measurement Profile Version", error);
    }
  }

  private rawProfile(
    profileId: string
  ): IngredientMeasurementProfileRow | undefined {
    return this.database.queryOne<IngredientMeasurementProfileRow>(
      `SELECT ${PROFILE_COLUMNS}
         FROM recipe_ingredient_measurement_profiles
        WHERE profile_id = ?`,
      [profileId]
    );
  }

  private rawVersions(
    profileId: string
  ): readonly IngredientMeasurementProfileVersionRow[] {
    return this.database.queryMany<IngredientMeasurementProfileVersionRow>(
      `SELECT ${VERSION_COLUMNS}
         FROM recipe_ingredient_measurement_profile_versions
        WHERE profile_id = ?
        ORDER BY version_position`,
      [profileId]
    );
  }

  private insertProfile(record: IngredientMeasurementProfileRecord): void {
    this.database.execute(
      `INSERT INTO recipe_ingredient_measurement_profiles (
        profile_id, ingredient_id, aggregate_version, created_at, created_by
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        record.profileId,
        record.ingredientId,
        record.aggregateVersion,
        record.createdAt,
        record.createdBy
      ]
    );
  }

  private insertVersion(
    record: IngredientMeasurementProfileVersionRecord
  ): void {
    this.database.execute(
      `INSERT INTO recipe_ingredient_measurement_profile_versions (
        profile_version_id, profile_id, ingredient_id, version_position,
        state, dimension, canonical_unit_code, allowed_unit_codes_json,
        profile_aliases_json, source_type, source_reference_id,
        source_recorded_at, source_recorded_by, effective_from, effective_to,
        superseding_profile_version_id, lifecycle_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      this.versionParameters(record)
    );
  }

  private updateVersion(
    record: IngredientMeasurementProfileVersionRecord
  ): void {
    const result = this.database.execute(
      `UPDATE recipe_ingredient_measurement_profile_versions
          SET state = ?,
              dimension = ?,
              canonical_unit_code = ?,
              allowed_unit_codes_json = ?,
              profile_aliases_json = ?,
              source_type = ?,
              source_reference_id = ?,
              source_recorded_at = ?,
              source_recorded_by = ?,
              effective_from = ?,
              effective_to = ?,
              superseding_profile_version_id = ?,
              lifecycle_json = ?
        WHERE profile_version_id = ?
          AND profile_id = ?
          AND ingredient_id = ?
          AND version_position = ?`,
      [
        record.state,
        record.dimension ?? null,
        record.canonicalUnitCode ?? null,
        record.allowedUnitCodesJson ?? null,
        record.profileAliasesJson ?? null,
        record.sourceType ?? null,
        record.sourceReferenceId ?? null,
        record.sourceRecordedAt ?? null,
        record.sourceRecordedBy ?? null,
        record.effectiveFrom ?? null,
        record.effectiveTo ?? null,
        record.supersedingProfileVersionId ?? null,
        record.lifecycleJson,
        record.profileVersionId,
        record.profileId,
        record.ingredientId,
        record.versionPosition
      ]
    );
    if (result.changes !== 1) {
      throw new InvalidIngredientMeasurementProfilePersistenceState(
        "Measurement Profile Version update did not match persisted identity."
      );
    }
  }

  private versionParameters(
    record: IngredientMeasurementProfileVersionRecord
  ): readonly unknown[] {
    return [
      record.profileVersionId,
      record.profileId,
      record.ingredientId,
      record.versionPosition,
      record.state,
      record.dimension ?? null,
      record.canonicalUnitCode ?? null,
      record.allowedUnitCodesJson ?? null,
      record.profileAliasesJson ?? null,
      record.sourceType ?? null,
      record.sourceReferenceId ?? null,
      record.sourceRecordedAt ?? null,
      record.sourceRecordedBy ?? null,
      record.effectiveFrom ?? null,
      record.effectiveTo ?? null,
      record.supersedingProfileVersionId ?? null,
      record.lifecycleJson
    ];
  }

  private assertSingleTransition(
    persisted: IngredientMeasurementProfile,
    candidate: IngredientMeasurementProfile
  ): void {
    const before = persisted.toContract();
    const after = candidate.toContract();
    if (
      before.profileId !== after.profileId
      || before.ingredientId !== after.ingredientId
      || after.versions.length < before.versions.length
      || after.versions.length > before.versions.length + 1
    ) {
      throw new InvalidIngredientMeasurementProfilePersistenceState(
        "Measurement Profile mutation changed identity or history shape."
      );
    }
    const beforeFacts = before.versions.reduce(
      (sum, version) => sum + version.lifecycle.length,
      0
    );
    const afterFacts = after.versions.reduce(
      (sum, version) => sum + version.lifecycle.length,
      0
    );
    const appended = after.versions.find((version) =>
      !before.versions.some((beforeVersion) =>
        beforeVersion.identity.profileVersionId === version.identity.profileVersionId
      )
    );
    const expectedAddedFacts = after.versions.length === before.versions.length
      ? 1
      // Draft-first re-establishment appends exactly one CREATED fact.
      : appended?.state === "Draft"
        ? 1
        : 3;
    if (afterFacts - beforeFacts !== expectedAddedFacts) {
      throw new InvalidIngredientMeasurementProfilePersistenceState(
        "Measurement Profile save must contain exactly one legal lifecycle transition."
      );
    }
    for (const version of before.versions) {
      const replacement = after.versions.find(
        (candidateVersion) =>
          candidateVersion.identity.profileVersionId
          === version.identity.profileVersionId
      );
      if (
        replacement === undefined
        || replacement.lifecycle.length < version.lifecycle.length
        || JSON.stringify(replacement.lifecycle.slice(
          0,
          version.lifecycle.length
        )) !== JSON.stringify(version.lifecycle)
      ) {
        throw new InvalidIngredientMeasurementProfilePersistenceState(
          "Measurement Profile lifecycle history is not append-first."
        );
      }
    }
  }
}
