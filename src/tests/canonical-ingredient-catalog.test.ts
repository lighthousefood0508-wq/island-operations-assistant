import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  APPROVED_INGREDIENT_CATEGORY_CODES_V1,
  CANONICAL_INGREDIENT_CONTRACT_VERSION,
  type CanonicalIngredientContractV1
} from "../domains/recipe/contracts/canonical-ingredient-contract.js";
import { CanonicalIngredient } from "../domains/recipe/ingredient-catalog/canonical-ingredient.js";
import {
  CanonicalIngredientVersionConflict,
  InvalidCanonicalIngredientAuditEvidence,
  InvalidCanonicalIngredientIdentity,
  InvalidCanonicalIngredientName,
  InvalidCanonicalIngredientTransition,
  InvalidIngredientCategory
} from "../domains/recipe/ingredient-catalog/errors.js";
import { CanonicalIngredientId } from "../domains/recipe/ingredient-catalog/identities.js";
import { IngredientCategory } from "../domains/recipe/ingredient-catalog/ingredient-category.js";
import type {
  CanonicalIngredientRepository
} from "../domains/recipe/ingredient-catalog/canonical-ingredient-repository.js";

const INGREDIENT_ID = "ing_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CREATED_AT = "2026-07-31T01:00:00.000Z";
const LATER = "2026-07-31T02:00:00.000Z";
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

function ingredient(name = "豬五花"): CanonicalIngredient {
  return CanonicalIngredient.create({
    ingredientId: CanonicalIngredientId.parse(INGREDIENT_ID),
    name,
    category: IngredientCategory.parse("meat"),
    createdAt: CREATED_AT,
    createdBy: "actor_owner"
  });
}

test("Canonical Ingredient identity uses immutable ing_<uuid>", () => {
  const identity = CanonicalIngredientId.parse(INGREDIENT_ID);
  assert.equal(identity.value, INGREDIENT_ID);
  assert.equal(Object.isFrozen(identity), true);
  assert.throws(
    () => CanonicalIngredientId.parse("ingredient-pork"),
    InvalidCanonicalIngredientIdentity
  );
});

test("Canonical Ingredient is created as Active at aggregate version zero", () => {
  const created = ingredient();
  assert.equal(created.status, "Active");
  assert.equal(created.aggregateVersion, 0);
  assert.equal(created.name, "豬五花");
  assert.equal(created.category.code, "meat");
  assert.equal(Object.isFrozen(created), true);
});

test("name is required and canonical whitespace is trimmed", () => {
  assert.equal(ingredient("  豬五花  ").name, "豬五花");
  assert.throws(() => ingredient("   "), InvalidCanonicalIngredientName);
});

test("created actor and timestamp are required caller evidence", () => {
  assert.throws(
    () => CanonicalIngredient.create({
      ingredientId: CanonicalIngredientId.parse(INGREDIENT_ID),
      name: "豬五花",
      category: IngredientCategory.parse("meat"),
      createdAt: "not-an-instant",
      createdBy: "actor_owner"
    }),
    InvalidCanonicalIngredientAuditEvidence
  );
  assert.throws(
    () => CanonicalIngredient.create({
      ingredientId: CanonicalIngredientId.parse(INGREDIENT_ID),
      name: "豬五花",
      category: IngredientCategory.parse("meat"),
      createdAt: CREATED_AT,
      createdBy: " "
    }),
    InvalidCanonicalIngredientAuditEvidence
  );
});

test("timestamps require canonical ISO-8601 UTC instants", () => {
  assert.throws(
    () => CanonicalIngredient.create({
      ingredientId: CanonicalIngredientId.parse(INGREDIENT_ID),
      name: "豬五花",
      category: IngredientCategory.parse("meat"),
      createdAt: "2026/07/31 01:00:00",
      createdBy: "actor_owner"
    }),
    InvalidCanonicalIngredientAuditEvidence
  );
  assert.throws(
    () => CanonicalIngredient.create({
      ingredientId: CanonicalIngredientId.parse(INGREDIENT_ID),
      name: "豬五花",
      category: IngredientCategory.parse("meat"),
      createdAt: "2026-07-31T09:00:00.000+08:00",
      createdBy: "actor_owner"
    }),
    InvalidCanonicalIngredientAuditEvidence
  );
});

