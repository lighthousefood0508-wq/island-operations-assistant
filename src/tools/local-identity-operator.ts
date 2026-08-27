import { randomUUID } from "node:crypto";
import { loadConfig } from "../config/runtime.js";
import { createDatabase } from "../shared/database/index.js";
import { AuthenticationService, SqliteAuthenticationRepository } from "../system/authentication/index.js";

type Command = "create" | "rotate" | "disable" | "enable";

function fail(message: string): never { throw new Error(message); }
function option(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function command(): Command {
  const value = process.argv[2];
  if (value === "create" || value === "rotate" || value === "disable" || value === "enable") return value;
  return fail("Supported commands are create, rotate, disable, and enable.");
}
async function hiddenPassword(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== "function") fail("Password input requires a protected interactive TTY.");
  process.stdout.write("Password: ");
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding("utf8");
  return await new Promise<string>((resolve, reject) => {
    let value = "";
    const done = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\n"); resolve(value); };
    process.stdin.on("data", (chunk: string) => { for (const character of chunk) { if (character === "\r" || character === "\n") return done(); if (character === "\u0003") { process.stdin.setRawMode(false); reject(new Error("Password input cancelled.")); return; } if (character === "\u007f") { value = value.slice(0, -1); } else { value += character; } } });
  });
}

const reportedOperation = ["create", "rotate", "disable", "enable"].includes(process.argv[2] ?? "") ? process.argv[2] : "invalid";
const reportedLogin = option("--login");
const reportedActor = option("--actor")?.trim();
let database: ReturnType<typeof createDatabase> | undefined;

try {
  const action = command();
  if (process.argv.some((value) => /password|secret/i.test(value))) fail("Passwords must not be supplied by argument or environment.");
  const login = option("--login"); const actor = option("--actor");
  if (!login || !actor || !actor.trim()) fail("--login and --actor are required.");
  const config = loadConfig();
  if (config.runtime?.environment !== "production" || config.authentication?.mode !== "required") fail("Local identity operations require complete production authentication configuration.");
  database = createDatabase(config);
  const service = new AuthenticationService(new SqliteAuthenticationRepository(database), config.authentication);
  const password = action === "create" || action === "rotate" ? await hiddenPassword() : undefined;
  const result = action === "create" ? service.createLocalUser({ login, displayName: option("--display-name") ?? login, role: option("--role"), password })
    : action === "rotate" ? service.rotateLocalPassword({ login, password })
    : service.setLocalUserStatus({ login, status: action === "enable" ? "active" : "disabled" });
  process.stdout.write(`${JSON.stringify({ operation: action, targetUsername: login, targetRole: "role" in result ? result.role : undefined, actor: actor.trim(), timestamp: new Date().toISOString(), revokedSessionCount: "revokedSessionCount" in result ? result.revokedSessionCount : 0, success: true, evidenceId: `identity-op_${randomUUID()}` })}\n`);
} catch {
  process.stderr.write(JSON.stringify({ operation: reportedOperation, targetUsername: reportedLogin, actor: reportedActor, timestamp: new Date().toISOString(), success: false }) + "\n");
  process.exitCode = 1;
} finally { database?.close(); }
