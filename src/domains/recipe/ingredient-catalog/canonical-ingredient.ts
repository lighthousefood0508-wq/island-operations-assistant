import {
  CANONICAL_INGREDIENT_CONTRACT_VERSION,
  type CanonicalIngredientArchiveFactV1,
  type CanonicalIngredientContractV1,
  type CanonicalIngredientRenameFactV1,
  type CanonicalIngredientStatusV1
} from "../contracts/canonical-ingredient-contract.js";
import {
  InvalidCanonicalIngredientAuditEvidence,
  InvalidCanonicalIngredientName,
  InvalidCanonicalIngredientTransition
} from "./errors.js";
import { CanonicalIngredientId } from "./identities.js";
import { IngredientCategory } from "./ingredient-category.js";

type AuditInput = Readonly<{
  occurredAt: string;
  actorId: string;
  reason: string;
}>;

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new InvalidCanonicalIngredientAuditEvidence(field);
  }
  return normalized;
}

function requireInstant(value: string, field: string): string {
  const milliseconds = Date.parse(value);
  if (
    !Number.isFinite(milliseconds)
    || new Date(milliseconds).toISOString() !== value
  ) {
    throw new InvalidCanonicalIngredientAuditEvidence(field);
  }
  return value;
}

function requireName(value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new InvalidCanonicalIngredientName();
  }
  return normalized;
}

function freezeRenameFact(
  fact: CanonicalIngredientRenameFactV1
): CanonicalIngredientRenameFactV1 {
  return Object.freeze({ ...fact });
}

function freezeArchiveFact(
  fact: CanonicalIngredientArchiveFactV1 | undefined
): CanonicalIngredientArchiveFactV1 | undefined {
  return fact === undefined ? undefined : Object.freeze({ ...fact });
}

export class CanonicalIngredient {
  private constructor(
    readonly ingredientId: CanonicalIngredientId,
    readonly name: string,
    readonly category: IngredientCategory,
    readonly status: CanonicalIngredientStatusV1,
    readonly aggregateVersion: number,
    readonly createdAt: string,
    readonly createdBy: string,
    readonly renameHistory: readonly CanonicalIngredientRenameFactV1[],
    readonly archiveFact?: CanonicalIngredientArchiveFactV1
  ) {
    Object.freeze(this);
  }

  static create(input: {
    ingredientId: CanonicalIngredientId;
    name: string;
    category: IngredientCategory;
    createdAt: string;
    createdBy: string;
  }): CanonicalIngredient {
    return new CanonicalIngredient(
      input.ingredientId,
      requireName(input.name),
      input.category,
      "Active",
      0,
      requireInstant(input.createdAt, "createdAt"),
      requireText(input.createdBy, "createdBy"),
      Object.freeze([])
    );
  }

  rename(newName: string, audit: AuditInput): CanonicalIngredient {
    if (this.status !== "Active") {
      throw new InvalidCanonicalIngredientTransition(this.status, "RENAME");
    }
    const normalizedName = requireName(newName);
    if (normalizedName === this.name) {
      throw new InvalidCanonicalIngredientName(
        "Canonical Ingredient rename must change the authoritative name."
      );
    }
    const renamedAt = requireInstant(audit.occurredAt, "renamedAt");
    if (Date.parse(renamedAt) < Date.parse(this.latestAuditInstant())) {
      throw new InvalidCanonicalIngredientAuditEvidence("renamedAt ordering");
    }
    const fact = freezeRenameFact({
      previousName: this.name,
      newName: normalizedName,
      renamedAt,
      renamedBy: requireText(audit.actorId, "renamedBy"),
      reason: requireText(audit.reason, "rename reason")
    });
    return new CanonicalIngredient(
      this.ingredientId,
      normalizedName,
      this.category,
      this.status,
      this.aggregateVersion + 1,
      this.createdAt,
      this.createdBy,
      Object.freeze([...this.renameHistory, fact])
    );
  }

  archive(audit: AuditInput): CanonicalIngredient {
    if (this.status !== "Active") {
      throw new InvalidCanonicalIngredientTransition(this.status, "ARCHIVE");
    }
    const archivedAt = requireInstant(audit.occurredAt, "archivedAt");
    if (Date.parse(archivedAt) < Date.parse(this.latestAuditInstant())) {
      throw new InvalidCanonicalIngredientAuditEvidence("archivedAt ordering");
    }
    const fact = freezeArchiveFact({
      archivedAt,
      archivedBy: requireText(audit.actorId, "archivedBy"),
      reason: requireText(audit.reason, "archive reason")
    });
    return new CanonicalIngredient(
      this.ingredientId,
      this.name,
      this.category,
      "Archived",
      this.aggregateVersion + 1,
      this.createdAt,
      this.createdBy,
      this.renameHistory,
      fact
    );
  }

  toContract(): CanonicalIngredientContractV1 {
    return Object.freeze({
      contractVersion: CANONICAL_INGREDIENT_CONTRACT_VERSION,
      ingredientId: this.ingredientId.value,
      name: this.name,
      categoryCode: this.category.code,
      status: this.status,
      aggregateVersion: this.aggregateVersion,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      renameHistory: Object.freeze(
        this.renameHistory.map((fact) => freezeRenameFact(fact))
      ),
      ...(this.archiveFact === undefined
        ? {}
        : { archiveFact: freezeArchiveFact(this.archiveFact) })
    });
  }

  private latestAuditInstant(): string {
    return this.renameHistory.at(-1)?.renamedAt ?? this.createdAt;
  }
}
