import { test, expect } from "@playwright/test";
import { Buffer } from "node:buffer";
import { readFileSync } from 'node:fs';
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
const user = { id: "00000000-0000-4000-8000-000000000001", email: "correctness@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const initialWorkspace = {
  selectedStock: "AAPL", timeframe: "1m", secondarySymbol: "TSLA", secondaryTimeframe: "5m",
  additionalCharts: { third: { symbol: "SPY", interval: "15m" }, fourth: { symbol: "QQQ", interval: "1H" } },
  activeWorkspace: "chart-analysis", layoutMode: "2", gridMode: "4", syncCharts: false,
  replayMode: false, replayNotes: "Original session note", advancedMode: true,
};

for (const width of [390, 1536]) test(`modal keyboard focus stays contained and returns to its opener at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'settings' });
  await page.getByRole('tab', { name: 'General', exact: true }).click();
  const report = page.getByRole('button', { name: 'Report Issue', exact: true });
  await report.click();
  const dialog = page.getByRole('dialog', { name: 'Report an issue', exact: true });
  await expect(dialog.getByLabel('Description', { exact: true })).toBeFocused();
  await dialog.getByPlaceholder('What were you doing, and what did you expect to happen?').fill('Keyboard draft');
  await expect(dialog.getByPlaceholder('What were you doing, and what did you expect to happen?')).toBeFocused();
  await page.getByRole('button', { name: 'Account menu', exact: true }).evaluate(node => node.focus());
  await expect(dialog.getByPlaceholder('What were you doing, and what did you expect to happen?')).toBeFocused();
  await dialog.getByRole('button', { name: 'Send report', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close issue report' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Send report', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(report).toBeFocused();

  const help = page.getByRole('button', { name: 'Help, Terms & Privacy', exact: true });
  await help.click();
  const information = page.getByRole('dialog').filter({ has: page.getByRole('tab', { name: 'Quick Start', exact: true }) });
  await expect(information.getByRole('tab', { name: 'Quick Start', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(information.locator('[role=tab][aria-selected=true]')).toBeFocused();
  await information.getByRole('button', { name: 'Do not show again', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(information.getByRole('button', { name: /Close/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(help).toBeFocused();
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('button', { name: 'Help & shortcuts', exact: true }).click();
  await information.getByRole('tab', { name: 'Support', exact: true }).click();
  await information.getByRole('button', { name: 'Report an issue', exact: true }).click();
  await expect(dialog.getByLabel('Description', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeFocused();
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test('terminal hotkeys do not change paper side behind an open dialog', async ({ page }) => {
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'dashboard' });
  const ticket = page.getByRole('region', { name: 'Paper trade ticket', exact: true });
  await expect(ticket.getByRole('button', { name: 'Place Paper Buy', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('button', { name: 'Help & shortcuts', exact: true }).click();
  await page.getByRole('button', { name: 'Do not show again', exact: true }).focus();
  await page.keyboard.press('Shift+s');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(ticket.getByRole('button', { name: 'Place Paper Buy', exact: true })).toBeVisible();
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test('command palette keyboard activation respects the focused command and restores focus', async ({ page }) => {
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'dashboard' });
  const opener = page.getByRole('button', { name: 'Account menu', exact: true });
  await opener.focus(); await page.keyboard.press('Control+k');
  const search = page.getByPlaceholder('Search symbols, presets, workspaces, commands...');
  await expect(search).toBeFocused();
  await search.fill('Go to');
  const command = page.getByRole('button', { name: 'Go to Settings Switch workspace Workspace', exact: true });
  await command.focus(); await page.keyboard.press('Enter');
  await expect(search).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true, level: 1 })).toBeVisible();
  await expect(opener).toBeFocused();
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Command palette', exact: true });
  await expect(palette).toBeVisible();
  await palette.getByRole('button').last().focus(); await page.keyboard.press('Tab');
  await expect(search).toBeFocused();
  await page.keyboard.press('Escape'); await expect(opener).toBeFocused();
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

for (const width of [320,390,768]) for (const theme of ['dark','light']) test(`mobile terminal all workspaces at ${width}px ${theme}`, async ({ page }, testInfo) => {
 await page.setViewportSize({ width, height: 844 });
 const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'dashboard', layoutMode: '1', themeMode: theme });
 await expect(page.getByRole('region', { name: 'Paper trade ticket', exact: true })).toBeVisible();
 const navigate = async name => {
   if (width <= 700) await page.getByRole('button', { name: 'Open workspace navigation' }).click();
   await page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name, exact: true }).click();
   if (width <= 700) await expect(page.getByRole('button', { name: 'Open workspace navigation' })).toHaveAttribute('aria-expanded','false');
 };
 if (width <= 700) {
   expect(await page.locator('.ws-dashboard').evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(width - 35);
   const ticket = page.getByRole('region', { name: 'Paper trade ticket', exact: true });
   await ticket.getByLabel('Paper order type').selectOption('STOP_LIMIT');
   await ticket.getByLabel('Stop trigger').fill('100'); await ticket.getByLabel('Limit price', { exact: true }).fill('101');
   await ticket.locator('summary').click(); await ticket.getByLabel('Stop loss', { exact: true }).fill('90');
   await ticket.getByRole('button', { name: 'Place Paper Buy', exact: true }).scrollIntoViewIfNeeded();
   const rect = await ticket.getByRole('button', { name: 'Place Paper Buy', exact: true }).boundingBox(); expect(rect.width).toBeGreaterThan(250);
   await page.getByRole('button', { name: 'Open workspace navigation' }).click(); await page.keyboard.press('Escape');
   await expect(page.getByRole('button', { name: 'Open workspace navigation' })).toBeFocused();
 }
 const tabs = ['Dashboard', 'Watchlist', 'Charts', 'Market Scanner', 'News & Calendar', 'Order Flow', 'Positions', 'Orders', 'Trade Journal', 'Performance', 'Risk Manager', 'Tools', 'Settings'];
 for (const name of tabs) {
   await navigate(name);
   if (name === 'Order Flow') {
     await expect(page.getByRole('toolbar', { name: 'Order flow toolbar' })).toBeVisible();
     const dom = page.getByRole('region', { name: 'Simulated DOM ladder' });
     await dom.scrollIntoViewIfNeeded();
     const rect = await dom.boundingBox(); expect(rect.width).toBeLessThanOrEqual(width); expect(rect.height).toBeGreaterThan(200);
   } else if (name !== 'Dashboard') await expect(page.locator('.ws-workspace')).toBeVisible();
   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
   const clippedInputs = await page.evaluate(() => [...document.querySelectorAll('.ws-workspace input:not([type=hidden]),.ws-workspace select')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).map(el => el.getAttribute('aria-label') || el.outerHTML.slice(0,80)));
   expect(clippedInputs, `${name} controls outside viewport`).toEqual([]);
   await page.screenshot({ path: testInfo.outputPath(`mobile-${name.replaceAll(' ', '-')}.png`) });
 }
 await page.getByRole('button', { name: 'Notifications and alerts' }).click();
 await expect(page.getByRole('heading', { name: 'Alerts', exact: true, level: 1 })).toBeVisible();
 await navigate('Settings'); await page.getByRole('tab', { name: 'General', exact: true }).click();
 await expect(page.getByLabel('Theme', { exact: true })).toBeVisible();
 expect(await page.getByLabel('Theme', { exact: true }).evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(100);
 expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test('mobile rotation preserves the pending order draft and restores desktop navigation', async ({ page }) => {
 await page.setViewportSize({ width:390,height:844 });
 const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace:'dashboard',layoutMode:'1' });
 const ticket = page.getByRole('region', { name:'Paper trade ticket',exact:true });
 await ticket.getByLabel('Paper order type').selectOption('LIMIT');
 await ticket.getByLabel('Limit price', { exact:true }).fill('90');
 for (const width of [768,1280,390]) {
   await page.setViewportSize({ width,height:844 });
   await expect(ticket.getByLabel('Limit price', { exact:true })).toHaveValue('90');
   if(width>700) await expect(page.getByRole('navigation',{name:'Terminal workspaces'})).toBeVisible();
 }
 expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test('order flow local recording validates in a worker and replays depth without future leakage', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'order-flow' });
  const recording = JSON.parse(readFileSync('public/order-flow-recording-example.json', 'utf8'));
  recording.provenance = 'historical'; recording.source = 'Browser test declared source';
  const upload = data => page.getByLabel('Order flow recording file').setInputFiles({ name: 'recording.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await upload(recording);
  const chart = page.getByRole('region', { name: 'Footprint workspace' });
  const dom = page.getByRole('region', { name: 'Historical recording DOM ladder' });
  await expect(chart).toContainText('1 trades');
  await expect(page.getByText('HISTORICAL FILE', { exact: true })).toBeVisible();
  await expect(page.getByText(/declared source unverified · local only/)).toBeVisible();
  await expect(page.getByLabel('Order flow symbol', { exact: true })).toBeDisabled();
  await expect(dom.locator('tbody tr').first().locator('td').nth(4)).toHaveText('20');
  await page.getByRole('button', { name: 'Step trade', exact: true }).click();
  await expect(chart).toContainText('2 trades');
  await expect(dom.locator('tbody tr').first().locator('td').nth(4)).toHaveText('12');
  await page.getByRole('button', { name: 'Step trade', exact: true }).click();
  await expect(chart).toContainText('3 trades');
  await expect(page.getByRole('region', { name: 'Historical recording Time and Sales' }).locator('tbody tr')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Play replay', exact: true })).toBeDisabled();
  await upload({ ...recording, version: 999 });
  await expect(page.getByText(/Import rejected:/)).toBeVisible();
  await expect(chart).toContainText('3 trades');
  await page.screenshot({ path: testInfo.outputPath('historical-recording.png') });
  await upload({ ...recording, provenance: 'simulated', events: recording.events.filter(e => ['session', 'trade'].includes(e.type)) });
  await expect(page.getByText('SIMULATED RECORDING', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Simulated recording DOM ladder' }).locator('tbody tr')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset order flow workspace', exact: true }).click();
  await expect(chart).toContainText('1 trades');
  await page.getByRole('button', { name: 'Order flow settings', exact: true }).click();
  await page.getByRole('button', { name: 'Clear local recording', exact: true }).click();
  await page.getByRole('button', { name: 'Close order flow settings', exact: true }).click();
  await expect(page.getByText('SIMULATED DATA', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Order flow provider', { exact: true }).locator('option[value="recording"]')).toHaveAttribute('disabled', '');
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
  expect(evidence.paper.orders || []).toHaveLength(0);
});

for (const [width, height] of [[1920, 1080], [2560, 1440], [3440, 1440], [3840, 2160]]) {
  test(`order flow analytics fits ${width} desktop and renders active simulated data`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'order-flow' });
    await expect(page.getByRole('toolbar', { name: 'Order flow toolbar' })).toBeVisible();
    await expect(page.getByText('SIMULATED DATA', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Simulated footprint chart', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Simulated DOM ladder' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Order flow signals' })).toBeVisible();
    await page.getByRole('button', { name: 'Pause simulated stream', exact: true }).click();
    const chart = page.getByRole('region', { name: 'Footprint workspace' });
    await expect(chart).toContainText('SIMULATED ES');
    const canvas = page.getByRole('img', { name: 'Simulated footprint chart', exact: true });
    const rect = await canvas.boundingBox(); expect(rect.width).toBeGreaterThan(650); expect(rect.height).toBeGreaterThan(280);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`order-flow-${width}.png`) });
    expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
  });
}

test('order flow unavailable CME adapter has no synthetic fallback or connected status', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'order-flow' });
  await expect(page.getByRole('toolbar', { name: 'Order flow toolbar' })).toBeVisible();
  await page.getByLabel('Order flow provider', { exact: true }).selectOption('cme');
  await expect(page.getByText('CME UNAVAILABLE', { exact: true })).toBeVisible();
  await expect(page.getByText('FEED UNAVAILABLE', { exact: true })).toBeVisible();
  await expect(page.getByText('No provider timestamp', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Footprint workspace' })).toContainText('0 bars · 0 trades');
  await expect(page.getByRole('region', { name: 'Provider DOM ladder' }).locator('tbody tr')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Provider Time and Sales' }).locator('tbody tr')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('cme-unavailable.png') });
  await page.getByLabel('Order flow provider', { exact: true }).selectOption('mock');
  await expect(page.getByText('SIMULATED DATA', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Simulated DOM ladder' }).locator('tbody tr').first()).toBeVisible();
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test('order flow controls replay, filtering, settings and navigation without placing orders', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'dashboard' });
  await expect(page.getByRole('heading', { name: 'AAPL', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Order Flow', exact: true }).click();
  await expect(page.getByRole('toolbar', { name: 'Order flow toolbar' })).toBeVisible();
  const chart = page.getByRole('region', { name: 'Footprint workspace' });
  const initial = await chart.locator('footer').innerText();
  await expect.poll(async () => chart.locator('footer').innerText()).not.toBe(initial);
  await page.getByRole('button', { name: 'Pause simulated stream', exact: true }).click();
  const stopped = await chart.locator('footer').innerText();
  await page.waitForTimeout(700); expect(await chart.locator('footer').innerText()).toBe(stopped);
  await chart.getByRole('button', { name: 'Delta', exact: true }).click();
  await expect(chart.getByRole('button', { name: 'Delta', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Tick aggregation', { exact: true }).selectOption('4');
  await page.getByLabel('Liquidity Heatmap', { exact: true }).uncheck();
  await page.getByLabel('Minimum trade size', { exact: true }).fill('100000');
  await expect(page.getByText('No trades meet the selected size.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Order flow settings', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Imbalance ratio', exact: true }).fill('4');
  await page.getByRole('button', { name: 'Close order flow settings', exact: true }).click();
  await page.getByLabel('Order flow mode', { exact: true }).selectOption('replay');
  await page.getByRole('slider', { name: 'Order flow replay position' }).fill('10');
  await expect(chart).toContainText('11 trades');
  await page.getByRole('button', { name: 'Step trade', exact: true }).click();
  await expect(chart).toContainText('12 trades');
  await page.getByLabel('Order flow replay speed', { exact: true }).selectOption('8');
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect.poll(() => chart.locator('footer').innerText()).not.toContain('12 trades');
  await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
  await page.getByLabel('Order flow symbol', { exact: true }).selectOption('NQ');
  await expect(chart).toContainText('SIMULATED NQ');
  await page.getByRole('button', { name: 'Reset order flow workspace', exact: true }).click();
  await expect(page.getByLabel('Tick aggregation', { exact: true })).toHaveValue('2');
  await page.getByLabel('Order flow layout', { exact: true }).selectOption('chart');
  await expect(page.getByRole('region', { name: 'Simulated DOM ladder' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Order book', exact: true })).toBeVisible();
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
  expect(evidence.paper.orders || []).toHaveLength(0);
});

function candles(symbol, timeframe) {
  const seconds = { "1m": 60, "5m": 300, "15m": 900, "1H": 3600, "1D": 86400 }[timeframe];
  const interval = { "1m": "OneMinute", "5m": "FiveMinutes", "15m": "FifteenMinutes", "1H": "OneHour", "1D": "OneDay" }[timeframe];
  const base = { AAPL: 100, TSLA: 200, SPY: 300, QQQ: 400, MSFT: 500, NVDA: 600, AMD: 700, DIA: 800 }[symbol] || 900;
  return { symbol, timeframe, interval, source: "Isolated test history", quality: "historical", session: "test-only",
    candles: Array.from({ length: 50 }, (_, index) => ({ time: start + index * seconds,
      open: base + index, high: base + index + 2, low: base + index - 1, close: base + index + 1, volume: 1000 })) };
}

async function setupApp(page, payload = initialWorkspace, { unavailableHistory = false, providerQuotes = [], providerNews = [], providerScanner = {}, providerSummary = null, aiEntitled = true } = {}) {
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
    if (url.origin === "http://127.0.0.1:4175") return route.continue();
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
  await page.goto("/");
  return { errors, blocked, paper, repository, alertService, workspace: () => ({ ...row.data, paperLedger: repository.rows.get(user.id)?.ledger || row.data.paperLedger }) };
}

test("news AI handles retry, provenance and article switching", async ({ page }) => {
  let calls = 0;
  const providerNews = [
    { id: "article-a", headline: "Alpha earnings evidence", relatedTicker: "NVDA", source: "Yahoo Finance", url: "https://example.com/a", timestamp: new Date().toISOString() },
    { id: "article-b", headline: "Beta revenue evidence", relatedTicker: "NVDA", source: "Yahoo Finance", url: "https://example.com/b", timestamp: new Date().toISOString() },
  ];
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: "news", selectedStock: "NVDA" }, {
    providerNews, providerSummary: async ({ newsItem }) => {
      calls++;
      if (calls === 1) return { status: 503, json: { error: "Provider unavailable" } };
      return { json: { summary: { summary: `Summary for ${newsItem.headline}`, source: calls === 2 ? "gemini" : "local",
        cached: false, evidence: { scope: "headline-only" }, warning: calls === 2 ? null : "Provider unavailable" } } };
    },
  });
  await page.getByRole("row").filter({ hasText: "Alpha earnings evidence" }).first().click();
  await page.getByRole("button", { name: "Generate AI Summary", exact: true }).click();
  await expect(page.getByText("AI summary is temporarily unavailable. Try again.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Generate AI Summary", exact: true }).click();
  await expect(page.getByLabel("Article AI summary")).toContainText("Summary for Alpha earnings evidence");
  await expect(page.getByText("AI analysis · gemini · generated · headline only", { exact: true })).toBeVisible();
  await page.getByRole("row").filter({ hasText: "Beta revenue evidence" }).first().click();
  await expect(page.getByLabel("Article AI summary")).toHaveCount(0);
  await page.getByRole("button", { name: "Generate AI Summary", exact: true }).click();
  await expect(page.getByLabel("Article AI summary")).toContainText("Summary for Beta revenue evidence");
  await expect(page.getByText("Heuristic context · AI unavailable · headline only", { exact: true })).toBeVisible();
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test("news AI action stays disabled without the AI entitlement", async ({ page }) => {
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: "news" }, { aiEntitled: false,
    providerNews: [{ id: "article", headline: "Provider evidence", source: "Yahoo Finance", url: "https://example.com/article" }] });
  await expect(page.getByRole("button", { name: "Generate AI Summary", exact: true })).toBeDisabled();
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test("scanner shows bounded verified quotes and keeps empty categories independent", async ({ page }) => {
  const row = { symbol: "NVDA", price: 123, changePercent: 2, volume: 3000000,
    source: "Questrade", verified: true, trustTier: 3, freshness: "live", providerTimestamp: new Date().toISOString() };
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: "scanner", selectedStock: "NVDA" }, {
    providerScanner: { gainers: [row], active: [row], verifiedMovers: [row], losers: [],
      fallback: true, degraded: true, coverageLabel: "Bounded coverage; not market-wide rankings", contractVersion: "scanner-v2" },
  });
  await page.getByLabel("Minimum relative volume").selectOption("0");
  const workspace = page.locator('.ws-workspace[data-workspace="scanner"]');
  await expect(workspace).toContainText("Verified provider");
  await expect(workspace).toContainText("Bounded coverage; not market-wide rankings");
  await expect(workspace).toContainText("Results: 1");
  await page.getByRole("tab", { name: "Losers", exact: true }).click();
  await expect(workspace).toContainText("Results: 0");
  await page.screenshot({ path: "artifacts/scanner-browser.png", fullPage: true });
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

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

test('journal Clear Draft removes trade prices, quantity, fees and imported P&L before reuse', async ({ page }) => {
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'journal', journalDraft: {
    recordType: 'trade', status: 'closed', symbol: 'AAPL', quantity: '10', entryPrice: '100', exitPrice: '120', fees: '2',
    pnl: 198, setup: 'Previous trade', grade: 'A', tags: 'old', screenshotUrl: 'https://example.com/old', review: 'Old review', bias: 'Short' } });
  await expect(page.getByLabel('Journal quantity', { exact: true })).toHaveValue('10');
  await page.getByRole('button', { name: 'Clear Draft', exact: true }).click();
  await expect(page.getByLabel('Journal record type', { exact: true })).toHaveValue('note');
  await page.getByLabel('Journal record type', { exact: true }).selectOption('trade');
  for (const label of ['quantity', 'entry price', 'exit price', 'total fees']) await expect(page.getByLabel(`Journal ${label}`, { exact: true })).toHaveValue('');
  await expect.poll(() => evidence.workspace().journalDraft?.pnl ?? null).toBeNull();
  await page.reload();
  await expect(page.getByLabel('Journal quantity', { exact: true })).toHaveValue('');
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test('journal CSV exports formula-like notes as text without changing recorded P&L', async ({ page }) => {
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'journal', journalEntries: [
    { id: 'csv-safety', symbol: 'AAPL', pnl: -40, setup: '=SUM(1,2)', review: '@SUM(A1:A2)', createdAt: new Date().toISOString() } ] });
  await page.getByRole('tab', { name: 'Exports', exact: true }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Journal CSV', exact: true }).click();
  const stream = await (await download).createReadStream(); let csv = ''; for await (const chunk of stream) csv += chunk;
  expect(csv).toContain('"\'=SUM(1,2)"'); expect(csv).toContain('"\'@SUM(A1:A2)"'); expect(csv).toContain('"-40"');
  expect(evidence.workspace().journalEntries[0].setup).toBe('=SUM(1,2)');
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test('watchlist edits target the visible fallback list when a restored active ID is missing', async ({ page }) => {
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'watchlist', liveStocks: [{ symbol: 'AAPL' }],
    premiumPreferences: { watchlists: [{ id: 'main', name: 'Main', symbols: ['AAPL'] }, { id: 'other', name: 'Other', symbols: ['TSLA'] }], activeWatchlistId: 'deleted-list' } });
  await expect(page.getByLabel('Active watchlist')).toHaveValue('main');
  await page.getByLabel('Watchlist symbol', { exact: true }).fill('NVDA');
  await page.getByRole('button', { name: 'Add Symbol', exact: true }).click();
  await expect.poll(() => evidence.workspace().premiumPreferences?.watchlists?.[0]?.symbols).toEqual(['AAPL', 'NVDA']);
  expect(evidence.workspace().premiumPreferences.watchlists[1].symbols).toEqual(['TSLA']);
  await expect.poll(() => evidence.workspace().premiumPreferences?.activeWatchlistId).toBe('main');
  await page.getByRole('button', { name: 'Remove AAPL from watchlist', exact: true }).click();
  await expect.poll(() => evidence.workspace().premiumPreferences.watchlists[0].symbols).toEqual(['NVDA']);
  await page.reload(); await expect(page.getByLabel('Active watchlist')).toHaveValue('main');
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
  for (const action of ['Cancel selected', 'Cancel all orders', 'Flatten paper account']) await expect(page.getByRole('button', { name: action, exact: true })).toBeDisabled();
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
  await expect(page.getByRole('table', { name: 'Paper account P&L' })).toContainText('Today realized');
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

for (const width of [1280, 1536]) test(`light theme logo and navigation remain readable at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1024 });
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'watchlist', themeMode: 'light' });
  const logo = page.getByRole('img', { name: 'SB logo', exact: true });
  await expect(logo).toHaveAttribute('src', '/sb-terminal-logo.png');
  await expect(logo).toHaveCSS('filter', 'invert(1)');
  await expect(page.locator('.ws-logo-window')).toHaveCSS('mix-blend-mode', 'multiply');
  const contrast = await page.evaluate(() => {
    const luminance = value => {
      const rgb = value.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
      return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
    };
    return [...document.querySelectorAll('.ws-sidebar nav button'), document.querySelector('.ws-clock')].map(element => {
      const style = getComputedStyle(element), background = style.backgroundColor === 'rgba(0, 0, 0, 0)' ? getComputedStyle(element.closest('.ws-sidebar') || element.closest('.ws-header')).backgroundColor : style.backgroundColor;
      const a = luminance(style.color), b = luminance(background); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
  });
  expect(Math.min(...contrast)).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: testInfo.outputPath(`readable-light-shell-${width}.png`) });
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

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