test("v1 writers accept every approved Ingredient category code", () => {
  for (const code of APPROVED_INGREDIENT_CATEGORY_CODES_V1) {
    assert.equal(IngredientCategory.parse(code).code, code);
  }
  assert.equal(IngredientCategory.parse("alcohol").code, "alcohol");
});

test("v1 writers reject arbitrary category text", () => {
  assert.throws(
    () => IngredientCategory.parse("future_unapproved"),
    InvalidIngredientCategory
  );
});

test("public category contract remains forward-compatible for readers", () => {
  const futureProjection: CanonicalIngredientContractV1 = Object.freeze({
    contractVersion: 1,
    ingredientId: INGREDIENT_ID,
    name: "未來食材",
    categoryCode: "future_owner_approved_code",
    status: "Active",
    aggregateVersion: 0,
    createdAt: CREATED_AT,
    createdBy: "actor_owner",
    renameHistory: Object.freeze([])
  });
  assert.equal(futureProjection.categoryCode, "future_owner_approved_code");
});

test("rename preserves identity and appends immutable audit evidence", () => {
  const original = ingredient();
  const renamed = original.rename("台灣豬五花", {
    occurredAt: LATER,
    actorId: "actor_editor",
    reason: "Clarify sourcing specification without changing semantics."
  });
  assert.equal(renamed.ingredientId, original.ingredientId);
  assert.equal(original.name, "豬五花");
  assert.equal(original.aggregateVersion, 0);
  assert.equal(renamed.name, "台灣豬五花");
  assert.equal(renamed.aggregateVersion, 1);
  assert.deepEqual(renamed.renameHistory[0], {
    previousName: "豬五花",
    newName: "台灣豬五花",
    renamedAt: LATER,
    renamedBy: "actor_editor",
    reason: "Clarify sourcing specification without changing semantics."
  });
  assert.equal(Object.isFrozen(renamed.renameHistory), true);
  assert.equal(Object.isFrozen(renamed.renameHistory[0]), true);
});

test("rename requires a changed name, actor, timestamp, and reason", () => {
  const original = ingredient();
  assert.throws(
    () => original.rename("豬五花", {
      occurredAt: LATER,
      actorId: "actor_editor",
      reason: "No change"
    }),
    InvalidCanonicalIngredientName
  );
  for (const audit of [
    { occurredAt: "invalid", actorId: "actor_editor", reason: "reason" },
    { occurredAt: LATER, actorId: "", reason: "reason" },
    { occurredAt: LATER, actorId: "actor_editor", reason: " " }
  ]) {
    assert.throws(
      () => original.rename("台灣豬五花", audit),
      InvalidCanonicalIngredientAuditEvidence
    );
  }
});

test("multiple renames preserve append-first history", () => {
  const first = ingredient().rename("台灣豬五花", {
    occurredAt: LATER,
    actorId: "actor_editor",
    reason: "Clarify origin"
  });
  const second = first.rename("台灣冷藏豬五花", {
    occurredAt: "2026-07-31T03:00:00.000Z",
    actorId: "actor_editor",
    reason: "Clarify handling"
  });
  assert.equal(first.renameHistory.length, 1);
  assert.equal(second.renameHistory.length, 2);
  assert.equal(second.renameHistory[0]?.previousName, "豬五花");
  assert.equal(second.renameHistory[1]?.previousName, "台灣豬五花");
});

