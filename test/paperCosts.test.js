import test from 'node:test';
import assert from 'node:assert/strict';
import { submitPaperOrder, processPaperOrders, paperBalances, normalizePaperCosts, cancelPaperOrder } from '../src/services/paperTradingEngine.js';
import { applyPaperCommand, paperTradeHistory } from '../src/services/paperOrderCommands.js';
import { preparePaperCommand, acknowledgePaperCommand } from '../src/services/paperCommandRecovery.js';
const now = Date.parse('2026-09-21T15:00:00Z');
const costs = { commissionPerOrder: 1, commissionPerShare: 0.01, slippageBps: 10 };
const empty = () => ({ orders: [], positions: {}, realizedPnL: 0 });
const quote = price => [{ symbol: 'AAPL', price, source: 'Isolated cost fixture', lastTradeTime: new Date(now).toISOString() }];
const order = (state, id, side, quantity, price, extra = {}) => submitPaperOrder(state, { id, symbol: 'AAPL', side, quantity, type: 'MARKET', tif: 'GTC', paperCosts: costs, ...extra }, quote(price), now);

for (const short of [false, true]) test(`costs reconcile cash and entry allocation across partial ${short ? 'short' : 'long'} exits`, () => {
  const entry = order(empty(), 'entry', short ? 'SELL_SHORT' : 'BUY', 10, 100);
  assert.equal(entry.order.price, short ? 99.9 : 100.1);
  assert.equal(entry.order.commission, 1.1); assert.equal(entry.state.realizedPnL, -1.1);
  assert.equal(paperBalances(entry.state, quote(100), now).cash, short ? 100997.9 : 98997.9);
  const first = order(entry.state, 'partial', short ? 'BUY_TO_COVER' : 'SELL', 4, short ? 90 : 110);
  assert.equal(first.order.entryCommission, 0.44); assert.equal(first.state.positions.AAPL.entryFeesRemaining, 0.66);
  const last = order(first.state, 'last', short ? 'BUY_TO_COVER' : 'SELL', 6, short ? 90 : 110);
  assert.deepEqual(last.state.positions, {}); assert.equal(last.order.entryCommission, 0.66);
  const history = paperTradeHistory(last.state);
  assert.equal(history.reduce((sum, row) => sum + row.fees, 0), 3.2);
  const net = short ? 94.9 : 94.7;
  assert.ok(Math.abs(history.reduce((sum, row) => sum + row.pnl, 0) - net) < 1e-8);
  assert.equal(last.state.realizedPnL, net); assert.equal(paperBalances(last.state, [], now).cash, 100000 + net);
  assert.deepEqual(entry.state.positions.AAPL.entryFeesRemaining, 1.1, 'pure processing cannot mutate earlier snapshots');
});

test('multiple entries pool fees proportionally, with the last exit consuming the exact remainder', () => {
  let state = order(empty(), 'one', 'BUY', 3, 100).state;
  state = order(state, 'two', 'BUY', 4, 100).state;
  const original = state.positions.AAPL.entryFeesRemaining;
  let allocated = 0;
  for (let i = 0; i < 7; i++) { const result = order(state, `exit-${i}`, 'SELL', 1, 100); allocated += result.order.entryCommission; state = result.state; }
  assert.ok(Math.abs(allocated - original) < 1e-8); assert.deepEqual(state.positions, {});
  assert.ok(Math.abs(paperTradeHistory(state).reduce((sum, row) => sum + row.pnl, 0) - state.realizedPnL) < 1e-8);
});

test('limit and stop-limit fills cap adverse slippage on both sides and do not fabricate eligible quotes', () => {
  for (const side of ['BUY', 'SELL_SHORT']) for (const type of ['LIMIT', 'STOP_LIMIT']) {
    const buy = side === 'BUY', limitPrice = buy ? 100.05 : 99.95;
    const result = order(empty(), `${side}-${type}`, side, 10, 100, { type, limitPrice, stopPrice: 100 });
    assert.equal(result.order.price, limitPrice); assert.equal(result.order.status, 'FILLED');
    assert.equal(result.order.slippageCost, 0.5);
    const waiting = order(empty(), 'wait', side, 10, buy ? 101 : 99, { type: 'LIMIT', limitPrice });
    assert.equal(waiting.order.status, 'WORKING'); assert.equal(waiting.state.realizedPnL, 0);
  }
});

