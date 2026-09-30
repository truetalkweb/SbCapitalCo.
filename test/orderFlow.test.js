import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateFlow, DEFAULT_SETTINGS, detectSignals, inSession, INSTRUMENTS } from '../src/modules/orderFlow/analytics.js';
import { MockMarketDataProvider } from '../src/modules/orderFlow/MockMarketDataProvider.js';
const trade = (id, price, size, side, timestamp = id * 1000) => ({ id, price, size, side, timestamp });
test('custom UTC sessions handle boundaries, overnight windows and full days', () => {
  const at = (hour, minute = 0) => Date.UTC(2026, 8, 29, hour, minute);
  assert.equal(inSession(at(9, 30), '09:30', '16:00'), true);
  assert.equal(inSession(at(16), '09:30', '16:00'), false);
  assert.equal(inSession(at(23), '22:00', '02:00'), true);
  assert.equal(inSession(at(1), '22:00', '02:00'), true);
  assert.equal(inSession(at(12), '22:00', '02:00'), false);
  assert.equal(inSession(at(12), '00:00', '00:00'), true);
});

test('footprints conserve all volume and VWAP while delta counts only classified trades', () => {
  const trades = [trade(1, 100, 10, 'buy'), trade(2, 100.25, 20, 'sell'), trade(3, 100.5, 5, 'buy', 61000), trade(4, 100, 100, 'unknown')];
  for (const ticks of [1, 2, 4]) {
    const flow = aggregateFlow(trades, 0.25, 60000, ticks);
    assert.equal(flow.metrics.volume, 135); assert.equal(flow.metrics.delta, -5); assert.equal(flow.metrics.unknown, 100);
    assert.equal(flow.candles.reduce((n, c) => n + c.volume, 0), 135);
    assert.equal(flow.profile.reduce((n, r) => n + r.volume, 0), 135);
    assert.equal(flow.cumulative.at(-1).delta, -5);
    assert.equal(flow.metrics.vwap, (100 * 110 + 100.25 * 20 + 100.5 * 5) / 135);
    assert.equal(flow.metrics.openInterest, null);
  }
});
test('diagonal imbalance stacks require adjacent price levels and minimum volume', () => {
  const trades = [trade(1, 100, 10, 'sell'), trade(2, 100.25, 10, 'sell'), trade(3, 100.5, 10, 'sell'), trade(4, 100.25, 50, 'buy'), trade(5, 100.5, 50, 'buy'), trade(6, 100.75, 50, 'buy')];
  assert.equal(aggregateFlow(trades, 0.25, 60000, 1).candles[0].stackedBuy, true);
  assert.equal(aggregateFlow(trades, 0.25, 60000, 1, { ...DEFAULT_SETTINGS, minVolume: 100 }).candles[0].stackedBuy, false);
  const gapped = [trade(1, 100, 10, 'sell'), trade(2, 101, 50, 'buy'), trade(3, 102, 50, 'buy')];
  assert.equal(aggregateFlow(gapped, 0.25, 60000, 1).candles[0].stackedBuy, false);
});
test('POC is the highest volume level and value area expands from it to at least 70%', () => {
  const flow = aggregateFlow([trade(1, 100, 10, 'buy'), trade(2, 101, 60, 'sell'), trade(3, 102, 20, 'buy'), trade(4, 103, 10, 'buy')], 1, 60000, 1);
  assert.equal(flow.metrics.poc, 101); assert.equal(flow.metrics.valueLow, 101); assert.equal(flow.metrics.valueHigh, 102);
});
test('unknown-side trades retain actual volume and VWAP but cannot invent signed delta', () => {
  const flow = aggregateFlow([trade(1, 100, 10, 'unknown')], 0.25, 60000, 1);
  assert.equal(flow.metrics.vwap, 100); assert.equal(flow.metrics.poc, 100); assert.equal(flow.metrics.volume, 10);
  assert.equal(flow.metrics.delta, 0); assert.equal(flow.metrics.sideCoverage, 0);
  const empty = aggregateFlow([], 0.25, 60000, 1); assert.equal(empty.metrics.vwap, null); assert.deepEqual(detectSignals(empty, [], 0.25, DEFAULT_SETTINGS), []);
});
test('signal IDs remain unique and thresholds control large-trade candidates', () => {
  const trades = [trade(1, 100, 100, 'buy'), trade(2, 101, 100, 'sell')], flow = aggregateFlow(trades, 0.25, 60000, 1);
  const signals = detectSignals(flow, trades, 0.25, DEFAULT_SETTINGS);
  assert.ok(signals.some(s => s.type === 'Large Market Buy')); assert.ok(signals.every(s => s.simulated));
  assert.equal(new Set(signals.map(s => s.id)).size, signals.length);
  assert.equal(detectSignals(flow, trades, 0.25, { ...DEFAULT_SETTINGS, largeTrade: 1000 }).some(s => s.type.includes('Large Market')), false);
});
test('simulator is deterministic, tick-aligned, spread-valid and bounded', () => {
  const a = new MockMarketDataProvider(), b = new MockMarketDataProvider();
  assert.deepEqual(a.getSnapshot(), b.getSnapshot()); assert.equal(a.getSnapshot().simulated, true);
  for (let i = 0; i < 13000; i++) a.trade(); a.book(); a.publish();
  assert.ok(a.trades.length <= 12000); assert.ok(a.books.length <= 600);
  assert.ok(a.trades.every(t => Math.abs(t.price / INSTRUMENTS.ES.tick - Math.round(t.price / INSTRUMENTS.ES.tick)) < 0.00001));
  assert.equal(a.books.at(-1).bestAsk - a.books.at(-1).bestBid, 0.25);
});
test('provider connection publishes updates and disconnect stops its timer', async () => {
  const provider = new MockMarketDataProvider(); let updates = 0;
  const unsubscribe = provider.subscribe(() => updates++);
  await provider.connect(); const count = provider.trades.length;
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.ok(provider.trades.length > count); assert.ok(updates >= 2);
  provider.disconnect(); assert.equal(provider.timer, null); assert.equal(provider.getSnapshot().status, 'disconnected');
  unsubscribe(); assert.equal(provider.listeners.size, 0);
});
