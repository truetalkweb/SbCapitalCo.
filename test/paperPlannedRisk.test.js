import test from 'node:test';
import assert from 'node:assert/strict';
import { paperPlannedRisk, submitPaperOrder, processPaperOrders } from '../src/services/paperTradingEngine.js';
import { paperTradeHistory } from '../src/services/paperOrderCommands.js';
const now = Date.parse('2026-10-02T14:00Z'), costs = { commissionPerOrder: 1, commissionPerShare: .01, slippageBps: 10 };
const draft = extra => ({ id: 'entry', symbol: 'AAPL', side: 'BUY', type: 'MARKET', quantity: 10, referencePrice: 100, stopLoss: 99, tif: 'GTC', paperCosts: costs, ...extra });
const quote = price => [{ symbol: 'AAPL', price, source: 'Isolated test provider', timestamp: now / 1000 }];
const empty = () => ({ orders: [], positions: {}, realizedPnL: 0 });
test('long/short estimates include two commissions and adverse entry/stop slippage with limit caps', () => {
  assert.equal(paperPlannedRisk(draft()).amount, 14.19);
  assert.equal(paperPlannedRisk(draft({ side: 'SELL_SHORT', stopLoss: 101 })).amount, 14.21);
  assert.equal(paperPlannedRisk(draft({ type: 'LIMIT', limitPrice: 100 })).amount, 13.19);
  assert.equal(paperPlannedRisk(draft({ type: 'STOP_LIMIT', limitPrice: 100 })).amount, 13.19);
  assert.equal(paperPlannedRisk(draft({ stopLoss: null })), null);
  assert.equal(paperPlannedRisk(draft({ quantity: .5 })), null);
});
test('cost-aware rejection is atomic and an exact budget is accepted without double-counting fill slippage', () => {
  const state = empty(); const rejected = submitPaperOrder(state, draft(), quote(100), now, { riskPerTrade: 14 });
  assert.equal(rejected.state, state); assert.match(rejected.error, /planned loss \$14.19 > \$14.00/); assert.match(rejected.error, /commissions \$2.20/);
  const result = submitPaperOrder(state, draft(), quote(100), now, { riskPerTrade: 14.19 });
  assert.equal(result.order.status, 'FILLED'); assert.equal(result.order.plannedRiskAmount, 14.19);
});
test('waiting stop rechecks risk at the actual gap fill and never blocks a closing exit', () => {
  const result = submitPaperOrder(empty(), draft({ type: 'STOP', stopPrice: 101, stopLoss: 99 }), quote(100), now, { riskPerTrade: 25 });
  assert.equal(result.order.status, 'WORKING');
  assert.equal(processPaperOrders(result.state, quote(105), now).orders[0].status, 'REJECTED');
  const buy = submitPaperOrder(empty(), draft(), quote(100), now);
  const sell = submitPaperOrder(buy.state, draft({ id: 'exit', side: 'SELL', stopLoss: null }), quote(102), now, { riskPerTrade: .01 });
  assert.equal(sell.order.status, 'FILLED'); assert.equal(sell.order.plannedRiskAmount, 14.19);
});
test('partial exits allocate risk without duplication, keep checklist evidence and never invent legacy plans', () => {
  let result = submitPaperOrder(empty(), draft({ checklist: { plan: true, size: true, exit: true } }), quote(100), now);
  result = submitPaperOrder(result.state, draft({ id: 'part', side: 'SELL', quantity: 4, stopLoss: null }), quote(102), now);
  assert.equal(result.order.plannedRiskAmount, 5.676);
  result = submitPaperOrder(result.state, draft({ id: 'last', side: 'SELL', quantity: 6, stopLoss: null }), quote(102), now);
  const rows = paperTradeHistory(result.state);
  assert.equal(rows.reduce((sum, row) => sum + row.plannedRiskAmount, 0), 14.19); assert.ok(rows.every(row => row.entryChecklistStatus === 'complete'));
  const legacy = { ...empty(), positions: { AAPL: { quantity: 1, average: 100 } } };
  assert.equal(submitPaperOrder(legacy, draft({ side: 'SELL', quantity: 1, stopLoss: null }), quote(100), now).order.plannedRiskAmount, null);
});

test('scaling into known plans pools remaining budgets and mixed legacy entries stay unknown', () => {
  const complete = { plan: true, size: true, exit: true };
  let result = submitPaperOrder(empty(), draft({ checklist: complete }), quote(100), now);
  result = submitPaperOrder(result.state, draft({ id: 'scale', quantity: 5, checklist: { ...complete, size: false } }), quote(100), now);
  assert.equal(result.state.positions.AAPL.plannedRiskRemaining, 22.285);
  assert.equal(result.state.positions.AAPL.entryChecklistStatus, 'incomplete');
  result = submitPaperOrder(result.state, draft({ id: 'exit', side: 'SELL', quantity: 15, stopLoss: null }), quote(102), now);
  assert.equal(paperTradeHistory(result.state)[0].plannedRiskAmount, 22.285);
  const legacy = { ...empty(), positions: { AAPL: { quantity: 1, average: 100 } } };
  const added = submitPaperOrder(legacy, draft({ id: 'legacy-scale', checklist: complete }), quote(100), now);
  assert.equal(added.state.positions.AAPL.plannedRiskRemaining, null);
  assert.equal(added.state.positions.AAPL.entryChecklistStatus, 'unknown');
});
