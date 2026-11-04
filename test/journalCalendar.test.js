import test from 'node:test';
import assert from 'node:assert/strict';
import { createJournalDayFormatter, journalCalendarDays } from '../src/utils/journalCalendar.js';
import { normalizeJournalRecord } from '../src/utils/journalAccounting.js';
import { filterJournalRecords } from '../src/utils/journalFilters.js';

test('realized exits land on their individual close days in the reporting zone', () => {
  const { dayKey } = createJournalDayFormatter('America/Dawson_Creek');
  const exit = { recordType: 'trade', status: 'closed', source: 'Paper simulation', tradeGroupId: 'one-position', currency: 'USD' };
  const records = [
    { ...exit, id: 'first', pnl: 12.25, closedAt: '2026-11-01T06:59:59Z' },
    { ...exit, id: 'last', pnl: -2.75, closedAt: '2026-11-01T07:00:00Z', closesPosition: true },
    { ...exit, id: 'open', status: 'open', pnl: 900 },
    { ...exit, id: 'foreign', pnl: 700, currency: 'CAD' },
    { ...exit, id: 'undated', pnl: 3 },
    { recordType: 'note', pnl: 100, createdAt: '2026-11-01T07:00:00Z' },
  ];
  const { days, unknownDateCount } = journalCalendarDays(records, dayKey);
  assert.equal(unknownDateCount, 1);
  assert.equal(days.get('2026-10-31').net, 12.25);
  assert.equal(days.get('2026-11-01').net, -2.75);
  assert.deepEqual(filterJournalRecords(records, { to: '2026-10-31' }, dayKey).rows.map(row => row.id), ['first']);
});

test('manual net P&L uses decimal arithmetic and retains previously recorded amounts', () => {
  const trade = { recordType: 'trade', status: 'closed', quantity: '0.3', entryPrice: '10.10', exitPrice: '10.30', fees: '0.06' };
  assert.equal(normalizeJournalRecord(trade).pnl, 0);
  assert.equal(normalizeJournalRecord({ ...trade, bias: 'Short' }).pnl, -0.12);
  assert.equal(normalizeJournalRecord({ ...trade, exitPrice: '10.60' }).pnl, 0.09);
  assert.equal(normalizeJournalRecord({ ...trade, pnl: 10 }).pnl, 10);
  assert.equal(normalizeJournalRecord({ ...trade, quantity: 1e100 }).eligible, false);
});
