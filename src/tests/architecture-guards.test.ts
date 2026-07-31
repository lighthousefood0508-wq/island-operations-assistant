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

function importedSpecifiers(filename: string): string[] {
  const content = readFileSync(filename, "utf8");
  return Array.from(
    content.matchAll(/(?:from\s+|import\s*\()\s*["']([^"']+)["']/g),
    (match) => match[1] ?? ""
  );
}

function resolveSourceImport(filename: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const resolved = path.resolve(path.dirname(filename), specifier);
  return resolved.endsWith(".js") ? `${resolved.slice(0, -3)}.ts` : resolved;
}

test("SQL boundary guard protects domain internals", () => {
  const domainsRoot = path.join(sourceRoot, "domains");
  for (const filename of filesUnder(path.join(domainsRoot, "operations"), [".ts", ".sql"])) {
    const content = readFileSync(filename, "utf8")
      .replaceAll("unit_cost_snapshot", "approved_snapshot_column")
      .replaceAll("cost_status", "approved_status_column");
    assertNoTerms(content, ["cost_", "catalog_", "catalogservice", "getpublishedproducts"], filename);
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
  assertNoCrossDomainImports(path.join(domainsRoot, "operations"), "/domains/catalog/");
  assertNoCrossDomainImports(path.join(domainsRoot, "cost"), "/domains/operations/");
  assertNoCrossDomainImports(path.join(domainsRoot, "catalog"), "/domains/operations/");
  assertNoCrossDomainImports(path.join(domainsRoot, "catalog"), "/domains/cost/");
  assert.throws(() => assert.equal("../domains/cost/internal".includes("/domains/cost/"), false));
});

test("Measurement Foundation internals remain isolated behind the published contract", () => {
  const recipeRoot = path.join(sourceRoot, "domains", "recipe");
  const measurementRoot = path.join(recipeRoot, "measurement");
  const contractPath = path.join(
    recipeRoot,
    "contracts",
    "measurement-foundation-contract.ts"
  );
  const recipePublicIndex = path.join(recipeRoot, "index.ts");

  for (const filename of filesUnder(measurementRoot, [".ts"])) {
    for (const specifier of importedSpecifiers(filename)) {
      const target = resolveSourceImport(filename, specifier);
      assert.ok(
        target !== null &&
          (target.startsWith(`${measurementRoot}${path.sep}`) || target === contractPath),
        `${filename} imports outside Measurement Foundation or its published contract: ${specifier}`
      );
    }
  }

  const productionFiles = filesUnder(sourceRoot, [".ts"])
    .filter((filename) => !filename.includes(`${path.sep}tests${path.sep}`))
    .filter((filename) => !filename.startsWith(`${measurementRoot}${path.sep}`))
    .filter((filename) => filename !== recipePublicIndex);
  for (const filename of productionFiles) {
    for (const specifier of importedSpecifiers(filename)) {
      const target = resolveSourceImport(filename, specifier);
      assert.equal(
        target?.startsWith(`${measurementRoot}${path.sep}`) ?? false,
        false,
        `${filename} imports Measurement internals instead of the published contract.`
      );
    }
  }

  const publicIndexSource = readFileSync(recipePublicIndex, "utf8");
  assert.doesNotMatch(
    publicIndexSource,
    /measurement-normalizer|measurement-unit-resolver|unit-catalog|measurement-conversion-ratio|exact-measurement-quantity/
  );
  assert.match(publicIndexSource, /measurement-foundation-contract/);
});

test("Ingredient Measurement Profile internals remain behind versioned contracts", () => {
  const recipeRoot = path.join(sourceRoot, "domains", "recipe");
  const profileRoot = path.join(recipeRoot, "measurement-profile");
  const profileContract = path.join(
    recipeRoot,
    "contracts",
    "ingredient-measurement-profile-contract.ts"
  );
  const measurementContract = path.join(
    recipeRoot,
    "contracts",
    "measurement-foundation-contract.ts"
  );
  const recipePublicIndex = path.join(recipeRoot, "index.ts");

  for (const filename of filesUnder(profileRoot, [".ts"])) {
    for (const specifier of importedSpecifiers(filename)) {
      const target = resolveSourceImport(filename, specifier);
      assert.ok(
        target !== null
          && (
            target.startsWith(`${profileRoot}${path.sep}`)
            || target === profileContract
            || target === measurementContract
          ),
        `${filename} imports outside Ingredient Measurement Profile contracts: ${specifier}`
      );
    }
    assertNoTerms(
      readFileSync(filename, "utf8"),
      [
        "better-sqlite3",
        "node:sqlite",
        "/persistence/",
        "domains/cost",
        "recipe-aggregate",
        "MeasurementConversionRatio",
        "unit-catalog"
      ],
      filename
    );
  }

  const productionFiles = filesUnder(sourceRoot, [".ts"])
    .filter((filename) => !filename.includes(`${path.sep}tests${path.sep}`))
    .filter((filename) => !filename.startsWith(`${profileRoot}${path.sep}`))
    .filter((filename) => filename !== recipePublicIndex);
  for (const filename of productionFiles) {
    for (const specifier of importedSpecifiers(filename)) {
      const target = resolveSourceImport(filename, specifier);
      assert.equal(
        target?.startsWith(`${profileRoot}${path.sep}`) ?? false,
        false,
        `${filename} imports Ingredient Measurement Profile internals.`
      );
    }
  }

  const publicIndexSource = readFileSync(recipePublicIndex, "utf8");
  assert.match(publicIndexSource, /ingredient-measurement-profile-contract/);
  assert.doesNotMatch(
    publicIndexSource,
    /measurement-profile\/(?:ingredient|identities|errors|profile-validator)/
  );
  assertNoTerms(
    readFileSync(profileContract, "utf8"),
    ["conversionRatio", "numerator", "denominator"],
    profileContract
  );
  const profileValidatorSource = readFileSync(
    path.join(profileRoot, "profile-validator.ts"),
    "utf8"
  );
  assert.doesNotMatch(
    profileValidatorSource,
    /CANONICAL_UNITS|mass\s*:\s*["']g|volume\s*:\s*["']ml|count\s*:\s*["']each/
  );
  assert.match(profileValidatorSource, /unitResolver\.resolveUnit/);
});

test("Canonical Ingredient internals remain behind the published contract", () => {
  const recipeRoot = path.join(sourceRoot, "domains", "recipe");
  const ingredientRoot = path.join(recipeRoot, "ingredient-catalog");
  const ingredientPersistenceRoot = path.join(ingredientRoot, "persistence");
  const ingredientInfrastructureRoot = path.join(ingredientRoot, "infrastructure");
  const ingredientContract = path.join(
    recipeRoot,
    "contracts",
    "canonical-ingredient-contract.ts"
  );
  const databaseAdapter = path.join(
    sourceRoot,
    "shared",
    "database",
    "database-adapter.ts"
  );
  const recipePublicIndex = path.join(recipeRoot, "index.ts");

  for (const filename of filesUnder(ingredientRoot, [".ts"])) {
    for (const specifier of importedSpecifiers(filename)) {
      const target = resolveSourceImport(filename, specifier);
      const isInfrastructure = filename.startsWith(
        `${ingredientInfrastructureRoot}${path.sep}`
      );
      assert.ok(
        target !== null
          && (
            target.startsWith(`${ingredientRoot}${path.sep}`)
            || target === ingredientContract
            || (isInfrastructure && target === databaseAdapter)
          ),
        `${filename} imports outside Canonical Ingredient or its published contract: ${specifier}`
      );
      if (
        !filename.startsWith(`${ingredientPersistenceRoot}${path.sep}`)
        && !isInfrastructure
      ) {
        assert.equal(
          target?.startsWith(`${ingredientPersistenceRoot}${path.sep}`)
            || target?.startsWith(`${ingredientInfrastructureRoot}${path.sep}`)
            || false,
          false,
          `${filename} imports Canonical Ingredient persistence or Infrastructure.`
        );
      }
    }
    assertNoTerms(
      readFileSync(filename, "utf8"),
      [
        "better-sqlite3",
        "node:sqlite",
        "domains/cost",
        "recipe-aggregate",
        "measurement-profile/",
        "measurement/"
      ],
      filename
    );
  }

  for (const filename of filesUnder(ingredientPersistenceRoot, [".ts"])) {
    assertNoTerms(
      readFileSync(filename, "utf8"),
      ["shared/database", "/infrastructure/"],
      filename
    );
  }

  const productionFiles = filesUnder(sourceRoot, [".ts"])
    .filter((filename) => !filename.includes(`${path.sep}tests${path.sep}`))
    .filter((filename) => !filename.startsWith(`${ingredientRoot}${path.sep}`))
    .filter((filename) => filename !== recipePublicIndex);
  for (const filename of productionFiles) {
    for (const specifier of importedSpecifiers(filename)) {
      const target = resolveSourceImport(filename, specifier);
      assert.equal(
        target?.startsWith(`${ingredientRoot}${path.sep}`) ?? false,
        false,
        `${filename} imports Canonical Ingredient internals.`
      );
    }
  }

  const publicIndexSource = readFileSync(recipePublicIndex, "utf8");
  assert.match(publicIndexSource, /canonical-ingredient-contract/);
  assert.doesNotMatch(publicIndexSource, /ingredient-catalog\//);
  assertNoTerms(
    readFileSync(ingredientContract, "utf8"),
    [
      "baseUnit",
      "canonicalUnit",
      "conversionRatio",
      "numerator",
      "denominator",
      "supplierId",
      "brandId",
      "packageSize"
    ],
    ingredientContract
  );
});

test("OPEN Event reads only Operations-owned product snapshots", () => {
  const operationsRoot = path.join(sourceRoot, "domains", "operations");
  for (const filename of filesUnder(operationsRoot, [".ts", ".sql"])) {
    assertNoTerms(readFileSync(filename, "utf8"), ["catalog_", "catalogservice", "getpublishedproducts"], filename);
  }
  assert.throws(() => assertNoTerms("CatalogService.getPublishedProducts()", ["catalogservice", "getpublishedproducts"], "fixture"));
});

test("migration business tables have approved prefixes only", () => {
  const migrationFiles = filesUnder(path.join(projectRoot, "migrations"), [".sql"]);
  const allowedSystemTables = new Set(["schema_migrations", "users", "roles", "user_roles", "audit_logs", "system_settings"]);
  for (const filename of migrationFiles) {
    const statements = readFileSync(filename, "utf8").matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_]+)/g);
    for (const statement of statements) {
      const tableName = statement[1];
      assert.ok(tableName && (allowedSystemTables.has(tableName) || /^(catalog|recipe|operations|cost)_/.test(tableName)), `Invalid table prefix: ${tableName}`);
    }
  }
});

test("contract freeze inventory is explicit", () => {
  const contractsDirectory = path.join(sourceRoot, "shared", "contracts");
  const contractFiles = filesUnder(contractsDirectory, [".ts"]).map((filename) => path.basename(filename));
  assert.ok(contractFiles.includes("product-contract.ts"));
  assert.ok(contractFiles.includes("sales-contract.ts"));
  assert.match(readFileSync(path.join(contractsDirectory, "product-contract.ts"), "utf8"), /PRODUCT_CONTRACT_VERSION = "2"/);
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
