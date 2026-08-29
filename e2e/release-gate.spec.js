import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Buffer } from "node:buffer";

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
  const backupWidth = await page.getByRole("heading", { name: "Backup & Sync", exact: true }).evaluate((heading) => heading.closest("section")?.getBoundingClientRect().width || 0);
  expect(backupWidth).toBeGreaterThan(900);
});

test("trading preferences update real review defaults and shortcut state", async ({ page }) => {
  await page.goto(fixtureUrl("settings"));
  await page.getByRole("tab", { name: "Trading", exact: true }).click();

  await page.getByLabel("Default order type").selectOption("MARKET");
  await expect(page.getByTestId("order-message")).toContainText("MARKET");
  await page.getByLabel("Default time in force").selectOption("GTC");
  await expect(page.getByTestId("order-message")).toContainText("GTC");

  const hotkeys = page.getByRole("button", { name: "Toggle keyboard shortcuts" });
  await expect(hotkeys).toHaveAttribute("aria-pressed", "true");
  await hotkeys.click();
  await expect(hotkeys).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("order-message")).toContainText("disabled");
});

test("notification preferences control alert monitoring and catalyst emphasis", async ({ page }) => {
  await page.goto(fixtureUrl("alerts", "&alertsActive=0"));
  await expect(page.getByText("Monitoring paused", { exact: true })).toBeVisible();
  await expect(page.getByText("Saved rules remain intact", { exact: false })).toBeVisible();
  await expect(page.getByText("Queued", { exact: true }).first()).toBeVisible();

  await page.goto(fixtureUrl("news", "&newsHighlights=1"));
  await expect(page.getByText("Catalyst highlights on", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Catalyst highlight").first()).toBeVisible();

  const watchlistNews = page.getByRole("heading", { name: "Watchlist News", exact: true }).locator("xpath=ancestor::section[1]");
  await expect(watchlistNews.locator('[data-symbol="NVDA"] [role="cell"]').first()).toContainText("NVDA");
});

test("settings exports and explicitly confirms portable workspace restore", async ({ page }) => {
  await page.goto(fixtureUrl("settings"));
  await page.getByRole("tab", { name: "Data & Connections", exact: true }).click();

  await page.getByRole("button", { name: "Export Backup", exact: true }).click();
  await expect(page.getByTestId("order-message")).toContainText("Workspace backup exported");

  await page.getByLabel("Select workspace backup").setInputFiles({
    name: "sb-terminal-workspace.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ marker: "fixture" })),
  });
  await expect(page.getByText("Confirm restore to replace the current workspace", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Restore Selected", exact: true }).click();
  await expect(page.getByText("3 workspace fields restored", { exact: false })).toBeVisible();
});

test("performance and journal report controls are functional", async ({ page }) => {
  await page.goto(fixtureUrl("performance"));
  await page.getByRole("button", { name: "Daily Report", exact: true }).click();
  await expect(page.getByTestId("order-message")).toContainText("Daily report exported");
  await page.getByRole("button", { name: "Weekly Review", exact: true }).click();
  await expect(page.getByTestId("order-message")).toContainText("Weekly report exported");
  await page.getByRole("button", { name: "Trade Summary CSV", exact: true }).click();
  await expect(page.getByTestId("order-message")).toContainText("Trade summary exported");

  await page.goto(fixtureUrl("journal"));
  await expect(page.getByText("Recorded Net P&L", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Exports", exact: true }).click();
  await page.getByRole("button", { name: "Journal CSV", exact: true }).click();
  await expect(page.getByTestId("order-message")).toContainText("Journal CSV exported");
});

test("positions, risk, and journal secondary tabs expose real views", async ({ page }) => {
  const failures = guardRuntime(page);

  await page.goto(fixtureUrl("positions"));
  await page.getByRole("tab", { name: "Allocations", exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "Portfolio %", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Closed Positions", exact: true }).click();
  await expect(page.getByText("No closed-position history", { exact: true })).toBeVisible();

  await page.goto(fixtureUrl("risk"));
  await page.getByRole("tab", { name: "Exposure", exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "Portfolio Weight", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Stress Test", exact: true }).click();
  await expect(page.getByText("Stress model unavailable", { exact: true })).toBeVisible();

  await page.goto(fixtureUrl("journal"));
  await page.getByRole("tab", { name: "Exports", exact: true }).click();
  await expect(page.getByText("Journal & Performance Exports", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Daily Report", exact: true }).click();
  await expect(page.getByTestId("order-message")).toContainText("Daily report exported");

  expect(failures).toEqual([]);
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

test("stateful workspace controls mutate watchlist, alerts, journal, replay, and chart layout", async ({ page }) => {
  const failures = guardRuntime(page);

  await page.goto(fixtureUrl("watchlist"));
  await page.getByRole("button", { name: "Remove NVDA from watchlist", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove NVDA from watchlist", exact: true })).toHaveCount(0);

  await page.goto(fixtureUrl("alerts"));
  await page.getByRole("row", { name: /Select NVDA/i }).first().click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("tab", { name: "Paused", exact: true }).click();
  await expect(page.getByText("Paused", { exact: true }).first()).toBeVisible();
  await page.getByRole("row", { name: /Select NVDA/i }).first().click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("tab", { name: "Active Alerts", exact: true }).click();
  await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();

  await page.goto(fixtureUrl("journal"));
  await page.getByLabel("Journal setup").fill("Opening range breakout");
  await page.getByLabel("Journal review").fill("Held the planned stop and reviewed execution.");
  await page.getByRole("button", { name: "Save Trade", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Opening range breakout", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Delete journal entry NVDA", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Opening range breakout", exact: true })).toHaveCount(0);

  await page.goto(fixtureUrl("replay"));
  const progress = page.getByRole("progressbar", { name: "Replay progress", exact: true });
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
  await page.getByRole("button", { name: "Previous replay candle", exact: true }).click();
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await page.getByRole("button", { name: "Advance replay five candles", exact: true }).click();
  await expect(progress).toHaveAttribute("aria-valuenow", "4");
  await page.getByRole("button", { name: "Jump to replay start", exact: true }).click();
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await page.getByRole("button", { name: "Jump to replay end", exact: true }).click();
  await expect(progress).toHaveAttribute("aria-valuenow", "4");

  await page.goto(fixtureUrl("chart-analysis"));
  await page.getByRole("button", { name: "4 chart layout", exact: true }).click();
  await expect(page.getByTestId("order-message")).toContainText("4 chart trading desk layout selected");

  expect(failures).toEqual([]);
});

test("scanner filters, presets, and table keyboard selection remain functional", async ({ page }) => {
  const failures = guardRuntime(page);

  await page.goto(fixtureUrl("scanner"));
  await page.getByLabel("Filter scanner by symbol or company").fill("AAPL");
  await expect(page.getByRole("row", { name: /Select AAPL/i })).toBeVisible();
  await expect(page.getByRole("row", { name: /Select NVDA/i })).toHaveCount(0);

  await page.getByLabel("Minimum relative volume").selectOption("1.50");
  await page.getByLabel("Risk filter").selectOption("controlled");
  await page.getByRole("button", { name: "Save Preset", exact: true }).click();
  await expect(page.getByTestId("order-message")).toContainText("Scanner preset saved");
  await expect(page.getByLabel("Scanner preset")).toHaveValue("custom");

  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByLabel("Filter scanner by symbol or company")).toHaveValue("");
  await page.getByRole("tab", { name: "Losers", exact: true }).click();
  const tslaRow = page.getByRole("row", { name: /Select TSLA/i });
  await tslaRow.focus();
  await tslaRow.press("Enter");
  await expect(page.getByText("TSLA", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: /Auto Refresh/i }).click();
  await expect(page.getByRole("button", { name: /Auto Refresh/i })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByLabel("Scanner preset")).toHaveValue("default");

  expect(failures).toEqual([]);
});

test("alert lifecycle and review-only order safety actions are operational", async ({ page }) => {
  const failures = guardRuntime(page);

  await page.goto(fixtureUrl("alerts"));
  await page.getByLabel("Alert trigger price").fill("225");
  await page.getByLabel("Alert direction").selectOption("below");
  await page.getByRole("button", { name: /Create/i }).click();
  await expect(page.getByTestId("order-message")).toContainText("Alert created for NVDA");
  await page.getByRole("tab", { name: "All Alerts", exact: true }).click();
  const createdAlert = page.getByRole("row", { name: "Select NVDA", exact: true }).filter({
    has: page.getByRole("cell", { name: "Price below $225.00", exact: true }),
  });
  await createdAlert.click();
  await page.getByLabel("Alert trigger price").fill("226");
  await page.getByRole("button", { name: "Update & Reactivate", exact: true }).click();
  await expect(page.getByText(/Below \$226\.00/i).first()).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText(/Below \$226\.00/i)).toHaveCount(0);

  await page.goto(fixtureUrl("orders"));
  await page.getByRole("row", { name: /Select NVDA/i }).first().click();
  for (const [button, message] of [
    ["Cancel", "Cancel orders review"],
    ["Close", "Close positions review"],
    ["Flatten", "Flatten day review"],
  ]) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByTestId("order-review-status")).toContainText(message);
    await expect(page.getByTestId("order-review-status")).toContainText(/review-?only/i);
  }

  expect(failures).toEqual([]);
});

test("replay settings, speed, indicators, bookmarks, notes, and transport controls work", async ({ page }) => {
  const failures = guardRuntime(page);

  await page.goto(fixtureUrl("replay"));
  await page.getByRole("button", { name: "Replay Settings", exact: true }).click();
  await page.getByLabel("Default timeframe").selectOption("15m");
  await page.getByRole("button", { name: "5x", exact: true }).click();
  await expect(page.getByText("5x", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Indicators", exact: true }).click();
  await page.getByRole("button", { name: /VWAP/i }).click();
  await expect(page.getByRole("button", { name: /VWAP/i })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "+ Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "NVDA step 2", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete replay bookmark NVDA step 2", exact: true }).click();
  await expect(page.getByRole("button", { name: "NVDA step 2", exact: true })).toHaveCount(0);

  await page.getByLabel("Replay session notes").fill("Reviewed the opening drive and risk discipline.");
  await page.getByRole("button", { name: "Start Replay", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause Replay", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause Replay", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start Replay", exact: true })).toBeVisible();

  expect(failures).toEqual([]);
});

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
]) {
  test(`all workspaces remain within the page at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const [workspace, landmark] of Object.entries(workspaces)) {
      await page.goto(fixtureUrl(workspace));
      await expect(page.getByText(landmark, { exact: false }).first()).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth, workspace).toBeLessThanOrEqual(dimensions.clientWidth + 2);
    }

    await page.goto(fixtureUrl("dashboard"));
    await page.screenshot({
      path: path.join(artifactDir, `dashboard-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });
  });
}

test("every workspace renders in the complete light theme", async ({ page }) => {
  const failures = guardRuntime(page);
  for (const [workspace, landmark] of Object.entries(workspaces)) {
    await page.goto(fixtureUrl(workspace, "&theme=light"));
    await expect(page.getByText(landmark, { exact: false }).first()).toBeVisible();
    const textColor = await page.getByTestId("release-workspace").evaluate((node) => getComputedStyle(node).color);
    expect(textColor, workspace).toBe("rgb(17, 24, 39)");
  }
  expect(failures).toEqual([]);
});

test("tabs support arrow keys, controls retain focus, and reduced motion is honored", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(fixtureUrl("dashboard"));
  const gainers = page.getByRole("tab", { name: "Gainers", exact: true });
  await gainers.focus();
  await gainers.press("ArrowRight");
  const losers = page.getByRole("tab", { name: "Losers", exact: true });
  await expect(losers).toHaveAttribute("aria-selected", "true");
  await expect(losers).toBeFocused();
  const accessibilityStyle = await losers.evaluate((node) => {
    const style = getComputedStyle(node);
    return { outlineStyle: style.outlineStyle, transitionDuration: style.transitionDuration };
  });
  expect(accessibilityStyle.outlineStyle).not.toBe("none");
  expect(Number.parseFloat(accessibilityStyle.transitionDuration)).toBeLessThanOrEqual(0.001);
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