test('early close updates dashboard and paper ticket without quote activity; DAY expires and GTC waits', async ({ page }, testInfo) => {
  const before = new Date('2026-11-27T17:59:50Z');
  await page.clock.install({ time: before });
  const quotes = [{ ...paperProviderQuote(100), lastTradeTime: before.toISOString() }];
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'dashboard', selectedStock: 'NVDA', layoutMode: '1', positions: {}, orders: [], realizedPnL: 0 }, { providerQuotes: quotes });
  const metric = page.locator('.ws-market-status');
  await expect(metric).toContainText('Market Open'); await expect(metric).toContainText('Early close · 13:00 ET');
  const ticket = page.getByRole('region', { name: 'Paper trade ticket', exact: true });
  await ticket.getByLabel('Paper order type').selectOption('LIMIT'); await ticket.getByLabel('Paper quantity').fill('1');
  await ticket.getByLabel('Limit price', { exact: true }).fill('95');
  await ticket.getByRole('button', { name: 'Place Paper Buy', exact: true }).click();
  await expect.poll(() => evidence.workspace().paperLedger?.orders[0]?.expiresAt).toBe('2026-11-27T18:00:00.000Z');
  await page.clock.fastForward(10000);
  await expect(metric).toContainText('AFTER HOURS'); await expect(ticket).toContainText('Session closed');
  await page.clock.fastForward(5000);
  await expect.poll(() => evidence.workspace().paperLedger?.orders[0]?.status).toBe('EXPIRED');
  await ticket.getByRole('button', { name: 'New order', exact: true }).click();
  await ticket.getByLabel('Paper order type').selectOption('MARKET'); await ticket.locator('summary').click();
  await ticket.getByLabel('Paper duration').selectOption('GTC');
  await ticket.getByRole('button', { name: 'Place Paper Buy', exact: true }).click();
  await expect(ticket.getByRole('status')).toContainText('Queued for the regular US equity session');
  expect(evidence.workspace().paperLedger.positions).toEqual({});
  await page.screenshot({ path: testInfo.outputPath('early-close-dashboard.png') });
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test('holiday calendar shows closed and DAY queues until the next regular session', async ({ page }) => {
  const time = new Date('2026-12-25T15:00:00Z'); await page.clock.setFixedTime(time);
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'dashboard', selectedStock: 'NVDA', layoutMode: '1', positions: {}, orders: [] }, { providerQuotes: [{ ...paperProviderQuote(100), lastTradeTime: time.toISOString() }] });
  await expect(page.locator('.ws-market-status')).toContainText('Market Closed');
  await expect(page.locator('.ws-market-status')).toContainText('Exchange holiday');
  const ticket = page.getByRole('region', { name: 'Paper trade ticket', exact: true });
  await ticket.getByLabel('Paper order type').selectOption('MARKET'); await ticket.getByLabel('Paper quantity').fill('1');
  await ticket.getByRole('button', { name: 'Place Paper Buy', exact: true }).click();
  await expect.poll(() => evidence.workspace().paperLedger?.orders[0]?.expiresAt).toBe('2026-12-28T21:00:00.000Z');
  expect(evidence.workspace().paperLedger.positions).toEqual({}); expect(evidence.errors).toEqual([]);
});

