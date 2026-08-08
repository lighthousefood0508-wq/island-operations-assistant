import type { RecipeAggregate } from "../domain/recipe-aggregate.js";
import type { RecipeDraftId, RecipeId, RecipeVersionId } from "../domain/identities.js";
import type {
  RecipeBackOfficeListItem,
  RecipeBackOfficeRepository,
  VersionedRecipeAggregate,
} from "../domain/recipe-repository.js";
import {
  InvalidRecipePersistenceState,
  RecipeConcurrencyConflict
} from "../persistence/errors.js";
import { RecipePersistenceMapper } from "../persistence/recipe-persistence-mapper.js";
import type {
  RecipeAbandonmentAuditRecord,
  RecipeDraftRecord,
  RecipeLineRecord,
  RecipePersistenceRecords,
  RecipePublishAuditRecord,
  RecipeRecord,
  RecipeSupersessionAuditRecord,
  RecipeVersionRecord
} from "../persistence/records.js";

type StoredVersion = Readonly<{
  version: RecipeVersionRecord;
  sourceDraft: RecipeDraftRecord;
  lines: readonly RecipeLineRecord[];
  publishAudit: RecipePublishAuditRecord;
}>;

type StoredRecipe = {
  recipe: RecipeRecord;
  currentDraft: RecipeDraftRecord;
  currentDraftLines: readonly RecipeLineRecord[];
  versions: Map<string, StoredVersion>;
  supersessions: Map<string, RecipeSupersessionAuditRecord>;
  abandonmentAudit: RecipeAbandonmentAuditRecord | null;
};

