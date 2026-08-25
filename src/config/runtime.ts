import path from "node:path";

export type RosConfig = {
  host: string;
  port: number;
  databasePath: string;
  authentication?: RosAuthenticationConfig;
};

export type RosAuthenticationConfig = Readonly<{
  mode: "disabled" | "required";
  secureCookie: boolean;
  sessionTtlMinutes: number;
  bootstrapAdministrator?: Readonly<{ login: string; password: string; displayName?: string }>;
}>;

function integer(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < 5 || parsed > 1_440) throw new Error("ROS authentication session TTL is invalid.");
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RosConfig {
  const production = env.NODE_ENV === "production";
  const mode = env.ROS_AUTH_MODE === undefined ? (production ? "required" : "disabled") : env.ROS_AUTH_MODE;
  if (mode !== "disabled" && mode !== "required") throw new Error("ROS authentication mode is invalid.");
  if (production && mode !== "required") throw new Error("Production ROS requires authentication.");
  const bootstrapLogin = env.ROS_BOOTSTRAP_ADMIN_LOGIN;
  const bootstrapPassword = env.ROS_BOOTSTRAP_ADMIN_PASSWORD;
  return {
    host: env.ROS_HOST || "127.0.0.1",
    port: Number(env.ROS_PORT || 3090),
    databasePath: path.resolve(env.ROS_DATABASE_PATH || "./data/ros-v2-dev.sqlite"),
    authentication: {
      mode,
      secureCookie: env.ROS_AUTH_SECURE_COOKIE === undefined ? production : env.ROS_AUTH_SECURE_COOKIE === "true",
      sessionTtlMinutes: integer(env.ROS_AUTH_SESSION_TTL_MINUTES, 720),
      ...(bootstrapLogin && bootstrapPassword ? { bootstrapAdministrator: { login: bootstrapLogin, password: bootstrapPassword, displayName: env.ROS_BOOTSTRAP_ADMIN_DISPLAY_NAME } } : {})
    }
  };
}
