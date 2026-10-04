import test from 'node:test';
import assert from 'node:assert/strict';
import { filterJournalRecords, normalizeJournalFilters } from '../src/utils/journalFilters.js';
import { groupJournalTrades, journalStatistics, journalBreakdowns } from '../src/utils/journalAccounting.js';
const trade = (id, closedAt, extra = {}) => ({ id, symbol: 'AAPL', setup: 'Breakout', recordType: 'trade', status: 'closed', pnl: 10, closedAt, ...extra });
test('inclusive date boundaries use Eastern days across UTC midnight and winter/summer offsets', () => {
  const rows = [trade('before', '2026-10-02T03:59:59Z'), trade('start', '2026-10-02T04:00:00Z'), trade('end', '2026-10-03T03:59:59Z'), trade('after', '2026-10-03T04:00:00Z')];
  assert.deepEqual(filterJournalRecords(rows, { from: '2026-10-02', to: '2026-10-02' }).rows.map(row => row.id), ['start', 'end']);
  const winter = [trade('before', '2026-01-02T04:59:59Z'), trade('start', '2026-01-02T05:00:00Z')];
  assert.deepEqual(filterJournalRecords(winter, { from: '2026-01-02' }).rows.map(row => row.id), ['start']);
});
test('symbol, setup, kind and search all narrow the same record scope without mutating records', () => {
  const rows = [trade('match', '2026-10-02T14:00Z', { notes: 'Reviewed risk' }), trade('symbol', '2026-10-02T14:00Z', { symbol: 'TSLA' }), trade('setup', '2026-10-02T14:00Z', { setup: 'Pullback' }), trade('note', '2026-10-02T14:00Z', { recordType: 'note', notes: 'Reviewed risk' })];
  const original = JSON.stringify(rows);
  const filtered = filterJournalRecords(rows, { symbol: 'aapl', setup: 'Breakout', kind: 'trade', search: 'reviewed RISK' });
  assert.deepEqual(filtered.rows.map(row => row.id), ['match']); assert.equal(journalStatistics(filtered.rows).net, 10);
  assert.equal(JSON.stringify(rows), original);
});
test('group before filtering retains prior partial exit accounting and excludes positions still open', () => {
  const rows = [trade('first', '2026-10-01T15:00Z', { tradeGroupId: 'one', source: 'Paper simulation', quantity: 4, pnl: 38, fees: 2, closesPosition: false }), trade('final', '2026-10-02T15:00Z', { tradeGroupId: 'one', source: 'Paper simulation', quantity: 6, pnl: 57, fees: 3, closesPosition: true }), trade('still-open', '2026-10-02T15:00Z', { tradeGroupId: 'two', source: 'Paper simulation', quantity: 1, pnl: 9, closesPosition: false })];
  const grouped = filterJournalRecords(groupJournalTrades(rows), { from: '2026-10-02', to: '2026-10-02' });
  const stats = journalStatistics(grouped.rows); assert.equal(stats.total, 1); assert.equal(stats.net, 95);
  assert.equal(grouped.rows.find(row => row.tradeGroupId === 'one').fees, 5);
  const execution = filterJournalRecords(rows, { from: '2026-10-02', to: '2026-10-02' });
  assert.equal(journalStatistics(execution.rows).net, 66);
});
test('unknown dates are excluded only with a date filter; invalid/reversed dates return an explicit error', () => {
  const unknown = [trade('unknown', null)];
  assert.equal(filterJournalRecords(unknown).rows.length, 1);
  const scoped = filterJournalRecords(unknown, { from: '2026-10-02' }); assert.equal(scoped.rows.length, 0); assert.equal(scoped.unknownDateCount, 1);
  for (const filters of [{ from: '2026-02-30' }, { from: 'invalid' }, { from: '2026-10-03', to: '2026-10-02' }]) {
    const result = filterJournalRecords(unknown, filters); assert.ok(result.error); assert.deepEqual(result.rows, []);
  }
});
test('grouping is idempotent and keeps each exit review searchable without losing comparison P&L', () => {
  const rows = [trade('first', '2026-10-01T15:00Z', { tradeGroupId: 'one', source: 'Paper simulation', pnl: 38, notes: 'Reviewed risk', closesPosition: false }), trade('final', '2026-10-02T15:00Z', { tradeGroupId: 'one', source: 'Paper simulation', pnl: 57, notes: 'Final exit', closesPosition: true })];
  const grouped = groupJournalTrades(rows);
  assert.deepEqual(groupJournalTrades(grouped), grouped);
  const scope = filterJournalRecords(grouped, { search: 'Reviewed risk' });
  assert.equal(scope.rows.length, 1);
  assert.equal(journalBreakdowns(scope.rows).setup[0].net, 95);
});
test('persisted malformed filter values fall back safely and a range supports DST transition days', () => {
  assert.deepEqual(normalizeJournalFilters({ symbol: {}, search: null, kind: 'injected', groupExits: 'false' }), normalizeJournalFilters());
  const rows = [trade('spring', '2026-03-09T03:59:59Z'), trade('next', '2026-03-09T04:00:00Z')];
  assert.deepEqual(filterJournalRecords(rows, { from: '2026-03-08', to: '2026-03-08' }).rows.map(row => row.id), ['spring']);
  assert.equal(normalizeJournalFilters({ search: 'Opening ' }).search, 'Opening ', 'spaces remain editable in a controlled search input');
});