function sameRecord(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function publishedSourceDraft(draft: RecipeDraftRecord): RecipeDraftRecord {
  return Object.freeze({ ...draft, state: "Published" });
}

export class InMemoryRecipeRepository implements RecipeBackOfficeRepository {
  private readonly entries = new Map<string, StoredRecipe>();

  constructor(private readonly mapper = new RecipePersistenceMapper()) {}

  save(recipe: RecipeAggregate): void {
    const recipeId = recipe.recipeId.value;
    const existing = this.entries.get(recipeId);
    if (existing) {
      throw new RecipeConcurrencyConflict(recipeId, 0, existing.recipe.aggregateVersion);
    }
    const records = this.mapper.toRecords(recipe, 1);
    this.entries.set(recipeId, this.createStoredRecipe(records));
  }

  saveWithExpectedVersion(recipe: RecipeAggregate, expectedAggregateVersion: number): number {
    const recipeId = recipe.recipeId.value;
    const existing = this.entries.get(recipeId);
    if (!existing) {
      throw new RecipeConcurrencyConflict(recipeId, expectedAggregateVersion, 0);
    }
    if (existing.recipe.aggregateVersion !== expectedAggregateVersion) {
      throw new RecipeConcurrencyConflict(recipeId, expectedAggregateVersion, existing.recipe.aggregateVersion);
    }
    const nextVersion = expectedAggregateVersion + 1;
    const incoming = this.mapper.toRecords(recipe, nextVersion);
    const updated = this.merge(existing, incoming);
    this.entries.set(recipeId, updated);
    return nextVersion;
  }

  findById(recipeId: RecipeId): RecipeAggregate | undefined {
    return this.findWithVersion(recipeId)?.aggregate;
  }

  findWithVersion(recipeId: RecipeId): VersionedRecipeAggregate | undefined {
    const stored = this.entries.get(recipeId.value);
    return stored ? this.rehydrate(this.recordsForCurrent(stored)) : undefined;
  }

  findByDraftId(draftId: RecipeDraftId): VersionedRecipeAggregate | undefined {
    for (const stored of this.entries.values()) {
      if (stored.currentDraft.draftId === draftId.value) {
        return this.rehydrate(this.recordsForCurrent(stored));
      }
      for (const version of stored.versions.values()) {
        if (version.version.sourceDraftId === draftId.value) {
          return this.rehydrate(this.recordsForVersion(stored, version));
        }
      }
    }
    return undefined;
  }

  findPublishedVersion(recipeId: RecipeId, recipeVersionId?: RecipeVersionId): VersionedRecipeAggregate | undefined {
    const stored = this.entries.get(recipeId.value);
    if (!stored) return undefined;
    const version = recipeVersionId
      ? stored.versions.get(recipeVersionId.value)
      : [...stored.versions.values()].sort((left, right) =>
          right.version.versionNumber - left.version.versionNumber
        )[0];
    return version ? this.rehydrate(this.recordsForVersion(stored, version)) : undefined;
  }

  listRecipes(): readonly RecipeBackOfficeListItem[] {
    return Object.freeze([...this.entries.values()]
      .map((stored) => {
        const current = this.recordsForCurrent(stored);
        return Object.freeze({
          recipeId: current.recipe.recipeId,
          currentDraftId: current.recipe.currentDraftId,
          currentRecipeVersionId: current.recipe.currentRecipeVersionId,
          aggregateVersion: current.recipe.aggregateVersion,
          state: current.recipe.state,
          name: current.draft.name,
          versionNumber: current.version?.versionNumber ?? null
        });
      })
      .sort((left, right) => left.recipeId.localeCompare(right.recipeId)));
  }

  private createStoredRecipe(records: RecipePersistenceRecords): StoredRecipe {
    const versions = new Map<string, StoredVersion>();
    if (records.version && records.publishAudit) {
      versions.set(records.version.recipeVersionId, Object.freeze({
        version: records.version,
        sourceDraft: publishedSourceDraft(records.draft),
        lines: Object.freeze([...records.versionLines]),
        publishAudit: records.publishAudit
      }));
    }
    const supersessions = new Map<string, RecipeSupersessionAuditRecord>();
    for (const audit of records.supersessionAudits) {
      supersessions.set(audit.supersededRecipeVersionId, audit);
    }
    return {
      recipe: records.recipe,
      currentDraft: records.draft,
      currentDraftLines: Object.freeze([...records.draftLines]),
      versions,
      supersessions,
      abandonmentAudit: records.abandonmentAudit
    };
  }

  private merge(existing: StoredRecipe, incoming: RecipePersistenceRecords): StoredRecipe {
    const versions = new Map(existing.versions);
    const supersessions = new Map(existing.supersessions);

    if (incoming.version && incoming.publishAudit) {
      const storedVersion = versions.get(incoming.version.recipeVersionId);
      const candidate = Object.freeze({
        version: Object.freeze({ ...incoming.version, state: "Published" as const }),
        sourceDraft: publishedSourceDraft(incoming.draft),
        lines: Object.freeze([...incoming.versionLines]),
        publishAudit: incoming.publishAudit
      });
      if (storedVersion && !sameRecord(storedVersion, candidate)) {
        throw new InvalidRecipePersistenceState(
          `Published Recipe Version ${incoming.version.recipeVersionId} cannot be overwritten.`
        );
      }
      if (!storedVersion) {
        const existingNumbers = [...versions.values()].map((item) => item.version.versionNumber);
        const highestVersionNumber = existingNumbers.length === 0 ? 0 : Math.max(...existingNumbers);
        if (incoming.version.versionNumber <= highestVersionNumber) {
          throw new InvalidRecipePersistenceState(
            `Recipe Version number ${incoming.version.versionNumber} must be greater than ${highestVersionNumber}.`
          );
        }
        versions.set(incoming.version.recipeVersionId, candidate);
      }
    }

    for (const audit of incoming.supersessionAudits) {
      const existingAudit = supersessions.get(audit.supersededRecipeVersionId);
      if (existingAudit && !sameRecord(existingAudit, audit)) {
        throw new InvalidRecipePersistenceState(
          `Supersession for ${audit.supersededRecipeVersionId} cannot be overwritten.`
        );
      }
      if (!existingAudit) {
        if (!versions.has(audit.supersededByRecipeVersionId)) {
          throw new InvalidRecipePersistenceState(
            "Supersession target must already be an appended Published Recipe Version."
          );
        }
        supersessions.set(audit.supersededRecipeVersionId, audit);
      }
    }

    const isHistoricalSupersession =
      incoming.recipe.state === "Superseded" &&
      existing.recipe.currentRecipeVersionId !== incoming.recipe.currentRecipeVersionId;
    return {
      recipe: isHistoricalSupersession
        ? Object.freeze({ ...existing.recipe, aggregateVersion: incoming.recipe.aggregateVersion })
        : incoming.recipe,
      currentDraft: isHistoricalSupersession ? existing.currentDraft : incoming.draft,
      currentDraftLines: isHistoricalSupersession
        ? existing.currentDraftLines
        : Object.freeze([...incoming.draftLines]),
      versions,
      supersessions,
      abandonmentAudit: isHistoricalSupersession
        ? existing.abandonmentAudit
        : incoming.abandonmentAudit
    };
  }

  private recordsForCurrent(stored: StoredRecipe): RecipePersistenceRecords {
    if (!stored.recipe.currentRecipeVersionId || stored.recipe.state === "Abandoned") {
      return Object.freeze({
        recipe: stored.recipe,
        draft: stored.currentDraft,
        draftLines: Object.freeze([...stored.currentDraftLines]),
        version: null,
        versionLines: Object.freeze([]),
        publishAudit: null,
        supersessionAudits: Object.freeze([]),
        abandonmentAudit: stored.abandonmentAudit
      });
    }
    const version = stored.versions.get(stored.recipe.currentRecipeVersionId);
    if (!version) {
      throw new InvalidRecipePersistenceState("Current Recipe Version record is missing.");
    }
    return this.recordsForVersion(stored, version);
  }

  private recordsForVersion(stored: StoredRecipe, storedVersion: StoredVersion): RecipePersistenceRecords {
    const supersession = stored.supersessions.get(storedVersion.version.recipeVersionId);
    const state = supersession ? "Superseded" : "Published";
    const draft: RecipeDraftRecord = Object.freeze({
      ...storedVersion.sourceDraft,
      state,
    });
    const recipe: RecipeRecord = Object.freeze({
      recipeId: storedVersion.version.recipeId,
      recipeFamilyId: storedVersion.version.recipeFamilyId,
      productId: storedVersion.version.productId,
      currentDraftId: storedVersion.version.sourceDraftId,
      currentRecipeVersionId: storedVersion.version.recipeVersionId,
      aggregateVersion: stored.recipe.aggregateVersion,
      state
    });
    return Object.freeze({
      recipe,
      draft,
      draftLines: Object.freeze([]),
      version: storedVersion.version,
      versionLines: Object.freeze([...storedVersion.lines]),
      publishAudit: storedVersion.publishAudit,
      supersessionAudits: Object.freeze(supersession ? [supersession] : []),
      abandonmentAudit: null
    });
  }

  private rehydrate(records: RecipePersistenceRecords): VersionedRecipeAggregate {
    return Object.freeze({
      aggregate: this.mapper.fromRecords(records),
      aggregateVersion: records.recipe.aggregateVersion
    });
  }
}
