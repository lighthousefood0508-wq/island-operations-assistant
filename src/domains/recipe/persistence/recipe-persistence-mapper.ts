import { IngredientReference } from "../domain/ingredient-reference.js";
import {
  IngredientReferenceId,
  RecipeDraftId,
  RecipeFamilyId,
  RecipeId,
  RecipeLineId,
  RecipeVersionId
} from "../domain/identities.js";
import { Quantity } from "../domain/quantity.js";
import { RecipeAggregate } from "../domain/recipe-aggregate.js";
import { Unit } from "../domain/unit.js";
import { VersionNumber } from "../domain/version-number.js";
import { InvalidRecipePersistenceState } from "./errors.js";
import type {
  ExactQuantityRecord,
  RecipeLineRecord,
  RecipeAbandonmentAuditRecord,
  RecipePersistenceRecords,
  RecipePublishAuditRecord,
  RecipeSupersessionAuditRecord,
  RecipeVersionRecord
} from "./records.js";

const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/;

function exactQuantityToRecord(quantity: Quantity): ExactQuantityRecord {
  return Object.freeze({
    coefficient: quantity.coefficient.toString(),
    scale: quantity.scale,
    unitCode: quantity.unit.code,
    measurementDimension: quantity.unit.dimension
  });
}

function exactQuantityFromRecord(record: ExactQuantityRecord, label: string): Quantity {
  if (!POSITIVE_INTEGER_PATTERN.test(record.coefficient)) {
    throw new InvalidRecipePersistenceState(`${label} coefficient must be a canonical positive integer string.`);
  }
  try {
    return Quantity.create(
      BigInt(record.coefficient),
      record.scale,
      Unit.create(record.unitCode, record.measurementDimension)
    );
  } catch (error) {
    throw new InvalidRecipePersistenceState(`${label} is invalid.`, error);
  }
}

function lineToRecord(
  line: ReturnType<RecipeAggregate["snapshot"]>["lines"][number],
  ownerType: RecipeLineRecord["ownerType"],
  ownerId: string,
  position: number
): RecipeLineRecord {
  return Object.freeze({
    ownerType,
    ownerId,
    position,
    recipeLineId: line.recipeLineId.value,
    ingredientReferenceId: line.ingredient.ingredientReferenceId.value,
    ingredientCanonicalName: line.ingredient.canonicalName,
    ingredientMeasurementDimension: line.ingredient.measurementDimension,
    ingredientStatus: line.ingredient.status,
    ingredientCreatedAt: line.ingredient.createdAt,
    quantity: exactQuantityToRecord(line.quantity),
    preparationNote: line.preparationNote
  });
}

function assertAggregateVersion(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new InvalidRecipePersistenceState("Aggregate version must be a positive safe integer.");
  }
}

function orderedLines(
  records: readonly RecipeLineRecord[],
  ownerType: RecipeLineRecord["ownerType"],
  ownerId: string
): readonly RecipeLineRecord[] {
  const matching = records.filter((record) => record.ownerType === ownerType && record.ownerId === ownerId);
  const sorted = [...matching].sort((left, right) => left.position - right.position);
  if (
    sorted.length !== records.length ||
    sorted.some((record, index) => record.position !== index)
  ) {
    throw new InvalidRecipePersistenceState(`${ownerType} Recipe Lines must have contiguous positions and matching owner identity.`);
  }
  return sorted;
}

