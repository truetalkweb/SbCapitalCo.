import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { CmeMarketDataProvider } from '../src/modules/orderFlow/data/CmeMarketDataProvider.js';
import { DevelopmentFeedHarness } from '../src/modules/orderFlow/data/DevelopmentFeedHarness.js';
import { resolveCmeContract } from '../src/modules/orderFlow/data/instruments.js';
import { buildOrderFlowAnalysis, selectReplayBook, selectReplayBooks } from '../src/modules/orderFlow/data/analyticsPipeline.js';
import { DEFAULT_SETTINGS } from '../src/modules/orderFlow/analytics.js';

// Accelerated, explicitly OFFLINE fixtures. Measures local processing CPU and
// post-GC heap; it does not measure a vendor feed or promise live throughput.
const metadata = resolveCmeContract({ root: 'ES', contractId: 'fixture:ES:202612', expiry: '2026-12-18' });
function fixture() {
  let time = Date.UTC(2026, 8, 30, 14);
  const clock = { now: () => time, setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {} };
  const transport = new DevelopmentFeedHarness(), provider = new CmeMarketDataProvider({ metadata, transport, clock, maxReconnects: 0 });
  const event = (type, options = {}, ns = 0) => ({ version: 1, type, epoch: 'offline-stress', symbol: 'ES', contractId: metadata.contractId,
    timestampNs: String(BigInt(time) * 1000000n + BigInt(ns)), ...options });
  return { provider, transport, event, advance: ms => { time += ms; },
    async boot(count = 120) {
      await provider.connect(); transport.emit(event('session', { tradeSequence: '0', marketDataMode: 'historical' }));
      const levels = Array.from({ length: count }, (_, i) => ({ side: i < count / 2 ? 'bid' : 'ask',
        price: i < count / 2 ? 5800 - i * .25 : 5800.25 + (i - count / 2) * .25, size: 10 + i }));
      transport.emit(event('book-snapshot', { sequence: '1', levels })); provider.pump();
    } };
}
const rounded = value => Number(value.toFixed(3));
function timings(samples) {
  const sorted = samples.slice().sort((a, b) => a - b);
  const at = p => rounded(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0);
  return { samples: samples.length, p50Ms: at(.5), p95Ms: at(.95), p99Ms: at(.99), maxMs: at(1) };
}
function heap() { globalThis.gc?.(); return process.memoryUsage().heapUsed; }
function verifyAnalysis(snapshot) {
  const start = performance.now();
  const analysis = buildOrderFlowAnalysis({ trades: snapshot.trades, tick: .25, timeframe: 15000, aggregation: 2,
    settings: DEFAULT_SETTINGS, simulated: true, quality: snapshot.quality });
  const volume = snapshot.trades.reduce((n, t) => n + t.size, 0);
  const delta = snapshot.trades.reduce((n, t) => n + (t.side === 'buy' ? t.size : t.side === 'sell' ? -t.size : 0), 0);
  const weighted = snapshot.trades.reduce((n, t) => n + t.price * t.size, 0);
  assert.equal(analysis.flow.metrics.volume, volume); assert.equal(analysis.flow.metrics.delta, delta);
  assert.equal(analysis.flow.metrics.vwap, volume ? weighted / volume : null);
  assert.equal(analysis.flow.candles.reduce((n, candle) => n + candle.volume, 0), volume);
  assert.equal(analysis.flow.profile.reduce((n, row) => n + row.volume, 0), volume);
  assert.equal(analysis.flow.cumulative.at(-1)?.delta ?? 0, delta);
  return performance.now() - start;
}
async function streamScenario({ name, cycles, tradesPerCycle, depthPerCycle, advanceMs }) {
  const h = fixture(), pumpTimes = [], analysisTimes = [], retainedHeap = [];
  let sequence = 0, depthSequence = 1, duplicates = 0, maxQueue = 0, maxBytes = 0, maxLevels = 0;
  const heapStart = heap(), started = performance.now();
  try {
    await h.boot();
    for (let cycle = 0; cycle < cycles; cycle++) {
      h.advance(advanceMs);
      for (let i = 0; i < tradesPerCycle; i++) {
        const n = ++sequence;
        const raw = h.event('trade', { sequence: String(n), tradeId: `t-${n}`, price: 5800 + (n % 16) * .25,
          size: 1 + n % 7, side: n % 2 ? 'buy' : 'sell' }, i + 1);
        h.transport.emit(raw);
        if (i === 0 && cycle % 10 === 0) { h.transport.emit(raw); duplicates++; }
      }
      for (let i = 0; i < depthPerCycle; i++) h.transport.emit(h.event('depth-update', { sequence: String(++depthSequence),
        changes: [{ side: 'bid', price: 5800, size: depthSequence % 100 + 1 }] }, tradesPerCycle + i + 1));
      maxQueue = Math.max(maxQueue, h.provider.queue.length); maxBytes = Math.max(maxBytes, h.provider.queuedBytes);
      const at = performance.now(); h.provider.pump(); pumpTimes.push(performance.now() - at);
      const snapshot = h.provider.getSnapshot();
      assert.equal(snapshot.status, 'historical'); assert.equal(snapshot.simulated, true); assert.equal(snapshot.quality.complete, true);
      assert.equal(snapshot.trades.length, Math.min(sequence, 12000)); assert.equal(h.provider.tradeIds.size, snapshot.trades.length);
      assert.equal(snapshot.trades.at(-1).id, `t-${sequence}`); assert.equal(snapshot.quality.tradeSequence, String(sequence));
      assert.equal(snapshot.currentBook.sequence, String(depthSequence));
      assert.equal(snapshot.currentBook.levels.find(row => row.price === 5800).bidSize, depthSequence % 100 + 1);
      const levels = snapshot.books.reduce((n, book) => n + book.levels.length, 0); maxLevels = Math.max(maxLevels, levels);
      assert.ok(snapshot.books.length <= 600 && levels <= 120000);
      if (cycle % 100 === 0) { analysisTimes.push(verifyAnalysis(snapshot)); retainedHeap.push(heap()); }
    }
    const snapshot = h.provider.getSnapshot(); analysisTimes.push(verifyAnalysis(snapshot));
    assert.equal(snapshot.quality.duplicates, duplicates);
    assert.equal(snapshot.trades[0].id, `t-${Math.max(1, sequence - 11999)}`);
    for (let i = 1; i < snapshot.trades.length; i++) assert.ok(BigInt(snapshot.trades[i - 1].timestampNs) <= BigInt(snapshot.trades[i].timestampNs));
    for (const count of [1, 100, 1000, snapshot.trades.length]) {
      const trades = snapshot.trades.slice(0, count), cursor = trades.at(-1);
      verifyAnalysis({ ...snapshot, trades });
      const books = selectReplayBooks(snapshot.books, cursor);
      assert.ok(books.every(book => BigInt(book.timestampNs) <= BigInt(cursor.timestampNs)));
      const book = selectReplayBook(books, cursor);
      assert.ok(!book || BigInt(book.timestampNs) <= BigInt(cursor.timestampNs));
    }
    const retainedBytes = Buffer.byteLength(JSON.stringify(snapshot));
    const heapEnd = heap(), elapsedMs = performance.now() - started;
    return { name, virtualMinutes: cycles * advanceMs / 60000, inputEvents: sequence + cycles * depthPerCycle + duplicates + 2,
      wallTimeMs: rounded(elapsedMs), inputEventsPerWallSecond: Math.round((sequence + cycles * depthPerCycle + duplicates) / (elapsedMs / 1000)),
      pump: timings(pumpTimes), analytics: timings(analysisTimes), highWaterQueue: maxQueue, highWaterQueueBytes: maxBytes,
      retainedTrades: snapshot.trades.length, retainedBooks: snapshot.books.length, highWaterRetainedLevels: maxLevels,
      serializedSnapshotBytes: retainedBytes, postGcHeapStartBytes: heapStart, postGcHeapEndBytes: heapEnd,
      sampledPostGcHeapBytes: retainedHeap, duplicatesIgnored: duplicates, complete: snapshot.quality.complete, replayPrefixesVerified: 4 };
  } finally { h.provider.disconnect(); assert.equal(h.provider.queue.length, 0); assert.equal(h.provider.queuedBytes, 0); }
}
async function capacityScenario() {
  const h = fixture();
  try {
    await h.boot(4000);
    for (let i = 0; i < 80; i++) {
      h.advance(100); h.transport.emit(h.event('depth-update', { sequence: String(i + 2), changes: [{ side: 'bid', price: 5800, size: i + 1 }] })); h.provider.pump();
    }
    const retained = h.provider.getSnapshot();
    assert.equal(retained.books.length, 30); assert.equal(retained.books.reduce((n, b) => n + b.levels.length, 0), 120000);
    for (let i = 0; i < 4097; i++) h.transport.emit(h.event('heartbeat'));
    const overloaded = h.provider.getSnapshot();
    assert.equal(overloaded.status, 'error'); assert.equal(overloaded.currentBook, null); assert.equal(overloaded.quality.complete, false);
    assert.equal(h.provider.queue.length, 0); assert.equal(h.provider.queuedBytes, 0);
    return { canonicalLevels: 4000, retainedBooks: 30, retainedLevels: 120000, overflowEvents: 4097,
      overflowDisconnected: true, staleDepthQuarantined: true, overflowQueueReleased: true };
  } finally { h.provider.disconnect(); }
}
const report = { checkedAt: new Date().toISOString(), offlineFixture: true, networkConnections: 0, simulated: true,
  provenance: 'Accelerated historical test fixtures; not real CME data', node: process.version, platform: process.platform,
  cpu: os.cpus()[0]?.model, gcAvailable: Boolean(globalThis.gc), scenarios: [] };
for (const options of [
  { name: 'heavy-batched-stream', cycles: 1200, tradesPerCycle: 96, depthPerCycle: 4, advanceMs: 100 },
  { name: 'near-ingress-cycle-capacity', cycles: 240, tradesPerCycle: 960, depthPerCycle: 40, advanceMs: 100 },
  { name: 'three-hour-accelerated-soak', cycles: 1080, tradesPerCycle: 24, depthPerCycle: 1, advanceMs: 10000 },
]) {
  report.scenarios.push(await streamScenario(options)); console.log(`PASS ${options.name}: sequence, volume, delta, VWAP, replay and retention bounds`);
}
report.capacity = await capacityScenario(); console.log('PASS full-depth retention and overflow quarantine');
await fs.mkdir('artifacts/order-flow-stress', { recursive: true });
await fs.writeFile('artifacts/order-flow-stress/measurement.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
