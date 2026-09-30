import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseOrderFlowRecording, RECORDING_LIMITS } from '../src/modules/orderFlow/data/recordingImport.js';
import { LocalRecordingProvider } from '../src/modules/orderFlow/data/LocalRecordingProvider.js';
import { selectReplayBook, buildOrderFlowAnalysis } from '../src/modules/orderFlow/data/analyticsPipeline.js';
import { DEFAULT_SETTINGS } from '../src/modules/orderFlow/analytics.js';
const example = JSON.parse(fs.readFileSync(new URL('../public/order-flow-recording-example.json', import.meta.url), 'utf8'));
const now = Date.parse('2026-10-01T00:00:00Z');
const fresh = () => structuredClone(example);
const parse = value => parseOrderFlowRecording(JSON.stringify(value), { now, name: 'recording.json' });

test('local recording preserves contract metadata, nanoseconds and declared unverified provenance', () => {
 const data = parse(fresh());
 assert.equal(data.status, 'historical'); assert.equal(data.simulated, true); assert.equal(data.metadata.contractMultiplier, 50);
 assert.equal(data.recording.sourceVerified, false); assert.equal(data.recording.sessionOnly, true);
 assert.equal(data.trades.length, 3); assert.equal(data.books.length, 2);
 assert.equal(data.trades[0].timestampNs, example.events[2].timestampNs);
 const value = fresh(); value.provenance = 'historical'; assert.equal(parse(value).simulated, false);
});
test('replay selects only depth available at the exact trade timestamp and conserves unknown volume', () => {
 const data = parse(fresh());
 assert.equal(selectReplayBook(data.books, data.trades[0]).sequence, '1');
 assert.equal(selectReplayBook(data.books, data.trades[1]).sequence, '2');
 for (let n = 1; n <= 3; n++) {
  const result = buildOrderFlowAnalysis({ trades: data.trades.slice(0, n), tick: .25, timeframe: 60000, aggregation: 1,
   settings: DEFAULT_SETTINGS, simulated: data.simulated, quality: data.quality });
  assert.equal(result.flow.metrics.volume, [3, 5, 6][n - 1]); assert.equal(result.flow.metrics.delta, [3, 1, 1][n - 1]);
  if (n === 3) { assert.equal(result.flow.metrics.unknown, 1); assert.equal(result.quality.complete, false); assert.deepEqual(result.signals, []); }
 }
});
test('trade-only recordings replay without manufacturing depth or open interest', () => {
 const value = fresh(); value.events = value.events.filter(event => !['book-snapshot', 'depth-update'].includes(event.type));
 const data = parse(value); assert.deepEqual(data.books, []); assert.equal(data.currentBook, null); assert.equal(data.openInterest, null);
 assert.equal(selectReplayBook(data.books, data.trades.at(-1)), null);
});
test('unsupported schema, provenance, roots and mismatched contract specifications are rejected', () => {
 for (const change of [value => value.version = 2, value => value.format = 'vendor-export', value => value.provenance = 'live',
  value => value.source = '', value => value.source = 'x'.repeat(161), value => value.instrument.root = 'constructor',
  value => value.instrument.contractId = 'ES', value => value.instrument.expiry = '2026-02-30',
  value => value.instrument.tickSize = .01, value => value.instrument.pricePrecision = 4, value => value.instrument.contractMultiplier = 5]) {
  const value = fresh(); change(value); assert.throws(() => parse(value));
 }
 assert.throws(() => parseOrderFlowRecording('{bad}'), /valid JSON/);
 const value = fresh(); assert.ok(parseOrderFlowRecording('\uFEFF' + JSON.stringify(value), { now }));
});
test('invalid, future or imprecise timestamps and unsorted event timelines fail with event numbers', () => {
 for (const timestampNs of [0, Number(example.events[2].timestampNs), 'invalid', String(BigInt(now + 1) * 1000000n)]) {
  const value = fresh(); value.events[2].timestampNs = timestampNs; assert.throws(() => parse(value), /Event 3:/);
 }
 const value = fresh(); [value.events[2], value.events[4]] = [value.events[4], value.events[2]];
 assert.throws(() => parse(value), /Event 3:/);
});
test('trade/depth discontinuities, duplicate IDs and mixed epochs are rejected without invented recovery', () => {
 for (const change of [value => value.events[2].sequence = '2', value => value.events[4].sequence = '1',
  value => value.events[4].tradeId = value.events[2].tradeId, value => value.events[3].sequence = '3',
  value => value.events[2].epoch = 'different', value => value.events[0].marketDataMode = 'realtime',
  value => value.events[2].contractId = 'another-contract']) {
  const value = fresh(); change(value); assert.throws(() => parse(value), /Event \d+:/);
 }
});
test('depth baseline, crossed books, off-tick trades and invalid quantities cannot enter analytics', () => {
 for (const change of [value => value.events.splice(1, 1), value => value.events[1].levels[0].price = 5801,
  value => value.events[2].price = 5800.1, value => value.events[2].size = -1, value => value.events[2].size = 1.5,
  value => value.events[2].side = 'guessed', value => value.events[1].levels.push({ ...value.events[1].levels[0] })]) {
  const value = fresh(); change(value); assert.throws(() => parse(value));
 }
 const empty = fresh(); empty.events = empty.events.filter(event => event.type !== 'trade'); assert.throws(() => parse(empty), /at least one trade/);
});
test('file/event budgets reject excess before importing a partial recording', () => {
 assert.throws(() => parseOrderFlowRecording(' '.repeat(RECORDING_LIMITS.bytes + 1)), /8 MiB/);
 const events = fresh(); events.events = Array(20001).fill({}); assert.throws(() => parse(events), /20,000/);
 const trades = fresh(); trades.events = [trades.events[0], ...Array.from({ length: 12001 }, (_, i) => ({ ...example.events[2], sequence: String(i + 1), tradeId: `t-${i}` }))];
 assert.throws(() => parse(trades), /12,000 trades/);
});
test('expanded depth history is bounded even when tiny updates would grow the archive', () => {
 const value = fresh(), start = value.events[0], snap = value.events[1];
 snap.levels = Array.from({ length: 4000 }, (_, i) => ({ side: i < 2000 ? 'bid' : 'ask',
  price: i < 2000 ? 5800 - i * .25 : 5800.25 + (i - 2000) * .25, size: 10 }));
 value.events = [start, snap, ...Array.from({ length: 30 }, (_, i) => ({ ...example.events[3], sequence: String(i + 2) })),
  { ...example.events[2], timestampNs: example.events[5].timestampNs }];
 assert.throws(() => parse(value), /120,000 levels/);
 const books = fresh(); books.events = [books.events[0], books.events[1],
  ...Array.from({ length: 600 }, (_, i) => ({ ...example.events[3], sequence: String(i + 2) })),
  { ...example.events[2], timestampNs: example.events[5].timestampNs }];
 assert.throws(() => parse(books), /600 states/);
});
test('local provider remains historical and read-only through connect, pause and subscription cleanup', async () => {
 const provider = new LocalRecordingProvider(parse(fresh())), snapshot = provider.getSnapshot();
 const unsubscribe = provider.subscribe(() => assert.fail('No live events should be published.'));
 await provider.connect(); provider.disconnect(); provider.unsubscribe('ES'); unsubscribe();
 assert.equal(provider.getSnapshot(), snapshot); assert.equal(snapshot.status, 'historical');
 assert.throws(() => provider.subscribeTrades('NQ'), /contract cannot be changed/);
 provider.subscribeOrderBook('ES');
});
