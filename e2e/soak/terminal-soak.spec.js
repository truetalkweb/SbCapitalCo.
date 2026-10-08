import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { setupApp, initialWorkspace } from '../support/appHarness.js';
const names = ['Watchlist', 'Charts', 'Market Scanner', 'News & Calendar', 'Order Flow', 'Positions', 'Orders', 'Trade Journal', 'Performance', 'Risk Manager', 'Tools', 'Settings', 'Dashboard'];
test('ten-minute isolated browser soak switches all workspaces, recovers outages and measures retained resources', async ({ page }, info) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  const marketTime = Date.parse('2026-10-08T15:00Z'); await page.clock.setFixedTime(marketTime);
  await page.addInitScript(() => {
    const active = new Map(), start = window.setInterval.bind(window), clear = window.clearInterval.bind(window);
    window.setInterval = (handler, delay, ...args) => { const id = start(handler, delay, ...args); active.set(id, delay); return id; };
    window.clearInterval = id => { active.delete(id); return clear(id); };
    window.__qaIntervals = active; window.__qaLongTasks = [];
    new PerformanceObserver(list => { for (const entry of list.getEntries()) { window.__qaLongTasks.push(entry.duration); if (window.__qaLongTasks.length > 2000) window.__qaLongTasks.shift(); } }).observe({ type: 'longtask', buffered: true });
  });
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'dashboard', selectedStock: 'AAPL', layoutMode: '1', positions: {}, orders: [], journalEntries: [] },
    { baseUrl: 'http://127.0.0.1:4176', providerQuotes: [{ symbol: 'AAPL', price: 100, source: 'Isolated soak provider', timestamp: marketTime / 1000 }] });
  const nav = async name => name === 'Alerts' ? page.getByRole('button', { name: 'Notifications and alerts' }).click() : page.getByRole('navigation', { name: 'Terminal workspaces' }).getByRole('button', { name, exact: true }).click();
  for (const name of names) await nav(name); await nav('Alerts'); await nav('Dashboard');
  const cdp = await page.context().newCDPSession(page), samples = []; let switches = 15, offline = false, outageRecoveries = 0;
  await page.route('**/api/paper/account', route => offline ? route.abort('failed') : route.fallback());
  await page.route('**/api/questrade/quotes**', route => offline ? route.abort('failed') : route.fallback());
  const sample = async () => {
    await nav('Dashboard'); await expect(page.getByRole('region', { name: 'Order book', exact: true })).toBeVisible();
    await cdp.send('HeapProfiler.collectGarbage'); const heap = await cdp.send('Runtime.getHeapUsage');
    return { elapsedMs: Math.round(performance.now() - started), heapBytes: heap.usedSize,
      ...await page.evaluate(() => ({ domNodes: document.getElementsByTagName('*').length, canvases: document.querySelectorAll('canvas').length, intervals: [...window.__qaIntervals.values()], longTaskCount: window.__qaLongTasks.length, maxLongTaskMs: Math.max(0, ...window.__qaLongTasks) })) };
  };
  const started = performance.now(); samples.push(await sample()); let cycle = 0;
  while (performance.now() - started < 600000) {
    await nav('Order Flow'); switches++; await expect(page.getByLabel('Order flow mode')).toHaveValue('simulation');
    // Wall-clock observation: no clock fast-forward or synthetic timers.
    await new Promise(resolve => setTimeout(resolve, 20000));
    if (cycle % 5 === 0) { for (const name of names) { await nav(name); switches++; } await nav('Alerts'); switches++; }
    if ([5, 15].includes(cycle)) {
      await nav('Dashboard'); offline = true; await page.context().setOffline(true);
      await expect(page.getByRole('button', { name: 'Place Paper Buy', exact: true })).toBeDisabled({ timeout: 25000 });
      offline = false; await page.context().setOffline(false);
      await expect(page.getByRole('button', { name: 'Place Paper Buy', exact: true })).toBeEnabled({ timeout: 25000 });
      outageRecoveries++;
    }
    samples.push(await sample()); switches++; cycle++;
    expect(samples.at(-1).intervals.length).toBeLessThanOrEqual(samples[0].intervals.length + 1);
    expect(samples.at(-1).domNodes).toBeLessThanOrEqual(samples[0].domNodes + 40);
    if (cycle % 5 === 0) console.log(`SOAK ${cycle} samples / ${Math.round(samples.at(-1).elapsedMs / 1000)} wall seconds / ${switches} workspace switches`);
  }
  const last = samples.at(-1), baseline = samples[0];
  expect(last.heapBytes).toBeLessThan(baseline.heapBytes + 16 * 1024 * 1024);
  expect(evidence.workspace().paperLedger.orders).toHaveLength(0); expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
  expect(outageRecoveries).toBe(2);
  const report = JSON.stringify({ mode: 'Isolated provider and fixed market-date fixture; actual wall-clock duration, no live-feed claim', wallDurationMs: last.elapsedMs, switches, outageRecoveries, samples, errors: evidence.errors, blocked: evidence.blocked }, null, 2);
  await fs.writeFile(info.outputPath('ten-minute-soak.json'), report);
  await info.attach('ten-minute-soak.json', { contentType: 'application/json', body: report });
  await page.screenshot({ path: info.outputPath('soak-final-dashboard.png') });
});
