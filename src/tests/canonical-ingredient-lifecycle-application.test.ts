import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CanonicalIngredientAlreadyArchived,
  CanonicalIngredientArchivedRenameRejected,
  CanonicalIngredientLifecycleNotFound,
  CanonicalIngredientLifecyclePersistenceFailure,
  CanonicalIngredientLifecycleService,
  CanonicalIngredientLifecycleValidationFailure,
  CanonicalIngredientLifecycleVersionConflict,
  InvalidCanonicalIngredientLifecycleTransition,
  type ArchiveCanonicalIngredientCommandV1,
  type RenameCanonicalIngredientCommandV1
} from "../domains/recipe/index.js";
import { CanonicalIngredient } from "../domains/recipe/ingredient-catalog/canonical-ingredient.js";
import {
  CanonicalIngredientVersionConflict,
  InvalidCanonicalIngredientName,
  InvalidCanonicalIngredientTransition
} from "../domains/recipe/ingredient-catalog/errors.js";
import { CanonicalIngredientId } from "../domains/recipe/ingredient-catalog/identities.js";
import { IngredientCategory } from "../domains/recipe/ingredient-catalog/ingredient-category.js";

const INGREDIENT_ID = "ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ID = "ing_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THIRD_ID = "ing_cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CREATED_AT = "2026-07-31T01:00:00.000Z";
const LATER = "2026-07-31T02:00:00.000Z";
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

function ingredient(
  ingredientId = INGREDIENT_ID,
  name = "豬五花"
): CanonicalIngredient {
  return CanonicalIngredient.create({
    ingredientId: CanonicalIngredientId.parse(ingredientId),
    name,
    category: IngredientCategory.parse("meat"),
    createdAt: CREATED_AT,
    createdBy: "actor_owner"
  });
}

function archived(): CanonicalIngredient {
  return ingredient().archive({
    occurredAt: LATER,
    actorId: "actor_owner",
    reason: "Retired"
  });
}

function renameCommand(
  overrides: Partial<RenameCanonicalIngredientCommandV1> = {}
): RenameCanonicalIngredientCommandV1 {
  return {
    ingredientId: INGREDIENT_ID,
    newName: "台灣豬五花",
    expectedVersion: 0,
    actor: " actor_editor ",
    occurredAt: LATER,
    reason: " Clarify origin ",
    ...overrides
  };
}

function archiveCommand(
  overrides: Partial<ArchiveCanonicalIngredientCommandV1> = {}
): ArchiveCanonicalIngredientCommandV1 {
  return {
    ingredientId: INGREDIENT_ID,
    expectedVersion: 0,
    actor: " actor_owner ",
    occurredAt: LATER,
    reason: " Retired ",
    ...overrides
  };
}

class RepositoryFixture {
  found: CanonicalIngredient | undefined = ingredient();
  duplicates: readonly CanonicalIngredient[] = [];
  findFailure: unknown;
  duplicateFailure: unknown;
  saveFailure: unknown;
  findCalls = 0;
  duplicateCalls = 0;
  saveCalls = 0;
  saved: CanonicalIngredient | undefined;
  savedExpectedVersion: number | undefined;

  findById(_ingredientId: CanonicalIngredientId): CanonicalIngredient | undefined {
    this.findCalls += 1;
    if (this.findFailure !== undefined) throw this.findFailure;
    return this.found;
  }

  findDuplicateCandidates(_name: string): readonly CanonicalIngredient[] {
    this.duplicateCalls += 1;
    if (this.duplicateFailure !== undefined) throw this.duplicateFailure;
    return this.duplicates;
  }

  saveWithExpectedVersion(
    candidate: CanonicalIngredient,
    expectedVersion: number
  ): number {
    this.saveCalls += 1;
    this.saved = candidate;
    this.savedExpectedVersion = expectedVersion;
    if (this.saveFailure !== undefined) throw this.saveFailure;
    return candidate.aggregateVersion;
  }
}

function caught(action: () => unknown): Error & { code?: string } {
  try {
    action();
  } catch (error) {
    assert.ok(error instanceof Error);
    return error;
  }
  assert.fail("Expected action to throw.");
}

