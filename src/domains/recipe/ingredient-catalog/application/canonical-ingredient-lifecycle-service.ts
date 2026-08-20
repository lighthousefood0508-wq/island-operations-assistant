import type {
  ArchiveCanonicalIngredientCommandV1,
  ArchiveCanonicalIngredientResultV1,
  CanonicalIngredientDuplicateCandidateV1,
  CanonicalIngredientDuplicateWarningV1,
  RenameCanonicalIngredientCommandV1,
  RenameCanonicalIngredientResultV1,
  ReactivateCanonicalIngredientCommandV1,
  ReactivateCanonicalIngredientResultV1
} from "../../contracts/canonical-ingredient-management-contract.js";
import type { CanonicalIngredient } from "../canonical-ingredient.js";
import type {
  CanonicalIngredientRepository
} from "../canonical-ingredient-repository.js";
import {
  CanonicalIngredientVersionConflict,
  InvalidCanonicalIngredientAuditEvidence,
  InvalidCanonicalIngredientName,
  InvalidCanonicalIngredientTransition
} from "../errors.js";
import { CanonicalIngredientId } from "../identities.js";
import {
  CanonicalIngredientAlreadyArchived,
  CanonicalIngredientNotArchived,
  CanonicalIngredientArchivedRenameRejected,
  CanonicalIngredientLifecycleNotFound,
  CanonicalIngredientLifecyclePersistenceFailure,
  CanonicalIngredientLifecycleValidationFailure,
  CanonicalIngredientLifecycleVersionConflict,
  InvalidCanonicalIngredientLifecycleTransition
} from "./errors.js";

type CanonicalIngredientLifecycleRepository = Pick<
  CanonicalIngredientRepository,
  "findById" | "findDuplicateCandidates" | "saveWithExpectedVersion"
>;

type AuditCommand = Readonly<{
  actor: string;
  occurredAt: string;
  reason: string;
}>;

function validationFailure(): never {
  throw new CanonicalIngredientLifecycleValidationFailure();
}

function parseIngredientId(value: string): CanonicalIngredientId {
  try {
    return CanonicalIngredientId.parse(value);
  } catch {
    return validationFailure();
  }
}

function validateExpectedVersion(expectedVersion: number): void {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
    validationFailure();
  }
}

function requireText(value: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    validationFailure();
  }
}

function latestAuditInstant(ingredient: CanonicalIngredient): string {
  return ingredient.renameHistory.at(-1)?.renamedAt ?? ingredient.createdAt;
}

function validateOccurredAt(
  occurredAt: string,
  ingredient: CanonicalIngredient
): void {
  if (typeof occurredAt !== "string") {
    validationFailure();
  }
  const milliseconds = Date.parse(occurredAt);
  if (
    !Number.isFinite(milliseconds)
    || new Date(milliseconds).toISOString() !== occurredAt
    || milliseconds < Date.parse(latestAuditInstant(ingredient))
  ) {
    validationFailure();
  }
}

function validateAudit(
  command: AuditCommand,
  ingredient: CanonicalIngredient
): void {
  requireText(command.actor);
  validateOccurredAt(command.occurredAt, ingredient);
  requireText(command.reason);
}

function validateRename(
  command: RenameCanonicalIngredientCommandV1,
  ingredient: CanonicalIngredient
): void {
  if (
    typeof command.newName !== "string"
    || command.newName.trim().length === 0
    || command.newName.trim() === ingredient.name
  ) {
    validationFailure();
  }
  validateAudit(command, ingredient);
}

function mapDomainFailure(error: unknown): never {
  if (
    error instanceof InvalidCanonicalIngredientName
    || error instanceof InvalidCanonicalIngredientAuditEvidence
  ) {
    throw new CanonicalIngredientLifecycleValidationFailure();
  }
  if (error instanceof InvalidCanonicalIngredientTransition) {
    throw new InvalidCanonicalIngredientLifecycleTransition();
  }
  throw new InvalidCanonicalIngredientLifecycleTransition();
}

function duplicateCandidate(
  ingredient: CanonicalIngredient
): CanonicalIngredientDuplicateCandidateV1 {
  const contract = ingredient.toContract();
  return {
    ingredientId: contract.ingredientId,
    name: contract.name,
    status: contract.status
  };
}

