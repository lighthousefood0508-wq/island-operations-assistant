import { createHash } from "node:crypto";
import type {
  RecipeDraftRecord,
  RecipeLineRecord,
  RecipePublishAuditRecord,
  RecipeSupersessionAuditRecord,
  RecipeVersionRecord
} from "./records.js";

export const RECIPE_RECEIPT_INPUT_VERSION = "recipe-receipt-request-v1" as const;
export const RECIPE_RECEIPT_FINGERPRINT_ALGORITHM = "SHA-256" as const;

export type RecipeReceiptOperation = "FAMILY_CREATE" | "DRAFT_ABANDON" | "RECIPE_PUBLISH";
export type RecipeReceiptScope = "PRODUCT" | "RECIPE_DRAFT" | "RECIPE_FAMILY";

export type ReceiptRequestEvidence = Readonly<{
  operationType: RecipeReceiptOperation;
  scopeType: RecipeReceiptScope;
  scopeId: string;
  idempotencyKey: string;
  canonicalInputVersion: typeof RECIPE_RECEIPT_INPUT_VERSION;
  requestFingerprintAlgorithm: typeof RECIPE_RECEIPT_FINGERPRINT_ALGORITHM;
  requestFingerprint: string;
  receiptCreatedAt: string;
}>;

export type RecipeCreationAuditRecord = Readonly<{
  eventId: string;
  actor: string;
  occurredAt: string;
}>;

export type FamilyCreationPersistenceInput = Readonly<{
  receipt: ReceiptRequestEvidence;
  productId: string;
  productVersionId: string;
  recipeFamilyId: string;
  recipeId: string;
  initialDraftId: string;
  initialDraftName: string;
  instructions: string | null;
  initialLines: readonly RecipeLineRecord[];
  initialAggregateVersion: number;
  creationAudit: RecipeCreationAuditRecord;
}>;

export type FamilyCreationPersistenceResult = Readonly<{
  recipeFamilyId: string;
  recipeId: string;
  initialDraftId: string;
  resultingAggregateVersion: number;
  creationAuditEventId: string;
  receiptCreatedAt: string;
}>;

export type DraftAbandonmentEvidence = Readonly<{
  eventId: string;
  actor: string;
  occurredAt: string;
  reason: string;
  previousAggregateVersion: number;
  resultingAggregateVersion: number;
}>;

export type DraftAbandonmentPersistenceInput = Readonly<{
  receipt: ReceiptRequestEvidence;
  recipeFamilyId: string;
  recipeId: string;
  draftId: string;
  expectedCurrentDraftId: string;
  expectedAggregateVersion: number;
  abandonment: DraftAbandonmentEvidence;
}>;

export type DraftAbandonmentPersistenceResult = Readonly<{
  recipeFamilyId: string;
  recipeId: string;
  draftId: string;
  state: "Abandoned";
  abandonmentEventId: string;
  resultingAggregateVersion: number;
  currentRecipeVersionId: string | null;
  receiptCreatedAt: string;
}>;

export type PublishedVersionPersistenceSnapshot = Readonly<{
  version: RecipeVersionRecord;
  lines: readonly RecipeLineRecord[];
}>;

export type RecipePublicationAuditRecord = RecipePublishAuditRecord & Readonly<{
  reason: string;
}>;

export type RecipePublicationPersistenceInput = Readonly<{
  receipt: ReceiptRequestEvidence;
  recipeFamilyId: string;
  recipeId: string;
  sourceDraftId: string;
  expectedAggregateVersion: number;
  expectedCurrentRecipeVersionId: string | null;
  publishedVersionSnapshot: PublishedVersionPersistenceSnapshot;
  publicationAudit: RecipePublicationAuditRecord;
  supersessionAudit: RecipeSupersessionAuditRecord | null;
  resultingCurrentRecipeVersionId: string;
  resultingAggregateVersion: number;
}>;

export type RecipePublicationPersistenceResult = Readonly<{
  recipeFamilyId: string;
  recipeId: string;
  sourceDraftId: string;
  recipeVersionId: string;
  versionNumber: number;
  currentRecipeVersionId: string;
  resultingAggregateVersion: number;
  publicationAuditEventId: string;
  supersessionAuditEventId: string | null;
  receiptCreatedAt: string;
}>;

export interface RecipePersistenceUnitOfWork {
  createFamilyWithInitialDraft(input: FamilyCreationPersistenceInput): FamilyCreationPersistenceResult;
  abandonDraft(input: DraftAbandonmentPersistenceInput): DraftAbandonmentPersistenceResult;
  publishRecipeVersion(input: RecipePublicationPersistenceInput): RecipePublicationPersistenceResult;
}

type FrameValue =
  | Readonly<{ type: "S"; value: string }>
  | Readonly<{ type: "I"; value: number }>
  | Readonly<{ type: "N" | "M" }>;

function frame(name: string, field: FrameValue): string {
  const nameLength = Buffer.byteLength(name, "utf8");
  const value = field.type === "S" ? field.value : field.type === "I" ? String(field.value) : "";
  return `${nameLength}:${name}${field.type}${Buffer.byteLength(value, "utf8")}:${value}`;
}

function string(value: string): FrameValue { return { type: "S", value }; }
function integer(value: number): FrameValue {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Canonical Recipe receipt integers must be non-negative safe integers.");
  }
  return { type: "I", value };
}
function nullable(value: string | null): FrameValue { return value === null ? { type: "N" } : string(value); }
function optional(value: string | null): FrameValue { return value === null ? { type: "M" } : string(value); }

