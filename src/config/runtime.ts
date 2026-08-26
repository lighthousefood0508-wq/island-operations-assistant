import path from "node:path";

export type RosConfig = {
  host: string;
  port: number;
  databasePath: string;
  authentication?: RosAuthenticationConfig;
  runtime?: RosRuntimeConfig;
  recovery?: RosRecoveryConfig;
};

export type RosAuthenticationConfig = Readonly<{
  mode: "disabled" | "required";
  secureCookie: boolean;
  sessionTtlMinutes: number;
  publicOrigin?: string;
  bootstrapAdministrator?: Readonly<{ login: string; password: string; displayName?: string }>;
}>;

export type RosRuntimeConfig = Readonly<{
  environment: "development" | "test" | "production";
  migrationMode: "apply" | "verify";
}>;

export type RosRecoveryConfig = Readonly<{
  backupDirectory: string;
  retentionCount: number;
  maximumBackupAgeHours: number;
}>;

function integer(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < 5 || parsed > 1_440) throw new Error("ROS authentication session TTL is invalid.");
  return parsed;
}

function port(value: string | undefined): number {
  const parsed = Number(value ?? 3090);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65_535) throw new Error("ROS port is invalid.");
  return parsed;
}

function boundedInteger(value: string | undefined, fallback: number, label: string, maximum: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) throw new Error(`ROS ${label} is invalid.`);
  return parsed;
}

function publicOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("ROS public origin is invalid."); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("ROS public origin must be an absolute HTTPS origin.");
  }
  return parsed.origin;
}

function loopback(host: string): boolean {
  return host === "127.0.0.1" || host === "::1";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RosConfig {
  const nodeEnvironment = env.NODE_ENV ?? "development";
  if (nodeEnvironment !== "development" && nodeEnvironment !== "test" && nodeEnvironment !== "production") {
    throw new Error("ROS NODE_ENV is invalid.");
  }
  const production = nodeEnvironment === "production";
  const mode = env.ROS_AUTH_MODE === undefined ? (production ? "required" : "disabled") : env.ROS_AUTH_MODE;
  if (mode !== "disabled" && mode !== "required") throw new Error("ROS authentication mode is invalid.");
  if (production && mode !== "required") throw new Error("Production ROS requires authentication.");
  const host = env.ROS_HOST || "127.0.0.1";
  const configuredDatabasePath = env.ROS_DATABASE_PATH;
  const databasePath = path.resolve(configuredDatabasePath || "./data/ros-v2-dev.sqlite");
  const secureCookie = env.ROS_AUTH_SECURE_COOKIE === undefined ? production : env.ROS_AUTH_SECURE_COOKIE === "true";
  const origin = publicOrigin(env.ROS_PUBLIC_ORIGIN);
  if (production && !secureCookie) throw new Error("Production ROS requires secure session cookies.");
  if (production && !origin) throw new Error("Production ROS requires a canonical public origin.");
  if (production && !loopback(host)) throw new Error("Production ROS must bind only to a loopback host.");
  if (production && (!configuredDatabasePath || !path.isAbsolute(configuredDatabasePath))) {
    throw new Error("Production ROS requires an absolute database path.");
  }
  const configuredBackupDirectory = env.ROS_BACKUP_DIRECTORY;
  const backupDirectory = path.resolve(configuredBackupDirectory || path.join(path.dirname(databasePath), "backups"));
  if (production && (!configuredBackupDirectory || !path.isAbsolute(configuredBackupDirectory))) {
    throw new Error("Production ROS requires an absolute backup directory.");
  }
  if (backupDirectory === path.dirname(databasePath)) {
    throw new Error("ROS backup directory must be distinct from the database directory.");
  }
  const bootstrapLogin = env.ROS_BOOTSTRAP_ADMIN_LOGIN;
  const bootstrapPassword = env.ROS_BOOTSTRAP_ADMIN_PASSWORD;
  return {
    host,
    port: port(env.ROS_PORT),
    databasePath,
    authentication: {
      mode,
      secureCookie,
      sessionTtlMinutes: integer(env.ROS_AUTH_SESSION_TTL_MINUTES, 720),
      ...(origin ? { publicOrigin: origin } : {}),
      ...(bootstrapLogin && bootstrapPassword ? { bootstrapAdministrator: { login: bootstrapLogin, password: bootstrapPassword, displayName: env.ROS_BOOTSTRAP_ADMIN_DISPLAY_NAME } } : {})
    },
    runtime: { environment: nodeEnvironment, migrationMode: production ? "verify" : "apply" },
    recovery: {
      backupDirectory,
      retentionCount: boundedInteger(env.ROS_BACKUP_RETENTION_COUNT, 14, "backup retention count", 365),
      maximumBackupAgeHours: boundedInteger(env.ROS_BACKUP_MAX_AGE_HOURS, 26, "maximum backup age", 720)
    }
  };
}
