import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, type RosConfig } from "../config/runtime.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations, verifyMigrationsCurrent } from "../shared/database/migrate.js";
import { CatalogRepository, CatalogService } from "../domains/catalog/index.js";
import { DailyReportReadService, LifecycleRepository, LifecycleService, OperationsRepository, OperationsService, OrderRepository, OrderService, PaymentRepository, PaymentService } from "../domains/operations/index.js";
import {
  CanonicalIngredientCreationService,
  CanonicalIngredientLifecycleService,
  CanonicalIngredientManagementReadService,
  IngredientMeasurementProfileCreationService,
  IngredientMeasurementProfileDeprecationService,
  IngredientMeasurementProfileReestablishmentService,
  IngredientMeasurementProfileSupersessionService,
  MeasurementProfileFactsResolver
} from "../domains/recipe/index.js";
import { SqliteRecipeRepository } from "../domains/recipe/infrastructure/sqlite-recipe-repository.js";
import { SqliteCostRepository } from "../domains/cost/infrastructure/sqlite-cost-repository.js";
import {
  CostSupplierService,
  SqliteCostSupplierRepository,
  CostPurchaseService,
  SqliteCostPurchaseRepository,
  AcceptedPurchaseService,
  SqliteAcceptedPurchaseRepository,
  RecipeCostSnapshotService,
  RecipeCostHistoryReadService,
  RecipeCostAnalyticsService,
  SqliteCostSnapshotRepository,
  CostEvidenceReadService,
  SqliteCostEvidenceReadPort
} from "../domains/cost/index.js";
import { CanonicalIngredientReferenceImpactService } from "../application/canonical-ingredient-reference-impact-service.js";
import { IngredientMeasurementProfileCorrectionImpactService } from "../application/ingredient-measurement-profile-correction-impact-service.js";
import {
  SqliteCanonicalIngredientRepository
} from "../domains/recipe/ingredient-catalog/infrastructure/sqlite-canonical-ingredient-repository.js";
import { MeasurementUnitResolver } from "../domains/recipe/measurement/measurement-unit-resolver.js";
import { MeasurementNormalizer } from "../domains/recipe/measurement/measurement-normalizer.js";
import { IngredientMeasurementNormalizationService } from "../domains/recipe/measurement-profile/ingredient-normalization-service.js";
import { SqliteIngredientMeasurementProfileRepository } from "../domains/recipe/measurement-profile/infrastructure/sqlite-ingredient-measurement-profile-repository.js";
import {
  CanonicalIngredientManagementService
} from "./app/canonical-ingredient-management-service.js";
import { createRoute } from "./app/routes.js";
import { CostBackOfficeService } from "./app/cost-back-office-service.js";
import { SseHub } from "./events/sse.js";
import {
  AuthenticationService,
  SqliteAuthenticationRepository
} from "../system/authentication/index.js";

