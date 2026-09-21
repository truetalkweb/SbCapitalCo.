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

async function setupApp(page, payload = initialWorkspace, { unavailableHistory = false, providerQuotes = [], providerNews = [] } = {}) {
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
      if (url.pathname === "/api/questrade/quotes") return route.fulfill({ json: { quotes: providerQuotes, source: "Isolated provider-shape test", realtime: true } });
      if (url.pathname.startsWith("/api/news")) return route.fulfill({ json: { news: providerNews } });
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

test("full App keeps 60 trades when saving a note and restores full-history statistics", async ({ page }) => {
  const journalEntries = Array.from({length:60},(_,id)=>({id:`old-${id}`,symbol:"AAPL",pnl:100,createdAt:new Date(Date.UTC(2026,0,id+1)).toISOString()}));
  const evidence = await setupApp(page,{...initialWorkspace,activeWorkspace:"journal",journalEntries});
  await page.getByLabel("Journal setup",{exact:true}).fill("Preserved note");
  await page.getByRole("button",{name:"Save Record",exact:true}).click();
  await expect.poll(()=>evidence.workspace().journalEntries?.length).toBe(61);
  expect(evidence.workspace().journalEntries.find(row=>row.id==="old-59")).toBeTruthy();
  expect(evidence.workspace().journalEntries[0].pnl).toBeNull();
  await expect(page.getByText("$6,000.00",{exact:true}).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("$6,000.00",{exact:true}).first()).toBeVisible();
  await expect(page.getByRole("navigation",{name:"journal records pagination"})).toContainText("of 61");
  await page.getByRole("navigation",{name:"journal records pagination"}).getByRole("button",{name:"Next"}).click();
  await expect(page.getByRole("navigation",{name:"journal records pagination"})).toContainText("26–50");
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test("full App saves a short journal trade after fees with matching CSV", async ({page})=>{
  const evidence=await setupApp(page,{...initialWorkspace,activeWorkspace:"journal",journalEntries:[]});
  await page.getByLabel("Journal record type",{exact:true}).selectOption("trade");
  await page.getByLabel("Journal side",{exact:true}).selectOption("Short");
  await page.getByLabel("Journal setup",{exact:true}).fill("Short review");
  for(const [label,value] of [["quantity","10"],["entry price","100"],["exit price","90"],["total fees","2"]]) await page.getByLabel(`Journal ${label}`,{exact:true}).fill(value);
  await page.getByRole("button",{name:"Save Record",exact:true}).click();
  await expect.poll(()=>evidence.workspace().journalEntries?.[0]?.pnl).toBe(98);
  await expect(page.getByText("$98.00",{exact:true}).first()).toBeVisible();
  await page.getByRole("tab",{name:"Exports",exact:true}).click();
  const download=page.waitForEvent("download"); await page.getByRole("button",{name:"Journal CSV",exact:true}).click();
  const file=await download; const stream=await file.createReadStream(); let csv=""; for await(const chunk of stream)csv+=chunk;
  expect(csv).toContain("pnl"); expect(csv).toContain("98"); expect(csv).toContain("Short review");
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test("full App adding alert 106 preserves every existing alert after reload", async ({page})=>{
  const alerts=Array.from({length:105},(_,id)=>({id:`existing-${id}`,symbol:"AAPL",trigger:100+id,direction:"above",active:true,history:[]}));
  const evidence=await setupApp(page,{...initialWorkspace,activeWorkspace:"alerts",alerts});
  await page.getByLabel("Alert trigger price").fill("999");
  await page.getByRole("button",{name:"Create",exact:true}).click();
  await expect.poll(()=>evidence.workspace().alerts?.length).toBe(106);
  expect(evidence.workspace().alerts.find(row=>row.id==="existing-104")).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("button",{name:"Create",exact:true})).toBeVisible();
  expect(evidence.workspace().alerts).toHaveLength(106);
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test("full App restores two independent named watchlists", async ({page})=>{
  const evidence=await setupApp(page,{...initialWorkspace,activeWorkspace:"watchlist",liveStocks:[{symbol:"AAPL"}],premiumPreferences:{watchlists:[{id:"main",name:"Main",symbols:["AAPL"]}],activeWatchlistId:"main"}});
  await page.getByLabel("Watchlist name",{exact:true}).fill("Swing trades");
  await page.getByRole("button",{name:"New List",exact:true}).click();
  await page.getByLabel("Watchlist symbol",{exact:true}).fill("AAPL");
  await page.getByRole("button",{name:"Add Symbol",exact:true}).click();
  await expect.poll(()=>evidence.workspace().premiumPreferences?.watchlists?.length).toBe(2);
  await expect.poll(()=>evidence.workspace().premiumPreferences?.watchlists?.[1]?.symbols).toEqual(["AAPL"]);
  await page.getByRole("button",{name:"Remove AAPL from watchlist",exact:true}).click();
  await expect.poll(()=>evidence.workspace().premiumPreferences?.watchlists?.[1]?.symbols).toEqual([]);
  expect(evidence.workspace().premiumPreferences.watchlists[0].symbols).toEqual(["AAPL"]);
  await page.reload();
  await expect(page.getByLabel("Active watchlist").locator("option:checked")).toHaveText("Swing trades");
  await page.getByLabel("Active watchlist").selectOption("main");
  await expect(page.getByRole("button",{name:"Remove AAPL from watchlist",exact:true})).toBeVisible();
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test("full App saves and restores all four panel identities together", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const evidence = await setupApp(page);
  await expect(page.getByRole("button", { name: "Account menu", exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("button", { name: "Save workspace", exact: true }).click();
  await expect.poll(() => evidence.workspace()).toMatchObject({
    selectedStock: "MSFT", timeframe: "5m", secondarySymbol: "NVDA", secondaryTimeframe: "15m",
    additionalCharts: { third: { symbol: "AMD", interval: "1H" }, fourth: { symbol: "DIA", interval: "1D" } },
    syncCharts: false,
  });
  await page.reload();
  await assertPanels();
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("button", { name: "Load workspace", exact: true }).click();
  await assertPanels();
  await page.screenshot({ path: testInfo.outputPath("full-app-four-charts-restored.png"), fullPage: true });
  expect(evidence.errors).toEqual([]);
  expect(evidence.blocked).toEqual([]);
});

test("full App restores Replay trades archives and notes through portable backup", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: "replay", replayMode: true, layoutMode: "1" });
  const chart = page.locator('[data-chart-panel="main"] [data-chart-canvas]');
  const navigate = async name => {
    const navigation = page.getByRole("navigation", { name: "Terminal workspaces" });
    const target = navigation.getByRole("button", { name: name === "Replay" ? "Tools" : name === "Journal" ? "Trade Journal" : name, exact: true });
    await target.click();
  };
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
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("button", { name: "Save workspace", exact: true }).click();
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

test("paper side selection and safety reviews never submit real broker orders", async ({ page }) => {
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: "orders", layoutMode: "1" });
  for (const side of ["Buy", "Sell"]) {
    await page.getByRole("button", { name: side, exact: true }).click();
    await expect(page.getByRole("button", { name: `Place Paper ${side}`, exact: true })).toBeVisible();
  }
  for (const [action, message] of [["Cancel", "Cancel orders review"], ["Close", "Close positions review"], ["Flatten", "Flatten day review"]]) {
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(page.getByTestId("order-review-status")).toContainText(message);
  }
  expect(evidence.errors).toEqual([]);
  expect(evidence.blocked).toEqual([]);
});


for (const width of [1920, 1536, 1440, 1366, 1280]) {
  test(`main dashboard matches reference geometry at ${width}px without changing providers`, async ({ page }) => {
    const height = width === 1920 ? 1080 : width === 1536 ? 1024 : width < 1440 ? 768 : 900;
    await page.setViewportSize({ width, height });
    const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: "dashboard", selectedStock: "NVDA", timeframe: "5m", layoutMode: "1",
      positions: { NVDA: { quantity: 150, average: 117.2 }, TSLA: { quantity: 50, average: 240.15 }, PLTR: { quantity: 500, average: 35.1 }, SPY: { quantity: 20, average: 556.3 } },
      chartIndicators: { ema9: true, ema20: true, vwap: true, volume: true } });
    await expect(page.getByTestId("sb-main-dashboard")).toBeVisible();
    await expect(page.locator('[data-chart-panel="main"] [data-chart-canvas]')).toHaveAttribute("data-visible-candle-count", "50");
    const logo = page.getByAltText("SB logo");
    await expect(logo).toHaveAttribute("src", "/sb-terminal-logo.png");
    const metrics = await page.locator(".ws-account-strip").boundingBox();
    const chart = await page.getByRole("region", { name: "Primary trading chart", exact: true }).boundingBox();
    const book = await page.getByRole("region", { name: "Order book", exact: true }).boundingBox();
    const bottom = await page.getByRole("region", { name: "Portfolio records", exact: true }).boundingBox();
    expect(chart.y).toBeGreaterThanOrEqual(metrics.y + metrics.height);
    expect(book.x).toBeGreaterThanOrEqual(chart.x + chart.width);
    expect(chart.width).toBeGreaterThan(book.width * (width < 1440 ? 2 : 2.5));
    expect(bottom.y).toBeGreaterThanOrEqual(chart.y + chart.height);
    expect(bottom.y + bottom.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const button = page.getByRole("button", { name: "Place Paper Buy", exact: true });
    await expect(button).toBeInViewport({ ratio: 1 });
    const ticket = await page.getByRole("region", { name: "Paper trade ticket", exact: true }).boundingBox();
    const reviewButton = await button.boundingBox();
    expect(reviewButton.y + reviewButton.height).toBeLessThanOrEqual(ticket.y + ticket.height);
    const chartTools = await page.getByRole("button", { name: "Fullscreen dashboard chart" }).boundingBox();
    expect(chartTools.x + chartTools.width).toBeLessThanOrEqual(chart.x + chart.width);
    await expect(page.getByRole("region", { name: "Order book", exact: true }).getByRole("columnheader", { name: "Bid", exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.locator(".ws-paper-note")).toContainText("Simulated fills");
    await expect(page.getByText("No provider headlines available.", { exact: true })).toBeVisible();
    await expect(page.locator(".ws-portfolio tbody tr").last()).toBeInViewport({ ratio: 1 });
    await page.getByRole("button", { name: "Indicators", exact: true }).click();
    await page.getByLabel("EMA 20", { exact: true }).uncheck();
    await page.getByRole("button", { name: "Indicators", exact: true }).click();
    await page.getByRole("tab", { name: "Time & Sales", exact: true }).click();
    await expect(page.getByRole("region", { name: "Order book", exact: true })).toContainText("Time & sales not connected");
    await page.getByRole("tab", { name: "Order Book", exact: true }).click();
    await page.getByRole("tab", { name: "Notes", exact: true }).click();
    await page.getByLabel("Dashboard notes").fill("Reference dashboard verification");
    await page.getByRole("tab", { name: "Positions (4)", exact: true }).click();
    await page.screenshot({ path: `artifacts/dashboard/verified-${width}.png` });
    await page.getByLabel("Paper quantity").fill("25");
    await page.getByLabel("Paper order type").selectOption("MARKET");
    await page.getByRole("button", { name: "Sell", exact: true }).click();
    await page.getByRole("button", { name: "Place Paper Sell", exact: true }).click();
    await expect(page.locator(".ws-paper-feedback")).toContainText("SELL 25 NVDA");
    expect(evidence.errors).toEqual([]);
    expect(evidence.blocked).toEqual([]);
  });
}


test("dashboard displays provider quote fields and dismisses overlays by keyboard", async ({ page }) => {
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: "dashboard", selectedStock: "NVDA", layoutMode: "1" }, {
    providerQuotes: [{ symbol: "NVDA", price: 118.42, bidPrice: 118.41, bidSize: 1200, askPrice: 118.43, askSize: 800,
      openPrice: 116.21, highPrice: 118.76, lowPrice: 115.98, volume: 42300000, changePercent: 1.59,
      source: "Isolated provider-shape test", realtime: true, lastTradeTime: new Date().toISOString() }],
    providerNews: [{ id: "dashboard-news", title: "Provider headline for keyboard review", symbol: "NVDA", source: "Isolated test news",
      summary: "Test article summary", publishedAt: new Date().toISOString(), url: "https://example.test/article" }],
  });
  const book = page.getByRole("region", { name: "Order book", exact: true });
  for (const value of ["118.41", "118.43", "1200", "800"]) await expect(book.getByRole("cell", { name: value, exact: true })).toBeVisible();
  const stats = page.locator(".ws-symbol-stats");
  for (const value of ["116.21", "118.76", "115.98"]) await expect(stats.getByText(value, { exact: true })).toBeVisible();
  const profile = page.getByRole("button", { name: "Account menu" });
  await profile.click();
  await page.getByRole("button", { name: "Help & shortcuts", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(profile).toHaveAttribute("aria-expanded", "false");
  await expect(profile).toBeFocused();
  const indicators = page.getByRole("button", { name: "Indicators", exact: true });
  await indicators.click();
  await page.keyboard.press("Escape");
  await expect(indicators).toHaveAttribute("aria-expanded", "false");
  const headline = page.getByRole("button", { name: /Provider headline for keyboard review/ });
  await headline.click();
  const dialog = page.getByRole("dialog", { name: "News preview" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("link", { name: "Read source article" }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close news preview" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(headline).toBeFocused();
  await page.getByRole("tab", { name: "P&L", exact: true }).click();
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect.poll(() => evidence.workspace().activeWorkspace).toBe("positions");
  expect(evidence.errors).toEqual([]);
  expect(evidence.blocked).toEqual([]);
});

const secondaryWorkspaces = [
  ["watchlist", "Watchlist"], ["scanner", "Market Scanner"], ["chart-analysis", "Charts"],
  ["news", "News & Calendar"], ["alerts", "Alerts"], ["orders", "Orders"],
  ["positions", "Positions"], ["risk", "Risk Manager"], ["performance", "Performance"],
  ["replay", "Replay"], ["journal", "Trade Journal"], ["settings", "Settings"],
];
for (const width of [1536, 1280]) {
  for (const [view, title] of secondaryWorkspaces) {
    test(`dashboard design extends to ${view} at ${width}px with usable content`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width === 1536 ? 1024 : 768 });
      const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: view, layoutMode: "1", selectedStock: "NVDA",
        positions: { NVDA: { quantity: 150, average: 117.2 } },
        journalEntries: [{ id: "ui-history", symbol: "NVDA", pnl: 183, createdAt: "2026-09-10T14:30:00Z" }] });
      const workspace = page.locator(`.ws-workspace[data-workspace="${view}"]`);
      await expect(workspace.getByRole("heading", { name: title, exact: true, level: 1 })).toBeVisible();
      await expect(page.getByAltText("SB logo")).toHaveAttribute("src", "/sb-terminal-logo.png");
      await expect(page.locator(".ws-header")).toBeInViewport({ ratio: 1 });
      await expect(page.locator(".ws-footer")).toBeInViewport({ ratio: 1 });
      await expect(page.getByText("This panel is temporarily unavailable.", { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const sidebar = await page.locator(".ws-sidebar").boundingBox();
      expect(sidebar.width).toBeGreaterThanOrEqual(180);
      expect(sidebar.width).toBeLessThanOrEqual(200);
      // Wide tables may scroll within their panel; the workspace itself must fit.
      expect(await workspace.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      const inputWidths = await workspace.locator('input:not([type="file"]):not([type="checkbox"]):not([type="range"])').evaluateAll(els => els.filter(el => el.getBoundingClientRect().width > 0).map(el => el.getBoundingClientRect().width));
      expect(inputWidths.every(value => value >= 45)).toBe(true);
      if (view === "alerts") {
        const dock = workspace.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Avg Price", exact: true }) });
        await expect(dock).toContainText("Unavailable");
        await expect(dock).not.toContainText("NaN");
      }
      if (view === "chart-analysis") {
        await expect(workspace.getByRole("button", { name: "Review Order", exact: true })).toBeInViewport({ ratio: 1 });
        const rail = workspace.locator(".ws-detail-rail");
        const context = rail.getByText("Review-only shortcuts. No live broker execution from this workspace.");
        await context.scrollIntoViewIfNeeded();
        await expect(context).toBeInViewport({ ratio: 1 });
      }
      await page.screenshot({ path: testInfo.outputPath(`${view}-${width}.png`) });
      expect(evidence.errors).toEqual([]);
      expect(evidence.blocked).toEqual([]);
    });
  }
}

test("secondary workspace navigation keeps the shared shell and light theme", async ({ page }) => {
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: "watchlist", themeMode: "light" });
  await expect(page.locator('.ws-workspace[data-workspace="watchlist"]')).toHaveCSS("background-color", "rgb(244, 247, 250)");
  const navigation = page.getByRole("navigation", { name: "Terminal workspaces" });
  for (const label of ["Market Scanner", "Positions", "Trade Journal", "Risk Manager", "Settings", "Tools"]) {
    await navigation.getByRole("button", { name: label, exact: true }).click();
    await expect(navigation.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".ws-workspace")).toBeVisible();
    await expect(page.locator(".ws-workspace")).toHaveCSS("background-color", "rgb(244, 247, 250)");
  }
  await page.getByRole("button", { name: "Notifications and alerts" }).click();
  await expect(page.getByRole("heading", { name: "Alerts", level: 1, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Account menu" }).click();
  const sync = page.getByRole("button", { name: "Sync charts: Off", exact: true });
  await sync.click();
  await expect(page.getByRole("button", { name: "Sync charts: On", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Account menu" })).toBeFocused();
  expect(evidence.errors).toEqual([]);
  expect(evidence.blocked).toEqual([]);
});

const paperNow = new Date('2026-09-21T15:00:00Z');
const paperProviderQuote = (price, symbol = 'NVDA') => ({symbol,price,bidPrice:price-0.01,askPrice:price+0.01,lastTradeTime:paperNow.toISOString(),source:'Isolated paper test provider',realtime:true});

test('paper stop limit remains working after trigger and reload, then fills within its limit', async ({page}) => {
 test.setTimeout(70000);
 await page.clock.setFixedTime(paperNow);
 const quotes=[paperProviderQuote(100)];
 const evidence=await setupApp(page,{...initialWorkspace,activeWorkspace:'orders',selectedStock:'NVDA',layoutMode:'1',positions:{},orders:[],realizedPnL:0},{providerQuotes:quotes});
 const ticket=page.getByRole('region',{name:'Paper trade ticket',exact:true});
 await ticket.getByLabel('Paper order type').selectOption('STOP_LIMIT');
 await ticket.getByLabel('Paper quantity').fill('10');
 await ticket.getByLabel('Stop trigger',{exact:true}).fill('105');
 await ticket.getByLabel('Limit price',{exact:true}).fill('106');
 await ticket.getByRole('button',{name:'Place Paper Buy',exact:true}).click();
 await expect(ticket.getByRole('status')).toContainText('WORKING');
 const later=new Date(paperNow.getTime()+60000);
 await page.clock.setFixedTime(later);
 quotes[0]={...paperProviderQuote(108),lastTradeTime:later.toISOString()};
 await expect.poll(()=>evidence.workspace().paperLedger?.orders[0]?.status,{timeout:25000}).toBe('TRIGGERED');
 await page.getByRole('tab',{name:'Working',exact:true}).click();
 await expect(page.getByRole('row',{name:'Select NVDA',exact:true})).toContainText('TRIGGERED');
 await page.reload();
 await expect(ticket.getByText('$98,940.00',{exact:true})).toBeVisible();
 quotes[0]={...paperProviderQuote(105.5),lastTradeTime:later.toISOString()};
 await expect.poll(()=>evidence.workspace().paperLedger?.orders[0]?.status,{timeout:25000}).toBe('FILLED');
 expect(evidence.workspace().paperLedger.orders[0].price).toBe(105.51);
 await page.getByRole('navigation',{name:'Terminal workspaces'}).getByRole('button',{name:'Dashboard',exact:true}).click();
 await expect(page.locator('.ws-equity')).toContainText('$99,999.90');
 expect(evidence.errors).toEqual([]);expect(evidence.blocked).toEqual([]);
});

test('paper market buy and sell execute from dashboard without a broker and restore after reload', async ({page}, testInfo) => {
 await page.clock.setFixedTime(paperNow);
 const evidence=await setupApp(page,{...initialWorkspace,activeWorkspace:'dashboard',selectedStock:'NVDA',layoutMode:'1',positions:{},orders:[],realizedPnL:0},{providerQuotes:[paperProviderQuote(100)]});
 const ticket=page.getByRole('region',{name:'Paper trade ticket',exact:true});
 await ticket.getByLabel('Paper order type').selectOption('MARKET');
 await ticket.getByLabel('Paper quantity').fill('10');
 await ticket.getByRole('button',{name:'Place Paper Buy',exact:true}).click();
 await expect(ticket.getByRole('status')).toContainText('FILLED');
 await expect.poll(()=>evidence.workspace().paperLedger?.positions.NVDA?.quantity).toBe(10);
 await expect.poll(()=>evidence.workspace().paperLedger?.orders.length).toBe(1);
 await expect(ticket.getByRole('button',{name:'Place Paper Buy',exact:true})).toBeDisabled();
 await page.reload();
 await expect(page.locator('.ws-portfolio tbody')).toContainText('NVDA');
 await ticket.getByRole('button',{name:'Sell',exact:true}).click();
 await ticket.getByLabel('Paper order type').selectOption('MARKET');
 await ticket.getByLabel('Paper quantity').fill('4');
 await ticket.getByRole('button',{name:'Place Paper Sell',exact:true}).click();
 await expect(ticket.getByRole('status')).toContainText('FILLED');
 await expect.poll(()=>evidence.workspace().paperLedger?.positions.NVDA?.quantity).toBe(6);
 expect(evidence.workspace().paperLedger.realizedPnL).toBe(-0.08);
 await page.screenshot({path:testInfo.outputPath('paper-market-filled.png')});
 expect(evidence.errors).toEqual([]);expect(evidence.blocked).toEqual([]);
});

test('paper limit survives navigation and reload, fills on a fresh price update, and cancel releases cash',async({page},testInfo)=>{
 await page.clock.setFixedTime(paperNow);
 const quotes=[paperProviderQuote(100)];
 const evidence=await setupApp(page,{...initialWorkspace,activeWorkspace:'dashboard',selectedStock:'NVDA',layoutMode:'1',positions:{},orders:[],realizedPnL:0},{providerQuotes:quotes});
 const ticket=page.getByRole('region',{name:'Paper trade ticket',exact:true});
 await ticket.getByLabel('Paper order type').selectOption('LIMIT');await ticket.getByLabel('Paper quantity').fill('10');await ticket.getByLabel('Limit price',{exact:true}).fill('95');
 await ticket.getByRole('button',{name:'Place Paper Buy',exact:true}).click();await expect(ticket.getByRole('status')).toContainText('WORKING');
 await expect.poll(()=>evidence.workspace().paperLedger?.orders[0]?.status).toBe('WORKING');
 await page.reload();await expect(page.locator('.ws-account-strip')).toContainText('$99,050.00');
 quotes[0]=paperProviderQuote(94);
 await expect.poll(()=>evidence.workspace().paperLedger?.orders[0]?.status,{timeout:25000}).toBe('FILLED');
 await page.getByRole('navigation',{name:'Terminal workspaces'}).getByRole('button',{name:'Orders',exact:true}).click();
 await ticket.getByLabel('Paper order type').selectOption('LIMIT');await ticket.getByLabel('Limit price',{exact:true}).fill('80');await ticket.getByRole('button',{name:'Place Paper Buy',exact:true}).click();
 await expect(ticket.getByRole('status')).toContainText('WORKING');
 await page.getByRole('tab',{name:'Working',exact:true}).click();
 await page.getByRole('row',{name:'Select NVDA',exact:true}).click();
 await page.getByRole('button',{name:'Cancel selected paper order',exact:true}).click();
 await expect.poll(()=>evidence.workspace().paperLedger?.orders[0]?.status).toBe('CANCELLED');
 await page.getByRole('tab',{name:'Cancelled',exact:true}).click();
 await expect(page.getByRole('row',{name:'Select NVDA',exact:true})).toContainText('CANCELLED');
 await page.screenshot({path:testInfo.outputPath('paper-limit-cancelled.png')});
 expect(evidence.errors).toEqual([]);expect(evidence.blocked).toEqual([]);
});

test('paper protective stop executes and cancels take profit on the next provider quote',async({page},testInfo)=>{
 await page.clock.setFixedTime(paperNow);
 const quotes=[paperProviderQuote(100)];
 const evidence=await setupApp(page,{...initialWorkspace,activeWorkspace:'orders',selectedStock:'NVDA',layoutMode:'1',positions:{},orders:[],realizedPnL:0},{providerQuotes:quotes});
 const ticket=page.getByRole('region',{name:'Paper trade ticket',exact:true});
 await ticket.getByLabel('Paper order type').selectOption('MARKET');await ticket.getByLabel('Paper quantity').fill('10');
 await ticket.locator('summary').click();await ticket.getByLabel('Stop loss',{exact:true}).fill('95');await ticket.getByLabel('Take profit',{exact:true}).fill('110');
 await ticket.getByRole('button',{name:'Place Paper Buy',exact:true}).click();await expect(ticket.getByRole('status')).toContainText('FILLED');
 await expect.poll(()=>evidence.workspace().paperLedger?.orders.length).toBe(3);
 quotes[0]=paperProviderQuote(94);
 await expect.poll(()=>evidence.workspace().paperLedger?.positions.NVDA,{timeout:25000}).toBeUndefined();
 const ledger=evidence.workspace().paperLedger;expect(ledger.orders.find(o=>o.type==='STOP').status).toBe('FILLED');expect(ledger.orders.find(o=>o.id.endsWith('-target')).status).toBe('CANCELLED');expect(ledger.realizedPnL).toBe(-60.2);
 await page.getByRole('tab',{name:'Filled',exact:true}).click();await page.screenshot({path:testInfo.outputPath('paper-stop-filled.png')});
 expect(evidence.errors).toEqual([]);expect(evidence.blocked).toEqual([]);
});
