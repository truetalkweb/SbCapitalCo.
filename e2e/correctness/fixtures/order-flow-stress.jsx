import { createRoot } from 'react-dom/client';
import OrderFlowPage from '../../../src/modules/orderFlow/OrderFlowPage.jsx';
import { CmeMarketDataProvider } from '../../../src/modules/orderFlow/data/CmeMarketDataProvider.js';
import { DevelopmentFeedHarness } from '../../../src/modules/orderFlow/data/DevelopmentFeedHarness.js';
import { resolveCmeContract } from '../../../src/modules/orderFlow/data/instruments.js';

// Development-only entry, absent from the production build. No network feed.
let time = Date.UTC(2026, 8, 30, 14), tradeSequence = 0, depthSequence = 1;
const clock = { now: () => time, setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {} };
const metadata = resolveCmeContract({ root: 'ES', contractId: 'fixture:ES:202612', expiry: '2026-12-18' });
const transport = new DevelopmentFeedHarness(), provider = new CmeMarketDataProvider({ metadata, transport, clock, maxReconnects: 0 });
const event = (type, extra = {}, ns = 0) => ({ version: 1, type, symbol: 'ES', contractId: metadata.contractId, epoch: 'offline-browser',
  timestampNs: String(BigInt(time) * 1000000n + BigInt(ns)), ...extra });
await provider.connect();
transport.emit(event('session', { tradeSequence: '0', marketDataMode: 'historical' }));
transport.emit(event('book-snapshot', { sequence: '1', levels: Array.from({ length: 4000 }, (_, i) => ({
  side: i < 2000 ? 'bid' : 'ask', price: i < 2000 ? 5800 - i * .25 : 5800.25 + (i - 2000) * .25, size: 10 + i })) }));
provider.pump();
function trade(ns) {
  const n = ++tradeSequence;
  transport.emit(event('trade', { sequence: String(n), tradeId: `fixture-${n}`, price: 5800 + n % 8 * .25, size: 1 + n % 5, side: n % 2 ? 'buy' : 'sell' }, ns));
}
for (let cycle = 0; cycle < 80; cycle++) {
  time += 100;
  for (let i = 0; i < 16; i++) trade(i + 1);
  transport.emit(event('depth-update', { sequence: String(++depthSequence), changes: [{ side: 'bid', price: 5800, size: cycle + 1 }] }, 17));
  provider.pump();
}
const createProvider = () => provider;
window.orderFlowStress = { provider, injectGap() {
  time += 100;
  transport.emit(event('depth-update', { sequence: String(depthSequence + 2), changes: [{ side: 'bid', price: 5800, size: 99 }] })); provider.pump();
  time += 251; provider.pump();
  time += 100; for (let i = 0; i < 8; i++) trade(i + 1); provider.pump();
}, state() { const snapshot = provider.getSnapshot(); return { simulated: snapshot.simulated, trades: snapshot.trades.length,
  levels: snapshot.books.reduce((n, book) => n + book.levels.length, 0), currentBookValid: Boolean(snapshot.currentBook), complete: snapshot.quality.complete }; } };
const root = document.getElementById('fixture');
root.style.cssText = 'height:calc(100vh - 24px);--ws-text:#f0f3f5;--ws-muted:#8193a3;--ws-bg:#070d11;--ws-panel:#070d11;--ws-border:#18242c';
createRoot(root).render(<OrderFlowPage createProvider={createProvider} />);
