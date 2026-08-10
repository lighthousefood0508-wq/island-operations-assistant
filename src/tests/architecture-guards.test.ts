import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
    .filter((filename) =>
      filename !== recipePublicIndex
      && !filename.endsWith(
        `${path.sep}server${path.sep}app${path.sep}cost-back-office-service.ts`
      )
    );
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

  const profileDomainFiles = filesUnder(profileRoot, [".ts"])
    .filter((filename) =>
      !filename.includes(`${path.sep}persistence${path.sep}`)
      && !filename.includes(`${path.sep}infrastructure${path.sep}`)
    );
  for (const filename of profileDomainFiles) {
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

  const profilePersistenceFiles = filesUnder(
    path.join(profileRoot, "persistence"),
    [".ts"]
  );
  const profileInfrastructureFiles = filesUnder(
    path.join(profileRoot, "infrastructure"),
    [".ts"]
  );
  for (const filename of [
    ...profilePersistenceFiles,
    ...profileInfrastructureFiles
  ]) {
    assertNoTerms(
      readFileSync(filename, "utf8"),
      [
        "better-sqlite3",
        "node:sqlite",
        "domains/cost",
        "recipe-aggregate",
        "MeasurementConversionRatio",
        "unit-catalog"
      ],
      filename
    );
  }
  for (const filename of profilePersistenceFiles) {
    for (const specifier of importedSpecifiers(filename)) {
      const target = resolveSourceImport(filename, specifier);
      assert.ok(
        specifier === "node:util"
        || (
          target !== null
          && (
            target.startsWith(`${profileRoot}${path.sep}`)
            || target === profileContract
            || target === measurementContract
          )
        ),
        `${filename} imports outside Profile persistence authority: ${specifier}`
      );
    }
  }
  for (const filename of profileInfrastructureFiles) {
    for (const specifier of importedSpecifiers(filename)) {
      const target = resolveSourceImport(filename, specifier);
      assert.ok(
        target !== null
        && (
          target.startsWith(`${profileRoot}${path.sep}`)
          || target === profileContract
          || target === measurementContract
          || target.endsWith(
            `${path.sep}shared${path.sep}database${path.sep}database-adapter.ts`
          )
        ),
        `${filename} imports outside approved Profile Infrastructure dependencies: ${specifier}`
      );
    }
  }

  const productionFiles = filesUnder(sourceRoot, [".ts"])
    .filter((filename) => !filename.includes(`${path.sep}tests${path.sep}`))
    .filter((filename) => !filename.startsWith(`${profileRoot}${path.sep}`))
    .filter((filename) =>
      filename !== recipePublicIndex
      && !filename.endsWith(
        `${path.sep}server${path.sep}app${path.sep}cost-back-office-service.ts`
      )
    );
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
    /measurement-profile\/(?:ingredient|identities|errors|profile-validator|infrastructure|persistence)/
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

test("Recipe Canonical Projection uses published contracts without creating Cost or Measurement authority", () => {
  const recipeRoot = path.join(sourceRoot, "domains", "recipe");
  const projectionContract = path.join(
    recipeRoot,
    "contracts",
    "recipe-canonical-projection-contract.ts"
  );
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
  const ingredientContract = path.join(
    recipeRoot,
    "contracts",
    "canonical-ingredient-contract.ts"
  );
  const projectionService = path.join(
    recipeRoot,
    "application",
    "recipe-canonical-projection-service.ts"
  );
  const projectionErrors = path.join(
    recipeRoot,
    "application",
    "recipe-canonical-projection-errors.ts"
  );
  const publishedSnapshot = path.join(
    recipeRoot,
    "domain",
    "published-recipe-snapshot.ts"
  );
  const recipePublicIndex = path.join(recipeRoot, "index.ts");

  for (const specifier of importedSpecifiers(projectionContract)) {
    const target = resolveSourceImport(projectionContract, specifier);
    assert.ok(
      target === profileContract
        || target === measurementContract
        || target === ingredientContract,
      `Projection Contract imports unapproved authority: ${specifier}`
    );
  }

  for (const specifier of importedSpecifiers(projectionService)) {
    const target = resolveSourceImport(projectionService, specifier);
    assert.ok(
      target === projectionContract
        || target === profileContract
        || target === measurementContract
        || target === ingredientContract
        || target === projectionErrors
        || target === publishedSnapshot,
      `Projection Service imports outside its approved contracts and Recipe source: ${specifier}`
    );
  }

  assertNoTerms(
    readFileSync(projectionService, "utf8"),
    [
      "domains/cost",
      "better-sqlite3",
      "node:sqlite",
      "/persistence/",
      "/infrastructure/",
      "date.now",
      "randomuuid",
      "parsefloat",
      "linecost",
      "totalcost",
      "costsnapshot",
      "quoteid"
    ],
    projectionService
  );
  assertNoTerms(
    readFileSync(projectionContract, "utf8"),
    [
      "quoteid",
      "price",
      "currency",
      "linecost",
      "totalcost",
      "costsnapshot",
      "repository",
      "database"
    ],
    projectionContract
  );

  const publicIndexSource = readFileSync(recipePublicIndex, "utf8");
  assert.match(publicIndexSource, /recipe-canonical-projection-contract/);
  assert.match(
    readFileSync(profileContract, "utf8"),
    /IngredientMeasurementNormalizationContractV1[\s\S]*normalizeAt/
  );
  assert.doesNotMatch(
    publicIndexSource,
    /recipe-canonical-projection-service|recipe-canonical-projection-errors/
  );
});

test("Cost Quote Normalization Evidence consumes published Measurement contracts without Cost calculation authority", () => {
  const costRoot = path.join(sourceRoot, "domains", "cost");
  const recipeRoot = path.join(sourceRoot, "domains", "recipe");
  const evidenceContract = path.join(
    costRoot,
    "contracts",
    "ingredient-cost-quote-normalization-evidence-contract.ts"
  );
  const evidenceService = path.join(
    costRoot,
    "application",
    "ingredient-cost-quote-normalization-service.ts"
  );
  const evidenceErrors = path.join(
    costRoot,
    "application",
    "ingredient-cost-quote-normalization-errors.ts"
  );
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
  const costSource = path.join(costRoot, "domain", "cost-source.ts");
  const effectivePeriod = path.join(
    costRoot,
    "domain",
    "effective-period.ts"
  );
  const quoteAggregate = path.join(
    costRoot,
    "domain",
    "ingredient-cost-quote.ts"
  );
  const costPublicIndex = path.join(costRoot, "index.ts");

  for (const specifier of importedSpecifiers(evidenceContract)) {
    const target = resolveSourceImport(evidenceContract, specifier);
    assert.ok(
      target === profileContract || target === costSource,
      `Quote Evidence Contract imports unapproved authority: ${specifier}`
    );
  }

  for (const specifier of importedSpecifiers(evidenceService)) {
    const target = resolveSourceImport(evidenceService, specifier);
    assert.ok(
      target === profileContract
        || target === measurementContract
        || target === evidenceContract
        || target === evidenceErrors
        || target === effectivePeriod
        || target === quoteAggregate,
      `Quote Evidence Service imports outside approved contracts and Cost source: ${specifier}`
    );
  }

  assertNoTerms(
    readFileSync(evidenceService, "utf8"),
    [
      "measurement-profile/ingredient",
      "measurement-profile/profile",
      "/measurement/measurement",
      "recipe-aggregate",
      "published-recipe-snapshot",
      "better-sqlite3",
      "node:sqlite",
      "/persistence/",
      "/infrastructure/",
      "date.now",
      "randomuuid",
      "parsefloat",
      "math.round",
      "\"bag\"",
      "\"box\"",
      "\"package\"",
      "\"carton\"",
      "\"bundle\"",
      "normalizedunitcost",
      "unitcost",
      "linecost",
      "totalcost",
      "costsnapshot"
    ],
    evidenceService
  );
  assertNoTerms(
    readFileSync(evidenceContract, "utf8"),
    [
      "normalizedunitcost",
      "unitcost",
      "linecost",
      "totalcost",
      "recipecost",
      "costsnapshot",
      "repository",
      "database"
    ],
    evidenceContract
  );

  const publicIndexSource = readFileSync(costPublicIndex, "utf8");
  assert.match(
    publicIndexSource,
    /ingredient-cost-quote-normalization-evidence-contract/
  );
  assert.doesNotMatch(
    publicIndexSource,
    /ingredient-cost-quote-normalization-service|ingredient-cost-quote-normalization-errors/
  );
});

test("Recipe Costing Contract v2 remains a pure public wrapper over Canonical Projection", () => {
  const recipeRoot = path.join(sourceRoot, "domains", "recipe");
  const costingContract = path.join(
    recipeRoot,
    "contracts",
    "recipe-costing-contract-v2.ts"
  );
  const costingService = path.join(
    recipeRoot,
    "application",
    "recipe-costing-contract-v2-service.ts"
  );
  const costingErrors = path.join(
    recipeRoot,
    "application",
    "recipe-costing-contract-v2-errors.ts"
  );
  const projectionContract = path.join(
    recipeRoot,
    "contracts",
    "recipe-canonical-projection-contract.ts"
  );
  const recipePublicIndex = path.join(recipeRoot, "index.ts");

  for (const specifier of importedSpecifiers(costingContract)) {
    assert.equal(
      resolveSourceImport(costingContract, specifier),
      projectionContract,
      `Costing Contract imports unapproved authority: ${specifier}`
    );
  }

  for (const specifier of importedSpecifiers(costingService)) {
    const target = resolveSourceImport(costingService, specifier);
    assert.ok(
      target === projectionContract
        || target === costingContract
        || target === costingErrors,
      `Costing Contract Service imports outside its approved Recipe boundary: ${specifier}`
    );
  }

  assertNoTerms(
    readFileSync(costingService, "utf8"),
    [
      "domains/cost",
      "ingredient-cost-quote",
      "measurement-profile/",
      "/measurement/",
      "repository",
      "better-sqlite3",
      "node:sqlite",
      "/persistence/",
      "/infrastructure/",
      "date.now",
      "new date",
      "randomuuid",
      "parsefloat",
      "math.round",
      "purchaseamount",
      "normalizedunitcost",
      "linecost",
      "totalcost",
      "costsnapshot"
    ],
    costingService
  );
  assertNoTerms(
    readFileSync(costingContract, "utf8"),
    [
      "quoteid",
      "price",
      "currency",
      "purchaseamount",
      "normalizedunitcost",
      "linecost",
      "totalcost",
      "costsnapshot",
      "repository",
      "database"
    ],
    costingContract
  );

  const publicIndexSource = readFileSync(recipePublicIndex, "utf8");
  assert.match(publicIndexSource, /recipe-costing-contract-v2/);
  assert.doesNotMatch(
    publicIndexSource,
    /recipe-costing-contract-v2-service|recipe-costing-contract-v2-errors/
  );
});

test("Cost Evaluation remains read-only, exact, and behind published contracts", () => {
  const costRoot = path.join(sourceRoot, "domains", "cost");
  const recipeRoot = path.join(sourceRoot, "domains", "recipe");
  const evaluationDomain = path.join(
    costRoot,
    "domain",
    "recipe-cost-evaluation.ts"
  );
  const rationalDomain = path.join(costRoot, "domain", "exact-rational.ts");
  const readUow = path.join(
    costRoot,
    "domain",
    "cost-evaluation-read-unit-of-work.ts"
  );
  const evaluationService = path.join(
    costRoot,
    "application",
    "recipe-cost-evaluation-service.ts"
  );
  const evaluationErrors = path.join(
    costRoot,
    "application",
    "recipe-cost-evaluation-errors.ts"
  );
  const sqliteReadUow = path.join(
    costRoot,
    "infrastructure",
    "sqlite-cost-evaluation-read-unit-of-work.ts"
  );
  const quoteRepository = path.join(
    costRoot,
    "infrastructure",
    "sqlite-cost-repository.ts"
  );
  const databaseAdapter = path.join(
    sourceRoot,
    "shared",
    "database",
    "database-adapter.ts"
  );
  const recipeCostingContract = path.join(
    recipeRoot,
    "contracts",
    "recipe-costing-contract-v2.ts"
  );
  const recipeProjectionContract = path.join(
    recipeRoot,
    "contracts",
    "recipe-canonical-projection-contract.ts"
  );
  const measurementContract = path.join(
    recipeRoot,
    "contracts",
    "measurement-foundation-contract.ts"
  );
  const quoteEvidenceContract = path.join(
    costRoot,
    "contracts",
    "ingredient-cost-quote-normalization-evidence-contract.ts"
  );
  const quoteAggregate = path.join(
    costRoot,
    "domain",
    "ingredient-cost-quote.ts"
  );
  const costRepositoryContract = path.join(
    costRoot,
    "domain",
    "cost-repository.ts"
  );
  const identities = path.join(costRoot, "domain", "identities.ts");
  const domainErrors = path.join(costRoot, "domain", "errors.ts");
  const effectivePeriod = path.join(
    costRoot,
    "domain",
    "effective-period.ts"
  );
  const costIndex = path.join(costRoot, "index.ts");

  for (const specifier of importedSpecifiers(evaluationDomain)) {
    const target = resolveSourceImport(evaluationDomain, specifier);
    assert.ok(
      target === measurementContract
        || target === recipeCostingContract
        || target === quoteEvidenceContract
        || target === quoteAggregate,
      `Cost Evaluation Domain imports unapproved authority: ${specifier}`
    );
  }

  for (const specifier of importedSpecifiers(evaluationService)) {
    const target = resolveSourceImport(evaluationService, specifier);
    assert.ok(
      target === recipeProjectionContract
        || target === recipeCostingContract
        || target === quoteEvidenceContract
        || target === readUow
        || target === domainErrors
        || target === rationalDomain
        || target === effectivePeriod
        || target === identities
        || target === evaluationDomain
        || target === evaluationErrors,
      `Cost Evaluation Service imports outside approved contracts and Cost Domain: ${specifier}`
    );
  }

  for (const specifier of importedSpecifiers(sqliteReadUow)) {
    const target = resolveSourceImport(sqliteReadUow, specifier);
    assert.ok(
      target === databaseAdapter
        || target === readUow
        || target === quoteRepository,
      `Cost Evaluation SQLite UoW imports unapproved authority: ${specifier}`
    );
  }

  assertNoTerms(
    readFileSync(readUow, "utf8"),
    [
      "save(",
      "savewithexpectedversion",
      "execute(sql",
      "transactionimmediate",
      "costrepository"
    ],
    readUow
  );
  assertNoTerms(
    readFileSync(sqliteReadUow, "utf8"),
    [
      ".save(",
      "savewithexpectedversion",
      "transactionimmediate",
      "begin immediate"
    ],
    sqliteReadUow
  );
  assert.match(readFileSync(sqliteReadUow, "utf8"), /\.transaction\(/);
  assertNoTerms(
    readFileSync(evaluationService, "utf8"),
    [
      "recipe/application",
      "measurement-profile/",
      "/measurement/",
      "ingredient-cost-quote-normalization-service",
      "better-sqlite3",
      "node:sqlite",
      "/persistence/",
      "/infrastructure/",
      "date.now",
      "new date",
      "randomuuid",
      "parsefloat",
      "math.round",
      "number(bigint",
      "costsnapshot",
      "insert into",
      "update ",
      "delete from",
      "recordedat >",
      "sort("
    ],
    evaluationService
  );
  assertNoTerms(
    readFileSync(rationalDomain, "utf8"),
    [
      "parsefloat",
      "math.round",
      "number(bigint",
      "tofixed",
      "costsnapshot"
    ],
    rationalDomain
  );
  assertNoTerms(
    readFileSync(evaluationDomain, "utf8"),
    [
      "costsnapshot",
      "repository",
      "database",
      "sqlite",
      "recordedat",
      "processingat"
    ],
    evaluationDomain
  );

  const publicIndexSource = readFileSync(costIndex, "utf8");
  assert.match(publicIndexSource, /recipe-cost-evaluation/);
  assert.match(publicIndexSource, /cost-evaluation-read-unit-of-work/);
  assert.doesNotMatch(
    publicIndexSource,
    /recipe-cost-evaluation-service/
  );
  assert.doesNotMatch(
    publicIndexSource,
    /SqliteCostEvaluationReadUnitOfWork|sqlite-cost-evaluation-read-unit-of-work/,
    "Cost root must not publish the SQLite Evaluation adapter."
  );
  assert.equal(
    importedSpecifiers(readUow)
      .map((specifier) => resolveSourceImport(readUow, specifier))
      .includes(costRepositoryContract),
    false,
    "Read UoW must not expose the full Cost Repository."
  );
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
  const ingredientManagementContract = path.join(
    recipeRoot,
    "contracts",
    "canonical-ingredient-management-contract.ts"
  );
  const databaseAdapter = path.join(
    sourceRoot,
    "shared",
    "database",
    "database-adapter.ts"
  );
  const recipePublicIndex = path.join(recipeRoot, "index.ts");
  const ingredientRepository = path.join(
    ingredientRoot,
    "canonical-ingredient-repository.ts"
  );
  const sqliteIngredientRepository = path.join(
    ingredientInfrastructureRoot,
    "sqlite-canonical-ingredient-repository.ts"
  );
  const managementReadService = path.join(
    ingredientRoot,
    "application",
    "canonical-ingredient-management-read-service.ts"
  );
  const serverComposition = path.join(sourceRoot, "server", "index.ts");
  const managementServerAdapter = path.join(
    sourceRoot,
    "server",
    "app",
    "canonical-ingredient-management-service.ts"
  );
  const routes = path.join(sourceRoot, "server", "app", "routes.ts");

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
            || target === ingredientManagementContract
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
    .filter((filename) =>
      filename !== recipePublicIndex
      && !filename.endsWith(
        `${path.sep}server${path.sep}app${path.sep}cost-back-office-service.ts`
      )
    );
  for (const filename of productionFiles) {
    for (const specifier of importedSpecifiers(filename)) {
      const target = resolveSourceImport(filename, specifier);
      const isApproved003BCompositionImport =
        filename === serverComposition
        && target === sqliteIngredientRepository;
      assert.equal(
        (target?.startsWith(`${ingredientRoot}${path.sep}`) ?? false)
          && !isApproved003BCompositionImport,
        false,
        `${filename} imports Canonical Ingredient internals outside the exact server/index.ts composition exception.`
      );
    }
  }

  const publicIndexSource = readFileSync(recipePublicIndex, "utf8")
    .replaceAll("\r\n", "\n");
  const accepted003AMarker = "export type {\n  ArchiveCanonicalIngredientCommandV1,";
  const accepted003AOffset = publicIndexSource.indexOf(accepted003AMarker);
  assert.notEqual(accepted003AOffset, -1, "Recipe index publishes the 003A surface.");
  const accepted003BMarker = "export {\n  CanonicalIngredientManagementReadService";
  const accepted003BOffset = publicIndexSource.indexOf(accepted003BMarker);
  assert.notEqual(accepted003BOffset, -1, "Recipe index publishes the 003B read Service.");
  const pre003APublicIndex = publicIndexSource.slice(0, accepted003AOffset);
  const accepted003ASurface = publicIndexSource.slice(
    accepted003AOffset,
    accepted003BOffset
  );
  const accepted003BSurface = publicIndexSource.slice(accepted003BOffset);
  assert.equal(
    createHash("sha256").update(pre003APublicIndex).digest("hex"),
    "4f55d49ff0c054ff66ba802489f4e5bd832d4405dfe7c4c09470076a0ff8e616",
    "003A must preserve every pre-existing Recipe public export byte-for-byte."
  );
  assert.equal(
    accepted003ASurface,
    `export type {
  ArchiveCanonicalIngredientCommandV1,
  ArchiveCanonicalIngredientResultV1,
  CanonicalIngredientDuplicateCandidateV1,
  CanonicalIngredientDuplicateWarningV1,
  CanonicalIngredientManagementRecordV1,
  RenameCanonicalIngredientCommandV1,
  RenameCanonicalIngredientResultV1
} from "./contracts/canonical-ingredient-management-contract.js";
export {
  CanonicalIngredientAlreadyArchived,
  CanonicalIngredientArchivedRenameRejected,
  CanonicalIngredientLifecycleNotFound,
  CanonicalIngredientLifecyclePersistenceFailure,
  CanonicalIngredientLifecycleValidationFailure,
  CanonicalIngredientLifecycleVersionConflict,
  InvalidCanonicalIngredientLifecycleTransition
} from "./ingredient-catalog/application/errors.js";
export {
  CanonicalIngredientLifecycleService
} from "./ingredient-catalog/application/canonical-ingredient-lifecycle-service.js";
`
  );
  assert.equal(
    accepted003BSurface,
    `export {
  CanonicalIngredientManagementReadService
} from "./ingredient-catalog/application/canonical-ingredient-management-read-service.js";
`
  );
  assert.match(pre003APublicIndex, /canonical-ingredient-contract/);
  assert.doesNotMatch(pre003APublicIndex, /ingredient-catalog\//);

  const lifecycleService = path.join(
    ingredientRoot,
    "application",
    "canonical-ingredient-lifecycle-service.ts"
  );
  const lifecycleErrors = path.join(
    ingredientRoot,
    "application",
    "errors.ts"
  );
  const lifecycleSource = readFileSync(lifecycleService, "utf8");
  const lifecycleErrorSource = readFileSync(lifecycleErrors, "utf8");
  const managementReadSource = readFileSync(managementReadService, "utf8");
  const managementContractSource = readFileSync(
    ingredientManagementContract,
    "utf8"
  );
  const repositorySource = readFileSync(ingredientRepository, "utf8");
  const repositoryMethods = Array.from(
    repositorySource.matchAll(/^\s{2}(\w+)\s*\(/gm),
    (match) => match[1]
  );
  assert.deepEqual(
    repositoryMethods,
    [
      "saveNew",
      "saveWithExpectedVersion",
      "findById",
      "listActiveForManagement",
      "listArchivedForManagement",
      "searchByName",
      "findDuplicateCandidates"
    ],
    "003B adds only the two accepted management-read methods to the Port."
  );
  const repositoryImplementers = filesUnder(sourceRoot, [".ts"])
    .filter((filename) => filename !== path.join(sourceRoot, "tests", "architecture-guards.test.ts"))
    .filter((filename) =>
      /implements\s+CanonicalIngredientRepository/.test(
        readFileSync(filename, "utf8")
      )
    )
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(repositoryImplementers, [
    "src/domains/recipe/ingredient-catalog/infrastructure/sqlite-canonical-ingredient-repository.ts",
    "src/tests/canonical-ingredient-catalog.test.ts"
  ]);
  assert.match(
    lifecycleSource,
    /Pick<[\s\S]*"findById" \| "findDuplicateCandidates" \| "saveWithExpectedVersion"/
  );
  assert.doesNotMatch(
    lifecycleSource,
    /"saveNew"|"searchByName"|listActive|infrastructure|shared\/database/
  );
  assert.match(
    managementReadSource,
    /Pick<[\s\S]*"findById"[\s\S]*"listActiveForManagement"[\s\S]*"listArchivedForManagement"/
  );
  assert.doesNotMatch(
    managementReadSource,
    /saveNew|saveWithExpectedVersion|findDuplicateCandidates|searchByName|infrastructure|shared\/database/
  );
  assert.doesNotMatch(
    managementReadSource,
    /export\s+(?:type|interface)\s+CanonicalIngredientManagementReadRepository/
  );
  assert.match(managementContractSource, /Readonly</);
  assert.match(
    managementContractSource,
    /readonly CanonicalIngredientDuplicateCandidateV1\[\]/
  );
  assert.doesNotMatch(managementContractSource, /Object\.freeze/);
  assert.doesNotMatch(lifecycleErrorSource, /\bcause\b|rawError|sqlite/i);

  const approved003BPaths = new Set([
    "src/domains/recipe/ingredient-catalog/canonical-ingredient-repository.ts",
    "src/domains/recipe/ingredient-catalog/infrastructure/sqlite-canonical-ingredient-repository.ts",
    "src/domains/recipe/ingredient-catalog/application/canonical-ingredient-management-read-service.ts",
    "src/domains/recipe/index.ts",
    "src/server/app/canonical-ingredient-management-service.ts",
    "src/server/app/routes.ts",
    "src/server/index.ts",
    "src/tests/canonical-ingredient-catalog.test.ts",
    "src/tests/canonical-ingredient-persistence.integration.test.ts",
    "src/tests/canonical-ingredient-lifecycle-application.test.ts",
    "src/tests/canonical-ingredient-lifecycle-api.integration.test.ts",
    "src/tests/architecture-guards.test.ts"
  ]);
  const approved003BResponsibilities = new Map<string, readonly RegExp[]>([
    [
      "src/domains/recipe/ingredient-catalog/canonical-ingredient-repository.ts",
      [/listActiveForManagement\s*\(/, /listArchivedForManagement\s*\(/]
    ],
    [
      "src/domains/recipe/ingredient-catalog/infrastructure/sqlite-canonical-ingredient-repository.ts",
      [
        /listActiveForManagement\s*\(/,
        /listArchivedForManagement\s*\(/,
        /ORDER BY name ASC, ingredient_id ASC/
      ]
    ],
    [
      "src/domains/recipe/ingredient-catalog/application/canonical-ingredient-management-read-service.ts",
      [/class CanonicalIngredientManagementReadService/, /listActiveForManagement/, /listArchivedForManagement/]
    ],
    ["src/domains/recipe/index.ts", [/CanonicalIngredientManagementReadService/]],
    [
      "src/server/app/canonical-ingredient-management-service.ts",
      [/class CanonicalIngredientManagementService/, /CanonicalIngredientLifecycleService/, /CanonicalIngredientManagementReadService/]
    ],
    [
      "src/server/app/routes.ts",
      [/canonicalIngredientDetailMatch/, /canonicalIngredientRenameMatch/, /canonicalIngredientArchiveMatch/]
    ],
    [
      "src/server/index.ts",
      [/new SqliteCanonicalIngredientRepository/, /new CanonicalIngredientManagementReadService/, /new CanonicalIngredientLifecycleService/]
    ],
    [
      "src/tests/canonical-ingredient-catalog.test.ts",
      [/ContractFixture implements CanonicalIngredientRepository/, /listActiveForManagement\s*\(/, /listArchivedForManagement\s*\(/]
    ],
    [
      "src/tests/canonical-ingredient-persistence.integration.test.ts",
      [/management reads isolate lifecycle and order by name then identity/, /management reads preserve lifecycle evidence after close and reopen/]
    ],
    [
      "src/tests/canonical-ingredient-lifecycle-application.test.ts",
      [/management read defaults to Active section then Archived section/, /management detail distinguishes missing identity/]
    ],
    [
      "src/tests/canonical-ingredient-lifecycle-api.integration.test.ts",
      [/four registrations provide six management API behaviors and survive restart/, /management API contains persistence failures/]
    ],
    [
      "src/tests/architecture-guards.test.ts",
      [/approved003BResponsibilities/, /approved003BPaths/]
    ]
  ]);
  assert.deepEqual(
    [...approved003BResponsibilities.keys()].sort(),
    [...approved003BPaths].sort(),
    "Every path in the exact 003B allowlist must own an explicit guarded responsibility."
  );
  for (const [relative, patterns] of approved003BResponsibilities) {
    const filename = path.join(projectRoot, ...relative.split("/"));
    assert.equal(existsSync(filename), true, `${relative} is required by the 003B boundary.`);
    const source = readFileSync(filename, "utf8");
    for (const pattern of patterns) {
      assert.match(source, pattern, `${relative} lost an accepted 003B responsibility.`);
    }
  }
  const implementationMarkers = [
    "listActiveForManagement",
    "listArchivedForManagement",
    "CanonicalIngredientManagementReadService",
    "CanonicalIngredientManagementService",
    "/api/admin/canonical-ingredients"
  ];
  const implementationBoundaryFiles = [
    ...filesUnder(sourceRoot, [".ts", ".tsx", ".js", ".jsx"]),
    ...filesUnder(path.join(projectRoot, "migrations"), [".sql", ".ts"]),
    ...filesUnder(path.join(projectRoot, "mockups"), [".html", ".js"])
  ];
  for (const filename of implementationBoundaryFiles) {
    const source = readFileSync(filename, "utf8");
    if (!implementationMarkers.some((marker) => source.includes(marker))) continue;
    const relative = path.relative(projectRoot, filename).replaceAll("\\", "/");
    assert.equal(
      approved003BPaths.has(relative),
      true,
      `${relative} contains 003B implementation outside the exact twelve-path allowlist.`
    );
  }
  const repositoryReferenceFiles = filesUnder(sourceRoot, [".ts"])
    .filter((filename) => /\bCanonicalIngredientRepository\b/.test(readFileSync(filename, "utf8")))
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(repositoryReferenceFiles, [
    "src/domains/recipe/ingredient-catalog/application/canonical-ingredient-lifecycle-service.ts",
    "src/domains/recipe/ingredient-catalog/application/canonical-ingredient-management-read-service.ts",
    "src/domains/recipe/ingredient-catalog/canonical-ingredient-repository.ts",
    "src/domains/recipe/ingredient-catalog/infrastructure/sqlite-canonical-ingredient-repository.ts",
    "src/tests/architecture-guards.test.ts",
    "src/tests/canonical-ingredient-catalog.test.ts"
  ]);
  const lifecycleFixtureSource = readFileSync(
    path.join(sourceRoot, "tests", "canonical-ingredient-lifecycle-application.test.ts"),
    "utf8"
  );
  assert.match(lifecycleFixtureSource, /class RepositoryFixture/);
  for (const method of [
    "findById",
    "findDuplicateCandidates",
    "saveWithExpectedVersion",
    "listActiveForManagement",
    "listArchivedForManagement"
  ]) {
    assert.match(
      lifecycleFixtureSource,
      new RegExp(`${method}\\s*\\(`),
      `The known structural Application fixture must retain ${method}.`
    );
  }

  const managementAdapterTargets = importedSpecifiers(managementServerAdapter)
    .map((specifier) => resolveSourceImport(managementServerAdapter, specifier));
  assert.equal(managementAdapterTargets.includes(recipePublicIndex), true);
  assert.equal(
    managementAdapterTargets.some((target) =>
      target?.startsWith(`${ingredientRoot}${path.sep}`)
    ),
    false,
    "The management server adapter must depend on the public Recipe boundary."
  );
  const routeTargets = importedSpecifiers(routes)
    .map((specifier) => resolveSourceImport(routes, specifier));
  assert.equal(routeTargets.includes(managementServerAdapter), true);
  assert.equal(
    routeTargets.some((target) =>
      target?.startsWith(`${ingredientRoot}${path.sep}`)
    ),
    false,
    "Routes must not import Canonical Ingredient internals."
  );
  const compositionTargets = importedSpecifiers(serverComposition)
    .map((specifier) => resolveSourceImport(serverComposition, specifier));
  assert.equal(compositionTargets.includes(sqliteIngredientRepository), true);
  assert.equal(compositionTargets.includes(recipePublicIndex), true);
  const namespaceProductionFiles = filesUnder(sourceRoot, [".ts", ".tsx"])
    .filter((filename) => !filename.includes(`${path.sep}tests${path.sep}`))
    .filter((filename) =>
      /canonical-ingredients/.test(readFileSync(filename, "utf8"))
    )
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"));
  assert.deepEqual(namespaceProductionFiles, ["src/server/app/routes.ts"]);
  const routesSource = readFileSync(routes, "utf8");
  assert.equal(
    Array.from(routesSource.matchAll(/canonical-ingredients/g)).length,
    4,
    "Exactly four route registrations own the six accepted management behaviors."
  );
  assert.equal(
    Array.from(routesSource.matchAll(/ingredients/g)).length,
    5,
    "Routes may contain only the four accepted management registrations and the existing Cost creation route."
  );
  assert.match(
    routesSource,
    /request\.method === "GET"[\s\S]{0,120}pathname === "\/api\/admin\/canonical-ingredients"/
  );
  assert.match(routesSource, /request\.method === "GET" && canonicalIngredientDetailMatch/);
  assert.match(routesSource, /request\.method === "POST" && canonicalIngredientRenameMatch/);
  assert.match(routesSource, /request\.method === "POST" && canonicalIngredientArchiveMatch/);
  assert.match(routesSource, /\/api\/admin\/cost\/ingredients/);
  assert.doesNotMatch(
    routesSource,
    /(?:POST|PUT|PATCH)[\s\S]{0,160}\/api\/admin\/canonical-ingredients["']\s*\)/,
    "003B must not add a create behavior at the management collection path."
  );
  assert.doesNotMatch(
    routesSource,
    /\/admin\/ingredients|\/api\/admin\/ingredients|pathname === "\/admin\/canonical-ingredients"|renderCanonicalIngredient/i,
    "003B must not add a management UI or navigation route."
  );
  const costBackOfficeSource = readFileSync(
    path.join(sourceRoot, "server", "app", "cost-back-office-service.ts"),
    "utf8"
  );
  assert.doesNotMatch(
    costBackOfficeSource,
    /listActiveForManagement|listArchivedForManagement|CanonicalIngredientManagementReadService|\/api\/admin\/canonical-ingredients/,
    "003B must not transfer management lifecycle authority into Cost Back Office."
  );
  const migration014 = Buffer.from(
    readFileSync(
      path.join(projectRoot, "migrations", "014_recipe_canonical_ingredients.sql"),
      "utf8"
    ).replaceAll("\r\n", "\n"),
    "utf8"
  );
  const migration014Blob = createHash("sha1")
    .update(`blob ${migration014.byteLength}\0`)
    .update(migration014)
    .digest("hex");
  assert.equal(
    migration014Blob,
    "5bcc40cddfe9ba14db7dc6a5e8da2d46f41ee23d",
    "Migration 014 remains outside 003B."
  );
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

test("Cost Back Office is the only approved runtime composition of Cost foundations", () => {
  const composition = path.join(
    sourceRoot,
    "server",
    "app",
    "cost-back-office-service.ts"
  );
  const routes = path.join(sourceRoot, "server", "app", "routes.ts");
  const source = readFileSync(composition, "utf8");
  assert.match(source, /RecipeCostEvaluationService/);
  assert.match(source, /RecipeCanonicalProjectionService/);
  assert.match(source, /IngredientMeasurementNormalizationService/);
  assert.doesNotMatch(
    source,
    /function\s+canonicalUnit|profileDimension\s*===\s*["']mass["']/,
    "Runtime composition must delegate canonical-unit validation to Measurement/Profile authority."
  );
  assertNoTerms(
    source,
    [
      "better-sqlite3",
      "node:sqlite",
      "Math.round",
      "parseFloat",
      "Number("
    ],
    composition
  );
  assertNoTerms(
    readFileSync(routes, "utf8"),
    ["better-sqlite3", "SELECT ", "INSERT ", "UPDATE ", "DELETE "],
    routes
  );
});

test("Recipe SQLite persistence uses the shared database boundary and stays private", () => {
  const recipeRoot = path.join(sourceRoot, "domains", "recipe");
  const sqliteRepository = path.join(
    recipeRoot,
    "infrastructure",
    "sqlite-recipe-repository.ts"
  );
  const databaseAdapter = path.join(
    sourceRoot,
    "shared",
    "database",
    "database-adapter.ts"
  );
  const recipePublicIndex = path.join(recipeRoot, "index.ts");

  const importedTargets = importedSpecifiers(sqliteRepository)
    .map((specifier) => resolveSourceImport(sqliteRepository, specifier));
  assert.equal(importedTargets.includes(databaseAdapter), true);
  assertNoTerms(
    readFileSync(sqliteRepository, "utf8"),
    ["better-sqlite3", "node:sqlite", "domains/cost"],
    sqliteRepository
  );
  assert.doesNotMatch(
    readFileSync(recipePublicIndex, "utf8"),
    /SqliteRecipeRepository|sqlite-recipe-repository/,
    "Recipe root must not publish the SQLite Recipe adapter."
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