function digest(fields: readonly (readonly [string, FrameValue])[]): string {
  const framed = fields.map(([name, value]) => frame(name, value)).join("");
  return createHash("sha256").update(Buffer.from(framed, "utf8")).digest("hex");
}

function quantityFields(prefix: string, line: RecipeLineRecord): readonly (readonly [string, FrameValue])[] {
  return [
    [`${prefix}QuantityCoefficient`, string(line.quantity.coefficient)],
    [`${prefix}QuantityScale`, integer(line.quantity.scale)],
    [`${prefix}QuantityUnitCode`, string(line.quantity.unitCode)],
    [`${prefix}QuantityDimension`, string(line.quantity.measurementDimension)]
  ];
}

function lineFields(
  lines: readonly RecipeLineRecord[],
  includeLineId: boolean
): readonly (readonly [string, FrameValue])[] {
  const fields: (readonly [string, FrameValue])[] = [["lineCount", integer(lines.length)]];
  lines.forEach((line, index) => {
    const prefix = `line${index}`;
    fields.push([`${prefix}Position`, integer(line.position)]);
    if (includeLineId) fields.push([`${prefix}RecipeLineId`, string(line.recipeLineId)]);
    fields.push(
      [`${prefix}IngredientId`, string(line.ingredientReferenceId)],
      [`${prefix}IngredientName`, string(line.ingredientCanonicalName)],
      [`${prefix}IngredientDimension`, string(line.ingredientMeasurementDimension)],
      [`${prefix}IngredientStatus`, string(line.ingredientStatus)],
      [`${prefix}IngredientCreatedAt`, string(line.ingredientCreatedAt)],
      ...quantityFields(prefix, line),
      [`${prefix}PreparationNote`, optional(line.preparationNote)]
    );
  });
  return fields;
}

export function familyCreationContentDigest(input: FamilyCreationPersistenceInput): string {
  return digest([
    ["name", string(input.initialDraftName)],
    ["productId", string(input.productId)],
    ["productVersionId", string(input.productVersionId)],
    ["instructions", nullable(input.instructions)],
    ["standardOutput", { type: "M" }],
    ["standardYield", { type: "M" }],
    ...lineFields(input.initialLines, false)
  ]);
}

export function publicationContentDigest(input: RecipePublicationPersistenceInput): string {
  const version = input.publishedVersionSnapshot.version;
  const quantity = (prefix: string, value: RecipeVersionRecord["standardOutput"]): readonly (readonly [string, FrameValue])[] => [
    [`${prefix}Coefficient`, string(value.coefficient)],
    [`${prefix}Scale`, integer(value.scale)],
    [`${prefix}UnitCode`, string(value.unitCode)],
    [`${prefix}Dimension`, string(value.measurementDimension)]
  ];
  return digest([
    ["name", string(version.name)],
    ["productId", string(version.productId)],
    ["productVersionId", string(version.productVersionId)],
    ["instructions", nullable(version.instructions)],
    ...quantity("standardOutput", version.standardOutput),
    ...quantity("standardYield", version.standardYield),
    ...lineFields(input.publishedVersionSnapshot.lines, true)
  ]);
}

export function expectedRecipeReceiptFingerprint(
  input: FamilyCreationPersistenceInput | DraftAbandonmentPersistenceInput | RecipePublicationPersistenceInput
): string {
  const version: readonly [string, FrameValue] = ["canonicalInputVersion", string(RECIPE_RECEIPT_INPUT_VERSION)];
  if (input.receipt.operationType === "FAMILY_CREATE") {
    const create = input as FamilyCreationPersistenceInput;
    return digest([version,
      ["operation", string("FAMILY_CREATE")], ["scopeType", string("PRODUCT")],
      ["productId", string(create.productId)], ["productVersionId", string(create.productVersionId)],
      ["draftName", string(create.initialDraftName)],
      ["initialDraftContentDigest", string(familyCreationContentDigest(create))],
      ["actor", string(create.creationAudit.actor)]
    ]);
  }
  if (input.receipt.operationType === "DRAFT_ABANDON") {
    const abandon = input as DraftAbandonmentPersistenceInput;
    return digest([version,
      ["operation", string("DRAFT_ABANDON")], ["scopeType", string("RECIPE_DRAFT")],
      ["recipeFamilyId", string(abandon.recipeFamilyId)], ["recipeId", string(abandon.recipeId)],
      ["draftId", string(abandon.draftId)], ["expectedAggregateVersion", integer(abandon.expectedAggregateVersion)],
      ["actor", string(abandon.abandonment.actor)], ["reason", string(abandon.abandonment.reason)]
    ]);
  }
  const publish = input as RecipePublicationPersistenceInput;
  return digest([version,
    ["operation", string("RECIPE_PUBLISH")], ["scopeType", string("RECIPE_FAMILY")],
    ["recipeFamilyId", string(publish.recipeFamilyId)], ["recipeId", string(publish.recipeId)],
    ["draftId", string(publish.sourceDraftId)], ["expectedAggregateVersion", integer(publish.expectedAggregateVersion)],
    ["expectedCurrentRecipeVersionId", nullable(publish.expectedCurrentRecipeVersionId)],
    ["publicationContentDigest", string(publicationContentDigest(publish))],
    ["actor", string(publish.publicationAudit.actor)], ["reason", string(publish.publicationAudit.reason)]
  ]);
}
