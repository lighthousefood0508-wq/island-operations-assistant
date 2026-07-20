import { rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const databasePath = path.resolve("data/e2e-test.sqlite");
const environment = {
  ...process.env,
  NODE_ENV: "test",
  ROS_HOST: "127.0.0.1",
  ROS_PORT: "3091",
  ROS_DATABASE_PATH: databasePath
};

function cleanDatabase() {
  for (const suffix of ["", "-shm", "-wal"]) rmSync(`${databasePath}${suffix}`, { force: true });
}

function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", env: environment });
  if (result.status !== 0) throw new Error(`Command failed: ${args.join(" ")}`);
}

cleanDatabase();
try {
  run(["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"]);
  run(["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)]);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  cleanDatabase();
}
