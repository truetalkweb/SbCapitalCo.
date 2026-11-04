import test from 'node:test';
import assert from 'node:assert/strict';
import { submitPaperOrder } from '../src/services/paperTradingEngine.js';
import { applyPaperCommand, paperTradeHistory } from '../src/services/paperOrderCommands.js';
import { groupJournalTrades } from '../src/utils/journalAccounting.js';
const now = Date.parse('2026-10-08T15:00:00Z');
const quotes = [{ symbol: 'AAPL', price: 100, source: 'Test provider', lastTradeTime: new Date(now).toISOString() }];
const empty = { orders: [], positions: {}, realizedPnL: 0 };

for (const side of ['BUY', 'SELL_SHORT']) test(`${side} retains bounded plan metadata through queued amendment and journal grouping`, () => {
  const short = side === 'SELL_SHORT';
  const entry = submitPaperOrder(empty, { id: 'entry', symbol: 'AAPL', side, type: 'LIMIT', quantity: 2,
    limitPrice: short ? 101 : 99, setup: 'x'.repeat(200), notes: 'y'.repeat(3000), stopLoss: short ? 110 : 90, takeProfit: short ? 90 : 110 }, quotes, now);
  assert.equal(entry.order.status, 'WORKING');
  const amended = applyPaperCommand(entry.state, { id: 'amended', kind: 'amend', orderId: 'entry', changes: { limitPrice: 100 } }, quotes, now);
  assert.equal(amended.order.status, 'FILLED');
  assert.equal(amended.order.tradePlan.setup.length, 100);
  assert.equal(amended.order.tradePlan.notes.length, 2000);
  let state = applyPaperCommand(amended.state, { id: 'cancel', kind: 'cancel-all' }, quotes, now).state;
  for (const id of ['partial', 'final']) state = submitPaperOrder(state, { id, symbol: 'AAPL', side: short ? 'BUY_TO_COVER' : 'SELL', type: 'MARKET', quantity: 1 }, quotes, now).state;
  const rows = paperTradeHistory(state);
  assert.equal(rows.length, 2);
  const grouped = groupJournalTrades(rows);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].tradePlan.stopLoss, short ? 110 : 90);
  assert.equal(grouped[0].tradePlan.notes, 'y'.repeat(2000));
  assert.match(grouped[0].notes, /yyyy/);
  assert.equal(grouped[0].pnl, 0);
  assert.equal(state.realizedPnL, 0);
});
