import {
  CanonicalIngredientAlreadyArchived,
  CanonicalIngredientArchivedRenameRejected,
  CanonicalIngredientLifecycleNotFound,
  CanonicalIngredientLifecyclePersistenceFailure,
  CanonicalIngredientLifecycleService,
  CanonicalIngredientLifecycleValidationFailure,
  CanonicalIngredientLifecycleVersionConflict,
  CanonicalIngredientManagementReadService,
  InvalidCanonicalIngredientLifecycleTransition,
  type ArchiveCanonicalIngredientCommandV1,
  type ArchiveCanonicalIngredientResultV1,
  type CanonicalIngredientManagementRecordV1,
  type RenameCanonicalIngredientCommandV1,
  type RenameCanonicalIngredientResultV1
} from "../../domains/recipe/index.js";
import { HttpError } from "../../shared/errors/http-error.js";

function validationFailure(field: string): never {
  throw new HttpError(
    422,
    "CANONICAL_INGREDIENT_VALIDATION_FAILURE",
    "Canonical Ingredient lifecycle command validation failed.",
    { field }
  );
}

function fieldValue(input: unknown, field: string): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return validationFailure("body");
  }
  return (input as Record<string, unknown>)[field];
}

function requiredText(input: unknown, field: string): string {
  const value = fieldValue(input, field);
  if (typeof value !== "string" || value.trim().length === 0) {
    return validationFailure(field);
  }
  return value;
}

function requiredVersion(input: unknown): number {
  const value = fieldValue(input, "expectedVersion");
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return validationFailure("expectedVersion");
  }
  return value as number;
}

function decodeIngredientId(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return validationFailure("ingredientId");
  }
}

function renameCommand(
  encodedIngredientId: string,
  input: unknown
): RenameCanonicalIngredientCommandV1 {
  return {
    ingredientId: decodeIngredientId(encodedIngredientId),
    get newName(): string { return requiredText(input, "newName"); },
    get expectedVersion(): number { return requiredVersion(input); },
    get actor(): string { return requiredText(input, "actor"); },
    get occurredAt(): string { return requiredText(input, "occurredAt"); },
    get reason(): string { return requiredText(input, "reason"); }
  };
}

function archiveCommand(
  encodedIngredientId: string,
  input: unknown
): ArchiveCanonicalIngredientCommandV1 {
  return {
    ingredientId: decodeIngredientId(encodedIngredientId),
    get expectedVersion(): number { return requiredVersion(input); },
    get actor(): string { return requiredText(input, "actor"); },
    get occurredAt(): string { return requiredText(input, "occurredAt"); },
    get reason(): string { return requiredText(input, "reason"); }
  };
}

function mapApplicationError(error: unknown): never {
  if (error instanceof HttpError) throw error;
  if (error instanceof CanonicalIngredientLifecycleValidationFailure) {
    throw new HttpError(422, error.code, error.message);
  }
  if (error instanceof CanonicalIngredientLifecycleNotFound) {
    throw new HttpError(404, error.code, error.message);
  }
  if (
    error instanceof CanonicalIngredientLifecycleVersionConflict
    || error instanceof CanonicalIngredientAlreadyArchived
    || error instanceof CanonicalIngredientArchivedRenameRejected
    || error instanceof InvalidCanonicalIngredientLifecycleTransition
  ) {
    throw new HttpError(409, error.code, error.message);
  }
  if (error instanceof CanonicalIngredientLifecyclePersistenceFailure) {
    throw new HttpError(500, error.code, error.message);
  }
  throw new HttpError(
    500,
    "internal_error",
    "An unexpected server error occurred."
  );
}

export class CanonicalIngredientManagementService {
  constructor(
    private readonly reads: CanonicalIngredientManagementReadService,
    private readonly lifecycle: CanonicalIngredientLifecycleService
  ) {}

  list(
    lifecycle?: string
  ): readonly CanonicalIngredientManagementRecordV1[] {
    try {
      return this.reads.list(lifecycle);
    } catch (error) {
      return mapApplicationError(error);
    }
  }

  getById(encodedIngredientId: string): CanonicalIngredientManagementRecordV1 {
    try {
      return this.reads.getById(decodeIngredientId(encodedIngredientId));
    } catch (error) {
      return mapApplicationError(error);
    }
  }

  rename(
    encodedIngredientId: string,
    input: unknown
  ): RenameCanonicalIngredientResultV1 {
    try {
      return this.lifecycle.rename(renameCommand(encodedIngredientId, input));
    } catch (error) {
      return mapApplicationError(error);
    }
  }

  archive(
    encodedIngredientId: string,
    input: unknown
  ): ArchiveCanonicalIngredientResultV1 {
    try {
      return this.lifecycle.archive(archiveCommand(encodedIngredientId, input));
    } catch (error) {
      return mapApplicationError(error);
    }
  }
}
