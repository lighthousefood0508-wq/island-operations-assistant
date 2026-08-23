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
  const approved003GComposition = path.join(sourceRoot, "server", "index.ts");

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
      && filename !== approved003GComposition
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

test("PR-MEASUREMENT-001 keeps Measurement Profile Facts resolution inside its exact five-path boundary", () => {
  const recipeRoot = path.join(sourceRoot, "domains", "recipe");
  const measurementRoot = path.join(recipeRoot, "measurement");
  const profileRoot = path.join(recipeRoot, "measurement-profile");
  const contract = path.join(recipeRoot, "contracts", "measurement-foundation-contract.ts");
  const resolver = path.join(measurementRoot, "measurement-profile-facts-resolver.ts");
  const approvedMeasurement001Paths = new Set([
    "src/domains/recipe/contracts/measurement-foundation-contract.ts",
    "src/domains/recipe/measurement/measurement-profile-facts-resolver.ts",
    "src/domains/recipe/index.ts",
    "src/tests/measurement-profile-facts-resolver.test.ts",
    "src/tests/architecture-guards.test.ts"
  ]);
  assert.equal(approvedMeasurement001Paths.size, 5);
  const approvedMeasurement001Responsibilities = new Map<string, readonly RegExp[]>([
    [
      "src/domains/recipe/contracts/measurement-foundation-contract.ts",
      [/MeasurementProfileFactsResolutionContractV1/, /rawDimension/, /ResolvedMeasurementProfileFactsV1/]
    ],
    [
      "src/domains/recipe/measurement/measurement-profile-facts-resolver.ts",
      [/class MeasurementProfileFactsResolver/, /function resolveDimension/, /unitResolver\.resolveUnit/]
    ],
    [
      "src/domains/recipe/index.ts",
      [/MeasurementProfileFactsResolutionContractV1/, /MeasurementProfileFactsResolver/]
    ],
    [
      "src/tests/measurement-profile-facts-resolver.test.ts",
      [/Measurement Profile Facts resolver/, /delegates every raw unit lookup/]
    ],
    [
      "src/tests/architecture-guards.test.ts",
      [/approvedMeasurement001Paths/, /approvedMeasurement001Responsibilities/]
    ]
  ]);
  assert.deepEqual(
    [...approvedMeasurement001Responsibilities.keys()].sort(),
    [...approvedMeasurement001Paths].sort(),
    "Every PR-MEASUREMENT-001 allowlisted path must own an explicit guarded responsibility."
  );
  for (const [relative, patterns] of approvedMeasurement001Responsibilities) {
    const filename = path.join(projectRoot, ...relative.split("/"));
    assert.equal(existsSync(filename), true, `${relative} is required by PR-MEASUREMENT-001.`);
    const content = readFileSync(filename, "utf8");
    for (const pattern of patterns) assert.match(content, pattern);
  }

  const approvedMeasurementFactsConsumers = new Set([
    "src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-creation-service.ts",
    "src/server/index.ts",
    "src/tests/ingredient-measurement-profile-creation-application.test.ts",
    "src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-supersession-service.ts",
    "src/tests/ingredient-measurement-profile-supersession-application.test.ts",
    "src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-reestablishment-service.ts",
    "src/tests/ingredient-measurement-profile-reestablishment-application.test.ts"
  ]);
  const factsResolutionResponsibility = /MeasurementProfileFactsResolution|MeasurementProfileFactsResolver|Measurement Profile Facts resolver/;
  const factsResolutionFiles = [
    ...filesUnder(path.join(projectRoot, "src"), [".ts", ".tsx"]),
    ...filesUnder(path.join(projectRoot, "tests"), [".ts", ".tsx"])
  ]
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"))
    .filter((relative) => !approvedMeasurementFactsConsumers.has(relative))
    .filter((relative) => factsResolutionResponsibility.test(readFileSync(path.join(projectRoot, ...relative.split("/")), "utf8")))
    .sort();
  assert.deepEqual(
    factsResolutionFiles,
    [...approvedMeasurement001Paths].sort(),
    "An unauthorized sixth Measurement Profile Facts responsibility path is not allowed."
  );
  assert.equal(
    factsResolutionResponsibility.test("const extra = new MeasurementProfileFactsResolver();"),
    true,
    "A simulated sixth Measurement Profile Facts responsibility must be detected."
  );

  const resolverSource = readFileSync(resolver, "utf8");
  assertNoTerms(
    resolverSource,
    ["sqlite", "better-sqlite3", "database-adapter", "domains/cost", "server/", "http", "unit_catalog", "unit_definitions", "new map"],
    resolver
  );
  for (const specifier of importedSpecifiers(resolver)) {
    const target = resolveSourceImport(resolver, specifier);
    assert.equal(
      target?.startsWith(`${profileRoot}${path.sep}`) ?? false,
      false,
      "Measurement Profile Facts resolution must not import Profile internals."
    );
    assert.equal(
      target !== null && (target === contract || target.startsWith(`${measurementRoot}${path.sep}`)),
      true,
      `Measurement Profile Facts resolver imports outside Measurement authority: ${specifier}`
    );
  }
  assert.doesNotMatch(
    resolverSource,
    /MeasurementDimensionV1\s*\)|as\s+MeasurementDimensionV1|as\s+any/,
    "Raw dimension must be resolved by Measurement without unsafe caller-style narrowing."
  );
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
  const approved003GCreationService = path.join(
    profileRoot,
    "application",
    "ingredient-measurement-profile-creation-service.ts"
  );
  const canonicalIngredientIdentity = path.join(
    recipeRoot,
    "ingredient-catalog",
    "identities.ts"
  );

  const profileDomainFiles = filesUnder(profileRoot, [".ts"])
    .filter((filename) =>
      !filename.includes(`${path.sep}persistence${path.sep}`)
      && !filename.includes(`${path.sep}infrastructure${path.sep}`)
    );
  for (const filename of profileDomainFiles) {
    for (const specifier of importedSpecifiers(filename)) {
      const target = resolveSourceImport(filename, specifier);
      const isApproved003GCreationDependency =
        (filename === approved003GCreationService
          || filename.endsWith(`${path.sep}ingredient-measurement-profile-supersession-service.ts`)
          || filename.endsWith(`${path.sep}ingredient-measurement-profile-deprecation-service.ts`)
          || filename.endsWith(`${path.sep}ingredient-measurement-profile-reestablishment-service.ts`))
        && (specifier === "node:crypto" || target === canonicalIngredientIdentity);
      assert.ok(
        isApproved003GCreationDependency
          || (target !== null
          && (
            target.startsWith(`${profileRoot}${path.sep}`)
            || target === profileContract
            || target === measurementContract
          )),
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
      && filename !== approved003GCreationService
      && filename !== path.join(sourceRoot, "server", "index.ts")
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
  const approved003GCreationService = path.join(
    recipeRoot,
    "measurement-profile",
    "application",
    "ingredient-measurement-profile-creation-service.ts"
  );
  const managementServerAdapter = path.join(
    sourceRoot,
    "server",
    "app",
    "canonical-ingredient-management-service.ts"
  );
  const routes = path.join(sourceRoot, "server", "app", "routes.ts");
  const ingredientManagementPage = path.join(
    sourceRoot,
    "web",
    "ingredients",
    "page.ts"
  );
  const sharedNavigation = path.join(sourceRoot, "web", "shared", "navigation.ts");

  for (const filename of filesUnder(ingredientRoot, [".ts"])) {
    for (const specifier of importedSpecifiers(filename)) {
      const target = resolveSourceImport(filename, specifier);
      const isInfrastructure = filename.startsWith(
        `${ingredientInfrastructureRoot}${path.sep}`
      );
      const isApproved003FCreationUuid =
        filename.endsWith(
          `${path.sep}application${path.sep}canonical-ingredient-creation-service.ts`
        )
        && specifier === "node:crypto";
      assert.ok(
        isApproved003FCreationUuid
          || (target !== null
          && (
            target.startsWith(`${ingredientRoot}${path.sep}`)
            || target === ingredientContract
            || target === ingredientManagementContract
            || (isInfrastructure && target === databaseAdapter)
          )),
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
      && filename !== path.join(sourceRoot, "server", "index.ts")
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
      const isApproved003GIngredientLookup =
        (filename === approved003GCreationService
          || filename.endsWith(`${path.sep}ingredient-measurement-profile-supersession-service.ts`)
          || filename.endsWith(`${path.sep}ingredient-measurement-profile-deprecation-service.ts`)
          || filename.endsWith(`${path.sep}ingredient-measurement-profile-reestablishment-service.ts`))
        && target?.endsWith(`${path.sep}ingredient-catalog${path.sep}identities.ts`);
      assert.equal(
        (target?.startsWith(`${ingredientRoot}${path.sep}`) ?? false)
          && !isApproved003BCompositionImport
          && !isApproved003GIngredientLookup,
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
  const accepted003FMarker =
    "export {\n  CanonicalIngredientCreationPersistenceFailure,";
  const accepted003FOffset = publicIndexSource.indexOf(accepted003FMarker);
  assert.notEqual(
    accepted003FOffset,
    -1,
    "Recipe index publishes the 003F Creation Service surface."
  );
  const accepted003DMarker =
    "export type {\n  RecipeDraftIngredientReferenceV1,";
  const accepted003DOffset = publicIndexSource.indexOf(accepted003DMarker);
  assert.notEqual(
    accepted003DOffset,
    -1,
    "Recipe index publishes the 003D Recipe-owned read boundary."
  );
  const measurement001Marker =
    "export type {\n  MeasurementProfileFactsResolutionContractV1,";
  const measurement001Offset = publicIndexSource.indexOf(measurement001Marker);
  assert.notEqual(
    measurement001Offset,
    -1,
    "Recipe index publishes the PR-MEASUREMENT-001 formal Measurement boundary."
  );
  const accepted003GMarker =
    "export {\n  IngredientMeasurementProfileCreationIngredientInactive,";
  const accepted003GOffset = publicIndexSource.indexOf(accepted003GMarker);
  assert.notEqual(
    accepted003GOffset,
    -1,
    "Recipe index publishes the 003G Creation Service surface."
  );
  const accepted003HMarker =
    "export {\n  IngredientMeasurementProfileSupersessionExpectedVersionConflict,";
  const accepted003HOffset = publicIndexSource.indexOf(accepted003HMarker);
  assert.notEqual(
    accepted003HOffset,
    -1,
    "Recipe index publishes the 003H Supersession Service surface."
  );
  const accepted003IMarker =
    "export {\n  IngredientMeasurementProfileDeprecationExpectedVersionConflict,";
  const accepted003IOffset = publicIndexSource.indexOf(accepted003IMarker);
  assert.notEqual(
    accepted003IOffset,
    -1,
    "Recipe index publishes the 003I Deprecation Service surface."
  );
  const accepted003JMarker =
    "export {\n  IngredientMeasurementProfileReestablishmentExpectedVersionConflict,";
  const accepted003JOffset = publicIndexSource.indexOf(accepted003JMarker);
  assert.notEqual(
    accepted003JOffset,
    -1,
    "Recipe index publishes the 003J Re-establishment Service surface."
  );
  const pre003APublicIndex = publicIndexSource.slice(0, accepted003AOffset);
  const accepted003ASurface = publicIndexSource.slice(
    accepted003AOffset,
    accepted003BOffset
  );
  const accepted003BSurface = publicIndexSource.slice(
    accepted003BOffset,
    accepted003FOffset
  );
  const accepted003FSurface = publicIndexSource.slice(
    accepted003FOffset,
    accepted003DOffset
  );
  const accepted003DSurface = publicIndexSource.slice(
    accepted003DOffset,
    measurement001Offset
  );
  const measurement001Surface = publicIndexSource.slice(
    measurement001Offset,
    accepted003GOffset
  );
  const accepted003GSurface = publicIndexSource.slice(
    accepted003GOffset,
    accepted003HOffset
  );
  const accepted003HSurface = publicIndexSource.slice(
    accepted003HOffset,
    accepted003IOffset
  );
  const accepted003ISurface = publicIndexSource.slice(accepted003IOffset, accepted003JOffset);
  const accepted003JSurface = publicIndexSource.slice(accepted003JOffset);
  assert.equal(
    createHash("sha256").update(pre003APublicIndex).digest("hex"),
    "cce08504a779585852309874dd4e3156dac6303875a0dd62002b178c8bde0592",
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
  RenameCanonicalIngredientResultV1,
  ReactivateCanonicalIngredientCommandV1,
  ReactivateCanonicalIngredientResultV1
} from "./contracts/canonical-ingredient-management-contract.js";
export {
  CanonicalIngredientAlreadyArchived,
  CanonicalIngredientNotArchived,
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
  assert.equal(
    accepted003FSurface,
    `export {
  CanonicalIngredientCreationPersistenceFailure,
  CanonicalIngredientCreationValidationFailure
} from "./ingredient-catalog/application/canonical-ingredient-creation-errors.js";
export {
  CanonicalIngredientCreationService,
  type CanonicalIngredientCreationCommand
} from "./ingredient-catalog/application/canonical-ingredient-creation-service.js";
`
  );
  assert.equal(
    accepted003DSurface,
    `export type {
  RecipeDraftIngredientReferenceV1,
  RecipeIngredientReferenceImpactReadModelV1,
  RecipeIngredientReferenceImpactReadPort,
  RecipePublishedIngredientReferenceV1
} from "./domain/ingredient-reference-impact-read-port.js";
`
  );
  assert.equal(
    measurement001Surface,
    `export type {
  MeasurementProfileFactsResolutionContractV1,
  MeasurementProfileFactsResolutionFailureCodeV1,
  MeasurementProfileFactsResolutionRequestV1,
  MeasurementProfileFactsResolutionResultV1,
  ResolvedMeasurementProfileFactsV1
} from "./contracts/measurement-foundation-contract.js";
export { MeasurementProfileFactsResolver } from "./measurement/measurement-profile-facts-resolver.js";
`
  );
  assert.equal(
    accepted003GSurface,
    `export {
  IngredientMeasurementProfileCreationIngredientInactive,
  IngredientMeasurementProfileCreationIngredientNotFound,
  IngredientMeasurementProfileCreationMeasurementFailure,
  IngredientMeasurementProfileCreationPersistenceFailure,
  IngredientMeasurementProfileCreationValidationFailure
} from "./measurement-profile/application/ingredient-measurement-profile-creation-errors.js";
export {
  IngredientMeasurementProfileCreationService,
  type IngredientMeasurementProfileCreationCommand
} from "./measurement-profile/application/ingredient-measurement-profile-creation-service.js";
`
  );
  assert.equal(
    accepted003HSurface,
    `export {
  IngredientMeasurementProfileSupersessionExpectedVersionConflict,
  IngredientMeasurementProfileSupersessionIngredientInactive,
  IngredientMeasurementProfileSupersessionMeasurementFailure,
  IngredientMeasurementProfileSupersessionNotFound,
  IngredientMeasurementProfileSupersessionPersistenceFailure,
  IngredientMeasurementProfileSupersessionValidationFailure
} from "./measurement-profile/application/ingredient-measurement-profile-supersession-errors.js";
export {
  IngredientMeasurementProfileSupersessionService,
  type IngredientMeasurementProfileSupersessionCommand
} from "./measurement-profile/application/ingredient-measurement-profile-supersession-service.js";
`
  );
  assert.equal(
    accepted003ISurface,
    `export {
  IngredientMeasurementProfileDeprecationExpectedVersionConflict,
  IngredientMeasurementProfileDeprecationIngredientInactive,
  IngredientMeasurementProfileDeprecationNotFound,
  IngredientMeasurementProfileDeprecationPersistenceFailure,
  IngredientMeasurementProfileDeprecationValidationFailure
} from "./measurement-profile/application/ingredient-measurement-profile-deprecation-errors.js";
export {
  IngredientMeasurementProfileDeprecationService,
  type IngredientMeasurementProfileDeprecationCommand
} from "./measurement-profile/application/ingredient-measurement-profile-deprecation-service.js";
`
  );
  assert.equal(
    accepted003JSurface,
    `export {
  IngredientMeasurementProfileReestablishmentExpectedVersionConflict,
  IngredientMeasurementProfileReestablishmentIngredientInactive,
  IngredientMeasurementProfileReestablishmentMeasurementFailure,
  IngredientMeasurementProfileReestablishmentNotFound,
  IngredientMeasurementProfileReestablishmentPersistenceFailure,
  IngredientMeasurementProfileReestablishmentValidationFailure
} from "./measurement-profile/application/ingredient-measurement-profile-reestablishment-errors.js";
export {
  IngredientMeasurementProfileReestablishmentService,
  type IngredientMeasurementProfileActivateDraftCommand,
  type IngredientMeasurementProfileAppendDraftCommand,
  type IngredientMeasurementProfileReviseDraftCommand
} from "./measurement-profile/application/ingredient-measurement-profile-reestablishment-service.js";
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
  const approved003DPaths = new Set([
    "src/application/canonical-ingredient-reference-impact-service.ts",
    "src/domains/recipe/domain/ingredient-reference-impact-read-port.ts",
    "src/domains/recipe/infrastructure/sqlite-recipe-repository.ts",
    "src/domains/recipe/index.ts",
    "src/domains/cost/domain/ingredient-reference-impact-read-port.ts",
    "src/domains/cost/infrastructure/sqlite-cost-repository.ts",
    "src/domains/cost/index.ts",
    "src/server/app/routes.ts",
    "src/server/index.ts",
    "src/tests/canonical-ingredient-reference-impact-application.test.ts",
    "src/tests/canonical-ingredient-reference-impact-persistence.integration.test.ts",
    "src/tests/canonical-ingredient-reference-impact-api.integration.test.ts",
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
      approved003BPaths.has(relative)
        || approved003DPaths.has(relative)
        || relative === "src/tests/cost-back-office-api.integration.test.ts"
        || relative === "src/web/ingredients/page.ts",
      true,
      `${relative} contains 003B implementation outside its accepted authority or the authorized 003C UI consumer.`
    );
  }
  const repositoryReferenceFiles = filesUnder(sourceRoot, [".ts"])
    .filter((filename) => /\bCanonicalIngredientRepository\b/.test(readFileSync(filename, "utf8")))
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(repositoryReferenceFiles, [
    "src/domains/recipe/ingredient-catalog/application/canonical-ingredient-creation-service.ts",
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
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(namespaceProductionFiles, [
    "src/server/app/routes.ts",
    "src/web/ingredients/page.ts"
  ]);
  const routesSource = readFileSync(routes, "utf8");
  assert.equal(
    Array.from(routesSource.matchAll(/canonical-ingredients/g)).length,
    6,
    "003K adds the single governed Reactivation registration."
  );
  assert.equal(
    Array.from(routesSource.matchAll(/ingredients/g)).length,
    9,
    "Routes may add only the accepted 003D and 003K registrations to the prior Ingredient routes."
  );
  assert.match(
    routesSource,
    /request\.method === "GET"[\s\S]{0,120}pathname === "\/api\/admin\/canonical-ingredients"/
  );
  assert.match(routesSource, /request\.method === "GET" && canonicalIngredientDetailMatch/);
  assert.match(routesSource, /request\.method === "POST" && canonicalIngredientRenameMatch/);
  assert.match(routesSource, /request\.method === "POST" && canonicalIngredientArchiveMatch/);
  assert.match(routesSource, /request\.method === "POST" && canonicalIngredientReactivateMatch/);
  assert.match(routesSource, /\/api\/admin\/cost\/ingredients/);
  assert.doesNotMatch(
    routesSource,
    /(?:POST|PUT|PATCH)[\s\S]{0,160}\/api\/admin\/canonical-ingredients["']\s*\)/,
    "003B must not add a create behavior at the management collection path."
  );
  assert.match(
    routesSource,
    /request\.method === "GET" && pathname === "\/admin\/ingredients"\) return sendHtml\(response, renderCanonicalIngredientManagement\(\)\)/,
    "003C must own exactly one server-rendered management UI route."
  );
  assert.doesNotMatch(
    routesSource,
    /\/api\/admin\/ingredients|pathname === "\/admin\/canonical-ingredients"/,
    "003C must not introduce an alternative management namespace."
  );
  const ingredientPageSource = readFileSync(ingredientManagementPage, "utf8");
  const navigationSource = readFileSync(sharedNavigation, "utf8");
  assert.equal(
    Array.from(ingredientPageSource.matchAll(/\bexport\s+/g)).length,
    1,
    "The 003C page may export only its accepted renderer."
  );
  assert.match(
    ingredientPageSource,
    /export function renderCanonicalIngredientManagement\(\): string/
  );
  const pageTargets = importedSpecifiers(ingredientManagementPage)
    .map((specifier) => resolveSourceImport(ingredientManagementPage, specifier));
  assert.deepEqual(pageTargets, [sharedNavigation]);
  assert.doesNotMatch(
    ingredientPageSource,
    /innerHTML|outerHTML|insertAdjacentHTML|\son[a-z]+\s*=|localStorage|sessionStorage/,
    "003C must render dynamic values with safe DOM APIs and keep state transient."
  );
  assert.doesNotMatch(
    ingredientPageSource,
    /\/(?:create|reactivate|delete|merge)(?:[/'"]|$)|建立食材|重新啟用|刪除|合併/,
    "003C must not expose out-of-scope lifecycle controls or routes."
  );
  const referenceImpactLoad = ingredientPageSource.match(
    /async function loadReferenceImpact\(\)[\s\S]*?(?=\n  const renderDetailBase)/
  )?.[0] ?? "";
  assert.match(ingredientPageSource, /id="reference-impact-load"/);
  assert.match(ingredientPageSource, /查看引用影響/);
  assert.match(
    referenceImpactLoad,
    /api\(API_ROOT\+'\/'\+encodeURIComponent\(context\.ingredientId\)\+'\/reference-impact',undefined,isReferenceImpact\)/,
    "003E must use the exact encoded Canonical Ingredient Reference Impact GET path."
  );
  assert.doesNotMatch(
    referenceImpactLoad,
    /method\s*:/,
    "003E may consume Reference Impact only with the default GET request."
  );
  assert.match(
    ingredientPageSource,
    /byId\('reference-impact-load'\)\.addEventListener\('click',\(\)=>\{void loadReferenceImpact\(\)\}\)/
  );
  assert.equal(
    Array.from(ingredientPageSource.matchAll(/loadReferenceImpact\(/g)).length,
    2,
    "Only the function declaration and explicit operator click may invoke Reference Impact."
  );
  assert.doesNotMatch(
    ingredientPageSource,
    /setInterval|setTimeout|requestAnimationFrame|indexedDB|Cache API|serviceWorker/,
    "003E must not add polling, automatic refresh, or browser persistence."
  );
  assert.match(ingredientPageSource, /encodeURIComponent\(state\.detail\.ingredientId\)/);
  assert.match(ingredientPageSource, /expectedVersion:state\.detail\.aggregateVersion/);
  assert.match(ingredientPageSource, /parsed\.toISOString\(\)/);
  assert.match(ingredientPageSource, /window\.confirm\(/);
  for (const code of [
    "CANONICAL_INGREDIENT_VERSION_CONFLICT",
    "CANONICAL_INGREDIENT_ALREADY_ARCHIVED",
    "CANONICAL_INGREDIENT_ARCHIVED_RENAME_REJECTED",
    "INVALID_CANONICAL_INGREDIENT_TRANSITION"
  ]) {
    assert.match(ingredientPageSource, new RegExp(code));
  }
  assert.match(
    navigationSource,
    /\{ key: "catalog", href: "\/admin\/catalog", label: "商品目錄" \},\s*\{ key: "ingredients", href: "\/admin\/ingredients", label: "食材主檔" \},\s*\{ key: "cost", href: "\/admin\/cost", label: "成本中心" \}/,
    "The Ingredient entry must remain between Catalog and Cost."
  );
  const approved003CPaths = new Set([
    "src/web/ingredients/page.ts",
    "src/web/shared/navigation.ts",
    "src/server/app/routes.ts",
    "src/tests/canonical-ingredient-lifecycle-api.integration.test.ts",
    "tests/e2e/canonical-ingredient-management.spec.ts",
    "src/tests/architecture-guards.test.ts"
  ]);
  const approved003CResponsibilities = new Map<string, readonly RegExp[]>([
    ["src/web/ingredients/page.ts", [/renderCanonicalIngredientManagement/, /\/api\/admin\/canonical-ingredients/, /DUPLICATE_NAME_WARNING|duplicate-warning/]],
    ["src/web/shared/navigation.ts", [/key: "ingredients"/, /label: "食材主檔"/]],
    ["src/server/app/routes.ts", [/pathname === "\/admin\/ingredients"/, /renderCanonicalIngredientManagement/]],
    ["src/tests/canonical-ingredient-lifecycle-api.integration.test.ts", [/Rendering the management UI must not write/, /<title>食材主檔/]],
    ["tests/e2e/canonical-ingredient-management.spec.ts", [/Canonical Ingredient management UI/, /\/admin\/ingredients/]],
    ["src/tests/architecture-guards.test.ts", [/approved003CPaths/, /approved003CResponsibilities/]]
  ]);
  assert.deepEqual(
    [...approved003CResponsibilities.keys()].sort(),
    [...approved003CPaths].sort(),
    "Every path in the exact 003C allowlist must own an explicit guarded responsibility."
  );
  for (const [relative, patterns] of approved003CResponsibilities) {
    const filename = path.join(projectRoot, ...relative.split("/"));
    assert.equal(existsSync(filename), true, `${relative} is required by the 003C boundary.`);
    const source = readFileSync(filename, "utf8");
    for (const pattern of patterns) {
      assert.match(source, pattern, `${relative} lost an accepted 003C responsibility.`);
    }
  }
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

test("Ingredient 003D Reference Impact stays read-only behind Domain-owned public ports", () => {
  const approvedPaths = new Set([
    "src/application/canonical-ingredient-reference-impact-service.ts",
    "src/domains/recipe/domain/ingredient-reference-impact-read-port.ts",
    "src/domains/recipe/infrastructure/sqlite-recipe-repository.ts",
    "src/domains/recipe/index.ts",
    "src/domains/cost/domain/ingredient-reference-impact-read-port.ts",
    "src/domains/cost/infrastructure/sqlite-cost-repository.ts",
    "src/domains/cost/index.ts",
    "src/server/app/routes.ts",
    "src/server/index.ts",
    "src/tests/canonical-ingredient-reference-impact-application.test.ts",
    "src/tests/canonical-ingredient-reference-impact-persistence.integration.test.ts",
    "src/tests/canonical-ingredient-reference-impact-api.integration.test.ts",
    "src/tests/architecture-guards.test.ts"
  ]);
  assert.equal(approvedPaths.size, 13);
  const approved003EPaths = new Set([
    "src/web/ingredients/page.ts",
    "tests/e2e/canonical-ingredient-management.spec.ts",
    "src/tests/architecture-guards.test.ts"
  ]);
  assert.equal(approved003EPaths.size, 3);
  const approved003EResponsibilities = new Map<string, readonly RegExp[]>([
    [
      "src/web/ingredients/page.ts",
      [
        /id="reference-impact-load"/,
        /API_ROOT\+'\/'\+encodeURIComponent\(context\.ingredientId\)\+'\/reference-impact'/
      ]
    ],
    [
      "tests/e2e/canonical-ingredient-management.spec.ts",
      [/loads Reference Impact only on explicit demand/, /fails Reference Impact closed and ignores stale responses/]
    ],
    [
      "src/tests/architecture-guards.test.ts",
      [/approved003EPaths/, /approved003EResponsibilities/]
    ]
  ]);
  assert.deepEqual(
    [...approved003EResponsibilities.keys()].sort(),
    [...approved003EPaths].sort(),
    "Every path in the exact 003E allowlist must own an explicit guarded responsibility."
  );
  for (const [relative, patterns] of approved003EResponsibilities) {
    const filename = path.join(projectRoot, ...relative.split("/"));
    assert.equal(existsSync(filename), true, `${relative} is required by the 003E boundary.`);
    const source = readFileSync(filename, "utf8");
    for (const pattern of patterns) {
      assert.match(source, pattern, `${relative} lost an accepted 003E responsibility.`);
    }
  }

  const is003EReferenceImpactResponsibility = (source: string): boolean =>
    /canonical-ingredients|API_ROOT/.test(source)
    && /reference-impact|ReferenceImpact/.test(source);
  assert.equal(
    is003EReferenceImpactResponsibility(
      "fetch('/api/admin/canonical-ingredients/'+encodeURIComponent(ingredientId)+'/reference-impact')"
    ),
    true,
    "A simulated fourth UI responsibility that reuses the endpoint must be detected."
  );
  const referenceImpactUiResponsibilityFiles = [
    ...filesUnder(path.join(projectRoot, "src"), [".ts", ".tsx"]),
    ...filesUnder(path.join(projectRoot, "tests"), [".ts", ".tsx"])
  ]
    .filter((filename) =>
      is003EReferenceImpactResponsibility(readFileSync(filename, "utf8"))
    )
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"))
    .filter((relative) => !approvedPaths.has(relative) || approved003EPaths.has(relative))
    .sort();
  assert.deepEqual(
    referenceImpactUiResponsibilityFiles,
    [...approved003EPaths].sort(),
    "003E Reference Impact UI responsibilities must remain inside the exact three approved paths; 003D's authorized evidence is excluded."
  );

  const markerFiles = filesUnder(sourceRoot, [".ts", ".tsx"])
    .filter((filename) =>
      /IngredientReferenceImpact|reference-impact/.test(
        readFileSync(filename, "utf8")
      )
    )
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(
    markerFiles,
    [...new Set([...approvedPaths, "src/web/ingredients/page.ts"])].sort(),
    "003D markers and the exact 003E UI consumers must remain inside their accepted paths."
  );
  const applicationRoot = path.join(sourceRoot, "application");
  const applicationService = path.join(
    applicationRoot,
    "canonical-ingredient-reference-impact-service.ts"
  );
  assert.deepEqual(filesUnder(applicationRoot, [".ts"]), [applicationService]);
  const applicationSource = readFileSync(applicationService, "utf8");
  const recipePublicIndex = path.join(sourceRoot, "domains", "recipe", "index.ts");
  const costPublicIndex = path.join(sourceRoot, "domains", "cost", "index.ts");
  assert.deepEqual(
    importedSpecifiers(applicationService)
      .map((specifier) => resolveSourceImport(applicationService, specifier))
      .filter((target): target is string => target !== null)
      .sort(),
    [costPublicIndex, recipePublicIndex].sort(),
    "The neutral coordinator may consume only Recipe and Cost public indexes."
  );
  assert.doesNotMatch(
    applicationSource,
    /shared\/database|infrastructure|persistence|DatabaseAdapter|SELECT\s|INSERT\s|UPDATE\s|DELETE\s|transaction/i
  );
  assert.doesNotMatch(
    applicationSource,
    /\bcause\b|rawError|cost_purchases|cost_purchase_items|CostSnapshotRepository/
  );
  assert.match(
    applicationSource,
    /Pick<[\s\S]*CanonicalIngredientManagementReadService[\s\S]*"getById"/
  );
  for (const code of [
    "CANONICAL_INGREDIENT_REFERENCE_IMPACT_VALIDATION_FAILURE",
    "CANONICAL_INGREDIENT_REFERENCE_IMPACT_NOT_FOUND",
    "CANONICAL_INGREDIENT_REFERENCE_IMPACT_READ_FAILURE"
  ]) assert.match(applicationSource, new RegExp(code));
  assert.match(applicationSource, /acceptedPurchaseCount/);
  assert.match(applicationSource, /availability: "Unavailable"/);
  assert.match(applicationSource, /status: "Indeterminate"/);
  assert.match(applicationSource, /blocked: true/);

  const recipePort = path.join(
    sourceRoot,
    "domains",
    "recipe",
    "domain",
    "ingredient-reference-impact-read-port.ts"
  );
  const costPort = path.join(
    sourceRoot,
    "domains",
    "cost",
    "domain",
    "ingredient-reference-impact-read-port.ts"
  );
  assert.deepEqual(importedSpecifiers(recipePort), ["./identities.js"]);
  assert.deepEqual(importedSpecifiers(costPort), ["./identities.js"]);
  assertNoTerms(
    readFileSync(recipePort, "utf8"),
    ["domains/cost", "sqlite", "database", "purchase", "snapshot"],
    recipePort
  );
  assertNoTerms(
    readFileSync(costPort, "utf8"),
    ["domains/recipe", "sqlite", "database", "snapshot"],
    costPort
  );

  const recipeSqlite = path.join(
    sourceRoot,
    "domains",
    "recipe",
    "infrastructure",
    "sqlite-recipe-repository.ts"
  );
  const costSqlite = path.join(
    sourceRoot,
    "domains",
    "cost",
    "infrastructure",
    "sqlite-cost-repository.ts"
  );
  const recipeSqliteSource = readFileSync(recipeSqlite, "utf8").replaceAll(
    "\r\n",
    "\n"
  );
  const costSqliteSource = readFileSync(costSqlite, "utf8").replaceAll(
    "\r\n",
    "\n"
  );
  assert.match(
    recipeSqliteSource,
    /implements[\s\S]{0,100}RecipeIngredientReferenceImpactReadPort/
  );
  assert.match(
    costSqliteSource,
    /implements[\s\S]{0,100}CostIngredientReferenceImpactReadPort/
  );
  const recipeRead = recipeSqliteSource.match(
    /findIngredientReferences\([\s\S]*?\n  }\n\n  private rawRecipe/
  )?.[0] ?? "";
  const costRead = costSqliteSource.match(
    /findIngredientQuoteReferences\([\s\S]*?\n  }\n\n  findEffectiveQuoteAt/
  )?.[0] ?? "";
  assert.match(recipeRead, /recipe_draft_lines/);
  assert.match(recipeRead, /recipe_version_lines/);
  assert.equal(Array.from(recipeRead.matchAll(/queryMany</g)).length, 2);
  assert.doesNotMatch(recipeRead, /cost_|purchase|snapshot/i);
  assert.match(costRead, /cost_ingredient_cost_quotes/);
  assert.equal(Array.from(costRead.matchAll(/queryMany</g)).length, 3);
  assert.doesNotMatch(costRead, /recipe_|cost_purchases|cost_purchase_items/);
  assert.match(costSqliteSource, /findIngredientAcceptedPurchaseReferences[\s\S]*cost_accepted_purchase_lines/);

  const recipeIndexSource = readFileSync(recipePublicIndex, "utf8")
    .replaceAll("\r\n", "\n");
  assert.match(
    recipeIndexSource,
    /RecipeIngredientReferenceImpactReadPort[\s\S]*ingredient-reference-impact-read-port/
  );
  assert.doesNotMatch(recipeIndexSource, /SqliteRecipeRepository/);
  const costIndexSource = readFileSync(costPublicIndex, "utf8")
    .replaceAll("\r\n", "\n");
  const cost003DMarker =
    "export type {\n  CostAcceptedPurchaseReferenceImpactReadModelV1,";
  const cost003DOffset = costIndexSource.indexOf(cost003DMarker);
  assert.notEqual(cost003DOffset, -1);
  assert.equal(
    createHash("sha256")
      .update(costIndexSource.slice(0, cost003DOffset))
      .digest("hex"),
    "a4e1afc4d6d3885c5937017294f8a1e5d3ca8ced735c8b74ba322c57dd6a6de7",
    "003D must preserve the Cost public index as extended only by later Owner-approved Cost exports."
  );
  assert.equal(
    costIndexSource.slice(cost003DOffset),
    `export type {
  CostAcceptedPurchaseReferenceImpactReadModelV1,
  CostIngredientQuoteReferenceImpactReadModelV1,
  CostIngredientReferenceImpactReadPort
} from "./domain/ingredient-reference-impact-read-port.js";
`
  );

  const routes = path.join(sourceRoot, "server", "app", "routes.ts");
  const serverIndex = path.join(sourceRoot, "server", "index.ts");
  const routeSource = readFileSync(routes, "utf8");
  const serverSource = readFileSync(serverIndex, "utf8");
  assert.equal(
    routeSource
      .split(/\r?\n/)
      .filter(
        (line) => line.trim()
          === String.raw`/^\/api\/admin\/canonical-ingredients\/([^/]+)\/reference-impact$/`
      ).length,
    1,
    "Exactly one production Reference Impact route is authorized."
  );
  assert.match(
    routeSource,
    /request\.method === "GET"[\s\S]{0,180}canonicalIngredientReferenceImpactMatch/
  );
  assert.doesNotMatch(
    routeSource,
    /request\.method === "(?:POST|PUT|PATCH|DELETE)"[\s\S]{0,180}reference-impact/
  );
  assert.match(serverSource, /new CanonicalIngredientReferenceImpactService/);
  assert.match(serverSource, /new SqliteRecipeRepository/);
  assert.match(serverSource, /new SqliteCostRepository/);
  assertNoTerms(
    routeSource,
    ["better-sqlite3", "SELECT ", "INSERT ", "UPDATE ", "DELETE FROM"],
    routes
  );

  const ingredientManagementPage = path.join(sourceRoot, "web", "ingredients", "page.ts");
  const webFiles = filesUnder(path.join(sourceRoot, "web"), [".ts", ".tsx"]);
  for (const filename of webFiles) {
    if (filename === ingredientManagementPage) continue;
    assert.doesNotMatch(
      readFileSync(filename, "utf8"),
      /reference-impact|ReferenceImpact/,
      "003E may not add Reference Impact UI or navigation outside the existing Ingredient page."
    );
  }

  for (const filename of [applicationService, recipePort, costPort, serverIndex]) {
    assert.doesNotMatch(
      readFileSync(filename, "utf8"),
      /cost_purchases|cost_purchase_items|reactivate|aliases|mergeIngredient|deleteIngredient/i
    );
  }

  const migration017 = Buffer.from(
    readFileSync(
      path.join(
        projectRoot,
        "migrations",
        "017_recipe_persistence_line_identity_and_publication_uow.sql"
      ),
      "utf8"
    ).replaceAll("\r\n", "\n"),
    "utf8"
  );
  const migration017Blob = createHash("sha1")
    .update(`blob ${migration017.byteLength}\0`)
    .update(migration017)
    .digest("hex");
  assert.equal(
    migration017Blob,
    "15deca8cba48a2ce342561d0faf78e3f89d3ae4c",
    "Ingredient 003D must not change Migration 017."
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

test("Ingredient 003F keeps Canonical Ingredient creation behind its Application boundary", () => {
  const approved003FPaths = new Set([
    "src/domains/recipe/ingredient-catalog/application/canonical-ingredient-creation-service.ts",
    "src/domains/recipe/ingredient-catalog/application/canonical-ingredient-creation-errors.ts",
    "src/domains/recipe/index.ts",
    "src/server/app/cost-back-office-service.ts",
    "src/server/index.ts",
    "src/tests/canonical-ingredient-creation-application.test.ts",
    "src/tests/cost-back-office-api.integration.test.ts",
    "src/tests/architecture-guards.test.ts",
    "tests/e2e/cost-back-office.spec.ts"
  ]);
  assert.equal(approved003FPaths.size, 9);
  const approved003FResponsibilities = new Map<string, readonly RegExp[]>([
    [
      "src/domains/recipe/ingredient-catalog/application/canonical-ingredient-creation-service.ts",
      [/class CanonicalIngredientCreationService/, /Pick<[\s\S]*"saveNew"/, /CanonicalIngredientId\.fromUuid\(randomUUID\(\)\)/]
    ],
    [
      "src/domains/recipe/ingredient-catalog/application/canonical-ingredient-creation-errors.ts",
      [/CanonicalIngredientCreationValidationFailure/, /CanonicalIngredientCreationPersistenceFailure/]
    ],
    [
      "src/domains/recipe/index.ts",
      [/CanonicalIngredientCreationService/, /CanonicalIngredientCreationCommand/]
    ],
    [
      "src/server/app/cost-back-office-service.ts",
      [/canonicalIngredientCreation\.create\(/]
    ],
    [
      "src/server/index.ts",
      [/new CanonicalIngredientCreationService\(/, /new CostBackOfficeService\([\s\S]*canonicalIngredientCreation/]
    ],
    [
      "src/tests/canonical-ingredient-creation-application.test.ts",
      [/Creation Service creates one Active immutable Canonical Ingredient/, /persistence failures to one safe boundary/]
    ],
    [
      "src/tests/cost-back-office-api.integration.test.ts",
      [/Cost Canonical Ingredient creation keeps the existing facade/]
    ],
    [
      "src/tests/architecture-guards.test.ts",
      [/approved003FPaths/, /approved003FResponsibilities/]
    ],
    [
      "tests/e2e/cost-back-office.spec.ts",
      [/CanonicalIngredientCreation on its existing facade/]
    ]
  ]);
  assert.deepEqual(
    [...approved003FResponsibilities.keys()].sort(),
    [...approved003FPaths].sort(),
    "Every path in the exact 003F allowlist must own an explicit guarded responsibility."
  );
  for (const [relative, patterns] of approved003FResponsibilities) {
    const filename = path.join(projectRoot, ...relative.split("/"));
    assert.equal(existsSync(filename), true, `${relative} is required by the 003F boundary.`);
    const source = readFileSync(filename, "utf8");
    for (const pattern of patterns) assert.match(source, pattern);
  }

  const creationResponsibility = /CanonicalIngredientCreation|canonicalIngredientCreation|Cost Canonical Ingredient creation/;
  const creationResponsibilityFiles = [
    ...filesUnder(path.join(projectRoot, "src"), [".ts", ".tsx"]),
    ...filesUnder(path.join(projectRoot, "tests"), [".ts", ".tsx"])
  ]
    .filter((filename) => creationResponsibility.test(readFileSync(filename, "utf8")))
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(
    creationResponsibilityFiles,
    [...approved003FPaths].sort(),
    "A tenth Canonical Ingredient Creation responsibility path is not authorized."
  );
  assert.equal(
    creationResponsibility.test("const canonicalIngredientCreation = createService();"),
    true,
    "A simulated tenth Creation responsibility must be detected."
  );

  const creationService = path.join(
    sourceRoot,
    "domains",
    "recipe",
    "ingredient-catalog",
    "application",
    "canonical-ingredient-creation-service.ts"
  );
  const creationErrors = path.join(
    sourceRoot,
    "domains",
    "recipe",
    "ingredient-catalog",
    "application",
    "canonical-ingredient-creation-errors.ts"
  );
  const costBackOffice = path.join(
    sourceRoot,
    "server",
    "app",
    "cost-back-office-service.ts"
  );
  const serverIndex = path.join(sourceRoot, "server", "index.ts");
  const creationSource = readFileSync(creationService, "utf8");
  const errorSource = readFileSync(creationErrors, "utf8");
  const costSource = readFileSync(costBackOffice, "utf8");
  const serverSource = readFileSync(serverIndex, "utf8");
  assertNoTerms(
    creationSource,
    ["sqlite", "better-sqlite3", "database-adapter", "domains/cost", "cause", "stack"],
    creationService
  );
  assertNoTerms(errorSource, ["sqlite", "database", "cause", "stack"], creationErrors);
  const createIngredientStart = costSource.indexOf("  createIngredient(");
  const createIngredientEnd = costSource.indexOf(
    "\n  createProfile(",
    createIngredientStart
  );
  const createIngredientSource = costSource.slice(
    createIngredientStart,
    createIngredientEnd
  );
  assert.match(createIngredientSource, /canonicalIngredientCreation\.create\(/);
  assert.doesNotMatch(
    createIngredientSource,
    /randomUUID|CanonicalIngredient\.create|CanonicalIngredientId\.fromUuid|saveNew/
  );
  assert.equal(
    Array.from(serverSource.matchAll(/new CanonicalIngredientCreationService\(/g)).length,
    1,
    "server/index.ts is the sole 003F Creation Service composition site."
  );
  assert.doesNotMatch(
    readFileSync(path.join(sourceRoot, "server", "app", "routes.ts"), "utf8"),
    /POST \/api\/admin\/canonical-ingredients|canonicalIngredientCreation/,
    "003F must retain Cost Back Office as the sole existing creation facade."
  );
});

test("Ingredient 003G keeps Measurement Profile creation behind its Application boundary", () => {
  const approved003GPaths = new Set([
    "src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-creation-service.ts",
    "src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-creation-errors.ts",
    "src/domains/recipe/index.ts",
    "src/server/app/cost-back-office-service.ts",
    "src/server/index.ts",
    "src/tests/ingredient-measurement-profile-creation-application.test.ts",
    "src/tests/cost-back-office-api.integration.test.ts",
    "src/tests/architecture-guards.test.ts",
    "tests/e2e/cost-back-office.spec.ts"
  ]);
  assert.equal(approved003GPaths.size, 9);
  const approved003GResponsibilities = new Map<string, readonly RegExp[]>([
    [
      "src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-creation-service.ts",
      [/class IngredientMeasurementProfileCreationService/, /type ProfileCreationStore/, /measurementFacts\.resolveProfileFacts/]
    ],
    [
      "src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-creation-errors.ts",
      [/IngredientMeasurementProfileCreationValidationFailure/, /IngredientMeasurementProfileCreationPersistenceFailure/]
    ],
    [
      "src/domains/recipe/index.ts",
      [/IngredientMeasurementProfileCreationService/, /IngredientMeasurementProfileCreationCommand/]
    ],
    [
      "src/server/app/cost-back-office-service.ts",
      [/profileCreation\.create\(/]
    ],
    [
      "src/server/index.ts",
      [/new IngredientMeasurementProfileCreationService\(/, /new CostBackOfficeService\([\s\S]*profileCreation/]
    ],
    [
      "src/tests/ingredient-measurement-profile-creation-application.test.ts",
      [/Profile Creation Service creates one Active Profile/, /contains persistence detail/]
    ],
    [
      "src/tests/cost-back-office-api.integration.test.ts",
      [/Cost Back Office API keeps Profile creation on its existing facade/]
    ],
    [
      "src/tests/architecture-guards.test.ts",
      [/approved003GPaths/, /approved003GResponsibilities/]
    ],
    [
      "tests/e2e/cost-back-office.spec.ts",
      [/IngredientMeasurementProfileCreation on its existing facade/]
    ]
  ]);
  assert.deepEqual(
    [...approved003GResponsibilities.keys()].sort(),
    [...approved003GPaths].sort(),
    "Every path in the exact 003G allowlist must own an explicit guarded responsibility."
  );
  for (const [relative, patterns] of approved003GResponsibilities) {
    const filename = path.join(projectRoot, ...relative.split("/"));
    assert.equal(existsSync(filename), true, `${relative} is required by the 003G boundary.`);
    const source = readFileSync(filename, "utf8");
    for (const pattern of patterns) assert.match(source, pattern);
  }

  const profileCreationResponsibility = /IngredientMeasurementProfileCreation|profileCreation|Cost Back Office API keeps Profile creation on its existing facade/;
  const profileCreationResponsibilityFiles = [
    ...filesUnder(path.join(projectRoot, "src"), [".ts", ".tsx"]),
    ...filesUnder(path.join(projectRoot, "tests"), [".ts", ".tsx"])
  ]
    .filter((filename) => profileCreationResponsibility.test(readFileSync(filename, "utf8")))
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(
    profileCreationResponsibilityFiles,
    [...approved003GPaths].sort(),
    "A tenth Ingredient Measurement Profile Creation responsibility path is not authorized."
  );
  assert.equal(
    profileCreationResponsibility.test("const profileCreation = createService();"),
    true,
    "A simulated tenth Measurement Profile Creation responsibility must be detected."
  );

  const profileCreationService = path.join(
    sourceRoot,
    "domains",
    "recipe",
    "measurement-profile",
    "application",
    "ingredient-measurement-profile-creation-service.ts"
  );
  const profileCreationErrors = path.join(
    sourceRoot,
    "domains",
    "recipe",
    "measurement-profile",
    "application",
    "ingredient-measurement-profile-creation-errors.ts"
  );
  const costBackOffice = path.join(sourceRoot, "server", "app", "cost-back-office-service.ts");
  const serverIndex = path.join(sourceRoot, "server", "index.ts");
  const creationSource = readFileSync(profileCreationService, "utf8");
  const errorSource = readFileSync(profileCreationErrors, "utf8");
  const costSource = readFileSync(costBackOffice, "utf8");
  const serverSource = readFileSync(serverIndex, "utf8");
  assertNoTerms(
    creationSource,
    ["sqlite", "better-sqlite3", "database-adapter", "domains/cost", "cause", "stack"],
    profileCreationService
  );
  assertNoTerms(errorSource, ["sqlite", "database", "cause", "stack"], profileCreationErrors);
  const createProfileStart = costSource.indexOf("  createProfile(");
  const createProfileEnd = costSource.indexOf("\n  createAndPublishRecipe(", createProfileStart);
  const createProfileSource = costSource.slice(createProfileStart, createProfileEnd);
  assert.match(createProfileSource, /profileCreation\.create\(/);
  assert.doesNotMatch(
    createProfileSource,
    /randomUUID|IngredientMeasurementProfile\.create|saveNew|MeasurementProfileFactsResolver|MeasurementUnitResolver|unitCodes/
  );
  assert.equal(
    Array.from(serverSource.matchAll(/new IngredientMeasurementProfileCreationService\(/g)).length,
    1,
    "server/index.ts is the sole 003G Creation Service composition site."
  );
  assert.doesNotMatch(
    readFileSync(path.join(sourceRoot, "server", "app", "routes.ts"), "utf8"),
    /POST \/api\/admin\/canonical-ingredients\/profiles|IngredientMeasurementProfileCreation/,
    "003G must retain Cost Back Office as the sole existing Profile creation facade."
  );
});

test("Ingredient 003H keeps Active Profile supersession behind its Application boundary", () => {
  const approved003HPaths = new Set([
    "src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-supersession-service.ts",
    "src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-supersession-errors.ts",
    "src/domains/recipe/index.ts",
    "src/server/app/cost-back-office-service.ts",
    "src/server/app/routes.ts",
    "src/server/index.ts",
    "src/tests/ingredient-measurement-profile-supersession-application.test.ts",
    "src/tests/cost-back-office-api.integration.test.ts",
    "src/tests/architecture-guards.test.ts",
    "tests/e2e/cost-back-office.spec.ts"
  ]);
  assert.equal(approved003HPaths.size, 10);
  const approved003HResponsibilities = new Map<string, readonly RegExp[]>([
    [
      "src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-supersession-service.ts",
      [/class IngredientMeasurementProfileSupersessionService/, /supersedeActive\(/, /measurementFacts\.resolveProfileFacts/]
    ],
    [
      "src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-supersession-errors.ts",
      [/SupersessionExpectedVersionConflict/, /SupersessionPersistenceFailure/]
    ],
    ["src/domains/recipe/index.ts", [/IngredientMeasurementProfileSupersessionService/, /IngredientMeasurementProfileSupersessionCommand/]],
    ["src/server/app/cost-back-office-service.ts", [/profileSupersession\.supersede\(/, /supersessionOperation/]],
    ["src/server/app/routes.ts", [/supersessions/, /supersedeProfile/]],
    ["src/server/index.ts", [/new IngredientMeasurementProfileSupersessionService\(/, /new CostBackOfficeService\([\s\S]*profileSupersession/]],
    ["src/tests/ingredient-measurement-profile-supersession-application.test.ts", [/Profile Supersession Service preserves one continuous Active version/, /contains persistence detail/]],
    ["src/tests/cost-back-office-api.integration.test.ts", [/Cost Back Office supersedes an Active Profile/]],
    ["src/tests/architecture-guards.test.ts", [/approved003HPaths/, /approved003HResponsibilities/]],
    ["tests/e2e/cost-back-office.spec.ts", [/delegates Active Profile supersession/]]
  ]);
  assert.deepEqual(
    [...approved003HResponsibilities.keys()].sort(),
    [...approved003HPaths].sort(),
    "Every path in the exact 003H allowlist must own an explicit guarded responsibility."
  );
  for (const [relative, patterns] of approved003HResponsibilities) {
    const source = readFileSync(path.join(projectRoot, ...relative.split("/")), "utf8");
    for (const pattern of patterns) assert.match(source, pattern, `${relative} lost a 003H responsibility.`);
  }

  const supersessionResponsibility = /IngredientMeasurementProfileSupersession|profileSupersession|supersedeProfile|\/supersessions/;
  const supersessionFiles = [
    ...filesUnder(path.join(projectRoot, "src"), [".ts", ".tsx"]),
    ...filesUnder(path.join(projectRoot, "tests"), [".ts", ".tsx"])
  ]
    .filter((filename) => supersessionResponsibility.test(readFileSync(filename, "utf8")))
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(
    supersessionFiles,
    [...approved003HPaths].sort(),
    "An unauthorized eleventh Profile supersession responsibility path is not allowed."
  );
  assert.equal(
    supersessionResponsibility.test("const profileSupersession = createService();"),
    true,
    "A simulated eleventh supersession responsibility path must be detected."
  );

  const servicePath = path.join(sourceRoot, "domains", "recipe", "measurement-profile", "application", "ingredient-measurement-profile-supersession-service.ts");
  const errorPath = path.join(sourceRoot, "domains", "recipe", "measurement-profile", "application", "ingredient-measurement-profile-supersession-errors.ts");
  const serviceSource = readFileSync(servicePath, "utf8");
  const errorSource = readFileSync(errorPath, "utf8");
  const costSource = readFileSync(path.join(sourceRoot, "server", "app", "cost-back-office-service.ts"), "utf8");
  const serverSource = readFileSync(path.join(sourceRoot, "server", "index.ts"), "utf8");
  assertNoTerms(serviceSource, ["sqlite", "better-sqlite3", "database-adapter", "domains/cost", "cause", "stack"], servicePath);
  assertNoTerms(errorSource, ["sqlite", "database", "cause", "stack"], errorPath);
  const supersedeStart = costSource.indexOf("  supersedeProfile(");
  const supersedeEnd = costSource.indexOf("\n  createAndPublishRecipe(", supersedeStart);
  const supersedeSource = costSource.slice(supersedeStart, supersedeEnd);
  assert.match(supersedeSource, /profileSupersession\.supersede\(/);
  assert.doesNotMatch(supersedeSource, /randomUUID|IngredientMeasurementProfile\.create|supersedeActive|saveWithExpectedVersion|MeasurementProfileFactsResolver|MeasurementUnitResolver/);
  assert.equal(Array.from(serverSource.matchAll(/new IngredientMeasurementProfileSupersessionService\(/g)).length, 1);
  const routeSource = readFileSync(path.join(sourceRoot, "server", "app", "routes.ts"), "utf8");
  assert.match(routeSource, /\^\\\/api\\\/admin\\\/cost\\\/profiles\\\/\(\[\^\/\]\+\)\\\/supersessions\$/);
  assert.doesNotMatch(routeSource, /POST \/api\/admin\/canonical-ingredients\/profiles/);
});

test("Ingredient 003I keeps standalone Profile deprecation behind its Application boundary", () => {
  const approved003IPaths = new Set([
    "src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-deprecation-service.ts",
    "src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-deprecation-errors.ts",
    "src/domains/recipe/index.ts",
    "src/server/app/cost-back-office-service.ts",
    "src/server/app/routes.ts",
    "src/server/index.ts",
    "src/tests/ingredient-measurement-profile-deprecation-application.test.ts",
    "src/tests/cost-back-office-api.integration.test.ts",
    "src/tests/architecture-guards.test.ts",
    "tests/e2e/cost-back-office.spec.ts"
  ]);
  assert.equal(approved003IPaths.size, 10);
  const approved003IResponsibilities = new Map<string, readonly RegExp[]>([
    [
      "src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-deprecation-service.ts",
      [/class IngredientMeasurementProfileDeprecationService/, /deprecateActive\(/, /saveWithExpectedVersion/]
    ],
    [
      "src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-deprecation-errors.ts",
      [/DeprecationExpectedVersionConflict/, /DeprecationPersistenceFailure/]
    ],
    ["src/domains/recipe/index.ts", [/IngredientMeasurementProfileDeprecationService/, /IngredientMeasurementProfileDeprecationCommand/]],
    ["src/server/app/cost-back-office-service.ts", [/profileDeprecation\.deprecate\(/, /deprecationOperation/]],
    ["src/server/app/routes.ts", [/deprecations/, /deprecateProfile/]],
    ["src/server/index.ts", [/new IngredientMeasurementProfileDeprecationService\(/, /new CostBackOfficeService\([\s\S]*profileDeprecation/]],
    ["src/tests/ingredient-measurement-profile-deprecation-application.test.ts", [/Profile Deprecation Service creates an intentional no-Active Profile state/, /contains persistence detail/]],
    ["src/tests/cost-back-office-api.integration.test.ts", [/Cost Back Office deprecates an Active Profile/]],
    ["src/tests/architecture-guards.test.ts", [/approved003IPaths/, /approved003IResponsibilities/]],
    ["tests/e2e/cost-back-office.spec.ts", [/delegates Active Profile deprecation/]]
  ]);
  assert.deepEqual(
    [...approved003IResponsibilities.keys()].sort(),
    [...approved003IPaths].sort(),
    "Every path in the exact 003I allowlist must own an explicit guarded responsibility."
  );
  for (const [relative, patterns] of approved003IResponsibilities) {
    const source = readFileSync(path.join(projectRoot, ...relative.split("/")), "utf8");
    for (const pattern of patterns) assert.match(source, pattern, `${relative} lost a 003I responsibility.`);
  }

  const deprecationResponsibility = /IngredientMeasurementProfileDeprecation|profileDeprecation|deprecateProfile|\/deprecations/;
  const deprecationFiles = [
    ...filesUnder(path.join(projectRoot, "src"), [".ts", ".tsx"]),
    ...filesUnder(path.join(projectRoot, "tests"), [".ts", ".tsx"])
  ]
    .filter((filename) => deprecationResponsibility.test(readFileSync(filename, "utf8")))
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(
    deprecationFiles,
    [...approved003IPaths].sort(),
    "An unauthorized eleventh Profile deprecation responsibility path is not allowed."
  );
  assert.equal(
    deprecationResponsibility.test("const profileDeprecation = createService();"),
    true,
    "A simulated eleventh deprecation responsibility path must be detected."
  );

  const servicePath = path.join(sourceRoot, "domains", "recipe", "measurement-profile", "application", "ingredient-measurement-profile-deprecation-service.ts");
  const errorPath = path.join(sourceRoot, "domains", "recipe", "measurement-profile", "application", "ingredient-measurement-profile-deprecation-errors.ts");
  const serviceSource = readFileSync(servicePath, "utf8");
  const errorSource = readFileSync(errorPath, "utf8");
  const costSource = readFileSync(path.join(sourceRoot, "server", "app", "cost-back-office-service.ts"), "utf8");
  const serverSource = readFileSync(path.join(sourceRoot, "server", "index.ts"), "utf8");
  assertNoTerms(serviceSource, ["sqlite", "better-sqlite3", "database-adapter", "domains/cost", "measurement-profile-facts", "measurement-unit-resolver", "MeasurementProfileFactsResolver", "MeasurementUnitResolver", "cause", "stack"], servicePath);
  assertNoTerms(errorSource, ["sqlite", "database", "cause", "stack"], errorPath);
  const deprecateStart = costSource.indexOf("  deprecateProfile(");
  const deprecateEnd = costSource.indexOf("\n  createAndPublishRecipe(", deprecateStart);
  const deprecateSource = costSource.slice(deprecateStart, deprecateEnd);
  assert.match(deprecateSource, /profileDeprecation\.deprecate\(/);
  assert.doesNotMatch(deprecateSource, /randomUUID|IngredientMeasurementProfile\.create|deprecateActive|saveWithExpectedVersion|MeasurementProfileFactsResolver|MeasurementUnitResolver/);
  assert.equal(Array.from(serverSource.matchAll(/new IngredientMeasurementProfileDeprecationService\(/g)).length, 1);
  const routeSource = readFileSync(path.join(sourceRoot, "server", "app", "routes.ts"), "utf8");
  assert.match(routeSource, /\^\\\/api\\\/admin\\\/cost\\\/profiles\\\/\(\[\^\/\]\+\)\\\/deprecations\$/);
  assert.doesNotMatch(routeSource, /POST \/api\/admin\/canonical-ingredients\/profiles/);
});

test("Ingredient 003J keeps Draft-first Profile re-establishment inside its exact responsibility boundary", () => {
  const approved003JPaths = new Set([
    "src/domains/recipe/measurement-profile/ingredient-measurement-profile.ts",
    "src/domains/recipe/measurement-profile/persistence/measurement-profile-persistence-mapper.ts",
    "src/domains/recipe/measurement-profile/infrastructure/sqlite-ingredient-measurement-profile-repository.ts",
    "src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-reestablishment-service.ts",
    "src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-reestablishment-errors.ts",
    "src/domains/recipe/index.ts",
    "src/server/app/cost-back-office-service.ts",
    "src/server/app/routes.ts",
    "src/server/index.ts",
    "src/tests/ingredient-measurement-profile.test.ts",
    "src/tests/ingredient-measurement-profile-persistence.integration.test.ts",
    "src/tests/ingredient-measurement-profile-reestablishment-application.test.ts",
    "src/tests/cost-back-office-api.integration.test.ts",
    "src/tests/architecture-guards.test.ts",
    "tests/e2e/cost-back-office.spec.ts"
  ]);
  assert.equal(approved003JPaths.size, 15);
  const approved003JResponsibilities = new Map<string, readonly RegExp[]>([
    ["src/domains/recipe/measurement-profile/ingredient-measurement-profile.ts", [/appendDraftAfterDeprecation/, /priorDeprecatedVersion/]],
    ["src/domains/recipe/measurement-profile/persistence/measurement-profile-persistence-mapper.ts", [/appendDraftAfterDeprecation/, /re-established Profile Version/]],
    ["src/domains/recipe/measurement-profile/infrastructure/sqlite-ingredient-measurement-profile-repository.ts", [/Draft-first re-establishment/, /expectedAddedFacts/]],
    ["src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-reestablishment-service.ts", [/class IngredientMeasurementProfileReestablishmentService/, /appendDraftAfterDeprecation/, /measurementFacts\.resolveProfileFacts/]],
    ["src/domains/recipe/measurement-profile/application/ingredient-measurement-profile-reestablishment-errors.ts", [/ReestablishmentPersistenceFailure/, /ReestablishmentMeasurementFailure/]],
    ["src/domains/recipe/index.ts", [/IngredientMeasurementProfileReestablishmentService/, /IngredientMeasurementProfileAppendDraftCommand/]],
    ["src/server/app/cost-back-office-service.ts", [/profileReestablishment\.appendDraft\(/, /reestablishmentOperation/]],
    ["src/server/app/routes.ts", [/re-establishment-drafts/, /activateProfileReestablishmentDraft/]],
    ["src/server/index.ts", [/new IngredientMeasurementProfileReestablishmentService\(/, /profileReestablishment/]],
    ["src/tests/ingredient-measurement-profile.test.ts", [/003J re-establishment/, /appendDraftAfterDeprecation/]],
    ["src/tests/ingredient-measurement-profile-persistence.integration.test.ts", [/003J persistence/, /appendDraftAfterDeprecation/]],
    ["src/tests/ingredient-measurement-profile-reestablishment-application.test.ts", [/Profile Re-establishment Service/, /appendDraft/]],
    ["src/tests/cost-back-office-api.integration.test.ts", [/re-establishes a Deprecated Profile/, /re-establishment-drafts/]],
    ["src/tests/architecture-guards.test.ts", [/approved003JPaths/, /approved003JResponsibilities/]],
    ["tests/e2e/cost-back-office.spec.ts", [/Draft-first Profile re-establishment/, /re-establishment-drafts/]]
  ]);
  assert.deepEqual([...approved003JResponsibilities.keys()].sort(), [...approved003JPaths].sort());
  for (const [relative, patterns] of approved003JResponsibilities) {
    const source = readFileSync(path.join(projectRoot, ...relative.split("/")), "utf8");
    for (const pattern of patterns) assert.match(source, pattern, `${relative} lost a 003J responsibility.`);
  }
  const responsibility = /IngredientMeasurementProfileReestablishment|profileReestablishment|re-establishment-drafts|appendDraftAfterDeprecation|Draft-first re-establishment|003J (?:re-establishment|persistence)/;
  const files = [...filesUnder(path.join(projectRoot, "src"), [".ts", ".tsx"]), ...filesUnder(path.join(projectRoot, "tests"), [".ts", ".tsx"])]
    .filter((filename) => responsibility.test(readFileSync(filename, "utf8")))
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(files, [...approved003JPaths].filter((relative) => relative.startsWith("src/") || relative.startsWith("tests/")).sort());
  assert.equal(responsibility.test("const profileReestablishment = createService();"), true, "A simulated unauthorized sixteenth re-establishment responsibility path must be detected.");
  const servicePath = path.join(sourceRoot, "domains", "recipe", "measurement-profile", "application", "ingredient-measurement-profile-reestablishment-service.ts");
  const serviceSource = readFileSync(servicePath, "utf8");
  assertNoTerms(serviceSource, ["sqlite", "better-sqlite3", "database-adapter", "domains/cost", "MeasurementProfileFactsResolver", "MeasurementUnitResolver", "cause", "stack"], servicePath);
  const costSource = readFileSync(path.join(sourceRoot, "server", "app", "cost-back-office-service.ts"), "utf8");
  const start = costSource.indexOf("  appendProfileReestablishmentDraft(");
  const end = costSource.indexOf("\n  createAndPublishRecipe(", start);
  const facade = costSource.slice(start, end);
  assert.match(facade, /profileReestablishment\.appendDraft\(/);
  assert.doesNotMatch(facade, /randomUUID|IngredientMeasurementProfile\.create|appendDraftAfterDeprecation|saveWithExpectedVersion|MeasurementProfileFactsResolver|MeasurementUnitResolver/);
  const serverSource = readFileSync(path.join(sourceRoot, "server", "index.ts"), "utf8");
  assert.equal(Array.from(serverSource.matchAll(/new IngredientMeasurementProfileReestablishmentService\(/g)).length, 1);
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

test("Ingredient 003K keeps Canonical Ingredient reactivation inside its ledger-driven exact boundary", () => {
  const approved003KPaths = new Set([
    "migrations/018_canonical_ingredient_lifecycle_events.sql",
    "src/domains/recipe/contracts/canonical-ingredient-contract.ts",
    "src/domains/recipe/contracts/canonical-ingredient-management-contract.ts",
    "src/domains/recipe/ingredient-catalog/canonical-ingredient.ts",
    "src/domains/recipe/ingredient-catalog/persistence/records.ts",
    "src/domains/recipe/ingredient-catalog/persistence/canonical-ingredient-persistence-mapper.ts",
    "src/domains/recipe/ingredient-catalog/infrastructure/sqlite-canonical-ingredient-repository.ts",
    "src/domains/recipe/ingredient-catalog/application/errors.ts",
    "src/domains/recipe/ingredient-catalog/application/canonical-ingredient-lifecycle-service.ts",
    "src/domains/recipe/index.ts",
    "src/server/app/canonical-ingredient-management-service.ts",
    "src/server/app/routes.ts",
    "src/tests/canonical-ingredient-catalog.test.ts",
    "src/tests/canonical-ingredient-persistence.integration.test.ts",
    "src/tests/recipe-migration-018.integration.test.ts",
    "src/tests/canonical-ingredient-lifecycle-application.test.ts",
    "src/tests/canonical-ingredient-lifecycle-api.integration.test.ts",
    "src/tests/architecture-guards.test.ts",
    "scripts/migration-upgrade-014.mjs",
    "src/tests/recipe-migration-017.integration.test.ts",
    "src/tests/canonical-ingredient-reference-impact-persistence.integration.test.ts"
  ]);
  assert.equal(approved003KPaths.size, 21);
  const is003KResponsibility = (source: string): boolean =>
    /reactivate\s*\(|REACTIVATED|canonical-ingredient-lifecycle-events/.test(source);
  assert.equal(is003KResponsibility("service.reactivate(command)"), true);
  const responsibilityFiles = [
    ...filesUnder(sourceRoot, [".ts", ".tsx"]),
    ...filesUnder(path.join(projectRoot, "migrations"), [".sql"])
  ].filter((filename) => is003KResponsibility(readFileSync(filename, "utf8")))
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"))
    .filter((relative) => relative !== "src/tests/architecture-guards.test.ts")
    .sort();
  const approvedResponsibilityFiles = [...approved003KPaths]
    .filter((relative) => relative !== "src/tests/architecture-guards.test.ts")
    .filter((relative) => is003KResponsibility(readFileSync(path.join(projectRoot, ...relative.split("/")), "utf8")))
    .sort();
  assert.deepEqual(responsibilityFiles, approvedResponsibilityFiles);
  assert.equal(approved003KPaths.has("src/tests/simulated-reactivation.ts"), false);
  assert.equal(is003KResponsibility("export const simulated = () => aggregate.reactivate(audit);"), true,
    "The same classifier must detect a simulated unauthorized twenty-second responsibility path.");
  const aggregateSource = readFileSync(path.join(sourceRoot, "domains", "recipe", "ingredient-catalog", "canonical-ingredient.ts"), "utf8");
  const mapperSource = readFileSync(path.join(sourceRoot, "domains", "recipe", "ingredient-catalog", "persistence", "canonical-ingredient-persistence-mapper.ts"), "utf8");
  assert.match(aggregateSource, /reactivate\(audit/);
  assert.match(mapperSource, /lifecycleHistory/);
  assert.doesNotMatch(aggregateSource, /sqlite|DatabaseAdapter|better-sqlite/i);
});

test("PR-COST-005 keeps Supplier Foundation inside its exact Cost-owned responsibility boundary", () => {
  const approvedCost005Paths = new Set([
    "migrations/019_cost_suppliers.sql",
    "src/domains/cost/domain/supplier.ts",
    "src/domains/cost/domain/supplier-repository.ts",
    "src/domains/cost/domain/identities.ts",
    "src/domains/cost/domain/errors.ts",
    "src/domains/cost/persistence/supplier-records.ts",
    "src/domains/cost/infrastructure/sqlite-cost-supplier-repository.ts",
    "src/domains/cost/application/cost-supplier-service.ts",
    "src/domains/cost/application/cost-supplier-errors.ts",
    "src/domains/cost/index.ts",
    "src/server/app/cost-back-office-service.ts",
    "src/server/app/routes.ts",
    "src/server/index.ts",
    "src/tests/cost-supplier-domain.test.ts",
    "src/tests/cost-supplier-persistence.integration.test.ts",
    "src/tests/cost-supplier-application.test.ts",
    "src/tests/cost-back-office-api.integration.test.ts",
    "src/tests/architecture-guards.test.ts",
    "src/tests/recipe-migration-017.integration.test.ts",
    "src/tests/recipe-migration-018.integration.test.ts",
    "src/tests/canonical-ingredient-reference-impact-persistence.integration.test.ts"
  ]);
  assert.equal(approvedCost005Paths.size, 21);
  const isCost005Responsibility = (source: string): boolean =>
    !/\bCostPurchase(?:[A-Z][A-Za-z]*|\b)|\bPurchaseId\b|\bPurchaseLineId\b/.test(source)
    && /\bCostSupplier(?:[A-Z][A-Za-z]*|\b)|\bexport class SupplierId\b|COST_SUPPLIER_|CREATE TABLE IF NOT EXISTS cost_suppliers/.test(source);
  assert.equal(isCost005Responsibility("new CostSupplierService(repository)"), true);
  const responsibilityFiles = [
    ...filesUnder(sourceRoot, [".ts", ".tsx"]),
    ...filesUnder(path.join(projectRoot, "migrations"), [".sql"])
  ].filter((filename) => isCost005Responsibility(readFileSync(filename, "utf8")))
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"))
    .filter((relative) => relative !== "src/tests/architecture-guards.test.ts")
    .sort();
  const approvedResponsibilityFiles = [...approvedCost005Paths]
    .filter((relative) => relative !== "src/tests/architecture-guards.test.ts")
    .filter((relative) => isCost005Responsibility(readFileSync(path.join(projectRoot, ...relative.split("/")), "utf8")))
    .sort();
  assert.deepEqual(responsibilityFiles, approvedResponsibilityFiles);
  assert.equal(approvedCost005Paths.has("src/tests/simulated-supplier.ts"), false);
  assert.equal(
    isCost005Responsibility("export const simulated = () => new CostSupplierService(repository);"),
    true,
    "The same classifier must reject a simulated unauthorized later Cost responsibility path."
  );
  const supplierSource = readFileSync(path.join(sourceRoot, "domains", "cost", "domain", "supplier.ts"), "utf8");
  const serviceSource = readFileSync(path.join(sourceRoot, "domains", "cost", "application", "cost-supplier-service.ts"), "utf8");
  const facadeSource = readFileSync(path.join(sourceRoot, "server", "app", "cost-back-office-service.ts"), "utf8");
  assert.doesNotMatch(supplierSource, /sqlite|DatabaseAdapter|better-sqlite/i);
  assert.doesNotMatch(serviceSource, /sqlite|DatabaseAdapter|better-sqlite|CostBackOffice/i);
  assert.match(facadeSource, /supplierService\.create/);
  assert.doesNotMatch(facadeSource, /SupplierId\.fromUuid|CostSupplier\.create|new SqliteCostSupplierRepository/);
});

test("PR-COST-006 keeps Purchase Foundation inside its exact Cost-owned responsibility boundary", () => {
  const approvedCost006Paths = new Set([
    "migrations/020_cost_purchases.sql",
    "src/domains/cost/domain/purchase.ts",
    "src/domains/cost/domain/purchase-repository.ts",
    "src/domains/cost/domain/identities.ts",
    "src/domains/cost/domain/errors.ts",
    "src/domains/cost/persistence/purchase-records.ts",
    "src/domains/cost/infrastructure/sqlite-cost-purchase-repository.ts",
    "src/domains/cost/application/cost-purchase-service.ts",
    "src/domains/cost/application/cost-purchase-errors.ts",
    "src/domains/cost/index.ts",
    "src/server/app/cost-back-office-service.ts",
    "src/server/app/routes.ts",
    "src/server/index.ts",
    "src/tests/cost-purchase-domain.test.ts",
    "src/tests/cost-purchase-persistence.integration.test.ts",
    "src/tests/cost-purchase-application.test.ts",
    "src/tests/cost-back-office-api.integration.test.ts",
    "src/tests/architecture-guards.test.ts",
    "src/tests/recipe-migration-017.integration.test.ts",
    "src/tests/recipe-migration-018.integration.test.ts",
    "src/tests/canonical-ingredient-reference-impact-persistence.integration.test.ts"
  ]);
  assert.equal(approvedCost006Paths.size, 21);
  const isCost006Responsibility = (source: string): boolean =>
    !/\bAcceptedPurchase|acceptPurchase|\/acceptances|cost_accepted_purchase/i.test(source)
    && /\bCostPurchase(?:[A-Z][A-Za-z]*|\b)|\bPurchaseId\b|\bPurchaseLineId\b|COST_PURCHASE_|cost_purchase_(?:aggregates|lines)|\/api\/admin\/cost\/purchases/.test(source);
  assert.equal(isCost006Responsibility("new CostPurchaseService(repository)"), true);
  const responsibilityFiles = [
    ...filesUnder(sourceRoot, [".ts", ".tsx"]),
    ...filesUnder(path.join(projectRoot, "migrations"), [".sql"])
  ].filter((filename) => isCost006Responsibility(readFileSync(filename, "utf8")))
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"))
    .filter((relative) => relative !== "src/tests/architecture-guards.test.ts")
    .sort();
  const approvedResponsibilityFiles = [...approvedCost006Paths]
    .filter((relative) => relative !== "src/tests/architecture-guards.test.ts")
    .filter((relative) => isCost006Responsibility(readFileSync(path.join(projectRoot, ...relative.split("/")), "utf8")))
    .sort();
  assert.deepEqual(responsibilityFiles, approvedResponsibilityFiles);
  assert.equal(approvedCost006Paths.has("src/tests/simulated-purchase.ts"), false);
  assert.equal(
    isCost006Responsibility("export const simulated = () => '/api/admin/cost/purchases';"),
    true,
    "The same classifier must reject a simulated unauthorized later Purchase responsibility path."
  );
  const purchaseSource = readFileSync(path.join(sourceRoot, "domains", "cost", "domain", "purchase.ts"), "utf8");
  const serviceSource = readFileSync(path.join(sourceRoot, "domains", "cost", "application", "cost-purchase-service.ts"), "utf8");
  const facadeSource = readFileSync(path.join(sourceRoot, "server", "app", "cost-back-office-service.ts"), "utf8");
  assert.doesNotMatch(purchaseSource, /Money|MonetaryAmount|Currency|AcceptedPurchase|CostSnapshot/i);
  assert.doesNotMatch(serviceSource, /sqlite|DatabaseAdapter|better-sqlite|CostBackOffice/i);
  assert.match(facadeSource, /purchaseService\.create/);
  assert.doesNotMatch(facadeSource, /PurchaseId\.fromUuid|CostPurchase\.create|new SqliteCostPurchaseRepository/);
});

test("PR-COST-007 keeps Accepted Purchase actual-price evidence inside its exact responsibility boundary", () => {
  const approvedCost007Paths = new Set([
    "migrations/021_accepted_purchase_evidence.sql",
    "src/domains/cost/domain/accepted-purchase.ts",
    "src/domains/cost/domain/accepted-purchase-repository.ts",
    "src/domains/cost/domain/identities.ts",
    "src/domains/cost/domain/errors.ts",
    "src/domains/cost/persistence/accepted-purchase-records.ts",
    "src/domains/cost/infrastructure/sqlite-accepted-purchase-repository.ts",
    "src/domains/cost/application/accepted-purchase-service.ts",
    "src/domains/cost/application/accepted-purchase-errors.ts",
    "src/domains/cost/index.ts",
    "src/domains/cost/domain/ingredient-reference-impact-read-port.ts",
    "src/domains/cost/infrastructure/sqlite-cost-repository.ts",
    "src/application/canonical-ingredient-reference-impact-service.ts",
    "src/server/app/cost-back-office-service.ts",
    "src/server/app/routes.ts",
    "src/server/index.ts",
    "src/web/ingredients/page.ts",
    "src/tests/accepted-purchase-domain.test.ts",
    "src/tests/accepted-purchase-persistence.integration.test.ts",
    "src/tests/accepted-purchase-application.test.ts",
    "src/tests/canonical-ingredient-reference-impact-application.test.ts",
    "src/tests/canonical-ingredient-reference-impact-persistence.integration.test.ts",
    "src/tests/canonical-ingredient-reference-impact-api.integration.test.ts",
    "src/tests/cost-back-office-api.integration.test.ts",
    "src/tests/architecture-guards.test.ts",
    "tests/e2e/canonical-ingredient-management.spec.ts",
    "src/tests/recipe-migration-017.integration.test.ts",
    "src/tests/recipe-migration-018.integration.test.ts"
  ]);
  assert.equal(approvedCost007Paths.size, 28);
  const isCost007Responsibility = (source: string): boolean =>
    !/VAL-2|ActualPurchase|QuoteFallback|findEligibleAcceptedPurchaseLines|AMBIGUOUS_ACCEPTED_PURCHASE_COST/.test(source)
    && /\bAcceptedPurchase|cost_accepted_purchase|\/acceptances|acceptedPurchases/.test(source);
  assert.equal(isCost007Responsibility("new AcceptedPurchaseService(repository)"), true);
  const responsibilityFiles = [...filesUnder(sourceRoot, [".ts", ".tsx"]), ...filesUnder(path.join(projectRoot, "tests"), [".ts", ".tsx"]), ...filesUnder(path.join(projectRoot, "migrations"), [".sql"])]
    .filter((filename) => isCost007Responsibility(readFileSync(filename, "utf8")))
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"))
    .filter((relative) => relative !== "src/tests/architecture-guards.test.ts").sort();
  const approvedResponsibilityFiles = [...approvedCost007Paths].filter((relative) => relative !== "src/tests/architecture-guards.test.ts")
    .filter((relative) => isCost007Responsibility(readFileSync(path.join(projectRoot, ...relative.split("/")), "utf8"))).sort();
  assert.deepEqual(responsibilityFiles, approvedResponsibilityFiles);
  assert.equal(approvedCost007Paths.has("src/tests/simulated-accepted-purchase.ts"), false);
  assert.equal(isCost007Responsibility("export const simulated = () => '/api/admin/cost/purchases/x/acceptances';"), true, "The same classifier must reject a simulated unauthorized twenty-ninth Accepted Purchase responsibility path.");
  const serviceSource = readFileSync(path.join(sourceRoot, "domains", "cost", "application", "accepted-purchase-service.ts"), "utf8");
  const facadeSource = readFileSync(path.join(sourceRoot, "server", "app", "cost-back-office-service.ts"), "utf8");
  assert.doesNotMatch(serviceSource, /sqlite|DatabaseAdapter|better-sqlite|CostBackOffice/i);
  assert.match(serviceSource, /normalizeAt/);
  assert.match(facadeSource, /acceptedPurchaseService\.accept/);
  assert.doesNotMatch(facadeSource, /AcceptedPurchaseId\.fromUuid|AcceptedPurchase\.create|new SqliteAcceptedPurchaseRepository/);
});

test("PR-COST-008 keeps actual-price-first valuation policy inside its exact responsibility boundary", () => {
  const approvedCost008Paths = new Set([
    "src/domains/cost/domain/cost-evaluation-read-unit-of-work.ts",
    "src/domains/cost/domain/recipe-cost-evaluation.ts",
    "src/domains/cost/application/recipe-cost-evaluation-service.ts",
    "src/domains/cost/infrastructure/sqlite-cost-evaluation-read-unit-of-work.ts",
    "src/domains/cost/infrastructure/sqlite-cost-repository.ts",
    "src/domains/cost/index.ts",
    "src/web/cost/page.ts",
    "src/tests/cost-evaluation.test.ts",
    "src/tests/cost-evaluation.integration.test.ts",
    "src/tests/cost-back-office-api.integration.test.ts",
    "src/tests/architecture-guards.test.ts",
    "tests/e2e/cost-back-office.spec.ts",
    "tests/e2e/canonical-ingredient-management.spec.ts"
  ]);
  assert.equal(approvedCost008Paths.size, 13);
  const isCost008Responsibility = (source: string): boolean =>
    /VAL-2|ActualPurchase|QuoteFallback|findEligibleAcceptedPurchaseLines|AMBIGUOUS_ACCEPTED_PURCHASE_COST/.test(source);
  assert.equal(
    isCost008Responsibility("reader.findEligibleAcceptedPurchaseLines(ingredientId, valuedAt)"),
    true
  );
  const responsibilityFiles = [
    ...filesUnder(sourceRoot, [".ts", ".tsx"]),
    ...filesUnder(path.join(projectRoot, "tests"), [".ts", ".tsx"])
  ]
    .filter((filename) => isCost008Responsibility(readFileSync(filename, "utf8")))
    .map((filename) => path.relative(projectRoot, filename).replaceAll("\\", "/"))
    .filter((relative) => relative !== "src/tests/architecture-guards.test.ts")
    .sort();
  const approvedResponsibilityFiles = [...approvedCost008Paths]
    .filter((relative) => relative !== "src/tests/architecture-guards.test.ts")
    .filter((relative) => isCost008Responsibility(
      readFileSync(path.join(projectRoot, ...relative.split("/")), "utf8")
    ))
    .sort();
  assert.deepEqual(responsibilityFiles, approvedResponsibilityFiles);
  assert.equal(approvedCost008Paths.has("src/tests/simulated-valuation.ts"), false);
  assert.equal(
    isCost008Responsibility("export const later = 'ActualPurchase';"),
    true,
    "The same classifier must reject an unauthorized thirteenth valuation responsibility path."
  );
  const serviceSource = readFileSync(
    path.join(sourceRoot, "domains", "cost", "application", "recipe-cost-evaluation-service.ts"),
    "utf8"
  );
  const evaluationSource = readFileSync(
    path.join(sourceRoot, "domains", "cost", "domain", "recipe-cost-evaluation.ts"),
    "utf8"
  );
  assert.match(evaluationSource, /COST_VALUATION_POLICY = "VAL-2"/);
  assert.match(serviceSource, /AMBIGUOUS_ACCEPTED_PURCHASE_COST/);
  assert.doesNotMatch(serviceSource, /CostSnapshot|INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM/i);
});