test("rename audit time cannot precede creation or previous rename", () => {
  assert.throws(
    () => ingredient().rename("台灣豬五花", {
      occurredAt: "2026-07-31T00:59:59.999Z",
      actorId: "actor_editor",
      reason: "Invalid historical ordering"
    }),
    InvalidCanonicalIngredientAuditEvidence
  );
  const renamed = ingredient().rename("台灣豬五花", {
    occurredAt: LATER,
    actorId: "actor_editor",
    reason: "Clarify origin"
  });
  assert.throws(
    () => renamed.rename("台灣冷藏豬五花", {
      occurredAt: "2026-07-31T01:59:59.999Z",
      actorId: "actor_editor",
      reason: "Invalid historical ordering"
    }),
    InvalidCanonicalIngredientAuditEvidence
  );
});

test("equal audit instants are accepted as non-decreasing history", () => {
  const renamed = ingredient().rename("台灣豬五花", {
    occurredAt: CREATED_AT,
    actorId: "actor_editor",
    reason: "Same recorded instant"
  });
  const archived = renamed.archive({
    occurredAt: CREATED_AT,
    actorId: "actor_owner",
    reason: "Same recorded instant"
  });
  assert.equal(archived.status, "Archived");
});

test("archive preserves identity and history without deletion", () => {
  const renamed = ingredient().rename("台灣豬五花", {
    occurredAt: LATER,
    actorId: "actor_editor",
    reason: "Clarify origin"
  });
  const archived = renamed.archive({
    occurredAt: "2026-07-31T03:00:00.000Z",
    actorId: "actor_owner",
    reason: "No longer available for ordinary selection"
  });
  assert.equal(archived.status, "Archived");
  assert.equal(archived.ingredientId.value, INGREDIENT_ID);
  assert.equal(archived.aggregateVersion, 2);
  assert.equal(archived.renameHistory.length, 1);
  assert.deepEqual(archived.archiveFact, {
    archivedAt: "2026-07-31T03:00:00.000Z",
    archivedBy: "actor_owner",
    reason: "No longer available for ordinary selection"
  });
});

test("Archived Ingredient cannot be renamed or archived again", () => {
  const archived = ingredient().archive({
    occurredAt: LATER,
    actorId: "actor_owner",
    reason: "Retired"
  });
  assert.throws(
    () => archived.rename("新名稱", {
      occurredAt: "2026-07-31T03:00:00.000Z",
      actorId: "actor_owner",
      reason: "Not allowed"
    }),
    InvalidCanonicalIngredientTransition
  );
  assert.throws(
    () => archived.archive({
      occurredAt: "2026-07-31T03:00:00.000Z",
      actorId: "actor_owner",
      reason: "Not allowed"
    }),
    InvalidCanonicalIngredientTransition
  );
});

test("Archived Ingredient reactivates by appending immutable evidence and permits a later governed Archive", () => {
  const firstArchive = ingredient().archive({
    occurredAt: "2026-07-31T03:00:00.000Z", actorId: "owner", reason: "retired"
  });
  const activeAgain = firstArchive.reactivate({
    occurredAt: "2026-07-31T04:00:00.000Z", actorId: "owner", reason: "restored"
  });
  const secondArchive = activeAgain.archive({
    occurredAt: "2026-07-31T05:00:00.000Z", actorId: "owner", reason: "retired again"
  });
  assert.equal(activeAgain.status, "Active");
  assert.equal(activeAgain.archiveFact, undefined);
  assert.deepEqual(activeAgain.lifecycleHistory.map((event) => event.eventType), ["ARCHIVED", "REACTIVATED"]);
  assert.deepEqual(secondArchive.lifecycleHistory.map((event) => event.aggregateVersion), [1, 2, 3]);
  assert.equal(secondArchive.archiveFact?.reason, "retired again");
  assert.throws(() => activeAgain.reactivate({ occurredAt: "2026-07-31T05:00:00.000Z", actorId: "owner", reason: "invalid" }), InvalidCanonicalIngredientTransition);
});

