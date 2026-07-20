import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, type RosConfig } from "./app/config.js";
import { openDatabase } from "./database/client.js";
import { runMigrations } from "./database/migrate.js";
import { route } from "./app/routes.js";

export function createRosServer(config: RosConfig = loadConfig()): Server {
  const database = openDatabase(config.databasePath);
  runMigrations(database);
  const server = createServer(route);
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
