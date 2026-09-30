import { tickIndex } from './instruments.js';
export class DepthBook {
  constructor(metadata, { maxLevels = 4000 } = {}) { this.metadata = metadata; this.maxLevels = maxLevels; this.clear(); }
  clear() { this.bids = new Map(); this.asks = new Map(); this.ready = false; this.sequence = null; this.timestampNs = null; this.epoch = null; }
  apply(event) {
    if (this.ready && this.epoch === event.epoch && this.timestampNs && event.timestampNs
      && BigInt(event.timestampNs) < BigInt(this.timestampNs)) throw new Error('Depth timestamp regressed within its sequence epoch.');
    const replacing = event.type === 'book-snapshot', bids = replacing ? new Map() : new Map(this.bids), asks = replacing ? new Map() : new Map(this.asks);
    const changes = new Map();
    for (const row of replacing ? event.levels : event.changes) {
      const key = tickIndex(row.price, this.metadata), map = row.side === 'bid' ? bids : asks, oldSize = map.get(key)?.size || 0;
      if (row.size) map.set(key, row); else map.delete(key);
      // Net size changes are not proof of cancellations or executions.
      changes.set(key, { added: Math.max(0, row.size - oldSize), pulled: Math.max(0, oldSize - row.size) });
    }
    if (bids.size + asks.size > this.maxLevels) throw new Error('Canonical book capacity exceeded.');
    const bestBidKey = bids.size ? Math.max(...bids.keys()) : null, bestAskKey = asks.size ? Math.min(...asks.keys()) : null;
    if (bestBidKey !== null && bestAskKey !== null && bestBidKey >= bestAskKey) throw new Error('Crossed or locked depth batch rejected atomically.');
    if (replacing && (!bids.size || !asks.size)) throw new Error('Two-sided initial depth snapshot required.');
    this.bids = bids; this.asks = asks; this.ready = true; this.sequence = event.sequence; this.timestampNs = event.timestampNs; this.epoch = event.epoch;
    const levels = [...new Set([...bids.keys(), ...asks.keys()])].sort((a, b) => b - a).map(key => {
      const bid = bids.get(key), ask = asks.get(key);
      return { price: Number((key * this.metadata.tickSize).toFixed(this.metadata.pricePrecision)), bidSize: bid?.size || 0, askSize: ask?.size || 0,
        ...(bid?.orders === undefined ? {} : { bidOrders: bid.orders }), ...(ask?.orders === undefined ? {} : { askOrders: ask.orders }),
        ...(changes.get(key) || { added: 0, pulled: 0 }) };
    });
    return { timestamp: event.timestamp, timestampNs: event.timestampNs, receivedAt: event.receivedAt, epoch: event.epoch, sequence: event.sequence, levels,
      bestBid: bestBidKey === null ? null : bestBidKey * this.metadata.tickSize, bestAsk: bestAskKey === null ? null : bestAskKey * this.metadata.tickSize };
  }
}