test("malformed identity fails before Repository access", () => {
  const repository = new RepositoryFixture();
  const error = caught(() => new CanonicalIngredientLifecycleService(repository)
    .rename(renameCommand({ ingredientId: "bad-id" })));
  assert.ok(error instanceof CanonicalIngredientLifecycleValidationFailure);
  assert.equal(error.code, "CANONICAL_INGREDIENT_VALIDATION_FAILURE");
  assert.equal(repository.findCalls, 0);
  assert.equal(repository.duplicateCalls, 0);
  assert.equal(repository.saveCalls, 0);
});

test("Not Found precedes malformed expectedVersion for a parseable identity", () => {
  const repository = new RepositoryFixture();
  repository.found = undefined;
  const error = caught(() => new CanonicalIngredientLifecycleService(repository)
    .archive(archiveCommand({ expectedVersion: Number.NaN })));
  assert.ok(error instanceof CanonicalIngredientLifecycleNotFound);
  assert.equal(error.code, "CANONICAL_INGREDIENT_NOT_FOUND");
  assert.equal(repository.findCalls, 1);
  assert.equal(repository.saveCalls, 0);
});

test("malformed expectedVersion fails after load and before lifecycle work", () => {
  for (const expectedVersion of [-1, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    const repository = new RepositoryFixture();
    const error = caught(() => new CanonicalIngredientLifecycleService(repository)
      .rename(renameCommand({ expectedVersion })));
    assert.ok(error instanceof CanonicalIngredientLifecycleValidationFailure);
    assert.equal(repository.findCalls, 1);
    assert.equal(repository.duplicateCalls, 0);
    assert.equal(repository.saveCalls, 0);
  }
});

test("valid stale version precedes lifecycle and remaining-field validation", () => {
  const repository = new RepositoryFixture();
  repository.found = archived();
  const service = new CanonicalIngredientLifecycleService(repository);
  for (const action of [
    () => service.rename(renameCommand({ expectedVersion: 0, newName: " " })),
    () => service.archive(archiveCommand({ expectedVersion: 0, actor: " " }))
  ]) {
    const error = caught(action);
    assert.ok(error instanceof CanonicalIngredientLifecycleVersionConflict);
  }
  assert.equal(repository.duplicateCalls, 0);
  assert.equal(repository.saveCalls, 0);
});

test("matching-version Archived commands throw exact terminal errors without writes", () => {
  const repository = new RepositoryFixture();
  repository.found = archived();
  const service = new CanonicalIngredientLifecycleService(repository);
  const archiveError = caught(() => service.archive(
    archiveCommand({ expectedVersion: 1, actor: " " })
  ));
  assert.ok(archiveError instanceof CanonicalIngredientAlreadyArchived);
  assert.equal(archiveError.code, "CANONICAL_INGREDIENT_ALREADY_ARCHIVED");
  const renameError = caught(() => service.rename(
    renameCommand({ expectedVersion: 1, newName: " " })
  ));
  assert.ok(renameError instanceof CanonicalIngredientArchivedRenameRejected);
  assert.equal(
    renameError.code,
    "CANONICAL_INGREDIENT_ARCHIVED_RENAME_REJECTED"
  );
  assert.equal(repository.duplicateCalls, 0);
  assert.equal(repository.saveCalls, 0);
});

test("eligible Rename fields are prevalidated before duplicate lookup or save", () => {
  const invalidCommands = [
    renameCommand({ newName: " " }),
    renameCommand({ newName: " 豬五花 " }),
    renameCommand({ actor: " " }),
    renameCommand({ occurredAt: "not-an-instant" }),
    renameCommand({ occurredAt: "2026-07-31T00:59:59.999Z" }),
    renameCommand({ reason: " " })
  ];
  for (const command of invalidCommands) {
    const repository = new RepositoryFixture();
    const error = caught(() => new CanonicalIngredientLifecycleService(repository)
      .rename(command));
    assert.ok(error instanceof CanonicalIngredientLifecycleValidationFailure);
    assert.equal(repository.duplicateCalls, 0);
    assert.equal(repository.saveCalls, 0);
    assert.equal(repository.found?.aggregateVersion, 0);
  }
});

test("eligible Archive audit evidence is prevalidated before transition or save", () => {
  for (const command of [
    archiveCommand({ actor: " " }),
    archiveCommand({ occurredAt: "not-an-instant" }),
    archiveCommand({ occurredAt: "2026-07-31T00:59:59.999Z" }),
    archiveCommand({ reason: " " })
  ]) {
    const repository = new RepositoryFixture();
    const error = caught(() => new CanonicalIngredientLifecycleService(repository)
      .archive(command));
    assert.ok(error instanceof CanonicalIngredientLifecycleValidationFailure);
    assert.equal(repository.duplicateCalls, 0);
    assert.equal(repository.saveCalls, 0);
    assert.equal(repository.found?.status, "Active");
  }
});

test("Rename preserves identity, maps audit evidence, transitions and saves once", () => {
  const repository = new RepositoryFixture();
  const result = new CanonicalIngredientLifecycleService(repository)
    .rename(renameCommand());
  assert.equal(result.ingredient.ingredientId, INGREDIENT_ID);
  assert.equal(result.ingredient.name, "台灣豬五花");
  assert.equal(result.ingredient.aggregateVersion, 1);
  assert.deepEqual(result.ingredient.renameHistory[0], {
    previousName: "豬五花",
    newName: "台灣豬五花",
    renamedAt: LATER,
    renamedBy: "actor_editor",
    reason: "Clarify origin"
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(repository.duplicateCalls, 1);
  assert.equal(repository.saveCalls, 1);
  assert.equal(repository.savedExpectedVersion, 0);
  assert.equal(repository.saved?.aggregateVersion, 1);
});

test("Archive preserves all existing Contract evidence except transition fields", () => {
  const repository = new RepositoryFixture();
  repository.found = ingredient().rename("台灣豬五花", {
    occurredAt: LATER,
    actorId: "actor_editor",
    reason: "Clarify origin"
  });
  const before = repository.found.toContract();
  const result = new CanonicalIngredientLifecycleService(repository).archive(
    archiveCommand({
      expectedVersion: 1,
      occurredAt: "2026-07-31T03:00:00.000Z"
    })
  );
  assert.equal(result.ingredient.ingredientId, before.ingredientId);
  assert.equal(result.ingredient.name, before.name);
  assert.equal(result.ingredient.categoryCode, before.categoryCode);
  assert.equal(result.ingredient.createdAt, before.createdAt);
  assert.equal(result.ingredient.createdBy, before.createdBy);
  assert.deepEqual(result.ingredient.renameHistory, before.renameHistory);
  assert.equal(result.ingredient.status, "Archived");
  assert.equal(result.ingredient.aggregateVersion, 2);
  assert.deepEqual(result.ingredient.archiveFact, {
    archivedAt: "2026-07-31T03:00:00.000Z",
    archivedBy: "actor_owner",
    reason: "Retired"
  });
  assert.equal(repository.duplicateCalls, 0);
  assert.equal(repository.saveCalls, 1);
});

test("duplicate warning cardinality, current-ID exclusion, shape and ordering are exact", () => {
  const cases: readonly (readonly CanonicalIngredient[])[] = [
    [],
    [ingredient(OTHER_ID, "台灣豬五花")],
    [
      ingredient(INGREDIENT_ID, "台灣豬五花"),
      ingredient(THIRD_ID, "台灣豬五花"),
      ingredient(OTHER_ID, "台灣豬五花")
    ]
  ];
  const warningCounts = [0, 1, 1];
  for (const [index, duplicates] of cases.entries()) {
    const repository = new RepositoryFixture();
    repository.duplicates = duplicates;
    const result = new CanonicalIngredientLifecycleService(repository)
      .rename(renameCommand());
    assert.equal(result.warnings.length, warningCounts[index]);
    if (result.warnings.length === 0) continue;
    const warning = result.warnings[0];
    assert.equal(warning?.code, "DUPLICATE_NAME_WARNING");
    assert.deepEqual(
      warning?.candidates.map((candidate) => candidate.ingredientId),
      duplicates
        .filter((candidate) => candidate.ingredientId.value !== INGREDIENT_ID)
        .map((candidate) => candidate.ingredientId.value)
    );
    for (const candidate of warning?.candidates ?? []) {
      assert.deepEqual(Object.keys(candidate), ["ingredientId", "name", "status"]);
    }
  }
});

test("unexpected Repository failures map to Persistence Failure without raw leakage", () => {
  const raw = new Error("RAW_SQLITE_MARKER");
  raw.stack = "RAW_PERSISTENCE_STACK";
  const scenarios: Array<(repository: RepositoryFixture) => void> = [
    (repository) => { repository.findFailure = raw; },
    (repository) => { repository.duplicateFailure = raw; },
    (repository) => { repository.saveFailure = raw; }
  ];
  for (const configure of scenarios) {
    const repository = new RepositoryFixture();
    configure(repository);
    const error = caught(() => new CanonicalIngredientLifecycleService(repository)
      .rename(renameCommand()));
    assert.ok(error instanceof CanonicalIngredientLifecyclePersistenceFailure);
    assert.equal(error.code, "CANONICAL_INGREDIENT_PERSISTENCE_FAILURE");
    assert.equal(Object.hasOwn(error, "cause"), false);
    assert.equal(Object.hasOwn(error, "rawError"), false);
    assert.doesNotMatch(error.message, /RAW_SQLITE_MARKER/);
    assert.doesNotMatch(error.stack ?? "", /RAW_PERSISTENCE_STACK/);
  }
});

test("typed persistence CAS conflict maps only to Version Conflict", () => {
  const repository = new RepositoryFixture();
  repository.saveFailure = new CanonicalIngredientVersionConflict(0, 1);
  const error = caught(() => new CanonicalIngredientLifecycleService(repository)
    .rename(renameCommand()));
  assert.ok(error instanceof CanonicalIngredientLifecycleVersionConflict);
  assert.equal(error.code, "CANONICAL_INGREDIENT_VERSION_CONFLICT");
  assert.equal(Object.hasOwn(error, "cause"), false);
});

test("authoritative Domain validation and lifecycle failures map to accepted errors", () => {
  const validationRepository = new RepositoryFixture();
  validationRepository.found = new Proxy(ingredient(), {
    get(target, property, receiver) {
      if (property === "rename") {
        return () => { throw new InvalidCanonicalIngredientName(); };
      }
      return Reflect.get(target, property, receiver);
    }
  });
  const validationError = caught(() =>
    new CanonicalIngredientLifecycleService(validationRepository)
      .rename(renameCommand())
  );
  assert.ok(validationError instanceof CanonicalIngredientLifecycleValidationFailure);
  assert.equal(validationRepository.saveCalls, 0);

  const transitionRepository = new RepositoryFixture();
  transitionRepository.found = new Proxy(ingredient(), {
    get(target, property, receiver) {
      if (property === "archive") {
        return () => { throw new InvalidCanonicalIngredientTransition("Active", "ARCHIVE"); };
      }
      return Reflect.get(target, property, receiver);
    }
  });
  const transitionError = caught(() =>
    new CanonicalIngredientLifecycleService(transitionRepository)
      .archive(archiveCommand())
  );
  assert.ok(transitionError instanceof InvalidCanonicalIngredientLifecycleTransition);
  assert.equal(transitionError.code, "INVALID_CANONICAL_INGREDIENT_TRANSITION");
  assert.equal(transitionRepository.saveCalls, 0);
});

test("003A source keeps the Repository Port unchanged and public surface additive", () => {
  const repositorySource = readFileSync(
    path.join(
      projectRoot,
      "src/domains/recipe/ingredient-catalog/canonical-ingredient-repository.ts"
    ),
    "utf8"
  );
  const serviceSource = readFileSync(
    path.join(
      projectRoot,
      "src/domains/recipe/ingredient-catalog/application/canonical-ingredient-lifecycle-service.ts"
    ),
    "utf8"
  );
  const contractSource = readFileSync(
    path.join(
      projectRoot,
      "src/domains/recipe/contracts/canonical-ingredient-management-contract.ts"
    ),
    "utf8"
  );
  assert.match(serviceSource, /Pick<[\s\S]*"findById" \| "findDuplicateCandidates" \| "saveWithExpectedVersion"/);
  assert.doesNotMatch(serviceSource, /"saveNew"|"searchByName"|listActive/);
  assert.match(contractSource, /Readonly</);
  assert.match(contractSource, /readonly CanonicalIngredientDuplicateCandidateV1\[\]/);
  assert.doesNotMatch(contractSource, /Object\.freeze/);
  assert.match(repositorySource, /saveNew\s*\(/);
  assert.match(repositorySource, /searchByName\s*\(/);
});