test('chart saved timezone controls tooltip labels while market-session clock stays Eastern', async ({ page }, testInfo) => {
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'dashboard', selectedStock: 'AAPL', layoutMode: '1', timeZone: 'America/New_York' });
  const chart = page.getByRole('region', { name: 'Primary trading chart', exact: true });
  const showTime = async () => {
    const canvas = chart.locator('canvas').first(); await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox(); await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.45);
    return chart.locator('[data-chart-time]');
  };
  await expect(await showTime()).toContainText('EDT');
  await page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Time zone', { exact: true }).selectOption('UTC');
  await expect.poll(() => evidence.workspace().timeZone).toBe('UTC');
  await page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name: 'Dashboard', exact: true }).click();
  await expect(await showTime()).toContainText('UTC'); await expect(page.locator('.ws-clock')).toContainText('ET');
  await page.screenshot({ path: testInfo.outputPath('chart-timezone-utc.png') });
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

for (const width of [390, 1536]) test(`paper cost preferences save and restore without changing dashboard layout at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'settings', premiumPreferences: {} });
  await page.getByRole('tab', { name: 'Trading', exact: true }).click();
  await page.getByLabel('Commission per fill ($)', { exact: true }).fill('1');
  await page.getByLabel('Commission per share ($)', { exact: true }).fill('0.01');
  await page.getByLabel('Adverse slippage (bps)', { exact: true }).fill('10');
  await expect.poll(() => evidence.workspace().premiumPreferences?.paperCosts).toEqual({ commissionPerOrder: 1, commissionPerShare: 0.01, slippageBps: 10 });
  await page.getByLabel('Adverse slippage (bps)', { exact: true }).fill('101');
  await expect(page.getByLabel('Adverse slippage (bps)', { exact: true })).toHaveValue('10');
  await page.screenshot({ path: testInfo.outputPath(`paper-cost-settings-${width}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.reload(); await page.getByRole('tab', { name: 'Trading', exact: true }).click();
  await expect(page.getByLabel('Commission per fill ($)', { exact: true })).toHaveValue('1');
  await expect(page.getByLabel('Commission per share ($)', { exact: true })).toHaveValue('0.01');
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

for (const short of [false, true]) test(`paper ${short ? 'short cover' : 'long exit'} shows costs and exports net performance after partial close`, async ({ page }, testInfo) => {
  await page.clock.setFixedTime(paperNow);
  const quotes = [paperProviderQuote(100)];
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'dashboard', selectedStock: 'NVDA', layoutMode: '1', positions: {}, orders: [], realizedPnL: 0, journalEntries: [], premiumPreferences: { paperCosts: { commissionPerOrder: 1, commissionPerShare: 0.01, slippageBps: 10 } } }, { providerQuotes: quotes });
  const ticket = page.getByRole('region', { name: 'Paper trade ticket', exact: true });
  if (short) await ticket.getByRole('button', { name: 'Sell Short', exact: true }).click();
  await ticket.getByLabel('Paper order type').selectOption('MARKET');
  await ticket.getByLabel('Paper quantity').fill('10');
  await ticket.getByRole('button', { name: short ? 'Place Paper Sell Short' : 'Place Paper Buy', exact: true }).click();
  await expect(ticket.getByRole('status')).toContainText('Commission $1.10');
  await expect.poll(() => evidence.workspace().paperLedger?.realizedPnL).toBe(-1.1);
  quotes[0] = paperProviderQuote(short ? 90 : 110);
  await page.reload();
  await ticket.getByRole('button', { name: short ? 'Buy to Cover' : 'Sell', exact: true }).click();
  await ticket.getByLabel('Paper order type').selectOption('MARKET');
  await ticket.getByLabel('Paper quantity').fill('4');
  await ticket.getByRole('button', { name: short ? 'Place Paper Buy to Cover' : 'Place Paper Sell', exact: true }).click();
  await expect.poll(() => evidence.workspace().paperLedger?.positions.NVDA?.entryFeesRemaining).toBe(0.66);
  const exit = evidence.workspace().paperLedger.orders.find(row => row.action === (short ? 'BUY_TO_COVER' : 'SELL'));
  expect(exit.commission).toBe(1.04); expect(exit.entryCommission).toBe(0.44);
  expect(exit.netTradePnL).toBe(short ? 37.68 : 37.6);
  await expect(ticket.getByRole('status')).toContainText(short ? 'net exit P&L $37.68' : 'net exit P&L $37.60');
  await page.screenshot({ path: testInfo.outputPath(`paper-cost-${short ? 'short' : 'long'}.png`) });
  await page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name: 'Trade Journal', exact: true }).click();
  await page.getByRole('tab', { name: 'Exports', exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Journal CSV', exact: true }).click();
  const stream = await (await pending).createReadStream(); let csv = ''; for await (const chunk of stream) csv += chunk;
  expect(csv).toContain('1.48'); expect(csv).toContain(String(exit.netTradePnL));
  await page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name: 'Performance', exact: true }).click();
  await expect(page.getByText(short ? '$37.68' : '$37.60', { exact: true }).first()).toBeVisible();
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test('server paper management edits, protects, flattens and exports realized history', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(paperNow);
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'orders', selectedStock: 'NVDA', layoutMode: '1' }, { providerQuotes: [paperProviderQuote(100)] });
  const ticket = page.getByRole('region', { name: 'Paper trade ticket', exact: true });
  await ticket.getByLabel('Paper order type').selectOption('LIMIT');
  await ticket.getByLabel('Paper quantity').fill('10');
  await ticket.getByLabel('Limit price', { exact: true }).fill('95');
  await ticket.getByRole('button', { name: 'Place Paper Buy', exact: true }).click();
  await expect.poll(() => evidence.workspace().paperLedger?.orders[0]?.status).toBe('WORKING');
  await page.getByRole('button', { name: 'Edit order', exact: true }).click();
  await page.getByLabel('Edited limit price').fill('101');
  await page.getByLabel('Edited quantity').fill('5');
  await page.getByRole('button', { name: 'Confirm paper action' }).click();
  await expect.poll(() => evidence.workspace().paperLedger?.positions.NVDA?.quantity).toBe(5);
  await page.getByRole('button', { name: 'Edit protection', exact: true }).click();
  await page.getByLabel('Position stop loss').fill('90');
  await page.getByLabel('Position take profit').fill('110');
  await page.getByRole('button', { name: 'Confirm paper action' }).click();
  await expect.poll(() => evidence.workspace().paperLedger?.orders.filter(row => row.status === 'WORKING').length).toBe(2);
  await page.getByRole('button', { name: 'Flatten paper account', exact: true }).click();
  await expect(page.getByText('Cancel all working paper orders and submit market closes', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm paper action' }).click();
  await expect.poll(() => evidence.workspace().paperLedger?.positions).toEqual({});
  await page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name: 'Positions', exact: true }).click();
  await page.getByRole('tab', { name: 'Closed Positions', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Realized P&L', exact: true })).toBeVisible();
  await expect(page.getByText('Position closed', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('paper-realized-history.png') });
  await page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name: 'Trade Journal', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Unspecified', exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Exports', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Journal CSV', exact: true }).click();
  const stream = await (await pending).createReadStream(); let csv = ''; for await (const chunk of stream) csv += chunk;
  expect(csv).toContain('Paper simulation'); expect(csv).toContain('NVDA'); expect(csv).toContain('-0.1');
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test('server paper snapshot refresh accepts another device trade without workspace overwrite', async ({ page }) => {
  await page.clock.setFixedTime(paperNow);
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'dashboard', selectedStock: 'NVDA', layoutMode: '1' }, { providerQuotes: [paperProviderQuote(100)] });
  await expect(page.getByRole('button', { name: 'Place Paper Buy', exact: true })).toBeEnabled();
  await evidence.paper.transact(user.id, { id: 'other-device', kind: 'submit', draft: { symbol: 'NVDA', side: 'SELL_SHORT', type: 'MARKET', quantity: 3, tif: 'GTC' } });
  await expect(page.getByRole('region', { name: 'Portfolio records' })).toContainText('-3', { timeout: 15000 });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Portfolio records' })).toContainText('-3');
  expect(evidence.workspace().paperLedger.orders).toHaveLength(1);
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test('MSTR zero-share sell explains actions, explicit short and partial cover persist correctly', async ({page},testInfo) => {
 await page.clock.setFixedTime(paperNow);
 const quotes=[{...paperProviderQuote(167.94,'MSTR'),bidPrice:167.90,askPrice:167.99}];
 const evidence=await setupApp(page,{...initialWorkspace,activeWorkspace:'dashboard',selectedStock:'MSTR',layoutMode:'1',positions:{},orders:[],realizedPnL:0},{providerQuotes:quotes});
 const ticket=page.getByRole('region',{name:'Paper trade ticket',exact:true});
 await ticket.getByLabel('Paper order type').selectOption('MARKET');
 await ticket.getByLabel('Paper quantity').fill('100');
 await ticket.getByRole('button',{name:'Sell',exact:true}).click();
 await expect(ticket).toContainText('0 / 0 MSTR');
 await ticket.getByRole('button',{name:'Place Paper Sell',exact:true}).click();
 await expect(ticket.getByRole('status')).toContainText('You do not own MSTR');
 await expect(ticket.getByRole('status')).not.toContainText('Cancel a working sell first');
 await expect(ticket.getByRole('button',{name:'Sell Short',exact:true})).toBeInViewport({ratio:1});
 await ticket.getByRole('button',{name:'Sell Short',exact:true}).click();
 await ticket.getByRole('button',{name:'Place Paper Sell Short',exact:true}).click();
 await expect(ticket.getByRole('status')).toContainText('FILLED');
 await expect.poll(()=>evidence.workspace().paperLedger?.positions.MSTR?.quantity).toBe(-100);
 await expect(page.locator('.ws-account-strip')).toContainText('$83,210.00');
 quotes[0]=paperProviderQuote(160,'MSTR');
 await expect(page.locator('.ws-symbol-price')).toContainText('160.00',{timeout:20000});
 await ticket.getByRole('button',{name:'Buy to Cover',exact:true}).click();
 await ticket.getByLabel('Paper quantity').fill('20');
 await ticket.getByRole('button',{name:'Place Paper Buy to Cover',exact:true}).click();
 await expect.poll(()=>evidence.workspace().paperLedger?.positions.MSTR?.quantity).toBe(-80);
 expect(evidence.workspace().paperLedger.realizedPnL).toBe(157.8);
 await page.reload();await expect(page.locator('.ws-portfolio tbody')).toContainText('-80');
 await page.screenshot({path:testInfo.outputPath('mstr-short-cover.png')});
 expect(evidence.errors).toEqual([]);expect(evidence.blocked).toEqual([]);
});

test('short bracket buys to cover on its stop and cancels the lower profit target', async ({page}) => {
 await page.clock.setFixedTime(paperNow);
 const quotes=[paperProviderQuote(100)];
 const evidence=await setupApp(page,{...initialWorkspace,activeWorkspace:'orders',selectedStock:'NVDA',positions:{},orders:[],realizedPnL:0},{providerQuotes:quotes});
 const ticket=page.getByRole('region',{name:'Paper trade ticket',exact:true});
 await ticket.getByRole('button',{name:'Sell Short',exact:true}).click();
 await ticket.getByLabel('Paper order type').selectOption('MARKET');await ticket.getByLabel('Paper quantity').fill('10');
 await ticket.locator('summary').click();await ticket.getByLabel('Stop loss',{exact:true}).fill('105');await ticket.getByLabel('Take profit',{exact:true}).fill('95');
 await ticket.getByRole('button',{name:'Place Paper Sell Short',exact:true}).click();
 await expect.poll(()=>evidence.workspace().paperLedger?.orders.length).toBe(3);
 quotes[0]=paperProviderQuote(106);
 await expect.poll(()=>evidence.workspace().paperLedger?.positions.NVDA,{timeout:25000}).toBeUndefined();
 const ledger=evidence.workspace().paperLedger;
 expect(ledger.realizedPnL).toBe(-60.2);expect(ledger.orders.find(o=>o.type==='STOP').action).toBe('BUY_TO_COVER');
 expect(ledger.orders.find(o=>o.type==='LIMIT').status).toBe('CANCELLED');
 await page.getByRole('tab',{name:'Filled',exact:true}).click();
 await expect(page.getByRole('row',{name:'Select NVDA',exact:true}).first()).toContainText('BUY TO COVER');
 expect(evidence.errors).toEqual([]);expect(evidence.blocked).toEqual([]);
});

test('order flow shows real Level 1 and last trade snapshot with honest feed labels',async({page},testInfo)=>{
 await page.clock.setFixedTime(paperNow);
 const quotes=[{...paperProviderQuote(167.94,'MSTR'),lastTradePrice:167.94,lastTradeSize:37}];
 const evidence=await setupApp(page,{...initialWorkspace,activeWorkspace:'dashboard',selectedStock:'MSTR',layoutMode:'1',positions:{},orders:[]},{providerQuotes:quotes});
 const book=page.getByRole('region',{name:'Order book',exact:true});
 await expect(book).toContainText('Level 1 · best bid / ask');
 await book.getByRole('tab',{name:'Time & Sales',exact:true}).click();
 await expect(book.getByRole('cell',{name:'167.94',exact:true})).toBeVisible();
 await expect(book.getByRole('cell',{name:'37',exact:true})).toBeVisible();
 await expect(book.getByRole('cell',{name:'37',exact:true})).toBeInViewport({ratio:1});
 await expect(book).toContainText('Last trade snapshot · not full tape');
 expect(await book.locator('tbody tr').count()).toBe(1);
 await page.screenshot({path:testInfo.outputPath('order-flow-snapshot.png')});
 expect(evidence.errors).toEqual([]);expect(evidence.blocked).toEqual([]);
});

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
 await expect(page.locator('.ws-symbol-price')).toContainText('105.50', { timeout: 25000 });
 await expect(page.locator('.ws-equity')).toContainText('$99,999.90');
 expect(evidence.errors).toEqual([]);expect(evidence.blocked).toEqual([]);
});

