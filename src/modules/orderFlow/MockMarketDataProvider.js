import { INSTRUMENTS } from './analytics.js';
import { CME_ROOTS } from './data/instruments.js';

/** @implements {import('./types').MarketDataProvider} */
export class MockMarketDataProvider {
  constructor({ symbol = 'ES', seed = 17, startTime = Date.UTC(2026, 8, 29, 13, 30) } = {}) {
    this.symbol = symbol; this.seed = seed; this.time = startTime; this.listeners = new Set(); this.timer = null;
    this.trades = []; this.books = []; this.sequence = 0; this.tickIndex = Math.round(INSTRUMENTS[symbol].base / INSTRUMENTS[symbol].tick);
    for (let i = 0; i < 2400; i++) this.trade();
    this.book(); this.publish('disconnected');
  }
  random() { this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0; return this.seed / 4294967296; }
  trade() {
    const { tick } = INSTRUMENTS[this.symbol];
    const r = this.random(), move = r < 0.28 ? -1 : r > 0.72 ? 1 : 0;
    this.tickIndex += move; this.time += 350 + Math.round(this.random() * 650);
    const side = move > 0 ? 'buy' : move < 0 ? 'sell' : this.random() > 0.5 ? 'buy' : 'sell';
    const size = this.random() > 0.96 ? 80 + Math.floor(this.random() * 180) : 1 + Math.floor(this.random() * 24);
    this.trades.push({ id: ++this.sequence, timestamp: this.time, price: Number((this.tickIndex * tick).toFixed(8)), size, side });
    if (this.sequence % 20 === 0) this.book();
    if (this.trades.length > 12000) this.trades.splice(0, this.trades.length - 12000);
  }
  book() {
    const tick = INSTRUMENTS[this.symbol].tick, old = new Map((this.books.at(-1)?.levels || []).map(row => [row.price, row]));
    const last = this.trades.at(-1), bid = this.tickIndex - (last?.side === 'buy' ? 1 : 0), ask = bid + 1;
    const levels = [];
    for (let offset = -32; offset <= 32; offset++) {
      const index = bid + offset, price = Number((index * tick).toFixed(8)), prior = old.get(price);
      const size = Math.round(30 + this.random() * 200 + (index % 8 === 0 ? 300 : 0));
      const total = (prior?.bidSize || 0) + (prior?.askSize || 0), difference = size - total;
      levels.push({ price, bidSize: index <= bid ? size : 0, askSize: index >= ask ? size : 0,
        bidOrders: index <= bid ? Math.max(1, Math.round(size / 12)) : 0, askOrders: index >= ask ? Math.max(1, Math.round(size / 12)) : 0,
        added: total ? Math.max(0, difference) : size, pulled: total ? Math.max(0, -difference) : 0 });
    }
    this.books.push({ timestamp: this.time, bestBid: Number((bid * tick).toFixed(8)), bestAsk: Number((ask * tick).toFixed(8)), levels });
    if (this.books.length > 600) this.books.shift();
  }
  publish(status = 'connected') {
    this.snapshot = { symbol: this.symbol, trades: this.trades.slice(), books: this.books.slice(), timestamp: this.time,
      simulated: true, source: 'Simulator', metadata: CME_ROOTS[this.symbol] || null, status, openInterest: null };
    for (const listener of this.listeners) listener();
  }
  async connect() { if (this.timer) return; this.publish(); this.timer = setInterval(() => { for (let i = 0; i < 4; i++) this.trade(); this.book(); this.publish(); }, 250); }
  disconnect() { clearInterval(this.timer); this.timer = null; this.publish('disconnected'); }
  subscribeTrades(symbol) { if (symbol !== this.symbol) throw new Error('Create a provider instance for the requested symbol.'); }
  subscribeOrderBook(symbol) { this.subscribeTrades(symbol); }
  unsubscribe(symbol) { if (symbol === this.symbol) this.disconnect(); }
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.snapshot;
}
