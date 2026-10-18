import { test, expect } from '@playwright/test';
import { setupApp, initialWorkspace } from '../support/appHarness.js';
for (const width of [390, 1536]) test(`scanner keeps partial provider coverage visible at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1024 });
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'scanner' }, { providerScanner: {
    source: 'Existing provider', degraded: true, cached: true, coverage: 'bounded-universe',
    coverageLabel: 'Configured symbols only; not market-wide rankings', warning: 'Provider plan limit active', warnings: ['Provider plan limit active'],
    updatedAt: new Date().toISOString(), gainers: [{ symbol: 'AAPL', price: 100, changePercent: 2, volume: 1000000 }],
  } });
  const notice = page.getByLabel('Scanner coverage').first(); await expect(notice).toBeVisible();
  await expect(notice).toContainText('Partial scanner coverage'); await expect(notice).toContainText('not full-market rankings');
  await expect(notice).toContainText('Cached snapshot');
  await page.getByLabel('Scanner sort').selectOption('symbol'); await expect(notice).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('coverage.png'), fullPage: true });
  expect(evidence.errors).toEqual([]); expect(evidence.blocked).toEqual([]);
});

test('pending news completes without a manual refresh or symbol change', async ({ page }) => {
  let ready = false;
  await page.route('**/api/news**', route => route.fulfill({ json: ready
    ? { source: 'Isolated provider', updatedAt: new Date().toISOString(), refreshing: false, news: Array.from({ length: 6 }, (_, i) => ({ id: `ready-${i}`, headline: `Confirmed result ${i}`, source: 'Isolated provider', relatedTicker: 'AAPL', url: `https://example.com/${i}`, timestamp: new Date().toISOString() })) }
    : { news: [], pending: true, refreshing: true, degraded: true, updatedAt: null, source: 'Unavailable' } }));
  await page.goto('/e2e/correctness/fixtures/news-lifecycle.html'); const output = page.getByLabel('News state');
  await expect(output).toContainText('"refreshing":true'); ready = true;
  await expect(output).toContainText('Confirmed result 0', { timeout: 15000 }); await expect(output).toContainText('"refreshing":false');
});

test('pending scanner completes without waiting for the five-minute refresh interval', async ({ page }) => {
  let ready = false;
  await page.route('**/api/scanner', route => route.fulfill({ json: ready
    ? { updatedAt: new Date().toISOString(), refreshing: false, gainers: [{ symbol: 'AAPL', price: 100, volume: 1000000, changePercent: 2 }] }
    : { gainers: [], refreshing: true, pending: true, updatedAt: null, degraded: true } }));
  await page.goto('/e2e/correctness/fixtures/news-lifecycle.html?scanner=1'); const output = page.getByLabel('Scanner state');
  await expect(output).toContainText('"refreshing":true'); await expect(output).toContainText('"updatedAt":null'); ready = true;
  await expect(output).toContainText('AAPL', { timeout: 15000 }); await expect(output).toContainText('"refreshing":false');
});