test('paper lost response survives reload and rapid retry without duplicate execution', async ({ page }) => {
 await page.clock.setFixedTime(paperNow);
 const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'dashboard', selectedStock: 'NVDA', layoutMode: '1', positions: {}, orders: [], realizedPnL: 0 }, { providerQuotes: [paperProviderQuote(100)] });
 let first = true; const ids = [];
 await page.route('**/api/paper/commands', async route => {
   const { command, limits } = route.request().postDataJSON(); ids.push(command.id);
   if (!first) return route.fallback();
   first = false;
   await evidence.paper.transact(user.id, command, limits);
   await route.abort('connectionreset');
 });
 const ticket = page.getByRole('region', { name: 'Paper trade ticket', exact: true });
 await ticket.getByLabel('Paper order type').selectOption('MARKET'); await ticket.getByLabel('Paper quantity').fill('10');
 await ticket.getByRole('button', { name: 'Place Paper Buy', exact: true }).click();
 await expect(ticket.getByRole('status')).toContainText('Response not confirmed');
 expect(evidence.workspace().paperLedger.positions.NVDA.quantity).toBe(10);
 await page.reload();
 await ticket.getByLabel('Paper order type').selectOption('MARKET'); await ticket.getByLabel('Paper quantity').fill('10');
 await ticket.locator('summary').click(); await ticket.getByLabel('Paper setup').fill('Review metadata changed after reload');
 await expect(ticket.getByRole('button', { name: 'Place Paper Buy', exact: true })).toBeEnabled();
 await ticket.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
 await expect(ticket.getByRole('status')).toContainText('FILLED');
 expect(ids).toHaveLength(2); expect(ids[1]).toBe(ids[0]);
 expect(evidence.workspace().paperLedger.orders[0].setup).toBe('Unspecified');
 expect(evidence.workspace().paperLedger.orders).toHaveLength(1);
 expect(evidence.workspace().paperLedger.positions.NVDA.quantity).toBe(10);
 expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
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
 await page.getByRole('button',{name:'Cancel selected',exact:true}).click();
 await page.getByRole('button',{name:'Confirm paper action',exact:true}).click();
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