test("archive audit time cannot precede the latest rename", () => {
  const renamed = ingredient().rename("台灣豬五花", {
    occurredAt: LATER,
    actorId: "actor_editor",
    reason: "Clarify origin"
  });
  assert.throws(
    () => renamed.archive({
      occurredAt: "2026-07-31T01:59:59.999Z",
      actorId: "actor_owner",
      reason: "Invalid historical ordering"
    }),
    InvalidCanonicalIngredientAuditEvidence
  );
});

test("public Contract is immutable and has one authoritative name", () => {
  const contract = ingredient().toContract();
  assert.equal(contract.contractVersion, CANONICAL_INGREDIENT_CONTRACT_VERSION);
  assert.equal(contract.name, "豬五花");
  assert.equal(Object.hasOwn(contract, "canonicalName"), false);
  assert.equal(Object.hasOwn(contract, "displayName"), false);
  assert.equal(Object.isFrozen(contract), true);
  assert.equal(Object.isFrozen(contract.renameHistory), true);
});

test("Repository Port separates new writes from expected-version updates", () => {
  class ContractFixture implements CanonicalIngredientRepository {
    saveNew(_ingredient: CanonicalIngredient): void {}
    saveWithExpectedVersion(
      ingredientToSave: CanonicalIngredient,
      expectedVersion: number
    ): number {
      if (ingredientToSave.aggregateVersion !== expectedVersion + 1) {
        throw new CanonicalIngredientVersionConflict(
          expectedVersion,
          ingredientToSave.aggregateVersion
        );
      }
      return ingredientToSave.aggregateVersion;
    }
    findById(_ingredientId: CanonicalIngredientId): CanonicalIngredient | undefined {
      return undefined;
    }
    listActiveForManagement(): readonly CanonicalIngredient[] {
      return [];
    }
    listArchivedForManagement(): readonly CanonicalIngredient[] {
      return [];
    }
    searchByName(_query: string): readonly CanonicalIngredient[] {
      return [];
    }
    findDuplicateCandidates(_name: string): readonly CanonicalIngredient[] {
      return [];
    }
  }
  const repository = new ContractFixture();
  repository.saveNew(ingredient());
  assert.equal(
    repository.saveWithExpectedVersion(
      ingredient().rename("台灣豬五花", {
        occurredAt: LATER,
        actorId: "actor_editor",
        reason: "Clarify origin"
      }),
      0
    ),
    1
  );
});

test("Repository Port exposes candidate collections and no generic save authority", () => {
  const source = readFileSync(
    path.join(
      projectRoot,
      "src/domains/recipe/ingredient-catalog/canonical-ingredient-repository.ts"
    ),
    "utf8"
  );
  assert.match(source, /saveNew\s*\(/);
  assert.match(source, /saveWithExpectedVersion\s*\(/);
  assert.match(source, /listActiveForManagement\s*\(/);
  assert.match(source, /listArchivedForManagement\s*\(/);
  assert.match(source, /searchByName\s*\(/);
  assert.match(source, /findDuplicateCandidates\s*\(/);
  assert.doesNotMatch(source, /^\s*save\s*\(/m);
});

test("Ingredient contains no Measurement, Supplier, Brand, Package, or persistence authority", () => {
  const source = [
    "src/domains/recipe/contracts/canonical-ingredient-contract.ts",
    "src/domains/recipe/ingredient-catalog/canonical-ingredient.ts"
  ].map((filename) =>
    readFileSync(path.join(projectRoot, filename), "utf8")
  ).join("\n");
  assert.doesNotMatch(
    source,
    /baseUnit|canonicalUnit|conversionRatio|unitAlias|supplierId|brandId|packageSize|better-sqlite3|node:sqlite/i
  );
});

test("Ingredient Measurement Profile imports the canonical public identity type", () => {
  const source = readFileSync(
    path.join(
      projectRoot,
      "src/domains/recipe/contracts/ingredient-measurement-profile-contract.ts"
    ),
    "utf8"
  );
  assert.match(source, /from "\.\/canonical-ingredient-contract\.js"/);
  assert.doesNotMatch(source, /export type CanonicalIngredientIdV1 = string/);
});
