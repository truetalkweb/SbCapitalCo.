import { test, expect } from "@playwright/test";
import { Buffer } from "node:buffer";

const start = 1788355800;
const user = { id: "00000000-0000-4000-8000-000000000001", email: "correctness@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const initialWorkspace = {
  selectedStock: "AAPL", timeframe: "1m", secondarySymbol: "TSLA", secondaryTimeframe: "5m",
  additionalCharts: { third: { symbol: "SPY", interval: "15m" }, fourth: { symbol: "QQQ", interval: "1H" } },
  activeWorkspace: "chart-analysis", layoutMode: "2", gridMode: "4", syncCharts: false,
  replayMode: false, replayNotes: "Original session note", advancedMode: true,
};

function candles(symbol, timeframe) {
  const seconds = { "1m": 60, "5m": 300, "15m": 900, "1H": 3600, "1D": 86400 }[timeframe];
  const interval = { "1m": "OneMinute", "5m": "FiveMinutes", "15m": "FifteenMinutes", "1H": "OneHour", "1D": "OneDay" }[timeframe];
  const base = { AAPL: 100, TSLA: 200, SPY: 300, QQQ: 400, MSFT: 500, NVDA: 600, AMD: 700, DIA: 800 }[symbol] || 900;
  return { symbol, timeframe, interval, source: "Isolated test history", quality: "historical", session: "test-only",
    candles: Array.from({ length: 50 }, (_, index) => ({ time: start + index * seconds,
      open: base + index, high: base + index + 2, low: base + index - 1, close: base + index + 1, volume: 1000 })) };
}

