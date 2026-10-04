import { normalizeJournalRecord } from './journalAccounting.js';
import { getNyDateParts } from './marketSession.js';

export const DEFAULT_JOURNAL_FILTERS = Object.freeze({ from: '', to: '', symbol: '', setup: '', search: '', kind: 'all', groupExits: true });
export function normalizeJournalFilters(value = {}) {
  const text = key => typeof value?.[key] === 'string' ? value[key].trim().slice(0, 200) : '';
  return { from: text('from'), to: text('to'), symbol: text('symbol').toUpperCase(), setup: text('setup'), search: typeof value?.search === 'string' ? value.search.slice(0, 200) : '',
    kind: ['all', 'trade', 'note'].includes(value?.kind) ? value.kind : 'all', groupExits: typeof value?.groupExits === 'boolean' ? value.groupExits : true };
}
function validDate(text) {
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(Date.parse(`${text}T12:00:00Z`)) && new Date(`${text}T12:00:00Z`).toISOString().slice(0, 10) === text;
}
function easternDay(timestamp) {
  const { year, month, day } = getNyDateParts(new Date(timestamp));
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
// Call after grouping to keep all exits in a position together. Execution view
// deliberately calls this on each raw exit instead, using its own realization day.
export function filterJournalRecords(records, options = {}) {
  const filters = normalizeJournalFilters(options);
  if ((filters.from && !validDate(filters.from)) || (filters.to && !validDate(filters.to))) return { rows: [], error: 'Choose valid calendar dates for the journal range.', unknownDateCount: 0 };
  if (filters.from && filters.to && filters.from > filters.to) return { rows: [], error: 'The journal start date must be on or before the end date.', unknownDateCount: 0 };
  let unknownDateCount = 0;
  const query = filters.search.trim().toLowerCase();
  const rows = records.map(normalizeJournalRecord).filter(row => {
    if (filters.kind !== 'all' && row.recordType !== filters.kind) return false;
    if (filters.symbol && String(row.symbol || '').toUpperCase() !== filters.symbol) return false;
    if (filters.setup && String(row.setup || 'Unspecified').trim() !== filters.setup) return false;
    if (query && ![row.symbol, row.setup, row.notes, row.review, row.tags, row.tag, row.searchText].join(' ').toLowerCase().includes(query)) return false;
    if (!filters.from && !filters.to) return true;
    if (row.timestamp === null) { unknownDateCount += 1; return false; }
    const date = easternDay(row.timestamp);
    return (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to);
  });
  return { rows, error: '', unknownDateCount };
}
