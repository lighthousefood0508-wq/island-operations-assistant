import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = path.join(projectRoot, "src");

function filesUnder(directory: string, extensions: readonly string[]): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(entryPath, extensions);
    return extensions.some((extension) => entry.name.endsWith(extension)) ? [entryPath] : [];
  });
}

function assertNoTerms(content: string, terms: readonly string[], label: string): void {
  const lowered = content.toLowerCase();
  const found = terms.find((term) => lowered.includes(term.toLowerCase()));
  assert.equal(found, undefined, `${label} must not contain ${found}.`);
}

function assertNoCrossDomainImports(directory: string, forbiddenSegment: string): void {
  for (const filename of filesUnder(directory, [".ts"])) {
    const content = readFileSync(filename, "utf8");
    const imports = content.matchAll(/(?:from\s+|import\s*\()\s*["']([^"']+)["']/g);
    for (const match of imports) {
      assert.equal(match[1]?.replaceAll("\\", "/").includes(forbiddenSegment), false, `${filename} crosses a domain boundary.`);
    }
  }
}

test("SQL boundary guard protects domain internals", () => {
  const domainsRoot = path.join(sourceRoot, "domains");
  for (const filename of filesUnder(path.join(domainsRoot, "operations"), [".ts", ".sql"])) {
    assertNoTerms(readFileSync(filename, "utf8"), ["cost_"], filename);
  }
  for (const filename of filesUnder(path.join(domainsRoot, "cost"), [".ts", ".sql"])) {
    assertNoTerms(readFileSync(filename, "utf8"), ["operations_"], filename);
  }
  for (const filename of filesUnder(path.join(domainsRoot, "catalog"), [".ts", ".sql"])) {
    assertNoTerms(readFileSync(filename, "utf8"), ["operations_orders", "cost_boms", "cost_inventory_transactions"], filename);
  }
  assert.throws(() => assertNoTerms("SELECT * FROM cost_boms", ["cost_"], "fixture"));
});

test("import boundary guard allows shared contracts but blocks domain internals", () => {
  const domainsRoot = path.join(sourceRoot, "domains");
  assertNoCrossDomainImports(path.join(domainsRoot, "operations"), "/domains/cost/");
  assertNoCrossDomainImports(path.join(domainsRoot, "cost"), "/domains/operations/");
  assertNoCrossDomainImports(path.join(domainsRoot, "catalog"), "/domains/operations/");
  assertNoCrossDomainImports(path.join(domainsRoot, "catalog"), "/domains/cost/");
  assert.throws(() => assert.equal("../domains/cost/internal".includes("/domains/cost/"), false));
});

test("migration business tables have approved prefixes only", () => {
  const migrationFiles = filesUnder(path.join(projectRoot, "migrations"), [".sql"]);
  const allowedSystemTables = new Set(["schema_migrations", "users", "roles", "user_roles", "audit_logs", "system_settings"]);
  for (const filename of migrationFiles) {
    const statements = readFileSync(filename, "utf8").matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_]+)/g);
    for (const statement of statements) {
      const tableName = statement[1];
      assert.ok(tableName && (allowedSystemTables.has(tableName) || /^(catalog|operations|cost)_/.test(tableName)), `Invalid table prefix: ${tableName}`);
    }
  }
});

test("contract freeze inventory is explicit", () => {
  const contractsDirectory = path.join(sourceRoot, "shared", "contracts");
  const contractFiles = filesUnder(contractsDirectory, [".ts"]).map((filename) => path.basename(filename));
  assert.ok(contractFiles.includes("product-contract.ts"));
  assert.ok(contractFiles.includes("sales-contract.ts"));
  assert.match(readFileSync(path.join(contractsDirectory, "product-contract.ts"), "utf8"), /PRODUCT_CONTRACT_VERSION = "1"/);
  assert.match(readFileSync(path.join(contractsDirectory, "sales-contract.ts"), "utf8"), /SALES_CONTRACT_VERSION = "1"/);
});

test("forbidden infrastructure guard keeps the Phase 0.5 runtime simple", () => {
  const productionFiles = filesUnder(sourceRoot, [".ts"]).filter((filename) => !filename.includes(`${path.sep}tests${path.sep}`));
  for (const filename of productionFiles) {
    assertNoTerms(readFileSync(filename, "utf8"), ["kafka", "rabbitmq", "cqrs", "microservice", "message queue"], filename);
  }
  assert.throws(() => assertNoTerms("kafka client", ["kafka"], "fixture"));
});

test("SQLite driver remains isolated in shared database infrastructure", () => {
  const driverFiles = filesUnder(sourceRoot, [".ts"])
    .filter((filename) => !filename.includes(`${path.sep}tests${path.sep}`))
    .filter((filename) => readFileSync(filename, "utf8").includes("better-sqlite3"));
  assert.deepEqual(driverFiles.map((filename) => path.relative(sourceRoot, filename).replaceAll("\\", "/")), ["shared/database/better-sqlite3-adapter.ts", "shared/database/database-provider.ts"]);
  assert.equal(filesUnder(sourceRoot, [".ts"])
    .filter((filename) => !filename.includes(`${path.sep}tests${path.sep}`))
    .some((filename) => readFileSync(filename, "utf8").includes("node:sqlite")), false);
});