export function createRosServer(config: RosConfig = loadConfig()): Server {
  const database = createDatabase(config);
  try {
  if (config.runtime?.migrationMode === "verify") verifyMigrationsCurrent(database);
  else runMigrations(database);
  const authentication = new AuthenticationService(
    new SqliteAuthenticationRepository(database),
    config.authentication
  );
  authentication.ensureBootstrap();
  const catalog = new CatalogService(new CatalogRepository(database));
  const operations = new OperationsService(new OperationsRepository(database));
  const paymentRepository = new PaymentRepository(database);
  const orders = new OrderService(new OrderRepository(database), paymentRepository);
  const payments = new PaymentService(paymentRepository);
  const lifecycleRepository = new LifecycleRepository(database);
  const lifecycle = new LifecycleService(lifecycleRepository);
  const dailyReports = new DailyReportReadService(lifecycleRepository);
  const canonicalIngredientRepository =
    new SqliteCanonicalIngredientRepository(database);
  const canonicalIngredientReads = new CanonicalIngredientManagementReadService(
    canonicalIngredientRepository
  );
  const canonicalIngredients = new CanonicalIngredientManagementService(
    canonicalIngredientReads,
    new CanonicalIngredientLifecycleService(canonicalIngredientRepository)
  );
  const canonicalIngredientReferenceImpact =
    new CanonicalIngredientReferenceImpactService(
      canonicalIngredientReads,
      new SqliteRecipeRepository(database),
      new SqliteCostRepository(database)
    );
  const canonicalIngredientCreation = new CanonicalIngredientCreationService(
    canonicalIngredientRepository
  );
  const supplierService = new CostSupplierService(
    new SqliteCostSupplierRepository(database)
  );
  const purchaseService = new CostPurchaseService(
    new SqliteCostPurchaseRepository(database),
    new SqliteCostSupplierRepository(database)
  );
  const measurementUnits = new MeasurementUnitResolver();
  const profileCorrectionImpact = new IngredientMeasurementProfileCorrectionImpactService(
    new SqliteIngredientMeasurementProfileRepository(database, measurementUnits),
    canonicalIngredientReferenceImpact,
    new SqliteCostRepository(database)
  );
  const acceptedPurchaseService = new AcceptedPurchaseService(
    new SqliteCostPurchaseRepository(database),
    new SqliteAcceptedPurchaseRepository(database),
    new IngredientMeasurementNormalizationService(
      new SqliteIngredientMeasurementProfileRepository(database, measurementUnits),
      measurementUnits,
      new MeasurementNormalizer()
    )
  );
  const snapshotService = new RecipeCostSnapshotService(
    new SqliteCostSnapshotRepository(database)
  );
  const costEvidenceReadPort = new SqliteCostEvidenceReadPort(database);
  const costEvidenceReads = new CostEvidenceReadService(costEvidenceReadPort);
  const recipeCostHistory = new RecipeCostHistoryReadService(costEvidenceReadPort);
  const recipeCostAnalytics = new RecipeCostAnalyticsService(recipeCostHistory);
  const profileCreation = new IngredientMeasurementProfileCreationService(
    canonicalIngredientRepository,
    new SqliteIngredientMeasurementProfileRepository(database, measurementUnits),
    new MeasurementProfileFactsResolver(measurementUnits),
    measurementUnits
  );
  const profileSupersession = new IngredientMeasurementProfileSupersessionService(
    canonicalIngredientRepository,
    new SqliteIngredientMeasurementProfileRepository(database, measurementUnits),
    new MeasurementProfileFactsResolver(measurementUnits),
    measurementUnits,
    profileCorrectionImpact
  );
  const profileDeprecation = new IngredientMeasurementProfileDeprecationService(
    canonicalIngredientRepository,
    new SqliteIngredientMeasurementProfileRepository(database, measurementUnits)
  );
  const profileReestablishment = new IngredientMeasurementProfileReestablishmentService(
    canonicalIngredientRepository,
    new SqliteIngredientMeasurementProfileRepository(database, measurementUnits),
    new MeasurementProfileFactsResolver(measurementUnits),
    measurementUnits
  );
  const costBackOffice = new CostBackOfficeService(
    database,
    canonicalIngredientCreation,
    supplierService,
    purchaseService,
    acceptedPurchaseService,
    snapshotService,
    costEvidenceReads,
    recipeCostHistory,
    recipeCostAnalytics,
    profileCreation,
    profileSupersession,
    profileCorrectionImpact,
    profileDeprecation,
    profileReestablishment
  );
  const events = new SseHub();
  const server = createServer(createRoute({
    catalog,
    operations,
    orders,
    payments,
    lifecycle,
    dailyReports,
    canonicalIngredients,
    canonicalIngredientReferenceImpact,
    costBackOffice,
    authentication
  }, events));
  let databaseClosed = false;
  server.once("close", () => {
    if (!databaseClosed) {
      databaseClosed = true;
      database.close();
    }
  });
  return server;
  } catch (error) {
    database.close();
    throw error;
  }
}

/** ProductionRuntimeBoundary: stop accepting HTTP work and release SQLite exactly once. */
export function closeRosServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) return resolve();
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections();
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = loadConfig();
  const server = createRosServer(config);
  let shuttingDown = false;
  const shutdown = (signal: "SIGTERM" | "SIGINT") => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`ROS received ${signal}; closing HTTP and SQLite.`);
    void closeRosServer(server).catch((error: unknown) => {
      console.error("ROS graceful shutdown failed.", error);
      process.exitCode = 1;
    });
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  server.listen(config.port, config.host, () => {
    console.log(`Desert Island ROS listening on http://${config.host}:${config.port}`);
  });
}