export class RecipePersistenceMapper {
  toRecords(aggregate: RecipeAggregate, aggregateVersion: number): RecipePersistenceRecords {
    assertAggregateVersion(aggregateVersion);
    const snapshot = aggregate.snapshot();
    const currentRecipeVersionId = snapshot.publication?.recipeVersionId.value ?? null;
    const draftLines = snapshot.lines.map((line, index) =>
      lineToRecord(line, "draft", snapshot.draftId.value, index)
    );

    let version: RecipeVersionRecord | null = null;
    let versionLines: readonly RecipeLineRecord[] = [];
    let publishAudit: RecipePublishAuditRecord | null = null;
    let supersessionAudits: readonly RecipeSupersessionAuditRecord[] = [];

    if (snapshot.publication) {
      if (!snapshot.product || !snapshot.standardOutput || !snapshot.standardYield) {
        throw new InvalidRecipePersistenceState("Published Recipe snapshot is missing required publication content.");
      }
      version = Object.freeze({
        recipeVersionId: snapshot.publication.recipeVersionId.value,
        recipeId: snapshot.recipeId.value,
        recipeFamilyId: snapshot.recipeFamilyId.value,
        sourceDraftId: snapshot.draftId.value,
        versionNumber: snapshot.publication.versionNumber.value,
        state: snapshot.state === "Superseded" ? "Superseded" : "Published",
        name: snapshot.name,
        productId: snapshot.product.productId,
        productVersionId: snapshot.product.productVersionId,
        instructions: snapshot.instructions,
        standardOutput: exactQuantityToRecord(snapshot.standardOutput),
        standardYield: exactQuantityToRecord(snapshot.standardYield),
        publishedBy: snapshot.publication.publishedBy,
        publishedAt: snapshot.publication.publishedAt
      });
      versionLines = Object.freeze(snapshot.lines.map((line, index) =>
        lineToRecord(line, "version", snapshot.publication!.recipeVersionId.value, index)
      ));
      publishAudit = Object.freeze({
        eventKey: `publish:${snapshot.publication.recipeVersionId.value}`,
        recipeId: snapshot.recipeId.value,
        draftId: snapshot.draftId.value,
        recipeVersionId: snapshot.publication.recipeVersionId.value,
        versionNumber: snapshot.publication.versionNumber.value,
        actor: snapshot.publication.publishedBy,
        occurredAt: snapshot.publication.publishedAt
      });
    }

    if (snapshot.supersession && snapshot.publication) {
      supersessionAudits = Object.freeze([Object.freeze({
        eventKey: `supersede:${snapshot.publication.recipeVersionId.value}:${snapshot.supersession.supersededByRecipeVersionId.value}`,
        recipeId: snapshot.recipeId.value,
        supersededRecipeVersionId: snapshot.publication.recipeVersionId.value,
        supersededByRecipeVersionId: snapshot.supersession.supersededByRecipeVersionId.value,
        actor: snapshot.supersession.supersededBy,
        occurredAt: snapshot.supersession.supersededAt,
        reason: snapshot.supersession.reason
      })]);
    }

    return Object.freeze({
      recipe: Object.freeze({
        recipeId: snapshot.recipeId.value,
        recipeFamilyId: snapshot.recipeFamilyId.value,
        productId: snapshot.product?.productId ?? null,
        currentDraftId: snapshot.draftId.value,
        currentRecipeVersionId,
        aggregateVersion,
        state: snapshot.state
      }),
      draft: Object.freeze({
        draftId: snapshot.draftId.value,
        recipeId: snapshot.recipeId.value,
        recipeFamilyId: snapshot.recipeFamilyId.value,
        name: snapshot.name,
        state: snapshot.state,
        productId: snapshot.product?.productId ?? null,
        productVersionId: snapshot.product?.productVersionId ?? null,
        instructions: snapshot.instructions,
        standardOutput: snapshot.standardOutput ? exactQuantityToRecord(snapshot.standardOutput) : null,
        standardYield: snapshot.standardYield ? exactQuantityToRecord(snapshot.standardYield) : null,
        createdBy: snapshot.createdBy,
        createdAt: snapshot.createdAt
      }),
      draftLines: Object.freeze(draftLines),
      version,
      versionLines,
      publishAudit,
      supersessionAudits,
      abandonmentAudit: snapshot.abandonment === null ? null : Object.freeze({
        eventKey: `abandon:${snapshot.draftId.value}:${snapshot.abandonment.resultingAggregateVersion}`,
        recipeFamilyId: snapshot.recipeFamilyId.value,
        recipeId: snapshot.recipeId.value,
        draftId: snapshot.draftId.value,
        actor: snapshot.abandonment.actor,
        occurredAt: snapshot.abandonment.occurredAt,
        reason: snapshot.abandonment.reason,
        previousAggregateVersion: snapshot.abandonment.previousAggregateVersion,
        resultingAggregateVersion: snapshot.abandonment.resultingAggregateVersion
      } satisfies RecipeAbandonmentAuditRecord)
    });
  }

