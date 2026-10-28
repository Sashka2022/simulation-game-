import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";
const port = process.env.TEST_PORT || "3100";
const baseURL = "http://127.0.0.1:" + port;
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "npm run dev -- --port " + port,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
