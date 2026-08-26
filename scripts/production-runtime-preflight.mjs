import { accessSync, constants, existsSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "../dist/config/runtime.js";

const config = loadConfig();
if (config.runtime?.environment !== "production" || config.runtime.migrationMode !== "verify") {
  throw new Error("Production runtime preflight requires NODE_ENV=production.");
}
if (config.authentication?.mode !== "required" || !config.authentication.secureCookie || !config.authentication.publicOrigin) {
  throw new Error("Production runtime authentication configuration is incomplete.");
}

const databaseDirectory = path.dirname(config.databasePath);
if (!existsSync(databaseDirectory)) throw new Error("Production database directory does not exist.");
accessSync(databaseDirectory, constants.R_OK | constants.W_OK);

console.log(JSON.stringify({
  ok: true,
  host: config.host,
  port: config.port,
  databaseDirectory,
  publicOrigin: config.authentication.publicOrigin,
  migrationMode: config.runtime.migrationMode
}));
