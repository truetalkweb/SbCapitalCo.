import { Buffer } from "node:buffer";
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createPaperService } = require('../support/paperService.cjs');
const { memoryRepository } = require('../support/paperMemory.cjs');
const { createAlertService } = require('../support/alertService.cjs');

function alertMemory() {
  const rows = new Map();
  return {
    async get(id) { return structuredClone(rows.get(id) || null); },
    async insert(id, ledger) { if (!rows.has(id)) rows.set(id, { user_id: id, ledger: structuredClone(ledger), revision: 0, monitoring: false }); return this.get(id); },
    async save(row, ledger) { if (rows.get(row.user_id)?.revision !== row.revision) return null; rows.set(row.user_id, { ...row, ledger: structuredClone(ledger), revision: row.revision + 1, monitoring: ledger.enabled && !ledger.paused && ledger.alerts.some(alert => alert.active) }); return this.get(row.user_id); },
    async active(after = '') { return [...rows.values()].filter(row => row.monitoring && row.user_id > after).sort((a, b) => a.user_id.localeCompare(b.user_id)).map(row => structuredClone(row)); },
  };
}

const start = 1788355800;
export const user = { id: "00000000-0000-4000-8000-000000000001", email: "correctness@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
export const initialWorkspace = {
  selectedStock: "AAPL", timeframe: "1m", secondarySymbol: "TSLA", secondaryTimeframe: "5m",
  additionalCharts: { third: { symbol: "SPY", interval: "15m" }, fourth: { symbol: "QQQ", interval: "1H" } },
  activeWorkspace: "chart-analysis", layoutMode: "2", gridMode: "4", syncCharts: false,
  replayMode: false, replayNotes: "Original session note", advancedMode: true,
};

export function candles(symbol, timeframe) {
  const seconds = { "1m": 60, "5m": 300, "15m": 900, "1H": 3600, "1D": 86400 }[timeframe];
  const interval = { "1m": "OneMinute", "5m": "FiveMinutes", "15m": "FifteenMinutes", "1H": "OneHour", "1D": "OneDay" }[timeframe];
  const base = { AAPL: 100, TSLA: 200, SPY: 300, QQQ: 400, MSFT: 500, NVDA: 600, AMD: 700, DIA: 800 }[symbol] || 900;
  return { symbol, timeframe, interval, source: "Isolated test history", quality: "historical", session: "test-only",
    candles: Array.from({ length: 50 }, (_, index) => ({ time: start + index * seconds,
      open: base + index, high: base + index + 2, low: base + index - 1, close: base + index + 1, volume: 1000 })) };
}

export async function setupApp(page, payload = initialWorkspace, { unavailableHistory = false, providerQuotes = [], providerNews = [], providerScanner = {}, providerSummary = null, aiEntitled = true, baseUrl = "http://127.0.0.1:4175" } = {}) {
  const errors = [];
  const blocked = [];
  let row = { user_id: user.id, data: structuredClone(payload), revision: 1, schema_version: 1, updated_at: new Date().toISOString() };
  let serverNow = await page.evaluate(() => Date.now());
  const alertService = createAlertService({ repository: alertMemory(), clock: () => serverNow, getQuotes: async () => providerQuotes });
  const repository = memoryRepository(() => row.data.paperLedger || { orders: row.data.orders || [], positions: row.data.positions || {}, realizedPnL: row.data.realizedPnL || 0 });
  const paper = createPaperService({ repository, getQuotes: async () => providerQuotes, clock: () => serverNow });
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === baseUrl) return route.continue();
    if (url.origin === 'http://127.0.0.1:4999' && url.pathname.startsWith('/api/alerts/')) {
      serverNow = await page.evaluate(() => Date.now());
      try {
        if (request.method() === 'GET') { await alertService.tick(); return route.fulfill({ json: await alertService.snapshot(user.id) }); }
        return route.fulfill({ json: await alertService.transact(user.id, request.postDataJSON().command) });
      } catch (error) { return route.fulfill({ status: error.status || 500, json: { error: error.message } }); }
    }
    if (url.origin === "http://127.0.0.1:4999" && url.pathname === "/api/ai/summarize-news" && request.method() === "POST") {
      return route.fulfill(providerSummary ? await providerSummary(request.postDataJSON())
        : { status: 503, json: { error: "AI unavailable in this test" } });
    }
    if (url.origin === 'http://127.0.0.1:4999' && url.pathname.startsWith('/api/paper/')) {
      serverNow = await page.evaluate(() => Date.now());
      if (request.method() === 'GET' && url.pathname === '/api/paper/account') {
        await paper.tick();
        return route.fulfill({ json: await paper.snapshot(user.id) });
      }
      if (request.method() === 'POST' && url.pathname === '/api/paper/commands') {
        const { command, limits } = request.postDataJSON();
        const result = await paper.transact(user.id, command, limits);
        return route.fulfill({ status: result.error ? 422 : 200, json: result });
      }
    }
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
        capabilities: { replay: true, journal: true, risk: true, performance: true, brokerDiagnostics: false, aiSummaries: aiEntitled },
      } });
      if (url.pathname === "/api/questrade/quotes") return route.fulfill({ json: { quotes: providerQuotes, source: "Isolated provider-shape test", realtime: true } });
      if (url.pathname === "/api/scanner") return route.fulfill({ json: providerScanner });
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
  const expiry = Math.floor(await page.evaluate(() => Date.now()) / 1000) + 3600;
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, role: "authenticated", exp: expiry })}.dGVzdA`;
  await page.addInitScript(({ user, token, expiry }) => {
    localStorage.setItem("sb-127-auth-token", JSON.stringify({ user, access_token: token, refresh_token: "isolated-test", expires_at: expiry, expires_in: 3600, token_type: "bearer" }));
    localStorage.setItem("sb_public_onboarding_dismissed", "true");
    localStorage.setItem("sb_focused_terminal_workspace_v1", "true");
  }, { user, token, expiry });
  await page.goto(baseUrl);
  return { errors, blocked, paper, repository, alertService, workspace: () => ({ ...row.data, paperLedger: repository.rows.get(user.id)?.ledger || row.data.paperLedger }) };
}
