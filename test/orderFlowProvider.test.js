import assert from 'node:assert/strict';
import test from 'node:test';
import { CME_ROOTS, resolveCmeContract, tickIndex } from '../src/modules/orderFlow/data/instruments.js';
import { normalizeEvent, sequence } from '../src/modules/orderFlow/data/events.js';
import { DepthBook } from '../src/modules/orderFlow/data/DepthBook.js';
import { CmeMarketDataProvider } from '../src/modules/orderFlow/data/CmeMarketDataProvider.js';
import { DevelopmentFeedHarness } from '../src/modules/orderFlow/data/DevelopmentFeedHarness.js';
import { NormalizedWebSocketTransport } from '../src/modules/orderFlow/data/NormalizedWebSocketTransport.js';
import { buildOrderFlowAnalysis, selectReplayBooks } from '../src/modules/orderFlow/data/analyticsPipeline.js';
import { DEFAULT_SETTINGS } from '../src/modules/orderFlow/analytics.js';
import { SequenceBuffer } from '../src/modules/orderFlow/data/SequenceBuffer.js';

const metadata = resolveCmeContract({ root: 'ES', contractId: 'fixture:ES:202612', expiry: '2026-12-18' });
function clock() {
  let time = Date.UTC(2026, 8, 29, 14), next = 0; const timers = new Map();
  return { now: () => time, setInterval: () => ++next, clearInterval: () => {}, setTimeout: (fn, ms) => { timers.set(++next, { fn, at: time + ms }); return next; }, clearTimeout: id => timers.delete(id),
    advance(ms) { time += ms; for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.fn(); } }, timers };
}
function setup(options = {}) {
  const time = clock(), transport = new DevelopmentFeedHarness(), provider = new CmeMarketDataProvider({ metadata, transport, clock: time, ...options });
  const event = (type, overrides = {}) => ({ version: 1, symbol: 'ES', contractId: metadata.contractId, epoch: 'epoch-1', type,
    timestampNs: `${BigInt(time.now()) * 1000000n}`, sequence: '1', ...overrides });
  const emit = raw => { transport.emit(raw); provider.pump(); };
  const boot = async () => { await provider.connect(); emit(event('session', { tradeSequence: '0', marketDataMode: 'realtime' })); emit(event('book-snapshot', { levels: [{ side: 'bid', price: 5800, size: 10 }, { side: 'ask', price: 5800.25, size: 20 }] })); };
  return { time, transport, provider, event, emit, boot };
}
test('CME metadata includes multipliers and requires an explicit valid expiring contract', () => {
  assert.deepEqual(Object.values(CME_ROOTS).map(m => m.contractMultiplier), [50, 20, 5, 2]);
  assert.ok(Object.values(CME_ROOTS).every(m => m.tickSize === 0.25 && m.pricePrecision === 2));
  assert.throws(() => resolveCmeContract({ root: 'ES', contractId: 'ES', expiry: '2026-12-18' }));
  assert.throws(() => resolveCmeContract({ root: 'ES', contractId: 'ESZ26', expiry: '2026-02-30' }));
  assert.throws(() => tickIndex(5800.1, metadata));
  assert.throws(() => new CmeMarketDataProvider({ symbol: 'NQ', metadata }));
  assert.throws(() => new CmeMarketDataProvider({ metadata: { ...metadata, contractMultiplier: 1 } }));
});
test('missing connector never opens or invents trades, depth, a timestamp or live status', async () => {
  const provider = new CmeMarketDataProvider(); await provider.connect(); const snapshot = provider.getSnapshot();
  assert.equal(snapshot.status, 'unavailable'); assert.equal(snapshot.simulated, false); assert.equal(snapshot.timestamp, null);
  assert.deepEqual(snapshot.trades, []); assert.deepEqual(snapshot.books, []); provider.disconnect();
});
test('disconnect before asynchronous open cancels the attempt', async () => {
  const h = setup(); const pending = h.provider.connect(); h.provider.disconnect(); await pending;
  assert.equal(h.transport.opens, 0); assert.equal(h.provider.getSnapshot().status, 'disconnected');
});
test('nanosecond replay excludes depth from later in the same millisecond', () => {
  const books = [{ timestamp: 100, timestampNs: '100000001' }, { timestamp: 100, timestampNs: '100000003' }];
  assert.equal(selectReplayBooks(books, { timestamp: 100, timestampNs: '100000002' }).length, 1);
  assert.deepEqual(selectReplayBooks(books, null), []);
  assert.equal(selectReplayBooks([{ timestamp: 99, validUntil: 200 }], { timestamp: 100 })[0].validUntil, undefined);
});
test('stale initial depth and one-sided books cannot claim live readiness', async () => {
  const h = setup(); await h.boot();
  h.emit(h.event('book-snapshot', { sequence: '2', timestampNs: `${BigInt(h.time.now() - 16000) * 1000000n}`, levels: [{ side: 'bid', price: 5800, size: 1 }, { side: 'ask', price: 5800.25, size: 1 }] }));
  assert.equal(h.provider.getSnapshot().status, 'synchronizing');
  h.emit(h.event('depth-update', { sequence: '3', changes: [{ side: 'bid', price: 5800, size: 0 }] }));
  assert.equal(h.provider.getSnapshot().status, 'degraded'); h.provider.disconnect();
});
test('normalized events preserve nanoseconds and large sequences, reject invalid data and keep unknown side', () => {
  const h = setup(), raw = h.event('trade', { tradeId: 't1', price: 5800, size: 2, side: 'unknown', sequence: '9007199254740993123', timestampNs: `${BigInt(h.time.now()) * 1000000n + 123n}` });
  const value = normalizeEvent(raw, metadata, h.time.now()); assert.equal(value.timestampNs, raw.timestampNs); assert.equal(value.sequence, raw.sequence); assert.equal(value.side, 'unknown');
  assert.throws(() => sequence(9007199254740992));
  for (const override of [{ contractId: 'other' }, { version: 2 }, { price: 5800.1 }, { size: -1 }, { side: 'guess' }, { timestampNs: '0' }, { timestampNs: `${BigInt(h.time.now() + 6000) * 1000000n}` }]) assert.throws(() => normalizeEvent({ ...raw, ...override }, metadata, h.time.now()));
});
test('book batches are atomic; zero removes a level and absent order counts remain absent', () => {
  const h = setup(), book = new DepthBook(metadata), snap = normalizeEvent(h.event('book-snapshot', { levels: [{ side: 'bid', price: 5800, size: 10 }, { side: 'ask', price: 5800.25, size: 20 }] }), metadata, h.time.now());
  const first = book.apply(snap); assert.equal(first.levels[0].askOrders, undefined);
  const invalid = { ...snap, type: 'depth-update', changes: [{ side: 'bid', price: 5800.5, size: 1 }] };
  assert.throws(() => book.apply(invalid)); assert.equal(book.sequence, '1'); assert.equal(book.bids.size, 1);
  const second = book.apply({ ...snap, type: 'depth-update', sequence: '2', changes: [{ side: 'bid', price: 5800, size: 0 }, { side: 'bid', price: 5799.75, size: 5 }] });
  assert.equal(second.bestBid, 5799.75); assert.equal(second.bestAsk, 5800.25);
});
test('socket/session alone cannot claim connected; only a synchronized book can', async () => {
  const h = setup(); await h.provider.connect(); assert.equal(h.provider.getSnapshot().status, 'connecting');
  h.emit(h.event('session', { tradeSequence: '0', marketDataMode: 'delayed' })); assert.equal(h.provider.getSnapshot().status, 'synchronizing');
  h.emit(h.event('book-snapshot', { levels: [{ side: 'bid', price: 5800, size: 1 }, { side: 'ask', price: 5800.25, size: 1 }] }));
  assert.equal(h.provider.getSnapshot().status, 'delayed'); h.provider.disconnect();
});
test('out-of-order depth updates buffer and drain in sequence without corrupting depth', async () => {
  const h = setup(); await h.boot();
  h.emit(h.event('depth-update', { sequence: '3', changes: [{ side: 'bid', price: 5800, size: 30 }] }));
  assert.equal(h.provider.getSnapshot().currentBook.levels.find(r => r.price === 5800).bidSize, 10);
  h.emit(h.event('depth-update', { sequence: '2', changes: [{ side: 'bid', price: 5800, size: 20 }] }));
  assert.equal(h.provider.getSnapshot().currentBook.levels.find(r => r.price === 5800).bidSize, 30);
  assert.equal(h.provider.getSnapshot().quality.bookSequence, '3'); h.provider.disconnect();
});
test('depth gaps quarantine DOM, bound buffers and reject stale recovery snapshots', async () => {
  const h = setup(); await h.boot();
  h.emit(h.event('depth-update', { sequence: '4', changes: [{ side: 'bid', price: 5800, size: 40 }] })); h.time.advance(251); h.provider.pump();
  assert.equal(h.provider.getSnapshot().status, 'degraded'); assert.equal(h.provider.getSnapshot().currentBook, null);
  assert.equal(h.transport.requests.at(-1).minimumSequence, '4');
  const levels = [{ side: 'bid', price: 5800, size: 44 }, { side: 'ask', price: 5800.25, size: 5 }];
  h.emit(h.event('book-snapshot', { sequence: '3', levels })); assert.equal(h.provider.getSnapshot().currentBook, null);
  h.emit(h.event('book-snapshot', { sequence: '4', levels })); assert.equal(h.provider.getSnapshot().status, 'connected');
  assert.equal(h.provider.getSnapshot().quality.complete, false); h.provider.disconnect();
});
test('trade deduplication and nanosecond sorting preserve actual volume', async () => {
  const h = setup(); await h.boot();
  const base = BigInt(h.time.now()) * 1000000n;
  h.emit(h.event('trade', { sequence: '2', tradeId: 'b', timestampNs: `${base + 2n}`, price: 5800, size: 3, side: 'buy' }));
  h.emit(h.event('trade', { sequence: '1', tradeId: 'a', timestampNs: `${base + 3n}`, price: 5800, size: 2, side: 'unknown' }));
  h.emit(h.event('trade', { sequence: '3', tradeId: 'a', timestampNs: `${base + 3n}`, price: 5800, size: 2, side: 'unknown' }));
  assert.deepEqual(h.provider.getSnapshot().trades.map(t => t.id), ['b', 'a']);
  const result = buildOrderFlowAnalysis({ trades: h.provider.getSnapshot().trades, tick: .25, timeframe: 60000, aggregation: 1, settings: DEFAULT_SETTINGS, simulated: false, quality: h.provider.getSnapshot().quality });
  assert.equal(result.flow.metrics.volume, 5); assert.equal(result.flow.metrics.unknown, 2); assert.equal(result.flow.metrics.delta, 3);
  assert.equal(result.quality.complete, false); assert.deepEqual(result.signals, []); h.provider.disconnect();
});
test('reconnect clears canonical depth, ignores old callbacks/epochs and cancels on manual disconnect', async () => {
  const h = setup(); await h.boot(); const old = h.transport.callbacks;
  h.transport.drop(); assert.equal(h.provider.getSnapshot().currentBook, null); assert.equal(h.time.timers.size, 1);
  h.time.advance(500); await Promise.resolve(); await Promise.resolve();
  old.onEvent(h.event('trade', { tradeId: 'stale', price: 5800, size: 10, side: 'buy' }));
  h.provider.pump(); assert.equal(h.provider.getSnapshot().trades.length, 0);
  h.emit(h.event('session', { epoch: 'epoch-2', tradeSequence: '0', marketDataMode: 'realtime' }));
  h.emit(h.event('trade', { tradeId: 'wrong-epoch', price: 5800, size: 10, side: 'buy' }));
  assert.equal(h.provider.getSnapshot().trades.length, 0); assert.equal(h.provider.getSnapshot().lifecycle[0].type, 'reconnect');
  h.provider.disconnect(); assert.equal(h.time.timers.size, 0);
});
test('silence and ingress overflow disconnect instead of silently dropping market events', async () => {
  for (const scenario of ['stale', 'overflow']) {
    const h = setup({ maxQueue: 2 }); await h.boot();
    if (scenario === 'stale') { h.time.advance(15001); h.provider.pump(); }
    else for (let i = 0; i < 3; i++) h.transport.emit(h.event('heartbeat'));
    assert.equal(h.provider.getSnapshot().status, 'disconnected'); assert.equal(h.provider.getSnapshot().quality.complete, false); assert.equal(h.provider.getSnapshot().currentBook, null); h.provider.disconnect();
  }
});
test('transport rejects cross-origin/insecure/credential URLs and oversized messages', async () => {
  for (const url of ['wss://other.example/feed', 'ws://sb.example/feed', 'wss://sb.example/feed?token=secret']) {
    const transport = new NormalizedWebSocketTransport({ url, origin: 'https://sb.example' }); assert.throws(() => transport.open({}));
  }
  class Socket { constructor() { Socket.last = this; this.readyState = 1; } close() {} send() {} }
  const transport = new NormalizedWebSocketTransport({ url: 'wss://sb.example/feed', origin: 'https://sb.example', WebSocketImpl: Socket });
  let errors = 0; const pending = transport.open({ onOpen() {}, onEvent() {}, onClose() {}, onError() { errors++; } });
  Socket.last.onopen(); await pending; Socket.last.onmessage({ data: 'x'.repeat(1000001) }); assert.equal(errors, 1); transport.close();
});
test('queue byte budget and pending sequence budgets stop oversized bursts', async () => {
  const h = setup({ maxQueuedBytes: 1024 }); await h.boot();
  h.transport.emit({ ...h.event('heartbeat'), padding: 'x'.repeat(1024) });
  assert.equal(h.provider.getSnapshot().status, 'disconnected'); h.provider.disconnect();
  let gap; const buffer = new SequenceBuffer({ apply() {}, onGap: info => { gap = info; }, maxBytes: 100 });
  buffer.seed('0'); buffer.push({ sequence: '2', data: 'x'.repeat(100) });
  assert.equal(gap.reason, 'buffer-overflow'); assert.equal(buffer.pending.size, 0); assert.equal(buffer.pendingBytes, 0);
});
test('trade retention/dedup storage is bounded and resync send failures reconnect safely', async () => {
  const h = setup({ maxTrades: 3 }); await h.boot();
  for (let i = 1; i <= 6; i++) h.emit(h.event('trade', { sequence: String(i), tradeId: `t-${i}`, price: 5800, size: 1, side: 'buy' }));
  assert.equal(h.provider.getSnapshot().trades.length, 3); assert.equal(h.provider.tradeIds.size, 3);
  h.transport.requestSnapshot = () => { throw new Error('socket closing'); };
  h.emit(h.event('depth-update', { sequence: '4', changes: [{ side: 'bid', price: 5800, size: 2 }] })); h.time.advance(251);
  assert.doesNotThrow(() => h.provider.pump()); assert.equal(h.provider.getSnapshot().status, 'disconnected'); h.provider.disconnect();
});
