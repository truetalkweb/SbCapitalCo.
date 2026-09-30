import { test, expect } from '@playwright/test';
const article = (headline, symbol = 'AAPL') => ({ id: headline, headline, relatedTicker: symbol, source: 'Test provider', url: `https://example.com/${headline}`, timestamp: new Date().toISOString() });
const payload = headline => ({ news: Array.from({ length: 6 }, (_, i) => article(`${headline}-${i}`)) });
const state = page => page.getByLabel('News state');

test('news without feed timestamp stays freshness unknown despite a claimed live label', async ({ page }) => {
  await page.route('**/api/news/**', route => route.fulfill({ json: { ...payload('Current'), statusLabel: 'NEWS LIVE' } }));
  await page.goto('/e2e/correctness/fixtures/news-lifecycle.html');
  await expect(state(page)).toContainText('NEWS FRESHNESS UNKNOWN');
  await expect(state(page)).toContainText('"updatedAt":null');
});
test('a manual news refresh for a previous symbol cannot replace the new symbol feed', async ({ page }) => {
  let calls = 0, delayed;
  const started = new Promise(resolve => delayed = resolve);
  await page.route('**/api/news/**', async route => {
    if (route.request().url().includes('/TSLA')) return route.fulfill({ json: payload('TSLA') });
    if (++calls === 2) { delayed(); await new Promise(resolve => setTimeout(resolve, 500)); }
    await route.fulfill({ json: payload(calls === 1 ? 'Initial' : 'Obsolete') }).catch(() => {});
  });
  await page.goto('/e2e/correctness/fixtures/news-lifecycle.html');
  await expect(state(page)).toContainText('Initial-0');
  await page.getByRole('button', { name: 'Refresh news' }).click(); await started;
  await page.getByRole('button', { name: 'Select TSLA' }).click();
  await expect(state(page)).toContainText('TSLA-0');
  await page.waitForTimeout(700);
  await expect(state(page)).not.toContainText('Obsolete');
  await expect(state(page)).toContainText('"loading":false');
});
test('overlapping manual news refreshes keep the latest result and loading state', async ({ page }) => {
  let calls = 0, delayed; const started = new Promise(resolve => delayed = resolve);
  await page.route('**/api/news/**', async route => {
    const index = ++calls;
    if (index === 2) { delayed(); await new Promise(resolve => setTimeout(resolve, 500)); }
    await route.fulfill({ json: payload(index === 1 ? 'Initial' : index === 2 ? 'Older' : 'Newest') }).catch(() => {});
  });
  await page.goto('/e2e/correctness/fixtures/news-lifecycle.html'); await expect(state(page)).toContainText('Initial-0');
  await page.getByRole('button', { name: 'Refresh news' }).click(); await started;
  await page.getByRole('button', { name: 'Refresh news' }).click(); await expect(state(page)).toContainText('Newest-0');
  await page.waitForTimeout(700); await expect(state(page)).not.toContainText('Older');
  await expect(state(page)).toContainText('"loading":false');
});

test('overlapping scanner refreshes cannot replace newer rows or mark them degraded', async ({ page }) => {
  let calls = 0, delayed; const started = new Promise(resolve => delayed = resolve);
  await page.route('**/api/scanner', async route => {
    const index = ++calls;
    if (index === 2) { delayed(); await new Promise(resolve => setTimeout(resolve, 500)); }
    await route.fulfill(index === 2 ? { status: 503, json: { error: 'Older request failed' } } : { json: {
      gainers: [{ symbol: index === 1 ? 'AAPL' : 'NVDA', price: 100, changePercent: 2, volume: 10000 }], updatedAt: new Date().toISOString() } }).catch(() => {});
  });
  await page.goto('/e2e/correctness/fixtures/news-lifecycle.html?scanner=1');
  const output = page.getByLabel('Scanner state'); await expect(output).toContainText('AAPL');
  await page.getByRole('button', { name: 'Refresh scanner' }).click(); await started;
  await page.getByRole('button', { name: 'Refresh scanner' }).click(); await expect(output).toContainText('NVDA');
  await page.waitForTimeout(700); await expect(output).not.toContainText('latest scanner refresh failed');
  await expect(output).toContainText('"loading":false'); await expect(output).toContainText('"degraded":false');
});

test('a current scanner failure keeps last verified rows as cached degraded data', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/scanner', route => route.fulfill(++calls === 1 ? { json: {
    gainers: [{ symbol: 'AAPL', price: 100, changePercent: 2, volume: 10000 }], updatedAt: new Date().toISOString() } } : { status: 503, json: { error: 'Unavailable' } }));
  await page.goto('/e2e/correctness/fixtures/news-lifecycle.html?scanner=1');
  const output = page.getByLabel('Scanner state'); await expect(output).toContainText('AAPL');
  await page.getByRole('button', { name: 'Refresh scanner' }).click();
  await expect(output).toContainText('latest scanner refresh failed'); await expect(output).toContainText('AAPL');
  await expect(output).toContainText('"cached":true'); await expect(output).toContainText('"loading":false');
});
