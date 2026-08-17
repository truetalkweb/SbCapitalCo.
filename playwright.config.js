import { defineConfig } from "@playwright/test";
import process from "node:process";

const frontendPort = Number(process.env.RELEASE_FRONTEND_PORT || 4173);
const backendPort = Number(process.env.RELEASE_BACKEND_PORT || 4012);
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const backendUrl = process.env.RELEASE_BACKEND_URL || `http://127.0.0.1:${backendPort}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: frontendUrl,
    colorScheme: "dark",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: `npx vite --host 127.0.0.1 --port ${frontendPort} --strictPort`,
      url: frontendUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_BROKER_API_URL: backendUrl,
      },
    },
    {
      command: "npm start",
      cwd: "../backend",
      url: `${backendUrl}/api/platform/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: String(backendPort),
        ALLOW_LOCAL_CORS: "true",
        DISABLE_QUESTRADE_AUTH: "true",
      },
    },
  ],
});
