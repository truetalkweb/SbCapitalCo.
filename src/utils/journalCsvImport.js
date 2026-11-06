import { normalizeJournalRecord } from './journalAccounting.js';

export const JOURNAL_CSV_LIMIT = 256 * 1024;
export const JOURNAL_CSV_TEMPLATE = 'tradeId,symbol,side,closedAt,quantity,entryPrice,exitPrice,fees,setup,followedPlan\r\nexample-001,AAPL,Long,2026-11-04T17:30:00Z,10,100,102,1,Breakout,Yes\r\n';

function parseRows(text) {
  const rows = [];
  let row = [], field = '', quoted = false, closedQuote = false;
  const endField = () => { row.push(field); field = ''; closedQuote = false; };
  const endRow = () => {
    endField();
    if (row.some(value => value.trim())) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else { quoted = false; closedQuote = true; }
    } else if (char === ',') endField();
    else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else if (closedQuote || (char === '"' && field)) throw new Error('Invalid CSV quoting.');
    else if (char === '"') quoted = true;
    else field += char;
  }
  if (quoted) throw new Error('Unclosed quoted CSV field.');
  endRow();
  return rows;
}

const required = ['tradeId', 'symbol', 'side', 'closedAt', 'quantity', 'entryPrice', 'exitPrice', 'fees'];
const decimal = /^\d+(?:\.\d+)?$/;
const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function previewJournalCsv(text, existing = []) {
  if (new TextEncoder().encode(text).length > JOURNAL_CSV_LIMIT) throw new Error('Choose a CSV file up to 256 KB.');
  const [headers = [], ...rows] = parseRows(text.replace(/^\uFEFF/, ''));
  const columns = headers.map(value => value.trim());
  if (!required.every(key => columns.includes(key)) || new Set(columns).size !== columns.length) {
    throw new Error('Use the template headers with each required column listed once.');
  }
  if (!rows.length || rows.length > 500) throw new Error('Include 1 to 500 trades per file.');
  const known = new Set(existing.map(row => row.id));
  const ids = new Set();
  const entries = [], errors = [];
  let duplicates = 0;
  rows.forEach((cells, index) => {
    const row = Object.fromEntries(columns.map((key, i) => [key, cells[i]?.trim() || '']));
    const { tradeId, closedAt, quantity, entryPrice, exitPrice, fees } = row;
    const symbol = row.symbol.toUpperCase();
    const side = row.side.toLowerCase();
    const timestamp = Date.parse(closedAt);
    const expectedTime = closedAt.includes('.') ? closedAt : closedAt.replace(/Z$/, '.000Z');
    const followedPlan = row.followedPlan || '';
    const id = 'csv:' + tradeId;
    const entry = normalizeJournalRecord({
      id, symbol, bias: side === 'short' ? 'Short' : 'Long', closedAt, createdAt: closedAt,
      recordType: 'trade', status: 'closed', currency: 'USD', source: 'CSV import',
      quantity, entryPrice, exitPrice, fees, setup: row.setup || 'Unspecified', planAdherence: followedPlan,
    });
    if (cells.length !== columns.length || !/^[\w.:-]{1,100}$/.test(tradeId) || !/^[A-Z0-9.:-]{1,16}$/.test(symbol)
      || !['long', 'short'].includes(side) || !utc.test(closedAt) || !Number.isFinite(timestamp)
      || new Date(timestamp).toISOString() !== expectedTime
      || ![quantity, entryPrice, exitPrice, fees].every(value => decimal.test(value))
      || !entry.eligible || (row.setup?.length || 0) > 100 || !['', 'Yes', 'No'].includes(followedPlan)) {
      errors.push('Trade ' + (index + 1) + ' has invalid fields. Check ID, symbol, side, UTC close time, prices, quantity and fees.');
    } else if (ids.has(id)) {
      errors.push('Trade ' + (index + 1) + ' repeats an ID in this file.');
    } else {
      ids.add(id);
      if (known.has(id)) duplicates++;
      else entries.push(entry);
    }
  });
  return { entries, errors, duplicates };
}
