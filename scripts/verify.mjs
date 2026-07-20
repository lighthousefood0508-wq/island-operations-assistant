import { spawnSync } from "node:child_process";

const commands = [
  ["typecheck", ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "tsconfig.json"]],
  ["lint", ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "tsconfig.json"]],
  ["tests", ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"]],
  ["tests", ["--test", "dist/tests/health.test.js", "dist/tests/contracts.test.js", "dist/tests/architecture-guards.test.js"]],
  ["architecture guards", ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"]],
  ["architecture guards", ["--test", "dist/tests/architecture-guards.test.js"]],
  ["migration smoke", ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"]],
  ["migration smoke", ["scripts/migration-smoke.mjs"]]
];

for (const [label, args] of commands) {
  console.log(`\n[verify] ${label}`);
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
