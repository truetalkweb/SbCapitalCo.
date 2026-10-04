import test from 'node:test';
import assert from 'node:assert/strict';
import { submitPaperOrder } from '../src/services/paperTradingEngine.js';
import { paperTradeHistory } from '../src/services/paperOrderCommands.js';
import { groupJournalTrades, journalBreakdowns, journalStatistics } from '../src/utils/journalAccounting.js';
const start = Date.parse('2026-10-02T14:00:00Z');
const empty = () => ({ orders: [], positions: {}, realizedPnL: 0 });
const fill = (state, id, side, quantity, price, offset = 0, extra = {}) => submitPaperOrder(state,
  { id, symbol: 'AAPL', side, quantity, type: 'MARKET', tif: 'GTC', setup: 'Breakout', paperCosts: { commissionPerOrder: 1 }, ...extra },
  [{ symbol: 'AAPL', price, source: 'Isolated test provider', timestamp: (start + offset) / 1000 }], start + offset).state;
for (const short of [false, true]) test(`journal groups ${short ? 'short' : 'long'} scale-ins and partial exits without changing net costs`, () => {
  let state = fill(empty(), 'entry', short ? 'SELL_SHORT' : 'BUY', 10, 100);
  state = fill(state, 'scale', short ? 'SELL_SHORT' : 'BUY', 10, 100, 60000, { setup: 'Another setup' });
  state = fill(state, 'partial', short ? 'BUY_TO_COVER' : 'SELL', 5, short ? 90 : 110, 120000);
  let history = paperTradeHistory(state), grouped = groupJournalTrades(history);
  assert.equal(grouped.length, 1); assert.equal(grouped[0].status, 'open'); assert.equal(journalStatistics(grouped).total, 0);
  state = fill(state, 'final', short ? 'BUY_TO_COVER' : 'SELL', 15, short ? 90 : 110, 180000);
  history = paperTradeHistory(state); grouped = groupJournalTrades(history);
  assert.equal(grouped.length, 1); assert.equal(grouped[0].quantity, 20); assert.equal(grouped[0].exitCount, 2);
  assert.equal(grouped[0].pnl, 196); assert.equal(grouped[0].fees, 4); assert.equal(grouped[0].setup, 'Breakout');
  assert.equal(journalStatistics(grouped).total, 1);
  const analysis = journalBreakdowns(history);
  assert.equal(analysis.setup[0].net, 196); assert.equal(analysis.time[0].label, '10:00–10:59 ET'); assert.equal(analysis.session[0].label, 'Regular');
  state = fill(state, 'reopen', short ? 'SELL_SHORT' : 'BUY', 1, 100, 240000);
  state = fill(state, 'reclose', short ? 'BUY_TO_COVER' : 'SELL', 1, 100, 300000);
  assert.equal(groupJournalTrades(paperTradeHistory(state)).length, 2, 'same symbol is a new round trip after flattening');
});
test('unknown entry times remain unknown; legacy rows and currencies are not merged', () => {
  const rows = [1, 2].map(id => ({ id, symbol: 'AAPL', recordType: 'trade', status: 'closed', pnl: 5, closedAt: '2026-10-02T14:00:00Z', source: 'Paper simulation' }));
  assert.equal(groupJournalTrades(rows).length, 2); assert.equal(journalBreakdowns(rows).time[0].label, 'Entry time unknown');
  assert.equal(journalBreakdowns([...rows, { ...rows[0], id: 3, currency: 'CAD', pnl: 900 }]).setup[0].net, 10);
});
test('entry hours use Eastern DST and session boundaries instead of exit clocks', () => {
  const record = { id: 'a', recordType: 'trade', status: 'closed', pnl: 10, createdAt: '2026-11-30T22:00:00Z', openedAt: '2026-11-27T18:00:00Z' };
  assert.equal(journalBreakdowns([record]).session[0].label, 'After Hours');
  assert.equal(journalBreakdowns([record]).time[0].label, '13:00–13:59 ET');
});
