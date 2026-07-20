import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, type RosConfig } from "../config/runtime.js";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";
import { CatalogRepository, CatalogService } from "../domains/catalog/index.js";
import { OperationsRepository, OperationsService, OrderRepository, OrderService } from "../domains/operations/index.js";
import { createRoute } from "./app/routes.js";

export function createRosServer(config: RosConfig = loadConfig()): Server {
  const database = createDatabase(config);
  runMigrations(database);
  const catalog = new CatalogService(new CatalogRepository(database));
  const operations = new OperationsService(new OperationsRepository(database));
  const orders = new OrderService(new OrderRepository(database));
  const server = createServer(createRoute({ catalog, operations, orders }));
  server.on("close", () => database.close());
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = loadConfig();
  const server = createRosServer(config);
  server.listen(config.port, config.host, () => {
    console.log(`Desert Island ROS listening on http://${config.host}:${config.port}`);
  });
}