test('short and long protective stops retain entry costs and execute adverse gaps once', () => {
  for (const short of [false, true]) {
    const entry = order(empty(), 'entry', short ? 'SELL_SHORT' : 'BUY', 10, 100, { stopLoss: short ? 105 : 95, takeProfit: short ? 90 : 110 });
    assert.deepEqual(entry.state.orders.find(row => row.type === 'STOP').paperCosts, costs);
    const state = processPaperOrders(entry.state, quote(short ? 106 : 94), now);
    const stop = state.orders.find(row => row.type === 'STOP');
    assert.equal(stop.price, short ? 106.106 : 93.906); assert.equal(stop.commission, 1.1);
    assert.equal(stop.netTradePnL, short ? -64.26 : -64.14);
    assert.equal(state.orders.find(row => row.type === 'LIMIT').status, 'CANCELLED');
    assert.deepEqual(processPaperOrders(state, quote(100), now), state);
  }
});

test('fees and slippage reserve buying power and reject an unaffordable execution', () => {
  assert.match(order(empty(), 'over', 'BUY', 1000, 100).error, /buying power/);
  const queued = order(empty(), 'reserve', 'BUY', 10, 100, { type: 'STOP', stopPrice: 105 });
  assert.equal(paperBalances(queued.state, quote(100), now).reserved, 1052.15);
  assert.equal(paperBalances(cancelPaperOrder(queued.state, 'reserve', now).state, quote(100), now).reserved, 0);
  const large = order(empty(), 'gap', 'BUY', 999, 90, { type: 'STOP', stopPrice: 99 });
  const failed = processPaperOrders(large.state, quote(101), now);
  assert.equal(failed.orders[0].status, 'REJECTED'); assert.equal(failed.realizedPnL, 0);
});

test('invalid costs fail closed, old ledgers retain zero fees, and amendments cannot override saved costs', () => {
  for (const bad of [null, [], { commissionPerOrder: -1 }, { commissionPerShare: '0.1' }, { slippageBps: Infinity }, { slippageBps: 101 }]) {
    assert.throws(() => normalizePaperCosts(bad)); assert.ok(order(empty(), 'bad', 'BUY', 10, 100, { paperCosts: bad }).error);
  }
  const original = order(empty(), 'pending', 'BUY', 10, 100, { type: 'LIMIT', limitPrice: 95 });
  const amended = applyPaperCommand(original.state, { id: 'amend', kind: 'amend', orderId: 'pending', changes: { limitPrice: 96, paperCosts: {} } }, quote(100), now);
  assert.deepEqual(amended.order.paperCosts, costs);
  const legacy = order(empty(), 'legacy', 'BUY', 10, 100, { paperCosts: undefined });
  assert.equal(legacy.order.price, 100); assert.equal(legacy.state.realizedPnL, 0);
});

test('close, flatten and manual protection snapshot selected costs', () => {
  for (const kind of ['close', 'flatten', 'protect']) {
    const state = order(empty(), 'entry', 'BUY', 10, 100).state;
    const result = applyPaperCommand(state, { id: kind, kind, symbol: 'AAPL', stopLoss: 95, takeProfit: 110, paperCosts: costs }, quote(100), now);
    assert.equal(result.error, undefined);
    assert.ok(result.state.orders.filter(row => row.id.startsWith(kind)).every(row => row.paperCosts.commissionPerOrder === 1));
  }
});

test('unchanged uncertain intent retains its commission snapshot after preferences change', () => {
  const map = new Map(); const storage = { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
  const request = { id: 'first', kind: 'close', symbol: 'AAPL', paperCosts: costs };
  const first = preparePaperCommand(request, 'user', storage);
  assert.deepEqual(preparePaperCommand({ ...request, id: 'second', paperCosts: {} }, 'user', storage), first);
  acknowledgePaperCommand(first, 'user', storage);
  assert.deepEqual(preparePaperCommand({ ...request, id: 'third', paperCosts: {} }, 'user', storage).paperCosts, {});
});

test('entry commissions count toward the daily loss gate without preventing exits', () => {
  const entry = order(empty(), 'one', 'BUY', 10, 100);
  const blocked = submitPaperOrder(entry.state, { id: 'two', symbol: 'AAPL', side: 'BUY', quantity: 1, type: 'MARKET', tif: 'GTC' }, quote(100), now, { dailyLossLimit: 1 });
  assert.match(blocked.error, /daily paper loss limit/i);
  const exit = applyPaperCommand(entry.state, { id: 'close', kind: 'close', symbol: 'AAPL', paperCosts: costs }, quote(100), now, { dailyLossLimit: 1 });
  assert.equal(exit.error, undefined); assert.deepEqual(exit.state.positions, {});
});
