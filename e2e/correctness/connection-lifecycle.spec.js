import { test, expect } from '@playwright/test';
const url = '/e2e/correctness/fixtures/connection-lifecycle.html';
const status = page => page.getByLabel('Connection status');
const quote = (symbol, delayed = false) => ({ delayed, quotes: [{ symbol, price: 100, source: 'Test provider', lastTradeTime: new Date().toISOString() }] });

test('delayed status persists between polls; outages back off and recover without invented quotes', async ({ page }) => {
  let calls = 0, failing = false;
  await page.clock.install();
  await page.route('**/api/questrade/quotes?**', route => { calls++; return route.fulfill(failing ? { status: 503, json: { error: 'Provider unavailable' } } : { json: quote('AAPL', true) }); });
  await page.goto(url); await expect(status(page)).toHaveText('DELAYED');
  await page.clock.runFor(5000); await expect(status(page)).toHaveText('DELAYED'); expect(calls).toBe(1);
  failing = true; await page.clock.runFor(5500); await expect(status(page)).toHaveText('RECONNECTING');
  const retained = await page.getByLabel('Received quotes').textContent();
  for (let i = 0; i < 4; i++) {
    await page.clock.fastForward(16000);
    await expect.poll(() => page.evaluate(() => window.connectionFixture.inspect().polling)).toBe(false);
    await expect(status(page)).toHaveText('RECONNECTING');
  }
  expect(await page.getByLabel('Received quotes').textContent()).toBe(retained);
  failing = false; await page.clock.fastForward(16000); await expect(status(page)).toHaveText('DELAYED');
  // Simulate a tab sleeping overnight. It resumes one poll rather than replaying missed prices.
  const beforeSleep = calls; await page.clock.fastForward(8 * 60 * 60 * 1000);
  await expect.poll(() => calls).toBe(beforeSleep + 1); await expect(status(page)).toHaveText('DELAYED');
  await page.evaluate(() => window.connectionFixture.disconnect());
  const stopped = calls; await page.clock.runFor(60000); expect(calls).toBe(stopped);
  expect(await page.evaluate(() => window.connectionFixture.inspect())).toEqual({ polling: false, timer: false, stream: false, watchdog: false });
});

test('hidden tabs abort active polling and resume a fresh request when visible', async ({ page }) => {
  let calls = 0, release; const held = new Promise(resolve => { release = resolve; });
  await page.route('**/api/questrade/quotes?**', async route => {
    if (++calls === 1) await held;
    await route.fulfill({ json: quote('AAPL') }).catch(() => {});
  });
  await page.goto(url); await expect.poll(() => calls).toBe(1);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  release(); await page.waitForTimeout(200); await expect(page.getByLabel('Received quotes')).toBeEmpty();
  expect(await page.evaluate(() => window.connectionFixture.inspect().polling)).toBe(false);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => calls).toBe(2); await expect(page.getByLabel('Received quotes')).toContainText('AAPL');
});

test('symbol changes cancel obsolete polling and online resumes immediately', async ({ page }) => {
  let release; const held = new Promise(resolve => { release = resolve; });
  let calls = 0;
  await page.route('**/api/questrade/quotes?**', async route => {
    calls++; const symbol = new URL(route.request().url()).searchParams.get('symbols');
    if (symbol === 'AAPL') await held;
    await route.fulfill({ json: quote(symbol) }).catch(() => {});
  });
  await page.goto(url); await expect.poll(() => calls).toBe(1);
  await page.evaluate(() => window.connectionFixture.select('TSLA'));
  await expect(page.getByLabel('Received quotes')).toContainText('TSLA'); release();
  await page.waitForTimeout(200); await expect(page.getByLabel('Received quotes')).not.toContainText('AAPL');
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); window.dispatchEvent(new Event('offline')); });
  await expect(status(page)).toHaveText('RECONNECTING'); const offlineCalls = calls;
  await page.waitForTimeout(200); expect(calls).toBe(offlineCalls);
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); window.dispatchEvent(new Event('online')); });
  await expect.poll(() => calls).toBe(offlineCalls + 1); await expect(status(page)).toHaveText('BACKEND');
});

test('silent SSE recovers via REST and closed stream callbacks cannot publish', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    window.streams = [];
    window.EventSource = class {
      constructor() { this.handlers = {}; window.streams.push(this); }
      addEventListener(name, callback) { this.handlers[name] = callback; }
      close() { this.closed = true; }
      emit(name, payload) { this.handlers[name]?.({ data: JSON.stringify(payload) }); }
    };
  });
  let calls = 0;
  await page.route('**/api/questrade/quotes?**', route => { calls++; return route.fulfill({ json: quote('TSLA') }); });
  await page.goto(`${url}?sse=1`); await page.clock.runFor(150);
  await page.evaluate(() => { window.streams[0].emit('open'); window.connectionFixture.select('TSLA'); });
  await page.clock.runFor(150);
  await page.evaluate(() => { window.streams[0].emit('quote', { quotes: [{ symbol: 'TSLA', price: 999 }] }); window.streams[0].emit('open'); });
  await expect(page.getByLabel('Received quotes')).toBeEmpty();
  await expect(status(page)).toHaveText('CONNECTING');
  await page.clock.runFor(45100); await expect.poll(() => calls).toBe(1);
  await expect(status(page)).toHaveText('BACKEND'); await expect(page.getByLabel('Received quotes')).toContainText('TSLA');
  await page.evaluate(() => window.connectionFixture.disconnect());
  await page.clock.runFor(60000); expect(calls).toBe(1);
  expect(await page.evaluate(() => window.connectionFixture.inspect())).toEqual({ polling: false, timer: false, stream: false, watchdog: false });
});
