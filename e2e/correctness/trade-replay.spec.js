import { test, expect } from '@playwright/test';
import { initialWorkspace, setupApp, user } from '../support/appHarness.js';

test('Journal trade replay uses dated history and reveals linked fills only as candles advance', async ({ page }) => {
  const now = Date.parse('2026-11-12T16:00:00Z');
  await page.clock.setFixedTime(now);
  const evidence = await setupApp(page, { ...initialWorkspace, activeWorkspace: 'journal', orders: [], positions: {} },
    { providerQuotes: [{ symbol: 'AAPL', price: 100, lastTradeTime: new Date(now).toISOString(), source: 'Test provider', realtime: true }] });
  for (const [id, side] of [['entry', 'BUY'], ['exit', 'SELL']]) {
    await evidence.paper.transact(user.id, { id, kind: 'submit', draft: { symbol: 'AAPL', side, quantity: 1, type: 'MARKET',
      ...(side === 'BUY' ? { stopLoss: 95, takeProfit: 110 } : {}) } });
  }
  let dated = false;
  await page.route('**/api/questrade/candles/AAPL?*', route => {
    const params = new URL(route.request().url()).searchParams;
    if (!params.has('start')) return route.fallback();
    dated = params.has('end');
    const timeframe = params.get('timeframe');
    return route.fulfill({ json: { symbol: 'AAPL', timeframe, source: 'Test history', quality: 'historical',
      candles: [-120,-60,0].map(delta => ({ time: now / 1000 + delta, open: 100, high: 101, low: 99, close: 100 })) } });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Replay this trade', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'AAPL · Trade Replay' })).toBeVisible();
  await expect(page.getByText('Original stop $95.00 · Original target $110.00')).toBeVisible();
  const canvas = page.locator('[data-chart-canvas]');
  const next = page.getByRole('button', { name: 'Next candle' });
  await expect(next).toBeEnabled();
  await expect(canvas).toHaveAttribute('data-marker-count', '0');
  await next.click();
  await next.click();
  await expect(canvas).toHaveAttribute('data-marker-count', '2');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-marker-count', '0');
  expect(dated).toBe(true);
  await page.getByRole('button', { name: 'Back to Journal' }).click();
  await expect(page.getByRole('button', { name: 'Replay this trade' })).toBeVisible();
  expect(evidence.errors).toEqual([]);
});