export class CanonicalIngredientLifecycleService {
  constructor(private readonly repository: CanonicalIngredientLifecycleRepository) {}

  rename(
    command: RenameCanonicalIngredientCommandV1
  ): RenameCanonicalIngredientResultV1 {
    const ingredient = this.load(command.ingredientId);
    this.validateVersion(command.expectedVersion, ingredient);
    if (ingredient.status === "Archived") {
      throw new CanonicalIngredientArchivedRenameRejected();
    }
    validateRename(command, ingredient);

    let duplicateIngredients: readonly CanonicalIngredient[];
    try {
      duplicateIngredients = this.repository.findDuplicateCandidates(
        command.newName
      );
    } catch {
      throw new CanonicalIngredientLifecyclePersistenceFailure();
    }
    const candidates = duplicateIngredients
      .filter((candidate) => !candidate.ingredientId.equals(ingredient.ingredientId))
      .map(duplicateCandidate);
    const warnings: readonly CanonicalIngredientDuplicateWarningV1[] =
      candidates.length === 0
        ? []
        : [{ code: "DUPLICATE_NAME_WARNING", candidates }];

    let renamed: CanonicalIngredient;
    try {
      renamed = ingredient.rename(command.newName, {
        actorId: command.actor,
        occurredAt: command.occurredAt,
        reason: command.reason
      });
    } catch (error) {
      return mapDomainFailure(error);
    }
    this.save(renamed, command.expectedVersion);
    return { ingredient: renamed.toContract(), warnings };
  }

  archive(
    command: ArchiveCanonicalIngredientCommandV1
  ): ArchiveCanonicalIngredientResultV1 {
    const ingredient = this.load(command.ingredientId);
    this.validateVersion(command.expectedVersion, ingredient);
    if (ingredient.status === "Archived") {
      throw new CanonicalIngredientAlreadyArchived();
    }
    validateAudit(command, ingredient);

    let archived: CanonicalIngredient;
    try {
      archived = ingredient.archive({
        actorId: command.actor,
        occurredAt: command.occurredAt,
        reason: command.reason
      });
    } catch (error) {
      return mapDomainFailure(error);
    }
    this.save(archived, command.expectedVersion);
    return { ingredient: archived.toContract() };
  }

  reactivate(
    command: ReactivateCanonicalIngredientCommandV1
  ): ReactivateCanonicalIngredientResultV1 {
    const ingredient = this.load(command.ingredientId);
    this.validateVersion(command.expectedVersion, ingredient);
    if (ingredient.status !== "Archived") {
      throw new CanonicalIngredientNotArchived();
    }
    validateAudit(command, ingredient);
    let reactivated: CanonicalIngredient;
    try {
      reactivated = ingredient.reactivate({
        actorId: command.actor,
        occurredAt: command.occurredAt,
        reason: command.reason
      });
    } catch (error) {
      return mapDomainFailure(error);
    }
    this.save(reactivated, command.expectedVersion);
    return { ingredient: reactivated.toContract() };
  }

  private load(ingredientId: string): CanonicalIngredient {
    const identity = parseIngredientId(ingredientId);
    let ingredient: CanonicalIngredient | undefined;
    try {
      ingredient = this.repository.findById(identity);
    } catch {
      throw new CanonicalIngredientLifecyclePersistenceFailure();
    }
    if (ingredient === undefined) {
      throw new CanonicalIngredientLifecycleNotFound();
    }
    return ingredient;
  }

  private validateVersion(
    expectedVersion: number,
    ingredient: CanonicalIngredient
  ): void {
    validateExpectedVersion(expectedVersion);
    if (ingredient.aggregateVersion !== expectedVersion) {
      throw new CanonicalIngredientLifecycleVersionConflict();
    }
  }

  private save(
    ingredient: CanonicalIngredient,
    expectedVersion: number
  ): void {
    try {
      this.repository.saveWithExpectedVersion(ingredient, expectedVersion);
    } catch (error) {
      if (error instanceof CanonicalIngredientVersionConflict) {
        throw new CanonicalIngredientLifecycleVersionConflict();
      }
      throw new CanonicalIngredientLifecyclePersistenceFailure();
    }
  }
}
