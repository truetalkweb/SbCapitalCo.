import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/correctness",
  outputDir: "./artifacts/correctness",
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-correctness-report", open: "never" }]],
  use: { baseURL: "http://127.0.0.1:4175", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 4175 --strictPort",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
    env: { VITE_BROKER_API_URL: "http://127.0.0.1:4999",
      VITE_SUPABASE_URL: "http://127.0.0.1:4998", VITE_SUPABASE_PUBLISHABLE_KEY: "isolated-test-publishable-key",
      VITE_SUPABASE_WORKSPACE_TABLE: "terminal_workspaces", VITE_ENABLE_BROKER_TOOLS: "false", VITE_ENABLE_LIVE_TRADING: "false" },
  },
});
