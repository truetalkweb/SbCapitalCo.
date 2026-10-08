import test from 'node:test';
import assert from 'node:assert/strict';
import { journalDiscipline } from '../src/utils/journalDiscipline.js';
const row = extra => ({ id: 'one', symbol: 'AAPL', recordType: 'trade', status: 'closed', currency: 'USD', pnl: -20, plannedRiskAmount: 10, ...extra });
test('only completed USD trades with positive known risk participate in risk and R', () => {
  const result = journalDiscipline([row(), row({ id: 'win', pnl: 5 }), row({ id: 'unknown', plannedRiskAmount: null }), row({ id: 'invalid', plannedRiskAmount: -5 }), row({ id: 'cad', currency: 'CAD', pnl: -900 }), row({ id: 'open', status: 'open' })]);
  const over = result.risk.find(group => group.label === 'Loss exceeded planned risk');
  assert.equal(over.total, 1); assert.equal(over.plannedRiskTotal, 10); assert.equal(over.realizedLoss, 20); assert.equal(over.averageR, -2);
  assert.equal(result.risk.find(group => group.label === 'Planned risk unknown').riskKnown, 0);
});
test('partial exits group budgets once and preserve incomplete/unknown checklist and overlapping mistakes', () => {
  const records = [row({ id: 'part', source: 'Paper simulation', tradeGroupId: 'group', closesPosition: false, quantity: 4, pnl: -4, plannedRiskAmount: 4, entryChecklistStatus: 'complete', mistakeTags: 'late entry, chase' }), row({ id: 'close', source: 'Paper simulation', tradeGroupId: 'group', closesPosition: true, quantity: 6, pnl: -8, plannedRiskAmount: 6, entryChecklistStatus: 'incomplete', mistakeTags: 'chase' })];
  const result = journalDiscipline(records);
  assert.equal(result.risk[0].total, 1); assert.equal(result.risk[0].plannedRiskTotal, 10); assert.equal(result.risk[0].realizedLoss, 12); assert.equal(result.risk[0].averageR, -1.2);
  assert.equal(result.checklist[0].label, 'Recorded incomplete'); assert.equal(result.mistakes.length, 2); assert.ok(result.mistakes.every(group => group.total === 1));
  assert.equal(journalDiscipline([{ ...records[0], plannedRiskAmount: null }, records[1]]).risk[0].label, 'Planned risk unknown');
});
