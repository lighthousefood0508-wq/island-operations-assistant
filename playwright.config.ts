import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.ROS_PORT || 3091);
const host = process.env.ROS_HOST || "127.0.0.1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  reporter: [["html", { open: "never" }], ["list"]],
  outputDir: "test-results",
  use: {
    baseURL: `http://${host}:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `"${process.execPath}" dist/server/index.js`,
    url: `http://${host}:${port}/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...process.env,
      NODE_ENV: "test",
      ROS_HOST: host,
      ROS_PORT: String(port),
      ROS_DATABASE_PATH: process.env.ROS_DATABASE_PATH || "./data/e2e-test.sqlite"
    }
  }
});
