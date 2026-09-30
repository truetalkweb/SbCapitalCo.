import { CME_ROOTS, resolveCmeContract } from './instruments.js';
import { normalizeEvent } from './events.js';
import { DepthBook } from './DepthBook.js';

export const RECORDING_LIMITS = Object.freeze({ bytes: 8 * 1024 * 1024, events: 20000, trades: 12000, books: 600, levels: 120000 });
const fail = message => { throw new Error(message); };
const hasControl = value => [...value].some(character => character.charCodeAt(0) < 32);
export function parseOrderFlowRecording(text, { now = Date.now(), name = 'Local recording.json' } = {}) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > RECORDING_LIMITS.bytes) fail('Recording exceeds the 8 MiB file limit. Import a smaller segment.');
  let input;
  try { input = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { fail('Recording is not valid JSON.'); }
  if (!input || input.format !== 'sb-order-flow-recording' || input.version !== 1) fail('Use the SBCapitalCo recording JSON format, version 1. Download the format example in settings.');
  if (!['historical', 'simulated'].includes(input.provenance)) fail('Declare recording provenance as historical or simulated.');
  if (typeof input.source !== 'string' || !input.source.trim() || input.source.length > 160 || hasControl(input.source)) fail('A source label of 1–160 characters is required.');
  const supplied = input.instrument;
  if (!supplied || !Object.hasOwn(CME_ROOTS, supplied.root)) fail('Recording must identify an ES, NQ, MES or MNQ contract.');
  const metadata = resolveCmeContract(supplied);
  for (const key of ['tickSize', 'pricePrecision', 'contractMultiplier']) if (supplied[key] !== metadata[key]) fail(`Recording ${key} does not match ${metadata.root}.`);
  if (!Array.isArray(input.events) || !input.events.length || input.events.length > RECORDING_LIMITS.events) fail('Recording must contain 1–20,000 normalized events.');
  const trades = [], books = [], tradeIds = new Set(), book = new DepthBook(metadata);
  let epoch = null, previousTime = null, tradeSequence = null, depthSequence = null, retainedLevels = 0;
  for (let index = 0; index < input.events.length; index++) {
    try {
      const event = normalizeEvent(input.events[index], metadata, now, { maxFutureMs: 0 });
      const timestampNs = BigInt(event.timestampNs);
      if (previousTime !== null && timestampNs < previousTime) fail('Events must be ordered by exchange nanosecond timestamp.');
      previousTime = timestampNs;
      if (index === 0) {
        if (event.type !== 'session' || event.marketDataMode !== 'historical') fail('First event must be a historical session baseline.');
        epoch = event.epoch; tradeSequence = BigInt(event.tradeSequence); continue;
      }
      if (event.type === 'session' || event.epoch !== epoch) fail('Import one continuous epoch at a time; split reconnects into separate files.');
      if (event.type === 'heartbeat') continue;
      const seq = BigInt(event.sequence);
      if (event.type === 'trade') {
        if (seq !== tradeSequence + 1n) fail('Trade sequence gap or duplicate. Import a continuous segment with the correct baseline.');
        if (tradeIds.has(event.tradeId)) fail('Duplicate trade ID.');
        if (trades.length >= RECORDING_LIMITS.trades) fail('Recording exceeds 12,000 trades. Import a smaller segment.');
        tradeSequence = seq; tradeIds.add(event.tradeId);
        trades.push({ id: event.tradeId, timestamp: event.timestamp, timestampNs: event.timestampNs, sequence: event.sequence, epoch,
          price: event.price, size: event.size, side: event.side });
      } else {
        if (depthSequence === null && event.type !== 'book-snapshot') fail('A depth snapshot is required before incremental updates.');
        if (depthSequence !== null && seq !== depthSequence + 1n) fail('Depth sequence gap or duplicate. Import a continuous segment.');
        const snapshot = book.apply(event);
        if (books.length >= RECORDING_LIMITS.books || retainedLevels + snapshot.levels.length > RECORDING_LIMITS.levels) fail('Expanded depth history exceeds 600 states or 120,000 levels. Import a smaller segment.');
        depthSequence = seq; retainedLevels += snapshot.levels.length; books.push(snapshot);
      }
    } catch (error) { fail(`Event ${index + 1}: ${error.message}`); }
  }
  if (!trades.length) fail('Recording needs at least one trade for footprint and replay. Trade-only files are supported.');
  const safeName = [...String(name)].filter(character => !hasControl(character)).join('').slice(0, 160) || 'Local recording.json';
  return { symbol: metadata.root, metadata, trades, books, currentBook: null, timestamp: trades.at(-1).timestamp,
    simulated: input.provenance === 'simulated', source: input.source.trim(), marketDataMode: 'historical', status: 'historical', openInterest: null,
    recording: { name: safeName, provenance: input.provenance, sourceVerified: false, eventCount: input.events.length, depthStates: books.length, sessionOnly: true },
    message: 'Local historical replay · declared source is unverified · execution disabled.',
    quality: { complete: true, gaps: [], bookValid: false, rejected: 0, duplicates: 0, retainedTrades: trades.length,
      tradeSequence: tradeSequence.toString(), bookSequence: depthSequence?.toString() || null } };
}
