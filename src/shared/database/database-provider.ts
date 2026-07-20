import type { RosConfig } from "../../config/runtime.js";
import { BetterSqlite3Adapter } from "./better-sqlite3-adapter.js";
import type { DatabaseAdapter } from "./database-adapter.js";

export function createDatabase(config: RosConfig): DatabaseAdapter {
  return new BetterSqlite3Adapter(config.databasePath);
}