  fromRecords(records: RecipePersistenceRecords): RecipeAggregate {
    try {
      this.validateRecordGraph(records);
      const recipeId = RecipeId.parse(records.recipe.recipeId);
      const draftId = RecipeDraftId.parse(records.draft.draftId);
      const version = records.version;
      const aggregate = RecipeAggregate.createDraft({
        recipeFamilyId: RecipeFamilyId.parse(records.recipe.recipeFamilyId),
        recipeId,
        draftId,
        name: version?.name ?? records.draft.name,
        createdBy: records.draft.createdBy,
        createdAt: records.draft.createdAt
      });

      const productId = version?.productId ?? records.draft.productId;
      const productVersionId = version?.productVersionId ?? records.draft.productVersionId;
      if (productId && productVersionId) {
        aggregate.bindProduct(productId, productVersionId);
      }

      const lineRecords = records.recipe.state === "Draft" || records.recipe.state === "Abandoned"
        ? orderedLines(records.draftLines, "draft", records.draft.draftId)
        : orderedLines(records.versionLines, "version", records.version!.recipeVersionId);

      for (const line of lineRecords) {
        const ingredient = IngredientReference.create({
          ingredientReferenceId: IngredientReferenceId.parse(line.ingredientReferenceId),
          canonicalName: line.ingredientCanonicalName,
          measurementDimension: line.ingredientMeasurementDimension,
          status: line.ingredientStatus,
          createdAt: line.ingredientCreatedAt
        });
        aggregate.addLine({
          recipeLineId: RecipeLineId.parse(line.recipeLineId),
          ingredient,
          quantity: exactQuantityFromRecord(line.quantity, `Recipe Line ${line.position}`),
          preparationNote: line.preparationNote
        });
      }

      const standardOutput = version?.standardOutput ?? records.draft.standardOutput;
      const standardYield = version?.standardYield ?? records.draft.standardYield;
      if (standardOutput && standardYield) {
        aggregate.defineStandardOutput(
          exactQuantityFromRecord(standardOutput, "Standard Output"),
          exactQuantityFromRecord(standardYield, "Standard Yield")
        );
      }

      aggregate.setInstructions(version?.instructions ?? records.draft.instructions);

      if (records.recipe.state === "Abandoned") {
        const audit = records.abandonmentAudit!;
        aggregate.abandon({
          actor: audit.actor,
          occurredAt: audit.occurredAt,
          reason: audit.reason,
          previousAggregateVersion: audit.previousAggregateVersion
        });
      }

      if (records.recipe.state === "Published" || records.recipe.state === "Superseded") {
        const version = records.version!;
        aggregate.publish({
          recipeVersionId: RecipeVersionId.parse(version.recipeVersionId),
          versionNumber: VersionNumber.create(version.versionNumber),
          publishedBy: version.publishedBy,
          publishedAt: version.publishedAt
        });
      }

      if (records.recipe.state === "Superseded") {
        const audit = records.supersessionAudits[0]!;
        aggregate.supersede({
          supersededByRecipeVersionId: RecipeVersionId.parse(audit.supersededByRecipeVersionId),
          supersededBy: audit.actor,
          supersededAt: audit.occurredAt,
          reason: audit.reason
        });
      }

      return aggregate;
    } catch (error) {
      if (error instanceof InvalidRecipePersistenceState) {
        throw error;
      }
      throw new InvalidRecipePersistenceState("Recipe persistence records failed Domain rehydration.", error);
    }
  }

