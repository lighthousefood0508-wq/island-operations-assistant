import path from "node:path";

export type RosConfig = {
  host: string;
  port: number;
  databasePath: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RosConfig {
  return {
    host: env.ROS_HOST || "127.0.0.1",
    port: Number(env.ROS_PORT || 3090),
    databasePath: path.resolve(env.ROS_DATABASE_PATH || "./data/ros-dev.sqlite")
  };
}
