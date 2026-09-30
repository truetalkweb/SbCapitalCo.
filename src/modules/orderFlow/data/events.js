import { tickIndex } from './instruments.js';
export const EVENT_VERSION = 1;
export function sequence(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('Unsafe numeric sequence. Use decimal strings.');
  const text = String(value);
  if (!/^\d{1,40}$/.test(text)) throw new Error('Invalid sequence.');
  return BigInt(text).toString();
}
function quantity(value, positive = false) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > 1000000000) throw new Error('Invalid contract quantity.');
  return value;
}
function level(raw, metadata) {
  if (!raw || !['bid', 'ask'].includes(raw.side)) throw new Error('Invalid depth side.');
  tickIndex(raw.price, metadata);
  return { side: raw.side, price: raw.price, size: quantity(raw.size), ...(raw.orders === undefined ? {} : { orders: quantity(raw.orders) }) };
}
/** The bridge protocol is normalized JSON, not a vendor's native wire format. */
export function normalizeEvent(raw, metadata, receivedAt, { maxLevels = 4000, maxFutureMs = 5000 } = {}) {
  if (!raw || raw.version !== EVENT_VERSION || raw.contractId !== metadata.contractId || raw.symbol !== metadata.root) throw new Error('Event version or instrument mismatch.');
  if (typeof raw.epoch !== 'string' || !raw.epoch.length || raw.epoch.length > 100) throw new Error('Missing connection epoch.');
  if (!/^\d{1,22}$/.test(raw.timestampNs || '')) throw new Error('Nanosecond exchange timestamp required as a decimal string.');
  const timestamp = Number(BigInt(raw.timestampNs) / 1000000n);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp > receivedAt + maxFutureMs) throw new Error('Invalid or future exchange timestamp.');
  const event = { version: EVENT_VERSION, contractId: metadata.contractId, symbol: metadata.root, epoch: raw.epoch,
    type: raw.type, timestampNs: raw.timestampNs, timestamp, receivedAt };
  if (raw.type === 'session') {
    if (!['realtime', 'delayed', 'historical'].includes(raw.marketDataMode)) throw new Error('Market data provenance required.');
    return { ...event, tradeSequence: sequence(raw.tradeSequence), marketDataMode: raw.marketDataMode };
  }
  if (raw.type === 'heartbeat') return event;
  const seq = sequence(raw.sequence);
  if (raw.type === 'trade') {
    tickIndex(raw.price, metadata);
    if (typeof raw.tradeId !== 'string' || !raw.tradeId.length || raw.tradeId.length > 150 || !['buy', 'sell', 'unknown'].includes(raw.side)) throw new Error('Trade identity/aggressor side required.');
    return { ...event, sequence: seq, tradeId: raw.tradeId, price: raw.price, size: quantity(raw.size, true), side: raw.side };
  }
  if (['book-snapshot', 'depth-update'].includes(raw.type)) {
    const rows = raw.type === 'book-snapshot' ? raw.levels : raw.changes;
    if (!Array.isArray(rows) || rows.length > maxLevels || (raw.type === 'depth-update' && !rows.length)) throw new Error('Depth payload limit/shape rejected.');
    const levels = rows.map(row => level(row, metadata)), keys = new Set();
    for (const row of levels) { const key = `${row.side}:${row.price}`; if (keys.has(key)) throw new Error('Duplicate depth price.'); keys.add(key); }
    return { ...event, sequence: seq, ...(raw.type === 'book-snapshot' ? { levels } : { changes: levels }) };
  }
  throw new Error('Unsupported market event.');
}