async function setupApp(page, payload = initialWorkspace, { unavailableHistory = false } = {}) {
  const errors = [];
  const blocked = [];
  let row = { user_id: user.id, data: structuredClone(payload), revision: 1, schema_version: 1, updated_at: new Date().toISOString() };
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === "http://127.0.0.1:4175") return route.continue();
    if (url.origin === "http://127.0.0.1:4998") {
      if (url.pathname === "/auth/v1/user") return route.fulfill({ json: user });
      if (url.pathname === "/rest/v1/terminal_workspaces") {
        if (request.method() === "GET") return route.fulfill({ json: row });
        if (["POST", "PATCH"].includes(request.method())) {
          const update = request.postDataJSON();
          row = { ...row, ...update, revision: row.revision + 1 };
          return route.fulfill({ json: { revision: row.revision } });
        }
      }
    }
    if (url.origin === "http://127.0.0.1:4999" && request.method() === "GET"
      && !/\/(submit|execute|cancel|flatten|close)(?:\/|$)/i.test(url.pathname)) {
      if (url.pathname === "/api/entitlements/me") return route.fulfill({ json: {
        plan: "premium", status: "active", source: "isolated-test",
        capabilities: { replay: true, journal: true, risk: true, performance: true, brokerDiagnostics: false },
      } });
      if (url.pathname.includes("/candles/")) return route.fulfill(unavailableHistory
        ? { status: 503, json: { error: "History unavailable in this test" } }
        : { json: candles(url.pathname.split("/").at(-1), url.searchParams.get("timeframe")) });
      return route.fulfill({ json: { success: true, quotes: [], data: [], rows: [], news: [], backend: { status: "online" } } });
    }
    if (url.hostname === "fonts.googleapis.com") return route.fulfill({ contentType: "text/css", body: "" });
    blocked.push(`${request.method()} ${url.origin}${url.pathname}`);
    return route.fulfill({ status: 409, json: { error: "External access blocked by isolated test" } });
  });
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, role: "authenticated", exp: expiry })}.dGVzdA`;
  await page.addInitScript(({ user, token, expiry }) => {
    localStorage.setItem("sb-127-auth-token", JSON.stringify({ user, access_token: token, refresh_token: "isolated-test", expires_at: expiry, expires_in: 3600, token_type: "bearer" }));
    localStorage.setItem("sb_public_onboarding_dismissed", "true");
    localStorage.setItem("sb_focused_terminal_workspace_v1", "true");
  }, { user, token, expiry });
  await page.goto("/");
  return { errors, blocked, workspace: () => row.data };
}

test("full App saves and restores all four panel identities together", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const evidence = await setupApp(page);
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await expect(page.locator("[data-chart-panel]")).toHaveCount(4);
  const panels = [
    ["main", "Main Chart", "MSFT", "5m"], ["secondary", "Chart 2", "NVDA", "15m"],
    ["third", "Chart 3", "AMD", "1H"], ["fourth", "Chart 4", "DIA", "1D"],
  ];
  const assertPanels = async () => {
    for (const [id, , symbol, interval] of panels) {
      const panel = page.locator(`[data-chart-panel="${id}"]`);
      await expect(panel.locator("[data-chart-symbol]")).toHaveAttribute("data-chart-symbol", symbol);
      await expect(panel.locator("[data-chart-symbol]")).toHaveAttribute("data-chart-interval", interval);
      await expect(panel.locator("[data-chart-canvas]")).toHaveAttribute("data-visible-candle-count", "50");
      await expect(panel.locator("[data-chart-canvas]")).toHaveAttribute("data-visible-end", String(candles(symbol, interval).candles.at(-1).time));
    }
  };
  for (const [id, title, symbol, interval] of panels) {
    const panel = page.locator(`[data-chart-panel="${id}"]`);
    await panel.getByLabel(`${title} ticker`, { exact: true }).fill(symbol);
    await panel.getByLabel(`${title} ticker`, { exact: true }).press("Enter");
    await panel.getByLabel(`${title} interval`, { exact: true }).selectOption(interval);
  }
  await assertPanels();
  await page.getByRole("button", { name: "Advanced Off", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => evidence.workspace()).toMatchObject({
    selectedStock: "MSFT", timeframe: "5m", secondarySymbol: "NVDA", secondaryTimeframe: "15m",
    additionalCharts: { third: { symbol: "AMD", interval: "1H" }, fourth: { symbol: "DIA", interval: "1D" } },
    syncCharts: false,
  });
  await page.reload();
  await assertPanels();
  if (await page.getByRole("button", { name: "Advanced Off", exact: true }).isVisible()) {
    await page.getByRole("button", { name: "Advanced Off", exact: true }).click();
  }
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await assertPanels();
  await page.screenshot({ path: testInfo.outputPath("full-app-four-charts-restored.png"), fullPage: true });
  expect(evidence.errors).toEqual([]);
  expect(evidence.blocked).toEqual([]);
});

test("full App restores Replay trades archives and notes through portable backup", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: "replay", replayMode: true, layoutMode: "1" });
  const chart = page.locator('[data-chart-panel="main"] [data-chart-canvas]');
  const navigate = name => page.getByRole("navigation", { name: "Terminal workspaces" }).getByRole("button", { name, exact: true }).click();
  const shares = page.getByLabel("Simulated order shares", { exact: true });
  await expect(chart).toHaveAttribute("data-visible-candle-count", "1");
  await shares.fill("0");
  await page.getByRole("button", { name: "Simulate buy", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Quantity must be a positive whole number" })).toBeVisible();
  await shares.fill("10");
  await page.getByRole("button", { name: "Simulate buy", exact: true }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await shares.fill("100");
  await page.getByRole("button", { name: "Simulate buy", exact: true }).click();
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(chart).toHaveAttribute("data-visible-candle-count", "2");
  await shares.fill("40");
  await page.getByRole("button", { name: "Simulate sell", exact: true }).click();
  await page.getByLabel("Replay session notes").fill("Partial close reviewed. Preserve this note and the archived opening trade.");
  await page.getByRole("button", { name: "+ Add", exact: true }).click();
  await navigate("Settings");
  await page.getByRole("tab", { name: "Data & Connections", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Backup", exact: true }).click();
  const download = await downloadPromise;
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(backup.payload.replaySession).toMatchObject({ symbol: "AAPL", interval: "1m", index: 1 });
  const fills = events => events.map(({ type, qty, price }) => ({ type, qty: Number(qty), price }));
  expect(fills(backup.payload.replaySession.events)).toEqual([{ type: "BUY", qty: 100, price: 101 }, { type: "SELL", qty: 40, price: 102 }]);
  expect(fills(backup.payload.replaySession.archives[0].events)).toEqual([{ type: "BUY", qty: 10, price: 101 }]);
  expect(backup.payload.replayNotes).toContain("Partial close reviewed.");
  expect(backup.payload.replayBookmarks).toHaveLength(1);
  await navigate("Replay");
  await page.getByLabel("Replay session notes").fill("Different session note");
  await page.getByLabel("Global ticker search", { exact: true }).fill("TSLA");
  await page.getByLabel("Global ticker search", { exact: true }).press("Enter");
  await expect(chart).toHaveAttribute("data-chart-canvas", "TSLA");
  await expect(chart).toHaveAttribute("data-visible-candle-count", "1");
  await navigate("Settings");
  await page.getByRole("tab", { name: "Data & Connections", exact: true }).click();
  await page.getByLabel("Select workspace backup", { exact: true }).setInputFiles({
    name: "replay-roundtrip.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole("button", { name: "Restore Selected", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "workspace fields restored" })).toBeVisible();
  await navigate("Replay");
  await expect(chart).toHaveAttribute("data-chart-canvas", "AAPL");
  await expect(chart).toHaveAttribute("data-visible-candle-count", "2");
  await expect(page.getByLabel("Replay session notes")).toHaveValue(backup.payload.replayNotes);
  await expect(page.getByRole("row").filter({ hasText: /AAPL.*Long.*60/ })).toHaveCount(1);
  await page.getByRole("button", { name: "Advanced Off", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => evidence.workspace().replaySession?.events).toEqual(backup.payload.replaySession.events);
  expect(evidence.workspace().replaySession.archives).toEqual(expect.arrayContaining(backup.payload.replaySession.archives));
  expect(evidence.workspace().replayBookmarks).toEqual(backup.payload.replayBookmarks);
  await page.reload();
  await expect(chart).toHaveAttribute("data-chart-canvas", "AAPL");
  await expect(chart).toHaveAttribute("data-visible-candle-count", "2");
  await expect(page.getByLabel("Replay session notes")).toHaveValue(backup.payload.replayNotes);
  await expect(page.getByRole("row").filter({ hasText: /AAPL.*Long.*60/ })).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("full-app-replay-restored.png"), fullPage: true });
  await page.getByRole("row").filter({ hasText: /AAPL.*Long.*60/ }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("full-app-replay-records-restored.png"), fullPage: true });
  expect(evidence.errors).toEqual([]);
  expect(evidence.blocked).toEqual([]);
});

test("unavailable Replay metrics remain unavailable in the Journal handoff", async ({ page }) => {
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: "replay", replayMode: true, layoutMode: "1" }, { unavailableHistory: true });
  await expect(page.getByRole("button", { name: "Simulate buy", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Send to Journal", exact: true }).click();
  await expect(page.getByLabel("Journal review", { exact: true })).toHaveValue(/Replay net P&L: Unavailable/);
  await expect(page.getByLabel("Journal review", { exact: true })).toHaveValue(/Win rate: Unavailable/);
  expect(evidence.errors).toEqual([]);
  expect(evidence.blocked).toEqual([]);
});

test("full App automatically persists Replay notes and ledger without manual Save", async ({ page }) => {
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: "replay", replayMode: true, layoutMode: "1" });
  await expect(page.getByRole("button", { name: "Simulate buy", exact: true })).toBeEnabled();
  await page.getByLabel("Simulated order shares", { exact: true }).fill("25");
  await page.getByRole("button", { name: "Simulate buy", exact: true }).click();
  await page.getByLabel("Replay session notes").fill("Automatically persisted session note");
  await expect.poll(() => evidence.workspace().replayNotes).toBe("Automatically persisted session note");
  expect(evidence.workspace().replaySession.events).toHaveLength(1);
  expect(Number(evidence.workspace().replaySession.events[0].qty)).toBe(25);
  await page.reload();
  await expect(page.getByLabel("Replay session notes")).toHaveValue("Automatically persisted session note");
  await expect(page.getByRole("row").filter({ hasText: /AAPL.*Long.*25/ })).toHaveCount(1);
  expect(evidence.errors).toEqual([]);
  expect(evidence.blocked).toEqual([]);
});

test("full App order and safety actions remain review-only with no execution requests", async ({ page }) => {
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: "orders", layoutMode: "1" });
  for (const side of ["Buy", "Sell"]) {
    await page.getByRole("button", { name: side, exact: true }).click();
    await expect(page.getByTestId("order-review-status")).toContainText(`${side.toUpperCase()} review prepared`);
    await expect(page.getByTestId("order-review-status")).toContainText("review-only");
  }
  for (const [action, message] of [["Cancel", "Cancel orders review"], ["Close", "Close positions review"], ["Flatten", "Flatten day review"]]) {
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(page.getByTestId("order-review-status")).toContainText(message);
  }
  expect(evidence.errors).toEqual([]);
  expect(evidence.blocked).toEqual([]);
});
