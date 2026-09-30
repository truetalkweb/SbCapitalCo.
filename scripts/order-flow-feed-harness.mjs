import assert from 'node:assert/strict';
import { CmeMarketDataProvider } from '../src/modules/orderFlow/data/CmeMarketDataProvider.js';
import { DevelopmentFeedHarness } from '../src/modules/orderFlow/data/DevelopmentFeedHarness.js';
import { resolveCmeContract } from '../src/modules/orderFlow/data/instruments.js';
import { buildOrderFlowAnalysis } from '../src/modules/orderFlow/data/analyticsPipeline.js';
import { DEFAULT_SETTINGS } from '../src/modules/orderFlow/analytics.js';

// Explicit OFFLINE synthetic fixture. No socket, broker or vendor is contacted.
let time = Date.UTC(2026, 8, 29, 14);
const clock = { now: () => time, setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {} };
const metadata = resolveCmeContract({ root: 'ES', contractId: 'fixture:ES:202612', expiry: '2026-12-18' });
const transport = new DevelopmentFeedHarness(), provider = new CmeMarketDataProvider({ metadata, transport, clock, maxReconnects: 0 });
const event = (type, options) => ({ version: 1, type, epoch: 'offline-fixture', symbol: 'ES', contractId: metadata.contractId,
  timestampNs: String(BigInt(time) * 1000000n), ...options });
const emit = (type, options) => { transport.emit(event(type, options)); provider.pump(); };
try {
  await provider.connect(); emit('session', { tradeSequence: '0', marketDataMode: 'historical' });
  const levels = [{ side: 'bid', price: 5800, size: 10 }, { side: 'ask', price: 5800.25, size: 20 }];
  emit('book-snapshot', { sequence: '1', levels });
  emit('trade', { sequence: '2', tradeId: 'fixture-2', price: 5800, size: 3, side: 'unknown' });
  emit('trade', { sequence: '1', tradeId: 'fixture-1', price: 5800.25, size: 5, side: 'buy' });
  emit('depth-update', { sequence: '3', changes: [{ side: 'bid', price: 5800, size: 30 }] });
  time += 251; provider.pump(); assert.equal(provider.getSnapshot().currentBook, null);
  emit('book-snapshot', { sequence: '3', levels });
  const snapshot = provider.getSnapshot();
  const analysis = buildOrderFlowAnalysis({ trades: snapshot.trades, tick: metadata.tickSize, timeframe: 60000, aggregation: 1,
    settings: DEFAULT_SETTINGS, simulated: true, quality: snapshot.quality });
  assert.equal(analysis.flow.metrics.volume, 8); assert.equal(analysis.flow.metrics.unknown, 3); assert.deepEqual(analysis.signals, []);
  console.log(JSON.stringify({ offlineFixture: true, networkConnections: 0, fixtureState: snapshot.status, simulated: snapshot.simulated,
    observedVolume: analysis.flow.metrics.volume, unclassifiedVolume: analysis.flow.metrics.unknown,
    resyncRequests: transport.requests.filter(r => r.type === 'resync').length, complete: analysis.quality.complete, suppressedSignals: true }, null, 2));
} finally { provider.disconnect(); }
