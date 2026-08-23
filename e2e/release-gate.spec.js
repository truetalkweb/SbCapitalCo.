import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { expect, test } from "@playwright/test";

const fixtureUrl = (view, extra = "") => `/e2e/fixture/index.html?view=${view}${extra}`;
const artifactDir = path.resolve("release-gate-artifacts");

const workspaces = {
  dashboard: "Opportunity Board",
  scanner: "Why Ranked",
  "chart-analysis": "Chart Context",
  watchlist: "Watchlist Notes",
  news: "Selected Story",
  alerts: "Selected Alert",
  orders: "Order Summary",
  positions: "Position Activity",
  risk: "Risk Events",
  performance: "Performance Summary",
  replay: "Replay Controls",
  journal: "Recent Trades",
  settings: "Workspace Preferences",
};

function guardRuntime(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  return failures;
}

test.beforeAll(() => {
  fs.mkdirSync(artifactDir, { recursive: true });
});

test("fresh browser reaches the real authentication gate", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Secure workspace" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Sign in", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "Create account", exact: true })).toBeVisible();
});

for (const [workspace, landmark] of Object.entries(workspaces)) {
  test(`${workspace} workspace renders without runtime failures`, async ({ page }) => {
    const failures = guardRuntime(page);
    await page.goto(fixtureUrl(workspace));

    await expect(page.getByTestId("release-workspace")).toHaveAttribute("data-workspace", workspace);
    await expect(page.getByText(landmark, { exact: false }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Something went wrong|Unhandled exception|Application error/i);
    expect(failures).toEqual([]);
  });
}

test("charts render nonblank canvases at usable dimensions", async ({ page }) => {
  const failures = guardRuntime(page);
  await page.goto(fixtureUrl("chart-analysis"));
  const chart = page.getByTestId("release-chart");
  await expect(chart).toBeVisible();
  await expect.poll(async () => chart.locator("canvas").count()).toBeGreaterThan(0);

  const rendered = await chart.locator("canvas").first().evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height,
    imageLength: canvas.toDataURL("image/png").length,
  }));
  expect(rendered.width).toBeGreaterThan(300);
  expect(rendered.height).toBeGreaterThan(200);
  expect(rendered.imageLength).toBeGreaterThan(1_000);
  expect(failures).toEqual([]);
});

test("scanner, news, watchlist, and order views keep detail state aligned", async ({ page }) => {
  const failures = guardRuntime(page);

  await page.goto(fixtureUrl("dashboard"));
  await page.getByRole("tab", { name: "Losers", exact: true }).click();
  await expect(page.getByRole("button", { name: "TSLA 186.32 -0.58%", exact: true })).toBeVisible();

  await page.goto(fixtureUrl("news"));
  await page.getByRole("tab", { name: "Earnings", exact: true }).click();
  await expect(page.getByText("Apple receives analyst upgrade before earnings", { exact: false }).first()).toBeVisible();

  await page.goto(fixtureUrl("watchlist"));
  await page.getByPlaceholder("Search symbol...").fill("TSLA");
  await expect(page.getByText("TSLA", { exact: true }).first()).toBeVisible();

  await page.goto(fixtureUrl("orders"));
  await page.getByRole("tab", { name: "Working", exact: true }).click();
  await expect(page.getByText("SELL 5 TSLA", { exact: true })).toBeVisible();
  expect(failures).toEqual([]);
});

test("public trading shortcut remains review-only", async ({ page }) => {
  await page.goto(fixtureUrl("scanner"));
  await page.getByRole("button", { name: "Review Order", exact: true }).click();
  await expect(page.getByTestId("order-message")).toContainText("review prepared");
  await expect(page.getByTestId("order-message")).toContainText("full order ticket");
});

test("orders page shows review-only action feedback", async ({ page }) => {
  await page.goto(fixtureUrl("orders"));
  await page.getByRole("button", { name: "Buy", exact: true }).click();
  await expect(page.getByTestId("order-review-status")).toContainText("BUY review prepared");
  await expect(page.getByTestId("order-review-status")).toContainText("review-only");
});

test("settings reports the actual cloud workspace state", async ({ page }) => {
  await page.goto(fixtureUrl("settings"));
  await page.getByRole("tab", { name: "Data & Connections", exact: true }).click();
  await expect(page.getByText("Synced", { exact: true })).toBeVisible();
  await expect(page.getByText("Workspace up to date", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Load", exact: true })).toBeEnabled();
});

test("workspace access follows the Free, Premium, and Admin policy matrix", async ({ page }) => {
  const readAccess = async (plan) => {
    await page.goto(fixtureUrl("dashboard", `&plan=${plan}`));
    return page.getByTestId("access-probe").locator("[data-workspace]").evaluateAll((nodes) => nodes.map((node) => node.dataset.workspace));
  };

  const free = await readAccess("free");
  expect(free).toContain("orders");
  expect(free).toContain("positions");
  expect(free).not.toContain("replay");
  expect(free).not.toContain("risk");

  const premium = await readAccess("premium");
  expect(premium).toContain("replay");
  expect(premium).toContain("journal");
  expect(premium).toContain("risk");
  expect(premium).toContain("performance");

  const admin = await readAccess("admin");
  expect(admin).toHaveLength(13);
});

test("dashboard remains within the page at representative desktop sizes", async ({ page }) => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1600, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(fixtureUrl("dashboard"));
    await expect(page.getByText("Opportunity Board", { exact: true })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 2);

    await page.screenshot({
      path: path.join(artifactDir, `dashboard-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });
  }
});

test("backend health is public and protected routes fail closed", async ({ request }) => {
  const backendUrl = process.env.RELEASE_BACKEND_URL || `http://127.0.0.1:${process.env.RELEASE_BACKEND_PORT || 4012}`;
  const health = await request.get(`${backendUrl}/api/platform/health`);
  expect(health.status()).toBe(200);
  const healthBody = await health.json();
  expect(healthBody).toMatchObject({ backend: { status: "online" } });

  for (const route of ["/api/entitlements/me", "/api/watchlist", "/api/questrade/accounts", "/api/admin/issues"]) {
    const response = await request.get(`${backendUrl}${route}`);
    expect(response.status(), route).toBe(401);
  }
});