for (const width of [390, 1536]) test(`paper discipline rules and checklist work at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1024 }); await page.clock.setFixedTime(paperNow);
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'settings', selectedStock: 'NVDA', layoutMode: '1', orders: [], positions: {} }, { providerQuotes: [paperProviderQuote(100)] });
  await page.getByRole('tab', { name: 'Trading', exact: true }).click();
  await page.getByLabel('Maximum order value ($)', { exact: true }).fill('2000');
  await page.getByLabel('Risk per trade ($)', { exact: true }).fill('25');
  await page.getByLabel('Require pre-trade checklist', { exact: true }).check();
  await page.getByRole('button', { name: 'Save Paper Rules', exact: true }).click();
  await expect.poll(() => evidence.workspace().paperLedger?.riskPolicy?.checklistRequired).toBe(true);
  if (width < 800) await page.getByRole('button', { name: 'Open workspace navigation' }).click();
  await page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name: 'Dashboard', exact: true }).click();
  const ticket = page.getByRole('region', { name: 'Paper trade ticket', exact: true });
  const submit = ticket.getByRole('button', { name: 'Place Paper Buy', exact: true }); await expect(submit).toBeDisabled();
  await ticket.getByLabel('Paper order type').selectOption('MARKET');
  await ticket.getByText('Duration & protection', { exact: true }).click();
  await ticket.getByLabel('Stop loss', { exact: true }).fill('99'); await ticket.getByLabel('Paper setup').fill('Opening breakout');
  for (const label of ['Setup and entry plan reviewed', 'Position size and loss reviewed', 'Exit and stop plan reviewed']) await ticket.getByLabel(label, { exact: true }).check();
  await expect(submit).toBeEnabled(); await ticket.getByLabel('Paper quantity').fill('11'); await expect(submit).toBeDisabled();
  for (const label of ['Setup and entry plan reviewed', 'Position size and loss reviewed', 'Exit and stop plan reviewed']) await ticket.getByLabel(label, { exact: true }).check();
  await submit.click(); await expect(ticket.getByRole('status')).toContainText('FILLED');
  expect(evidence.workspace().paperLedger.positions.NVDA.setup).toBe('Opening breakout');
  await page.screenshot({ path: testInfo.outputPath('paper-checklist.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

for (const width of [390, 1536]) test(`journal filters scope records, statistics, comparisons and all-page CSV at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1024 });
  const record = (id, symbol, setup, createdAt, pnl, extra = {}) => ({ id, symbol, setup, createdAt, openedAt: '2026-10-01T14:00:00Z', recordType: 'trade', status: 'closed', pnl, notes: 'Reviewed risk', ...extra });
  const journalEntries = [
    record('partial', 'AAPL', 'Breakout', '2026-10-01T14:00:00Z', 38, { tradeGroupId: 'round-trip', source: 'Paper simulation', quantity: 4, fees: 2, closesPosition: false }),
    record('final', 'AAPL', 'Breakout', '2026-10-02T14:00:00Z', 57, { tradeGroupId: 'round-trip', source: 'Paper simulation', quantity: 6, fees: 3, closesPosition: true }),
    ...Array.from({ length: 30 }, (_, index) => record(`manual-${index}`, 'AAPL', 'Breakout', '2026-10-02T15:00:00Z', 1)),
    record('other-symbol', 'TSLA', 'Breakout', '2026-10-02T15:00:00Z', 900),
    record('other-setup', 'AAPL', 'Pullback', '2026-10-02T15:00:00Z', 800),
    record('before', 'AAPL', 'Breakout', '2026-10-02T03:59:59Z', 700),
    record('undated', 'AAPL', 'Breakout', null, 600),
    record('note', 'AAPL', 'Breakout', '2026-10-02T15:00:00Z', null, { recordType: 'note', status: 'note' }),
  ];
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'journal', journalEntries });
  await page.getByLabel('Journal from date ET').fill('2026-10-02');
  await page.getByLabel('Journal through date ET').fill('2026-10-02');
  await page.getByLabel('Journal symbol filter').selectOption('AAPL');
  await page.getByLabel('Journal setup filter').selectOption('Breakout');
  await page.getByLabel('Journal record filter').selectOption('trade');
  await page.getByPlaceholder('Search journal records').fill('Reviewed risk');
  await expect(page.getByRole('status').filter({ hasText: '31 matching records' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '1 records excluded because their date is unknown' })).toBeVisible();
  await page.getByRole('tab', { name: 'Statistics', exact: true }).click();
  await expect(page.getByRole('row', { name: 'Select Breakout', exact: true })).toContainText('$125.00');
  await expect.poll(() => evidence.workspace().premiumPreferences?.journalFilters?.symbol).toBe('AAPL');
  await page.screenshot({ path: testInfo.outputPath('journal-scope.png'), fullPage: true });
  await page.getByRole('tab', { name: 'Exports', exact: true }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Filtered Journal CSV', exact: true }).click();
  const stream = await (await download).createReadStream(); let csv = ''; for await (const chunk of stream) csv += chunk;
  expect(csv.trim().split('\n')).toHaveLength(32); expect(csv).toContain('filterFromET'); expect(csv).toContain('group-round-trip'); expect(csv).not.toContain('other-symbol');
  await page.reload(); await expect(page.getByLabel('Journal symbol filter')).toHaveValue('AAPL');
  await expect(page.getByLabel('Journal from date ET')).toHaveValue('2026-10-02');
  await page.getByRole('tab', { name: 'Statistics', exact: true }).click();
  await page.getByLabel('Group paper partial exits').uncheck();
  await expect(page.getByRole('status').filter({ hasText: '31 matching records' })).toBeVisible();
  await expect(page.getByText('$87.00', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('row', { name: 'Select Breakout', exact: true })).toContainText('$125.00');
  await page.getByLabel('Journal through date ET').fill('2026-10-01');
  await expect(page.getByRole('status').filter({ hasText: 'start date must be on or before' })).toBeVisible();
  await page.getByRole('tab', { name: 'Exports', exact: true }).click(); await expect(page.getByRole('button', { name: 'Filtered Journal CSV', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Clear Filters', exact: true }).click();
  await expect(page.getByLabel('Journal symbol filter')).toHaveValue('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test('journal compares grouped positions by entry setup, hour and session', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(paperNow);
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'journal', layoutMode: '1', orders: [], positions: {} }, { providerQuotes: [paperProviderQuote(100)] });
  const submit = (id, side, quantity) => evidence.paper.transact(user.id, { id, kind: 'submit', draft: { symbol: 'NVDA', side, type: 'MARKET', quantity, tif: 'GTC', setup: 'Opening breakout' } });
  await submit('entry', 'BUY', 10); await submit('partial', 'SELL', 4); await submit('last', 'SELL', 6);
  await page.reload(); await page.getByRole('tab', { name: 'Statistics', exact: true }).click();
  const analysis = page.getByLabel('Journal analysis dimension');
  await expect(page.getByRole('row', { name: 'Select Opening breakout', exact: true })).toContainText('1');
  await analysis.selectOption('time'); await expect(page.getByText('11:00–11:59 ET', { exact: true })).toBeVisible();
  await analysis.selectOption('session'); await expect(page.getByText('Regular', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('journal-analysis.png') });
  await page.getByRole('tab', { name: 'Trades', exact: true }).click();
  await expect(page.getByText('2 realized exits · Position closed', { exact: true })).toBeVisible();
  await page.getByLabel('Group paper partial exits').uncheck();
  await expect(page.getByRole('row', { name: 'Select NVDA', exact: true })).toHaveCount(2);
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

for (const width of [390, 1536]) test(`workspace restore validates and previews replacements while preserving server accounts at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1024 });
  const savedRisk = { maxOrderValue: 2000, riskPerTrade: 25, dailyLossLimit: 100, requireStopLoss: false, checklistRequired: true };
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'alerts', replayNotes: 'Keep until confirmed',
    paperLedger: { orders: [], positions: {}, realizedPnL: 0, riskPolicy: savedRisk },
    alerts: [{ id: 'protected-alert', symbol: 'AAPL', trigger: 1000000, direction: 'above', active: true, history: [] }] });
  const navigate = async name => {
    if (width < 900) await page.getByRole('button', { name: 'Open workspace navigation' }).click();
    await page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name, exact: true }).click();
  };
  const toggle = page.getByLabel('Enable background price alerts'); await expect(toggle).toBeEnabled(); await toggle.click(); await expect(toggle).toBeChecked();
  await evidence.paper.transact(user.id, { id: 'save-before-restore', kind: 'risk-policy', policy: savedRisk });
  await navigate('Settings'); await page.getByRole('tab', { name: 'Data & Connections', exact: true }).click();
  const input = page.getByLabel('Select workspace backup', { exact: true });
  const envelope = payload => JSON.stringify({ marker: 'sb-terminal-workspace-backup', version: 1, payload });
  await input.setInputFiles({ name: 'invalid-records.json', mimeType: 'application/json', buffer: Buffer.from(envelope({ journalEntries: [null], replayNotes: 'Do not apply' })) });
  await expect(page.getByRole('status').filter({ hasText: 'does not contain valid terminal data' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restore Selected', exact: true })).toHaveCount(0);
  expect(evidence.workspace().replayNotes).toBe('Keep until confirmed');
  const payload = { replayNotes: 'Reviewed import', journalEntries: [{ id: 'manual-import', symbol: 'AAPL', setup: 'Imported review', notes: 'A user-owned note', recordType: 'note' }],
    paperLedger: { authority: 'server-v1', positions: { AAPL: { qty: 999 } }, realizedPnL: 999999 }, orders: [{ id: 'bad' }], positions: { AAPL: { qty: 999 } }, realizedPnL: 999999,
    maxOrderValue: 0, riskPerTrade: 0, dailyLossLimit: 0,
    alerts: [{ id: 'backup-alert', symbol: 'TSLA', trigger: 1, active: true, direction: 'above', history: [] }], premiumPreferences: { notificationPreferences: { priceAlerts: false, soundAlerts: true } } };
  await input.setInputFiles({ name: 'legacy-account-backup.json', mimeType: 'application/json', buffer: Buffer.from(envelope(payload)) });
  const preview = page.getByLabel('Workspace restore preview');
  await expect(preview).toContainText('Journal records and draft'); await expect(preview).toContainText('protected account fields ignored');
  expect(evidence.workspace().replayNotes).toBe('Keep until confirmed');
  await page.screenshot({ path: testInfo.outputPath('restore-preview.png') });
  await page.getByRole('button', { name: 'Restore Selected', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'workspace fields restored' })).toBeVisible();
  await expect.poll(() => evidence.workspace().replayNotes).toBe('Reviewed import');
  expect((await evidence.paper.snapshot(user.id)).state.riskPolicy).toEqual(savedRisk);
  expect((await evidence.paper.snapshot(user.id)).state.positions).toEqual({});
  const alerts = await evidence.alertService.snapshot(user.id); expect(alerts.enabled).toBe(true); expect(alerts.paused).toBe(false);
  expect(alerts.alerts.map(rule => rule.id)).toEqual(['protected-alert']);
  await page.reload(); await page.getByRole('tab', { name: 'Data & Connections', exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export Backup', exact: true }).click();
  const stream = await (await pending).createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(exported.payload.replayNotes).toBe('Reviewed import'); expect(exported.payload.journalEntries[0].id).toBe('manual-import');
  for (const field of ['paperLedger', 'orders', 'positions', 'realizedPnL', 'maxOrderValue', 'riskPerTrade', 'dailyLossLimit', 'alerts']) expect(Object.hasOwn(exported.payload, field)).toBe(false);
  expect(exported.payload.premiumPreferences.notificationPreferences.priceAlerts).toBeUndefined();
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test('background alert creation recovers a committed lost response after reload without reactivation or duplicates', async ({ page }) => {
  await page.clock.install({ time: paperNow });
  const quotes = [paperProviderQuote(100, 'AAPL')];
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'alerts' }, { providerQuotes: quotes });
  const toggle = page.getByLabel('Enable background price alerts');
  await expect(toggle).toBeEnabled(); await toggle.click(); await expect(toggle).toBeChecked();
  const commands = []; let lose = true;
  await page.route('**/api/alerts/commands', async route => {
    const command = route.request().postDataJSON().command;
    if (command.kind !== 'upsert') return route.fallback();
    commands.push(command);
    const result = await evidence.alertService.transact(user.id, command);
    if (lose) { lose = false; return route.abort('failed'); }
    return route.fulfill({ json: result });
  });
  await page.getByLabel('Alert trigger price').fill('110');
  await page.getByRole('button', { name: /Create/ }).click();
  await expect.poll(() => commands.length).toBe(1);
  await expect(page.getByLabel('Alert trigger price')).toHaveValue('110');
  await expect.poll(async () => (await evidence.alertService.snapshot(user.id)).alerts.length).toBe(1);
  quotes[0] = paperProviderQuote(111, 'AAPL'); await evidence.alertService.tick();
  await page.reload();
  await expect.poll(() => commands.length).toBe(2);
  expect(commands[1]).toEqual(commands[0]);
  await expect(toggle).toBeChecked();
  const result = await evidence.alertService.snapshot(user.id);
  expect(result.alerts).toHaveLength(1); expect(result.alerts[0].active).toBe(false); expect(result.alerts[0].history).toHaveLength(1);
  expect(await page.evaluate(id => sessionStorage.getItem(`sb-alert-pending-v1:${id}`), user.id)).toBeNull();
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test('background alert validation rejection releases recovery state for a corrected rule', async ({ page }) => {
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'alerts' });
  const toggle = page.getByLabel('Enable background price alerts');
  await expect(toggle).toBeEnabled(); await toggle.click(); await expect(toggle).toBeChecked();
  let reject = true;
  await page.route('**/api/alerts/commands', async route => {
    if (route.request().postDataJSON().command.kind !== 'upsert' || !reject) return route.fallback();
    reject = false; return route.fulfill({ status: 400, json: { error: 'Test validation rejected this rule.' } });
  });
  await page.getByLabel('Alert trigger price').fill('110'); await page.getByRole('button', { name: /Create/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Test validation rejected this rule.' })).toBeVisible();
  expect(await page.evaluate(id => sessionStorage.getItem(`sb-alert-pending-v1:${id}`), user.id)).toBeNull();
  await page.getByLabel('Alert trigger price').fill('120'); await page.getByRole('button', { name: /Create/ }).click();
  await expect.poll(async () => (await evidence.alertService.snapshot(user.id)).alerts[0]?.trigger).toBe(120);
  await expect(page.getByLabel('Alert trigger price')).toHaveValue('');
  expect(evidence.errors).toEqual([]);
});

test('background monitoring pause failure retries on the polling cadence rather than on every error render', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-02T15:00:00Z') });
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'alerts' });
  const toggle = page.getByLabel('Enable background price alerts');
  await expect(toggle).toBeEnabled(); await toggle.click(); await expect(toggle).toBeChecked();
  const commands = []; let unavailable = true;
  await page.route('**/api/alerts/commands', async route => {
    const command = route.request().postDataJSON().command;
    if (command.kind !== 'pause') return route.fallback();
    commands.push(command);
    if (unavailable) return route.fulfill({ status: 503, json: { error: 'Test alert service unavailable.' } });
    return route.fallback();
  });
  await page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Notifications', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle price alert monitoring', exact: true }).click();
  await expect.poll(() => commands.length).toBe(1);
  await page.clock.runFor(2000); expect(commands).toHaveLength(1);
  unavailable = false; await page.clock.runFor(15000);
  await expect.poll(async () => (await evidence.alertService.snapshot(user.id)).paused).toBe(true);
  expect(commands).toHaveLength(2); expect(commands[1]).toEqual(commands[0]);
  expect(evidence.errors).toEqual([]);
});

test('background alerts keep a newer server revision when an older disable reply arrives late', async ({ page }) => {
  await page.clock.install({ time: paperNow });
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'alerts', alerts: [{ id: 'old-rule', symbol: 'AAPL', trigger: 110, direction: 'above', active: true, history: [] }] });
  const toggle = page.getByLabel('Enable background price alerts');
  await expect(toggle).toBeEnabled(); await toggle.click(); await expect(toggle).toBeChecked();
  let release, captured = false;
  const held = new Promise(resolve => { release = resolve; });
  // Reach the next poll while holding the reply for less than its 15-second timeout.
  await page.clock.runFor(12000);
  await page.route('**/api/alerts/commands', async route => {
    const command = route.request().postDataJSON().command;
    if (command.kind !== 'monitoring' || command.enabled) return route.fallback();
    const reply = await evidence.alertService.transact(user.id, command); captured = true;
    await held; return route.fulfill({ json: reply });
  });
  await toggle.click(); await expect.poll(() => captured).toBe(true);
  await evidence.alertService.transact(user.id, { id: 'another-device-enable', kind: 'monitoring', enabled: true, alerts: [{ id: 'new-rule', symbol: 'AAPL', trigger: 220, direction: 'above', active: true }] });
  await page.clock.runFor(4000);
  await expect(page.getByRole('row', { name: 'Select AAPL', exact: true })).toContainText('220');
  release();
  await expect.poll(() => page.evaluate(id => sessionStorage.getItem(`sb-alert-pending-v1:${id}`), user.id)).toBeNull();
  await expect(toggle).toBeEnabled(); await expect(toggle).toBeChecked();
  await expect(page.getByRole('row', { name: 'Select AAPL', exact: true })).toContainText('220');
  expect(await page.evaluate(id => sessionStorage.getItem(`sb-alert-pending-v1:${id}`), user.id)).toBeNull();
  expect(evidence.errors).toEqual([]);
});

test('background alerts retain server activity after reload, respect pause and permit edits', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(paperNow);
  const quotes = [paperProviderQuote(100, 'AAPL')];
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'alerts', selectedStock: 'AAPL', layoutMode: '1', alerts: [{ id: 'server-rule', symbol: 'AAPL', trigger: 110, direction: 'above', active: true, history: [] }] }, { providerQuotes: quotes });
  const toggle = page.getByLabel('Enable background price alerts'); await expect(toggle).toBeEnabled(); await toggle.click(); await expect(toggle).toBeChecked();
  await expect.poll(async () => (await evidence.alertService.snapshot(user.id)).enabled).toBe(true);
  quotes[0] = paperProviderQuote(111, 'AAPL'); await evidence.alertService.tick();
  await page.reload(); await page.getByRole('tab', { name: 'Triggered', exact: true }).click();
  await expect(page.getByRole('row', { name: 'Select AAPL', exact: true })).toContainText('Triggered');
  expect((await evidence.alertService.snapshot(user.id)).alerts[0].history).toHaveLength(1);
  await page.getByRole('row', { name: 'Select AAPL', exact: true }).click();
  await expect(page.getByText('AAPL triggered above', { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('background-alert.png') });
  await page.getByLabel('Alert trigger price').fill('200');
  await page.getByRole('button', { name: 'Update & Reactivate', exact: true }).click();
  await expect.poll(async () => (await evidence.alertService.snapshot(user.id)).alerts[0].trigger).toBe(200);
  expect((await evidence.alertService.snapshot(user.id)).alerts[0].history).toHaveLength(1);
  await page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Notifications', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle price alert monitoring', exact: true }).click();
  await expect.poll(async () => (await evidence.alertService.snapshot(user.id)).paused).toBe(true);
  await page.getByRole('button', { name: 'Notifications and alerts', exact: true }).click();
  await expect(page.getByText('Server monitoring is paused by your price-alert setting.', { exact: true })).toBeVisible();
  await toggle.click(); await expect(toggle).not.toBeChecked(); await expect.poll(async () => (await evidence.alertService.snapshot(user.id)).enabled).toBe(false);
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});
