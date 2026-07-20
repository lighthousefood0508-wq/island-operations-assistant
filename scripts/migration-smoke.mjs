import { rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const databasePath = path.resolve("data/migration-smoke.sqlite");
for (const suffix of ["", "-shm", "-wal"]) rmSync(`${databasePath}${suffix}`, { force: true });

const result = spawnSync(process.execPath, ["dist/shared/database/migrate.js"], {
  stdio: "inherit",
  env: { ...process.env, ROS_DATABASE_PATH: databasePath }
});

for (const suffix of ["", "-shm", "-wal"]) rmSync(`${databasePath}${suffix}`, { force: true });
process.exit(result.status ?? 1);