  private validateRecordGraph(records: RecipePersistenceRecords): void {
    assertAggregateVersion(records.recipe.aggregateVersion);
    if (
      records.recipe.recipeId !== records.draft.recipeId ||
      records.recipe.recipeFamilyId !== records.draft.recipeFamilyId ||
      records.recipe.currentDraftId !== records.draft.draftId ||
      records.recipe.state !== records.draft.state
    ) {
      throw new InvalidRecipePersistenceState("Recipe and Draft record identities or states do not agree.");
    }
    if ((records.draft.productId === null) !== (records.draft.productVersionId === null)) {
      throw new InvalidRecipePersistenceState("Product and Product Version references must both be present or absent.");
    }
    if ((records.draft.standardOutput === null) !== (records.draft.standardYield === null)) {
      throw new InvalidRecipePersistenceState("Standard Output and Standard Yield must both be present or absent.");
    }

    if (records.recipe.state === "Draft" || records.recipe.state === "Abandoned") {
      if (
        records.recipe.currentRecipeVersionId !== null ||
        records.version !== null ||
        records.versionLines.length !== 0 ||
        records.publishAudit !== null ||
        records.supersessionAudits.length !== 0
      ) {
        throw new InvalidRecipePersistenceState("Unpublished records cannot contain Published or Superseded facts.");
      }
      if ((records.recipe.state === "Abandoned") !== (records.abandonmentAudit !== null)) {
        throw new InvalidRecipePersistenceState("Abandoned records require exactly one matching abandonment audit.");
      }
      if (records.abandonmentAudit !== null && (
        records.abandonmentAudit.recipeFamilyId !== records.recipe.recipeFamilyId
        || records.abandonmentAudit.recipeId !== records.recipe.recipeId
        || records.abandonmentAudit.draftId !== records.draft.draftId
        || records.abandonmentAudit.resultingAggregateVersion !== records.recipe.aggregateVersion
      )) throw new InvalidRecipePersistenceState("Abandonment audit facts do not agree with the Recipe record.");
      orderedLines(records.draftLines, "draft", records.draft.draftId);
      return;
    }

    if (records.abandonmentAudit !== null) {
      throw new InvalidRecipePersistenceState("Published records cannot contain abandonment evidence.");
    }

    if (!records.version || !records.publishAudit || !records.recipe.currentRecipeVersionId) {
      throw new InvalidRecipePersistenceState("Published records require Version and Publish Audit facts.");
    }
    this.validateVersion(records.version, records.publishAudit, records);
    orderedLines(records.versionLines, "version", records.version.recipeVersionId);

    if (records.recipe.state === "Published" && records.supersessionAudits.length !== 0) {
      throw new InvalidRecipePersistenceState("Published records cannot contain Supersession facts.");
    }
    if (records.recipe.state === "Superseded") {
      if (records.supersessionAudits.length !== 1) {
        throw new InvalidRecipePersistenceState("Superseded records require exactly one Supersession Audit.");
      }
      const audit = records.supersessionAudits[0]!;
      if (
        audit.recipeId !== records.recipe.recipeId ||
        audit.supersededRecipeVersionId !== records.version.recipeVersionId ||
        audit.supersededByRecipeVersionId === records.version.recipeVersionId
      ) {
        throw new InvalidRecipePersistenceState("Supersession relationship is invalid.");
      }
    }
  }

  private validateVersion(
    version: RecipeVersionRecord,
    audit: RecipePublishAuditRecord,
    records: RecipePersistenceRecords
  ): void {
    if (
      version.recipeId !== records.recipe.recipeId ||
      version.recipeFamilyId !== records.recipe.recipeFamilyId ||
      version.sourceDraftId !== records.draft.draftId ||
      version.recipeVersionId !== records.recipe.currentRecipeVersionId ||
      audit.recipeId !== version.recipeId ||
      audit.draftId !== version.sourceDraftId ||
      audit.recipeVersionId !== version.recipeVersionId ||
      audit.versionNumber !== version.versionNumber ||
      audit.actor !== version.publishedBy ||
      audit.occurredAt !== version.publishedAt ||
      records.draft.productId !== version.productId ||
      records.draft.productVersionId !== version.productVersionId ||
      JSON.stringify(records.draft.standardOutput) !== JSON.stringify(version.standardOutput) ||
      JSON.stringify(records.draft.standardYield) !== JSON.stringify(version.standardYield)
    ) {
      throw new InvalidRecipePersistenceState("Version, Draft, Recipe, and Publish Audit facts do not agree.");
    }
    exactQuantityFromRecord(version.standardOutput, "Version Standard Output");
    exactQuantityFromRecord(version.standardYield, "Version Standard Yield");
  }
}
