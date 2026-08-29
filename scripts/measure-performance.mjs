import fs from "node:fs";
import process from "node:process";

import { chromium } from "@playwright/test";

const workspaces = [
  "dashboard",
  "scanner",
  "chart-analysis",
  "watchlist",
  "news",
  "alerts",
  "orders",
  "positions",
  "risk",
  "performance",
  "replay",
  "journal",
  "settings",
];

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const baseUrl = argument("--base-url", "http://127.0.0.1:4174").replace(/\/$/, "");
const outputPath = argument("--output");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const results = [];

try {
  for (const workspace of workspaces) {
    const page = await context.newPage();
    const startedAt = performance.now();
    let requestCount = 0;
    let transferredBytes = 0;

    page.on("request", () => {
      requestCount += 1;
    });
    page.on("response", async (response) => {
      const length = Number((await response.allHeaders())["content-length"] || 0);
      if (Number.isFinite(length) && length > 0) transferredBytes += length;
    });

    await page.goto(`${baseUrl}/e2e/fixture/index.html?view=${workspace}`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByTestId("release-workspace").waitFor({ state: "visible" });

    let chartReadyMs = null;
    if (workspace === "dashboard" || workspace === "chart-analysis" || workspace === "replay") {
      const canvas = page.locator("canvas").first();
      if (await canvas.count()) {
        await canvas.waitFor({ state: "visible" });
        chartReadyMs = Math.round(performance.now() - startedAt);
      }
    }

    const browserMetrics = await page.evaluate(() => ({
      domNodes: document.getElementsByTagName("*").length,
      firstContentfulPaint: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0),
      heapBytes: Math.round(performance.memory?.usedJSHeapSize || 0),
    }));

    results.push({
      workspace,
      readyMs: Math.round(performance.now() - startedAt),
      chartReadyMs,
      requestCount,
      transferredBytes,
      ...browserMetrics,
    });
    await page.close();
  }
} finally {
  await context.close();
  await browser.close();
}

const summary = {
  measuredAt: new Date().toISOString(),
  baseUrl,
  averages: {
    readyMs: Math.round(results.reduce((sum, row) => sum + row.readyMs, 0) / results.length),
    requestCount: Math.round(results.reduce((sum, row) => sum + row.requestCount, 0) / results.length),
    transferredBytes: Math.round(results.reduce((sum, row) => sum + row.transferredBytes, 0) / results.length),
    domNodes: Math.round(results.reduce((sum, row) => sum + row.domNodes, 0) / results.length),
  },
  workspaces: results,
};

const serialized = `${JSON.stringify(summary, null, 2)}\n`;
if (outputPath) fs.writeFileSync(outputPath, serialized, "utf8");
process.stdout.write(serialized);
