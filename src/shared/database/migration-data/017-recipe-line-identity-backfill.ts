import { createHash } from "node:crypto";
import type { DatabaseAdapter } from "../database-adapter.js";

const NAMESPACE = "1eb684cb-79ac-592a-ab08-06d7573be569";
const RECIPE_PATTERN = /^recipe_([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;

type PositionedRow = Readonly<{ owner_id: string; position: number }>;
type SemanticLine = Readonly<{
  position: number;
  ingredient_id: string;
  ingredient_canonical_name: string;
  ingredient_measurement_dimension: string;
  ingredient_status: string;
  ingredient_created_at: string;
  quantity_coefficient: string;
  quantity_scale: number;
  quantity_unit_code: string;
  quantity_dimension: string;
}>;

function uuidBytes(value: string): Buffer {
  return Buffer.from(value.replaceAll("-", ""), "hex");
}

function uuidV5(namespace: string, name: string): string {
  const digest = createHash("sha1")
    .update(uuidBytes(namespace))
    .update(Buffer.from(name, "utf8"))
    .digest()
    .subarray(0, 16);
  digest[6] = (digest[6]! & 0x0f) | 0x50;
  digest[8] = (digest[8]! & 0x3f) | 0x80;
  const hex = digest.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function validatePositions(rows: readonly PositionedRow[], label: string): void {
  const byOwner = new Map<string, number[]>();
  for (const row of rows) {
    if (!Number.isSafeInteger(row.position) || row.position < 0) {
      throw new Error(`${label} ${row.owner_id} has an invalid Line position.`);
    }
    const positions = byOwner.get(row.owner_id) ?? [];
    positions.push(row.position);
    byOwner.set(row.owner_id, positions);
  }
  for (const [owner, positions] of byOwner) {
    positions.sort((a, b) => a - b);
    if (positions.some((position, index) => position !== index)) {
      throw new Error(`${label} ${owner} Line positions must be unique and contiguous from zero.`);
    }
  }
}

function sameLine(left: SemanticLine, right: SemanticLine): boolean {
  return left.position === right.position
    && left.ingredient_id === right.ingredient_id
    && left.ingredient_canonical_name === right.ingredient_canonical_name
    && left.ingredient_measurement_dimension === right.ingredient_measurement_dimension
    && left.ingredient_status === right.ingredient_status
    && left.ingredient_created_at === right.ingredient_created_at
    && left.quantity_coefficient === right.quantity_coefficient
    && left.quantity_scale === right.quantity_scale
    && left.quantity_unit_code === right.quantity_unit_code
    && left.quantity_dimension === right.quantity_dimension;
}

export function backfillRecipeMigration017(database: DatabaseAdapter): void {
  const recipes = database.queryMany<{ recipe_id: string }>("SELECT recipe_id FROM recipe_recipes ORDER BY recipe_id");
  for (const recipe of recipes) {
    const match = RECIPE_PATTERN.exec(recipe.recipe_id);
    if (!match) throw new Error(`Migration 017 cannot derive Recipe Family identity from ${recipe.recipe_id}.`);
    const products = database.queryMany<{ product_id: string }>(
      `SELECT DISTINCT product_id FROM recipe_drafts
       WHERE recipe_id = ? AND product_id IS NOT NULL ORDER BY product_id`,
      [recipe.recipe_id]
    );
    if (products.length > 1) {
      throw new Error(`Migration 017 found conflicting Product bindings for ${recipe.recipe_id}.`);
    }
    database.execute(
      "INSERT INTO recipe_017_recipe_map (recipe_id, recipe_family_id, product_id) VALUES (?, ?, ?)",
      [recipe.recipe_id, `recipe_family_${match[1]}`, products[0]?.product_id ?? null]
    );
  }

  const draftRows = database.queryMany<PositionedRow>(
    "SELECT draft_id AS owner_id, position FROM recipe_draft_lines ORDER BY draft_id, position"
  );
  const versionRows = database.queryMany<PositionedRow>(
    "SELECT recipe_version_id AS owner_id, position FROM recipe_version_lines ORDER BY recipe_version_id, position"
  );
  validatePositions(draftRows, "Draft");
  validatePositions(versionRows, "Version");

  for (const row of draftRows) {
    const recipeLineId = `recipe_line_${uuidV5(NAMESPACE, `draft:${row.owner_id}:${row.position}`)}`;
    database.execute(
      "INSERT INTO recipe_017_draft_line_map (draft_id, position, recipe_line_id) VALUES (?, ?, ?)",
      [row.owner_id, row.position, recipeLineId]
    );
  }

  const versions = database.queryMany<{ recipe_version_id: string; recipe_id: string; source_draft_id: string }>(
    "SELECT recipe_version_id, recipe_id, source_draft_id FROM recipe_versions ORDER BY recipe_version_id"
  );
  for (const version of versions) {
    const sourceDraft = database.queryOne<{ recipe_id: string }>(
      "SELECT recipe_id FROM recipe_drafts WHERE draft_id = ?",
      [version.source_draft_id]
    );
    if (!sourceDraft || sourceDraft.recipe_id !== version.recipe_id) {
      throw new Error(`Migration 017 found a cross-Recipe source Draft for Version ${version.recipe_version_id}.`);
    }
    const draftLines = database.queryMany<SemanticLine>(
      "SELECT position, ingredient_id, ingredient_canonical_name, ingredient_measurement_dimension, ingredient_status, ingredient_created_at, quantity_coefficient, quantity_scale, quantity_unit_code, quantity_dimension FROM recipe_draft_lines WHERE draft_id = ? ORDER BY position",
      [version.source_draft_id]
    );
    const versionLines = database.queryMany<SemanticLine>(
      "SELECT position, ingredient_id, ingredient_canonical_name, ingredient_measurement_dimension, ingredient_status, ingredient_created_at, quantity_coefficient, quantity_scale, quantity_unit_code, quantity_dimension FROM recipe_version_lines WHERE recipe_version_id = ? ORDER BY position",
      [version.recipe_version_id]
    );
    if (draftLines.length !== versionLines.length) {
      throw new Error(`Migration 017 cannot pair Version ${version.recipe_version_id} with its source Draft.`);
    }
    for (let index = 0; index < versionLines.length; index += 1) {
      const draftLine = draftLines[index]!;
      const versionLine = versionLines[index]!;
      if (!sameLine(draftLine, versionLine)) {
        throw new Error(`Migration 017 found ambiguous Line evidence for Version ${version.recipe_version_id}.`);
      }
      const mapping = database.queryOne<{ recipe_line_id: string }>(
        "SELECT recipe_line_id FROM recipe_017_draft_line_map WHERE draft_id = ? AND position = ?",
        [version.source_draft_id, versionLine.position]
      );
      if (!mapping) throw new Error(`Migration 017 is missing a source Draft Line mapping.`);
      database.execute(
        "INSERT INTO recipe_017_version_line_map (recipe_version_id, position, recipe_line_id) VALUES (?, ?, ?)",
        [version.recipe_version_id, versionLine.position, mapping.recipe_line_id]
      );
    }
  }
}
