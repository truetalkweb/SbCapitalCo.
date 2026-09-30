import { CME_ROOTS, resolveCmeContract } from './instruments.js';
import { normalizeEvent, sequence } from './events.js';
import { SequenceBuffer } from './SequenceBuffer.js';
import { DepthBook } from './DepthBook.js';
const defaultClock = { now: Date.now, setInterval: (fn, ms) => setInterval(fn, ms), clearInterval: id => clearInterval(id),
  setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: id => clearTimeout(id) };

/** Adapter for an authenticated server-side CME connector's normalized events.
 * No native vendor SDK, credentials, or fictitious live feed are installed here.
 */
export class CmeMarketDataProvider {
  constructor({ symbol = 'ES', metadata = CME_ROOTS[symbol], transport = null, clock = defaultClock,
    publishMs = 100, maxQueue = 4096, maxQueuedBytes = 4194304, maxTrades = 12000, maxBooks = 600, staleMs = 15000, maxReconnects = 5 } = {}) {
    const spec = CME_ROOTS[symbol];
    if (!spec || !metadata || metadata.root !== symbol || ['tickSize', 'pricePrecision', 'contractMultiplier'].some(key => metadata[key] !== spec[key])) throw new Error('Contract metadata does not match its CME root.');
    if (metadata.contractId) metadata = resolveCmeContract({ root: symbol, contractId: metadata.contractId, expiry: metadata.expiry });
    for (const [value, min, max] of [[publishMs, 16, 1000], [maxQueue, 1, 4096], [maxQueuedBytes, 64, 4194304], [maxTrades, 1, 12000], [maxBooks, 1, 600], [staleMs, 1000, 60000], [maxReconnects, 0, 20]]) {
      if (!Number.isInteger(value) || value < min || value > max) throw new Error('Invalid bounded provider configuration.');
    }
    this.symbol = symbol; this.metadata = metadata; this.transport = transport; this.clock = clock;
    this.limits = { publishMs, maxQueue, maxQueuedBytes, maxTrades, maxBooks, staleMs, maxReconnects }; this.queuedBytes = 0;
    this.listeners = new Set(); this.queue = []; this.trades = []; this.books = []; this.tradeIds = new Set(); this.gaps = []; this.lifecycle = [];
    this.currentBook = null; this.epoch = null; this.marketDataMode = null; this.status = 'unavailable'; this.message = 'CME connector and exact contract are not configured.';
    this.generation = 0; this.retry = 0; this.active = false; this.timer = null; this.retryTimer = null; this.opening = null;
    this.lastReceivedAt = null; this.timestamp = null; this.bookFloor = null; this.dirty = false; this.rejected = 0; this.duplicates = 0;
    this.book = metadata ? new DepthBook(metadata) : null;
    this.depthSequence = new SequenceBuffer({ now: clock.now, apply: event => this.applyDepth(event), onGap: info => this.gap('book', info) });
    this.tradeSequence = new SequenceBuffer({ now: clock.now, apply: event => this.applyTrade(event), onGap: info => this.gap('trades', info) });
    this.publish();
  }
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.snapshot;
  subscribeTrades(symbol) { if (symbol !== this.symbol) throw new Error('Instrument changes require a new provider instance.'); }
  subscribeOrderBook(symbol) { this.subscribeTrades(symbol); }
  unsubscribe(symbol) { if (symbol === this.symbol) this.disconnect(); }
  publish() {
    this.snapshot = { symbol: this.symbol, metadata: this.metadata, trades: this.trades.slice(), books: this.books.slice(), currentBook: this.currentBook,
      timestamp: this.timestamp, receivedAt: this.lastReceivedAt, simulated: Boolean(this.transport?.testOnly), source: this.transport?.testOnly ? 'Offline development fixture' : 'CME bridge', status: this.status, message: this.message,
      marketDataMode: this.marketDataMode, openInterest: null, epoch: this.epoch,
      lifecycle: this.lifecycle.slice(), quality: { complete: !this.gaps.length && !this.tradeSequence.pending.size && !this.depthSequence.pending.size, gaps: this.gaps.slice(), bookValid: Boolean(this.currentBook), rejected: this.rejected, duplicates: this.duplicates,
        retainedTrades: this.trades.length, tradeSequence: this.tradeSequence.last?.toString() || null, bookSequence: this.depthSequence.last?.toString() || null } };
    this.dirty = false; for (const listener of this.listeners) listener();
  }
  async connect() {
    if (!this.transport || !this.metadata?.contractId || !this.metadata?.expiry) { this.status = 'unavailable'; this.publish(); return; }
    if (this.opening) return this.opening;
    if (this.active) return;
    this.active = true; const generation = ++this.generation;
    this.status = 'connecting'; this.message = 'Awaiting authenticated provider session and depth snapshot.'; this.epoch = null;
    this.tradeSequence.reset(); this.depthSequence.reset(); this.book.clear(); this.currentBook = null; this.queue = []; this.queuedBytes = 0; this.bookFloor = null;
    this.lastReceivedAt = this.clock.now(); this.publish();
    this.timer = this.clock.setInterval(() => this.pump(), this.limits.publishMs);
    const current = callback => (...args) => { if (this.active && this.generation === generation) callback(...args); };
    const operation = Promise.resolve().then(() => {
      if (!this.active || this.generation !== generation) return;
      return this.transport.open({
      onOpen: current(() => this.transport.subscribe({ contractId: this.metadata.contractId, symbol: this.symbol, streams: ['trades', 'book'], sinceTimestampNs: this.trades.at(-1)?.timestampNs || null })),
      onEvent: current(raw => this.enqueue(raw)), onClose: current(() => this.lostConnection('Transport disconnected.')),
      onError: current(() => this.lostConnection('Market data transport failed.')),
    }); }).catch(() => { if (this.active && this.generation === generation) this.lostConnection('Market data transport failed.'); })
      .finally(() => { if (this.opening === operation) this.opening = null; });
    this.opening = operation; return operation;
  }
  disconnect() {
    this.active = false; ++this.generation; this.clock.clearInterval(this.timer); this.clock.clearTimeout(this.retryTimer);
    this.timer = null; this.retryTimer = null; this.opening = null; this.transport?.close(); this.queue = []; this.queuedBytes = 0;
    this.invalidateBook(); this.status = this.transport ? 'disconnected' : 'unavailable'; this.message = this.transport ? 'Market data disconnected.' : 'CME connector and exact contract are not configured.'; this.publish();
  }
  invalidateBook() {
    if (this.books.length && this.books.at(-1).validUntil === undefined) this.books[this.books.length - 1] = { ...this.books.at(-1), validUntil: this.timestamp };
    this.book?.clear(); this.currentBook = null; this.dirty = true;
  }
  lostConnection(message) {
    if (!this.active) return;
    this.gapRecord('connection', { reason: message }); this.invalidateBook();
    this.active = false; ++this.generation; this.transport.close(); this.clock.clearInterval(this.timer); this.timer = null; this.opening = null; this.queue = []; this.queuedBytes = 0;
    this.status = 'disconnected'; this.message = message; this.publish();
    if (this.retry >= this.limits.maxReconnects) { this.status = 'error'; this.message = 'Reconnect limit reached. Resume to retry.'; this.publish(); return; }
    const delay = Math.min(30000, 500 * 2 ** this.retry++);
    this.lifecycle.push({ type: 'reconnect', attempt: this.retry, reason: message, receivedAt: this.clock.now(), previousEpoch: this.epoch });
    if (this.lifecycle.length > 100) this.lifecycle.shift(); this.publish();
    this.retryTimer = this.clock.setTimeout(() => { this.retryTimer = null; this.connect(); }, delay);
  }
  enqueue(raw) {
    if (!this.active) return;
    let bytes;
    try { bytes = JSON.stringify(raw).length * 2; } catch { this.lostConnection('Invalid ingress envelope.'); return; }
    if (this.queue.length >= this.limits.maxQueue || this.queuedBytes + bytes > this.limits.maxQueuedBytes) { this.lostConnection('Ingress buffer overflow; retained analytics are incomplete.'); return; }
    this.queuedBytes += bytes; this.queue.push({ raw, receivedAt: this.clock.now(), bytes });
  }
  pump() {
    if (!this.active) return;
    const batch = this.queue.splice(0, 1024);
    this.queuedBytes -= batch.reduce((total, event) => total + event.bytes, 0);
    for (const { raw, receivedAt } of batch) {
      if (!this.active) break;
      try { this.ingest(normalizeEvent(raw, this.metadata, receivedAt)); }
      catch { this.rejected++; let highest; try { highest = sequence(raw?.sequence); } catch { /* Invalid sequence cannot set a recovery floor. */ } this.gap(raw?.type === 'trade' ? 'trades' : 'book', { reason: 'invalid-event', highest }); }
    }
    try { this.tradeSequence.check(); this.depthSequence.check(); } catch { this.gap('book', { reason: 'invalid-buffered-event' }); }
    if (this.active && this.clock.now() - this.lastReceivedAt >= this.limits.staleMs) this.lostConnection('Provider heartbeat timed out.');
    if (this.active && this.currentBook && (this.books.at(-1)?.sequence !== this.currentBook.sequence || this.books.at(-1)?.epoch !== this.currentBook.epoch)) {
      this.books.push(this.currentBook);
      let totalLevels = this.books.reduce((n, book) => n + book.levels.length, 0);
      while (this.books.length > this.limits.maxBooks || (totalLevels > 120000 && this.books.length > 1)) totalLevels -= this.books.shift().levels.length;
    }
    if (this.dirty) this.publish();
  }
  ingest(event) {
    if (event.type === 'session') {
      if (this.epoch && event.epoch !== this.epoch) { this.rejected++; this.dirty = true; return; }
      if (this.epoch) return;
      this.epoch = event.epoch; this.marketDataMode = event.marketDataMode; this.tradeSequence.seed(event.tradeSequence);
      this.lastReceivedAt = event.receivedAt; this.timestamp = event.timestamp; this.status = 'synchronizing'; this.message = 'Awaiting a valid two-sided depth snapshot.'; this.dirty = true; return;
    }
    if (!this.epoch || event.epoch !== this.epoch) { this.rejected++; this.dirty = true; return; }
    this.lastReceivedAt = event.receivedAt; this.timestamp = Math.max(this.timestamp || 0, event.timestamp); this.dirty = true;
    if (event.type === 'heartbeat') return;
    if (event.type === 'trade') { if (!this.tradeSequence.push(event)) this.duplicates++; return; }
    if (event.type === 'book-snapshot') {
      const seq = BigInt(event.sequence);
      if (this.currentBook && this.depthSequence.last !== null && seq === this.depthSequence.last) { this.duplicates++; return; }
      if ((this.bookFloor !== null && seq < this.bookFloor) || (this.depthSequence.last !== null && seq < this.depthSequence.last)) { this.rejected++; return; }
      this.applyDepth(event); this.depthSequence.seed(event.sequence); this.bookFloor = null; return;
    }
    this.depthSequence.push(event);
  }
  applyTrade(event) {
    if (this.tradeIds.has(event.tradeId)) { this.duplicates++; return; }
    if (this.trades.length === this.limits.maxTrades && event.timestamp < this.trades[0].timestamp) { this.gapRecord('trades', { reason: 'late-before-retained-window' }); return; }
    const trade = { id: event.tradeId, timestamp: event.timestamp, timestampNs: event.timestampNs, receivedAt: event.receivedAt,
      sequence: event.sequence, epoch: event.epoch, price: event.price, size: event.size, side: event.side };
    let low = 0, high = this.trades.length;
    while (low < high) { const middle = Math.floor((low + high) / 2); if (BigInt(this.trades[middle].timestampNs) <= BigInt(trade.timestampNs)) low = middle + 1; else high = middle; }
    this.trades.splice(low, 0, trade); this.tradeIds.add(event.tradeId);
    while (this.trades.length > this.limits.maxTrades) this.tradeIds.delete(this.trades.shift().id);
  }
  applyDepth(event) {
    if (event.type === 'depth-update' && !this.book.ready) throw new Error('No baseline book.');
    this.currentBook = this.book.apply(event);
    if (this.currentBook.bestBid === null || this.currentBook.bestAsk === null) { this.status = 'degraded'; this.message = 'One-sided depth; waiting for two-sided liquidity.'; }
    else if (this.marketDataMode === 'realtime' && this.clock.now() - event.timestamp >= this.limits.staleMs) { this.status = 'synchronizing'; this.message = 'Awaiting a fresh depth snapshot; historical depth cannot claim live status.'; }
    else if (this.tradeSequence.blocked) { this.status = 'degraded'; this.message = 'Trade sequence recovery required.'; }
    else { this.status = this.marketDataMode === 'realtime' ? 'connected' : this.marketDataMode; this.message = this.gaps.length ? 'Feed recovered; retained analytics contain gaps.' : 'Provider session and depth synchronized.'; this.retry = 0; }
  }
  gapRecord(stream, info) {
    this.gaps.push({ stream, ...info, detectedAt: this.clock.now(), epoch: this.epoch });
    if (this.gaps.length > 100) this.gaps.shift(); this.dirty = true;
  }
  gap(stream, info) {
    if (!this.active) return;
    this.gapRecord(stream, info); this.status = 'degraded'; this.message = `${stream === 'book' ? 'Depth snapshot' : 'Trade replay'} recovery required.`;
    if (stream === 'trades') { this.tradeSequence.blocked = true; this.lostConnection('Trade sequence gap; reconnecting with an incomplete retained window.'); return; }
    const floor = BigInt(info.highest || this.depthSequence.last?.toString() || '0');
    this.bookFloor = this.bookFloor !== null && this.bookFloor > floor ? this.bookFloor : floor;
    this.depthSequence.blocked = true; this.depthSequence.pending.clear(); this.depthSequence.pendingBytes = 0;
    this.invalidateBook();
    try { this.transport.requestSnapshot({ contractId: this.metadata.contractId, epoch: this.epoch, minimumSequence: this.bookFloor.toString() }); }
    catch { this.lostConnection('Depth snapshot request failed; reconnecting.'); }
  }
}
